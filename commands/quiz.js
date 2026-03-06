// commands/quiz.js
const fs     = require('fs');
const path   = require('path');
const crypto = require('crypto');

const OWNER_NUMBER = '201009390573';
const DB_FILE      = path.join(__dirname, '../points_db.json');
const QUIZ_FILE    = path.join(__dirname, '../quiz_questions.json');
const activeQuizzes = new Map();

// cache لتحويل @lid → @s.whatsapp.net
const lidToWa = new Map();

function sha256(text) {
    return crypto.createHash('sha256').update(text).digest();
}

function toBuf(v) {
    if (!v) return Buffer.alloc(0);
    if (Buffer.isBuffer(v)) return v;
    if (v instanceof Uint8Array) return Buffer.from(v);
    if (typeof v === 'string') return Buffer.from(v, 'base64');
    if (v?.type === 'Buffer') return Buffer.from(v.data);
    if (typeof v === 'object') return Buffer.from(Object.values(v));
    return Buffer.alloc(0);
}

// ─── تحديث الـ cache من بيانات المجموعة ─────
// استدعيها كلما جاء groupMetadata
function updateLidCache(groupMetadata) {
    try {
        const participants = groupMetadata?.participants || [];
        for (const p of participants) {
            if (p.lid && p.id) {
                // lid = "123@lid", id = "123@s.whatsapp.net"
                lidToWa.set(p.lid, p.id);
                lidToWa.set(p.id, p.id); // نفسه → نفسه
            }
        }
    } catch (_) {}
}

// ─── تحويل @lid إلى @s.whatsapp.net ──────────
function resolveJid(jid, sock, groupId) {
    if (!jid) return jid;
    if (!jid.endsWith('@lid')) return jid; // مش @lid → ارجعه كما هو

    // جرب الـ cache أولاً
    if (lidToWa.has(jid)) return lidToWa.get(jid);

    // لو مش موجود في الـ cache حاول تجيب بيانات المجموعة
    if (sock && groupId) {
        sock.groupMetadata(groupId).then(meta => updateLidCache(meta)).catch(() => {});
    }

    return jid; // ارجعه كما هو مؤقتاً
}

// ─── فك تشفير التصويت ────────────────────────
function decryptPollVote(encPayloadRaw, encIvRaw, secret, pollMsgId, voterJid) {
    const encPayload = toBuf(encPayloadRaw);
    const encIv      = toBuf(encIvRaw);

    if (encPayload.length < 17 || secret.length === 0) return [];

    // نجرب كل صيغ الـ voter
    const voters = [
        voterJid,                                          // الأصلي كما هو
        voterJid.replace('@lid', '@s.whatsapp.net'),       // حوّل @lid
        lidToWa.get(voterJid) || '',                       // من الـ cache
        voterJid.split('@')[0],                            // رقم فقط
        '',                                                // فاضي
    ].filter((v, i, arr) => arr.indexOf(v) === i);        // إزالة المكرر

    const infos = ['PollVoteKey', 'PollVote'];

    for (const voter of voters) {
        const salts = [
            crypto.createHash('sha256').update(Buffer.concat([secret, Buffer.from(voter), Buffer.from(pollMsgId)])).digest(),
            crypto.createHash('sha256').update(Buffer.concat([Buffer.from(pollMsgId), Buffer.from(voter)])).digest(),
            crypto.createHash('sha256').update(Buffer.concat([Buffer.from(voter), Buffer.from(pollMsgId)])).digest(),
            crypto.createHash('sha256').update(secret).digest(),
            Buffer.alloc(32),
        ];

        for (const salt of salts) {
            for (const info of infos) {
                try {
                    const prk = crypto.createHmac('sha256', salt).update(secret).digest();
                    const key = crypto.createHmac('sha256', prk)
                        .update(Buffer.concat([Buffer.from(info), Buffer.from([1])]))
                        .digest();

                    const iv     = encIv.slice(0, 12);
                    const tag    = encPayload.slice(-16);
                    const cipher = encPayload.slice(0, -16);

                    const dec = crypto.createDecipheriv('aes-256-gcm', key, iv);
                    dec.setAuthTag(tag);
                    const plain = Buffer.concat([dec.update(cipher), dec.final()]);

                    const hashes = [];
                    let i = 0;
                    while (i < plain.length) {
                        const wt = plain[i] & 0x07; i++;
                        if (wt === 2) {
                            let len = 0, sh = 0;
                            while (i < plain.length) {
                                const b = plain[i++];
                                len |= (b & 0x7F) << sh; sh += 7;
                                if (!(b & 0x80)) break;
                            }
                            if (len === 32 && i + 32 <= plain.length)
                                hashes.push(plain.slice(i, i + 32));
                            i += len;
                        } else if (wt === 0) { while (i < plain.length && (plain[i++] & 0x80));
                        } else if (wt === 1) { i += 8;
                        } else if (wt === 5) { i += 4;
                        } else break;
                    }

                    if (hashes.length) {
                        console.log(`✅ POLL OK — voter:"${voter}" info:"${info}"`);
                        return hashes;
                    }
                } catch (_) {}
            }
        }
    }

    console.error('❌ poll decrypt failed — voterJid:', voterJid);
    return [];
}

