import { User, Role, Organization, Group, ContentStatus } from '@prisma/client'

export type UserWithRole = User & {
    role?: Role
    organization?: Organization & {
        industry_segment?: string
        ai_provider_config?: any
        cross_group_query_enabled?: boolean
    }
    group?: Group
}

export type APIResponse<T = any> = {
    success: boolean
    data?: T
    error?: string
}
