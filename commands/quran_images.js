const fs = require('fs');
const path = require('path');
const https = require('https');

const RECITERS_DIR = path.join(__dirname, 'reciters');
const LOGO_PATH = path.join(__dirname, 'logo.png');
const PEXELS_KEY = 'sbwDEYpQ3gcUZ8S0fUOtgSn9sRndqPF0FifEqnZXrgqOtHLskYisAMiI';

let pexelsCache = { buffer: null, expiry: 0 };

function normalizeName(name) {
    return name
        .replace(/\s+/g, '_')
        .replace(/[أإآ]/g, 'ا')
        .replace(/[ة]/g, 'ه')
        .replace(/[ى]/g, 'ي')
        .replace(/[ؤ]/g, 'و')
        .replace(/[ئ]/g, 'ي');
}

function getLocalImage(reciterName) {
    if (!fs.existsSync(RECITERS_DIR)) return null;
    const extensions = ['.jpg', '.jpeg', '.png', '.webp'];
    const normalized = normalizeName(reciterName);

    for (const ext of extensions) {
        const p = path.join(RECITERS_DIR, reciterName + ext);
        if (fs.existsSync(p)) return fs.readFileSync(p);
    }
    for (const ext of extensions) {
        const p = path.join(RECITERS_DIR, normalized + ext);
        if (fs.existsSync(p)) return fs.readFileSync(p);
    }
    try {
        const files = fs.readdirSync(RECITERS_DIR);
        const nameParts = reciterName.split(' ').slice(0, 2).join(' ');
        const normalizedParts = normalizeName(nameParts);
        for (const file of files) {
            const base = path.basename(file, path.extname(file));
            const normalizedBase = normalizeName(base);
            if (
                normalizedBase.includes(normalizedParts) ||
                normalizedParts.includes(normalizedBase) ||
                base.includes(nameParts) ||
                nameParts.includes(base)
            ) {
                return fs.readFileSync(path.join(RECITERS_DIR, file));
            }
        }
    } catch (e) {}
    return null;
}

function downloadHttpsBuffer(url, hop = 0) {
    if (hop > 5) return Promise.resolve(null);
    return new Promise((resolve) => {
        https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
            if ([301, 302, 307, 308].includes(res.statusCode) && res.headers.location)
                return downloadHttpsBuffer(res.headers.location, hop + 1).then(resolve);
            if (res.statusCode !== 200) return resolve(null);
            const chunks = [];
            res.on('data', c => chunks.push(c));
            res.on('end', () => resolve(Buffer.concat(chunks)));
        }).on('error', () => resolve(null));
    });
}

function fetchPexelsImage() {
    return new Promise((resolve) => {
        const now = Date.now();
        if (pexelsCache.buffer && now < pexelsCache.expiry) return resolve(pexelsCache.buffer);

        const queries = ['quran mosque', 'kaaba mecca', 'islamic architecture', 'mosque prayer hall'];
        const q = queries[Math.floor(Math.random() * queries.length)];
        const u = new URL(`https://api.pexels.com/v1/search?query=${encodeURIComponent(q)}&per_page=15&orientation=landscape`);

        const req = https.get({
            hostname: u.hostname,
            path: u.pathname + u.search,
            headers: { 'Authorization': PEXELS_KEY, 'User-Agent': 'QuranBot/1.0' },
            timeout: 10000,
        }, (res) => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', async () => {
                try {
                    const json = JSON.parse(data);
                    if (!json.photos || !json.photos.length) return resolve(null);
                    const photo = json.photos[Math.floor(Math.random() * json.photos.length)];
                    const imgBuffer = await downloadHttpsBuffer(photo.src.large);
                    pexelsCache = { buffer: imgBuffer, expiry: Date.now() + 60 * 60 * 1000 };
                    resolve(imgBuffer);
                } catch (e) { resolve(null); }
            });
        });
        req.on('error', () => resolve(null));
        req.on('timeout', () => { req.destroy(); resolve(null); });
    });
}

// ========================
// jimp 1.6.0 API
// ========================
async function addWatermark(imageBuffer) {
    try {
        if (!fs.existsSync(LOGO_PATH)) return imageBuffer;

        const { Jimp } = require('jimp');

        const image = await Jimp.fromBuffer(imageBuffer);
        const logo = await Jimp.fromBuffer(fs.readFileSync(LOGO_PATH));

        const imgW = image.width;
        const logoSize = Math.floor(imgW * 0.16);
        const margin = Math.floor(imgW * 0.02);

        // resize اللوجو مع الحفاظ على النسبة
        const ratio = logo.height / logo.width;
        logo.resize({ w: logoSize, h: Math.floor(logoSize * ratio) });

        // ضع اللوجو أعلى يسار
        image.composite(logo, margin, margin);

        return await image.getBuffer('image/jpeg');
    } catch (e) {
        console.error('⚠️ فشل إضافة اللوجو:', e.message);
        return imageBuffer;
    }
}

async function getReciterImage(reciterName) {
    let imageBuffer = getLocalImage(reciterName);
    if (!imageBuffer) imageBuffer = await fetchPexelsImage();
    if (!imageBuffer) return null;
    return await addWatermark(imageBuffer);
}

// دالة عامة تضيف اللوجو على أي صورة (Buffer أو URL)
async function addLogoToImage(imageInput) {
    try {
        let imageBuffer;
        if (typeof imageInput === 'string') {
            imageBuffer = await downloadHttpsBuffer(imageInput);
            if (!imageBuffer) return null;
        } else {
            imageBuffer = imageInput;
        }
        return await addWatermark(imageBuffer);
    } catch (e) {
        console.error('⚠️ فشل addLogoToImage:', e.message);
        return typeof imageInput === 'string' ? null : imageInput;
    }
}

// ========================
// إضافة اللوجو على فيديو باستخدام ffmpeg
// ========================
async function addLogoToVideo(videoBuffer) {
    try {
        if (!fs.existsSync(LOGO_PATH)) return videoBuffer;

        const os = require('os');
        const { execFile } = require('child_process');
        const tmpDir = os.tmpdir();
        const inputPath  = path.join(tmpDir, `vid_in_${Date.now()}.mp4`);
        const outputPath = path.join(tmpDir, `vid_out_${Date.now()}.mp4`);

        fs.writeFileSync(inputPath, videoBuffer);

        // احسب حجم اللوجو = 10% من عرض الفيديو
        // overlay=W*0.02:H*0.02 = أعلى يسار مع هامش 2%
        await new Promise((resolve, reject) => {
            execFile('ffmpeg', [
                '-i', inputPath,
                '-i', LOGO_PATH,
                '-filter_complex',
                '[1:v]scale=iw*0.10:-1[logo];[0:v][logo]overlay=W*0.02:H*0.02',
                '-codec:a', 'copy',
                '-y',
                outputPath
            ], { timeout: 60000 }, (err) => {
                if (err) reject(err); else resolve();
            });
        });

        const result = fs.readFileSync(outputPath);
        fs.unlinkSync(inputPath);
        fs.unlinkSync(outputPath);
        return result;
    } catch (e) {
        console.error('⚠️ فشل إضافة اللوجو على الفيديو:', e.message);
        return videoBuffer;
    }
}

module.exports = { getReciterImage, addLogoToImage, addLogoToVideo };

