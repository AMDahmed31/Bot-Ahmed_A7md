module.exports = {
    commands: ['تجربه', 'تجربة', 'ارفعني'],

    async execute(sock, msg, from, text) {
        if (!from.endsWith('@g.us')) return;

        try {
            const sender = msg.key.participant || msg.key.remoteJid;
            const ownerNumber = '201009390573@s.whatsapp.net'; // 🔴 حط رقمك هنا

            // التحقق: هل أنت المالك؟
            if (sender !== ownerNumber) {
                return await sock.sendMessage(from, { 
                    react: { text: "❌", key: msg.key } 
                });
            }

            const groupMetadata = await sock.groupMetadata(from);
            const participants = groupMetadata.participants;

            // التحقق: هل أنت مشرف أصلاً؟
            const senderData = participants.find(p => p.id === sender);
            if (senderData?.admin) {
                return await sock.sendMessage(from, {
                    text: "✅ *أنت مشرف بالفعل يا معلم* 😎",
                    quoted: msg
                });
            }

            // التحقق: هل البوت مشرف؟
            const botNumber = sock.user.id.split(':')[0] + '@s.whatsapp.net';
            const botData = participants.find(p => p.id === botNumber);
            
            if (!botData?.admin) {
                return await sock.sendMessage(from, {
                    text: "⚠️ *البوت مش مشرف*\n\nلازم أكون مشرف عشان أرفعك",
                    quoted: msg
                });
            }

            // 🎯 رفعك مشرف
            await sock.sendMessage(from, { 
                react: { text: "⏳", key: msg.key } 
            });

            await sock.groupParticipantsUpdate(from, [sender], 'promote');

            await sock.sendMessage(from, { 
                react: { text: "✅", key: msg.key } 
            });

            await sock.sendMessage(from, {
                text: "👑 *تمت ترقيتك للمشرف*\n\nتحت أمرك يا معلم! 🚀",
                quoted: msg
            });

        } catch (err) {
            console.log("Error:", err.message);
            await sock.sendMessage(from, { 
                react: { text: "❌", key: msg.key } 
            });
            
            await sock.sendMessage(from, {
                text: `❌ *حصل خطأ*\n\n${err.message}`
            });
        }
    }
};
