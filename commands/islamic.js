const fs = require('fs')
const path = require('path')

module.exports = {
    commands: ['.اذكار الصباح', '.اذكار المساء', '.اذكار النوم', '</ص'],
    async execute(sock, msg, from, text) {
        // أمر المنشن بالصلاة
        if (text === '</ص') {
            const groupMetadata = from.endsWith('@g.us') ? await sock.groupMetadata(from) : null
            const mentions = groupMetadata ? groupMetadata.participants.map(p => p.id) : []
            return await sock.sendMessage(from, {
                text: '━━━━━━━━━━━━━━━\n🕌 *تذكير بالصلاة على النبي* 🕌\n━━━━━━━━━━━━━━━\n\n صلِّ على محمد\nاللهم صل وسلم علي محمد وعلي ال محمد🤍 \n━━━━━━━━━━━━━━━',
                mentions: mentions
            }, { quoted: msg })
        }

        // الأذكار
        let file = ''
        if (text === '.اذكار الصباح') file = 'Azkar_AL_SBAH.txt'
        if (text === '.اذكار المساء') file = 'Azkar_AL_MASA.txt'
        if (text === '.اذكار النوم') file = 'Azkar_Sleep.txt'

        if (file) {
            if (fs.existsSync(`./${file}`)) {
                const content = fs.readFileSync(`./${file}`, 'utf8')
                await sock.sendMessage(from, { text: content }, { quoted: msg })
            } else {
                await sock.sendMessage(from, { text: `❌ الملف ${file} غير موجود` })
            }
        }
    },

    scheduleAzkar(sock, GROUP_ID) {
        const stateFile = path.join(__dirname, '..', 'azkar_state.json');

        function loadState() {
            try { return JSON.parse(fs.readFileSync(stateFile, 'utf8')); }
            catch { return {}; }
        }
        function saveState(state) {
            fs.writeFileSync(stateFile, JSON.stringify(state));
        }

        setInterval(async () => {
            const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Africa/Cairo' }));
            const hour   = now.getHours();
            const minute = now.getMinutes();

            // بيتبعت بالظبط عند الدقيقة 0 فقط
            let file = null;
            let key  = null;
            if (hour === 7  && minute === 0) { file = 'Azkar_AL_SBAH.txt'; key = 'sbah'; }
            if (hour === 20 && minute === 0) { file = 'Azkar_AL_MASA.txt'; key = 'masa'; }

            if (!file) return;

            // تاريخ اليوم زي "2024-1-15"
            const today = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;
            const state = loadState();

            // لو بعتنا النهارده قبل كده، اخرج
            if (state[key] === today) return;

            const filePath = path.join(__dirname, '..', file);
            if (!fs.existsSync(filePath)) {
                console.log(`⚠️ الملف ${file} غير موجود`);
                return;
            }
            const content = fs.readFileSync(filePath, 'utf8');

            for (const groupId of GROUP_ID) {
                try {
                    await sock.sendMessage(groupId, { text: content });
                } catch(e) {
                    console.log(`⚠️ فشل إرسال الأذكار للجروب ${groupId}:`, e.message);
                }
            }

            // حفظ إن النهارده اتبعت
            state[key] = today;
            saveState(state);

        }, 60000)
    }
}
