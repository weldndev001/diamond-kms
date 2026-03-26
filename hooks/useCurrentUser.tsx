'use client'

import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react'
import { APIResponse, UserWithRole } from '@/types'
import { signOut } from 'next-auth/react'

interface UserContextType {
    user: UserWithRole | null
    role: UserWithRole['role']
    division: UserWithRole['division']
    organization: UserWithRole['organization']
    isLoading: boolean
    refresh: () => Promise<void>
}

const UserContext = createContext<UserContextType>({
    user: null,
    role: undefined,
    division: undefined,
    organization: undefined,
    isLoading: true,
    refresh: async () => { },
})

// In-memory cache to prevent re-fetching across mounts
let cachedUser: UserWithRole | null = null
let fetchPromise: Promise<UserWithRole | null> | null = null

async function fetchUserData(): Promise<UserWithRole | null> {
    try {
        const res = await fetch('/api/auth/me')
        if (res.status === 401) {
            signOut({ redirect: false })
            cachedUser = null
            return null
        }
        const json: APIResponse<UserWithRole> = await res.json()
        if (json.success && json.data) {
            cachedUser = json.data
            return json.data
        }
        cachedUser = null
        return null
    } catch {
        cachedUser = null
        return null
    }
}

export function UserProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<UserWithRole | null>(cachedUser)
    const [isLoading, setIsLoading] = useState(!cachedUser)

    const loadUser = useCallback(async (force = false) => {
        if (!force && cachedUser) {
            setUser(cachedUser)
            setIsLoading(false)
            return
        }

        // Deduplicate concurrent requests
        if (!fetchPromise) {
            fetchPromise = fetchUserData()
        }

        try {
            const userData = await fetchPromise
            setUser(userData)
        } finally {
            fetchPromise = null
            setIsLoading(false)
        }
    }, [])

    const refresh = useCallback(async () => {
        cachedUser = null
        fetchPromise = null
        setIsLoading(true)
        await loadUser(true)
    }, [loadUser])

    useEffect(() => {
        loadUser()
    }, [loadUser])

    return (
        <UserContext.Provider value={{
            user,
            role: user?.role,
            division: user?.division,
            organization: user?.organization,
            isLoading,
            refresh,
        }}>
            {children}
        </UserContext.Provider>
    )
}

export function useCurrentUser() {
    return useContext(UserContext)
}

// Clear cache on logout
export function clearUserCache() {
    cachedUser = null
    fetchPromise = null
}
