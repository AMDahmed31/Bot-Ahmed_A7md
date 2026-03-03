const https = require('https');

function fetchJSON(url) {
    return new Promise((resolve, reject) => {
        https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => { try { resolve(JSON.parse(data)); } catch (e) { reject(e); } });
        }).on('error', reject);
    });
}

const arabicWisdom = [
    { text: 'العقل زينة، والعلم سلاح، والصبر مفتاح الفرج.', author: 'علي بن أبي طالب' },
    { text: 'من لم يصبر على مشقة التعلم بقي طول عمره في ذل الجهل.', author: 'الإمام الشافعي' },
    { text: 'أعقل الناس من جمع عقول الناس إلى عقله.', author: 'عمر بن الخطاب' },
    { text: 'خير الكلام ما قل ودل.', author: 'مأثور' },
    { text: 'المرء بأصغريه: قلبه ولسانه.', author: 'علي بن أبي طالب' },
    { text: 'الصمت حكمة وقليل فاعله.', author: 'مأثور' },
    { text: 'من كثر كلامه كثر خطؤه.', author: 'مأثور' },
    { text: 'التواضع يرفع والكبر يضع.', author: 'مأثور' },
    { text: 'اللسان سبع إن أُطلق عقر.', author: 'علي بن أبي طالب' },
    { text: 'كن كالنخلة، شامخة وثمرها حلو حتى لو رُميت بالحجارة.', author: 'مأثور' },
    { text: 'إذا أردت أن تعرف قيمة الوقت فاسأل من فقده.', author: 'مأثور' },
    { text: 'الناس معادن كمعادن الذهب والفضة.', author: 'النبي ﷺ' },
    { text: 'خير الأمور أوساطها.', author: 'مأثور' },
    { text: 'من عرف نفسه فقد عرف ربه.', author: 'مأثور' },
    { text: 'الوقت كالسيف إن لم تقطعه قطعك.', author: 'مأثور' },
];

module.exports = {
    commands: ['.حكمة'],
    async execute(sock, msg, from, text) {
        try {
            await sock.sendMessage(from, { react: { text: '💡', key: msg.key } });

            let wisdomText = '';
            let author = '';

            try {
                const data = await fetchJSON('https://api.quotable.io/random');
                if (data && data.content) {
                    const translateUrl = (t) => `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=ar&dt=t&q=${encodeURIComponent(t)}`;
                    const translated = await fetchJSON(translateUrl(data.content));
                    wisdomText = translated[0].map(i => i[0]).filter(Boolean).join('');
                    author = data.author || '';
                }
            } catch (e) {}

            if (!wisdomText) {
                const local = arabicWisdom[Math.floor(Math.random() * arabicWisdom.length)];
                wisdomText = local.text;
                author = local.author;
            }

            let message = `💡 *حكمة اليوم*\n───────────────────\n\n❝\n${wisdomText}\n❞`;
            if (author) message += `\n\n✍️ *${author}*`;

            await sock.sendMessage(from, { text: message }, { quoted: msg });

        } catch (e) {
            console.error('wisdom error:', e.message);
            await sock.sendMessage(from, { text: '❌ حدث خطأ، حاول مرة أخرى.' }, { quoted: msg });
        }
    }
};
