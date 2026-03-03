// commands/quiz.js
// =============================================
// 🎯 نظام المسابقات
// =============================================
// إنشاء أسئلة:
//   مسابقة جديدة
//   س1: السؤال؟
//   1. اختيار
//   2. اختيار
//   3. اختيار
//   4. اختيار
//   ج: 2
//   نقاط: 2
//
// تشغيل:   .بدء مسابقة اسئلة
// إيقاف:   .إيقاف المسابقة
// حالة:    .حالة المسابقة
// عرض:     .عرض الاسئلة
// مسح:     .مسح الاسئلة
// =============================================

const fs   = require('fs');
const path = require('path');

const OWNER_NUMBER = '201009390573'; // ← غيّر لرقمك

const DB_FILE   = path.join(__dirname, '../points_db.json');
const QUIZ_FILE = path.join(__dirname, '../quiz_questions.json');

const activeQuizzes = new Map();

// ─── قاعدة النقاط ───────────────────────────
function loadDB() {
    try { if (fs.existsSync(DB_FILE)) return JSON.parse(fs.readFileSync(DB_FILE)); } catch {}
    return {};
}
function saveDB(db) { fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2)); }
function addPoints(groupId, userJid, points) {
    const db = loadDB();
    if (!db[groupId])                db[groupId]               = { name: '', users: {} };
    if (!db[groupId].users[userJid]) db[groupId].users[userJid] = 0;
    db[groupId].users[userJid] += points;
    saveDB(db);
}

// ─── ملف الأسئلة ────────────────────────────
function loadQuestions() {
    try { if (fs.existsSync(QUIZ_FILE)) return JSON.parse(fs.readFileSync(QUIZ_FILE)); } catch {}
    return [];
}
function saveQuestions(q) { fs.writeFileSync(QUIZ_FILE, JSON.stringify(q, null, 2)); }

// ─── تحليل الأسئلة والتحقق ──────────────────
function parseAndValidate(text) {
    const results = [], errors = [];
    const blocks = text.split(/\n(?=س\d+\s*:)/g);

    for (let bi = 0; bi < blocks.length; bi++) {
        const lines = blocks[bi].trim().split('\n').map(l => l.trim()).filter(Boolean);
        if (!lines.length) continue;

        const qMatch = lines[0].match(/^س(\d+)\s*:\s*(.+)$/);
        if (!qMatch) {
            errors.push(`⚠️ كتلة ${bi + 1}: السطر الأول لا يبدأ بـ "سX:" بشكل صحيح\n   ← "${lines[0]}"`);
            continue;
        }
        const qNum = parseInt(qMatch[1]);
        const qText = qMatch[2].trim();

        const choices = [];
        let correctIndex = -1, points = 2, explanation = '';
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
            blockErrors.push(`سطر غير معروف: "${line}"`);
        }

        if (choices.length < 2)  blockErrors.push(`عدد الاختيارات ${choices.length} — يجب 2 على الأقل`);
        if (choices.length > 4)  blockErrors.push(`عدد الاختيارات ${choices.length} — الحد الأقصى 4`);
        if (correctIndex === -1) blockErrors.push(`لم يُحدَّد الجواب الصحيح (ج: رقم)`);
        else if (correctIndex < 0 || correctIndex >= choices.length)
            blockErrors.push(`رقم الجواب ${correctIndex + 1} خارج النطاق (1-${choices.length})`);
        if (points < 1 || points > 100) blockErrors.push(`النقاط ${points} خارج النطاق (1-100)`);

        if (blockErrors.length) {
            errors.push(`⚠️ س${qNum} "${qText}":\n${blockErrors.map(e => `   • ${e}`).join('\n')}`);
            continue;
        }
        results.push({ question: qText, choices, correctIndex, points, explanation });
    }
    return { questions: results, errors };
}

// ─── إرسال سؤال Poll ────────────────────────
async function sendQuestion(sock, groupId, quizState) {
    const q     = quizState.questions[quizState.currentIndex];
    const qNum  = quizState.currentIndex + 1;
    const total = quizState.questions.length;

    const pollMsg = await sock.sendMessage(groupId, {
        poll: {
            name: `❓ سؤال ${qNum}/${total}\n${q.question}`,
            values: q.choices,
            selectableCount: 1
        }
    });

    quizState.currentPollId    = pollMsg.key.id;
    quizState.answeredUsers    = new Map();
    quizState.firstCorrectUser = null;
    quizState.timer = setTimeout(() => revealAnswer(sock, groupId), 60_000);
}