// ─── قاعدة النقاط ────────────────────────────
function loadDB() {
    try { if (fs.existsSync(DB_FILE)) return JSON.parse(fs.readFileSync(DB_FILE)); } catch {}
    return {};
}
function saveDB(db) { fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2)); }
function addPoints(groupId, userJid, points) {
    const db = loadDB();
    if (!db[groupId]) db[groupId] = { name: '', users: {} };
    if (!db[groupId].users[userJid]) db[groupId].users[userJid] = 0;
    db[groupId].users[userJid] += points;
    saveDB(db);
}

// ─── ملف الأسئلة ─────────────────────────────
function loadQuestions() {
    try { if (fs.existsSync(QUIZ_FILE)) return JSON.parse(fs.readFileSync(QUIZ_FILE)); } catch {}
    return [];
}
function saveQuestions(q) { fs.writeFileSync(QUIZ_FILE, JSON.stringify(q, null, 2)); }

// ─── تحليل الأسئلة ───────────────────────────
function parseAndValidate(text) {
    const results = [], errors = [];
    const blocks = text.split(/\n(?=س\d+\s*:)/g);
    for (let bi = 0; bi < blocks.length; bi++) {
        const lines = blocks[bi].trim().split('\n').map(l => l.trim()).filter(Boolean);
        if (!lines.length) continue;
        const qMatch = lines[0].match(/^س(\d+)\s*:\s*(.+)$/);
        if (!qMatch) { errors.push(`⚠️ كتلة ${bi+1}: "${lines[0]}"`); continue; }
        const qText = qMatch[2].trim();
        const choices = []; let correctIndex = -1, points = 2, explanation = '';
        const blockErrors = [];
        for (let li = 1; li < lines.length; li++) {
            const line = lines[li];
            const cM = line.match(/^(\d+)[.\-\)]\s*(.+)$/);
            if (cM) { choices.push(cM[2].trim()); continue; }
            const aM = line.match(/^ج\s*:\s*(\d+)/);
            if (aM) { correctIndex = parseInt(aM[1]) - 1; continue; }
            const pM = line.match(/^نقاط\s*:\s*(\d+)/);
            if (pM) { points = parseInt(pM[1]); continue; }
            const eM = line.match(/^شرح\s*:\s*(.+)/);
            if (eM) { explanation = eM[1].trim(); continue; }
        }
        if (choices.length < 2) blockErrors.push(`عدد الاختيارات ${choices.length} — يجب 2+`);
        if (choices.length > 4) blockErrors.push(`الحد الأقصى 4 اختيارات`);
        if (correctIndex === -1) blockErrors.push(`لم يُحدَّد الجواب (ج: رقم)`);
        else if (correctIndex < 0 || correctIndex >= choices.length)
            blockErrors.push(`رقم الجواب خارج النطاق`);
        if (blockErrors.length) { errors.push(`⚠️ "${qText}":\n${blockErrors.map(e=>`   • ${e}`).join('\n')}`); continue; }
        results.push({ question: qText, choices, correctIndex, points, explanation });
    }
    return { questions: results, errors };
}

// ─── إرسال سؤال ──────────────────────────────
async function sendQuestion(sock, groupId, qs) {
    const q     = qs.questions[qs.currentIndex];
    const qNum  = qs.currentIndex + 1;
    const total = qs.questions.length;
    const messageSecret = crypto.randomBytes(32);

    // جيب بيانات المجموعة لتحديث الـ cache قبل كل سؤال
    try {
        const meta = await sock.groupMetadata(groupId);
        updateLidCache(meta);
    } catch (_) {}

    const pollMsg = await sock.sendMessage(groupId, {
        poll: {
            name: `❓ سؤال ${qNum}/${total}\n${q.question}`,
            values: q.choices,
            selectableCount: 1,
            messageSecret
        }
    });

    qs.currentPollId    = pollMsg.key.id;
    qs.messageSecret    = messageSecret;
    qs.answeredUsers    = new Map();
    qs.firstCorrectUser = null;
    qs.groupId          = groupId;
    qs.timer = setTimeout(() => revealAnswer(sock, groupId), 60_000);
}

