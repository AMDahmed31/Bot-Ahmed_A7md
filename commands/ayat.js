const https = require('https');

// ========================
// قوائم الآيات المصنفة - أرقام كلية محسوبة بدقة
// ========================
const categories = {
    'رحمة': [
        1, 170, 225, 293, 425, 557, 589, 672, 801, 843,
        1110, 1158, 1306, 1385, 1563, 1649, 1851, 1908, 2095, 2566,
        2782, 2791, 2811, 3178, 3363, 3430, 3576, 4067, 4111, 4140,
        4277, 4280, 4612, 4622, 4902, 4918, 5084, 5136, 5230, 5622,
        5923, 6040, 6084, 6095, 6096, 44, 324, 603, 743, 1230
    ],
    'دعاء': [
        5, 6, 134, 135, 208, 257, 293, 301, 302, 309,
        331, 440, 484, 486, 487, 752, 977, 1043, 1449, 1450,
        1520, 1697, 1785, 1790, 1791, 2109, 2150, 2254, 2373, 2566,
        2570, 2572, 2770, 2771, 2791, 2920, 2929, 3015, 3178, 3268,
        3370, 4140, 4141, 5136, 5154, 5155, 5237, 5447, 346, 292
    ],
    'صبر': [
        52, 160, 162, 163, 164, 184, 256, 310, 413, 418,
        439, 493, 518, 823, 1041, 1080, 1206, 1473, 1484, 1522,
        1588, 1614, 1679, 1686, 1729, 1731, 1762, 1997, 2027, 2028,
        2168, 2480, 2630, 2784, 2930, 3306, 3398, 3527, 4068, 4253,
        4315, 4545, 4576, 5380, 5485, 5615, 6040, 6179, 435, 293
    ],
    'قصص': [
        37, 67, 74, 109, 253, 265, 266, 267, 326, 330,
        337, 696, 863, 1013, 1057, 1097, 1305, 1435, 1498, 1523,
        1542, 1599, 1600, 1615, 1619, 2149, 2200, 2223, 2266, 2291,
        2304, 2306, 2357, 2534, 2551, 2561, 2942, 3174, 3179, 3255,
        3275, 3887, 3927, 3987, 4011, 4855, 5926, 5999, 6189, 1707
    ],
    'تسبيح': [
        39, 334, 1097, 1374, 1720, 1900, 2073, 2137, 2261, 2381,
        2503, 2570, 2632, 2764, 2827, 2832, 2913, 3167, 3320, 3401,
        3426, 3575, 3741, 3947, 4125, 4188, 4256, 4592, 4669, 4783,
        5053, 5075, 5076, 5127, 5149, 5150, 5164, 5178, 5200, 5949,
        6216, 6224, 2030, 3788, 4407, 4509, 4698, 4778, 5242, 5917
    ],
    'أوامر': [
        50, 90, 117, 155, 190, 204, 229, 245, 395, 396,
        403, 423, 426, 494, 529, 551, 552, 628, 670, 671,
        704, 756, 940, 941, 985, 1205, 1354, 1991, 2052, 2063,
        2672, 2818, 2821, 2822, 3483, 3486, 3574, 3603, 4618, 4623,
        4624, 5082, 5115, 5165, 5186, 5235, 5237, 5483, 5495, 5962
    ],
    'جنة ونار': [
        32, 88, 89, 308, 426, 478, 550, 614, 788, 994,
        998, 1004, 1307, 1389, 1390, 1579, 1581, 1730, 1773, 1847,
        2126, 2169, 2311, 2614, 2674, 2870, 3520, 3760, 3828, 4019,
        4078, 4129, 4131, 4465, 4560, 4752, 4947, 4990, 5020, 5235,
        5247, 5342, 5348, 5596, 5693, 5703, 5866, 5891, 5975, 6020
    ]
};

const categoryLabels = {
    'رحمة':     '🤲 آيات الرحمة',
    'دعاء':     '🙏 آيات الدعاء',
    'صبر':      '💪 آيات الصبر',
    'قصص':     '📚 آيات القصص',
    'تسبيح':    '✨ آيات التسبيح',
    'أوامر':    '📌 آيات الأوامر',
    'جنة ونار': '🌹 آيات الجنة والنار'
};

function fetchJSON(url) {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try { resolve(JSON.parse(data)); }
                catch (e) { reject(e); }
            });
        }).on('error', reject);
    });
}

function getHelpMessage() {
    return `📖 *تصنيفات الآيات*

اختار التصنيف اللي تريده:

▪️ .أية ← عشوائي من القرآن كله
▪️ .أية رحمة ← آية رحمة 🤲
▪️ .أية دعاء ← آية دعاء 🙏
▪️ .أية صبر ← آية صبر 💪
▪️ .أية قصص ← آية قصص 📚
▪️ .أية تسبيح ← آية تسبيح ✨
▪️ .أية أوامر ← آية أوامر 📌
▪️ .أية جنة ونار ← آية جنة ونار `;
}

module.exports = {
    commands: ['.أية', '.أيات', '.ayah'],
    async execute(sock, msg, from, text) {
        try {
            const input = text.trim();

            // أمر .أيات ← يبعت القائمة
            if (input === '.أيات') {
                await sock.sendMessage(from, { react: { text: '📖', key: msg.key } });
                await sock.sendMessage(from, { text: getHelpMessage() }, { quoted: msg });
                return;
            }

            const parts = input.split(' ');
            const categoryKey = parts.slice(1).join(' ').trim();

            // لو كتب .أية بس من غير تصنيف ← عشوائي
            if (!categoryKey) {
                const randomAyah = Math.floor(Math.random() * 6236) + 1;
                const data = await fetchJSON(`https://api.alquran.cloud/v1/ayah/${randomAyah}/quran-simple`);
                if (data.status !== 'OK') throw new Error('فشل');
                const ayah = data.data;
                const message = `📖 *آية عشوائية*\n\n${ayah.text}\n\n🕌 *${ayah.surah.name}* - الآية ${ayah.numberInSurah}`;
                await sock.sendMessage(from, { react: { text: '📖', key: msg.key } });
                await sock.sendMessage(from, { text: message }, { quoted: msg });
                return;
            }

            // لو كتب تصنيف غلط ← يبعت القائمة
            if (!categories[categoryKey]) {
                await sock.sendMessage(from, { text: getHelpMessage() }, { quoted: msg });
                return;
            }

            // جلب آية عشوائية من التصنيف
            const list = categories[categoryKey];
            const randomIndex = Math.floor(Math.random() * list.length);
            const ayahNumber = list[randomIndex];

            const data = await fetchJSON(`https://api.alquran.cloud/v1/ayah/${ayahNumber}/quran-simple`);
            if (data.status !== 'OK') throw new Error('فشل');

            const ayah = data.data;
            const label = categoryLabels[categoryKey];
            const message = `${label}\n\n${ayah.text}\n\n🕌 *${ayah.surah.name}* - الآية ${ayah.numberInSurah}`;

            await sock.sendMessage(from, { react: { text: '📖', key: msg.key } });
            await sock.sendMessage(from, { text: message }, { quoted: msg });

        } catch (e) {
            await sock.sendMessage(from, { text: '❌ حدث خطأ في جلب الآية، حاول مرة أخرى.' }, { quoted: msg });
        }
    }
};