// ─── إعلان الإجابة ──────────────────────────
async function revealAnswer(sock, groupId) {
    const qs = activeQuizzes.get(groupId);
    if (!qs) return;
    clearTimeout(qs.timer);

    const q           = qs.questions[qs.currentIndex];
    const correctText = q.choices[q.correctIndex];
    const correctNum  = q.correctIndex + 1;

    let replyMsg = `✅ *الإجابة الصحيحة:* ${correctNum}. ${correctText}\n`;
    if (q.explanation) replyMsg += `💡 ${q.explanation}\n`;

    const winner = qs.firstCorrectUser;
    const mentions = [];

    if (winner) {
        addPoints(groupId, winner, q.points);
        if (!qs.scores.has(winner)) qs.scores.set(winner, 0);
        qs.scores.set(winner, qs.scores.get(winner) + q.points);
        mentions.push(winner);
        replyMsg += `\n🏆 الفائز: @${winner.split('@')[0]}\n🎁 *+${q.points} نقطة*`;
    } else {
        replyMsg += '\n😔 لم يُجب أحد بشكل صحيح في الوقت المحدد.';
    }

    await sock.sendMessage(groupId, { text: replyMsg, mentions });

    qs.currentIndex++;
    await new Promise(r => setTimeout(r, 3000));

    if (qs.currentIndex < qs.questions.length) {
        await sendQuestion(sock, groupId, qs);
    } else {
        await endQuiz(sock, groupId);
    }
}

// ─── إنهاء المسابقة ─────────────────────────
async function endQuiz(sock, groupId) {
    const qs = activeQuizzes.get(groupId);
    if (!qs) return;
    clearTimeout(qs.timer);

    const sorted   = [...qs.scores.entries()].sort((a, b) => b[1] - a[1]);
    const medals   = ['🥇', '🥈', '🥉'];
    const mentions = sorted.map(([jid]) => jid);

    let finalMsg = `🏁 *انتهت المسابقة!*\n━━━━━━━━━━━━━━━━\n📊 *النتائج النهائية:*\n\n`;

    if (!sorted.length) {
        finalMsg += '😔 لم يحصل أحد على نقاط.\n';
    } else {
        sorted.forEach(([jid, pts], i) => {
            finalMsg += `${medals[i] || `${i + 1}.`} @${jid.split('@')[0]} — *${pts} نقطة*\n`;
        });
        finalMsg += `\n━━━━━━━━━━━━━━━━\n👑 بطل المسابقة: @${sorted[0][0].split('@')[0]} 🎉`;
    }

    await sock.sendMessage(groupId, { text: finalMsg, mentions });
    activeQuizzes.delete(groupId);
}

// ─── معالجة تصويت الاستطلاع ─────────────────
function handlePollVote(sock, msg, from) {
    const qs = activeQuizzes.get(from);
    if (!qs) return;

    const pollUpdate = msg.message?.pollUpdateMessage;
    if (!pollUpdate) return;

    const pollId = pollUpdate.pollCreationMessageKey?.id;
    if (pollId !== qs.currentPollId) return;

    const voter = msg.key.participant || msg.key.remoteJid;
    if (!voter) return;

    const vote = pollUpdate.vote;
    if (!vote || !vote.selectedOptions?.length) return;

    const selectedName = vote.selectedOptions[0];
    const q = qs.questions[qs.currentIndex];

    let choiceIndex = -1;
    if (typeof selectedName === 'string') {
        choiceIndex = q.choices.findIndex(c => c === selectedName);
    } else if (Buffer.isBuffer(selectedName)) {
        choiceIndex = parseInt(Buffer.from(selectedName).toString('hex'), 16) % q.choices.length;
    }

    if (choiceIndex === -1) return;

    if (!qs.answeredUsers.has(voter)) {
        qs.answeredUsers.set(voter, choiceIndex);
        if (choiceIndex === q.correctIndex && !qs.firstCorrectUser) {
            qs.firstCorrectUser = voter;
        }
    }
}

