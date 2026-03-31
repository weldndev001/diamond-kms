const { OpenAI } = require('openai');
const client = new OpenAI({
    baseURL: "https://llm01.weldn.ai/olla/openai/v1",
    apiKey: "400cb90781a7e8b7365df43c07293fb689bf4dfc8dac4f78ca9049e7005b77a7"
});

async function main() {
    try {
        console.log("Testing embeddings...");
        const response = await client.embeddings.create({
            model: "Qwen3 Embedding 0.6B Q8_0.gguf",
            input: "apa isi database ini?"
        });
        console.log("Success! Embedding length:", response.data[0].embedding.length);
    } catch(e) {
        console.error("Failed embeddings:", e.message);
    }
}
main();
