module.exports = {
    commands: ['.قائمة'],

    async execute(sock, msg, from, text) {
        const input = text.trim();
        if (input !== '.قائمة') return;

        await sock.sendMessage(from, { react: { text: '🤖', key: msg.key } });

        await sock.sendMessage(from, {
            text: `الأوامر`,
            footer: `الأزرار:-`,
            buttons: [
                {
                    buttonId: '.امر1',
                    buttonText: { displayText: 'الأمر الأول' },
                    type: 1
                },
                {
                    buttonId: '.امر2',
                    buttonText: { displayText: 'الأمر الثاني' },
                    type: 1
                },
                {
                    buttonId: '.امر3',
                    buttonText: { displayText: 'الثالث' },
                    type: 1
                }
            ],
            headerType: 1
        }, { quoted: msg });
    }
};

