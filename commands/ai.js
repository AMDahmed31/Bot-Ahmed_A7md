const axios = require('axios');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

let chatHistory = {};

module.exports = {
    commands: ['.ai', 'يا بوت', 'bot', 'ai', 'Ai'],

    async execute(sock, msg, from, text) {
        // --- إعدادات ElevenLabs ---
        const ELEVENLABS_API_KEY ="ee908f67241f432cf66f65abaa6a36ce98085acc4e2653d5c4eea9862aafc877";
        const VOICE_ID = 'pNInz6obpgDQGcFmaJgB'; 
        // -------------------------

        let rawText = text.trim();
        let prompt = rawText;

        const keywords = ['.ai', 'يا بوت', 'bot', 'ai', 'Ai'];
        keywords.forEach(word => {
            const re = new RegExp(`^${word}`, 'i');
            prompt = prompt.replace(re, '');
        });
        prompt = prompt.trim();

        let wantAudio = false;
        if (prompt.startsWith('ص')) {
            wantAudio = true;
            prompt = prompt.replace(/^ص/, '').trim();
        }

        if (!prompt) return await sock.sendMessage(from, { text: "هلا..\nانا بوت مزود بذكاء اصطناعي \nاسألني اي حاجه" }, { quoted: msg });

        if (!chatHistory[from]) chatHistory[from] = [];
        const pushName = msg.pushName || "مستخدم";
        chatHistory[from].push({ role: "user", content: prompt });
        if (chatHistory[from].length > 10) chatHistory[from].shift();

        const messages = [
            { role: 'system', content: `أنت مساعد ذكي وتتحدث باللهجة المصرية في واتساب. اسم المستخدم الذي تحادثه هو ${pushName}.` },
            ...chatHistory[from].map(m => ({ role: 'user', content: m.content }))
        ];

        await sock.sendMessage(from, { react: { text: "⏳", key: msg.key } });

        let gptText = null;
        try {
            const response = await axios.post('https://text.pollinations.ai/', {
                messages: messages,
                model: 'openai'
            });
            gptText = response.data;
        } catch (e) {
            console.log("Error in AI Request");
        }

        if (gptText && typeof gptText === 'string') {
            gptText = gptText.replace(/⚠️|IMPORTANT NOTICE|deprecated/g, '').trim();
            chatHistory[from].push({ role: "assistant", content: gptText });

            // إرسال الرد النصي العادي
            await sock.sendMessage(from, { text: `*الرد:*\n\n${gptText}` }, { quoted: msg });

            if (wantAudio) {
                try {
                    const response = await axios({
                        method: 'post',
                        url: `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`,
                        data: { text: gptText, model_id: "eleven_multilingual_v2" },
                        headers: { 'xi-api-key': ELEVENLABS_API_KEY, 'Content-Type': 'application/json', 'Accept': 'audio/mpeg' },
                        responseType: 'arraybuffer'
                    });

                    const tempMp3 = path.join(__dirname, `temp_${Date.now()}.mp3`);
                    const tempOgg = path.join(__dirname, `temp_${Date.now()}.ogg`);
                    fs.writeFileSync(tempMp3, Buffer.from(response.data));

                    // تحويل لضمان عمل البصمة بدون خلل
                    exec(`ffmpeg -i ${tempMp3} -c:a libopus -b:a 32k -vbr on ${tempOgg}`, async (error) => {
                        if (!error) {
                            await sock.sendMessage(from, { 
                                audio: fs.readFileSync(tempOgg), 
                                mimetype: 'audio/ogg; codecs=opus', 
                                ptt: true 
                            }, { quoted: msg });
                        }
                        if (fs.existsSync(tempMp3)) fs.unlinkSync(tempMp3);
                        if (fs.existsSync(tempOgg)) fs.unlinkSync(tempOgg);
                    });
                } catch (audioErr) {
                    console.error("ElevenLabs Error");
                }
            }
            await sock.sendMessage(from, { react: { text: "✅", key: msg.key } });
        }
    }
};