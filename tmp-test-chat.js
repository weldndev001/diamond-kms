async function main() {
  try {
    const res = await fetch('https://llm01.weldn.ai/olla/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'Qwen3.5-4B-Q4_K_M-unsloth.gguf',
        messages: [{ role: 'user', content: 'hello' }]
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
