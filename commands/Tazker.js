module.exports = {
    commands: ['.تذكير'],
    async execute(sock, msg, from, text) {
        try {
            const parts = text.trim().split(' ');

            if (parts.length < 3) {
                await sock.sendMessage(from, { text: '❌ اكتب الوقت والرسالة.\nمثال: .تذكير 10 صلي الظهر' }, { quoted: msg });
                return;
            }

            const minutes = parseInt(parts[1]);
            if (isNaN(minutes) || minutes < 1 || minutes > 1440) {
                await sock.sendMessage(from, { text: '❌ اكتب عدد دقايق صحيح (1 - 1440).' }, { quoted: msg });
                return;
            }

            const reminderText = parts.slice(2).join(' ');

            await sock.sendMessage(from, { react: { text: '⏰', key: msg.key } });
            await sock.sendMessage(from, { text: `✅ *تم ضبط التذكير*\n⏰ بعد *${minutes}* دقيقة\n📝 *${reminderText}*` }, { quoted: msg });

            setTimeout(async () => {
                try {
                    await sock.sendMessage(from, {
                        text: `🔔 *تذكير!*\n───────────────────\n\n📝 ${reminderText}\n\n⏰ الوقت المحدد: ${minutes} دقيقة`
                    }, { quoted: msg });
                } catch (e) {
                    console.error('reminder send error:', e.message);
                }
            }, minutes * 60 * 1000);

        } catch (e) {
            console.error('reminder error:', e.message);
            await sock.sendMessage(from, { text: '❌ حدث خطأ، حاول مرة أخرى.' }, { quoted: msg });
        }
    }
};