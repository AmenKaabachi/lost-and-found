import 'dotenv/config';

async function testModels() {
  const apiKey = process.env.GEMINI_API_KEY;
  const candidates = [
    'gemini-2.5-flash-lite',
    'gemini-3.5-flash',
    'gemini-3.5-flash-lite',
    'gemini-3.1-flash-lite',
    'gemini-3.8-flash',
    'gemini-flash-latest'
  ];

  for (const m of candidates) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${apiKey}`;
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: 'Dis simplement OK en JSON: {"status": "OK"}' }] }],
          generationConfig: { responseMimeType: 'application/json' }
        })
      });
      const data = await res.json();
      if (res.ok) {
        console.log(`[SUCCESS] Model ${m}:`, data.candidates?.[0]?.content?.parts?.[0]?.text);
      } else {
        console.log(`[FAILED] Model ${m} (${res.status}):`, data.error?.message?.slice(0, 100));
      }
    } catch (e) {
      console.log(`[ERROR] Model ${m}:`, e.message);
    }
  }
}

testModels().catch(console.error);
