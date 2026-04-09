import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { Role } from "@prisma/client"

/**
 * Gets the current session user
 */
export async function getSessionUser() {
    const session = await getServerSession(authOptions)
    return session?.user as any
}

/**
 * Checks if the user is a SUPER_ADMIN or MAINTAINER
 */
export async function isAdmin() {
    const user = await getSessionUser()
    if (!user) return false
    return user.role === Role.SUPER_ADMIN || user.role === Role.MAINTAINER
}

/**
 * Checks if the user is a GROUP_ADMIN for a specific division
 */
export async function isGroupAdmin(divisionId?: string) {
    const user = await getSessionUser()
    if (!user) return false
    
    // Super Admin counts as Group Admin for all
    if (user.role === Role.SUPER_ADMIN || user.role === Role.MAINTAINER) return true
    
    if (user.role !== Role.GROUP_ADMIN) return false
    if (divisionId && user.divisionId !== divisionId) return false
    
    return true
}

/**
 * Checks if the user is a SUPERVISOR for a specific division
 */
export async function isSupervisor(divisionId?: string) {
    const user = await getSessionUser()
    if (!user) return false
    
    // Admins count as Supervisors for all
    if (user.role === Role.SUPER_ADMIN || user.role === Role.MAINTAINER || user.role === Role.GROUP_ADMIN) return true
    
    if (user.role !== Role.SUPERVISOR) return false
    if (divisionId && user.divisionId !== divisionId) return false
    
    return true
}

/**
 * Checks if the user has at least READ access to a division
 */
export async function hasAccessToDivision(divisionId: string) {
    const user = await getSessionUser()
    if (!user) return false
    
    if (user.role === Role.SUPER_ADMIN || user.role === Role.MAINTAINER) return true
    
    return user.divisionId === divisionId
}
