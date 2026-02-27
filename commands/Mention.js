module.exports = {
    commands: ['.منشن', '.الكل'],
    async execute(sock, msg, from, text) {
        
        // تمت إزالة قيود التحقق من الرقم (أي شخص يمكنه الآن استخدام الأمر)

        try {
            // جلب بيانات المجموعة والأعضاء
            const groupMetadata = await sock.groupMetadata(from);
            const participants = groupMetadata.participants.map(p => p.id);
            
            // إرسال كلمة "الكل" مع منشن تقني للجميع
            await sock.sendMessage(from, { 
                text: "الكل", 
                mentions: participants 
            }, { quoted: msg }); // إضافة الرد (quoted) ليعرف الجميع من الذي استدعى المنشن

            console.log(`📢 تم استخدام أمر المنشن من قبل أحد الأعضاء.`);

        } catch (e) {
            console.error("خطأ في تنفيذ أمر المنشن العام:", e);
        }
    }
}

