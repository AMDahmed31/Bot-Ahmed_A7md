// commands/youtube.js
// أمر تجميع قنوات يوتيوب حسب الكلمة المفتاحية + البلد + عدد المشتركين + آخر فيديو

const axios = require('axios')

// ⚠️ حط مفتاح الـ API بتاعك هنا (من Google Cloud Console)
const YT_API_KEY = 'AIzaSyDklZmDwQGBKXEB8JPRLkrajNJELC5EuvU'

// -------- خريطة أسماء الدول بالعربي لكود الدولة --------
const COUNTRY_MAP = {
    'مصر': 'EG', 'egypt': 'EG',
    'السعودية': 'SA', 'سعودية': 'SA', 'saudi': 'SA',
    'الإمارات': 'AE', 'الامارات': 'AE', 'uae': 'AE',
    'الكويت': 'KW', 'kuwait': 'KW',
    'قطر': 'QA', 'qatar': 'QA',
    'البحرين': 'BH', 'bahrain': 'BH',
    'عمان': 'OM', 'oman': 'OM',
    'الأردن': 'JO', 'الاردن': 'JO', 'jordan': 'JO',
    'لبنان': 'LB', 'lebanon': 'LB',
    'العراق': 'IQ', 'iraq': 'IQ',
    'سوريا': 'SY', 'syria': 'SY',
    'المغرب': 'MA', 'morocco': 'MA',
    'الجزائر': 'DZ', 'algeria': 'DZ',
    'تونس': 'TN', 'tunisia': 'TN',
    'ليبيا': 'LY', 'libya': 'LY',
    'السودان': 'SD', 'sudan': 'SD',
    'اليمن': 'YE', 'yemen': 'YE',
    'فلسطين': 'PS', 'palestine': 'PS'
}

function resolveCountry(raw) {
    if (!raw) return undefined
    const cleaned = raw.trim()
    // لو المستخدم كتب كود مباشر زي EG أو / EG
    const codeMatch = cleaned.match(/[A-Za-z]{2}\b/)
    if (codeMatch) return codeMatch[0].toUpperCase()
    const lower = cleaned.toLowerCase()
    for (const key in COUNTRY_MAP) {
        if (lower.includes(key.toLowerCase())) return COUNTRY_MAP[key]
    }
    return undefined
}

// -------- دالة تفصل الباراميترات من صيغة الأسطر --------
// مثال:
// .احصائيات يوتيوب
// الكلمات المفتاحية : طبخ
// الدولة : مصر
// مشتركين من : 1000
// مشتركين إلى : 100000
// اخر فيديو خلال : 7
// مشاهدات من : 500
// النتائج : 10
function parseParams(text) {
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
    const data = {}

    for (const line of lines) {
        const sepIndex = line.indexOf(':')
        if (sepIndex === -1) continue
        const label = line.slice(0, sepIndex).trim().toLowerCase()
        const value = line.slice(sepIndex + 1).trim()
        if (!value) continue

        if (label.includes('كلمات') || label.includes('كلمة')) data.keyword = value
        else if (label.includes('دولة') || label.includes('مدينة') || label.includes('بلد')) data.country = value
        else if (label.includes('مشتركين من') || label.includes('اشتراكات من')) data.minSubs = value
        else if (label.includes('مشتركين إلى') || label.includes('مشتركين الى') || label.includes('اشتراكات إلى') || label.includes('اشتراكات الى')) data.maxSubs = value
        else if (label.includes('اخر فيديو') || label.includes('آخر فيديو')) data.maxDays = value
        else if (label.includes('مشاهدات من') || label.includes('مشاهدات')) data.minViews = value
        else if (label.includes('نتائج') || label.includes('عدد النتائج')) data.limit = value
    }

    return {
        keyword: data.keyword || '',
        country: resolveCountry(data.country),
        minSubs: data.minSubs ? parseInt(data.minSubs) : undefined,
        maxSubs: data.maxSubs ? parseInt(data.maxSubs) : undefined,
        maxDaysSinceLastVideo: data.maxDays ? parseInt(data.maxDays) : undefined,
        minLastViews: data.minViews ? parseInt(data.minViews) : undefined,
        limit: data.limit ? parseInt(data.limit) : 10
    }
}

