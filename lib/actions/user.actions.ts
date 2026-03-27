'use server'

import prisma from '@/lib/prisma'
import { Role } from '@prisma/client'
import { revalidatePath } from 'next/cache'
import bcrypt from 'bcryptjs'

export async function getUsersAction(orgId: string, filters: any = {}) {
    try {
        const users = await prisma.user.findMany({
            where: { organization_id: orgId, ...filters },
            include: {
                user_divisions: {
                    include: { division: true }
                }
            },
            orderBy: { created_at: 'desc' }
        })
        return { success: true, data: users }
    } catch (error: any) {
        return { success: false, error: error.message }
    }
}

export async function updateUserAction(data: {
    id: string,
    fullName: string,
    email: string,
    jobTitle: string,
    role: Role,
    divisionId: string,
    password?: string
}) {
    try {
        const updateData: any = {
            full_name: data.fullName,
            email: data.email,
            job_title: data.jobTitle,
        }

        if (data.password && data.password.trim() !== '') {
            updateData.password_hash = await bcrypt.hash(data.password, 10)
        }

        await prisma.$transaction([
            // Update User fields
            prisma.user.update({
                where: { id: data.id },
                data: updateData
            }),
            // Update or Recreate Division & Role
            prisma.userDivision.deleteMany({
                where: { user_id: data.id, is_primary: true }
            }),
            prisma.userDivision.create({
                data: {
                    user_id: data.id,
                    division_id: data.divisionId,
                    role: data.role,
                    is_primary: true
                }
            })
        ])

        revalidatePath('/dashboard/hrd/users')
        return { success: true }
    } catch (error: any) {
        if (error.code === 'P2002') {
            return { success: false, error: 'Email already in use' }
        }
        return { success: false, error: error.message }
    }
}

export async function updateUserRoleAction(userId: string, role: Role, divisionId: string) {
    try {
        await prisma.$transaction([
            prisma.userDivision.deleteMany({
                where: { user_id: userId, is_primary: true }
            }),
            prisma.userDivision.create({
                data: {
                    user_id: userId,
                    division_id: divisionId,
                    role,
                    is_primary: true
                }
            })
        ])
        revalidatePath('/dashboard/hrd/users')
        return { success: true }
    } catch (error: any) {
        return { success: false, error: error.message }
    }
}

export async function deactivateUserAction(userId: string) {
    try {
        await prisma.user.update({
            where: { id: userId },
            data: { is_active: false }
        })
        revalidatePath('/dashboard/hrd/users')
        return { success: true }
    } catch (error: any) {
        return { success: false, error: error.message }
    }
}

export async function getDivisionsAction(orgId: string) {
    try {
        const divisions = await prisma.division.findMany({
            where: { organization_id: orgId },
            include: {
                _count: { select: { user_divisions: true } }
            }
        })
        return { success: true, data: divisions }
    } catch (error: any) {
        return { success: false, error: error.message }
    }
}

export async function createDivisionAction(data: { name: string, description: string, orgId: string }) {
    try {
        const div = await prisma.division.create({
            data: {
                name: data.name,
                description: data.description,
                organization_id: data.orgId
            }
        })
        revalidatePath('/dashboard/hrd/divisions')
        return { success: true, data: div }
    } catch (error: any) {
        return { success: false, error: error.message }
    }
}

export async function deleteDivisionAction(divisionId: string) {
    try {
        const count = await prisma.userDivision.count({ where: { division_id: divisionId } })
        if (count > 0) return { success: false, error: 'Cannot delete division with active users' }

        await prisma.division.delete({
            where: { id: divisionId }
        })
        revalidatePath('/dashboard/hrd/divisions')
        return { success: true }
    } catch (error: any) {
        return { success: false, error: error.message }
    }
}
