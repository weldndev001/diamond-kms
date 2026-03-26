import { NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'

import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'

export async function GET() {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const userId = (session.user as any).id

    try {
        console.log('[API auth/me] Fetching Prisma User Profile...');
        const userProfile = await prisma.user.findUnique({
            where: { id: userId },
            include: {
                organization: {
                    include: {
                        feature_flags: true,
                    }
                },
                user_divisions: {
                    where: { is_primary: true },
                    include: {
                        division: true,
                    }
                }
            }
        })

        if (!userProfile) {
            return NextResponse.json({ success: false, error: 'User profile not found in DB' }, { status: 401 })
        }

        const primaryDivision = userProfile.user_divisions[0]

        return NextResponse.json({
            success: true,
            data: {
                ...userProfile,
                role: primaryDivision?.role,
                division: primaryDivision?.division,
            }
        })
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }
}
