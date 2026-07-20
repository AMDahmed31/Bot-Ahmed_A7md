const https = require('https');

function fetchText(url) {
    return new Promise((resolve, reject) => {
        https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(data));
        }).on('error', reject);
    });
}

module.exports = {
    commands: ['.طقس'],
    async execute(sock, msg, from, text) {
        try {
            const parts = text.trim().split(' ');
            const city = parts.slice(1).join('+') || 'Cairo';

            await sock.sendMessage(from, { react: { text: '🌤️', key: msg.key } });

            const url = `https://wttr.in/${encodeURIComponent(city)}?format=3&lang=ar`;
            const result = await fetchText(url);

            if (!result || result.includes('Unknown')) {
                await sock.sendMessage(from, { text: '❌ المدينة غير موجودة، جرب اسم تاني.' }, { quoted: msg });
                return;
            }

            const message = `🌤️ *حالة الطقس*\n───────────────────\n\n${result}\n\n───────────────────\n💡 مثال: .طقس الرياض`;

            await sock.sendMessage(from, { text: message }, { quoted: msg });

        } catch (e) {
            console.error('weather error:', e.message);
            await sock.sendMessage(from, { text: '❌ حدث خطأ، حاول مرة أخرى.' }, { quoted: msg });
        }
    }
};