// ─── إعلان الإجابة ───────────────────────────
async function revealAnswer(sock, groupId) {
    const qs = activeQuizzes.get(groupId);
    if (!qs) return;
    clearTimeout(qs.timer);
    const q = qs.questions[qs.currentIndex];
    let replyMsg = `✅ *الإجابة الصحيحة:* ${q.correctIndex+1}. ${q.choices[q.correctIndex]}\n`;
    if (q.explanation) replyMsg += `💡 ${q.explanation}\n`;
    const winner = qs.firstCorrectUser;
    const mentions = [];
    if (winner) {
        addPoints(groupId, winner, q.points);
        qs.scores.set(winner, (qs.scores.get(winner) || 0) + q.points);
        mentions.push(winner);
        replyMsg += `\n🏆 الفائز: @${winner.split('@')[0]}\n🎁 *+${q.points} نقطة*`;
    } else {
        replyMsg += '\n😔 لم يُجب أحد بشكل صحيح.';
    }
    await sock.sendMessage(groupId, { text: replyMsg, mentions });
    qs.currentIndex++;
    await new Promise(r => setTimeout(r, 3000));
    if (qs.currentIndex < qs.questions.length) await sendQuestion(sock, groupId, qs);
    else await endQuiz(sock, groupId);
}

// ─── إنهاء المسابقة ──────────────────────────
async function endQuiz(sock, groupId) {
    const qs = activeQuizzes.get(groupId);
    if (!qs) return;
    clearTimeout(qs.timer);
    const sorted = [...qs.scores.entries()].sort((a, b) => b[1] - a[1]);
    const medals = ['🥇','🥈','🥉'];
    const mentions = sorted.map(([jid]) => jid);
    let finalMsg = `🏁 *انتهت المسابقة!*\n━━━━━━━━━━━━━━━━\n📊 *النتائج النهائية:*\n\n`;
    if (!sorted.length) finalMsg += '😔 لم يحصل أحد على نقاط.\n';
    else {
        sorted.forEach(([jid, pts], i) => {
            finalMsg += `${medals[i]||`${i+1}.`} @${jid.split('@')[0]} — *${pts} نقطة*\n`;
        });
        finalMsg += `\n━━━━━━━━━━━━━━━━\n👑 بطل المسابقة: @${sorted[0][0].split('@')[0]} 🎉`;
    }
    await sock.sendMessage(groupId, { text: finalMsg, mentions });
    activeQuizzes.delete(groupId);
}

// ─── معالجة التصويت ──────────────────────────
function handlePollVote(sock, msg, from) {
    const qs = activeQuizzes.get(from);
    if (!qs) return;

    const pollUpdate = msg.message?.pollUpdateMessage;
    if (!pollUpdate) return;

    const pollId = pollUpdate.pollCreationMessageKey?.id;
    if (pollId !== qs.currentPollId) return;

    const rawVoter = msg.key.participant || msg.key.remoteJid;
    if (!rawVoter) return;

    // حوّل @lid → @s.whatsapp.net من الـ cache
    const voter = resolveJid(rawVoter, sock, from);

    const vote = pollUpdate.vote;
    if (!vote?.encPayload) return;

    const selectedHashes = decryptPollVote(
        vote.encPayload,
        vote.encIv,
        qs.messageSecret,
        qs.currentPollId,
        rawVoter  // نمرر الأصلي، والدالة تجرب كل الاحتمالات
    );

    if (!selectedHashes.length) return;

    const q = qs.questions[qs.currentIndex];
    let choiceIndex = -1;

    outer:
    for (let i = 0; i < q.choices.length; i++) {
        const choiceHash = sha256(q.choices[i]);
        for (const h of selectedHashes) {
            if (Buffer.isBuffer(h) && choiceHash.equals(h)) { choiceIndex = i; break outer; }
        }
    }

    if (choiceIndex === -1) return;

    // استخدم الـ voter المحوّل (@s.whatsapp.net) للتتبع
    const trackVoter = voter || rawVoter;
    if (!qs.answeredUsers.has(trackVoter)) {
        qs.answeredUsers.set(trackVoter, choiceIndex);
        if (choiceIndex === q.correctIndex && !qs.firstCorrectUser)
            qs.firstCorrectUser = trackVoter;
    }
}

