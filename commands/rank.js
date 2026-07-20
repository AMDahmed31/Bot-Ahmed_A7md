const fs = require('fs');
const path = './database.json';

// التأكد من وجود ملف قاعدة البيانات
if (!fs.existsSync(path)) fs.writeFileSync(path, JSON.stringify({}));

module.exports = {
    commands: ['.ترتيب', '.توب'],
    async execute(sock, msg, from, text) {
        let db = JSON.parse(fs.readFileSync(path));
        const sender = msg.key.participant || msg.key.remoteJid;

        // إضافة نقاط لكل رسالة (تتم في الملف الرئيسي عادةً لكن هنا للتبسيط)
        if (!db[sender]) db[sender] = { xp: 0, messages: 0 };
        db[sender].xp += 1;
        db[sender].messages += 1;
        fs.writeFileSync(path, JSON.stringify(db));

        // أمر عرض الترتيب الشخصي
        if (text === '.ترتيب') {
            let user = db[sender];
            let rank = "عضو نشط ⚡";
            if (user.xp > 500) rank = "عضو فضي 🥈";
            if (user.xp > 1000) rank = "ملك التفاعل 👑";

            return await sock.sendMessage(from, { 
                text: `👤 *ملف التفاعل الخاص بك*\n\n` +
                     `🔹 الرتبة: ${rank}\n` +
                     `🔹 نقاطك: ${user.xp}\n` +
                     `🔹 عدد رسائلك: ${user.messages}`
            }, { quoted: msg });
        }

        // أمر عرض قائمة المتصدرين (التوب)
        if (text === '.توب' || text === '.الترتيب') {
            let sorted = Object.entries(db)
                .sort((a, b) => b[1].xp - a[1].xp)
                .slice(0, 10);

            let menu = `🏆 *قائمة أقوى 10 متفاعلين* 🏆\n━━━━━━━━━━━━━━━\n\n`;
            sorted.forEach((user, index) => {
                menu += `${index + 1} - @${user[0].split('@')[0]} ➜ ${user[1].xp} نقطة\n`;
            });

            return await sock.sendMessage(from, { 
                text: menu,
                mentions: sorted.map(u => u[0])
            }, { quoted: msg });
        }
    }
}

