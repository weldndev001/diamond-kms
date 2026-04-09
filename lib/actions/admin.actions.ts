'use server'

import prisma from '@/lib/prisma'
import { revalidatePath } from 'next/cache'

// ── Feature Flags ──
export async function getFeatureFlagsAction(orgId: string) {
    try {
        const flags = await prisma.featureFlag.findMany({
            where: { organization_id: orgId },
            orderBy: { flag_key: 'asc' }
        })
        return { success: true, data: flags }
    } catch (error: any) {
        return { success: false, error: error.message }
    }
}

export async function toggleFeatureFlagAction(flagId: string, enabled: boolean) {
    try {
        await prisma.featureFlag.update({
            where: { id: flagId },
            data: { is_enabled: enabled }
        })
        revalidatePath('/dashboard/hrd/settings')
        return { success: true }
    } catch (error: any) {
        return { success: false, error: error.message }
    }
}

export async function createFeatureFlagAction(orgId: string, flagKey: string) {
    try {
        const flag = await prisma.featureFlag.create({
            data: {
                organization_id: orgId,
                flag_key: flagKey,
                is_enabled: true
            }
        })
        revalidatePath('/dashboard/hrd/settings')
        return { success: true, data: flag }
    } catch (error: any) {
        return { success: false, error: error.message }
    }
}

// ── Subscriptions / Billing ──
export async function getSubscriptionAction(orgId: string) {
    try {
        const sub = await prisma.subscription.findFirst({
            where: { organization_id: orgId, is_active: true },
            orderBy: { started_at: 'desc' }
        })

        const invoices = await prisma.invoice.findMany({
            where: { organization_id: orgId },
            orderBy: { created_at: 'desc' },
            take: 10
        })

        return { success: true, data: { subscription: sub, invoices } }
    } catch (error: any) {
        return { success: false, error: error.message }
    }
}

// ── AI Usage Logs ──
export async function getAIUsageAction(orgId: string) {
    try {
        const logs = await prisma.aIUsageLog.findMany({
            where: { organization_id: orgId },
            include: { user: { select: { full_name: true } } },
            orderBy: { created_at: 'desc' },
            take: 100
        })

        // Aggregate stats
        const totalTokens = logs.reduce((sum, l) => sum + l.tokens_used, 0)
        const byAction = logs.reduce((acc, l) => {
            acc[l.action_type] = (acc[l.action_type] || 0) + l.tokens_used
            return acc
        }, {} as Record<string, number>)

        return {
            success: true,
            data: {
                logs,
                stats: {
                    totalTokens,
                    totalRequests: logs.length,
                    byAction
                }
            }
        }
    } catch (error: any) {
        return { success: false, error: error.message }
    }
}

// ── Organization Settings ──
export async function getOrganizationAction(orgId: string) {
    try {
        const org = await prisma.organization.findUnique({
            where: { id: orgId },
            include: {
                _count: {
                    select: {
                        users: true,
                        divisions: true,
                        documents: true,
                        contents: true
                    }
                }
            }
        })
        return { success: true, data: org }
    } catch (error: any) {
        return { success: false, error: error.message }
    }
}

export async function updateOrganizationAction(orgId: string, data: {
    name?: string
    crossDivisionQueryEnabled?: boolean
    appName?: string
    slogan?: string
    logoUrl?: string
    systemLanguage?: string
}) {
    try {
        await prisma.organization.update({
            where: { id: orgId },
            data: {
                name: data.name,
                cross_division_query_enabled: data.crossDivisionQueryEnabled,
                app_name: data.appName,
                slogan: data.slogan,
                logo_url: data.logoUrl,
                system_language: data.systemLanguage
            }
        })
        revalidatePath('/dashboard/hrd/website')
        return { success: true }
    } catch (error: any) {
        return { success: false, error: error.message }
    }
}

