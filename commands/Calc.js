module.exports = {
    commands: ['.حساب'],
    async execute(sock, msg, from, text) {
        try {
            const parts = text.trim().split(' ');
            const expr = parts.slice(1).join(' ').trim();

            if (!expr) {
                await sock.sendMessage(from, { text: '❌ اكتب عملية حسابية.\nمثال: .حساب 5 + 3' }, { quoted: msg });
                return;
            }

            // نظف الأرقام العربية
            const clean = expr
                .replace(/٠/g,'0').replace(/١/g,'1').replace(/٢/g,'2')
                .replace(/٣/g,'3').replace(/٤/g,'4').replace(/٥/g,'5')
                .replace(/٦/g,'6').replace(/٧/g,'7').replace(/٨/g,'8')
                .replace(/٩/g,'9').replace(/×/g,'*').replace(/÷/g,'/')
                .replace(/[^0-9+\-*/().% ]/g, '');

            if (!clean) {
                await sock.sendMessage(from, { text: '❌ عملية غير صالحة.' }, { quoted: msg });
                return;
            }

            await sock.sendMessage(from, { react: { text: '🧮', key: msg.key } });

            const result = Function('"use strict"; return (' + clean + ')')();

            if (isNaN(result) || !isFinite(result)) {
                await sock.sendMessage(from, { text: '❌ لا يمكن إجراء هذه العملية.' }, { quoted: msg });
                return;
            }

            const message = `🧮 *الحساب*\n───────────────────\n\n📝 *العملية:* ${expr}\n✅ *النتيجة:* ${result}`;

            await sock.sendMessage(from, { text: message }, { quoted: msg });

        } catch (e) {
            await sock.sendMessage(from, { text: '❌ عملية غير صالحة.' }, { quoted: msg });
        }
    }
};