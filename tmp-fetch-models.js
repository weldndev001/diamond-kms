async function main() {
  try {
    const res = await fetch('https://llm01.weldn.ai/olla/openai/v1/models');
    const data = await res.json();
    console.log('Available Models:');
    if (data.data && Array.isArray(data.data)) {
      data.data.forEach(m => console.log('- ' + m.id));
    } else {
      console.log('No models found in data:', data);
    }
  } catch (e) {
    console.error('Fetch Error:', e.message);
  }
}
main();
