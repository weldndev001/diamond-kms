import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { ApiResponse } from '@/lib/api/response'

export async function POST(req: NextRequest) {
    try {
        const body = await req.json()
        const { documentId } = body

        if (!documentId) {
            return ApiResponse.validationError({ documentId: 'required' })
        }

        // Set status to failed to trigger the loop break in process-document
        await prisma.document.update({
            where: { id: documentId },
            data: { 
                processing_status: 'failed',
                processing_error: 'Proses pengunggahan dihentikan oleh pengguna.'
            }
        })

        return NextResponse.json({ 
            success: true, 
            message: 'Permintaan penghentian proses telah terkirim.' 
        })
    } catch (err: any) {
        return ApiResponse.internalError(err)
    }
}
