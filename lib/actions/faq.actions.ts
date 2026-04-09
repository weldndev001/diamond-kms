'use server'

import prisma from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { isAdmin } from '@/lib/auth/server-utils'

export async function getFAQsAction(orgId: string) {
    try {
        const faqs = await prisma.fAQ.findMany({
            where: { organization_id: orgId },
            take: 20,
            orderBy: { created_at: 'desc' }
        })

        return { success: true, data: faqs }
    } catch (error: any) {
        return { success: false, error: error.message }
    }
}

export async function createFAQAction(data: {
    question: string
    answer: string
    orgId: string
    userId: string
    imageUrl?: string
}) {
    try {
        if (!await isAdmin()) {
            return { success: false, error: "Unauthorized: Hanya Super Admin yang dapat mengelola FAQ" }
        }

        const count = await prisma.fAQ.count({
            where: { organization_id: data.orgId }
        })

        if (count >= 20) {
            return { success: false, error: "Kuota FAQ Penuh (Maks 20)" }
        }

        const faq = await prisma.fAQ.create({
            data: {
                question: data.question,
                answer: data.answer,
                image_url: data.imageUrl,
                organization_id: data.orgId,
                created_by: data.userId,
                order_index: count
            }
        })

        revalidatePath('/dashboard/faqs')
        return { success: true, data: faq }
    } catch (error: any) {
        return { success: false, error: error.message }
    }
}

export async function updateFAQAction(id: string, data: {
    question: string
    answer: string
    imageUrl?: string
}) {
    try {
        if (!await isAdmin()) {
            return { success: false, error: "Unauthorized: Hanya Super Admin yang dapat mengelola FAQ" }
        }

        const faq = await prisma.fAQ.update({
            where: { id },
            data: {
                question: data.question,
                answer: data.answer,
                image_url: data.imageUrl,
            }
        })

        revalidatePath('/dashboard/faqs')
        return { success: true, data: faq }
    } catch (error: any) {
        return { success: false, error: error.message }
    }
}

export async function deleteFAQAction(id: string) {
    try {
        if (!await isAdmin()) {
            return { success: false, error: "Unauthorized: Hanya Super Admin yang dapat mengelola FAQ" }
        }

        await prisma.fAQ.delete({ where: { id } })
        revalidatePath('/dashboard/faqs')
        return { success: true }
    } catch (error: any) {
        return { success: false, error: error.message }
    }
}
