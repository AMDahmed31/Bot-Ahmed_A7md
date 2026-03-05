const https = require('https');
const { getReciterImage } = require('./quran_images');

const surahs = [
    'الفاتحة','البقرة','آل عمران','النساء','المائدة','الأنعام','الأعراف','الأنفال',
    'التوبة','يونس','هود','يوسف','الرعد','إبراهيم','الحجر','النحل',
    'الإسراء','الكهف','مريم','طه','الأنبياء','الحج','المؤمنون','النور',
    'الفرقان','الشعراء','النمل','القصص','العنكبوت','الروم','لقمان','السجدة',
    'الأحزاب','سبأ','فاطر','يس','الصافات','ص','الزمر','غافر',
    'فصلت','الشورى','الزخرف','الدخان','الجاثية','الأحقاف','محمد','الفتح',
    'الحجرات','ق','الذاريات','الطور','النجم','القمر','الرحمن','الواقعة',
    'الحديد','المجادلة','الحشر','الممتحنة','الصف','الجمعة','المنافقون','التغابن',
    'الطلاق','التحريم','الملك','القلم','الحاقة','المعارج','نوح','الجن',
    'المزمل','المدثر','القيامة','الإنسان','المرسلات','النبأ','النازعات','عبس',
    'التكوير','الانفطار','المطففين','الانشقاق','البروج','الطارق','الأعلى','الغاشية',
    'الفجر','البلد','الشمس','الليل','الضحى','الشرح','التين','العلق',
    'القدر','البينة','الزلزلة','العاديات','القارعة','التكاثر','العصر','الهمزة',
    'الفيل','قريش','الماعون','الكوثر','الكافرون','النصر','المسد','الإخلاص',
    'الفلق','الناس'
];

const famousNames = [
    'محمود خليل الحصري','محمد صديق المنشاوي','عبد الباسط عبد الصمد',
    'مصطفى إسماعيل','محمد الطبلاوي','مشاري راشد العفاسي',
    'عبدالرحمن السديس','سعود الشريم','ماهر المعيقلي','سعد الغامدي',
    'ياسر الدوسري','ناصر القطامي','محمد أيوب','أحمد خليل شاهين','راغب مصطفى غلوش'
];

const sessions = new Map();
function setSession(id, data) {
    sessions.set(id, data);
    setTimeout(() => sessions.delete(id), 15 * 60 * 1000);
}

let orderedReciters = null;
let recitersLastFetch = 0;

function fetchJSON(url) {
    return new Promise((resolve, reject) => {
        const req = https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 10000 }, (res) => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => { try { resolve(JSON.parse(data)); } catch(e) { reject(e); } });
        });
        req.on('error', reject);
        req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    });
}

function downloadBuffer(url, hop = 0) {
    if (hop > 5) return Promise.reject(new Error('تحويلات كثيرة'));
    return new Promise((resolve, reject) => {
        const chunks = [];
        const req = https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
            if ([301, 302, 307, 308].includes(res.statusCode) && res.headers.location)
                return downloadBuffer(res.headers.location, hop + 1).then(resolve).catch(reject);
            if (res.statusCode !== 200)
                return reject(new Error(`خطأ ${res.statusCode}`));
            res.on('data', c => chunks.push(c));
            res.on('end', () => resolve(Buffer.concat(chunks)));
        });
        req.on('error', reject);
        req.setTimeout(90000, () => { req.destroy(); reject(new Error('انتهت المهلة')); });
    });
}

async function getReciters() {
    const now = Date.now();
    if (orderedReciters && now - recitersLastFetch < 60 * 60 * 1000) return orderedReciters;
    try {
        const data = await fetchJSON('https://www.mp3quran.net/api/v3/reciters?language=ar');
        const all = data.reciters || [];
        const famous = [];
        famousNames.forEach(name => {
            const found = all.find(r => r.name === name);
            if (found) famous.push(found);
        });
        const rest = all.filter(r => !famousNames.includes(r.name)).sort((a, b) => a.name.localeCompare(b.name, 'ar'));
        orderedReciters = [...famous, ...rest];
        recitersLastFetch = now;
        return orderedReciters;
    } catch (e) {
        console.error('⚠️ فشل API mp3quran:', e.message);
        return orderedReciters || [];
    }
}

