require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
const PORT = 5000;

app.use(cors());
app.use(express.json());

// --- HELPERS ---
function extractVideoId(url) {
    const regex = /(?:youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
    const match = url.match(regex);
    return match ? match[1] : null;
}

function extractKeywords(text) {
    if (!text) return { bigrams: [], trigrams: [] };
    const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'shall', 'should', 'may', 'might', 'must', 'can', 'could', 'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her', 'us', 'them', 'my', 'your', 'his', 'its', 'our', 'their', 'what', 'which', 'who', 'whom', 'so', 'if', 'as', 'not', 'no', 'up', 'out', 'just', 'about', 'into', 'over', 'after', 'all', 'also', 'how', 'from']);
    const cleanText = text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ');
    const words = cleanText.split(/\s+/).filter(word => word.length > 1 && !stopWords.has(word));
    const getNgrams = (n) => {
        const ngrams = {};
        for (let i = 0; i <= words.length - n; i++) {
            const phrase = words.slice(i, i + n).join(' ');
            ngrams[phrase] = (ngrams[phrase] || 0) + 1;
        }
        return Object.entries(ngrams).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([phrase, count]) => ({ phrase, count }));
    };
    return { bigrams: getNgrams(2), trigrams: getNgrams(3) };
}

// --- ROUTE 1: ANALYZE VIDEO ---
app.post('/api/analyze', async (req, res) => {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: 'Please provide a YouTube URL' });
    const videoId = extractVideoId(url);
    if (!videoId) return res.status(400).json({ error: 'Invalid YouTube URL format' });

    try {
        const apiUrl = `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&id=${videoId}&key=${process.env.YOUTUBE_API_KEY}`;
        const response = await axios.get(apiUrl);
        if (response.data.items.length === 0) return res.status(404).json({ error: 'Video not found' });

        const snippet = response.data.items[0].snippet;
        const stats = response.data.items[0].statistics;
        const textToAnalyze = `${snippet.title} ${snippet.description}`;
        
        const analysisResult = {
            title: snippet.title,
            description: snippet.description,
            channelTitle: snippet.channelTitle,
            tags: snippet.tags || [],
            thumbnails: snippet.thumbnails,
            stats: { views: stats.viewCount, likes: stats.likeCount, comments: stats.commentCount },
            keywords: extractKeywords(textToAnalyze)
        };
        res.status(200).json(analysisResult);
    } catch (error) {
        if (error.response && error.response.status === 403) return res.status(403).json({ error: 'YouTube API Key invalid or quota exceeded.' });
        res.status(500).json({ error: 'Error fetching YouTube data.' });
    }
});

// --- ROUTE 2: AI GENERATOR ---
app.post('/api/generate', async (req, res) => {
    const { keywords, originalTitle } = req.body;
    if (!keywords) return res.status(400).json({ error: 'No keywords provided' });

    try {
        const keywordList = [...keywords.bigrams.map(k => k.phrase), ...keywords.trigrams.map(k => k.phrase)].join(', ');
        const prompt = `You are a YouTube SEO expert. I am analyzing a competitor video titled "${originalTitle}". I extracted the following SEO keywords from their video: ${keywordList}. Please generate: 1. Three highly clickable, SEO-friendly YouTube titles that use these keywords. 2. One YouTube description optimized for these keywords. Include a placeholder for timestamps and a "Links:" section at the bottom. Format your response EXACTLY like this: Title 1: [Title here] Title 2: [Title here] Title 3: [Title here] Description: [Description here]`;

        const groqResponse = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
            model: "llama-3.1-8b-instant", 
            messages: [{ role: "user", content: prompt }],
            temperature: 0.7
        }, {
            headers: { 'Authorization': `Bearer ${process.env.GROQ_API_KEY}`, 'Content-Type': 'application/json' }
        });

        const aiText = groqResponse.data.choices[0].message.content;
        res.status(200).json({ generatedText: aiText });
    } catch (error) {
        res.status(500).json({ error: 'Failed to generate AI content. Check your Groq API key.' });
    }
});

// --- ROUTE 3: KEYWORD COMPETITION CHECKER ---
app.post('/api/check-keyword', async (req, res) => {
    const { keyword } = req.body;
    if (!keyword) return res.status(400).json({ error: 'Please provide a keyword' });

    try {
        const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(keyword)}&type=video&maxResults=5&order=relevance&key=${process.env.YOUTUBE_API_KEY}`;
        const searchResponse = await axios.get(searchUrl);
        if (searchResponse.data.items.length === 0) return res.status(404).json({ error: 'No videos found for this keyword.' });

        const videoIds = searchResponse.data.items.map(item => item.id.videoId).join(',');
        const statsUrl = `https://www.googleapis.com/youtube/v3/videos?part=statistics,snippet&id=${videoIds}&key=${process.env.YOUTUBE_API_KEY}`;
        const statsResponse = await axios.get(statsUrl);

        const topVideos = statsResponse.data.items.map(video => ({
            title: video.snippet.title,
            views: parseInt(video.statistics.viewCount, 10),
            channel: video.snippet.channelTitle
        }));

        const totalViews = topVideos.reduce((acc, curr) => acc + curr.views, 0);
        const avgViews = totalViews / topVideos.length;

        let competitionLevel = 'Low';
        let competitionColor = 'green';
        if (avgViews > 1000000) { competitionLevel = 'High'; competitionColor = 'red'; }
        else if (avgViews > 100000) { competitionLevel = 'Medium'; competitionColor = 'orange'; }

        res.status(200).json({
            keyword: keyword,
            competitionLevel: competitionLevel,
            competitionColor: competitionColor,
            avgViews: Math.round(avgViews),
            topVideos: topVideos
        });
    } catch (error) {
        res.status(500).json({ error: 'Error checking keyword competition.' });
    }
});

