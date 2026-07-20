const axios = require('axios');

module.exports = {
    commands: ['بنترست', 'pinterest', 'صورة'],
    description: 'بحث عن صور من Pinterest',

    async execute(sock, msg, from, text) {
        const args = text.split(' ');
        args.shift();
        const query = args.join(' ').trim();

        if (!query) {
            return await sock.sendMessage(from, {
                text: '🔍 اكتب كلمة للبحث\n\nمثال: بنترست قطط'
            });
        }

        await sock.sendMessage(from, { text: '⏳ جاري البحث عن: ' + query });

        try {
            const response = await axios.get('https://scrapper-lyart.vercel.app/pinterest', {
                params: { q: query },
                timeout: 20000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Accept': 'application/json'
                }
            });

            console.log('Response:', JSON.stringify(response.data).slice(0, 500));

            let images = [];

            const data = response.data;
            if (Array.isArray(data)) {
                images = data;
            } else if (data?.data && Array.isArray(data.data)) {
                images = data.data;
            } else if (data?.results && Array.isArray(data.results)) {
                images = data.results;
            } else if (data?.images && Array.isArray(data.images)) {
                images = data.images;
            }

            // لو الصور objects استخرج الـ URL
            images = images.map(img => {
                if (typeof img === 'string') return img;
                return img?.url || img?.image || img?.src || img?.link || null;
            }).filter(img => img && img.startsWith('http'));

            if (images.length === 0) {
                console.log('Full response:', JSON.stringify(response.data));
                return await sock.sendMessage(from, {
                    text: '❌ لم أجد نتائج، جرب كلمة أخرى'
                });
            }

            const limit = Math.min(5, images.length);
            await sock.sendMessage(from, { text: `✅ وجدت ${images.length} صورة، سأرسل ${limit}` });

            for (let i = 0; i < limit; i++) {
                try {
                    await sock.sendMessage(from, {
                        image: { url: images[i] },
                        caption: `🖼️ ${i + 1} / ${limit}`
                    });
                    await new Promise(r => setTimeout(r, 1500));
                } catch (e) {
                    console.error('فشل إرسال صورة:', e.message);
                }
            }

        } catch (error) {
            console.error('خطأ:', error.message);
            await sock.sendMessage(from, {
                text: '❌ خطأ: ' + error.message
            });
        }
    }
};