'use server'

import prisma from '@/lib/prisma'
import { Role } from '@prisma/client'
import { revalidatePath } from 'next/cache'
import bcrypt from 'bcryptjs'

export async function getUsersAction(orgId: string, filters: any = {}) {
    try {
        const queryFilters: any = { organization_id: orgId }
        
        // Handle specific division filter
        if (filters.divisionId) {
            queryFilters.user_divisions = {
                some: {
                    division_id: filters.divisionId,
                    is_primary: true
                }
            }
            delete filters.divisionId
        }

        const users = await prisma.user.findMany({
            where: { ...queryFilters, ...filters },
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
        const { getServerSession } = await import('next-auth')
        const { authOptions } = await import('@/lib/auth')
        const session = await getServerSession(authOptions)

        if (!session?.user) return { success: false, error: 'Unauthorized' }
        
        const requesterRole = (session.user as any).role
        const requesterDivisionId = (session.user as any).division?.id

        // Security Check: GROUP_ADMIN scoping
        if (requesterRole === Role.GROUP_ADMIN) {
            // Can only manage users in their own division
            if (data.divisionId !== requesterDivisionId) {
                return { success: false, error: 'Anda hanya dapat mengelola user di divisi Anda sendiri.' }
            }
            
            // Check if user being updated is in the same division
            const targetUser = await prisma.user.findUnique({
                where: { id: data.id },
                include: { user_divisions: { where: { is_primary: true } } }
            })
            
            const targetDivId = targetUser?.user_divisions[0]?.division_id
            if (targetDivId !== requesterDivisionId) {
                return { success: false, error: 'Anda tidak memiliki akses untuk mengubah user ini.' }
            }

            // Cannot promote anyone to SUPER_ADMIN
            if (data.role === Role.SUPER_ADMIN) {
                return { success: false, error: 'Anda tidak dapat memberikan peran Super Admin.' }
            }
        }

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
        const { getServerSession } = await import('next-auth')
        const { authOptions } = await import('@/lib/auth')
        const session = await getServerSession(authOptions)
        if (!session?.user) return { success: false, error: 'Unauthorized' }

        const requesterRole = (session.user as any).role
        const requesterDivisionId = (session.user as any).division?.id

        if (requesterRole === Role.GROUP_ADMIN) {
            if (divisionId !== requesterDivisionId || role === Role.SUPER_ADMIN) {
                return { success: false, error: 'Akses terbatas untuk Group Admin.' }
            }
        }

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
        const { getServerSession } = await import('next-auth')
        const { authOptions } = await import('@/lib/auth')
        const session = await getServerSession(authOptions)
        if (!session?.user) return { success: false, error: 'Unauthorized' }

        const requesterRole = (session.user as any).role
        const requesterDivisionId = (session.user as any).division?.id

        if (requesterRole === Role.GROUP_ADMIN) {
            const targetUser = await prisma.user.findUnique({
                where: { id: userId },
                include: { user_divisions: { where: { is_primary: true } } }
            })
            if (targetUser?.user_divisions[0]?.division_id !== requesterDivisionId) {
                return { success: false, error: 'Anda tidak memiliki akses untuk menonaktifkan user ini.' }
            }
        }

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
        revalidatePath('/dashboard/hrd/users/divisions')
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
        revalidatePath('/dashboard/hrd/users/divisions')
        return { success: true }
    } catch (error: any) {
        return { success: false, error: error.message }
    }
}
