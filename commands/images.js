const axios = require('axios');

module.exports = {
    commands: ['.ولد'],
    async execute(sock, msg, from, text) {
        const prompt = text.replace(/^\.ولد/, '').trim();
        
        if (!prompt) {
            await sock.sendMessage(from, { 
                text: '❌ اكتب الوصف اللي عايزه بعد .ولد\n\n' +
                      'مثال:\n' +
                      '.ولد شاب عضلي وسيم بدون قميص على الشاطئ\n' +
                      '.ولد فتى ساخن جسم رياضي' 
            });
            return;
        }

        await sock.sendMessage(from, { text: '⏳ جاري توليد الصورة...' });

        try {
            const encodedPrompt = encodeURIComponent(prompt);
            
            const url = `https://image.pollinations.ai/prompt/${encodedPrompt}` +
                       `?width=1024` +
                       `&height=1024` +
                       `&model=flux` +
                       `&nologo=true` +
                       `&enhance=true` +
                       `&safe=false`;

            const response = await axios.get(url, { 
                responseType: 'arraybuffer',
                timeout: 30000 
            });

            const imageBuffer = Buffer.from(response.data);

            await sock.sendMessage(from, {
                image: imageBuffer,
                caption: `✅ تم التوليد\n📝 ${prompt}`
            }, { quoted: msg });

        } catch (e) {
            console.error(e);
            await sock.sendMessage(from, { 
                text: '❌ فشل في توليد الصورة\nجرب تاني أو غير الوصف شوية.' 
            });
        }
    }
};
