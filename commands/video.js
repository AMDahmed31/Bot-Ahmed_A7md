// commands/video.js
const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');

const commands = ['.فيديو', '.video', '.تحميل', '.dl'];

async function execute(sock, msg, from, text) {
    let url = text.split(' ').slice(1).join(' ').trim();

    if (!url) {
        await sock.sendMessage(from, {
            text: '✅ الرجاء إرسال الرابط بعد الأمر\nمثال:\n.تحميل https://vt.tiktok.com/ZSXdnLm3g/'
        });
        return;
    }

    // تحويل vt.tiktok إلى www.tiktok
    if (url.includes('vt.tiktok.com')) {
        url = url.replace('vt.tiktok.com', 'www.tiktok.com');
    }

    const tempFile = path.join(__dirname, `../temp_${Date.now()}.mp4`);

    try {
        await sock.sendMessage(from, {
            text: '⏳ جاري تحميل الفيديو...\n(قد يستغرق 10-40 ثانية)'
        });

        // استخدام execFile بدل exec لتجنب مشاكل الـ shell والـ injection
        const args = [
            '-m', 'yt_dlp',
            '-f', 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best',
            '--merge-output-format', 'mp4',
            '--no-warnings',
            '--no-playlist',
            url,
            '-o', tempFile
        ];

        execFile('python', args, { timeout: 120000 }, async (error, stdout, stderr) => {
            if (error) {
                console.error('yt-dlp Error:', stderr || error.message);
                await sock.sendMessage(from, {
                    text: '❌ فشل تحميل الفيديو.\nجرب رابط TikTok كامل أو رابط يوتيوب.'
                });
                return;
            }

            if (fs.existsSync(tempFile) && fs.statSync(tempFile).size > 10000) {
                try {
                    await sock.sendMessage(from, {
                        video: { url: `file://${tempFile}` },
                        caption: `✅ تم التحميل بنجاح`,
                        mimetype: 'video/mp4'
                    });

                    setTimeout(() => {
                        if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
                    }, 15000);

                } catch (sendErr) {
                    console.error('Send Error:', sendErr);
                    await sock.sendMessage(from, { text: '❌ تم التحميل لكن فشل الإرسال.' });
                }
            } else {
                await sock.sendMessage(from, { text: '❌ لم يتم تحميل الفيديو بشكل صحيح.' });
            }
        });

    } catch (err) {
        console.error('Execute Error:', err);
        await sock.sendMessage(from, { text: '❌ حدث خطأ غير متوقع.' });
    }
}

module.exports = { commands, execute };