export async function updateOrgAIConfigAction(formData: FormData) {
    try {
        const orgId = formData.get('orgId') as string
        if (!orgId) return { success: false, error: 'Organization ID is required' }

        const provider = formData.get('provider') as string || 'managed'
        const endpoint = formData.get('endpoint') as string | undefined
        const apiKey = formData.get('apiKey') as string | undefined
        const chatModel = formData.get('chatModel') as string | undefined
        const embedModel = formData.get('embedModel') as string | undefined

        // Build config
        const aiConfig: any = { provider }
        if (endpoint) {
            let cleanEndpoint = endpoint.trim().replace(/\/+$/, '') // remove trailing slashes
            // Attempt to auto-correct common Ollama mistakes (e.g. missing /v1)
            // But only if it looks like an Ollama IP/host without path
            if (provider === 'self_hosted' && !cleanEndpoint.endsWith('/v1') && !cleanEndpoint.includes('/api/')) {
                cleanEndpoint += '/v1'
            }
            aiConfig.endpoint = cleanEndpoint
        }
        if (chatModel) aiConfig.chatModel = chatModel
        if (embedModel) aiConfig.embedModel = embedModel

        // Handle Encrypted Key
        if (apiKey) {
            const { encrypt } = await import('@/lib/security/key-encryptor')
            aiConfig.encryptedKey = encrypt(apiKey)
        } else {
            // retain existing key ONLY if we are NOT switching to managed or self_hosted (which don't need it)
            // or if the user explicitly wants to clear it, but here we assume empty means "keep existing" ONLY for byok
            if (provider === 'byok') {
                const org = await prisma.organization.findUnique({ where: { id: orgId }, select: { ai_provider_config: true } })
                const existingOpts = org?.ai_provider_config as any
                if (existingOpts?.encryptedKey) {
                    aiConfig.encryptedKey = existingOpts.encryptedKey
                }
            } else if (provider === 'self_hosted') {
                // If setting to self_hosted and apiKey is blank, we explicitly clear it
                // so we don't accidentally send Gemini/OpenAI keys to Ollama
                aiConfig.encryptedKey = null
            }
        }

        const autoSummaryChat = formData.get('autoSummaryChat') === 'true'
        aiConfig.autoSummaryChat = autoSummaryChat

        await prisma.organization.update({
            where: { id: orgId },
            data: {
                ai_provider_config: aiConfig,
            }
        })

        revalidatePath('/dashboard/hrd/ai')
        return { success: true }
    } catch (error: any) {
        return { success: false, error: error.message }
    }
}

export async function getAvailableModelsAction(orgId: string, currentFormState: { provider: string, endpoint?: string, apiKey?: string }) {
    try {
        const { provider, endpoint, apiKey } = currentFormState

        let fetchUrl = ''
        let token = apiKey || ''

        if (!token && provider !== 'managed') {
            const org = await prisma.organization.findUnique({ where: { id: orgId }, select: { ai_provider_config: true } })
            const config = org?.ai_provider_config as any
            if (config?.encryptedKey) {
                const { decrypt } = await import('@/lib/security/key-encryptor')
                token = decrypt(config.encryptedKey)
            }
        }

        if (provider === 'byok') {
            if (!token) return { success: false, error: 'API key is required for BYOK' }
            if (token.startsWith('sk-')) {
                fetchUrl = 'https://api.openai.com/v1/models'
            } else {
                fetchUrl = 'https://generativelanguage.googleapis.com/v1beta/models'
            }
        } else if (provider === 'self_hosted') {
            if (!endpoint) return { success: false, error: 'Endpoint is missing' }
            const baseUrl = endpoint.replace(/\/chat\/completions\/?$/, '').replace(/\/v1\/?$/, '')
            fetchUrl = `${baseUrl}/v1/models`
        } else {
            return { success: true, data: ['gemini-2.5-flash', 'gemini-1.5-pro', 'text-embedding-004'] }
        }

        const headers: Record<string, string> = {
            'Content-Type': 'application/json'
        }
        if (token && token !== 'ollama-dummy-key') {
            if (fetchUrl.includes('generativelanguage.googleapis.com')) {
                headers['x-goog-api-key'] = token
            } else {
                headers['Authorization'] = `Bearer ${token}`
            }
        }

        const res = await fetch(fetchUrl, { method: 'GET', headers })
        if (!res.ok) {
            const errText = await res.text()
            throw new Error(`Failed: ${res.status} ${errText}`)
        }

        const data = await res.json()

        let models: string[] = []
        if (data.data && Array.isArray(data.data)) {
            // OpenAI format
            models = data.data.map((m: any) => m.id)
        } else if (data.models && Array.isArray(data.models)) {
            // Gemini format
            const allGeminiModels = data.models.map((m: any) => m.name.replace('models/', ''))
            // Filter to only include 1.5, 2.0, 2.5 versions and embedding models
            models = allGeminiModels.filter((m: string) =>
                m.includes('1.5') ||
                m.includes('2.0') ||
                m.includes('2.5') ||
                m.includes('embedding')
            )
        }

        return { success: true, data: models }

    } catch (error: any) {
        return { success: false, error: error.message || 'Failed to fetch models' }
    }
}
