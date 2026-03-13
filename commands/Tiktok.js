// commands/tiktok.js
const axios = require('axios');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

module.exports = {
    commands: ['.tiktok', '.تيك توك', '.tik'],

    async execute(sock, msg, from, text) {
        // ✅ يشيل الأمر سواء كان كلمة أو كلمتين
        const url = text.replace(/^\S+(\s+\S+)?\s*/, '').trim();

        if (!url) {
            return await sock.sendMessage(from, {
                text: '🎵 *TikTok Downloader*\n\n📎 مثال:\n.tiktok https://vm.tiktok.com/XXXXX'
            }, { quoted: msg });
        }

        await sock.sendMessage(from, { react: { text: '⏳', key: msg.key } });
        await sock.sendMessage(from, {
            text: 'ثواني بيحمل اصبر شويه من دقيقه لدقيقتين أو على حسب حجم الفيديو........'
        }, { quoted: msg });

        try {
            const videoInfo = await getTikwmInfo(url);

            const rawBuffer = await tryDownloadWithRetry(url);
            if (!rawBuffer) throw new Error('لم نتمكن من تحميل فيديو صالح');

            const finalBuffer = await reencodeVideo(rawBuffer);

            const caption = videoInfo
                ? `🎬 *${videoInfo.title || 'بدون عنوان'}*\n\n` +
                  `👤 *القناة:* ${videoInfo.author}\n` +
                  `❤️ *إعجابات:* ${formatNum(videoInfo.digg_count)}\n` +
                  `💬 *تعليقات:* ${formatNum(videoInfo.comment_count)}\n` +
                  `🔁 *مشاركات:* ${formatNum(videoInfo.share_count)}\n` +
                  `▶️ *مشاهدات:* ${formatNum(videoInfo.play_count)}\n\n` +
                  `✅ تم التحميل بنجاح`
                : '🎥 تم التحميل بنجاح ✅';

            await sock.sendMessage(from, {
                video: finalBuffer,
                mimetype: 'video/mp4',
                caption
            }, { quoted: msg });

            await sock.sendMessage(from, { react: { text: '✅', key: msg.key } });

        } catch (error) {
            console.error(error);
            await sock.sendMessage(from, { react: { text: '❌', key: msg.key } });
            await sock.sendMessage(from, {
                text: `❌ فشل التحميل: ${error.message || 'حاول مرة أخرى'}`
            }, { quoted: msg });
        }
    }
};

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

async function tikwm(url) {
    const { data } = await axios.get(
        `https://www.tikwm.com/api/?url=${encodeURIComponent(url)}&hd=1`,
        {
            timeout: 15000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Referer': 'https://www.tikwm.com/',
                'Accept': 'application/json'
            },
            validateStatus: () => true
        }
    );
    if (!data || data.code !== 0) throw new Error(`tikwm: ${data?.msg || 'استجابة غير صالحة'}`);

    const res = data.data;
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

async function getTikwmInfo(url) {
    try {
        const { data } = await axios.get(
            `https://www.tikwm.com/api/?url=${encodeURIComponent(url)}`,
            {
                timeout: 15000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Referer': 'https://www.tikwm.com/',
                    'Accept': 'application/json'
                },
                validateStatus: () => true
            }
        );

        if (!data || data.code !== 0) {
            console.log('[getTikwmInfo] فشل:', data?.msg || 'استجابة غير صالحة');
            return null;
        }

        const d = data.data;
        return {
            title:         d.title         || '',
            author:        d.author?.nickname || 'غير معروف',
            digg_count:    d.digg_count    || 0,
            comment_count: d.comment_count || 0,
            share_count:   d.share_count   || 0,
            play_count:    d.play_count    || 0,
        };
    } catch (e) {
        console.log('[getTikwmInfo] خطأ:', e.message);
        return null;
    }
}

function formatNum(n) {
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
    if (n >= 1_000)     return (n / 1_000).toFixed(1) + 'K';
    return String(n);
}

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

async function checkContentType(url) {
    try {
        const res = await axios.head(url, { timeout: 8000 });
        const ct = res.headers['content-type'] || '';
        return ct.includes('video');
    } catch {
        return true;
    }
}

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

function isValidMp4(buffer) {
    if (buffer.length < 100) return false;
    const sig = buffer.slice(4, 8).toString('ascii');
    return ['ftyp', 'moov', 'mdat', 'free', 'skip'].includes(sig);
    }
