// commands/points.js
const fs = require('fs');
const path = require('path');

// ==========================================
// ⚠️ إعدادات المطور
const OWNER_NUMBER = '201009390573'; 
// ==========================================

const DB_FILE = path.join(__dirname, '../points_db.json');

module.exports = {
    commands: ['.نقاط', '.النقاط', '.مسح النقاط', '.إضافة', '.حذف', '.مساعدة_نقاط', '.نقاط_عرض_الكل'],

    execute: async (sock, msg, from, text) => {

        // تحميل قاعدة البيانات
        let db = {};
        try {
            if (fs.existsSync(DB_FILE)) {
                db = JSON.parse(fs.readFileSync(DB_FILE));
            }
        } catch (e) { db = {}; }

        // تهيئة المجموعة
        if (!db[from]) {
            db[from] = { name: "مجموعة غير معروفة", users: {} };
        }
        const groupData = db[from]; 

        // ============================================================
        //  الأمر الأول: عرض النتائج (.نقاط)
        // ============================================================
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
                const p = usersList[userJid];
                const name = userJid.split('@')[0];
                rankingText += `*@${name} = ${p}*\n`;
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

            return await sock.sendMessage(from, {
                text: finalText,
                mentions: sortedUsers
            }, { quoted: msg });
        }

        // ============================================================
        //  الأمر الثاني: مسح نقاط المجموعة الحالية
        // ============================================================
        if (text.trim() === '.مسح النقاط') {
            db[from].users = {}; 
            fs.writeFileSync(DB_FILE, JSON.stringify(db));
            return await sock.sendMessage(from, { text: 'تم مسح النقاط وتصفير العداد لهذه المجموعة ✅' }, { quoted: msg });
        }

        // ============================================================
        //  الأمر الثالث: حذف عضو
        // ============================================================
        if (text.startsWith('.حذف')) {
            const mentions = msg.message.extendedTextMessage?.contextInfo?.mentionedJid;
            if (!mentions || mentions.length === 0) {
                return await sock.sendMessage(from, { text: '⚠️ منشن العضو لحذفه.' }, { quoted: msg });
            }
            let deletedCount = 0;
            for (const playerJid of mentions) {
                if (groupData.users[playerJid] !== undefined) {
                    delete groupData.users[playerJid];
                    deletedCount++;
                }
            }
            if (deletedCount > 0) {
                fs.writeFileSync(DB_FILE, JSON.stringify(db));
                await sock.sendMessage(from, { react: { text: "🗑️", key: msg.key } });
                return await sock.sendMessage(from, { text: `✅ تم حذف ${deletedCount} عضو من القائمة.` }, { quoted: msg });
            } else {
                return await sock.sendMessage(from, { text: '❌ غير موجود في قائمة هذه المجموعة.' }, { quoted: msg });
            }
        }

        // ============================================================
        //  الأمر الرابع: إضافة النقاط
        // ============================================================
        if (text.startsWith('.إضافة')) {
            const mentions = msg.message.extendedTextMessage?.contextInfo?.mentionedJid;
            if (!mentions || mentions.length === 0) return;

            try {
                if (from.endsWith('@g.us')) {
                    const metadata = await sock.groupMetadata(from);
                    db[from].name = metadata.subject;
                }
            } catch (e) {}

            let pointsToAdd = 0;
            const pointsMatch = text.match(/(\d+)\s*نقط/);
            if (pointsMatch) {
                pointsToAdd = parseInt(pointsMatch[1]);
            } else {
                const numbers = text.match(/\d+/g);
                if (numbers && numbers.length > 0) {
                    pointsToAdd = parseInt(numbers[numbers.length - 1]);
                } else {
                    pointsToAdd = 1;
                }
            }

            for (const playerJid of mentions) {
                if (!db[from].users[playerJid]) db[from].users[playerJid] = 0;
                db[from].users[playerJid] += pointsToAdd;
            }

            fs.writeFileSync(DB_FILE, JSON.stringify(db));
            await sock.sendMessage(from, { react: { text: "✅", key: msg.key } });
        }

        // ============================================================
        //  الأمر الخامس (للمطور): تقرير المجموعات
        // ============================================================
        if (text.trim() === '.نقاط_عرض_الكل') {
            const senderNumber = (msg.key.participant || msg.key.remoteJid).split('@')[0];
            
            // التعديل هنا: السماح للمطور أو إذا كانت الرسالة من البوت نفسه (fromMe)
            const isOwner = senderNumber === OWNER_NUMBER || msg.key.fromMe;

            if (!isOwner) {
                return await sock.sendMessage(from, { text: '⛔ هذا الأمر خاص بالمطور فقط.' }, { quoted: msg });
            }

            let fullReport = '📊 *تقرير شامل لجميع المجموعات* 📊\n\n';
            let hasData = false;

            for (const [groupId, data] of Object.entries(db)) {
                const usersInGroup = Object.keys(data.users || {});
                if (usersInGroup.length === 0) continue;

                hasData = true;
                const groupName = data.name || "مجموعة غير معروفة";
                let groupTotal = 0;
                let topUserText = '';
                
                const sortedGroupUsers = usersInGroup.sort((a, b) => data.users[b] - data.users[a]);
                if (sortedGroupUsers.length > 0) {
                    const top = sortedGroupUsers[0];
                    topUserText = `(الأول: @${top.split('@')[0]} بـ ${data.users[top]})`;
                }

                usersInGroup.forEach(u => groupTotal += data.users[u]);

                fullReport += `📂 *اسم المجموعة:* ${groupName}\n`;
                fullReport += `👥 المتسابقين: ${usersInGroup.length}\n`;
                fullReport += `📈 مجموع النقاط: ${groupTotal}\n`;
                fullReport += `${topUserText}\n`;
                fullReport += `>>>>>>>>>\n`;
            }

            if (!hasData) fullReport += "لا توجد أي بيانات نشطة.";

            return await sock.sendMessage(from, { text: fullReport }, { quoted: msg });
        }

        // ============================================================
        //  دليل المساعدة
        // ============================================================
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

