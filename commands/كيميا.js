const axios = require('axios');

module.exports = {
    // جعلنا الأوامر تشمل كل الاحتمالات لضمان الاستجابة
    commands: ['كيمياء', 'كيميا', '.كيمياء', '.كيميا'],

    async execute(sock, msg, from, text) {
        // تنظيف النص من الأمر ليبقى السؤال فقط
        let input = text.replace(/^\.?كيمياء|^\.?كيميا/, '').trim().toLowerCase();

        // 1. إذا كتب المستخدم ".كيميا" فقط بدون أي شيء بعدها
        if (!input) {
            const menu = `🧪 *𝗠𝗢𝗗𝗘𝗥𝗡 𝗖𝗛𝗘𝗠𝗜𝗦𝗧𝗥𝗬 𝗟𝗔𝗕* ⚗️\n\n` +
                         `*دليل الأوامر الشغال 100%:*\n\n` +
                         `📑 *الجدول الدوري:* اكتب (.كيميا الجدول)\n` +
                         `🎨 *الألوان:* اكتب (.كيميا لون ابيض) أو (اسود/اصفر)\n` +
                         `🔬 *المركبات:* اكتب (.كيميا [اسم المركب])\n` +
                         `👨‍🔬 *العلماء:* اكتب (.كيميا [اسم العالم])\n` +
                         `📊 *الأدلة:* اكتب (.كيميا ادلة)\n\n` +
                         `_مثال: .كيميا لون ابيض_`;
            return await sock.sendMessage(from, { text: menu }, { quoted: msg });
        }

        // 2. إرسال صور الجدول الدوري
        if (input === 'الجدول' || input === 'جدول') {
            const tableUrl = "https://www.rsc.org/periodic-table/content/images/periodic-table.png";
            await sock.sendMessage(from, { react: { text: '🖼️', key: msg.key } });
            return await sock.sendMessage(from, { 
                image: { url: tableUrl }, 
                caption: "🧪 *الجدول الدوري الحديث*" 
            }, { quoted: msg });
        }

        // 3. قاعدة بيانات الألوان (من ملفاتك)
        const colorData = {
            "ابيض": "⚪ *الرواسب البيضاء (من ورقة الرواسب):*\n- AgCl: يذوب في النشادر ويصير بنفسجي في الضوء.\n- BaSO4: لا يذوب في حمض HCl.\n- CaSO4: كبريتات الكالسيوم.\n- MgCO3: راسب أبيض يتكون على البارد.",
            "اسود": "⚫ *الرواسب السوداء:*\n- Ag2S: كبريتيد الفضة.\n- PbS: كبريتيد الرصاص.\n- CuS: كبريتيد النحاس II.\n- FeO: مسحوق أسود لا يذوب في الماء.",
            "اصفر": "🟡 *الرواسب الصفراء:*\n- AgI: لا يذوب في النشادر.\n- Ag3PO4: يذوب في النشادر وحمض النيتريك.\n- ليمونيت: أصفر اللون (2Fe2O3.3H2O)."
        };

        if (input.startsWith('لون ')) {
            const colorName = input.replace('لون ', '').trim();
            if (colorData[colorName]) {
                return await sock.sendMessage(from, { text: colorData[colorName] }, { quoted: msg });
            }
        }

        // 4. قاعدة بيانات العلماء (من ملفاتك)
        const scientists = {
            "فوهلر": "👨‍🔬 *فوهلر:* حطم نظرية القوى الحيوية وحضر اليوريا في المختبر.",
            "كيكولي": "👨‍🔬 *كيكولي:* توصل للشكل السداسي للبنزين العطري.",
            "ماركونيكوف": "👨‍🔬 *ماركونيكوف:* وضع قاعدة إضافة المتفاعل غير المتماثل للألكين غير المتماثل.",
            "لوشاتيليه": "👨‍🔬 *لوشاتيليه:* درس تأثير الضغط والحرارة على الاتزان."
        };

        if (scientists[input]) {
            return await sock.sendMessage(from, { text: scientists[input] }, { quoted: msg });
        }

        // 5. الأدلة الكيميائية
        if (input === 'ادلة' || input === 'أدلة') {
            const indicators = `📊 *ألوان الأدلة:* \n\n` +
                               `- عباد الشمس: أحمر (حامض) | أزرق (قاعدي)\n` +
                               `- ميثيل برتقالي: أحمر (حامض) | أصفر (قاعدي)\n` +
                               `- فينولفثالين: عديم اللون (حامض) | أحمر وردي (قاعدي)`;
            return await sock.sendMessage(from, { text: indicators }, { quoted: msg });
        }

        // إذا لم يجد شيئاً في القاعدة الثابتة، يخبر المستخدم
        return await sock.sendMessage(from, { text: "❌ لم أجد هذه المعلومة في ملفات الكيمياء. تأكد من كتابة الأمر بشكل صحيح مثل: .كيميا لون ابيض" }, { quoted: msg });
    }
};
