module.exports = {
    commands: ['رفع', 'ترقية', 'تنزيل', 'اعفاء', 'طرد', 'ازاله', 'إزالة'],

    async execute(sock, msg, from, text) {
        if (!from.endsWith('@g.us')) return;

        try {
            const groupMetadata = await sock.groupMetadata(from);
            const participants = groupMetadata.participants;
            const sender = msg.key.participant || msg.key.remoteJid;

            // التحقق هل المرسل مشرف؟
            const senderAdmin = participants.find(p => p.id === sender)?.admin;
            if (!senderAdmin) {
                // لو مش مشرف يتفاعل بـ ❌
                return await sock.sendMessage(from, { react: { text: "❌", key: msg.key } });
            }

            let target = msg.message?.extendedTextMessage?.contextInfo?.participant || 
                         msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];

            if (!target) return;

            const firstWord = text.split(' ')[0];
            let action;

            if (['رفع', 'ترقية'].includes(firstWord)) action = "promote";
            else if (['تنزيل', 'اعفاء'].includes(firstWord)) action = "demote";
            else if (['طرد', 'ازاله', 'إزالة'].includes(firstWord)) action = "remove";

            // تنفيذ الأمر
            await sock.groupParticipantsUpdate(from, [target], action);

            // لو نجح يتفاعل بـ ✅
            await sock.sendMessage(from, { react: { text: "✅", key: msg.key } });

        } catch (err) {
            console.log("Admin Error: ", err.message);
            // لو حصل خطأ (زي إن البوت مش أدمن) يتفاعل بـ ❌
            await sock.sendMessage(from, { react: { text: "❌", key: msg.key } });
        }
    }
};

