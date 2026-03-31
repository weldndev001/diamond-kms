const fs = require('fs');
try {
    const data = JSON.parse(fs.readFileSync('models_list.json', 'utf8'));
    console.log('Available Models:');
    data.data.forEach(m => console.log('- ' + m.id));
} catch (e) {
    console.error('Error parsing JSON:', e.message);
}
