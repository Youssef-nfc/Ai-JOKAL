export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  try {
    const { message, history = [], username, password, memory = [], screenContext = null, screenImage = null } = req.body;
    if (!message) return res.status(400).json({ error: 'Message required' });

    const API_KEY = process.env.GEMINI_API_KEY;
    if (!API_KEY) return res.status(500).json({ error: 'API key missing' });

    const contents = [];

    // شخصية JOKAL (التدريب)
    contents.push({
      role: 'user',
      parts: [{ text: `أنت JOKAL، مساعد ذكي خاص وشخصي. قواعدك:
- تتحدث بالعربية الدارجة المغربية بشكل طبيعي وودود
- أنت صديق مخلص وذكي وعملي
- تساعد في البرمجة، التخطيط، البحث، الإبداع، والتعلم
- تجيب بإجابات واضحة ومختصرة مع التفصيل إذا طُلب
- تستخدم الإيموجي بشكل متوازن
- اسم صاحبك هو يوسف` }]
    });
    contents.push({
      role: 'model',
      parts: [{ text: 'فهمت يا صاحبي! أنا JOKAL جاهز نساعدك في أي حاجة.' }]
    });

    // إضافة الذاكرة الطويلة الأمد إذا وجدت (صريحة من المستخدم)
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

    // إضافة سياق الشاشة (وصف نصي) إذا وجد
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

    // History
    history.forEach(msg => {
      contents.push({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content }]
      });
    });

    // الرسالة الحالية مع دعم الصورة (لقطة شاشة)
    const currentParts = [{ text: message }];
    
    if (screenImage && typeof screenImage === 'string' && screenImage.includes('base64')) {
      const base64Data = screenImage.split(',')[1];
      const mimeMatch = screenImage.match(/data:([^;]+);/);
      const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';
      if (base64Data && base64Data.length > 100) {
        currentParts.push({
          inlineData: {
            mimeType: mimeType,
            data: base64Data
          }
        });
      }
    }

    contents.push({ role: 'user', parts: currentParts });

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents,
          generationConfig: { temperature: 0.8, maxOutputTokens: 2048 }
        })
      }
    );

    const data = await response.json();
    if (data.error) return res.status(500).json({ error: data.error.message });

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
