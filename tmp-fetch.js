const fs = require('fs');
async function main() {
    try {
        const res = await fetch("http://localhost:7000/api/fix-pg")
        const json = await res.json()
        fs.writeFileSync('tmp-docs.json', JSON.stringify(json, null, 2))
    } catch (err) {
        console.error("Fetch failed:", err)
    }
}
main()
