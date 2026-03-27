const fs = require('fs');
const file = process.argv[2] || 'org_dump_utf8.json';
try {
    const raw = fs.readFileSync(file);
    // Try to auto-detect and remove BOM if present
    let content = raw.toString('utf8');
    if (content.charCodeAt(0) === 0xFEFF) content = content.slice(1);
    
    const data = JSON.parse(content);
    const config = data[0].ai_provider_config;
    console.log('AI Configuration Detail:');
    for (const key in config) {
        const val = config[key];
        console.log(`- ${key}: "${val}" (Length: ${String(val).length})`);
        if (typeof val === 'string') {
            for (let i = 0; i < val.length; i++) {
                const code = val.charCodeAt(i);
                if (code < 32 || code > 126) {
                    console.log(`  [HIDDEN CHARACTER] at index ${i}: code ${code}`);
                }
            }
        }
    }
} catch (e) {
    console.error('Error:', e.message);
}
