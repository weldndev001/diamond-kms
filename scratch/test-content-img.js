const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const content = await prisma.content.findUnique({
        where: { id: '8d369014-c3f8-46ce-9bfc-bc19f4aa2198' },
        select: { id: true, body: true }
    });
    
    if (content) {
        console.log('ID:', content.id);
        console.log('Body length:', content.body.length);
        console.log('Body snippet:', content.body.substring(0, 500));
        
        // check if image is there
        if (content.body.includes('<img')) {
            const imgTag = content.body.match(/<img[^>]+>/g);
            console.log('Image tag:', imgTag ? imgTag[0].substring(0, 200) + '...' : 'none');
            
            // check for src
            const src = content.body.match(/src="([^"]+)"/);
            if (src && src.length > 1) {
                console.log('Src starts with:', src[1].substring(0, 100));
            }
        }
    } else {
        console.log('Content not found');
    }
}
main().finally(() => prisma.$disconnect());
