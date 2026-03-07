// worker_manager.js — ضعه في مجلد bot3 (مش commands)

const HEAVY_COMMANDS = new Set([
    'quran.js', 'Ai.js', 'Hekma.js', 'Hades.js',
    'Tazker.js', 'getpic.js', 'viewonce.js',
    'كيميا.js', 'rank.js', 'prayer.js'
]);

const MAX_CONCURRENT = 2; // أقصى عدد أوامر تقيلة في نفس الوقت
let activeTasks = 0;
const waitQueue = [];

function isHeavyCommand(filename) {
    return HEAVY_COMMANDS.has(filename);
}

async function runHeavy(fn, sock, from) {
    // لو الـ queue ممتلي — رد للمستخدم وانتظر
    if (activeTasks >= MAX_CONCURRENT) {
        console.log(`⏳ heavy queue full (${activeTasks}/${MAX_CONCURRENT})`);
        await sock.sendMessage(from, { text: '⏳ جاري تنفيذ طلب آخر، انتظر قليلاً...' });
        // انتظر في الـ queue
        await new Promise(resolve => waitQueue.push(resolve));
    }

    activeTasks++;
    console.log(`🔄 heavy task started (${activeTasks}/${MAX_CONCURRENT})`);

    try {
        // خلي event loop يتنفس قبل المهمة التقيلة
        await new Promise(resolve => setImmediate(resolve));
        await fn();
    } finally {
        activeTasks--;
        console.log(`✅ heavy task done (${activeTasks}/${MAX_CONCURRENT})`);
        // شغّل التالي في الـ queue
        if (waitQueue.length > 0) {
            const next = waitQueue.shift();
            next();
        }
    }
}

module.exports = { isHeavyCommand, runHeavy };

