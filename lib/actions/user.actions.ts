'use server'

import prisma from '@/lib/prisma'
import { Role } from '@prisma/client'
import { revalidatePath } from 'next/cache'
import bcrypt from 'bcryptjs'

export async function getUsersAction(orgId: string, filters: any = {}) {
    try {
        const queryFilters: any = { organization_id: orgId }
        
        // Handle specific group filter
        if (filters.groupId) {
            queryFilters.user_groups = {
                some: {
                    group_id: filters.groupId,
                    is_primary: true
                }
            }
            delete filters.groupId
        }

        const users = await prisma.user.findMany({
            where: { ...queryFilters, ...filters },
            include: {
                user_groups: {
                    include: { group: true }
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
    groupId: string,
    password?: string
}) {
    try {
        const { getServerSession } = await import('next-auth')
        const { authOptions } = await import('@/lib/auth')
        const session = await getServerSession(authOptions)

        if (!session?.user) return { success: false, error: 'Unauthorized' }
        
        const requesterRole = (session.user as any).role
        const requesterGroupId = (session.user as any).groupId

        // Security Check: GROUP_ADMIN scoping
        if (requesterRole === Role.GROUP_ADMIN) {
            // Can only manage users in their own group
            if (data.groupId !== requesterGroupId) {
                return { success: false, error: 'Anda hanya dapat mengelola user di grup Anda sendiri.' }
            }
            
            // Check if user being updated is in the same group
            const targetUser = await prisma.user.findUnique({
                where: { id: data.id },
                include: { user_groups: { where: { is_primary: true } } }
            })
            
            const targetGroupId = targetUser?.user_groups[0]?.group_id
            if (targetGroupId !== requesterGroupId) {
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
            // Update or Recreate Group & Role
            prisma.userGroup.deleteMany({
                where: { user_id: data.id, is_primary: true }
            }),
            prisma.userGroup.create({
                data: {
                    user_id: data.id,
                    group_id: data.groupId,
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

export async function updateUserRoleAction(userId: string, role: Role, groupId: string) {
    try {
        const { getServerSession } = await import('next-auth')
        const { authOptions } = await import('@/lib/auth')
        const session = await getServerSession(authOptions)
        if (!session?.user) return { success: false, error: 'Unauthorized' }

        const requesterRole = (session.user as any).role
        const requesterGroupId = (session.user as any).groupId

        if (requesterRole === Role.GROUP_ADMIN) {
            if (groupId !== requesterGroupId || role === Role.SUPER_ADMIN) {
                return { success: false, error: 'Akses terbatas untuk Group Admin.' }
            }
        }

        await prisma.$transaction([
            prisma.userGroup.deleteMany({
                where: { user_id: userId, is_primary: true }
            }),
            prisma.userGroup.create({
                data: {
                    user_id: userId,
                    group_id: groupId,
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
        const requesterGroupId = (session.user as any).groupId

        if (requesterRole === Role.GROUP_ADMIN) {
            const targetUser = await prisma.user.findUnique({
                where: { id: userId },
                include: { user_groups: { where: { is_primary: true } } }
            })
            if (targetUser?.user_groups[0]?.group_id !== requesterGroupId) {
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

export async function getGroupsAction(orgId: string) {
    try {
        const groups = await prisma.group.findMany({
            where: { organization_id: orgId },
            include: {
                _count: { select: { user_groups: true } }
            }
        })
        return { success: true, data: groups }
    } catch (error: any) {
        return { success: false, error: error.message }
    }
}

export async function createGroupAction(data: { name: string, description: string, orgId: string }) {
    try {
        const group = await prisma.group.create({
            data: {
                name: data.name,
                description: data.description,
                organization_id: data.orgId
            }
        })
        revalidatePath('/dashboard/hrd/users/groups')
        return { success: true, data: group }
    } catch (error: any) {
        return { success: false, error: error.message }
    }
}

export async function deleteGroupAction(groupId: string) {
    try {
        const count = await prisma.userGroup.count({ where: { group_id: groupId } })
        if (count > 0) return { success: false, error: 'Cannot delete group with active users' }

        await prisma.group.delete({
            where: { id: groupId }
        })
        revalidatePath('/dashboard/hrd/users/groups')
        return { success: true }
    } catch (error: any) {
        return { success: false, error: error.message }
    }
}