// ─── الأوامر ─────────────────────────────────
module.exports = {
    commands: [
        '.بدء مسابقة',
        '.إيقاف المسابقة',
        '.حالة المسابقة',
        '.عرض الاسئلة',
        '.مسح الاسئلة',
        'مسابقة جديدة'
    ],

    execute: async (sock, msg, from, text) => {
        const sender  = msg.key.participant || msg.key.remoteJid;
        const isOwner = sender?.split('@')[0] === OWNER_NUMBER || msg.key.fromMe;
        const trimmed = text.trim();

        if (trimmed.startsWith('مسابقة جديدة')) {
            if (!isOwner) return sock.sendMessage(from, { text: '⛔ للمطور فقط.' }, { quoted: msg });
            const content = trimmed.replace(/^مسابقة جديدة\s*/i, '').trim();
            if (!content) return sock.sendMessage(from, {
                text: `📋 *الصيغة:*\nمسابقة جديدة\nس1: السؤال؟\n1. أ\n2. ب\nج: 1\nنقاط: 2`
            }, { quoted: msg });
            const { questions, errors } = parseAndValidate(content);
            if (errors.length) return sock.sendMessage(from, { text: `❌ أخطاء:\n${errors.join('\n')}` }, { quoted: msg });
            if (!questions.length) return sock.sendMessage(from, { text: '❌ لا أسئلة صالحة.' }, { quoted: msg });
            const combined = [...loadQuestions(), ...questions];
            saveQuestions(combined);
            return sock.sendMessage(from, { text: `✅ تم حفظ ${questions.length} سؤال. الإجمالي: ${combined.length}` }, { quoted: msg });
        }

        if (trimmed === '.بدء مسابقة اسئلة' || trimmed === '.بدء مسابقة') {
            if (!isOwner) return sock.sendMessage(from, { text: '⛔ للمطور فقط.' }, { quoted: msg });
            if (activeQuizzes.has(from)) return sock.sendMessage(from, { text: '⚠️ مسابقة نشطة بالفعل!' }, { quoted: msg });
            const questions = loadQuestions();
            if (!questions.length) return sock.sendMessage(from, { text: '📭 لا توجد أسئلة.' }, { quoted: msg });

            // جيب بيانات المجموعة لتحديث الـ lid cache
            try {
                const meta = await sock.groupMetadata(from);
                updateLidCache(meta);
                console.log(`[QUIZ] lid cache updated: ${lidToWa.size} entries`);
            } catch (_) {}

            const qs = { questions, currentIndex: 0, scores: new Map(), answeredUsers: new Map(),
                firstCorrectUser: null, currentPollId: null, messageSecret: null, timer: null };
            activeQuizzes.set(from, qs);
            await sock.sendMessage(from, { text: `🎯 *بدأت المسابقة!*\n📝 ${questions.length} سؤال\n⏱️ دقيقة لكل سؤال` });
            await new Promise(r => setTimeout(r, 2000));
            await sendQuestion(sock, from, qs);
            return;
        }

        if (trimmed === '.إيقاف المسابقة') {
            if (!isOwner) return sock.sendMessage(from, { text: '⛔ للمطور فقط.' }, { quoted: msg });
            const qs = activeQuizzes.get(from);
            if (!qs) return sock.sendMessage(from, { text: '❌ لا توجد مسابقة.' }, { quoted: msg });
            clearTimeout(qs.timer);
            activeQuizzes.delete(from);
            return sock.sendMessage(from, { text: '🛑 تم إيقاف المسابقة.' }, { quoted: msg });
        }

        if (trimmed === '.حالة المسابقة') {
            const qs = activeQuizzes.get(from);
            if (!qs) return sock.sendMessage(from, { text: '📭 لا توجد مسابقة.' }, { quoted: msg });
            return sock.sendMessage(from, {
                text: `📊 السؤال: ${qs.currentIndex+1}/${qs.questions.length}\nالمشاركون: ${qs.scores.size}`
            }, { quoted: msg });
        }

        if (trimmed === '.عرض الاسئلة') {
            if (!isOwner) return sock.sendMessage(from, { text: '⛔ للمطور فقط.' }, { quoted: msg });
            const questions = loadQuestions();
            if (!questions.length) return sock.sendMessage(from, { text: '📭 لا توجد أسئلة.' }, { quoted: msg });
            let preview = `📋 *الأسئلة (${questions.length}):*\n\n`;
            questions.forEach((q, i) => {
                preview += `*س${i+1}:* ${q.question}\n`;
                q.choices.forEach((c, ci) => preview += `  ${ci===q.correctIndex?'✅':'▫️'} ${ci+1}. ${c}\n`);
                preview += `  🎁 ${q.points} نقطة\n\n`;
            });
            return sock.sendMessage(from, { text: preview.trim() }, { quoted: msg });
        }

        if (trimmed === '.مسح الاسئلة') {
            if (!isOwner) return sock.sendMessage(from, { text: '⛔ للمطور فقط.' }, { quoted: msg });
            saveQuestions([]);
            return sock.sendMessage(from, { text: '🗑️ تم مسح الأسئلة.' }, { quoted: msg });
        }
    },

    onPollVote: handlePollVote,
    updateLidCache,  // export عشان index.js يقدر يستدعيها
    activeQuizzes
};
