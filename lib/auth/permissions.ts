// lib/auth/permissions.ts
// Role-based permission matrix for Diamond KMS
import type { Role } from '@prisma/client'

// Action definitions — extend as features grow
type Permission =
    | 'content:create'
    | 'content:approve'
    | 'content:publish'
    | 'content:delete'
    | 'document:upload'
    | 'document:delete'
    | 'quiz:create'
    | 'quiz:take'
    | 'user:manage'
    | 'group:manage'
    | 'org:manage'
    | 'ai:use_chat'
    | 'ai:configure'
    | 'ai:view_usage'

// Permission matrix: role → set of allowed actions
const ROLE_PERMISSIONS: Record<Role, Set<Permission>> = {
    MAINTAINER: new Set([
        'org:manage',
        'ai:view_usage',
    ]),
    SUPER_ADMIN: new Set([
        'content:create', 'content:approve', 'content:publish', 'content:delete',
        'document:upload', 'document:delete',
        'quiz:create', 'quiz:take',
        'user:manage', 'group:manage', 'org:manage',
        'ai:use_chat', 'ai:configure', 'ai:view_usage',
    ]),
    GROUP_ADMIN: new Set([
        'content:create', 'content:approve', 'content:publish', 'content:delete',
        'document:upload', 'document:delete',
        'quiz:create', 'quiz:take',
        'user:manage', 'group:manage',
        'ai:use_chat', 'ai:view_usage',
    ]),
    SUPERVISOR: new Set([
        'content:create', 'content:approve',
        'document:upload',
        'quiz:create', 'quiz:take',
        'ai:use_chat',
    ]),
    STAFF: new Set([
        'content:create',
        'document:upload',
        'quiz:take',
        'ai:use_chat',
    ]),
}

export function hasPermission(role: Role, action: Permission): boolean {
    return ROLE_PERMISSIONS[role]?.has(action) ?? false
}

export type { Permission }
