const https = require('https');

// ========================
// الكتب المتاحة
// ========================
const books = {
    'البخاري':  { id: 'ara-bukhari',  min: 1,  max: 7563, name: 'صحيح البخاري' },
    'مسلم':     { id: 'ara-muslim',   min: 91, max: 7470, name: 'صحيح مسلم' },
    'ابو داود': { id: 'ara-abudawud', min: 1,  max: 5274, name: 'سنن أبي داود' },
    'الترمذي':  { id: 'ara-tirmidhi', min: 1,  max: 3956, name: 'سنن الترمذي' },
    'النسائي':  { id: 'ara-nasai',    min: 1,  max: 5758, name: 'سنن النسائي' },
    'ابن ماجه': { id: 'ara-ibnmajah', min: 1,  max: 4341, name: 'سنن ابن ماجه' },
    'مالك':     { id: 'ara-malik',    min: 1,  max: 1832, name: 'موطأ مالك' },
    'احمد':     { id: 'ara-ahmad',    min: 1,  max: 4341, name: 'مسند أحمد' },
};

// ========================
// ranges الأحاديث لكل تصنيف
// ========================
const categories = {
    'عقيدة': [
        { book: 'ara-bukhari',  ranges: [[1,50],[6982,7000],[3809,3830],[4477,4500],[5827,5840]] },
        { book: 'ara-muslim',   ranges: [[223,270],[300,350]] },
        { book: 'ara-tirmidhi', ranges: [[2090,2130],[2605,2640]] },
        { book: 'ara-ibnmajah', ranges: [[60,100],[3819,3840]] },
    ],
    'عبادات': [
        { book: 'ara-bukhari',  ranges: [[352,400],[1891,1940],[528,570]] },
        { book: 'ara-muslim',   ranges: [[400,450],[1080,1130],[580,620]] },
        { book: 'ara-abudawud', ranges: [[56,100],[726,770],[1512,1550]] },
        { book: 'ara-nasai',    ranges: [[458,500],[2105,2140]] },
    ],
    'دعاء وذكر': [
        { book: 'ara-bukhari',  ranges: [[6306,6360],[6382,6420]] },
        { book: 'ara-muslim',   ranges: [[2676,2730],[2731,2760]] },
        { book: 'ara-abudawud', ranges: [[1480,1530],[5062,5100]] },
        { book: 'ara-tirmidhi', ranges: [[3370,3420],[3522,3560]] },
    ],
    'معاملات': [
        { book: 'ara-bukhari',  ranges: [[2079,2130],[2165,2200]] },
        { book: 'ara-muslim',   ranges: [[1531,1580],[1595,1630]] },
        { book: 'ara-abudawud', ranges: [[3326,3370],[3440,3480]] },
        { book: 'ara-ibnmajah', ranges: [[2145,2190],[2230,2270]] },
    ],
    'أسرة': [
        { book: 'ara-bukhari',  ranges: [[5063,5110],[5518,5560],[5971,6010]] },
        { book: 'ara-muslim',   ranges: [[1400,1450],[2730,2760]] },
        { book: 'ara-abudawud', ranges: [[2047,2090],[2136,2170]] },
        { book: 'ara-tirmidhi', ranges: [[1080,1120],[1141,1170]] },
    ],
    'أخلاق': [
        { book: 'ara-bukhari',  ranges: [[6018,6070],[6100,6140]] },
        { book: 'ara-muslim',   ranges: [[2553,2600],[2607,2640]] },
        { book: 'ara-tirmidhi', ranges: [[1921,1960],[2000,2040]] },
        { book: 'ara-abudawud', ranges: [[4785,4830],[4941,4970]] },
    ],
    'آداب': [
        { book: 'ara-bukhari',  ranges: [[5376,5420],[5440,5480]] },
        { book: 'ara-muslim',   ranges: [[2010,2060],[2155,2190]] },
        { book: 'ara-abudawud', ranges: [[5223,5260],[5190,5220]] },
        { book: 'ara-tirmidhi', ranges: [[2690,2730],[2800,2840]] },
    ],
    'جهاد': [
        { book: 'ara-bukhari',  ranges: [[2787,2840],[2900,2940]] },
        { book: 'ara-muslim',   ranges: [[1876,1920],[1940,1980]] },
        { book: 'ara-abudawud', ranges: [[2503,2550],[2631,2660]] },
        { book: 'ara-tirmidhi', ranges: [[1619,1660],[1700,1730]] },
    ],
    'طب': [
        { book: 'ara-bukhari',  ranges: [[5678,5730],[5740,5780]] },
        { book: 'ara-muslim',   ranges: [[2204,2250],[2189,2203]] },
        { book: 'ara-abudawud', ranges: [[3874,3920],[3855,3873]] },
        { book: 'ara-tirmidhi', ranges: [[2036,2080],[2111,2140]] },
    ],
    'فضائل': [
        { book: 'ara-bukhari',  ranges: [[5027,5080],[3756,3800]] },
        { book: 'ara-muslim',   ranges: [[798,840],[2699,2730]] },
        { book: 'ara-tirmidhi', ranges: [[2312,2360],[3835,3870]] },
        { book: 'ara-ibnmajah', ranges: [[211,250],[3793,3820]] },
    ],
    'قصص': [
        { book: 'ara-bukhari',  ranges: [[3275,3330],[3364,3410]] },
        { book: 'ara-muslim',   ranges: [[2370,2420],[2425,2460]] },
        { book: 'ara-abudawud', ranges: [[4686,4720]] },
        { book: 'ara-tirmidhi', ranges: [[3120,3160],[3230,3270]] },
    ],
};

