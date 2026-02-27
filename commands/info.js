const fs = require('fs');

// دالة بسيطة لقراءة محتوى الملفات النصية
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

        // 1. أمر معرف المجموعة
        if (input === '.id') {
            return await sock.sendMessage(from, { text: `🆔 معرف الدردشة:\n\n\`${from}\`` }, { quoted: msg });
        }

        // 2. أمر البوت (يجلب النص من الملف النصي)
        if (input === '.bot') {
            const menuContent = readMenu();
            
            await sock.sendMessage(from, { react: { text: '📋', key: msg.key } });
            await sock.sendMessage(from, { text: menuContent }, { quoted: msg });
        }
    }
}

