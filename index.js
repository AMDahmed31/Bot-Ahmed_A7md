const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    fetchLatestBaileysVersion,
} = require('@whiskeysockets/baileys')
const pino = require('pino')
const fs = require('fs')
const path = require('path')
const QRCode = require('qrcode')

const commands = new Map()
const { isHeavyCommand, runHeavy } = require('./worker_manager')
const activeReactions = new Set()
const messageStore = new Map()

async function showQR(qr, accountName, authFolder) {
    try {
        const pathQR = `./${authFolder}-qr.png`;
        if (fs.existsSync(pathQR)) fs.unlinkSync(pathQR);
        await QRCode.toFile(pathQR, qr, { width: 500, margin: 2 });
        console.log(`\n✅ [${accountName}] QR جاهز: ${authFolder}-qr.png\n`);
    } catch (e) {
        console.log(`❌ خطأ في QR [${accountName}]:`, e.message);
    }
}

function loadConfig() {
    const configPath = './config.json';
    if (!fs.existsSync(configPath)) {
        const defaultConfig = {
            accounts: [{ name: 'الحساب الرئيسي', authFolder: 'auth_main' }]
        };
        fs.writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2));
        return defaultConfig;
    }
    return JSON.parse(fs.readFileSync(configPath, 'utf8'));
}

function saveConfig(config) {
    fs.writeFileSync('./config.json', JSON.stringify(config, null, 2));
}

function loadCommands() {
    const commandsDir = path.join(__dirname, 'commands');
    if (!fs.existsSync(commandsDir)) fs.mkdirSync(commandsDir);
    const commandFiles = fs.readdirSync(commandsDir).filter(f => f.endsWith('.js'));
    for (const file of commandFiles) {
        try {
            delete require.cache[require.resolve(path.join(commandsDir, file))];
            const cmd = require(path.join(commandsDir, file));
            commands.set(file, cmd);
        } catch (e) {
            console.log(`❌ خطأ في تحميل ${file}:`, e.message);
        }
    }
    console.log(`✅ تم تحميل ${commands.size} ملفات أوامر`);
}