const categoryLabels = {
    'عقيدة':     '🕌 أحاديث العقيدة',
    'عبادات':    '🙏 أحاديث العبادات',
    'دعاء وذكر': '📿 أحاديث الدعاء والذكر',
    'معاملات':   '🤝 أحاديث المعاملات',
    'أسرة':      '👨‍👩‍👧 أحاديث الأسرة',
    'أخلاق':     '💎 أحاديث الأخلاق',
    'آداب':      '✨ أحاديث الآداب',
    'جهاد':      '⚔️ أحاديث الجهاد',
    'طب':        '🌿 أحاديث الطب النبوي',
    'فضائل':     '🌟 أحاديث الفضائل',
    'قصص':      '📖 أحاديث القصص والسير'
};

// حفظ نتائج البحث
const searchSessions = new Map();

// ========================
// دوال مساعدة
// ========================
function fetchJSON(url) {
    return new Promise((resolve, reject) => {
        https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try { resolve(JSON.parse(data)); }
                catch (e) { reject(new Error('parse error')); }
            });
        }).on('error', reject);
    });
}

function randBetween(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getDegreeIcon(degree) {
    if (!degree) return '';
    if (degree.includes('صحيح')) return '✅';
    if (degree.includes('حسن')) return '🟡';
    if (degree.includes('ضعيف')) return '🔴';
    return '📌';
}

// استخراج الراوي ومتن الحديث من النص
function extractNarratorAndText(fullText) {
    if (!fullText) return { narrator: null, text: fullText };

    const narrators = [
        'أبو هريرة', 'ابن عمر', 'ابن عباس', 'ابن مسعود',
        'عائشة', 'أنس بن مالك', 'عمر بن الخطاب', 'علي بن أبي طالب',
        'أبو بكر الصديق', 'عثمان بن عفان', 'معاذ بن جبل', 'أبو ذر',
        'أبو موسى الأشعري', 'أبو سعيد الخدري', 'جابر بن عبدالله',
        'عبدالله بن عمرو', 'بريدة', 'سهل بن سعد', 'أبو أمامة',
        'واثلة بن الأسقع', 'عقبة بن عامر', 'عبادة بن الصامت',
        'أبو الدرداء', 'النعمان بن بشير', 'حذيفة بن اليمان',
        'سلمان الفارسي', 'عمران بن حصين', 'أم سلمة', 'أم حبيبة',
        'ميمونة', 'حفصة', 'زينب بنت جحش', 'فاطمة', 'أسماء بنت أبي بكر',
    ];

    let narrator = null;
    let text = fullText;

    // نبحث عن اسم الراوي
    for (const name of narrators) {
        if (fullText.includes(name)) {
            narrator = name;
            break;
        }
    }

    // نشيل السند كله ونبقي المتن فقط
    // السند بيكون قبل "قال رسول الله" أو "أن النبي قال" أو بين علامات التنصيص
    const patterns = [
        // متن بين علامات تنصيص بعد ذكر النبي
        /(?:قَالَ|يَقُولُ)\s*[":«]\s*["\s«]*([\u0600-\u06FF][^"»]{20,})[»"]*/s,
        // نص بعد "أن رسول الله قال"
        /أَنَّ رَسُولَ اللَّهِ[^"«]*[":«]\s*["\s«]*([\u0600-\u06FF].{20,})/s,
        // نص بعد "قال رسول الله"  
        /قَالَ رَسُولُ اللَّهِ[^"«]*[":«]\s*["\s«]*([\u0600-\u06FF].{20,})/s,
        // نص بعد "يقول النبي"
        /يَقُولُ النَّبِيُّ[^"«]*[":«]\s*["\s«]*([\u0600-\u06FF].{20,})/s,
        // أي نص بين علامات تنصيص
        /[«"]([\u0600-\u06FF][^"»«]{20,})[»"]/s,
    ];

    for (const pattern of patterns) {
        const match = fullText.match(pattern);
        if (match && match[1]) {
            const extracted = match[1].replace(/[»""«]/g, '').trim();
            if (extracted.length > 20) {
                text = extracted;
                break;
            }
        }
    }

    // لو مفيش علامات تنصيص نشيل السند يدوياً
    // السند بيبدأ بـ "حدثنا" أو "أخبرنا" وينتهي عند "قال"
    if (text === fullText) {
        const snadEnd = fullText.search(/أَنَّ النَّبِيَّ|أَنَّ رَسُولَ|قَالَ رَسُولُ|يَقُولُ رَسُولُ/);
        if (snadEnd > 0) {
            text = fullText.substring(snadEnd).trim();
        }
    }

    return { narrator, text };
}

function formatHadith(hadith, label) {
    const { narrator, text } = extractNarratorAndText(hadith.text);
    const degIcon = getDegreeIcon(hadith.degree);

    let msg = `${label}\n───────────────────\n\n`;

    if (narrator) {
        msg += `👤 *عن ${narrator} رضي الله عنه:*\n`;
        msg += `أن رسول الله ﷺ قال:\n\n`;
    }

    msg += `❝\n${text}\n❞\n\n`;
    msg += `───────────────────\n`;
    msg += `📖 *${hadith.bookName}*\n`;
    msg += `🔢 *رقم:* ${hadith.num}`;
    if (hadith.degree) msg += `\n${degIcon} *الدرجة:* ${hadith.degree}`;

    return msg.trim();
}

function getPreview(text, maxLen = 70) {
    const { text: clean } = extractNarratorAndText(text);
    const trimmed = clean.replace(/\s+/g, ' ').trim();
    return trimmed.length > maxLen ? trimmed.substring(0, maxLen) + '...' : trimmed;
}

async function getHadithByNum(bookId, num) {
    const url = `https://cdn.jsdelivr.net/gh/fawazahmed0/hadith-api@1/editions/${bookId}/${num}.json`;
    try {
        const data = await fetchJSON(url);
        if (!data) return null;
        let hadith;
        if (data.hadiths && data.hadiths.length > 0) hadith = data.hadiths[0];
        else if (data.text) hadith = data;
        else return null;
        const text = hadith.text?.trim();
        if (!text || text.length < 20) return null;
        const grades = hadith.grades || [];
        const degree = grades.length > 0 ? grades[0]?.grade || '' : '';
        return { text, num, degree };
    } catch (e) {
        return null;
    }
}

async function searchInBook(bookId, bookName, keyword, degreeFilter, count = 10) {
    const bookInfo = Object.values(books).find(b => b.id === bookId);
    if (!bookInfo) return [];

    const results = [];
    const tried = new Set();
    let attempts = 0;
    const maxAttempts = 100;

    while (results.length < count && attempts < maxAttempts) {
        const num = randBetween(bookInfo.min, bookInfo.max);
        if (tried.has(num)) { attempts++; continue; }
        tried.add(num);
        attempts++;

        const h = await getHadithByNum(bookId, num);
        if (!h || !h.text) continue;
        if (!h.text.includes(keyword)) continue;

        if (degreeFilter) {
            const deg = h.degree?.toLowerCase() || '';
            if (!deg.includes(degreeFilter)) continue;
        }

        results.push({ ...h, bookName });
    }
    return results;
}

// ========================
// رسائل المساعدة
// ========================
function getHelpMessage() {
    return `*〘 📚 قائمة أوامر الأحاديث 〙*

*✎╎🕌 ⇠〘 .حديث عقيدة 〙*
*⏎* أحاديث العقيدة والإيمان

*✎╎🙏 ⇠〘 .حديث عبادات 〙*
*⏎* أحاديث الصلاة والصيام والزكاة

*✎╎📿 ⇠〘 .حديث دعاء وذكر 〙*
*⏎* أحاديث الدعاء والأذكار

*✎╎🤝 ⇠〘 .حديث معاملات 〙*
*⏎* أحاديث البيع والأمانة

*✎╎👨‍👩‍👧 ⇠〘 .حديث أسرة 〙*
*⏎* أحاديث الزواج والأولاد والوالدين

*✎╎💎 ⇠〘 .حديث أخلاق 〙*
*⏎* أحاديث الصدق والحياء والخلق

*✎╎✨ ⇠〘 .حديث آداب 〙*
*⏎* أحاديث الطعام والنوم واللباس

*✎╎⚔️ ⇠〘 .حديث جهاد 〙*
*⏎* أحاديث الجهاد والشهادة

*✎╎🌿 ⇠〘 .حديث طب 〙*
*⏎* أحاديث الطب النبوي والرقية

*✎╎🌟 ⇠〘 .حديث فضائل 〙*
*⏎* أحاديث فضل الأعمال والقرآن

*✎╎📖 ⇠〘 .حديث قصص 〙*
*⏎* أحاديث الأنبياء والسيرة

┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄
*✎╎📚 ⇠〘 .حديث 〙*
*⏎* حديث عشوائي من كل الكتب

*✎╎🔢 ⇠〘 .حديث 9 البخاري 〙*
*⏎* حديث برقم محدد من كتاب محدد

*✎╎🔍 ⇠〘 .حديث بحث (كلمة) 〙*
*⏎* بحث في كل الكتب

*✎╎🔍 ⇠〘 .حديث بحث (كلمة) (كتاب) 〙*
*⏎* بحث في كتاب محدد

*✎╎🔍 ⇠〘 .حديث بحث (كلمة) (درجة) 〙*
*⏎* بحث بدرجة محددة

*✎╎🔍 ⇠〘 .حديث بحث (كلمة) (كتاب) (درجة) 〙*
*⏎* بحث في كتاب بدرجة محددة

┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄
الكتب: البخاري ┊ مسلم ┊ ابو داود
الترمذي ┊ النسائي ┊ ابن ماجه
مالك ┊ احمد

الدرجات: صحيح ┊ حسن ┊ ضعيف`;
}

async function handleSearch(sock, msg, from, keyword, bookFilter, degreeFilter) {
    await sock.sendMessage(from, { react: { text: '🔍', key: msg.key } });
    await sock.sendMessage(from, { text: `🔍 جاري البحث عن *"${keyword}"*...` }, { quoted: msg });

    let searchBooks = [];

    if (bookFilter) {
        const bookData = books[bookFilter];
        if (!bookData) {
            await sock.sendMessage(from, {
                text: `❌ الكتاب غير موجود.\n\nالكتب المتاحة:\nالبخاري ┊ مسلم ┊ ابو داود ┊ الترمذي ┊ النسائي ┊ ابن ماجه ┊ مالك ┊ احمد`
            }, { quoted: msg });
            return;
        }
        searchBooks = [{ id: bookData.id, name: bookData.name }];
    } else {
        searchBooks = Object.values(books).map(b => ({ id: b.id, name: b.name }));
    }

    const allResults = [];
    for (const b of searchBooks) {
        if (allResults.length >= 10) break;
        const needed = 10 - allResults.length;
        const res = await searchInBook(b.id, b.name, keyword, degreeFilter, needed);
        allResults.push(...res);
    }

    if (allResults.length === 0) {
        await sock.sendMessage(from, {
            text: `❌ لم يتم العثور على نتائج لـ *"${keyword}"*\nجرب كلمة أخرى أو كتاب آخر.`
        }, { quoted: msg });
        return;
    }

    searchSessions.set(from, { results: allResults, keyword });
    setTimeout(() => searchSessions.delete(from), 5 * 60 * 1000);

    const nums = ['1️⃣','2️⃣','3️⃣','4️⃣','5️⃣','6️⃣','7️⃣','8️⃣','9️⃣','🔟'];
    let message = `🔍 *نتائج البحث: "${keyword}"*\n`;
    if (degreeFilter) message += `🔎 *الدرجة:* ${degreeFilter}\n`;
    if (bookFilter) message += `📚 *الكتاب:* ${books[bookFilter]?.name}\n`;
    message += `───────────────────\n\n`;

    allResults.forEach((h, i) => {
        const degIcon = getDegreeIcon(h.degree);
        message += `${nums[i]} *${h.bookName} - رقم ${h.num}*\n`;
        if (h.degree) message += `${degIcon} ${h.degree}\n`;
        message += `${getPreview(h.text)}\n\n`;
    });

    message += `───────────────────\n💡 اكتب رقم من 1 لـ ${allResults.length} لقراءة الحديث كامل\n🔄 اكتب الأمر تاني لنتائج مختلفة`;

    await sock.sendMessage(from, { react: { text: '📚', key: msg.key } });
    await sock.sendMessage(from, { text: message }, { quoted: msg });
}

// ========================
// module.exports
// ========================
module.exports = {
    commands: ['.حديث', '.أحاديث'],
    async execute(sock, msg, from, text) {
        try {
            const input = text.trim();
            const parts = input.split(' ');
            const cmd = parts[0];

            // .أحاديث
            if (cmd === '.أحاديث') {
                await sock.sendMessage(from, { react: { text: '📚', key: msg.key } });
                await sock.sendMessage(from, { text: getHelpMessage() }, { quoted: msg });
                return;
            }

            // اختيار رقم من نتائج البحث
            const session = searchSessions.get(from);
            if (session && /^[1-9]$|^10$/.test(input)) {
                const index = parseInt(input) - 1;
                if (index >= 0 && index < session.results.length) {
                    const hadith = session.results[index];
                    const label = `🔍 نتيجة البحث: "${session.keyword}"`;
                    const message = formatHadith(hadith, label);
                    await sock.sendMessage(from, { react: { text: '📚', key: msg.key } });
                    await sock.sendMessage(from, { text: message }, { quoted: msg });
                    return;
                }
            }

            // .حديث بحث (كلمة) (كتاب؟) (درجة؟)
            if (parts[1] === 'بحث') {
                if (!parts[2]) {
                    await sock.sendMessage(from, { text: '❌ اكتب كلمة للبحث.\nمثال: .حديث بحث الصلاة' }, { quoted: msg });
                    return;
                }
                const keyword = parts[2];
                let bookFilter = null;
                let degreeFilter = null;
                const degrees = ['صحيح', 'حسن', 'ضعيف'];

                if (parts[3]) {
                    if (degrees.includes(parts[3])) degreeFilter = parts[3];
                    else if (books[parts[3]]) bookFilter = parts[3];
                }
                if (parts[4] && degrees.includes(parts[4])) degreeFilter = parts[4];

                await handleSearch(sock, msg, from, keyword, bookFilter, degreeFilter);
                return;
            }

            // .حديث 9 البخاري
            if (parts.length === 3 && !isNaN(parts[1]) && books[parts[2]]) {
                const num = parseInt(parts[1]);
                const bookData = books[parts[2]];
                if (num < bookData.min || num > bookData.max) {
                    await sock.sendMessage(from, {
                        text: `❌ رقم الحديث خارج النطاق.\n${bookData.name} من ${bookData.min} إلى ${bookData.max}`
                    }, { quoted: msg });
                    return;
                }
                await sock.sendMessage(from, { react: { text: '⏳', key: msg.key } });
                const h = await getHadithByNum(bookData.id, num);
                if (!h) {
                    await sock.sendMessage(from, { text: '❌ لم يتم العثور على الحديث.' }, { quoted: msg });
                    return;
                }
                const label = `📚 أحاديث ${bookData.name}`;
                const message = formatHadith({ ...h, bookName: bookData.name }, label);
                await sock.sendMessage(from, { react: { text: '📚', key: msg.key } });
                await sock.sendMessage(from, { text: message }, { quoted: msg });
                return;
            }

            // .حديث (تصنيف) أو .حديث عشوائي
            const categoryKey = parts.slice(1).join(' ').trim() || null;

            if (categoryKey && !categories[categoryKey]) {
                await sock.sendMessage(from, { text: getHelpMessage() }, { quoted: msg });
                return;
            }

            await sock.sendMessage(from, { react: { text: '⏳', key: msg.key } });

            let hadith = null;
            let bookName = '';
            let label = '📚 حديث عشوائي';

            if (categoryKey) {
                const cat = categories[categoryKey];
                label = categoryLabels[categoryKey];
                for (let attempt = 0; attempt < 5; attempt++) {
                    const bookData = cat[Math.floor(Math.random() * cat.length)];
                    const range = bookData.ranges[Math.floor(Math.random() * bookData.ranges.length)];
                    const num = randBetween(range[0], range[1]);
                    bookName = Object.values(books).find(b => b.id === bookData.book)?.name || bookData.book;
                    hadith = await getHadithByNum(bookData.book, num);
                    if (hadith) break;
                }
            } else {
                const bookKeys = Object.keys(books);
                for (let attempt = 0; attempt < 5; attempt++) {
                    const randomBook = books[bookKeys[Math.floor(Math.random() * bookKeys.length)]];
                    const num = randBetween(randomBook.min, randomBook.max);
                    hadith = await getHadithByNum(randomBook.id, num);
                    if (hadith) { bookName = randomBook.name; break; }
                }
            }

            if (!hadith) {
                await sock.sendMessage(from, { text: '❌ لم يتم العثور على حديث، حاول مرة أخرى.' }, { quoted: msg });
                return;
            }

            const message = formatHadith({ ...hadith, bookName }, label);
            await sock.sendMessage(from, { react: { text: '📚', key: msg.key } });
            await sock.sendMessage(from, { text: message }, { quoted: msg });

        } catch (e) {
            console.error('hadith error:', e.message);
            await sock.sendMessage(from, { text: '❌ حدث خطأ، حاول مرة أخرى.' }, { quoted: msg });
        }
    }
};