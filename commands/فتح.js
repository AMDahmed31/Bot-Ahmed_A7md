const { downloadMediaMessage } = require('@whiskeysockets/baileys');

module.exports = {
    commands: ['.فتح', '.open'],
    async execute(sock, msg, from, text) {
        // تحقق إن الرسالة دي رد على رسالة تانية
        const quotedMsg = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;

        if (!quotedMsg) {
            return await sock.sendMessage(from, {
                text: `❌ *رد على رسالة الـ View Once الأول*`
            }, { quoted: msg });
        }

        // تحقق إن المردود عليها View Once
        const isViewOnce = quotedMsg.viewOnceMessage || quotedMsg.viewOnceMessageV2;

        if (!isViewOnce) {
            return await sock.sendMessage(from, {
                text: `❌ *الرسالة دي مش View Once*`
            }, { quoted: msg });
        }

        await sock.sendMessage(from, { react: { text: '⏳', key: msg.key } });

        try {
            const inner = isViewOnce.message;
            const innerType = Object.keys(inner)[0];

            // بناء رسالة وهمية عشان نحمل الميديا
            const fakeMsg = {
                key: msg.message.extendedTextMessage.contextInfo.stanzaId
                    ? {
                        ...msg.key,
                        id: msg.message.extendedTextMessage.contextInfo.stanzaId,
                        fromMe: msg.message.extendedTextMessage.contextInfo.participant === undefined
                    }
                    : msg.key,
                message: inner
            };

            const buffer = await downloadMediaMessage(
                fakeMsg,
                'buffer',
                {},
                { logger: { info: () => {}, warn: () => {}, error: () => {} }, reuploadRequest: sock.updateMediaMessage }
            );

            await sock.sendMessage(from, { react: { text: '✅', key: msg.key } });

            if (innerType === 'imageMessage') {
                await sock.sendMessage(from, {
                    image: buffer,
                    caption: '🔓 *تم فتح الصورة*'
                }, { quoted: msg });
            } else if (innerType === 'videoMessage') {
                await sock.sendMessage(from, {
                    video: buffer,
                    caption: '🔓 *تم فتح الفيديو*'
                }, { quoted: msg });
            } else if (innerType === 'audioMessage') {
                await sock.sendMessage(from, {
                    audio: buffer,
                    mimetype: 'audio/mpeg',
                    ptt: inner.audioMessage?.ptt || false
                }, { quoted: msg });
            } else {
                await sock.sendMessage(from, {
                    text: `❌ نوع الملف مش مدعوم: ${innerType}`
                }, { quoted: msg });
            }

        } catch (e) {
            await sock.sendMessage(from, { react: { text: '❌', key: msg.key } });
            await sock.sendMessage(from, {
                text: `❌ خطأ: ${e.message}`
            }, { quoted: msg });
        }
    }
};