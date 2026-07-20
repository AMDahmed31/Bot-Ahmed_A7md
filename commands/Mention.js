module.exports = {
    commands: ['.منشن', '.الكل', '.أرقام'],

    async execute(sock, msg, from, text) {
        try {
            // تأكد إنه جروب
            if (!from.endsWith('@g.us')) {
                return sock.sendMessage(from, { text: '❌ الأمر ده للجروبات بس' })
            }

            // بيانات الجروب
            const groupMetadata = await sock.groupMetadata(from)
            const participants = groupMetadata.participants
            const mentions = participants.map(p => p.id)

            // تحديد الأمر المستخدم
            const usedCommand = text.split(' ')[0]

            if (usedCommand === '.أرقام') {
                // جلب صورة المجموعة
                let groupImage = null
                try {
                    const ppUrl = await sock.profilePictureUrl(from, 'image')
                    const response = await fetch(ppUrl)
                    const buffer = await response.arrayBuffer()
                    groupImage = Buffer.from(buffer)
                } catch {
                    groupImage = null
                }

                // بناء الرسالة مع عدد الأعضاء والمنشن
                const memberCount = mentions.length
                let fullText = `╔══════════════════╗\n`
                fullText += `║  📢 منشن الجروب  ║\n`
                fullText += `╚══════════════════╝\n\n`
                fullText += `👥 عدد الأعضاء: *${memberCount}*\n\n`
                fullText += `📋 الأعضاء:\n`
                for (let user of mentions) {
                    fullText += `@${user.split('@')[0]}\n`
                }

                if (groupImage) {
                    await sock.sendMessage(from, {
                        image: groupImage,
                        caption: fullText,
                        mentions: mentions
                    }, { quoted: msg })
                } else {
                    await sock.sendMessage(from, {
                        text: fullText,
                        mentions: mentions
                    }, { quoted: msg })
                }

            } else {
                // .منشن أو .الكل - يبعت "الكل" مع منشن تقني
                await sock.sendMessage(from, {
                    text: 'الكل',
                    mentions: mentions
                }, { quoted: msg })
            }

            console.log(`📢 تم استخدام أمر ${usedCommand}`)

        } catch (e) {
            console.error('خطأ في تنفيذ الأمر:', e)
        }
    }
}