async function connectAccount(accountName, authFolder, callerSock = null, callerFrom = null) {
    const { version } = await fetchLatestBaileysVersion();
    const { state, saveCreds } = await useMultiFileAuthState(authFolder);

    const sock = makeWASocket({
        version,
        logger: pino({ level: 'silent' }),
        auth: state,
        browser: ['Ubuntu', 'Chrome', '20.0.04'],
        syncFullHistory: false,
        markOnlineOnConnect: true,
        generateHighQualityLinkPreview: false,
        getMessage: async (key) => {
            const id = key.id;
            return messageStore.get(id);
        }
    });

    sock.ev.on('creds.update', saveCreds);

    // ✅ تحديث LID cache كلما جاءت بيانات مجموعة
    sock.ev.on('groups.update', (updates) => {
        const quizCmd = commands.get('quiz.js');
        if (!quizCmd?.updateLidCache) return;
        for (const update of updates) quizCmd.updateLidCache(update);
    });

    sock.ev.on('messages.update', async (updates) => {
        console.log('messages.update fired:', JSON.stringify(updates).slice(0, 200));
        const quizCmd = commands.get('quiz.js');
        if (!quizCmd?.onPollUpdate) return;
        for (const update of updates) {
            if (update.update?.pollUpdates) {
                quizCmd.onPollUpdate(sock, update);
            }
        }
    });

    sock.ev.on('group-participants.update', async ({ id }) => {
        try {
            const quizCmd = commands.get('quiz.js');
            if (!quizCmd?.updateLidCache) return;
            const meta = await sock.groupMetadata(id);
            quizCmd.updateLidCache(meta);
        } catch (_) {}
    });

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            if (callerSock && callerFrom) {
                await sendQRToChat(callerSock, callerFrom, qr, accountName, authFolder);
            } else {
                await showQR(qr, accountName, authFolder);
            }
        }

        if (connection === 'open') {
            console.log(`✅ [${accountName}] متصل!`);
            const GROUP_ID = ['120363360603895044@g.us', '120363424501614237@g.us'];
            setTimeout(() => { if (fs.existsSync('./commands/islamic.js')) require('./commands/islamic.js').scheduleAzkar(sock, GROUP_ID) }, 5000);
            setTimeout(() => { if (fs.existsSync('./commands/prayer.js')) require('./commands/prayer.js').schedulePrayer(sock) }, 7000);
            setTimeout(() => { if (fs.existsSync('./commands/auto_broadcast.js')) require('./commands/auto_broadcast.js').scheduleAutoBroadcast(sock) }, 10000);
        }

        if (connection === 'close') {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) {
                console.log(`🔄 [${accountName}] جاري إعادة الاتصال...`);
                setTimeout(() => connectAccount(accountName, authFolder), 5000);
            } else {
                console.log(`❌ [${accountName}] تم تسجيل الخروج. امسح مجلد ${authFolder} وأعد التشغيل.`);
            }
        }
    });

    sock.ev.on('messages.upsert', async (m) => {
        const msg = m.messages[0];
        if (!msg.message) return;

        const from = msg.key.remoteJid;
        if (from === 'status@broadcast') return;

        const isMe = msg.key.fromMe;
        const messageType = Object.keys(msg.message)[0];

        // ✅ تصويتات الاستطلاع — لا فلتر زمني هنا أبداً
        messageStore.set(msg.key.id, msg.message);
        if (messageStore.size > 1000) {
            const firstKey = messageStore.keys().next().value;
            messageStore.delete(firstKey);
        }
        if (messageType === 'pollUpdateMessage') {
            const quizCmd = commands.get('quiz.js');
            if (quizCmd?.onPollVote) quizCmd.onPollVote(sock, msg, from);
            return;
        }

        // فلتر الرسائل القديمة للرسائل العادية فقط
        if (msg.messageTimestamp && (Date.now() / 1000 - msg.messageTimestamp) > 30) return;

        // ── ردود الفعل ──
        if (messageType === 'reactionMessage' && isMe) {
            const reaction = msg.message.reactionMessage;
            const targetKey = reaction.key;
            const yourEmoji = reaction.text;
            const messageId = `${targetKey.remoteJid}-${targetKey.id}`;
            if (activeReactions.has(messageId)) return;
            if (targetKey.fromMe) return;
            activeReactions.add(messageId);
            const allEmojis = ['❤️','🧡','💛','💚','💙','💜','🖤','🤍','🔥','⚡','💫','💥','🌟','💢','💨','😂','🤣','😭','😍','🥰','😘','😎','🤔','👏','🙌','💪','🦾','👊','✊','🎉','🎊','🎈','🎁','🏆','🥇','👑','💎'];
            const shuffled = allEmojis.sort(() => Math.random() - 0.1);
            setTimeout(async () => {
                try {
                    const startTime = Date.now();
                    let currentIndex = 0;
                    while (Date.now() - startTime < 5000) {
                        await sock.sendMessage(from, { react: { text: shuffled[currentIndex], key: targetKey } });
                        await new Promise(r => setTimeout(r, Math.floor(Math.random() * 50) + 30));
                        currentIndex++;
                        if (currentIndex >= shuffled.length) { currentIndex = 0; shuffled.sort(() => Math.random() - 0.1); }
                    }
                    await new Promise(r => setTimeout(r, 200));
                    await sock.sendMessage(from, { react: { text: yourEmoji, key: targetKey } });
                } catch (e) {
                } finally {
                    setTimeout(() => activeReactions.delete(messageId), 6000);
                }
            }, 100);
            return;
        }

        // ── استخراج النص ──
        let text = '';
        if (messageType === 'conversation') text = msg.message.conversation;
        else if (messageType === 'extendedTextMessage') text = msg.message.extendedTextMessage.text;
        else if (messageType === 'imageMessage') text = msg.message.imageMessage.caption;
        else if (messageType === 'videoMessage') text = msg.message.videoMessage.caption;
        text = text?.trim() || '';

        // ── رد على رسالة البوت ──
        const contextInfo = msg.message?.extendedTextMessage?.contextInfo;
        const quotedMsg = contextInfo?.quotedMessage;
        const quotedParticipant = contextInfo?.participant;
        const isReplyToBot = quotedMsg && !quotedParticipant && !isMe;

        if (isReplyToBot) {
            for (const [, cmd] of commands) {
                if (cmd.commands && cmd.commands.some(c => text.startsWith(c))) {
                    try { await cmd.execute(sock, msg, from, text); } catch (e) {}
                    return;
                }
            }
            for (const [, cmd] of commands) {
                if (cmd.execute) {
                    try { await cmd.execute(sock, msg, from, text); } catch (e) {}
                    return;
                }
            }
            return;
        }

        // ── البحث عن الأمر ──
        let isCommand = false;
        let targetCommand = null;
        if (text) {
            for (const [, cmd] of commands) {
                if (cmd.commands && cmd.commands.some(c => text.startsWith(c))) {
                    isCommand = true;
                    targetCommand = cmd;
                    break;
                }
            }
        }

        if (isMe && !isCommand && !text.startsWith('.') && !text.startsWith('!')) return;
        if (isCommand && targetCommand) await targetCommand.execute(sock, msg, from, text);
    });

    return sock;
}

async function startAllAccounts() {
    const config = loadConfig();
    console.log(`\n🚀 جاري تشغيل ${config.accounts.length} حساب...\n`);
    for (const account of config.accounts) {
        if (!fs.existsSync(account.authFolder)) fs.mkdirSync(account.authFolder);
        console.log(`📱 جاري الاتصال بـ [${account.name}]...`);
        await connectAccount(account.name, account.authFolder);
        await new Promise(r => setTimeout(r, 2000));
    }
}

module.exports = { connectAccount, loadConfig, saveConfig };

loadCommands();
startAllAccounts();

process.on('uncaughtException', (err) => {
    if (err.message.includes('item-not-found') || err.message.includes('404')) console.log('🛡️ تم اعتراض خطأ (404).');
    else console.error('⚠️ خطأ:', err.message);
});
process.on('unhandledRejection', (reason) => {
    console.error('🛡️ رفض غير معالج:', reason?.message || reason);
});
