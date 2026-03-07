const fs = require('fs');
const path = require('path');
const cron = require('node-cron');

let cronTask = null;

function loadConfig() {
    try {
        const configPath = path.join(__dirname, '../config/broadcast_config.json');
        if (!fs.existsSync(configPath)) return null;
        return JSON.parse(fs.readFileSync(configPath, 'utf8'));
    } catch (err) {
        return null;
    }
}

function scheduleAutoBroadcast(sock) {
    const config = loadConfig();
    if (!config || !config.autoBroadcast.enabled) return;

    if (cronTask) {
        cronTask.stop();
    }

    const { schedule, timezone, delayBetweenGroups, groups, messagePrefix } = config.autoBroadcast;

    cronTask = cron.schedule(schedule, async () => {
        try {
            if (!sock || !sock.user) return;

            const jsonPath = path.join(__dirname, '../content_islam.json');
            if (!fs.existsSync(jsonPath)) {
                console.log('⚠️ ملف content_islam.json غير موجود');
                return;
            }

            const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
            if (!data || data.length === 0) return;

            const randomMessage = data[Math.floor(Math.random() * data.length)];
            const timeNow = new Date().toLocaleTimeString('ar-EG', { timeZone: timezone });
            
            console.log(`⏳ [${timeNow}] جاري الإرسال التلقائي...`);

            for (const jid of groups) {
                try {
                    if (!jid || !jid.endsWith('@g.us')) continue;

                    // إرسال مباشر مع محاولة تجاوز جلب البيانات لتقليل أخطاء 404
                    await sock.sendMessage(jid.trim(), { 
                        text: `${messagePrefix}${randomMessage}` 
                    });

                    console.log(`✅ نجح الإرسال لـ: ${jid}`);
                    
                    // تأخير بسيط بين المجموعات لتجنب الحظر والضغط
                    await new Promise(r => setTimeout(r, delayBetweenGroups));

                } catch (sendError) {
                    // في حالة فشل إرسال لمجموعة معينة، يكمل للباقي ولا ينهار
                    console.log(`⚠️ فشل الإرسال للعنوان ${jid} (قد يكون غير موجود) - تم التخطي.`);
                }
            }
        } catch (globalError) {
            console.error("❌ خطأ في مهمة الإرسال التلقائي:", globalError.message);
        }
    }, {
        scheduled: true,
        timezone: timezone
    });

    console.log(`✅ تم تفعيل الإرسال التلقائي بنجاح.`);
}

module.exports = { scheduleAutoBroadcast };