function boldNum(n) {
    const map = {'0':'𝟎','1':'𝟏','2':'𝟐','3':'𝟑','4':'𝟒','5':'𝟓','6':'𝟔','7':'𝟕','8':'𝟖','9':'𝟗'};
    return '【' + String(n).split('').map(c => map[c]).join('') + '】';
}

function searchReciters(reciters, query) {
    const q = query.trim();
    // 1. بحث بكل الكلمات
    const words = q.split(/\s+/).filter(w => w.length > 0);
    let result = reciters.filter(r => words.every(w => r.name.includes(w)));
    if (result.length) return result;
    // 2. بحث بأي كلمة (أكثر من حرفين)
    const longWords = words.filter(w => w.length > 2);
    if (longWords.length) {
        result = reciters.filter(r => longWords.some(w => r.name.includes(w)));
        if (result.length) return result;
    }
    // 3. بحث بالاسم كاملاً
    return reciters.filter(r => r.name.includes(q) || q.includes(r.name.split(' ')[0]));
}

function searchMoshaf(moshafs, query) {
    return moshafs.filter(m => m.name.includes(query) || query.includes(m.name.split(/[\s-]/)[0]));
}

function buildCommandsMenu() {
    let msg = '*˼🕌˹ قـسـم الـقـرآن الـكـريـم╿↶*\n';
    msg += '━ ── • ⟐ • ── ━\n\n';
    msg += '📋 *قائمة الأوامر*\n\n';
    msg += '▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰\n\n';
    msg += '❝ .قرآن ❞\n↫ عرض قائمة القراء\n\n';
    msg += '❝ .قرآن (سورة) ❞\n↫ اختيار قارئ لسورة\n\n';
    msg += '❝ .قرآن (سورة) (قارئ) ❞\n↫ تشغيل مباشر\n\n';
    msg += '❝ .قرآن (سورة) (قارئ) - (مصحف) ❞\n↫ مصحف محدد\n\n';
    msg += '❝ .قارئ (رقم) ❞\n↫ اختيار قارئ برقمه\n\n';
    msg += '❝ .قراء (سورة) ❞\n↫ كل قراء السورة\n\n';
    msg += '❝ .راديو ❞\n↫ بث مكة والمدينة ومصر\n\n';
    msg += '▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰\n\n';
    msg += '         ✦ قُـرْآنٌ كَـرِيـمٌ ✦';
    return msg;
}

function buildRecitersMenu(reciters) {
    let msg = '*˼🕌˹ قـائـمـة الـقـراء╿↶*\n';
    msg += '━ ── • ⟐ • ── ━\n\n';
    msg += '╰── *اكتب: .قارئ (رقم)* ──╯\n\n';
    msg += '▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰\n\n';
    const nums = ['❶','❷','❸','❹','❺','❻','❼','❽','❾','❿','⓫','⓬','⓭','⓮','⓯'];
    msg += '⭐ ❰ *القراء المشهورون* ❱\n';
    msg += '┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈\n';
    const famous = reciters.slice(0, famousNames.length);
    let line = '';
    famous.forEach((r, i) => {
        line += `${nums[i]} ${r.name}          `;
        if ((i + 1) % 2 === 0) { msg += line.trim() + '\n'; line = ''; }
    });
    if (line.trim()) msg += line.trim() + '\n';
    msg += '\n▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰\n\n';
    msg += '📖 ❰ *باقي القراء* ❱\n';
    msg += '┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈\n';
    const rest = reciters.slice(famousNames.length);
    let currentLetter = '';
    let restLine = '';
    let lineCount = 0;
    rest.forEach((r, i) => {
        const letter = r.name[0];
        if (letter !== currentLetter) {
            if (restLine.trim()) { msg += restLine.trim() + '\n'; restLine = ''; lineCount = 0; }
            currentLetter = letter;
            msg += `\n─── ${letter} ───\n`;
        }
        restLine += `${boldNum(famousNames.length + i + 1)} ${r.name}          `;
        lineCount++;
        if (lineCount % 2 === 0) { msg += restLine.trim() + '\n'; restLine = ''; lineCount = 0; }
    });
    if (restLine.trim()) msg += restLine.trim() + '\n';
    msg += '\n▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰\n\n';
    msg += '╰── *اكتب: .قارئ (رقم)* ──╯';
    return msg;
}

