const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
const { addLogoToImage, addLogoToVideo } = require('./quran_images');

module.exports = {
    commands: ['.فك'],
    async execute(sock, msg, from, text) {
        try {
            const quotedMsg = msg.message.extendedTextMessage?.contextInfo?.quotedMessage;
            let viewOnce = quotedMsg?.viewOnceMessageV2 || quotedMsg?.viewOnceMessage || quotedMsg;

            let type = '';
            let mediaData = null;

            if (viewOnce?.message?.imageMessage || viewOnce?.imageMessage) {
                type = 'image';
                mediaData = viewOnce?.message?.imageMessage || viewOnce?.imageMessage;
            } else if (viewOnce?.message?.videoMessage || viewOnce?.videoMessage) {
                type = 'video';
                mediaData = viewOnce?.message?.videoMessage || viewOnce?.videoMessage;
            }

            if (!mediaData) {
                return await sock.sendMessage(from, {
                    text: '❌ لم أستطع العثور على صورة أو فيديو "مشاهدة لمرة واحدة" في هذا الرد.\n\nتأكد أنك ترد مباشرة على الرسالة المطلوبة.'
                }, { quoted: msg });
            }

            await sock.sendMessage(from, { react: { text: '⏳', key: msg.key } });

            const stream = await downloadContentFromMessage(mediaData, type);
            let buffer = Buffer.from([]);
            for await (const chunk of stream) {
                buffer = Buffer.concat([buffer, chunk]);
            }

            const caption = `تم`;

            if (type === 'image') {
                // أضف اللوجو على الصورة فقط
                const imageWithLogo = await addLogoToImage(buffer);
                await sock.sendMessage(from, { image: imageWithLogo || buffer, caption }, { quoted: msg });
            } else {
                // أضف اللوجو على الفيديو
                await sock.sendMessage(from, { react: { text: '🎬', key: msg.key } });
                const videoWithLogo = await addLogoToVideo(buffer);
                await sock.sendMessage(from, { video: videoWithLogo || buffer, caption, mimetype: 'video/mp4' }, { quoted: msg });
            }

            await sock.sendMessage(from, { react: { text: '✅', key: msg.key } });

        } catch (e) {
            console.error("ViewOnce Error:", e);
            await sock.sendMessage(from, { text: '⚠️ حدث خطأ فني أثناء محاولة استخراج الملف.' });
        }
    }
};

