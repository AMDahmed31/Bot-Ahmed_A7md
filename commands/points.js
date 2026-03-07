// commands/points.js
const fs = require('fs');
const path = require('path');

const OWNER_NUMBER = '201009390573';
const DB_FILE = path.join(__dirname, '../points_db.json');

module.exports = {
    commands: ['.نقاط', '.النقاط', '.مسح النقاط', '.إضافة', '.حذف', '.مساعدة_نقاط', '.نقاط_عرض_الكل'],

    execute: async (sock, msg, from, text) => {
        let db = {};
        try {
            if (fs.existsSync(DB_FILE)) db = JSON.parse(fs.readFileSync(DB_FILE));
        } catch (e) { db = {}; }

        if (!db[from]) db[from] = { name: "مجموعة غير معروفة", users: {} };
        const groupData = db[from];

        if (text.trim() === '.نقاط' || text.trim() === '.النقاط') {
            const usersList = groupData.users || {};
            const usersIds = Object.keys(usersList);
            const userCount = usersIds.length;
            let totalPoints = 0;
            usersIds.forEach(u => totalPoints += usersList[u]);
            const sortedUsers = usersIds.sort((a, b) => usersList[b] - usersList[a]);

            let winnerLine1 = 'غير معروف';
            let winnerLine2 = '"غير معروف"';
            if (userCount > 1 && sortedUsers.length > 0 && usersList[sortedUsers[0]] > 0) {
                const topName = sortedUsers[0].split('@')[0];
                winnerLine1 = `🏆*"@${topName}"*`;
                winnerLine2 = `"@${topName} 🏆"`;
            }

            let rankingText = '';
            sortedUsers.forEach((userJid) => {
                rankingText += `*@${userJid.split('@')[0]} = ${usersList[userJid]}*\n`;
            });

            const finalText = `
《تشغيل نظام النقاط》
____________________

عدد للاعضاء المذكورين = \`${userCount}\`
><><><><><><><><><
المجموع الكلي للاعضاء = ${totalPoints}
______________

التصنيف :
${rankingText}
الفائز ${winnerLine1}

الفائز في المسابقه ${winnerLine2}

لمعرفة الاوامر اكتب: .مساعدة_نقاط
`.trim();
            return await sock.sendMessage(from, { text: finalText, mentions: sortedUsers }, { quoted: msg });
        }

        if (text.trim() === '.مسح النقاط') {
            db[from].users = {};
            fs.writeFileSync(DB_FILE, JSON.stringify(db));
            return await sock.sendMessage(from, { text: 'تم مسح النقاط وتصفير العداد لهذه المجموعة ✅' }, { quoted: msg });
        }

        if (text.startsWith('.حذف')) {
            const mentions = msg.message.extendedTextMessage?.contextInfo?.mentionedJid;
            if (!mentions || mentions.length === 0)
                return await sock.sendMessage(from, { text: '⚠️ منشن العضو لحذفه.' }, { quoted: msg });
            let deletedCount = 0;
            for (const playerJid of mentions) {
                if (groupData.users[playerJid] !== undefined) { delete groupData.users[playerJid]; deletedCount++; }
            }
            if (deletedCount > 0) {
                fs.writeFileSync(DB_FILE, JSON.stringify(db));
                await sock.sendMessage(from, { react: { text: "🗑️", key: msg.key } });
                return await sock.sendMessage(from, { text: `✅ تم حذف ${deletedCount} عضو من القائمة.` }, { quoted: msg });
            }
            return await sock.sendMessage(from, { text: '❌ غير موجود في قائمة هذه المجموعة.' }, { quoted: msg });
        }

        if (text.startsWith('.إضافة')) {
            const mentions = msg.message.extendedTextMessage?.contextInfo?.mentionedJid;
            if (!mentions || mentions.length === 0) return;
            try {
                if (from.endsWith('@g.us')) {
                    const metadata = await sock.groupMetadata(from);
                    db[from].name = metadata.subject;
                }
            } catch (e) {}
            let pointsToAdd = 1;
            const pointsMatch = text.match(/(\d+)\s*نقط/);
            if (pointsMatch) {
                pointsToAdd = parseInt(pointsMatch[1]);
            } else {
                const numbers = text.match(/\d+/g);
                if (numbers && numbers.length > 0) pointsToAdd = parseInt(numbers[numbers.length - 1]);
            }
            for (const playerJid of mentions) {
                if (!db[from].users[playerJid]) db[from].users[playerJid] = 0;
                db[from].users[playerJid] += pointsToAdd;
            }
            fs.writeFileSync(DB_FILE, JSON.stringify(db));
            await sock.sendMessage(from, { react: { text: "✅", key: msg.key } });
        }

        if (text.trim() === '.نقاط_عرض_الكل') {
            const senderNumber = (msg.key.participant || msg.key.remoteJid).split('@')[0];
            const isOwner = senderNumber === OWNER_NUMBER || msg.key.fromMe;
            if (!isOwner)
                return await sock.sendMessage(from, { text: '⛔ هذا الأمر خاص بالمطور فقط.' }, { quoted: msg });

            let fullReport = '📊 *تقرير شامل لجميع المجموعات* 📊\n\n';
            let hasData = false;
            for (const [groupId, data] of Object.entries(db)) {
                const usersInGroup = Object.keys(data.users || {});
                if (usersInGroup.length === 0) continue;
                hasData = true;
                const sortedGroupUsers = usersInGroup.sort((a, b) => data.users[b] - data.users[a]);
                let groupTotal = 0;
                usersInGroup.forEach(u => groupTotal += data.users[u]);
                const top = sortedGroupUsers[0];
                fullReport += `📂 *${data.name || 'مجموعة غير معروفة'}*\n`;
                fullReport += `👥 المتسابقين: ${usersInGroup.length} | 📈 النقاط: ${groupTotal}\n`;
                fullReport += `🥇 الأول: @${top.split('@')[0]} بـ ${data.users[top]}\n`;
                fullReport += `━━━━━━━━━\n`;
            }
            if (!hasData) fullReport += "لا توجد أي بيانات نشطة.";
            return await sock.sendMessage(from, { text: fullReport }, { quoted: msg });
        }

        if (text.trim() === '.مساعدة_نقاط') {
            const helpText = `
📜 *دليل أوامر نظام النقاط* 📜

1️⃣ *عرض النتائج:* .نقاط
2️⃣ *إضافة نقاط:* .إضافة @منشن (النقاط)نقطه
   مثال: _.إضافة @احمد 5نقطه_
3️⃣ *حذف عضو:* .حذف @منشن
4️⃣ *تصفير المجموعة:* .مسح النقاط

🔐 *للمطور:* .نقاط_عرض_الكل
`.trim();
            return await sock.sendMessage(from, { text: helpText }, { quoted: msg });
        }
    }
};