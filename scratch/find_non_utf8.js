
import fs from 'fs';
import path from 'path';

function isUTF8(buffer) {
    try {
        new TextDecoder('utf-8', { fatal: true }).decode(buffer);
        return true;
    } catch (e) {
        return false;
    }
}

function walk(dir, callback) {
    fs.readdirSync(dir).forEach( f => {
        let dirPath = path.join(dir, f);
        let isDirectory = fs.statSync(dirPath).isDirectory();
        if (isDirectory) {
            if (f !== 'node_modules' && f !== '.next' && f !== '.git') {
                walk(dirPath, callback);
            }
        } else {
            callback(path.join(dir, f));
        }
    });
}

walk('./app', (filePath) => {
    if (filePath.endsWith('.tsx') || filePath.endsWith('.ts')) {
        const buffer = fs.readFileSync(filePath);
        if (!isUTF8(buffer)) {
            console.log(`NON-UTF8: ${filePath}`);
        }
    }
});
