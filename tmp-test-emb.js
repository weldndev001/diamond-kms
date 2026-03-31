async function main() {
  try {
    const res = await fetch('https://llm01.weldn.ai/olla/openai/v1/embeddings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'Qwen3-Embedding-0.6B-Q8_0.gguf',
        input: 'hello'
      })
    });
    const text = await res.text();
    console.log('Status:', res.status);
    console.log('Response:', text);
  } catch (e) {
    console.error('Fetch Error:', e.message);
  }
}
main();
