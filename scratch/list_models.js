import 'dotenv/config';

async function listModels() {
  const apiKey = process.env.GEMINI_API_KEY;
  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
  const res = await fetch(url);
  const data = await res.json();
  console.log('Available models:');
  if (data.models) {
    data.models.forEach(m => {
      if (m.supportedGenerationMethods && m.supportedGenerationMethods.includes('generateContent')) {
        console.log('-', m.name, m.displayName);
      }
    });
  } else {
    console.log(JSON.stringify(data, null, 2));
  }
}

listModels().catch(console.error);
