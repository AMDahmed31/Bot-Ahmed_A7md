const { addLogoToImage } = require('./quran_images');

module.exports = {
    commands: ['.صورة', '.صورة الملف الشخصي '],

    async execute(sock, msg, from, text) {
        try {
            const quoted = msg.message?.extendedTextMessage?.contextInfo?.participant;
            const args = text.split(' ');
            let number = args[1] ? args[1].replace(/[^0-9]/g, '') : null;

            let target;
            if (quoted) {
                target = quoted;
            } else if (number) {
                target = number + '@s.whatsapp.net';
            } else {
                return await sock.sendMessage(from, {
                    text: "⚠️ أرسل 'صوره' مع الرقم أو بالرد على رسالة."
                }, { quoted: msg });
            }

            await sock.sendMessage(from, { react: { text: "⏳", key: msg.key } });

            const ppUrl = await sock.profilePictureUrl(target, 'image').catch(() => null);

            if (ppUrl) {
                // أضف اللوجو على الصورة
                const imageWithLogo = await addLogoToImage(ppUrl);

                await sock.sendMessage(from, {
                    image: imageWithLogo || { url: ppUrl },
                    caption: `✅ تم جلب صورة البروفايل`
                }, { quoted: msg });

                await sock.sendMessage(from, { react: { text: "✅", key: msg.key } });
            } else {
                await sock.sendMessage(from, {
                    text: "❌ لا توجد صورة بروفايل متاحة (بسبب الخصوصية أو الرقم خطأ)."
                }, { quoted: msg });
                await sock.sendMessage(from, { react: { text: "❌", key: msg.key } });
            }

        } catch (err) {
            console.error("Error in GetPic:", err);
            await sock.sendMessage(from, { react: { text: "❌", key: msg.key } });
        }
    }
};

