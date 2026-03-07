const riddles = [
    { q: 'ما هو الشيء الذي كلما أخذت منه كبر؟', a: 'الحفرة' },
    { q: 'ما هو الشيء الذي له أسنان ولا يعض؟', a: 'المشط' },
    { q: 'ما هو الشيء الذي يمشي على أربع في الصباح وعلى اثنتين في الظهر وعلى ثلاث في المساء؟', a: 'الإنسان' },
    { q: 'ما هو الشيء الذي يملأ الغرفة ولا يأخذ حيزاً؟', a: 'الضوء' },
    { q: 'ما هو الشيء الذي يسقط ولا ينكسر ويكسر ولا يسقط؟', a: 'الليل يسقط والنهار يكسر' },
    { q: 'ما هو الشيء الذي له قلب ولكن لا يحب؟', a: 'الشجرة' },
    { q: 'ما هو الشيء الذي يذهب ويجيء ولا يتحرك؟', a: 'الطريق' },
    { q: 'أنا أتكلم بلا فم وأسمع بلا أذن، من أنا؟', a: 'الصدى' },
    { q: 'ما هو الشيء الذي كلما غسلته اتسخ؟', a: 'الماء' },
    { q: 'ما هو الشيء الذي يطير بلا أجنحة ويبكي بلا عيون؟', a: 'السحابة' },
    { q: 'ما الشيء الذي يمكنك إمساكه بيدك اليسرى ولا يمكنك إمساكه بيدك اليمنى؟', a: 'يدك اليمنى' },
    { q: 'ما هو الشيء الذي له رأس وذيل ولكن ليس له جسم؟', a: 'العملة المعدنية' },
    { q: 'كلما أكلت منه ازداد، ما هو؟', a: 'النار' },
    { q: 'ما هو الشيء الذي يجري ولا تكل قدماه؟', a: 'النهر' },
    { q: 'لها عيون ولا ترى، ما هي؟', a: 'الإبرة' },
];

const activeSessions = new Map();

module.exports = {
    commands: ['.لغز'],
    async execute(sock, msg, from, text) {
        try {
            const input = text.trim();

            // لو بيجاوب على لغز
            const session = activeSessions.get(from);
            if (session && input !== '.لغز') {
                const answer = input.trim();
                if (answer.includes(session.answer) || session.answer.includes(answer)) {
                    activeSessions.delete(from);
                    await sock.sendMessage(from, { react: { text: '🎉', key: msg.key } });
                    await sock.sendMessage(from, { text: `🎉 *إجابة صحيحة!*\n✅ الإجابة: *${session.answer}*` }, { quoted: msg });
                } else {
                    await sock.sendMessage(from, { react: { text: '❌', key: msg.key } });
                    await sock.sendMessage(from, { text: `❌ *إجابة خاطئة!*\nحاول تاني 🤔` }, { quoted: msg });
                }
                return;
            }

            // لغز جديد
            const riddle = riddles[Math.floor(Math.random() * riddles.length)];
            activeSessions.set(from, { answer: riddle.a });

            // تنتهي الجلسة بعد 5 دقايق
            setTimeout(() => {
                if (activeSessions.has(from)) {
                    activeSessions.delete(from);
                    sock.sendMessage(from, { text: `⏰ انتهى الوقت!\n✅ الإجابة كانت: *${riddle.a}*` });
                }
            }, 5 * 60 * 1000);

            await sock.sendMessage(from, { react: { text: '🤔', key: msg.key } });
            await sock.sendMessage(from, { text: `🤔 *لغز*\n───────────────────\n\n${riddle.q}\n\n───────────────────\n💡 اكتب إجابتك` }, { quoted: msg });

        } catch (e) {
            console.error('riddle error:', e.message);
            await sock.sendMessage(from, { text: '❌ حدث خطأ، حاول مرة أخرى.' }, { quoted: msg });
        }
    }
};