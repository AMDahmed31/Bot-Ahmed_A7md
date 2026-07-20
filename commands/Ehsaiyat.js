// إحصائيات الرسائل في المجموعة
const stats = new Map(); // groupId -> Map(userId -> { name, count })

module.exports = {
    commands: ['.إحصائيات'],

    // يتم استدعاء هذه الدالة من index.js لكل رسالة
    trackMessage(groupId, userId, userName) {
        if (!groupId || !userId) return;
        if (!stats.has(groupId)) stats.set(groupId, new Map());
        const group = stats.get(groupId);
        if (!group.has(userId)) group.set(userId, { name: userName || userId, count: 0 });
        group.get(userId).count++;
    },

    async execute(sock, msg, from, text) {
        try {
            // تأكد إن الأمر في مجموعة
            if (!from.endsWith('@g.us')) {
                await sock.sendMessage(from, { text: '❌ هذا الأمر للمجموعات فقط.' }, { quoted: msg });
                return;
            }

            await sock.sendMessage(from, { react: { text: '📊', key: msg.key } });

            const group = stats.get(from);
            if (!group || group.size === 0) {
                await sock.sendMessage(from, { text: '📊 لا توجد إحصائيات بعد.\nابدأ المحادثة وسيتم تسجيل الإحصائيات!' }, { quoted: msg });
                return;
            }

            // ترتيب الأعضاء حسب عدد الرسائل
            const sorted = [...group.entries()]
                .sort((a, b) => b[1].count - a[1].count)
                .slice(0, 10);

            const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
            const total = [...group.values()].reduce((sum, u) => sum + u.count, 0);

            let message = `📊 *إحصائيات المجموعة*\n───────────────────\n\n`;
            sorted.forEach(([ , user], i) => {
                const percent = Math.round((user.count / total) * 100);
                message += `${medals[i]} *${user.name}*\n`;
                message += `   💬 ${user.count} رسالة (${percent}%)\n\n`;
            });

            message += `───────────────────\n📨 *إجمالي الرسائل:* ${total}`;

            await sock.sendMessage(from, { text: message }, { quoted: msg });

        } catch (e) {
            console.error('stats error:', e.message);
            await sock.sendMessage(from, { text: '❌ حدث خطأ، حاول مرة أخرى.' }, { quoted: msg });
        }
    }
};