import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    const content = await prisma.content.findUnique({
        where: { id: '8d369014-c3f8-46ce-9bfc-bc19f4aa2198' },
        select: { id: true, body: true }
    })
    if (content) {
        console.log('ID:', content.id)
        console.log('Body length:', content.body.length)
        if (content.body.includes('<img')) {
            const imgMatch = content.body.match(/<img[^>]+>/)
            if (imgMatch) {
                console.log('img match:', imgMatch[0].substring(0, 150))
            }
        } else {
            console.log('No img tag found in body.')
        }
    } else {
        console.log('Not found')
    }
}

main().catch(e => console.error(e)).finally(() => prisma.$disconnect())