// -------- دالة البحث الرئيسية --------
async function searchChannels({ keyword, country, minSubs, maxSubs, maxDaysSinceLastVideo, minLastViews, limit }) {
    if (!keyword) throw new Error('لازم تكتب keyword')

    const searchRes = await axios.get('https://www.googleapis.com/youtube/v3/search', {
        params: {
            key: YT_API_KEY,
            q: keyword,
            type: 'channel',
            maxResults: 25,
            relevanceLanguage: 'ar', // يفضّل النتائج العربية في الترتيب
            ...(country ? { regionCode: country } : {})
        }
    })

    if (!searchRes.data.items || searchRes.data.items.length === 0) return []

    const channelIds = [...new Set(
        searchRes.data.items
            .filter(i => i.id && i.id.channelId)
            .map(i => i.id.channelId)
    )]
    if (channelIds.length === 0) return []

    const detailsRes = await axios.get('https://www.googleapis.com/youtube/v3/channels', {
        params: {
            key: YT_API_KEY,
            part: 'snippet,statistics,contentDetails',
            id: channelIds.join(',')
        }
    })

    const results = []

    for (const ch of detailsRes.data.items) {
        if (results.length >= limit) break

        const subs = parseInt(ch.statistics.subscriberCount || 0)
        if (minSubs && subs < minSubs) continue
        if (maxSubs && subs > maxSubs) continue
        if (country && ch.snippet.country && ch.snippet.country !== country) continue

        const uploadsPlaylistId = ch.contentDetails?.relatedPlaylists?.uploads
        if (!uploadsPlaylistId) continue

        let lastVidRes
        try {
            lastVidRes = await axios.get('https://www.googleapis.com/youtube/v3/playlistItems', {
                params: { key: YT_API_KEY, part: 'snippet', playlistId: uploadsPlaylistId, maxResults: 1 }
            })
        } catch (e) { continue }

        if (!lastVidRes.data.items.length) continue
        const lastVideo = lastVidRes.data.items[0]
        const videoId = lastVideo.snippet.resourceId.videoId
        const publishedAt = new Date(lastVideo.snippet.publishedAt)
        const daysSince = (Date.now() - publishedAt) / (1000 * 60 * 60 * 24)

        if (maxDaysSinceLastVideo && daysSince > maxDaysSinceLastVideo) continue

        const vidStatsRes = await axios.get('https://www.googleapis.com/youtube/v3/videos', {
            params: { key: YT_API_KEY, part: 'statistics', id: videoId }
        })
        const views = parseInt(vidStatsRes.data.items[0]?.statistics?.viewCount || 0)

        if (minLastViews && views < minLastViews) continue

        results.push({
            title: ch.snippet.title,
            subs,
            country: ch.snippet.country || 'غير محدد',
            lastVideoDate: publishedAt.toLocaleDateString('ar-EG'),
            lastVideoViews: views,
            url: `https://youtube.com/channel/${ch.id}`
        })
    }

    return results
}

// -------- تنسيق الرد --------
function formatResults(results, keyword) {
    if (results.length === 0) {
        return `❌ مفيش نتائج مطابقة للكلمة: "${keyword}"\nجرب تقلل الشروط (minSubs, maxDays...)`
    }

    let reply = `🔎 نتائج البحث عن "${keyword}"\n📊 عدد القنوات: ${results.length}\n\n`
    results.forEach((r, i) => {
        reply += `${i + 1}. 📺 *${r.title}*\n`
        reply += `👥 ${r.subs.toLocaleString()} مشترك\n`
        reply += `🌍 ${r.country}\n`
        reply += `📅 آخر فيديو: ${r.lastVideoDate}\n`
        reply += `👁️ ${r.lastVideoViews.toLocaleString()} مشاهدة\n`
        reply += `🔗 ${r.url}\n\n`
    })
    return reply
}

// -------- تصدير الأمر --------
module.exports = {
    commands: ['.احصائيات يوتيوب', '/احصائيات يوتيوب', '!احصائيات يوتيوب'],
    execute: async (sock, msg, from, text) => {
        try {
            const params = parseParams(text)

            if (!params.keyword) {
                await sock.sendMessage(from, {
                    text:
                        '📝 استخدام الأمر:\n\n' +
                        '.احصائيات يوتيوب\n' +
                        'الكلمات المفتاحية : طبخ\n' +
                        'الدولة : مصر\n' +
                        'مشتركين من : 1000\n' +
                        'مشتركين إلى : 100000\n' +
                        'اخر فيديو خلال : 7\n' +
                        'مشاهدات من : 500\n' +
                        'النتائج : 10\n\n' +
                        '• الكلمات المفتاحية: إجباري\n' +
                        '• الدولة: اسم الدولة بالعربي (مصر، السعودية...) أو كود زي EG\n' +
                        '• باقي الأسطر اختيارية، احذف أي سطر مش محتاجه'
                })
                return
            }

            await sock.sendMessage(from, { text: `⏳ جاري البحث عن "${params.keyword}"...` })

            const results = await searchChannels(params)
            const reply = formatResults(results, params.keyword)

            await sock.sendMessage(from, { text: reply })
        } catch (e) {
            console.log('❌ خطأ في أمر youtube:', e.message)
            await sock.sendMessage(from, { text: `❌ حصل خطأ: ${e.message}` })
        }
    }
}

