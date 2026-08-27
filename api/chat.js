export default async function handler(req, res) {
  // =========================
  // CORS
  // =========================
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({
      error: 'POST only'
    });
  }

  try {
    // =========================
    // BODY
    // =========================
    const {
      message = '',
      history = [],
      username = '',
      memory = [],
      screenContext = null,
      screenImage = null,
      image = null,
      file = null
    } = req.body || {};

    if (!message && !screenImage && !image && !file) {
      return res.status(400).json({
        error: 'Message required'
      });
    }

    // =========================
    // API KEY
    // =========================
    const API_KEY =
      process.env.GEMINI_API_KEY ||
      process.env.GOOGLE_API_KEY;

    if (!API_KEY) {
      console.error('Gemini API key missing');

      return res.status(500).json({
        error: 'GEMINI_API_KEY غير موجودة في Vercel Environment Variables'
      });
    }

    // =========================
    // SYSTEM INSTRUCTION
    // =========================
    const systemInstruction = {
      parts: [
        {
          text: `
أنت JOKAL، مساعد ذكي شخصي.

اسم المستخدم يوسف.

تحدث معه بشكل طبيعي بالدارجة المغربية ويمكنك استعمال الإنجليزية عندما يكون ذلك مناسباً.

كن:
- ذكياً
- عملياً
- ودوداً
- واضحاً
- مختصراً عندما يكون السؤال بسيطاً
- مفصلاً عندما يطلب المستخدم التفاصيل

ساعده في:
- البرمجة
- HTML
- CSS
- JavaScript
- Python
- المشاريع
- التعلم
- التخطيط
- تحليل الصور
- تحليل الملفات

إذا أعطاك المستخدم صورة، حللها.
إذا أعطاك ملفاً، حاول فهم محتواه.
إذا أعطاك سياق الشاشة، استعمله لفهم ما يراه المستخدم.

لا تدّعي أنك تتحكم في الهاتف أو الشاشة أو التطبيقات إلا إذا كانت هناك أداة حقيقية موصولة تسمح لك بذلك.
`
        }
      ]
    };

    // =========================
    // CONTENTS
    // =========================
    const contents = [];

    // Memory
    if (Array.isArray(memory) && memory.length > 0) {
      contents.push({
        role: 'user',
        parts: [
          {
            text:
              `معلومات من ذاكرة المستخدم ${username}:\n` +
              memory
                .map((m, i) => `${i + 1}. ${m}`)
                .join('\n')
          }
        ]
      });

      contents.push({
        role: 'model',
        parts: [
          {
            text: 'فهمت معلومات الذاكرة وسأستعملها عندما تكون مرتبطة بالسؤال.'
          }
        ]
      });
    }

    // Screen context
    if (
      screenContext &&
      typeof screenContext === 'string'
    ) {
      contents.push({
        role: 'user',
        parts: [
          {
            text:
              `سياق الشاشة الحالي للمستخدم:\n${screenContext}`
          }
        ]
      });
    }

    // =========================
    // HISTORY
    // =========================
    if (Array.isArray(history)) {
      for (const msg of history) {
        const parts = [];

        if (
          msg &&
          typeof msg.content === 'string' &&
          msg.content.trim()
        ) {
          parts.push({
            text: msg.content
          });
        }

        if (
          msg &&
          typeof msg.image === 'string' &&
          msg.image.includes('base64')
        ) {
          const base64Data = msg.image.split(',')[1];

          const mimeMatch =
            msg.image.match(/data:([^;]+);/);

          const mimeType =
            mimeMatch?.[1] || 'image/jpeg';

          if (
            base64Data &&
            base64Data.length > 100
          ) {
            parts.push({
              inlineData: {
                mimeType,
                data: base64Data
              }
            });
          }
        }

        if (parts.length > 0) {
          contents.push({
            role:
              msg.role === 'user'
                ? 'user'
                : 'model',
            parts
          });
        }
      }
    }

    // =========================
    // CURRENT MESSAGE
    // =========================
    const currentParts = [];

    if (message) {
      currentParts.push({
        text: message
      });
    }

    // Image / Screen / File
    const rawMedia =
      screenImage ||
      image ||
      file;

    if (
      rawMedia &&
      typeof rawMedia === 'string'
    ) {
      let base64Data = null;
      let mimeType = 'image/jpeg';

      if (rawMedia.includes('base64')) {
        base64Data =
          rawMedia.split(',')[1];

        const mimeMatch =
          rawMedia.match(/data:([^;]+);/);

        mimeType =
          mimeMatch?.[1] ||
          'image/jpeg';
      } else if (
        rawMedia.length > 100
      ) {
        base64Data = rawMedia;
      }

      if (
        base64Data &&
        base64Data.length > 100
      ) {
        currentParts.push({
          inlineData: {
            mimeType,
            data: base64Data
          }
        });
      }
    }

    contents.push({
      role: 'user',
      parts: currentParts
    });

    // =========================
    // GEMINI
    // =========================
    const modelName = 'gemini-3.7-flash';

    const url =
      `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent`;

    const response = await fetch(url, {
      method: 'POST',

      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': API_KEY
      },

      body: JSON.stringify({
        systemInstruction,
        contents,

        generationConfig: {
          maxOutputTokens: 2048,
          temperature: 0.7
        }
      })
    });

    const data = await response.json();

    // =========================
    // GEMINI ERROR
    // =========================
    if (!response.ok || data.error) {
      console.error(
        'GEMINI ERROR:',
        JSON.stringify(data, null, 2)
      );

      return res.status(500).json({
        error:
          data?.error?.message ||
          'Gemini API error',

        status:
          data?.error?.status ||
          response.status
      });
    }

    // =========================
    // RESPONSE
    // =========================
    const text =
      data
        ?.candidates?.[0]
        ?.content?.parts
        ?.map(part => part.text || '')
        .join('') ||
      'ما قدرتش نجاوب دابا.';

    return res.status(200).json({
      response: text,
      username: username || null,
      memoryCount:
        Array.isArray(memory)
          ? memory.length
          : 0
    });

  } catch (err) {
    console.error(
      'BACKEND ERROR:',
      err
    );

    return res.status(500).json({
      error:
        err?.message ||
        'شي مشكل وقع فالسيرفر.'
    });
  }
}