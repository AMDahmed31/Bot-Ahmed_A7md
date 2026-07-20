// commands/marriage.js
// أمر .زواج - يختار عضوين عشوائيين من الجروب ويعمل "عقد قران" بينهم

module.exports = {
    commands: ['.زواج'],

    async execute(sock, msg, from, text) {
        try {
            // لازم يكون جروب
            if (!from.endsWith('@g.us')) {
                await sock.sendMessage(from, { text: '❌ الأمر ده خاص بالجروبات بس.' }, { quoted: msg });
                return;
            }

            const metadata = await sock.groupMetadata(from);
            const participants = metadata.participants
                .map(p => p.id)
                .filter(id => id !== sock.user?.id?.split(':')[0] + '@s.whatsapp.net'); // استبعاد البوت نفسه لو موجود

            if (participants.length < 2) {
                await sock.sendMessage(from, { text: '⚠️ لازم يكون في عضوين على الأقل في الجروب.' }, { quoted: msg });
                return;
            }

            // اختيار عشوائي لعضوين مختلفين
            const shuffled = [...participants].sort(() => Math.random() - 0.5);
            const [bride, groom] = shuffled;

            const brideTag = `@${bride.split('@')[0]}`;
            const groomTag = `@${groom.split('@')[0]}`;

            const messages = [
                `💍 مبروك الفرحة! 💍\n\nتم عقد القران بين:\n👰 ${brideTag}\n🤵 ${groomTag}\n\nألف مبروك ونتمنالكم حياة سعيدة 🎉`,
                `💒 خبر عاجل من الجروب 💒\n\n${brideTag} و ${groomTag} دخلوا القفص الذهبي 😍\n\nربنا يتمم بخير ويهنيكم 🎊`,
                `👑 زفة زفة زفة 👑\n\n${brideTag} 💞 ${groomTag}\n\nكل سنة وانتوا طيبين، عقبال المليون 🥳`
            ];

            const finalMessage = messages[Math.floor(Math.random() * messages.length)];

            await sock.sendMessage(from, {
                text: finalMessage,
                mentions: [bride, groom]
            }, { quoted: msg });

        } catch (e) {
            console.log('❌ خطأ في أمر .زواج:', e.message);
            await sock.sendMessage(from, { text: '❌ حصل خطأ أثناء تنفيذ الأمر.' }, { quoted: msg });
        }
    }
};

