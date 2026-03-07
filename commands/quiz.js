// commands/quiz.js
const fs     = require('fs');
const path   = require('path');
const crypto = require('crypto');

const OWNER_NUMBER = '201009390573';
const DB_FILE      = path.join(__dirname, '../points_db.json');
const QUIZ_FILE    = path.join(__dirname, '../quiz_questions.json');
const activeQuizzes = new Map();

function getBotLid() {
    try {
        const creds = JSON.parse(fs.readFileSync(path.join(__dirname, '../auth_main/creds.json')));
        const lid = creds.me?.lid || '';
        return lid.replace(/:.*@/, '@');
    } catch(_) { return ''; }
}

function hmacSign(data, key) {
    return crypto.createHmac('sha256', key).update(data).digest();
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

function aesDecryptGCM(ciphertext, key, iv, aad) {
    const ct  = toBuf(ciphertext);
    const tag = ct.slice(-16);
    const enc = ct.slice(0, -16);
    const dec = crypto.createDecipheriv('aes-256-gcm', key, toBuf(iv));
    if (aad) dec.setAAD(aad);
    dec.setAuthTag(tag);
    return Buffer.concat([dec.update(enc), dec.final()]);
}

function decryptVote(encPayload, encIv, pollEncKey, pollCreatorJid, pollMsgId, voterJid) {
    try {
        const sign = Buffer.concat([
            Buffer.from(pollMsgId),
            Buffer.from(pollCreatorJid),
            Buffer.from(voterJid),
            Buffer.from('Poll Vote'),
            Buffer.from([1])
        ]);
        const key0   = hmacSign(toBuf(pollEncKey), Buffer.alloc(32));
        const decKey = hmacSign(sign, key0);
        const aad    = Buffer.from(`${pollMsgId}\u0000${voterJid}`);
        const plain  = aesDecryptGCM(encPayload, decKey, encIv, aad);
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
        return hashes;
    } catch(_) { return []; }
}

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

function loadQuestions() {
    try { if (fs.existsSync(QUIZ_FILE)) return JSON.parse(fs.readFileSync(QUIZ_FILE)); } catch {}
    return [];
}
function saveQuestions(q) { fs.writeFileSync(QUIZ_FILE, JSON.stringify(q, null, 2)); }

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

async function sendQuestion(sock, groupId, qs) {
    const q     = qs.questions[qs.currentIndex];
    const qNum  = qs.currentIndex + 1;
    const total = qs.questions.length;
    const messageSecret = crypto.randomBytes(32);

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
    qs.timer = setTimeout(() => revealAnswer(sock, groupId), 60_000);
}

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

async function endQuiz(sock, groupId) {
    const qs = activeQuizzes.get(groupId);
    if (!qs) return;
    clearTimeout(qs.timer);
    const sorted = [...qs.scores.entries()].sort((a, b) => b[1] - a[1]);
    const medals = ['🥇','🥈','🥉'];
    const mentions = sorted.map(([jid]) => jid);

    let finalMsg = `🏁 *انتهت المسابقة!*\n━━━━━━━━━━━━━━━━\n📊 *النتائج النهائية:*\n\n`;
    if (!sorted.length) {
        finalMsg += '😔 لم يحصل أحد على نقاط.\n';
    } else {
        sorted.forEach(([jid, pts], i) => {
            finalMsg += `${medals[i]||`${i+1}.`} @${jid.split('@')[0]} — *${pts} نقطة*\n`;
        });
        finalMsg += `\n━━━━━━━━━━━━━━━━\n🏆 *الفائز في المسابقة* 🏆\n"@${sorted[0][0].split('@')[0]}" 🎉`;
    }
    await sock.sendMessage(groupId, { text: finalMsg, mentions });
    activeQuizzes.delete(groupId);
}

function handlePollVote(sock, msg, from) {
    const qs = activeQuizzes.get(from);
    if (!qs) return;

    const pollUpdate = msg.message?.pollUpdateMessage;
    if (!pollUpdate) return;

    const pollId = pollUpdate.pollCreationMessageKey?.id;
    if (pollId !== qs.currentPollId) return;

    const rawVoter = msg.key.participant || msg.key.remoteJid;
    if (!rawVoter) return;

    const vote = pollUpdate.vote;
    if (!vote?.encPayload) return;

    const botLid = getBotLid();
    const botPn  = botLid.replace('@lid', '@s.whatsapp.net');

    const voterVariants = [
        rawVoter,
        rawVoter.replace('@lid', '@s.whatsapp.net'),
        rawVoter.replace('@s.whatsapp.net', '@lid'),
    ].filter((v, i, a) => v && a.indexOf(v) === i);

    const creatorVariants = [botLid, botPn].filter((v, i, a) => v && a.indexOf(v) === i);

    const q = qs.questions[qs.currentIndex];
    let choiceIndex = -1;
    let ok = false;

    outer:
    for (const creator of creatorVariants) {
        for (const voter of voterVariants) {
            const hashes = decryptVote(
                vote.encPayload, vote.encIv,
                qs.messageSecret, creator,
                qs.currentPollId, voter
            );
            if (!hashes.length) continue;
            ok = true;
            for (let i = 0; i < q.choices.length; i++) {
                const h = crypto.createHash('sha256').update(q.choices[i]).digest();
                for (const sh of hashes) {
                    if (h.equals(sh)) { choiceIndex = i; break outer; }
                }
            }
            break outer;
        }
    }

    if (!ok) return;
    if (choiceIndex === -1) return;

    if (!qs.answeredUsers.has(rawVoter)) {
        qs.answeredUsers.set(rawVoter, choiceIndex);
        if (choiceIndex === q.correctIndex && !qs.firstCorrectUser)
            qs.firstCorrectUser = rawVoter;
    }
}

module.exports = {
    commands: [
        '.بدء مسابقة',
        '.إيقاف المسابقة',
        '.حالة المسابقة',
        '.عرض الاسئلة',
        '.مسح الاسئلة',
        '.مساعدة_مسابقة',
        'مسابقة جديدة'
    ],

    execute: async (sock, msg, from, text) => {
        const sender  = msg.key.participant || msg.key.remoteJid;
        const isOwner = sender?.split('@')[0] === OWNER_NUMBER || msg.key.fromMe;
        const trimmed = text.trim();

        // ─── كتالوج الأوامر ───
        if (trimmed === '.مساعدة_مسابقة') {
            const helpText = `
《 دليل أوامر المسابقة 》
____________________

1️⃣ *إضافة أسئلة:*
مسابقة جديدة
س1: السؤال؟
1. الاختيار الأول
2. الاختيار الثاني
3. الاختيار الثالث
ج: 2
نقاط: 3
شرح: تفسير الإجابة (اختياري)

2️⃣ *بدء المسابقة:*
_.بدء مسابقة_

3️⃣ *إيقاف المسابقة:*
_.إيقاف المسابقة_

4️⃣ *حالة المسابقة:*
_.حالة المسابقة_

5️⃣ *عرض الأسئلة المحفوظة:*
_.عرض الاسئلة_

6️⃣ *مسح جميع الأسئلة:*
_.مسح الاسئلة_

🔐 *ملاحظات:*
• الأسئلة تُحفظ حتى تُمسح يدوياً
• كل سؤال مدته دقيقة واحدة
• النقاط تُضاف تلقائياً لقاعدة البيانات
• الأوامر للمطور فقط
`.trim();
            return await sock.sendMessage(from, { text: helpText }, { quoted: msg });
        }

        // ─── إضافة أسئلة ───
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

        // ─── بدء المسابقة ───
        if (trimmed === '.بدء مسابقة اسئلة' || trimmed === '.بدء مسابقة') {
            if (!isOwner) return sock.sendMessage(from, { text: '⛔ للمطور فقط.' }, { quoted: msg });
            if (activeQuizzes.has(from)) return sock.sendMessage(from, { text: '⚠️ مسابقة نشطة!' }, { quoted: msg });
            const questions = loadQuestions();
            if (!questions.length) return sock.sendMessage(from, { text: '📭 لا توجد أسئلة.\nاكتب .مساعدة_مسابقة لمعرفة كيفية الإضافة.' }, { quoted: msg });
            const qs = {
                questions, currentIndex: 0, scores: new Map(),
                answeredUsers: new Map(), firstCorrectUser: null,
                currentPollId: null, messageSecret: null, timer: null
            };
            activeQuizzes.set(from, qs);
            await sock.sendMessage(from, { text: `🎯 *بدأت المسابقة!*\n📝 ${questions.length} سؤال\n⏱️ دقيقة لكل سؤال\n\nللمساعدة: .مساعدة_مسابقة` });
            await new Promise(r => setTimeout(r, 2000));
            await sendQuestion(sock, from, qs);
            return;
        }

        // ─── إيقاف المسابقة ───
        if (trimmed === '.إيقاف المسابقة') {
            if (!isOwner) return sock.sendMessage(from, { text: '⛔ للمطور فقط.' }, { quoted: msg });
            const qs = activeQuizzes.get(from);
            if (!qs) return sock.sendMessage(from, { text: '❌ لا توجد مسابقة نشطة.' }, { quoted: msg });
            clearTimeout(qs.timer);
            activeQuizzes.delete(from);
            return sock.sendMessage(from, { text: '🛑 تم إيقاف المسابقة.' }, { quoted: msg });
        }

        // ─── حالة المسابقة ───
        if (trimmed === '.حالة المسابقة') {
            const qs = activeQuizzes.get(from);
            if (!qs) return sock.sendMessage(from, { text: '📭 لا توجد مسابقة نشطة.' }, { quoted: msg });
            const sorted = [...qs.scores.entries()].sort((a, b) => b[1] - a[1]);
            const mentions = sorted.map(([jid]) => jid);
            let statusMsg = `📊 *حالة المسابقة*\n━━━━━━━━━━━━━━━━\nالسؤال: ${qs.currentIndex+1}/${qs.questions.length}\nالمشاركون: ${qs.scores.size}\n\n`;
            if (sorted.length) {
                statusMsg += `*الترتيب الحالي:*\n`;
                const medals = ['🥇','🥈','🥉'];
                sorted.forEach(([jid, pts], i) => {
                    statusMsg += `${medals[i]||`${i+1}.`} @${jid.split('@')[0]} — *${pts} نقطة*\n`;
                });
            }
            return sock.sendMessage(from, { text: statusMsg.trim(), mentions }, { quoted: msg });
        }

        // ─── عرض الأسئلة ───
        if (trimmed === '.عرض الاسئلة') {
            if (!isOwner) return sock.sendMessage(from, { text: '⛔ للمطور فقط.' }, { quoted: msg });
            const questions = loadQuestions();
            if (!questions.length) return sock.sendMessage(from, { text: '📭 لا توجد أسئلة محفوظة.' }, { quoted: msg });
            let preview = `📋 *الأسئلة المحفوظة (${questions.length}):*\n━━━━━━━━━━━━━━━━\n\n`;
            questions.forEach((q, i) => {
                preview += `*س${i+1}:* ${q.question}\n`;
                q.choices.forEach((c, ci) => preview += `  ${ci===q.correctIndex?'✅':'▫️'} ${ci+1}. ${c}\n`);
                preview += `  🎁 ${q.points} نقطة\n\n`;
            });
            return sock.sendMessage(from, { text: preview.trim() }, { quoted: msg });
        }

        // ─── مسح الأسئلة ───
        if (trimmed === '.مسح الاسئلة') {
            if (!isOwner) return sock.sendMessage(from, { text: '⛔ للمطور فقط.' }, { quoted: msg });
            saveQuestions([]);
            return sock.sendMessage(from, { text: '🗑️ تم مسح جميع الأسئلة.' }, { quoted: msg });
        }
    },

    onPollVote: handlePollVote,
    onPollUpdate: () => {},
    activeQuizzes
};

