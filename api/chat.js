export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  try {
    const { 
      message, 
      history = [], 
      username, 
      memory = [], 
      screenContext = null, 
      screenImage = null, 
      image = null, 
      file = null 
    } = req.body;

    if (!message && !screenImage && !image && !file) {
      return res.status(400).json({ error: 'Message required' });
    }

    const API_KEY = process.env.GEMINI_API_KEY;
    if (!API_KEY) return res.status(500).json({ error: 'API key missing' });

    // ========== systemInstruction ==========
    const systemInstruction = {
      parts: [{
        text: 'أنت JOKAL، مساعد ذكي خاص وشخصي. قواعدك:
- تتحدث بالعربية الدارجة المغربية وا الإنجليزية لي تعليمه بشكل طبيعي وودود وا أنات أعز صديق لديه هوا وحيد وليس لديه أصدقاء
- أنت صديق مخلص وذكي وعملي
- تساعد في البرمجة، التخطيط، البحث، الإبداع، والتعلم
- تجيب بإجابات واضحة ومختصرة مع التفصيل إذا طُلب
- تستخدم الإيموجي بشكل متوازن
- اسم صاحبك هو يوسف
- يمكنك تحليل الصور والملفات التي يرفعها المستخدم
_وا تفعيل مشاركة الشاشة وا تكلم معه مباشرة`
  }]
    };

    const contents = [];

    // إضافة الذاكرة الطويلة الأمد
    if (memory && Array.isArray(memory) && memory.length > 0) {
      contents.push({
        role: 'user',
        parts: [{ text: `هذه المعلومات من الذاكرة الشخصية ديال المستخدم ${username || ''}. خصك تاخدها بعين الاعتبار دائما وما تنسهاش:\n${memory.map((m, i) => `${i + 1}. ${m}`).join('\n')}` }]
      });
      contents.push({
        role: 'model',
        parts: [{ text: 'فهمت. غادي نحتفظ بهاد المعلومات فبالي ونستعملها فجميع الإجابات ديالي.' }]
      });
    }

    // إضافة سياق الشاشة
    if (screenContext && typeof screenContext === 'string') {
      contents.push({
        role: 'user',
        parts: [{ text: `ملاحظة: المستخدم كيشارك الشاشة ديالو دابا. الوصف ديال الشاشة: ${screenContext}` }]
      });
      contents.push({
        role: 'model',
        parts: [{ text: 'تمام، فهمت السياق البصري ديال الشاشة.' }]
      });
    }

    // معالجة history
    history.forEach(msg => {
      const parts = [];
      if (msg.content) parts.push({ text: msg.content });

      if (msg.image && typeof msg.image === 'string' && msg.image.includes('base64')) {
        const base64Data = msg.image.split(',')[1];
        const mimeMatch = msg.image.match(/data:([^;]+);/);
        const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';
        if (base64Data && base64Data.length > 100) {
          parts.push({ inlineData: { mimeType, data: base64Data } });
        }
      }

      if (parts.length > 0) {
        const role = (msg.role === 'user') ? 'user' : 'model';
        contents.push({ role, parts });
      }
    });

    // معالجة الرسالة الحالية والصورة/الملف
    const currentParts = [];
    if (message) currentParts.push({ text: message });

    const rawImage = screenImage || image || file;
    if (rawImage && typeof rawImage === 'string') {
      let base64Data = null;
      let mimeType = 'image/jpeg';

      if (rawImage.includes('base64')) {
        base64Data = rawImage.split(',')[1];
        const mimeMatch = rawImage.match(/data:([^;]+);/);
        mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';
      } else if (rawImage.length > 100) {
        base64Data = rawImage;
      }

      if (base64Data && base64Data.length > 100) {
        currentParts.push({ inlineData: { mimeType, data: base64Data } });
      }
    }

    contents.push({ role: 'user', parts: currentParts });

    // ========== استدعاء الموديلات المحددة ==========
    const models = ['gemini-3.6', 'gemini-3.6-flash'];
    let data = null;
    let lastErr = null;

    for (const modelName of models) {
      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${API_KEY}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents,
              systemInstruction,
              generationConfig: { maxOutputTokens: 2048 },
              safetySettings: [
                { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_ONLY_HIGH' },
                { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_ONLY_HIGH' },
                { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_ONLY_HIGH' },
                { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_ONLY_HIGH' }
              ]
            })
          }
        );

        data = await response.json();
        if (!response.ok || data.error) {
          lastErr = data.error?.message;
          continue;
        }
        break;

      } catch (e) {
        lastErr = e.message;
      }
    }

    if (!data || data.error) {
      return res.status(500).json({ error: lastErr || 'API error' });
    }

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || 'ما قدرتش نجاوب.';

    res.status(200).json({ 
      response: text,
      username: username || null,
      memoryCount: Array.isArray(memory) ? memory.length : 0
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'شي مشكل فالسيرفر. جرب مرة أخرى.' });
  }
}
