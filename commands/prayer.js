const { PrayerTimes, Coordinates, CalculationMethod } = require('adhan');
const cron = require('node-cron');

// متغير لمنع تكرار الإرسال في نفس الدقيقة
let lastNotifiedTime = "";

function schedulePrayer(sock) {
    // إيديهات الجروبات
    const groupIds = [
        '120363422240545748@g.us'
    ];

    // إعدادات الموقع (القاهرة، مصر)
    const coords = new Coordinates(30.0444, 31.2357);
    const params = CalculationMethod.Egyptian();

    // تشغيل الكرون كل دقيقة
    cron.schedule('* * * * *', async () => {
        try {
            const date = new Date();
            const prayerTimes = new PrayerTimes(coords, date, params);
            
            // صيغة الوقت الحالية (ساعة:دقيقة)
            const now = date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

            // إذا تم الإرسال مسبقاً في هذه الدقيقة، اخرج منعاً للضغط
            if (lastNotifiedTime === now) return;

            const prayers = {
                fajr: { name: 'الـفجر', time: prayerTimes.fajr.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) },
                dhuhr: { name: 'الـظهر', time: prayerTimes.dhuhr.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) },
                asr: { name: 'الـعصر', time: prayerTimes.asr.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) },
                maghrib: { name: 'الـمغرب', time: prayerTimes.maghrib.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) },
                isha: { name: 'الـعشاء', time: prayerTimes.isha.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) },
            };

            for (let p in prayers) {
                if (now === prayers[p].time) {
                    lastNotifiedTime = now; // تحديث وقت آخر إرسال فوراً
                    
                    console.log(`[PRAYER] حان موعد صلاة ${prayers[p].name}، جاري إرسال المنشن...`);

                    for (let id of groupIds) {
                        try {
                            // جلب الميتاداتا (نطلبها فقط عند وقت الصلاة لتوفير الرام)
                            const metadata = await sock.groupMetadata(id);
                            const participants = metadata.participants.map(u => u.id);

                            const prayerMsg = `صـلاتك هي أول طـريق لنجاحك ، نـاس كتير نجحت بسبب الصلاة\n\n*حـان الآن مـوعد صـلاة ${prayers[p].name} أثابكم الله* ❤️‍🩹`;

                            await sock.sendMessage(id, {
                                text: prayerMsg,
                                mentions: participants
                            });

                        } catch (err) {
                            console.error(`❌ فشل الإرسال للجروب ${id}:`, err.message);
                        }
                    }
                }
            }
        } catch (globalErr) {
            console.error("❌ خطأ في نظام جدولة الصلاة:", globalErr.message);
        }
    });
}

module.exports = {
    commands: ['تفعيل_الصلاة'],
    execute: async (sock, msg, from) => {
        // رسالة تأكيد عند كتابة الأمر
        await sock.sendMessage(from, { text: "✅ نظام مواقيت الصلاة مفعل الآن وسيعمل في الخلفية تلقائياً." });
    },
    schedulePrayer
};

