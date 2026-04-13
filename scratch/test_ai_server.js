
async function testAI() {
    const endpoint = 'https://llm01.weldn.ai/olla/openai/v1';
    const model = 'Qwen3.5-4B-Q4_K_M-unsloth.gguf';

    console.log(`Testing endpoint: ${endpoint}`);
    
    // 1. Test Models list
    try {
        console.log('\n--- Testing /v1/models ---');
        const res = await fetch(`${endpoint}/models`);
        console.log(`Status: ${res.status}`);
        const text = await res.text();
        console.log(`Response: ${text.substring(0, 500)}`);
    } catch (err) {
        console.error(`Error testing /models: ${err.message}`);
    }

    // 2. Test simple completion
    try {
        console.log('\n--- Testing /v1/chat/completions ---');
        const res = await fetch(`${endpoint}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer fixed-key`
            },
            body: JSON.stringify({
                model: model,
                messages: [{ role: 'user', content: 'hi' }],
                max_tokens: 5
            })
        });
        console.log(`Status: ${res.status}`);
        const text = await res.text();
        console.log(`Response: ${text.substring(0, 500)}`);
    } catch (err) {
        console.error(`Error testing /chat/completions: ${err.message}`);
    }
}

testAI();
