'use server'

import prisma from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { Role } from '@prisma/client'
import bcrypt from 'bcryptjs'

export async function loginAction(formData: FormData) {
    const email = formData.get('email') as string
    const password = formData.get('password') as string

    if (!email || !password) {
        return { success: false, error: 'Email dan password diperlukan' }
    }

    try {
        const user = await prisma.user.findUnique({
            where: { email },
            include: {
                user_divisions: {
                    where: { is_primary: true },
                    select: { role: true }
                }
            }
        })

        if (!user || !user.password_hash) {
            return { success: false, error: 'Email atau password salah' }
        }

        const isPasswordValid = await bcrypt.compare(password, user.password_hash)
        if (!isPasswordValid) {
            return { success: false, error: 'Email atau password salah' }
        }

        // Note: For NextAuth credentials provider, we usually sign in on the client.
        // But we can return success here to signal the client to call signIn().
        
        let redirectTo = '/dashboard'
        if (user.user_divisions.length > 0) {
            const role = user.user_divisions[0].role
            switch (role) {
                case Role.SUPER_ADMIN:
                case Role.GROUP_ADMIN:
                case Role.SUPERVISOR:
                case Role.STAFF:
                    redirectTo = '/dashboard'
                    break
                case Role.MAINTAINER:
                    redirectTo = '/dashboard/maintainer'
                    break
            }
        }

        return { success: true, redirectTo }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

// Logout will be handled by NextAuth signOut() on the client, 
// but we can provide a server side one if needed.
export async function logoutAction() {
    // Client should call signOut() from next-auth/react
    return { success: true }
}

export async function registerOrgAction(formData: FormData) {
    const orgName = formData.get('orgName') as string
    const industrySegment = formData.get('industrySegment') as string
    const email = formData.get('email') as string
    const password = formData.get('password') as string

    if (!orgName || !email || !password) {
        return { success: false, error: 'Semua field wajib diisi' }
    }

    // AI Configuration
    const aiProvider = (formData.get('aiProvider') as string) || 'managed'
    const apiKey = formData.get('apiKey') as string | undefined
    const endpointUrl = formData.get('endpointUrl') as string | undefined

    const { encrypt } = await import('@/lib/security/key-encryptor')
    let aiConfig: any = { provider: aiProvider }

    if (aiProvider === 'byok') {
        if (!apiKey) return { success: false, error: 'API Key is required for BYOK' }
        aiConfig.encryptedKey = encrypt(apiKey)
    } else if (aiProvider === 'self_hosted') {
        if (!endpointUrl) return { success: false, error: 'Endpoint URL required for Self-Hosted' }
        aiConfig.endpoint = endpointUrl
        if (apiKey) aiConfig.encryptedKey = encrypt(apiKey)
    }

    try {
        const passwordHash = await bcrypt.hash(password, 10)

        await prisma.$transaction(async (tx) => {
            // Create Organization
            const org = await tx.organization.create({
                data: {
                    name: orgName,
                    slug: orgName.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
                    industry_segment: industrySegment,
                    subscription_status: 'TRIAL',
                    ai_provider_config: aiConfig,
                }
            })

            // Create Initial Division
            const division = await tx.division.create({
                data: {
                    name: 'Headquarters',
                    organization_id: org.id,
                }
            })

            // Create User
            await tx.user.create({
                data: {
                    organization_id: org.id,
                    email,
                    password_hash: passwordHash,
                    full_name: orgName + ' Admin',
                    job_title: 'Super Admin',
                    user_divisions: {
                        create: {
                            division_id: division.id,
                            role: Role.SUPER_ADMIN,
                            is_primary: true
                        }
                    }
                }
            })
        })

        return { success: true }
    } catch (dbError: any) {
        if (dbError.code === 'P2002') {
            return { success: false, error: 'Email sudah terdaftar' }
        }
        return { success: false, error: dbError.message }
    }
}

export async function inviteUserAction({
    email,
    password,
    fullName,
    jobTitle,
    role,
    divisionId,
}: {
    email: string
    password: string
    fullName: string
    jobTitle?: string
    role: string
    divisionId: string
}) {
    if (!password || password.length < 6) {
        return { success: false, error: 'Password minimal 6 karakter' }
    }

    try {
        const passwordHash = await bcrypt.hash(password, 10)

        const { getServerSession } = await import('next-auth')
        const { authOptions } = await import('@/lib/auth')
        const session = await getServerSession(authOptions)

        if (!session?.user) return { success: false, error: 'Unauthorized' }
        
        const orgId = (session.user as any).organizationId
        const requesterRole = (session.user as any).role
        const requesterDivisionId = (session.user as any).division?.id

        // Security Check: GROUP_ADMIN scoping
        if (requesterRole === Role.GROUP_ADMIN) {
            // Must be in the same division
            if (divisionId !== requesterDivisionId) {
                return { success: false, error: 'Anda hanya dapat mengundang user ke divisi Anda sendiri.' }
            }
            // Cannot create SUPER_ADMIN
            if (role === Role.SUPER_ADMIN) {
                return { success: false, error: 'Anda tidak dapat membuat user dengan peran Super Admin.' }
            }
        }

        await prisma.user.create({
            data: {
                email,
                password_hash: passwordHash,
                full_name: fullName,
                job_title: jobTitle || null,
                organization_id: orgId,
                user_divisions: {
                    create: {
                        division_id: divisionId,
                        role: role as Role,
                        is_primary: true,
                    },
                },
            },
        })

        revalidatePath('/dashboard/hrd/users')
        return { success: true }
    } catch (err: any) {
        if (err.code === 'P2002') {
            return { success: false, error: 'Email sudah terdaftar' }
        }
        return { success: false, error: err.message || 'Gagal membuat user' }
    }
}
export async function updatePasswordAction(password: string) {
    const { getServerSession } = await import('next-auth')
    const { authOptions } = await import('@/lib/auth')
    const session = await getServerSession(authOptions)

    if (!session?.user) return { success: false, error: 'Unauthorized' }
    const userId = (session.user as any).id

    if (!password || password.length < 6) {
        return { success: false, error: 'Password minimal 6 karakter' }
    }

    try {
        const passwordHash = await bcrypt.hash(password, 10)
        await prisma.user.update({
            where: { id: userId },
            data: { password_hash: passwordHash }
        })
        return { success: true }
    } catch (err: any) {
        return { success: false, error: err.message || 'Gagal memperbarui password' }
    }
}