function buildSurahsMenu(reciter, moshaf) {
    const available = moshaf.surah_list.split(',').map(Number);
    let msg = '*˼📖˹ اختـار السـورة╿↶*\n';
    msg += '━ ── • ⟐ • ── ━\n\n';
    msg += `🎙️ *${reciter.name}*\n`;
    msg += `📖 *${moshaf.name}*\n\n`;
    msg += '╰── *اكتب: .سورة (رقم)* ──╯\n\n';
    msg += '━ ── • ⟐ • ── ━\n\n';
    let line = '';
    let count = 0;
    surahs.forEach((s, i) => {
        if (!available.includes(i + 1)) return;
        line += `${boldNum(i + 1)} ${s}          `;
        count++;
        if (count % 2 === 0) { msg += line.trim() + '\n'; line = ''; }
    });
    if (line.trim()) msg += line.trim() + '\n';
    msg += '\n━ ── • ⟐ • ── ━\n';
    msg += '╰── *اكتب: .سورة (رقم)* ──╯';
    return msg;
}

function buildMoshafMenu(reciter) {
    let msg = `*˼🕌˹ اختـار الـمصحف╿↶*\n`;
    msg += '━ ── • ⟐ • ── ━\n\n';
    msg += `🎙️ *${reciter.name}*\n\n`;
    msg += '╰── *اكتب: .مصحف (رقم)* ──╯\n\n';
    reciter.moshaf.forEach((m, i) => { msg += `${boldNum(i + 1)} ${m.name}\n\n`; });
    msg += '━ ── • ⟐ • ── ━\n';
    msg += '╰── *اكتب: .مصحف (رقم)* ──╯';
    return msg;
}

function buildChooseReciterMenu(reciters, surahIndex) {
    let msg = `*˼🎙️˹ اختـار القـارئ╿↶*\n`;
    msg += '━ ── • ⟐ • ── ━\n\n';
    if (surahIndex !== undefined) msg += `📖 *سورة ${surahs[surahIndex]}*\n\n`;
    msg += '╰── *رد على هذه الرسالة بالرقم* ──╯\n\n';
    reciters.forEach((r, i) => { msg += `${boldNum(i + 1)} ${r.name}\n\n`; });
    msg += '━ ── • ⟐ • ── ━\n';
    msg += '╰── *رد على هذه الرسالة بالرقم* ──╯';
    return msg;
}

// ========================
// إرسال الصوت
// 1. جيب صورة القارئ (محلي → Pexels) + أضف اللوجو
// 2. ابعت الصورة كرد على رسالة الأمر
// 3. ابعت الصوت كرد على الصورة
// ========================
async function sendAudio(sock, msg, from, reciter, moshaf, surahIndex) {
    const surahNum = String(surahIndex + 1).padStart(3, '0');
    const audioUrl = `${moshaf.server}${surahNum}.mp3`;

    await sock.sendMessage(from, { react: { text: '⬇️', key: msg.key } });

    try {
        const caption =
            `🕌 *سورة ${surahs[surahIndex]}*\n` +
            `🎙️ *${reciter.name}*\n` +
            `📖 *${moshaf.name}*\n\n` +
            `﷽\n` +
            `_بسم الله الرحمن الرحيم_`;

        // 1. جيب الصورة مع اللوجو
        const imageBuffer = await getReciterImage(reciter.name);

        let sentMsg;
        if (imageBuffer) {
            sentMsg = await sock.sendMessage(from, {
                image: imageBuffer,
                caption,
                mimetype: 'image/jpeg'
            }, { quoted: msg });
        } else {
            sentMsg = await sock.sendMessage(from, { text: caption }, { quoted: msg });
        }

        // 2. حمّل الصوت وابعته كرد على الصورة
        const audioBuffer = await downloadBuffer(audioUrl);
        await sock.sendMessage(from, { react: { text: '🕌', key: msg.key } });
        await sock.sendMessage(from, {
            audio: audioBuffer,
            mimetype: 'audio/mpeg',
            ptt: false
        }, { quoted: sentMsg });

    } catch (e) {
        await sock.sendMessage(from, { react: { text: '❌', key: msg.key } });
        await sock.sendMessage(from, { text: `❌ *${e.message}*\nجرب سورة أخرى.` }, { quoted: msg });
    }
}

