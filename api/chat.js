const models = [
  'gemini-3.7-flash',
  'gemini-3.6-flash',
  'gemini-3.5-flash-lite'
];

let data = null;
let lastError = null;

for (const modelName of models) {

  console.log(`Trying JOKAL model: ${modelName}`);

  try {

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent`,
      {
        method: 'POST',

        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': API_KEY
        },

        body: JSON.stringify({
          contents,
          systemInstruction,

          generationConfig: {
            maxOutputTokens: 2048
          }
        })
      }
    );

    const result = await response.json();

    // نجاح
    if (response.ok && !result.error) {
      data = result;
      console.log(`JOKAL connected to ${modelName}`);
      break;
    }

    // خطأ
    lastError =
      result?.error?.message ||
      `HTTP ${response.status}`;

    console.warn(
      `${modelName} failed:`,
      lastError
    );

    // نجرب الموديل التالي
    continue;

  } catch (error) {

    lastError = error.message;

    console.warn(
      `${modelName} exception:`,
      error.message
    );

    continue;
  }
}

if (!data) {

  return res.status(503).json({
    error:
      'JOKAL ما قدرش يتصل بأي Gemini model دابا.',
    details: lastError
  });
}