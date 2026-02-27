const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

module.exports = {
    commands: ['.استخراج ملصق', 'استخراج'], 
    async execute(sock, msg, from, text) {
        let filesToDelete = [];

        try {
            const quoted = msg.message.extendedTextMessage?.contextInfo?.quotedMessage;
            if (!quoted || !quoted.stickerMessage) {
                return await sock.sendMessage(from, { text: '❌ رد على ملصق واكتب: \n*.استخراج ملصق*' }, { quoted: msg });
            }

            const sticker = quoted.stickerMessage;
            const isAnimated = sticker.isAnimated;

            const stream = await downloadContentFromMessage(sticker, 'sticker');
            let buffer = Buffer.from([]);
            for await (const chunk of stream) { buffer = Buffer.concat([buffer, chunk]); }

            const randomName = Math.floor(Math.random() * 10000);
            const inputFile = path.join(__dirname, `../temp_in_${randomName}.webp`);
            const outputFile = path.join(__dirname, `../temp_out_${randomName}.png`);
            filesToDelete.push(inputFile, outputFile);

            fs.writeFileSync(inputFile, buffer);
            await sock.sendMessage(from, { react: { text: '⏳', key: msg.key } });

            if (isAnimated) {
                await sock.sendMessage(from, { text: '⚠️ الملصقات المتحركة غير مدعومة حالياً.' }, { quoted: msg });
            } else {
                try {
                    await sharp(inputFile).png().toFile(outputFile);
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