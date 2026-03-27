import { getAIServiceForOrg } from './lib/ai/get-ai-service'
import prisma from './lib/prisma'

async function test() {
    const orgId = "ff9720c0-3306-4076-92c2-d3626763746a"
    console.log("Checking Org ID:", orgId)
    
    const org = await prisma.organization.findUnique({
        where: { id: orgId },
        select: { ai_provider_config: true }
    })
    console.log("Config in DB:", JSON.stringify(org?.ai_provider_config, null, 2))
    
    const ai = await getAIServiceForOrg(orgId)
    console.log("Service Provider Name:", ai.providerName)
    if (ai.chatModel) console.log("Chat Model:", ai.chatModel)
}

test().catch(console.error).finally(() => prisma.$disconnect())
