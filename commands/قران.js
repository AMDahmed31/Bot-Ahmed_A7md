const https = require('https');

const surahs = [
    'الفاتحة', 'البقرة', 'آل عمران', 'النساء', 'المائدة', 'الأنعام', 'الأعراف', 'الأنفال',
    'التوبة', 'يونس', 'هود', 'يوسف', 'الرعد', 'إبراهيم', 'الحجر', 'النحل',
    'الإسراء', 'الكهف', 'مريم', 'طه', 'الأنبياء', 'الحج', 'المؤمنون', 'النور',
    'الفرقان', 'الشعراء', 'النمل', 'القصص', 'العنكبوت', 'الروم', 'لقمان', 'السجدة',
    'الأحزاب', 'سبأ', 'فاطر', 'يس', 'الصافات', 'ص', 'الزمر', 'غافر',
    'فصلت', 'الشورى', 'الزخرف', 'الدخان', 'الجاثية', 'الأحقاف', 'محمد', 'الفتح',
    'الحجرات', 'ق', 'الذاريات', 'الطور', 'النجم', 'القمر', 'الرحمن', 'الواقعة',
    'الحديد', 'المجادلة', 'الحشر', 'الممتحنة', 'الصف', 'الجمعة', 'المنافقون', 'التغابن',
    'الطلاق', 'التحريم', 'الملك', 'القلم', 'الحاقة', 'المعارج', 'نوح', 'الجن',
    'المزمل', 'المدثر', 'القيامة', 'الإنسان', 'المرسلات', 'النبأ', 'النازعات', 'عبس',
    'التكوير', 'الانفطار', 'المطففين', 'الانشقاق', 'البروج', 'الطارق', 'الأعلى', 'الغاشية',
    'الفجر', 'البلد', 'الشمس', 'الليل', 'الضحى', 'الشرح', 'التين', 'العلق',
    'القدر', 'البينة', 'الزلزلة', 'العاديات', 'القارعة', 'التكاثر', 'العصر', 'الهمزة',
    'الفيل', 'قريش', 'الماعون', 'الكوثر', 'الكافرون', 'النصر', 'المسد', 'الإخلاص',
    'الفلق', 'الناس'
];

const readers = [
    { name: 'محمود خليل الحصري', path: 'mahmood_khaleel_al-husaree_with_qalon', keywords: ['الحصري', 'حصري'] },
    { name: 'عبد الباسط - مجود', path: 'abdulbaset_mujawwad', keywords: ['عبد الباسط مجود', 'باسط مجود'] },
    { name: 'عبد الباسط - مرتل', path: 'abdulbaset_murattal', keywords: ['عبد الباسط مرتل', 'باسط مرتل', 'عبد الباسط'] },
    { name: 'مشاري راشد العفاسي', path: 'mishaari_raashid_al_3afaasee', keywords: ['مشاري', 'العفاسي', 'عفاسي'] },
    { name: 'عبدالرحمن السديس', path: 'abdurrahmaan_as-sudays', keywords: ['السديس', 'سديس'] },
    { name: 'سعود الشريم', path: 'sa3ood_al-shuraym', keywords: ['الشريم', 'شريم'] },
    { name: 'محمد صديق المنشاوي - مرتل', path: 'muhammad_siddeeq_al-minshaawee', keywords: ['المنشاوي مرتل', 'منشاوي مرتل'] },
    { name: 'محمد صديق المنشاوي - مجود', path: 'minshawi_mujawwad', keywords: ['المنشاوي مجود', 'منشاوي مجود', 'المنشاوي', 'منشاوي'] },
    { name: 'سعد الغامدي', path: 'sa3d_al-ghaamidi', keywords: ['الغامدي', 'غامدي'] },
    { name: 'ماهر المعيقلي', path: 'maher_almuaiqly', keywords: ['المعيقلي', 'معيقلي', 'ماهر'] },
    { name: 'ياسر الدوسري', path: 'yasser_aldosari', keywords: ['الدوسري', 'دوسري', 'ياسر'] },
    { name: 'ناصر القطامي', path: 'nasser_alqatami', keywords: ['القطامي', 'قطامي'] },
    { name: 'أبو بكر الشاطري', path: 'abu_bakr_ash-shaatree', keywords: ['الشاطري', 'شاطري', 'أبو بكر'] },
    { name: 'محمد جبريل', path: 'muhammad_jibreel', keywords: ['جبريل'] },
    { name: 'أحمد العجمي', path: 'ahmed_ibn_3ali_al-3ajamy', keywords: ['العجمي', 'عجمي'] },
    { name: 'علي الحذيفي', path: 'huthayfi', keywords: ['الحذيفي', 'حذيفي'] },
    { name: 'عبد الباري الثبيتي', path: 'thubaity', keywords: ['الثبيتي', 'ثبيتي'] },
    { name: 'هاني الرفاعي', path: 'rifai', keywords: ['الرفاعي', 'رفاعي', 'هاني'] },
    { name: 'صلاح بوخاطر', path: 'salaah_bukhaatir', keywords: ['بوخاطر'] },
    { name: 'محمد أيوب', path: 'muhammad_ayyoob', keywords: ['أيوب'] },
    { name: 'خالد القحطاني', path: 'khaalid_al-qahtaanee', keywords: ['القحطاني', 'قحطاني'] },
    { name: 'عادل الكلباني', path: 'adel_alkhalbany', keywords: ['الكلباني', 'كلباني'] },
    { name: 'بندر بليلة', path: 'bandar_baleelah', keywords: ['بليلة', 'بندر'] },
    { name: 'عبدالله الجهني', path: 'abdullaah_3awwaad_al-juhaynee', keywords: ['الجهني', 'جهني'] },
];

