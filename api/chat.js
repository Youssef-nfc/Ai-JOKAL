export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  try {
    const { message, history = [], username, password } = req.body;

    // التحقق من اسم المستخدم وكلمة السر باستخدام المتغيرات البيئية
    if (username !== process.env.ADMIN_USER || password !== process.env.ADMIN_PASS) {
      return res.status(401).json({ error: 'اسم المستخدم أو كلمة السر غير صحيحة' });
    }

    if (!message) return res.status(400).json({ error: 'Message required' });

    const API_KEY = process.env.GEMINI_API_KEY;
    if (!API_KEY) return res.status(500).json({ error: 'API key missing' });

    const contents = [];
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

    history.forEach(msg => {
      contents.push({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content }]
      });
    });

    contents.push({
      role: 'user',
      parts: [{ text: message }]
    });

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents,
          generationConfig: {
            temperature: 0.8,
            maxOutputTokens: 2048,
          }
        })
      }
    );

    const data = await response.json();

    if (data.error) {
      console.error('Gemini error:', data.error);
      return res.status(500).json({ error: data.error.message || 'API error' });
    }

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text 
              || 'ما قدرتش نجاوب على هاد السؤال.';

    res.status(200).json({ response: text });

  } catch (err) {
    console.error('Server error:', err);
    res.status(500).json({ error: 'شي مشكل فالسيرفر. جرب مرة أخرى.' });
  }
}
