import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'
import { env } from '@/lib/env'

export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    try {
        const formData = await req.formData()
        const file = formData.get('file') as File
        const orgId = (session.user as any).organizationId

        if (!file || !orgId) {
            return NextResponse.json({ success: false, error: 'Missing file atau organization' }, { status: 400 })
        }

        const buffer = Buffer.from(await file.arrayBuffer())
        const uploadDir = env.UPLOAD_DIR || './uploads'
        const orgDir = join(uploadDir, 'organization')

        if (!existsSync(orgDir)) {
            await mkdir(orgDir, { recursive: true })
        }

        const fileName = `logo_${orgId}_${Date.now()}.png`
        const filePath = join(orgDir, fileName)

        await writeFile(filePath, buffer)

        // Update organization logo_url
        // The URL should point to our storage serve API
        const logoUrl = `api/storage/organization/${fileName}`

        await prisma.organization.update({
            where: { id: orgId },
            data: { logo_url: logoUrl }
        })

        return NextResponse.json({ 
            success: true, 
            logo_url: logoUrl 
        })
    } catch (error: any) {
        console.error('[Logo Upload] Error:', error)
        return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }
}
