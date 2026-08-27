export default async function handler(req, res) {
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

  const API_KEY = process.env.GEMINI_API_KEY;

  if (!API_KEY) {
    return res.status(500).json({
      error: 'GEMINI_API_KEY missing'
    });
  }

  try {
    const { message = '' } = req.body || {};

    const response = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': API_KEY
        },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [
                {
                  text: message
                }
              ]
            }
          ]
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error('GEMINI:', data);

      return res.status(response.status).json({
        error: data?.error?.message || 'Gemini error',
        status: data?.error?.status || response.status
      });
    }

    const text =
      data?.candidates?.[0]?.content?.parts
        ?.map(p => p.text || '')
        .join('') ||
      'ما جا حتى جواب.';

    return res.status(200).json({
      response: text
    });

  } catch (error) {
    console.error('BACKEND:', error);

    return res.status(500).json({
      error: error.message
    });
  }
}