// ========================
// Sessions
// ========================
const sessions = new Map();

function setSession(msgId, data) {
    sessions.set(msgId, data);
    setTimeout(() => sessions.delete(msgId), 10 * 60 * 1000);
}

// ========================
// بناء القوائم
// ========================
function buildReadersList() {
    let msg = `╔══════════════════════╗\n`;
    msg += `║   🎙️ *اختار القارئ*    ║\n`;
    msg += `╚══════════════════════╝\n\n`;
    readers.forEach((r, i) => {
        msg += `${i + 1}. ${r.name}\n`;
    });
    msg += `\n╰─── *رد برقم القارئ* ───╯`;
    return msg;
}

function buildSurahsList(readerName) {
    let msg = `╔══════════════════════╗\n`;
    msg += `║    📖 *اختار السورة*    ║\n`;
    msg += `╚══════════════════════╝\n\n`;
    msg += `🎙️ القارئ: *${readerName}*\n\n`;
    for (let i = 0; i < surahs.length; i += 2) {
        const left = `${String(i + 1).padStart(3)}. ${surahs[i]}`;
        const right = surahs[i + 1] ? `   ${String(i + 2).padStart(3)}. ${surahs[i + 1]}` : '';
        msg += `${left}${right}\n`;
    }
    msg += `\n╰─── *رد برقم السورة* ───╯`;
    return msg;
}

// ========================
// البحث عن قارئ
// ========================
function findReader(query) {
    const q = query.trim();
    return readers.filter(r =>
        r.name === q ||
        r.keywords.some(k => q.includes(k) || k.includes(q))
    );
}

// ========================
// تحميل وإرسال الصوت
// ========================
function downloadBuffer(url) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        const req = https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
            if (res.statusCode === 301 || res.statusCode === 302) {
                return downloadBuffer(res.headers.location).then(resolve).catch(reject);
            }
            if (res.statusCode !== 200) {
                return reject(new Error(`السورة غير متاحة (${res.statusCode})`));
            }
            res.on('data', chunk => chunks.push(chunk));
            res.on('end', () => resolve(Buffer.concat(chunks)));
        });
        req.on('error', reject);
        req.setTimeout(60000, () => { req.destroy(); reject(new Error('انتهت مهلة التحميل')); });
    });
}

async function sendAudio(sock, msg, from, reader, surahIndex) {
    const surahName = surahs[surahIndex];
    const surahNum = String(surahIndex + 1).padStart(3, '0');
    const url = `https://download.quranicaudio.com/quran/${reader.path}/${surahNum}.mp3`;

    console.log(`🎵 تحميل: ${url}`);
    await sock.sendMessage(from, { react: { text: '⬇️', key: msg.key } });

    try {
        const audioBuffer = await downloadBuffer(url);
        await sock.sendMessage(from, { react: { text: '🕌', key: msg.key } });
        await sock.sendMessage(from, {
            text: `🕌 *سورة ${surahName}*\n🎙️ *${reader.name}*\n\n_بسم الله الرحمن الرحيم_`
        }, { quoted: msg });
        await sock.sendMessage(from, {
            audio: audioBuffer,
            mimetype: 'audio/mpeg',
            ptt: false
        });
    } catch (e) {
        await sock.sendMessage(from, { react: { text: '❌', key: msg.key } });
        await sock.sendMessage(from, {
            text: `❌ *${e.message}*\nجرب قارئ آخر أو سورة أخرى.`
        }, { quoted: msg });
    }
}

