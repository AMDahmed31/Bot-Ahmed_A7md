// ═══════════════════════════════════════
// 🤖 commands/ai.js
// ═══════════════════════════════════════
const axios = require('axios')
const { exec } = require('child_process')
const fs = require('fs')
const path = require('path')

const ELEVENLABS_API_KEY = 'sk_a6eb126c17e210a002a99a74a8d296e86b2d55b951496854'
const VOICE_ID = 'pNInz6obpgDQGcFmaJgB'

const chatHistory = {}
const HISTORY_LIMIT = 10

module.exports = {
    commands: ['.ai', 'يا بوت', 'bot', 'ai', 'Ai'],

    async execute(sock, msg, from, text) {
        let prompt = text.trim()

        // إزالة الكلمة المحفزة من الأمر
        const keywords = ['.ai', 'يا بوت', 'bot', 'ai', 'Ai']
        for (const word of keywords) {
            prompt = prompt.replace(new RegExp(`^${word}\\s*`, 'i'), '')
        }
        prompt = prompt.trim()

        // ── أمر حالة البوت ──
        if (['حالة البوت', 'bot status', 'status', 'حالتك'].includes(prompt.toLowerCase())) {
            const ctx = "البوت شغال ✅"
            await sock.sendMessage(from, { text: `📊 *حالة البوت:*\n\n${ctx}` }, { quoted: msg })
            return
        }

        // ── رسالة ترحيب ──
        if (!prompt) {
            await sock.sendMessage(from, {
                text: '👋 هلا!\nأنا بوت مزود بذكاء اصطناعي وعارف كل اللي بيحصل في البوت.\n\nاسألني أي حاجة أو قولي *حالة البوت* عشان أوريك تقرير كامل.'
            }, { quoted: msg })
            return
        }

        // ── صوت ──
        let wantAudio = false
        if (prompt.startsWith('ص ') || prompt.startsWith('ص')) {
            wantAudio = true
            prompt = prompt.replace(/^ص\s*/, '').trim()
            if (!prompt) return
        }

        // logCommandUsed removed

        // ── تهيئة التاريخ ──
        if (!chatHistory[from]) chatHistory[from] = []
        const pushName = msg.pushName || 'مستخدم'

        chatHistory[from].push({ role: 'user', content: prompt })
        if (chatHistory[from].length > HISTORY_LIMIT) chatHistory[from].shift()

        // ── بناء الرسائل مع context البوت ──
        const botContext = "أنت مساعد ذكي في واتساب."
        const messages = [
            {
                role: 'system',
                content: `أنت مساعد ذكي تتحدث باللهجة المصرية في واتساب. اسم المستخدم: ${pushName}.\n\n${botContext}`
            },
            ...chatHistory[from].map(m => ({ role: m.role, content: m.content }))
        ]

        await sock.sendMessage(from, { react: { text: '⏳', key: msg.key } })

        // ── طلب الـ AI ──
        let gptText = null
        try {
            const response = await axios.post('https://text.pollinations.ai/', {
                messages,
                model: 'openai'
            }, { timeout: 30000 })
            gptText = response.data
        } catch (e) {
            await sock.sendMessage(from, { react: { text: '❌', key: msg.key } })
            await sock.sendMessage(from, { text: '❌ حصل خطأ في الاتصال بالـ AI، جرب تاني.' }, { quoted: msg })
            return
        }

        if (!gptText || typeof gptText !== 'string') return

        gptText = gptText.replace(/⚠️|IMPORTANT NOTICE|deprecated/g, '').trim()
        chatHistory[from].push({ role: 'assistant', content: gptText })

        // ── إرسال النص ──
        await sock.sendMessage(from, { text: `*الرد:*\n\n${gptText}` }, { quoted: msg })

        // ── إرسال الصوت لو طلب ──
        if (wantAudio) {
            try {
                const audioRes = await axios({
                    method: 'post',
                    url: `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`,
                    data: { text: gptText, model_id: 'eleven_multilingual_v2' },
                    headers: {
                        'xi-api-key': ELEVENLABS_API_KEY,
                        'Content-Type': 'application/json',
                        'Accept': 'audio/mpeg'
                    },
                    responseType: 'arraybuffer',
                    timeout: 30000
                })

                const ts = Date.now()
                const tempMp3 = path.join(__dirname, `temp_${ts}.mp3`)
                const tempOgg = path.join(__dirname, `temp_${ts}.ogg`)
                fs.writeFileSync(tempMp3, Buffer.from(audioRes.data))

                exec(`ffmpeg -i ${tempMp3} -c:a libopus -b:a 32k -vbr on ${tempOgg}`, async (error) => {
                    if (!error && fs.existsSync(tempOgg)) {
                        await sock.sendMessage(from, {
                            audio: fs.readFileSync(tempOgg),
                            mimetype: 'audio/ogg; codecs=opus',
                            ptt: true
                        }, { quoted: msg })
                    }
                    if (fs.existsSync(tempMp3)) fs.unlinkSync(tempMp3)
                    if (fs.existsSync(tempOgg)) fs.unlinkSync(tempOgg)
                })
            } catch (e) {
                console.error('ElevenLabs Error:', e.message)
            }
        }

        await sock.sendMessage(from, { react: { text: '✅', key: msg.key } })
    }
}