// --- ROUTE 4: AI TAG GENERATOR ---
app.post('/api/generate-tags', async (req, res) => {
    const { title, keyword } = req.body;
    if ((!title && !keyword)) return res.status(400).json({ error: 'Please provide a title or keyword' });

    try {
        const context = title || keyword;
        const prompt = `I am making a YouTube video about: "${context}". Generate a comma-separated list of exactly 20 highly optimized YouTube SEO tags. Do not include hashtags (#). Do not include quotation marks. Just the comma-separated words.`;

        const groqResponse = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
            model: "llama-3.1-8b-instant", 
            messages: [{ role: "user", content: prompt }],
            temperature: 0.5
        }, {
            headers: { 'Authorization': `Bearer ${process.env.GROQ_API_KEY}`, 'Content-Type': 'application/json' }
        });

        const rawTags = groqResponse.data.choices[0].message.content;
        const tagsArray = rawTags.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0);
        res.status(200).json({ tags: tagsArray });
    } catch (error) {
        res.status(500).json({ error: 'Failed to generate tags.' });
    }
});

// --- ROUTE 5: SEO GRADER ---
app.post('/api/grade', async (req, res) => {
    const { title, description, targetKeyword } = req.body;
    
    if (!title || !description || !targetKeyword) {
        return res.status(400).json({ error: 'Please provide title, description, and target keyword.' });
    }

    let score = 0;
    const feedback = [];
    const lowerTitle = title.toLowerCase();
    const lowerDesc = description.toLowerCase();
    const lowerKeyword = targetKeyword.toLowerCase();

    if (title.length >= 50 && title.length <= 70) {
        score += 25; feedback.push({ text: "Title length is perfect (50-70 characters).", type: "good" });
    } else if (title.length < 50) {
        score += 10; feedback.push({ text: `Title is too short (${title.length} chars). Aim for 50-70.`, type: "bad" });
    } else {
        score += 15; feedback.push({ text: `Title is slightly too long (${title.length} chars). It may get cut off.`, type: "okay" });
    }

    if (description.length >= 1000) {
        score += 25; feedback.push({ text: "Description length is excellent (1000+ characters).", type: "good" });
    } else if (description.length >= 500) {
        score += 15; feedback.push({ text: `Description is okay (${description.length} chars), but aim for 1000+.`, type: "okay" });
    } else {
        score += 5; feedback.push({ text: `Description is too short (${description.length} chars).`, type: "bad" });
    }

    if (lowerTitle.includes(lowerKeyword)) {
        score += 25; feedback.push({ text: `Target keyword "${targetKeyword}" is in the title.`, type: "good" });
    } else {
        score += 0; feedback.push({ text: `Target keyword "${targetKeyword}" is MISSING from the title!`, type: "bad" });
    }

    const first25Words = lowerDesc.split(' ').slice(0, 25).join(' ');
    if (first25Words.includes(lowerKeyword)) {
        score += 25; feedback.push({ text: `Target keyword is in the first 25 words of the description.`, type: "good" });
    } else if (lowerDesc.includes(lowerKeyword)) {
        score += 15; feedback.push({ text: `Target keyword is in the description, but NOT in the first 25 words.`, type: "okay" });
    } else {
        score += 0; feedback.push({ text: `Target keyword is MISSING from the description entirely!`, type: "bad" });
    }

    res.status(200).json({ score, feedback });
});

// --- ROUTE 6: CONTENT GAP FINDER (Feature 7) ---
app.post('/api/find-gaps', async (req, res) => {
    const { keywords, originalTitle, description } = req.body;
    if (!keywords) return res.status(400).json({ error: 'No keywords provided' });

    try {
        const keywordList = [...keywords.bigrams.map(k => k.phrase), ...keywords.trigrams.map(k => k.phrase)].join(', ');
        
        // We pass a snippet of the description so the AI knows what the video actually covers
        const descSnippet = description ? description.substring(0, 500) : "No description provided";

        const prompt = `You are a YouTube growth strategist. A competitor made a successful video titled "${originalTitle}" targeting these keywords: ${keywordList}. 
        Here is a snippet of what their video covers: "${descSnippet}".
        
        Based on this topic, what are 5 highly specific video ideas that this creator FAILED to make, but their audience is definitely searching for? These should be adjacent topics, beginner mistakes, or advanced tips they missed.
        
        Format the response EXACTLY as a numbered list (1. 2. 3. 4. 5.). Do not include any intro or outro text.`;

        const groqResponse = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
            model: "llama-3.1-8b-instant", 
            messages: [{ role: "user", content: prompt }],
            temperature: 0.8 // Slightly higher for creative ideas
        }, {
            headers: { 'Authorization': `Bearer ${process.env.GROQ_API_KEY}`, 'Content-Type': 'application/json' }
        });

        const ideasText = groqResponse.data.choices[0].message.content;
        res.status(200).json({ ideasText });
    } catch (error) {
        res.status(500).json({ error: 'Failed to generate content ideas.' });
    }
});

app.listen(PORT, () => {
    console.log(`🚀 YouTube SEO Backend running on http://localhost:${PORT}`);
});