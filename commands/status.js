const { generateWAMessageFromContent } = require('@whiskeysockets/baileys');

module.exports = {
    commands: ['.حالة', '.حاله'],
    async execute(sock, msg, from, text) {
        try {
            const quotedMsg = msg.message.extendedTextMessage?.contextInfo?.quotedMessage;
            
            if (!quotedMsg) {
                return await sock.sendMessage(from, {
                    text: '❌ يرجى الرد (المنشن) مباشرة على الحالة التي تريد تحميلها وكتابة الأمر *.حالة*'
                }, { quoted: msg });
            }

            // فحص أنواع الحالات المحتملة
            const imageMessage = quotedMsg.imageMessage;
            const videoMessage = quotedMsg.videoMessage;
            const textMessage = quotedMsg.extendedTextMessage || quotedMsg.conversation;

            // 1. إذا كانت الحالة نصية فقط
            if (textMessage && !imageMessage && !videoMessage) {
                const statusText = typeof textMessage === 'string' ? textMessage : (textMessage.text || '');
                if (!statusText) {
                    return await sock.sendMessage(from, { text: '❌ لم أتمكن من قراءة النص في هذه الحالة.' }, { quoted: msg });
                }
                await sock.sendMessage(from, { react: { text: '⏳', key: msg.key } });
                // الإرسال في نفس الشات الحالي (from) بدلاً من الشات الخاص
                await sock.sendMessage(from, { text: `📝 *نص الحالة المستخرج:* \n\n${statusText}` }, { quoted: msg });
                return await sock.sendMessage(from, { react: { text: '✅', key: msg.key } });
            }

            let type = '';
            let mediaData = null;

            if (imageMessage) {
                type = 'imageMessage';
                mediaData = imageMessage;
            } else if (videoMessage) {
                type = 'videoMessage';
                mediaData = videoMessage;
            }

            if (!mediaData || !mediaData.url) {
                return await sock.sendMessage(from, {
                    text: '❌ لم أستطع العثور على ميديا صالحة في هذه الحالة، أو قد تكون انتهت صلاحيتها.'
                }, { quoted: msg });
            }

            // وضع إيموجي الانتظار
            await sock.sendMessage(from, { react: { text: '⏳', key: msg.key } });

            // استنساخ بيانات الميديا الأصلية
            const cleanedMedia = { ...mediaData };
            cleanedMedia.caption = `تم تحميل الحالة بنجاح 📥`;
            
            if ('viewOnce' in cleanedMedia) cleanedMedia.viewOnce = false;

            // إنشاء هيكل الرسالة وإرسالها إلى الشات الحالي (from)
            const messageContent = { [type]: cleanedMedia };
            
            const waMessage = generateWAMessageFromContent(
                from, // تم التغيير إلى from لإرسالها في نفس الشات
                messageContent,
                { userJid: sock.user.id }
            );

            // توجيه الرسالة فوراً للشات الحالي
            await sock.relayMessage(from, waMessage.message, { messageId: waMessage.key.id });

            // وضع إيموجي النجاح
            await sock.sendMessage(from, { react: { text: '✅', key: msg.key } });

        } catch (e) {
            console.error("Status Downloader Error:", e);
            await sock.sendMessage(from, { react: { text: '❌', key: msg.key } });
            await sock.sendMessage(from, { text: '⚠️ حدث خطأ غير متوقع أثناء جلب الحالة من الخادم.' }, { quoted: msg });
        }
    }
};

