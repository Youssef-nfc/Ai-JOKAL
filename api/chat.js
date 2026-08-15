export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  try {
    const { message, history = [] } = req.body;
    if (!message) return res.status(400).json({ error: 'Message required' });

    const API_KEY = process.env.GEMINI_API_KEY;
    if (!API_KEY) return res.status(500).json({ error: 'API key missing' });

    const contents = [];
    
    // شخصية مختصرة = أسرع
    contents.push({
      role: 'user',
      parts: [{ text: `أنت JOKAL، مساعد مغربي ذكي. تتكلم بالدارجة. إجابات مختصرة ومفيدة. صاحبك يوسف.` }]
    });
    contents.push({
      role: 'model',
      parts: [{ text: 'فهمت يا صاحبي! أنا JOKAL جاهز.' }]
    });

    history.forEach(msg => {
      contents.push({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content }]
      });
    });

    contents.push({ role: 'user', parts: [{ text: message }] });

    // ⚡ Streaming = أسرع
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:streamGenerateContent?alt=sse&key=${API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents,
          generationConfig: { temperature: 0.7, maxOutputTokens: 512 }
        })
      }
    );

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const reader = geminiRes.body.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(value);
    }
    res.end();

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'شي مشكل فالسيرفر.' });
  }
}
