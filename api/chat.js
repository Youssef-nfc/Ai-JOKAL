export default async function handler(req, res) {
  // 1. إعدادات الأمان والتراخيص (CORS)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-User-Id, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST Method Only' });

  try {
    const { message, history = [], user } = req.body;
    
    // 2. التأكد من وجود هويّة المستخدم والرسالة
    const userId = req.headers['x-user-id'] || user?.id || 'guest';
    const userName = user?.name || 'صديق JOKAL';

    if (!message) {
      return res.status(400).json({ error: 'المحتوى مطلوب (Message Required)' });
    }

    const API_KEY = process.env.GEMINI_API_KEY;
    if (!API_KEY) {
      return res.status(500).json({ error: 'مفتاح Gemini غير متوفر فالسيرفر.' });
    }

    // 3. بناء الـ System Prompt مخصص لكل مستخدم على حدة
    const contents = [];

    contents.push({
      role: 'user',
      parts: [{ 
        text: `أنت JOKAL، مساعد ذكي ومخصص. تتكلم بالدارجة المغربية السلسة. تجيب بدقة وبإيجاز. أنت تتحدث الآن مع المستخدم "${userName}" (المعرف: ${userId}). رحب به بأسلوب مخصص واحتفظ بخصائصه.` 
      }]
    });

    contents.push({
      role: 'model',
      parts: [{ text: `مرحباً ${userName}! أنا JOKAL جاهز لمساعدتك.` }]
    });

    // إضافة السجل (History)
    history.forEach(msg => {
      contents.push({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content }]
      });
    });

    // إضافة الرسالة الحالية
    contents.push({ role: 'user', parts: [{ text: message }] });

    // 4. إرسال الطلب لـ Gemini Model بشكل Streaming (SSE)
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:streamGenerateContent?alt=sse&key=${API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents,
          generationConfig: { 
            temperature: 0.7, 
            maxOutputTokens: 1024 
          }
        })
      }
    );

    if (!geminiRes.ok) {
      const errData = await geminiRes.json().catch(() => ({}));
      return res.status(geminiRes.status).json({ 
        error: errData.error?.message || 'خطأ أثناء الاتصال بالذكاء الاصطناعي.' 
      });
    }

    // 5. إرجاع النتيجة للـ Frontend عبر Stream
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
    console.error('API Error:', err);
    res.status(500).json({ error: 'مشكل داخلي في السيرفر.' });
  }
}
