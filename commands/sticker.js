const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

module.exports = {
    commands: ['.s', '.sticker', '.ملصق'],
    async execute(sock, msg, from, text) {
        try {
            // التحقق من وجود صورة أو فيديو
            const quoted = msg.message.extendedTextMessage?.contextInfo?.quotedMessage || msg.message;
            const mime = (quoted.imageMessage || quoted.videoMessage)?.mimetype || '';

            if (!/image|video/.test(mime)) {
                return await sock.sendMessage(from, { text: '❌ رد على صورة أو فيديو ' }, { quoted: msg });
            }

            const messageType = quoted.imageMessage ? 'image' : 'video';
            const extension = messageType === 'image' ? 'jpg' : 'mp4';
            
            // تحميل الوسائط
            const stream = await downloadContentFromMessage(quoted[messageType + 'Message'], messageType);
            let buffer = Buffer.from([]);
            for await (const chunk of stream) {
                buffer = Buffer.concat([buffer, chunk]);
            }

            // مسارات الملفات المؤقتة
            const randomName = Math.floor(Math.random() * 10000);
            const inputFile = path.join(__dirname, `../temp_${randomName}.${extension}`);
            const outputFile = path.join(__dirname, `../temp_${randomName}.webp`);

            // حفظ الملف مؤقتاً
            fs.writeFileSync(inputFile, buffer);

            // أمر التحويل باستخدام FFMPEG الموجود في تيرمكس
            // يقوم بقص الصورة وتحويلها لـ 512x512 بصيغة WebP
            const ffmpegCommand = `ffmpeg -i "${inputFile}" -vcodec libwebp -filter:v "scale='min(512,iw)':min'(512,ih)':force_original_aspect_ratio=decrease,fps=15, pad=512:512:-1:-1:color=white@0.0, split [a][b]; [a] palettegen=reserve_transparent=on:transparency_color=ffffff [p]; [b][p] paletteuse" -loop 0 -ss 00:00:00 -t 00:00:05 -preset default -an -vsync 0 "${outputFile}"`;

            await sock.sendMessage(from, { react: { text: '⏳', key: msg.key } });

            // تنفيذ الأمر
            exec(ffmpegCommand, async (error) => {
                if (error) {
                    console.error('خطأ FFMPEG:', error);
                    await sock.sendMessage(from, { text: '⚠️ فشل التحويل' }, { quoted: msg });
                    // تنظيف الملفات
                    if (fs.existsSync(inputFile)) fs.unlinkSync(inputFile);
                    return;
                }

                // إرسال الملصق
                const stickerBuffer = fs.readFileSync(outputFile);
                await sock.sendMessage(from, { sticker: stickerBuffer }, { quoted: msg });
                await sock.sendMessage(from, { react: { text: '✅', key: msg.key } });

                // تنظيف الملفات المؤقتة بعد الإرسال
                if (fs.existsSync(inputFile)) fs.unlinkSync(inputFile);
                if (fs.existsSync(outputFile)) fs.unlinkSync(outputFile);
            });

        } catch (e) {
            console.error(e);
        }
    }
};

