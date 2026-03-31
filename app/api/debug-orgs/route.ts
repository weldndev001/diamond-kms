import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function GET() {
    try {
        const orgs = await prisma.organization.findMany()
        return NextResponse.json({ success: true, orgs })
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message })
    }
}