// ─── الأوامر الرئيسية ────────────────────────
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

        // ════ إنشاء أسئلة جديدة ════
        if (trimmed.startsWith('مسابقة جديدة')) {
            if (!isOwner)
                return await sock.sendMessage(from, { text: '⛔ إنشاء الأسئلة للمطور فقط.' }, { quoted: msg });

            const content = trimmed.replace(/^مسابقة جديدة\s*/i, '').trim();
            if (!content) {
                return await sock.sendMessage(from, {
                    text: `📋 *طريقة إضافة الأسئلة:*\n\nمسابقة جديدة\nس1: نص السؤال؟\n1. اختيار أول\n2. اختيار ثاني\n3. اختيار ثالث\n4. اختيار رابع\nج: 2\nنقاط: 2\n\nس2: سؤال آخر؟\n1. ...\nج: 1\nنقاط: 1\n\n_ثم ابعت *.بدء مسابقة اسئلة* للتشغيل_`
                }, { quoted: msg });
            }

            const { questions, errors } = parseAndValidate(content);

            if (errors.length) {
                let errMsg = `❌ *وُجدت ${errors.length} مشكلة في الأسئلة:*\n\n`;
                errMsg += errors.join('\n\n');
                errMsg += '\n\n_صحح الأخطاء وأعد الإرسال._';
                return await sock.sendMessage(from, { text: errMsg }, { quoted: msg });
            }

            if (!questions.length)
                return await sock.sendMessage(from, { text: '❌ لم يُعثر على أسئلة صالحة! تأكد من الصيغة.' }, { quoted: msg });

            const existing = loadQuestions();
            const combined = [...existing, ...questions];
            saveQuestions(combined);

            return await sock.sendMessage(from, {
                text: `✅ *تم حفظ ${questions.length} سؤال بنجاح!*\n📦 إجمالي الأسئلة المحفوظة: *${combined.length}*\n\n_ابعت *.بدء مسابقة اسئلة* لتشغيل المسابقة_`
            }, { quoted: msg });
        }

        // ════ تشغيل المسابقة ════
        if (trimmed === '.بدء مسابقة اسئلة' || trimmed === '.بدء مسابقة') {
            if (!isOwner)
                return await sock.sendMessage(from, { text: '⛔ هذا الأمر للمطور فقط.' }, { quoted: msg });

            if (activeQuizzes.has(from))
                return await sock.sendMessage(from, {
                    text: '⚠️ هناك مسابقة نشطة بالفعل!\nاكتب *.إيقاف المسابقة* لإلغائها أولاً.'
                }, { quoted: msg });

            const questions = loadQuestions();
            if (!questions.length)
                return await sock.sendMessage(from, {
                    text: '📭 لا توجد أسئلة محفوظة!\nأضف أسئلة أولاً:\n\nمسابقة جديدة\nس1: ...'
                }, { quoted: msg });

            const quizState = {
                questions,
                currentIndex: 0,
                scores: new Map(),
                answeredUsers: new Map(),
                firstCorrectUser: null,
                currentPollId: null,
                timer: null
            };
            activeQuizzes.set(from, quizState);

            await sock.sendMessage(from, {
                text: `🎯 *بدأت المسابقة!*\n📝 عدد الأسئلة: *${questions.length}*\n⏱️ لديك *دقيقة* للإجابة على كل سؤال\n\nبالتوفيق للجميع ✨`
            });
            await new Promise(r => setTimeout(r, 2000));
            await sendQuestion(sock, from, quizState);
            return;
        }

        // ════ إيقاف المسابقة ════
        if (trimmed === '.إيقاف المسابقة') {
            if (!isOwner)
                return await sock.sendMessage(from, { text: '⛔ هذا الأمر للمطور فقط.' }, { quoted: msg });
            const quiz = activeQuizzes.get(from);
            if (!quiz)
                return await sock.sendMessage(from, { text: '❌ لا توجد مسابقة نشطة.' }, { quoted: msg });
            clearTimeout(quiz.timer);
            activeQuizzes.delete(from);
            return await sock.sendMessage(from, { text: '🛑 تم إيقاف المسابقة.' }, { quoted: msg });
        }

        // ════ حالة المسابقة ════
        if (trimmed === '.حالة المسابقة') {
            const quiz = activeQuizzes.get(from);
            if (!quiz)
                return await sock.sendMessage(from, { text: '📭 لا توجد مسابقة نشطة.' }, { quoted: msg });
            return await sock.sendMessage(from, {
                text: `📊 *حالة المسابقة:*\nالسؤال: ${quiz.currentIndex + 1}/${quiz.questions.length}\nالمشاركون: ${quiz.scores.size}`
            }, { quoted: msg });
        }

        // ════ عرض الأسئلة ════
        if (trimmed === '.عرض الاسئلة') {
            if (!isOwner)
                return await sock.sendMessage(from, { text: '⛔ هذا الأمر للمطور فقط.' }, { quoted: msg });
            const questions = loadQuestions();
            if (!questions.length)
                return await sock.sendMessage(from, { text: '📭 لا توجد أسئلة محفوظة.' }, { quoted: msg });
            let preview = `📋 *الأسئلة المحفوظة (${questions.length}):*\n\n`;
            questions.forEach((q, i) => {
                preview += `*س${i + 1}:* ${q.question}\n`;
                q.choices.forEach((c, ci) => {
                    preview += `  ${ci === q.correctIndex ? '✅' : '▫️'} ${ci + 1}. ${c}\n`;
                });
                preview += `  🎁 نقاط: ${q.points}\n\n`;
            });
            return await sock.sendMessage(from, { text: preview.trim() }, { quoted: msg });
        }

        // ════ مسح الأسئلة ════
        if (trimmed === '.مسح الاسئلة') {
            if (!isOwner)
                return await sock.sendMessage(from, { text: '⛔ هذا الأمر للمطور فقط.' }, { quoted: msg });
            saveQuestions([]);
            return await sock.sendMessage(from, { text: '🗑️ تم مسح جميع الأسئلة المحفوظة.' }, { quoted: msg });
        }
    },

    onPollVote: handlePollVote,
    activeQuizzes
};