const https = require('https');
const data = JSON.stringify({
    model: 'Qwen3VL-4B-Instruct-Q4_K_M.gguf',
    messages: [{ role: 'user', content: 'hello' }]
});
const req = https.request('https://llm01.weldn.ai/olla/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer 400cb90781a7e8b7365df43c07293fb689bf4dfc8dac4f78ca9049e7005b77a7',
        'Content-Length': data.length
    }
}, (res) => {
    console.log('STATUS CHAT:', res.statusCode);
    let body = '';
    res.on('data', d => body+=d);
    res.on('end', () => console.log('BODY:', body.substring(0, 100) + '...'));
});
req.on('error', console.error);
req.write(data);
req.end();
