module.exports = {
    commands: ['.طرد_الكل', '.تصفية'],
    async execute(sock, msg, from, text) {
        
        // 1. التأكد أن الأمر في مجموعة
        if (!from.endsWith('@g.us')) return;

        try {
            // 2. جلب بيانات الأعضاء
            const groupMetadata = await sock.groupMetadata(from);
            const participants = groupMetadata.participants;
            
            // معرف البوت ومعرف صاحب البوت (أنت) لتجنب طردهم
            const botId = sock.user.id.split(':')[0] + '@s.whatsapp.net';
            
            // 3. فلترة القائمة (استخراج غير المشرفين فقط)
            // ملاحظة: البوت لا يستطيع طرد المشرفين برمجياً
            const toKick = participants
                .filter(p => !p.admin && p.id !== botId)
                .map(p => p.id);

            if (toKick.length === 0) {
                return await sock.sendMessage(from, { text: "❌ لا يوجد أعضاء عاديين لطردهم (الموجودون مشرفون فقط)." });
            }

            // 4. إرسال أمر الطرد الجماعي (مرة واحدة)
            await sock.sendMessage(from, { text: `⏳ جاري طرد ${toKick.length} عضو دفعة واحدة...` });
            
            await sock.groupParticipantsUpdate(from, toKick, "remove");

            return await sock.sendMessage(from, { text: "✅ تمت التصفية بنجاح." });

        } catch (e) {
            console.error(e);
            return await sock.sendMessage(from, { text: "❌ فشلت العملية. تأكد أن البوت مشرف (Admin)." });
        }
    }
}

