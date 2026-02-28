const fs = require('fs');

function getFallbackImage() {
    const fallbackPath = './my_image.jpg';
    if (fs.existsSync(fallbackPath)) return fs.readFileSync(fallbackPath);
    return null;
}

async function getProfilePic(sock, jid) {
    try {
        const url = await sock.profilePictureUrl(jid, 'image');
        return { url };
    } catch {
        return getFallbackImage();
    }
}

async function getStatus(sock, jid) {
    try {
        const data = await sock.fetchStatus(jid);
        return data?.status || null;
    } catch {
        return null;
    }
}

module.exports = {
    commands: ['.انا', '.My', '.الملف الشخصي'],

    async execute(sock, msg, from, text) {

        const botNumber = sock.user.id.split(':')[0] + '@s.whatsapp.net';

        // ✅ الحل الصح: fromMe يعني الرسالة صادرة من صاحب البوت نفسه
        const isOwner = msg.key.fromMe === true;

        // ╔═════════════════════╗
        // ║         .انا / .My  — صاحب البوت       ║
        // ╚═════════════════════╝
        if (text === '.انا' || text === '.My') {
            await sock.sendMessage(from, { react: { text: '⏳', key: msg.key } });

            if (!isOwner) {
                return await sock.sendMessage(from, {
                    text: '🚫 *وقف!*\nهذا الأمر حكر على صاحب البوت فقط، ما لك شغل فيه 😤'
                }, { quoted: msg });
            }

            const pushName = msg.pushName || 'مطوّر البوت';
            const waLink   = `https://wa.me/+${botNumber.split('@')[0]}`;
            const ppImage  = await getProfilePic(sock, botNumber);

            const caption =
                `『 🧬 』*بـيـانـات الـمـطـوّر*\n` +
                `┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄\n` +
                `👑 *الاسم :* ${pushName}\n` +
                `📲 *الرقم :* ${waLink}\n` +
                `┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄\n` +
                `🤖 *مشغّل البوت ومبرمجه*\n` +
                `⚡ _بصمته واضحة في كل أمر_`;

            if (!ppImage) {
                return await sock.sendMessage(from, { text: caption }, { quoted: msg });
            }

            return await sock.sendMessage(from, {
                image: ppImage,
                caption,
                jpegThumbnail: undefined
            }, { quoted: msg });
        }

        // ╔═══════════════════════╗
        // ║       .الملف الشخصي — أي مستخدم          ║
        // ╚═══════════════════════╝
        if (text === '.الملف الشخصي') {
            await sock.sendMessage(from, { react: { text: '⏳', key: msg.key } });

            const ctx = msg.message?.extendedTextMessage?.contextInfo
                     || msg.message?.imageMessage?.contextInfo
                     || msg.message?.videoMessage?.contextInfo;

            const targetJid = ctx?.participant || ctx?.remoteJid;

            if (!targetJid) {
                return await sock.sendMessage(from, {
                    text: '↩️ *كيفية الاستخدام:*\nارد على رسالة الشخص المراد معرفة معلوماته ثم اكتب الأمر 😊'
                }, { quoted: msg });
            }

            const targetNumber = targetJid.split('@')[0];
            const waLink = `https://wa.me/+${targetNumber}`;

            const [ppImage, status] = await Promise.all([
                getProfilePic(sock, targetJid),
                getStatus(sock, targetJid)
            ]);

            const statusLine = status
                ? `💬 *الحالة :* ${status}`
                : `💬 *الحالة :* _لا توجد حالة_`;

            const caption =
                `『 👤 』*الـمـلـف الـشـخـصـي*\n` +
                `┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄\n` +
                `📲 *الرقم :* ${waLink}\n` +
                `${statusLine}\n` +
                `┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄\n` +
                `🔍 _تم جلب البيانات بنجاح ✅_`;

            if (!ppImage) {
                return await sock.sendMessage(from, { text: caption }, { quoted: msg });
            }

            return await sock.sendMessage(from, {
                image: ppImage,
                caption,
                jpegThumbnail: undefined
            }, { quoted: msg });
        }
    }
};