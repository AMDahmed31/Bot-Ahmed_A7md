const https = require('https');
const { SOUNDCLOUD_CLIENT_ID } = require('../config');

function httpsGet(url) {
    return new Promise((resolve, reject) => {
        const req = https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve({ data, statusCode: res.statusCode }));
        });
        req.on('error', reject);
        req.setTimeout(15000, () => { req.destroy(); reject(new Error('timeout')); });
    });
}

async function searchSoundCloud(query) {
    const encoded = encodeURIComponent(query);
    const url = `https://api.soundcloud.com/tracks?q=${encoded}&client_id=${SOUNDCLOUD_CLIENT_ID}&limit=5&linked_partitioning=1`;
    const res = await httpsGet(url);
    const data = JSON.parse(res.data);
    if (!data.collection || data.collection.length === 0) throw new Error('مش لاقي نتايج');
    return data.collection;
}

module.exports = {
    commands: ['.تشغيل', '.play'],
    async execute(sock, msg, from, text) {
        const query = text.replace(/^\.تشغيل|^\.play/i, '').trim();

        if (!query) {
            return await sock.sendMessage(from, {
                text: `🎵 *استخدام الأمر:*\n\n*.تشغيل [اسم الأغنية]*\n\nمثال: .تشغيل Bohemian Rhapsody`
            }, { quoted: msg });
        }

        await sock.sendMessage(from, { react: { text: '🔍', key: msg.key } });

        try {
            const tracks = await searchSoundCloud(query);

            let result = `🎵 *نتايج البحث عن: ${query}*\n\n`;
            tracks.forEach((track, i) => {
                const title = track.title;
                const artist = track.user?.username || 'Unknown';
                const duration = Math.floor(track.duration / 1000);
                const minutes = Math.floor(duration / 60);
                const seconds = duration % 60;
                result += `*${i + 1}.* ${title}\n`;
                result += `👤 ${artist}\n`;
                result += `⏱️ ${minutes}:${seconds.toString().padStart(2, '0')}\n`;
                result += `🔗 ${track.permalink_url}\n\n`;
            });

            await sock.sendMessage(from, { react: { text: '🎵', key: msg.key } });
            await sock.sendMessage(from, { text: result }, { quoted: msg });

        } catch (e) {
            await sock.sendMessage(from, { react: { text: '❌', key: msg.key } });
            await sock.sendMessage(from, {
                text: `❌ خطأ: ${e.message}`
            }, { quoted: msg });
        }
    }
};