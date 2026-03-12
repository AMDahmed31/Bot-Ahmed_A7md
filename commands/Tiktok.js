// commands/tiktok.js
const axios = require('axios');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

module.exports = {
    commands: ['.tiktok', '.tt', '.ttdl'],

    async execute(sock, msg, from, text) {
        const url = text.replace(/^\.(tiktok|tt|ttdl)\s*/i, '').trim();

        if (!url) {
            return await sock.sendMessage(from, {
                text: '🎵 *TikTok Downloader*\n\n📎 مثال:\n.tiktok https://vm.tiktok.com/XXXXX'
            }, { quoted: msg });
        }

        await sock.sendMessage(from, { text: '⏳ جاري تحميل الفيديو...' }, { quoted: msg });

        try {
            const rawBuffer = await tryDownloadWithRetry(url);
            if (!rawBuffer) throw new Error('لم نتمكن من تحميل فيديو صالح');

            const finalBuffer = await reencodeVideo(rawBuffer);

            await sock.sendMessage(from, {
                video: finalBuffer,
                mimetype: 'video/mp4',
                caption: '🎥 تم التحميل بنجاح ✅'
            }, { quoted: msg });

        } catch (error) {
            console.error(error);
            await sock.sendMessage(from, {
                text: `❌ فشل التحميل: ${error.message || 'حاول مرة أخرى'}`
            }, { quoted: msg });
        }
    }
};

// ==============================
// محاولة التحميل من عدة APIs
// ==============================
async function tryDownloadWithRetry(url) {
    const apis = [
        { name: 'tikwm',    fn: () => tikwm(url)    },
        { name: 'snaptik',  fn: () => snaptik(url)  },
        { name: 'tiktokio', fn: () => tiktokio(url) },
    ];

    let lastError = null;

    for (const api of apis) {
        try {
            console.log(`[TikTok] جاري المحاولة: ${api.name}`);
            const videoUrl = await api.fn();
            if (!videoUrl) continue;

            const isVideo = await checkContentType(videoUrl);
            if (!isVideo) {
                console.log(`[${api.name}] ❌ audio وليس video، تخطي`);
                continue;
            }

            const buffer = await downloadBuffer(videoUrl);
            if (isValidMp4(buffer)) {
                console.log(`[${api.name}] ✅ نجح`);
                return buffer;
            }

        } catch (err) {
            lastError = err;
            console.log(`[${api.name}] فشل:`, err.message);
        }
    }

    throw lastError || new Error('جميع المحاولات فشلت');
}

// ==============================
// API 1: tikwm.com
// ==============================
async function tikwm(url) {
    const { data } = await axios.get(
        `https://www.tikwm.com/api/?url=${encodeURIComponent(url)}&hd=1`,
        { timeout: 15000 }
    );
    if (!data || data.code !== 0) throw new Error('tikwm: استجابة غير صالحة');

    const res = data.data;

    // wmplay أفضل لأنه H264 عادي - hdplay ممكن يكون BVC2
    const candidates = [res.play, res.wmplay, res.hdplay].filter(Boolean);

    for (const c of candidates) {
        if (!c.includes('audio') && !c.includes('music')) {
            const isBvc2 = await checkIsBvc2(c);
            if (!isBvc2) return c;
            console.log(`[tikwm] رابط BVC2 تم تخطيه`);
        }
    }

    throw new Error('tikwm: جميع الروابط BVC2 أو غير صالحة');
}

// ==============================
// API 2: snaptik.app
// ==============================
async function snaptik(url) {
    const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        'Content-Type': 'application/x-www-form-urlencoded',
        'Referer': 'https://snaptik.app/'
    };

    const home = await axios.get('https://snaptik.app/ar', { headers, timeout: 10000 });
    const tokenMatch = home.data.match(/name="token"\s+value="([^"]+)"/);
    if (!tokenMatch) throw new Error('snaptik: لم نجد التوكن');

    const params = new URLSearchParams({ url, token: tokenMatch[1] });
    const res = await axios.post('https://snaptik.app/action', params, { headers, timeout: 15000 });

    const match = res.data.match(/href="(https?:\/\/[^"]+)"\s[^>]*download/);
    if (!match) throw new Error('snaptik: لم نجد رابط الفيديو');

    return match[1].replace(/&amp;/g, '&');
}

// ==============================
// API 3: tiktokio.com
// ==============================
async function tiktokio(url) {
    const { data } = await axios.post(
        'https://tiktokio.com/api/v1/tk-htmx',
        new URLSearchParams({ url }),
        {
            headers: {
                'User-Agent': 'Mozilla/5.0',
                'Content-Type': 'application/x-www-form-urlencoded',
                'Referer': 'https://tiktokio.com/'
            },
            timeout: 15000
        }
    );

    const match = data.match(/href="(https?:\/\/[^"]+\.mp4[^"]*)"/);
    if (!match) throw new Error('tiktokio: لم نجد رابط الفيديو');
    return match[1].replace(/&amp;/g, '&');
}

// ==============================
// إعادة encode بـ ffmpeg
// ==============================
async function reencodeVideo(inputBuffer) {
    const tmpDir = os.tmpdir();
    const inputPath  = path.join(tmpDir, `tiktok_in_${Date.now()}.mp4`);
    const outputPath = path.join(tmpDir, `tiktok_out_${Date.now()}.mp4`);

    try {
        fs.writeFileSync(inputPath, inputBuffer);

        await new Promise((resolve, reject) => {
            const cmd = `ffmpeg -y \
                -analyzeduration 100M \
                -probesize 100M \
                -i "${inputPath}" \
                -c:v libx264 \
                -preset fast \
                -crf 23 \
                -c:a aac \
                -b:a 128k \
                -pix_fmt yuv420p \
                -movflags +faststart \
                -vf "scale=trunc(iw/2)*2:trunc(ih/2)*2" \
                "${outputPath}"`;

            exec(cmd, { timeout: 60000 }, (err, stdout, stderr) => {
                if (err) {
                    console.error('[ffmpeg]', stderr);
                    reject(new Error('فشل ffmpeg في معالجة الفيديو'));
                } else {
                    resolve();
                }
            });
        });

        return fs.readFileSync(outputPath);

    } finally {
        if (fs.existsSync(inputPath))  fs.unlinkSync(inputPath);
        if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
    }
}

// ==============================
// دوال مساعدة
// ==============================

// فحص إذا كان الفيديو BVC2
async function checkIsBvc2(url) {
    try {
        const res = await axios.get(url, {
            responseType: 'arraybuffer',
            timeout: 8000,
            headers: { 'Range': 'bytes=0-1000' }
        });
        const buffer = Buffer.from(res.data);
        return buffer.toString('ascii').includes('bvc2');
    } catch {
        return false;
    }
}

// فحص الـ content-type
async function checkContentType(url) {
    try {
        const res = await axios.head(url, { timeout: 8000 });
        const ct = res.headers['content-type'] || '';
        return ct.includes('video');
    } catch {
        return true;
    }
}

// تحميل الفيديو كـ Buffer
async function downloadBuffer(url) {
    const res = await axios({
        method: 'GET',
        url,
        responseType: 'arraybuffer',
        timeout: 60000,
        maxContentLength: 100 * 1024 * 1024,
        headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    return Buffer.from(res.data);
}

// فحص توقيع MP4
function isValidMp4(buffer) {
    if (buffer.length < 100) return false;
    const sig = buffer.slice(4, 8).toString('ascii');
    return ['ftyp', 'moov', 'mdat', 'free', 'skip'].includes(sig);
              }
