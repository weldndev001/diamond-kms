const OpenAI = require('openai');

async function test() {
  const client = new OpenAI({
    baseURL: 'https://llm01.weldn.ai/olla/openai/v1',
    apiKey: 'ollama-dummy-key', // Matching the code
    defaultHeaders: {
        'HTTP-Referer': 'https://diamond-kms.app',
        'X-Title': 'DIAMOND KMS',
    },
  });

  try {
    console.log('Sending Chat Request...');
    const response = await client.chat.completions.create({
        model: 'Qwen3.5-4B-Q4_K_M-unsloth.gguf',
        messages: [{ role: 'user', content: 'hello' }]
    });
    console.log('Success!', response.choices[0].message.content);
  } catch (err) {
    console.error('FAILED:', err.status, err.message);
    if (err.response) {
        console.error('Response Body:', err.response.data);
    }
  }
}

test();
