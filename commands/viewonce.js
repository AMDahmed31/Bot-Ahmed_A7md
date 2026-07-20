const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
const { addLogoToImage, addLogoToVideo } = require('./quran_images');

module.exports = {
    commands: ['.فك'],
    async execute(sock, msg, from, text) {
        try {
            const quotedMsg = msg.message.extendedTextMessage?.contextInfo?.quotedMessage;
            
            if (!quotedMsg) {
                return await sock.sendMessage(from, {
                    text: '❌ لم أستطع العثور على رسالة مقتبسة (الرد). تأكد من الرد مباشرة على الرسالة المطلوبة.'
                }, { quoted: msg });
            }

            // 1. تفكيك طبقات الـ View Once أولاً للوصول إلى الرسالة الحقيقية المليئة بالبيانات ومفاتيح التشفير
            let actualMessage = quotedMsg;
            
            if (quotedMsg.viewOnceMessageV2?.message) {
                actualMessage = quotedMsg.viewOnceMessageV2.message;
            } else if (quotedMsg.viewOnceMessage?.message) {
                actualMessage = quotedMsg.viewOnceMessage.message;
            } else if (quotedMsg.viewOnceMessageV2Extension?.message) {
                actualMessage = quotedMsg.viewOnceMessageV2Extension.message;
            }

            // 2. استخراج الميديا من الرسالة الحقيقية بعد التفكيك
            const imageMessage = actualMessage?.imageMessage;
            const videoMessage = actualMessage?.videoMessage;

            let type = '';
            let mediaData = null;

            if (imageMessage) {
                type = 'image';
                mediaData = imageMessage;
            } else if (videoMessage) {
                type = 'video';
                mediaData = videoMessage;
            }

            // 3. التحقق من وجود الميديا ومن امتلاكها لمفتاح تشفير صالح للتحميل
            if (!mediaData || !mediaData.mediaKey) {
                return await sock.sendMessage(from, {
                    text: '❌ لم أستطع العثور على ميديا "مشاهدة لمرة واحدة" صالحة، أو قد تكون انتهت صلاحيتها.'
                }, { quoted: msg });
            }

            await sock.sendMessage(from, { react: { text: '⏳', key: msg.key } });

            // تحميل محتوى الميديا المشفرة
            const stream = await downloadContentFromMessage(mediaData, type);
            let buffer = Buffer.from([]);
            for await (const chunk of stream) {
                buffer = Buffer.concat([buffer, chunk]);
            }

            const caption = `تم فك القفل بنجاح 😉`;

            if (type === 'image') {
                // معالجة وإرسال الصورة
                const imageWithLogo = await addLogoToImage(buffer);
                await sock.sendMessage(from, { image: imageWithLogo || buffer, caption }, { quoted: msg });
            } else if (type === 'video') {
                // معالجة وإرسال الفيديو
                await sock.sendMessage(from, { react: { text: '🎬', key: msg.key } });
                const videoWithLogo = await addLogoToVideo(buffer);
                
                await sock.sendMessage(from, { 
                    video: videoWithLogo || buffer, 
                    caption, 
                    mimetype: mediaData.mimetype || 'video/mp4'
                }, { quoted: msg });
            }

            await sock.sendMessage(from, { react: { text: '✅', key: msg.key } });

        } catch (e) {
            console.error("ViewOnce Error:", e);
            await sock.sendMessage(from, { react: { text: '❌', key: msg.key } });
            await sock.sendMessage(from, { text: '⚠️ حدث خطأ فني أثناء محاولة استخراج الملف.' }, { quoted: msg });
        }
    }
};