module.exports = {
    commands: ['.قرآن', '.قران', '.القرآن الكريم', '.القرءان الكريم', '.القران الكريم', '.قارئ', '.سورة', '.مصحف', '.راديو', '.قراء'],

    async execute(sock, msg, from, text) {
        try {
            const input = text.trim();
            const parts = input.split(' ');
            const cmd = parts[0];
            const quotedId = msg.message?.extendedTextMessage?.contextInfo?.stanzaId;

            if (quotedId && sessions.has(quotedId)) {
                const state = sessions.get(quotedId);
                sessions.delete(quotedId);
                const numInput = parseInt(input.trim()) - 1;

                if (state.type === 'choose_reciter') {
                    if (isNaN(numInput) || numInput < 0 || numInput >= state.reciters.length) {
                        const m = await sock.sendMessage(from, { text: buildChooseReciterMenu(state.reciters, state.surahIndex) }, { quoted: msg });
                        setSession(m.key.id, state); return;
                    }
                    const reciter = state.reciters[numInput];
                    if (reciter.moshaf.length === 1) {
                        if (state.surahIndex !== undefined) return await sendAudio(sock, msg, from, reciter, reciter.moshaf[0], state.surahIndex);
                        const m = await sock.sendMessage(from, { text: buildSurahsMenu(reciter, reciter.moshaf[0]) }, { quoted: msg });
                        setSession(m.key.id, { type: 'surahs', reciter, moshaf: reciter.moshaf[0], from }); return;
                    }
                    const m = await sock.sendMessage(from, { text: buildMoshafMenu(reciter) }, { quoted: msg });
                    setSession(m.key.id, { type: 'moshaf', reciter, surahIndex: state.surahIndex, from }); return;
                }

                if (state.type === 'reciters') {
                    const reciters = await getReciters();
                    if (isNaN(numInput) || numInput < 0 || numInput >= reciters.length) {
                        await sock.sendMessage(from, { text: `❌ رقم غلط` }, { quoted: msg }); return;
                    }
                    const reciter = reciters[numInput];
                    if (reciter.moshaf.length === 1) {
                        if (state.surahIndex !== undefined) return await sendAudio(sock, msg, from, reciter, reciter.moshaf[0], state.surahIndex);
                        const m = await sock.sendMessage(from, { text: buildSurahsMenu(reciter, reciter.moshaf[0]) }, { quoted: msg });
                        setSession(m.key.id, { type: 'surahs', reciter, moshaf: reciter.moshaf[0], from }); return;
                    }
                    const m = await sock.sendMessage(from, { text: buildMoshafMenu(reciter) }, { quoted: msg });
                    setSession(m.key.id, { type: 'moshaf', reciter, surahIndex: state.surahIndex, from }); return;
                }

                if (state.type === 'moshaf') {
                    if (isNaN(numInput) || numInput < 0 || numInput >= state.reciter.moshaf.length) {
                        const m = await sock.sendMessage(from, { text: buildMoshafMenu(state.reciter) }, { quoted: msg });
                        setSession(m.key.id, state); return;
                    }
                    const moshaf = state.reciter.moshaf[numInput];
                    if (state.surahIndex !== undefined) return await sendAudio(sock, msg, from, state.reciter, moshaf, state.surahIndex);
                    const m = await sock.sendMessage(from, { text: buildSurahsMenu(state.reciter, moshaf) }, { quoted: msg });
                    setSession(m.key.id, { type: 'surahs', reciter: state.reciter, moshaf, from }); return;
                }

                if (state.type === 'surahs') {
                    if (isNaN(numInput) || numInput < 0 || numInput >= surahs.length) {
                        const m = await sock.sendMessage(from, { text: buildSurahsMenu(state.reciter, state.moshaf) }, { quoted: msg });
                        setSession(m.key.id, state); return;
                    }
                    return await sendAudio(sock, msg, from, state.reciter, state.moshaf, numInput);
                }
            }

            if (cmd === '.مصحف') {
                const num = parseInt(parts[1]) - 1;
                let foundState = null, foundKey = null;
                for (const [key, state] of sessions.entries()) {
                    if (state.type === 'moshaf' && state.from === from) { foundState = state; foundKey = key; break; }
                }
                if (!foundState) { await sock.sendMessage(from, { text: '❌ ابدأ بـ .قرآن الأول' }, { quoted: msg }); return; }
                sessions.delete(foundKey);
                if (isNaN(num) || num < 0 || num >= foundState.reciter.moshaf.length) {
                    const m = await sock.sendMessage(from, { text: buildMoshafMenu(foundState.reciter) }, { quoted: msg });
                    setSession(m.key.id, { ...foundState, from }); return;
                }
                const moshaf = foundState.reciter.moshaf[num];
                if (foundState.surahIndex !== undefined) return await sendAudio(sock, msg, from, foundState.reciter, moshaf, foundState.surahIndex);
                const m2 = await sock.sendMessage(from, { text: buildSurahsMenu(foundState.reciter, moshaf) }, { quoted: msg });
                setSession(m2.key.id, { type: 'surahs', reciter: foundState.reciter, moshaf, from }); return;
            }

            if (cmd === '.سورة') {
                const num = parseInt(parts[1]) - 1;
                let foundState = null, foundKey = null;
                for (const [key, state] of sessions.entries()) {
                    if (state.type === 'surahs' && state.from === from) { foundState = state; foundKey = key; break; }
                }
                if (!foundState) { await sock.sendMessage(from, { text: '❌ ابدأ بـ .قرآن الأول' }, { quoted: msg }); return; }
                sessions.delete(foundKey);
                if (isNaN(num) || num < 0 || num >= surahs.length) {
                    const m = await sock.sendMessage(from, { text: buildSurahsMenu(foundState.reciter, foundState.moshaf) }, { quoted: msg });
                    setSession(m.key.id, { ...foundState, from }); return;
                }
                return await sendAudio(sock, msg, from, foundState.reciter, foundState.moshaf, num);
            }

            if (cmd === '.راديو') {
                await sock.sendMessage(from, { react: { text: '📻', key: msg.key } });
                await sock.sendMessage(from, {
                    text:
                        `*˼📻˹ الراديو المباشر╿↶*\n━ ── • ⟐ • ── ━\n\n` +
                        `🕌 *إذاعة مكة المكرمة*\nhttps://Qurango.net/radio/makkah\n\n` +
                        `🕌 *إذاعة المدينة المنورة*\nhttps://Qurango.net/radio/madinah\n\n` +
                        `🇪🇬 *إذاعة القرآن الكريم - مصر*\nhttp://stream.radioegypt.net/quran\n\n` +
                        `━ ── • ⟐ • ── ━`
                }, { quoted: msg }); return;
            }

            if (cmd === '.قارئ') {
                const num = parseInt(parts[1]) - 1;
                const reciters = await getReciters();
                if (isNaN(num) || num < 0 || num >= reciters.length) {
                    await sock.sendMessage(from, { text: `❌ رقم غلط` }, { quoted: msg }); return;
                }
                const reciter = reciters[num];
                if (reciter.moshaf.length === 1) {
                    const m = await sock.sendMessage(from, { text: buildSurahsMenu(reciter, reciter.moshaf[0]) }, { quoted: msg });
                    setSession(m.key.id, { type: 'surahs', reciter, moshaf: reciter.moshaf[0], from }); return;
                }
                const m = await sock.sendMessage(from, { text: buildMoshafMenu(reciter) }, { quoted: msg });
                setSession(m.key.id, { type: 'moshaf', reciter, from }); return;
            }

            if (cmd === '.قراء') {
                const surahText = parts.slice(1).join(' ').trim();
                const surahIdx = surahs.findIndex(s => surahText.includes(s) || s.includes(surahText));
                if (surahIdx === -1) {
                    await sock.sendMessage(from, { text: '❌ اكتب اسم السورة صح.\nمثال: .قراء الفاتحة' }, { quoted: msg }); return;
                }
                await sock.sendMessage(from, { react: { text: '⏳', key: msg.key } });
                try {
                    const data = await fetchJSON(`https://www.mp3quran.net/api/v3/reciters?language=ar&sura=${surahIdx + 1}`);
                    const allReciters = data.reciters || [];
                    if (!allReciters.length) { await sock.sendMessage(from, { text: '❌ لا يوجد قراء لهذه السورة.' }, { quoted: msg }); return; }
                    const famousFirst = [];
                    famousNames.forEach(name => { const f = allReciters.find(r => r.name === name); if (f) famousFirst.push(f); });
                    const restReciters = allReciters.filter(r => !famousNames.includes(r.name)).sort((a, b) => a.name.localeCompare(b.name, 'ar'));
                    const nums = ['❶','❷','❸','❹','❺','❻','❼','❽','❾','❿','⓫','⓬','⓭','⓮','⓯'];
                    let message = `🎙️ *قراء سورة ${surahs[surahIdx]}*\n━ ── • ⟐ • ── ━\n\n`;
                    if (famousFirst.length) {
                        message += '⭐ *المشهورون*\n┈┈┈┈┈┈┈┈┈┈\n';
                        famousFirst.forEach((r, i) => { message += `${nums[i] || boldNum(i+1)} ${r.name}\n`; });
                        message += '\n📖 *باقي القراء*\n┈┈┈┈┈┈┈┈┈┈\n';
                    }
                    let currentLetter = '';
                    restReciters.forEach((r, i) => {
                        const letter = r.name[0];
                        if (letter !== currentLetter) { currentLetter = letter; message += `\n─── ${letter} ───\n`; }
                        message += `${boldNum(famousFirst.length + i + 1)} ${r.name}\n`;
                    });
                    await sock.sendMessage(from, { text: message }, { quoted: msg });
                } catch (e) {
                    await sock.sendMessage(from, { text: '❌ فشل جلب القراء، حاول مرة أخرى.' }, { quoted: msg });
                }
                return;
            }

            if (cmd === '.القرآن' || cmd === '.القرءان' || cmd === '.القران') {
                await sock.sendMessage(from, { text: buildCommandsMenu() }, { quoted: msg }); return;
            }

            await sock.sendMessage(from, { react: { text: '⏳', key: msg.key } });
            const reciters = await getReciters();
            const args = parts.slice(1).join(' ').trim();

            if (!args) {
                const m = await sock.sendMessage(from, { text: buildRecitersMenu(reciters) }, { quoted: msg });
                setSession(m.key.id, { type: 'reciters', from }); return;
            }

            let mainArgs = args;
            let moshafQuery = null;
            if (args.includes(' - ') || args.includes(' ـ ')) {
                const sep = args.includes(' - ') ? ' - ' : ' ـ ';
                const sepIdx = args.indexOf(sep);
                mainArgs = args.substring(0, sepIdx).trim();
                moshafQuery = args.substring(sepIdx + sep.length).trim();
            }

            const surahIdx = surahs.findIndex(s => mainArgs.includes(s));
            if (surahIdx === -1) {
                await sock.sendMessage(from, { text: '❌ السورة غير موجودة.\nمثال: .قرآن الفاتحة' }, { quoted: msg }); return;
            }

            const readerQuery = mainArgs.replace(surahs[surahIdx], '').trim();

            if (!readerQuery) {
                const m = await sock.sendMessage(from, { text: buildRecitersMenu(reciters) }, { quoted: msg });
                setSession(m.key.id, { type: 'reciters', surahIndex: surahIdx, from }); return;
            }

            const found = searchReciters(reciters, readerQuery);
            if (!found.length) {
                await sock.sendMessage(from, { text: `❌ القارئ غير موجود.\nجرب: .قراء ${surahs[surahIdx]}` }, { quoted: msg }); return;
            }

            if (found.length > 1) {
                const m = await sock.sendMessage(from, { text: buildChooseReciterMenu(found, surahIdx) }, { quoted: msg });
                setSession(m.key.id, { type: 'choose_reciter', reciters: found, surahIndex: surahIdx, moshafQuery, from }); return;
            }

            const reciter = found[0];
            if (moshafQuery) {
                const foundMoshaf = searchMoshaf(reciter.moshaf, moshafQuery);
                if (foundMoshaf.length === 1) return await sendAudio(sock, msg, from, reciter, foundMoshaf[0], surahIdx);
                if (foundMoshaf.length > 1) {
                    const m = await sock.sendMessage(from, { text: buildMoshafMenu({...reciter, moshaf: foundMoshaf}) }, { quoted: msg });
                    setSession(m.key.id, { type: 'moshaf', reciter, surahIndex: surahIdx, from }); return;
                }
                await sock.sendMessage(from, { text: `❌ المصحف "${moshafQuery}" غير موجود.` }, { quoted: msg }); return;
            }

            if (reciter.moshaf.length === 1) return await sendAudio(sock, msg, from, reciter, reciter.moshaf[0], surahIdx);
            const m = await sock.sendMessage(from, { text: buildMoshafMenu(reciter) }, { quoted: msg });
            setSession(m.key.id, { type: 'moshaf', reciter, surahIndex: surahIdx, from });

        } catch (e) {
            console.error('quran error:', e.message);
            await sock.sendMessage(from, { text: '❌ حدث خطأ، حاول مرة أخرى.' }, { quoted: msg });
        }
    }
};

