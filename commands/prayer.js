const { PrayerTimes, Coordinates, CalculationMethod } = require('adhan');
const cron = require('node-cron');

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

let lastNotifiedTime = "";

function schedulePrayer(sock) {
    const groupIds = [
        '120363422240545748@g.us',
        '120363422809321259@g.us',
        '120363424501614237@g.us'
    ];

    const coords = new Coordinates(30.0444, 31.2357);
    const params = CalculationMethod.Egyptian();

    cron.schedule('* * * * *', async () => {
        try {
            const date = new Date();
            const prayerTimes = new PrayerTimes(coords, date, params);
            
            const now = date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

            if (lastNotifiedTime === now) return;

            const prayers = {
                fajr:    { name: 'الـفجر',  time: prayerTimes.fajr.toLocaleTimeString('en-GB',    { hour: '2-digit', minute: '2-digit' }) },
                dhuhr:   { name: 'الـظهر',  time: prayerTimes.dhuhr.toLocaleTimeString('en-GB',   { hour: '2-digit', minute: '2-digit' }) },
                asr:     { name: 'الـعصر',  time: prayerTimes.asr.toLocaleTimeString('en-GB',     { hour: '2-digit', minute: '2-digit' }) },
                maghrib: { name: 'الـمغرب', time: prayerTimes.maghrib.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) },
                isha:    { name: 'الـعشاء', time: prayerTimes.isha.toLocaleTimeString('en-GB',    { hour: '2-digit', minute: '2-digit' }) },
            };

            for (let p in prayers) {
                if (now === prayers[p].time) {
                    lastNotifiedTime = now;
                    
                    console.log(`[PRAYER] حان موعد صلاة ${prayers[p].name}، جاري إرسال المنشن...`);

                    for (let id of groupIds) {
                        try {
                            const metadata = await sock.groupMetadata(id);
                            const participants = metadata.participants.map(u => u.id);

                            const prayerMsg = `صـلاتك هي أول طـريق لنجاحك ، نـاس كتير نجحت بسبب الصلاة\n\n*حـان الآن مـوعد صـلاة ${prayers[p].name} أثابكم الله* ❤️‍🩹`;

                            await sock.sendMessage(id, {
                                text: prayerMsg,
                                mentions: participants
                            });

                            // ✅ تأخير ثانيتين بين كل جروب والتاني
                            await delay(2000);

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
        await sock.sendMessage(from, { text: "✅ نظام مواقيت الصلاة مفعل الآن وسيعمل في الخلفية تلقائياً." });
    },
    schedulePrayer
};
