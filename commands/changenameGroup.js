// commands/changename.js
module.exports = {
    // الأوامر: تعمل سواء كتبت ".اسم المجموعة" أو ".تغيير_الاسم"
    commands: ['.اسم', '.تغيير_الاسم', '.اسم_المجموعة'],

    execute: async (sock, msg, from, text) => {
        // التحقق: يجب أن يكون داخل مجموعة
        if (!from.endsWith('@g.us')) return;

        let newName = "";

        // معالجة الأمر المركب (بمسافة) ".اسم المجموعة"
        if (text.startsWith(".اسم المجموعة")) {
            newName = text.replace(".اسم المجموعة", "").trim();
        } else {
            // معالجة الأمر العادي (كلمة واحدة)
            newName = text.split(' ').slice(1).join(' ');
        }

        // لو مفيش اسم، اخرج بصمت
        if (!newName) return;

        try {
            // محاولة تغيير الاسم
            await sock.groupUpdateSubject(from, newName);
            
            // نجح؟ حط لايك ✅
            await sock.sendMessage(from, { react: { text: "✅", key: msg.key } });

        } catch (error) {
            // فشل؟ حط خطأ ❌ (بدون كلام)
            await sock.sendMessage(from, { react: { text: "❌", key: msg.key } });
        }
    }
};

