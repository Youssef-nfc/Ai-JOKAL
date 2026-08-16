export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  try {
    const { text, voice = 'female' } = req.body;
    if (!text) return res.status(400).json({ error: 'Text required' });

    const API_KEY = process.env.GOOGLE_CLOUD_API_KEY || process.env.GEMINI_API_KEY;
    if (!API_KEY) return res.status(500).json({ error: 'API key missing' });

    // حد أقصى 5000 حرف — نقطع النص الطويل
    const cleanText = text.replace(/!\[.*?\]\(.*?\)/g, '').replace(/\[.*?\]\(.*?\)/g, '').replace(/[#*`>_]/g, '').substring(0, 4800);

    const voiceConfig = voice === 'male' 
      ? { languageCode: 'ar-XA', name: 'ar-XA-Neural2-B', ssmlGender: 'MALE' }
      : { languageCode: 'ar-XA', name: 'ar-XA-Neural2-A', ssmlGender: 'FEMALE' };

    const response = await fetch(
      `https://texttospeech.googleapis.com/v1/text:synthesize?key=${API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input: { text: cleanText },
          voice: voiceConfig,
          audioConfig: { 
            audioEncoding: 'MP3',
            pitch: 0,
            speakingRate: 1.0
          }
        })
      }
    );

    const data = await response.json();
    if (data.error) return res.status(500).json({ error: data.error.message });

    res.status(200).json({ 
      audioContent: data.audioContent,
      voice: voiceConfig.name
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'مشكل فـ TTS. جرب مرة أخرى.' });
  }
}
