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

// نكت عربية محلية
const arabicJokes = [
    'واحد راح عند الدكتور قاله: دكتور أنا بحس إني مش موجود!\nالدكتور قاله: التالي!',
    'طالب سأل أستاذه: ليه السمكة بتعيش في المية؟\nالأستاذ: عشان لو عاشت في البر الهر ياكلها!',
    'واحد اشترى ميزان جديد، أمه قالتله: ليه اشتريت ده؟\nقالها: عشان أوزن الموضوع!',
    'واحد صحي من النوم لقى نفسه متأخر على الشغل، قام جري لبس هدومه ونزل، وفي الأسانسير فكر... ده يوم إجازة!',
    'مدرس سأل طالب: إيه هو أبطأ حيوان في العالم؟\nالطالب: مش عارف يا أستاذ بس اللي اكتشفه متأخر شوية!',
    'واحد راح المطعم قال للنادل: جيبلي وجبة خفيفة!\nالنادل جابله طبق فاضي وقاله: خفيف زي ما طلبت!',
    'واحد سأل صاحبه: إيه رأيك في الجو النهارده؟\nصاحبه قاله: تمام، بس ربنا يصبر على اللي شاغل التكييف!',
    'الابن: بابا عندي خبر كويس وخبر وحش!\nالأب: قول الكويس الأول!\nالابن: الخبر الكويس إن عربيتك بخير!\nالأب: والوحش؟\nالابن: اتحرقت!',
    'واحد راح الحلاق قاله: قصة خفيفة!\nالحلاق: تمام، هقصلك حاجة مش هتحس بيها!',
    'مراة قالت لجوزها: أنا عارفة إنك بتحبني!\nقالها: إيه اللي خلاكي تقولي كده؟\nقالت: لأنك لسا مش طلبت طلاق!',
];

module.exports = {
    commands: ['.نكتة'],
    async execute(sock, msg, from, text) {
        try {
            await sock.sendMessage(from, { react: { text: '😂', key: msg.key } });

            let joke = '';

            try {
                // نجرب API الانجليزي ونترجمه
                const data = await fetchJSON('https://official-joke-api.appspot.com/random_joke');
                if (data && data.setup && data.punchline) {
                    // ترجمة للعربي
                    const translateUrl = (t) => `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=ar&dt=t&q=${encodeURIComponent(t)}`;
                    const [s, p] = await Promise.all([fetchJSON(translateUrl(data.setup)), fetchJSON(translateUrl(data.punchline))]);
                    const setup = s[0].map(i => i[0]).filter(Boolean).join('');
                    const punchline = p[0].map(i => i[0]).filter(Boolean).join('');
                    joke = `😂 *نكتة*\n───────────────────\n\n${setup}\n\n😄 ${punchline}`;
                }
            } catch (e) {
                // لو فشل API نستخدم المحلي
            }

            if (!joke) {
                const local = arabicJokes[Math.floor(Math.random() * arabicJokes.length)];
                joke = `😂 *نكتة*\n───────────────────\n\n${local}`;
            }

            await sock.sendMessage(from, { text: joke }, { quoted: msg });

        } catch (e) {
            console.error('joke error:', e.message);
            await sock.sendMessage(from, { text: '❌ حدث خطأ، حاول مرة أخرى.' }, { quoted: msg });
        }
    }
};
