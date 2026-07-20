const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');

function convertWebpToPng(input, output) {
    return new Promise((resolve, reject) => {
        execFile('ffmpeg', ['-y', '-i', input, output], (error) => {
            if (error) return reject(error);
            resolve();
        });
    });
}

function convertWebpToMp4(input, output) {
    return new Promise((resolve, reject) => {
        execFile('ffmpeg', [
            '-y', '-i', input,
            '-movflags', 'faststart',
            '-pix_fmt', 'yuv420p',
            '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2',
            output
        ], (error) => {
            if (error) return reject(error);
            resolve();
        });
    });
}

module.exports = {
    commands: ['.استخراج'],
    async execute(sock, msg, from, text) {
        let filesToDelete = [];
        try {
            const quoted = msg.message.extendedTextMessage?.contextInfo?.quotedMessage;
            if (!quoted || !quoted.stickerMessage) {
                return await sock.sendMessage(from, { text: '❌ رد على ملصق واكتب: \n*.استخراج*' }, { quoted: msg });
            }
            const sticker = quoted.stickerMessage;
            const isAnimated = sticker.isAnimated;
            const stream = await downloadContentFromMessage(sticker, 'sticker');
            let buffer = Buffer.from([]);
            for await (const chunk of stream) { buffer = Buffer.concat([buffer, chunk]); }
            const randomName = Math.floor(Math.random() * 10000);
            const inputFile = path.join(__dirname, `../temp_in_${randomName}.webp`);
            filesToDelete.push(inputFile);
            fs.writeFileSync(inputFile, buffer);
            await sock.sendMessage(from, { react: { text: '⏳', key: msg.key } });

            if (isAnimated) {
                const outputFile = path.join(__dirname, `../temp_out_${randomName}.mp4`);
                filesToDelete.push(outputFile);
                try {
                    await convertWebpToMp4(inputFile, outputFile);
                    await sock.sendMessage(from, {
                        video: fs.readFileSync(outputFile),
                        gifPlayback: true,
                        caption: '✅ تم استخراج الملصق المتحرك بنجاح'
                    }, { quoted: msg });
                    await sock.sendMessage(from, { react: { text: '✅', key: msg.key } });
                } catch (e) {
                    console.error('Conversion Error:', e);
                    await sock.sendMessage(from, { text: '⚠️ فشل استخراج الملصق المتحرك.' }, { quoted: msg });
                }
            } else {
                const outputFile = path.join(__dirname, `../temp_out_${randomName}.png`);
                filesToDelete.push(outputFile);
                try {
                    await convertWebpToPng(inputFile, outputFile);
                    await sock.sendMessage(from, {
                        image: fs.readFileSync(outputFile),
                        caption: '✅ تم استخراج الصورة بنجاح'
                    }, { quoted: msg });
                    await sock.sendMessage(from, { react: { text: '✅', key: msg.key } });
                } catch (e) {
                    console.error('Conversion Error:', e);
                    await sock.sendMessage(from, { text: '⚠️ فشل الاستخراج.' }, { quoted: msg });
                }
            }
        } catch (e) {
            console.log("Error:", e.message);
        } finally {
            filesToDelete.forEach(f => { if (fs.existsSync(f)) fs.unlinkSync(f); });
        }
    }
};
