const fs = require('fs');
const path = require('path');

const readMenu = () => {
    try {
        return fs.readFileSync('./liste_orders.txt', 'utf8');
    } catch (e) {
        return "❌ خطأ: ملف liste_orders.txt غير موجود في المجلد الرئيسي.";
    }
};

module.exports = {
    commands: ['.bot', '.id'],
    async execute(sock, msg, from, text) {
        
        const input = text.toLowerCase().trim();

        if (input === '.id') {
            return await sock.sendMessage(from, { text: `🆔 معرف الدردشة:\n\n\`${from}\`` }, { quoted: msg });
        }

        if (input === '.bot') {
            const menuContent = readMenu();
            
            await sock.sendMessage(from, { react: { text: '📋', key: msg.key } });

            // إرسال الصورة مع النص كـ caption
            const logoPath = path.join(__dirname, 'Logo.png');
            
            if (fs.existsSync(logoPath)) {
                await sock.sendMessage(from, {
                    image: fs.readFileSync(logoPath),
                    caption: menuContent
                }, { quoted: msg });
            } else {
                // إذا الصورة مش موجودة، يرسل النص بس
                await sock.sendMessage(from, { text: menuContent }, { quoted: msg });
            }
        }
    }
}
