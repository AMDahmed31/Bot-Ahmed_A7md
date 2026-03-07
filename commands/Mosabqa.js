const https = require('https');

function fetchJSON(url) {
    return new Promise((resolve, reject) => {
        https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => { try { resolve(JSON.parse(data)); } catch (e) { reject(e); } });
        }).on('error', reject);
    });
}

function decodeHTML(text) {
    return text
        .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&ldquo;/g, '"')
        .replace(/&rdquo;/g, '"').replace(/&lsquo;/g, "'").replace(/&rsquo;/g, "'");
}

const islamicQuestions = [
    { q: 'كم عدد أركان الإسلام؟', options: ['3', '4', '5', '6'], answer: '5' },
    { q: 'من هو أول الأنبياء؟', options: ['إبراهيم', 'آدم', 'نوح', 'موسى'], answer: 'آدم' },
    { q: 'كم عدد سور القرآن الكريم؟', options: ['110', '114', '120', '100'], answer: '114' },
    { q: 'ما هي أطول سورة في القرآن؟', options: ['آل عمران', 'النساء', 'البقرة', 'المائدة'], answer: 'البقرة' },
    { q: 'كم عدد أركان الإيمان؟', options: ['5', '6', '7', '4'], answer: '6' },
    { q: 'في أي شهر نزل القرآن الكريم؟', options: ['رجب', 'شعبان', 'رمضان', 'محرم'], answer: 'رمضان' },
    { q: 'ما هي أقصر سورة في القرآن؟', options: ['الفلق', 'الناس', 'الكوثر', 'الإخلاص'], answer: 'الكوثر' },
    { q: 'كم مرة ذكر اسم النبي محمد في القرآن؟', options: ['2', '3', '4', '5'], answer: '4' },
    { q: 'ما هو اسم والد النبي إبراهيم؟', options: ['آزر', 'تارح', 'ناحور', 'سام'], answer: 'آزر' },
    { q: 'كم عدد الصلوات المفروضة في اليوم؟', options: ['3', '4', '5', '6'], answer: '5' },
];

const activeSessions = new Map();

module.exports = {
    commands: ['.مسابقة'],
    async execute(sock, msg, from, text) {
        try {
            const input = text.trim();
            const session = activeSessions.get(from);

            // لو بيجاوب
            if (session && input !== '.مسابقة') {
                const answer = input.trim();
                const correct = session.answer;

                if (answer === correct || answer === session.answerIndex) {
                    activeSessions.delete(from);
                    await sock.sendMessage(from, { react: { text: '🎉', key: msg.key } });
                    await sock.sendMessage(from, { text: `🎉 *إجابة صحيحة!*\n✅ الإجابة: *${correct}*` }, { quoted: msg });
                } else {
                    await sock.sendMessage(from, { react: { text: '❌', key: msg.key } });
                    await sock.sendMessage(from, { text: `❌ *إجابة خاطئة!*\nحاول تاني 🤔\n💡 اكتب رقم الإجابة (1-4)` }, { quoted: msg });
                }
                return;
            }

            await sock.sendMessage(from, { react: { text: '🏆', key: msg.key } });

            let question = '';
            let options = [];
            let answer = '';

            try {
                const data = await fetchJSON('https://opentdb.com/api.php?amount=1&type=multiple');
                if (data.results && data.results.length > 0) {
                    const q = data.results[0];
                    const allOptions = [...q.incorrect_answers, q.correct_answer]
                        .sort(() => Math.random() - 0.5)
                        .map(decodeHTML);
                    question = decodeHTML(q.question);
                    options = allOptions;
                    answer = decodeHTML(q.correct_answer);

                    // ترجمة للعربي
                    const translateUrl = (t) => `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=ar&dt=t&q=${encodeURIComponent(t)}`;
                    const [tq, ...tops] = await Promise.all([
                        fetchJSON(translateUrl(question)),
                        ...options.map(o => fetchJSON(translateUrl(o)))
                    ]);
                    const tAnswer = await fetchJSON(translateUrl(answer));

                    question = tq[0].map(i => i[0]).filter(Boolean).join('');
                    options = tops.map(t => t[0].map(i => i[0]).filter(Boolean).join(''));
                    answer = tAnswer[0].map(i => i[0]).filter(Boolean).join('');
                }
            } catch (e) {}

            if (!question) {
                const local = islamicQuestions[Math.floor(Math.random() * islamicQuestions.length)];
                question = local.q;
                options = local.options;
                answer = local.answer;
            }

            const answerIndex = (options.indexOf(answer) + 1).toString();
            activeSessions.set(from, { answer, answerIndex });

            setTimeout(() => {
                if (activeSessions.has(from)) {
                    activeSessions.delete(from);
                    sock.sendMessage(from, { text: `⏰ انتهى الوقت!\n✅ الإجابة كانت: *${answer}*` });
                }
            }, 5 * 60 * 1000);

            const nums = ['1️⃣', '2️⃣', '3️⃣', '4️⃣'];
            let message = `🏆 *مسابقة*\n───────────────────\n\n❓ ${question}\n\n`;
            options.forEach((o, i) => { message += `${nums[i]} ${o}\n`; });
            message += `\n───────────────────\n💡 اكتب رقم إجابتك`;

            await sock.sendMessage(from, { text: message }, { quoted: msg });

        } catch (e) {
            console.error('quiz error:', e.message);
            await sock.sendMessage(from, { text: '❌ حدث خطأ، حاول مرة أخرى.' }, { quoted: msg });
        }
    }
};