const https = require('https');

const languages = {
    'عربي':      'ar',
    'انجليزي':   'en',
    'فرنسي':     'fr',
    'اسباني':    'es',
    'الماني':    'de',
    'ايطالي':    'it',
    'تركي':      'tr',
    'فارسي':     'fa',
    'اردو':      'ur',
    'روسي':      'ru',
    'صيني':      'zh',
    'ياباني':    'ja',
    'كوري':      'ko',
    'هندي':      'hi',
    'برتغالي':   'pt',
    'هولندي':    'nl',
    'بولندي':    'pl',
    'سويدي':     'sv',
    'دنماركي':   'da',
    'يوناني':    'el',
    'عبري':      'he',
    'تايلاندي':  'th',
    'فيتنامي':   'vi',
    'اندونيسي':  'id',
    'ملايو':     'ms',
};

const languageFlags = {
    'عربي':      '🇸🇦',
    'انجليزي':   '🇺🇸',
    'فرنسي':     '🇫🇷',
    'اسباني':    '🇪🇸',
    'الماني':    '🇩🇪',
    'ايطالي':    '🇮🇹',
    'تركي':      '🇹🇷',
    'فارسي':     '🇮🇷',
    'اردو':      '🇵🇰',
    'روسي':      '🇷🇺',
    'صيني':      '🇨🇳',
    'ياباني':    '🇯🇵',
    'كوري':      '🇰🇷',
    'هندي':      '🇮🇳',
    'برتغالي':   '🇧🇷',
    'هولندي':    '🇳🇱',
    'بولندي':    '🇵🇱',
    'سويدي':     '🇸🇪',
    'دنماركي':   '🇩🇰',
    'يوناني':    '🇬🇷',
    'عبري':      '🇮🇱',
    'تايلاندي':  '🇹🇭',
    'فيتنامي':   '🇻🇳',
    'اندونيسي':  '🇮🇩',
    'ملايو':     '🇲🇾',
};

function isArabic(text) {
    return /[\u0600-\u06FF]/.test(text);
}

function fetchTranslate(text, sourceLang, targetLang) {
    return new Promise((resolve, reject) => {
        const encodedText = encodeURIComponent(text);
        const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sourceLang}&tl=${targetLang}&dt=t&q=${encodedText}`;

        https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    const translated = parsed[0]
                        .map(item => item[0])
                        .filter(Boolean)
                        .join('');
                    resolve(translated);
                } catch (e) {
                    reject(e);
                }
            });
        }).on('error', reject);
    });
}

function getLangsMessage() {
    return `*〘 🌍 اللغات المتاحة 〙*

${Object.entries(languageFlags).map(([name, flag]) => `*${flag} ⇠〘 ${name} 〙*`).join('\n')}

┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄
💡 *مثال:*
.ترجمة مرحبا
.ترجمة مرحبا فرنسي
.ترجمة hello عربي`;
}

module.exports = {
    commands: ['.ترجمة', '.لغات'],
    async execute(sock, msg, from, text) {
        try {
            const input = text.trim();
            const parts = input.split(' ');
            const cmd = parts[0];

            // .لغات
            if (cmd === '.لغات') {
                await sock.sendMessage(from, { react: { text: '🌍', key: msg.key } });
                await sock.sendMessage(from, { text: getLangsMessage() }, { quoted: msg });
                return;
            }

            // .ترجمة
            if (parts.length < 2) {
                await sock.sendMessage(from, { text: '❌ اكتب نص للترجمة.\nمثال: .ترجمة مرحبا' }, { quoted: msg });
                return;
            }

            // نشوف لو آخر كلمة لغة
            const lastWord = parts[parts.length - 1];
            let targetLangCode = null;
            let targetLangName = null;
            let textToTranslate = '';

            if (languages[lastWord] && parts.length > 2) {
                targetLangCode = languages[lastWord];
                targetLangName = lastWord;
                textToTranslate = parts.slice(1, -1).join(' ');
            } else {
                textToTranslate = parts.slice(1).join(' ');
                // تلقائي: دايماً لعربي
                targetLangCode = 'ar';
                targetLangName = 'عربي';
            }

            await sock.sendMessage(from, { react: { text: '⏳', key: msg.key } });

            const translated = await fetchTranslate(textToTranslate, 'auto', targetLangCode);

            await sock.sendMessage(from, { react: { text: '🌍', key: msg.key } });
            await sock.sendMessage(from, { text: translated }, { quoted: msg });

        } catch (e) {
            console.error('translate error:', e.message);
            await sock.sendMessage(from, { text: '❌ حدث خطأ في الترجمة، حاول مرة أخرى.' }, { quoted: msg });
        }
    }
};