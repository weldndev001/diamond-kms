const https = require('https');
const data = JSON.stringify({
    model: 'Qwen3-Embedding-0.6B-Q8_0.gguf',
    input: 'test text'
});
const req = https.request('https://llm01.weldn.ai/olla/openai/v1/embeddings', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer 400cb90781a7e8b7365df43c07293fb689bf4dfc8dac4f78ca9049e7005b77a7',
        'Content-Length': data.length
    }
}, (res) => {
    console.log('STATUS:', res.statusCode);
    let body = '';
    res.on('data', d => body+=d);
    res.on('end', () => console.log('BODY:', body.substring(0, 100) + '...'));
});
req.on('error', console.error);
req.write(data);
req.end();
