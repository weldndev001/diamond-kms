import { defineConfig } from "@prisma/config"
import fs from "fs"
import path from "path"

function getEnvVar(key: string) {
    const envPath = path.resolve(process.cwd(), ".env")
    if (!fs.existsSync(envPath)) return undefined
    const envFile = fs.readFileSync(envPath, "utf8")
    const lines = envFile.split(/\r?\n/)
    for (const line of lines) {
        const parts = line.split('=')
        if (parts[0] && parts[0].trim() === key) {
            let val = parts.slice(1).join('=').trim()
            if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1)
            return val
        }
    }
    return undefined
}

export default defineConfig({
    schema: "prisma/schema.prisma",
    datasource: {
        url: getEnvVar("DIRECT_URL") || getEnvVar("DATABASE_URL"),
    },
})
