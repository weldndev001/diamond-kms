import { defineConfig } from "@prisma/config"
import fs from "fs"
import path from "path"

const envPath = path.resolve(process.cwd(), ".env")
let directUrl = ""
if (fs.existsSync(envPath)) {
    const envFile = fs.readFileSync(envPath, "utf8")
    envFile.split("\n").forEach(line => {
        const match = line.match(/^\s*DIRECT_URL\s*=\s*(.*)?\s*$/)
        if (match) {
            let value = match[1] || ""
            if (value.startsWith('"') && value.endsWith('"')) {
                value = value.slice(1, -1)
            }
            directUrl = value
        }
    })
}

export default defineConfig({
    schema: "prisma/schema.prisma",
    datasource: {
        url: directUrl,
    },
})
