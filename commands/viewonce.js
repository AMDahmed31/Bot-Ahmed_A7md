const { downloadContentFromMessage } = require('@whiskeysockets/baileys');

module.exports = {
    commands: ['.فك'],
    async execute(sock, msg, from, text) {
        try {
            // 1. جلب الرسالة المقتبسة (التي قمت بالرد عليها)
            const quotedMsg = msg.message.extendedTextMessage?.contextInfo?.quotedMessage;
            
            // 2. البحث عن محتوى الميديا داخل الرسالة
            // قد تكون الرسالة داخل غلاف viewOnceMessageV2 أو تكون رسالة مباشرة
            let viewOnce = quotedMsg?.viewOnceMessageV2 || quotedMsg?.viewOnceMessage || quotedMsg;
            
            // تحديد نوع المحتوى (صورة أم فيديو)
            let type = '';
            let mediaData = null;

            if (viewOnce?.message?.imageMessage || viewOnce?.imageMessage) {
                type = 'image';
                mediaData = viewOnce?.message?.imageMessage || viewOnce?.imageMessage;
            } else if (viewOnce?.message?.videoMessage || viewOnce?.videoMessage) {
                type = 'video';
                mediaData = viewOnce?.message?.videoMessage || viewOnce?.videoMessage;
            }

            // 3. إذا لم يجد البوت صورة أو فيديو
            if (!mediaData) {
                return await sock.sendMessage(from, { 
                    text: '❌ لم أستطع العثور على صورة أو فيديو "مشاهدة لمرة واحدة" في هذا الرد.\n\nتأكد أنك ترد مباشرة على الرسالة المطلوبة.' 
                }, { quoted: msg });
            }

            await sock.sendMessage(from, { react: { text: '⏳', key: msg.key } });

            // 4. تحميل المحتوى
            const stream = await downloadContentFromMessage(mediaData, type);
            let buffer = Buffer.from([]);
            for await (const chunk of stream) {
                buffer = Buffer.concat([buffer, chunk]);
            }

            // 5. إرسال الرسالة المفكوكة
            const caption = `تم`;

            if (type === 'image') {
                await sock.sendMessage(from, { image: buffer, caption }, { quoted: msg });
            } else {
                await sock.sendMessage(from, { video: buffer, caption, mimetype: 'video/mp4' }, { quoted: msg });
            }

            await sock.sendMessage(from, { react: { text: '✅', key: msg.key } });

        } catch (e) {
            console.error("ViewOnce Error:", e);
            await sock.sendMessage(from, { text: '⚠️ حدث خطأ فني أثناء محاولة استخراج الملف.' });
        }
    }
};

