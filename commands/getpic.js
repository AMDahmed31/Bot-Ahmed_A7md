module.exports = {
    // تأكد أن الكلمات هنا هي ما تبدأ به الرسالة
    commands: ['.صورة','.صورة الملف الشخصي '], 

    async execute(sock, msg, from, text) {
        try {
            let target;

            // 1. التعامل مع الرد (Reply)
            const quoted = msg.message?.extendedTextMessage?.contextInfo?.participant;
            
            // 2. التعامل مع الرقم (استخراج الرقم من النص)
            // بما أنك كتبت "صوره +2012..." النص هنا سيتم تقسيمه
            const args = text.split(' '); 
            let number = args[1] ? args[1].replace(/[^0-9]/g, '') : null;

            if (quoted) {
                target = quoted;
            } else if (number) {
                target = number + '@s.whatsapp.net';
            } else {
                return await sock.sendMessage(from, { text: "⚠️ أرسل 'صوره' مع الرقم أو بالرد على رسالة." }, { quoted: msg });
            }

            // إرسال تفاعل للانتظار
            await sock.sendMessage(from, { react: { text: "⏳", key: msg.key } });

            // محاولة جلب الرابط
            const ppUrl = await sock.profilePictureUrl(target, 'image').catch(() => null);

            if (ppUrl) {
                await sock.sendMessage(from, { 
                    image: { url: ppUrl }, 
                    caption: `✅ تم جلب صورة البروفايل` 
                }, { quoted: msg });
                await sock.sendMessage(from, { react: { text: "✅", key: msg.key } });
            } else {
                await sock.sendMessage(from, { text: "❌ لا توجد صورة بروفايل متاحة (بسبب الخصوصية أو الرقم خطأ)." }, { quoted: msg });
                await sock.sendMessage(from, { react: { text: "❌", key: msg.key } });
            }

        } catch (err) {
            console.error("Error in GetPic:", err);
            await sock.sendMessage(from, { react: { text: "❌", key: msg.key } });
        }
    }
};