// ========================
// module.exports
// ========================
module.exports = {
    commands: ['.قران', '.قرآن', '.quran'],
    async execute(sock, msg, from, text) {
        try {
            const input = text.replace(/^\.قران|^\.قرآن|^\.quran/i, '').trim();

            // استخراج الـ quotedId من الرد
            const quotedId = msg.message?.extendedTextMessage?.contextInfo?.stanzaId;

            // ========================
            // لو رد على session
            // ========================
            if (quotedId && sessions.has(quotedId)) {
                const state = sessions.get(quotedId);
                sessions.delete(quotedId);

                // رد على قائمة القراء
                if (state.type === 'readers') {
                    const num = parseInt(text.trim());
                    if (isNaN(num) || num < 1 || num > readers.length) {
                        const newMsg = await sock.sendMessage(from, { text: buildReadersList() }, { quoted: msg });
                        setSession(newMsg.key.id, { type: 'readers', surahIndex: state.surahIndex });
                        return;
                    }
                    const reader = readers[num - 1];
                    if (state.surahIndex !== undefined) {
                        return await sendAudio(sock, msg, from, reader, state.surahIndex);
                    }
                    const surahMsg = await sock.sendMessage(from, { text: buildSurahsList(reader.name) }, { quoted: msg });
                    setSession(surahMsg.key.id, { type: 'surahs', reader });
                    return;
                }

                // رد على قائمة السور
                if (state.type === 'surahs') {
                    const num = parseInt(text.trim());
                    if (isNaN(num) || num < 1 || num > surahs.length) {
                        const newMsg = await sock.sendMessage(from, { text: buildSurahsList(state.reader.name) }, { quoted: msg });
                        setSession(newMsg.key.id, { type: 'surahs', reader: state.reader });
                        return;
                    }
                    return await sendAudio(sock, msg, from, state.reader, num - 1);
                }
            }

            // ========================
            // .قران (بدون حاجة) → قائمة القراء
            // ========================
            if (!input) {
                const readersMsg = await sock.sendMessage(from, { text: buildReadersList() }, { quoted: msg });
                setSession(readersMsg.key.id, { type: 'readers' });
                return;
            }

            // ========================
            // .قران السورة (القارئ)
            // ========================
            const parts = input.split(' ');
            let foundSurah = -1;
            let readerText = '';

            // نبحث عن اسم السورة في البداية
            for (let i = parts.length; i >= 1; i--) {
                const candidate = parts.slice(0, i).join(' ');
                const idx = surahs.findIndex(s => s === candidate);
                if (idx !== -1) {
                    foundSurah = idx;
                    readerText = parts.slice(i).join(' ').trim();
                    break;
                }
            }

            // السورة مش موجودة → قائمة القراء أولاً
            if (foundSurah === -1) {
                await sock.sendMessage(from, { text: `❌ السورة غير موجودة، اكتب اسم السورة صح.\nمثال: .قران الفاتحة مشاري` }, { quoted: msg });
                const surahMsg = await sock.sendMessage(from, { text: buildSurahsList('') }, { quoted: msg });
                setSession(surahMsg.key.id, { type: 'choose_surah_then_reader' });
                return;
            }

            // السورة موجودة بدون قارئ → قائمة القراء
            if (!readerText) {
                const readersMsg = await sock.sendMessage(from, { text: buildReadersList() }, { quoted: msg });
                setSession(readersMsg.key.id, { type: 'readers', surahIndex: foundSurah });
                return;
            }

            // السورة موجودة مع قارئ → ابحث عن القارئ
            const found = findReader(readerText);

            if (found.length === 0) {
                await sock.sendMessage(from, { text: `❌ القارئ غير موجود.` }, { quoted: msg });
                const readersMsg = await sock.sendMessage(from, { text: buildReadersList() }, { quoted: msg });
                setSession(readersMsg.key.id, { type: 'readers', surahIndex: foundSurah });
                return;
            }

            // قارئ واحد → ابعت مباشرة
            return await sendAudio(sock, msg, from, found[0], foundSurah);

        } catch (e) {
            console.error('quran error:', e.message);
            await sock.sendMessage(from, { text: '❌ حدث خطأ، حاول مرة أخرى.' }, { quoted: msg });
        }
    }
};
