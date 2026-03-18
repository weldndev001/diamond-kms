'use client'

import { useEffect, useState } from 'react'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { RoleGuard } from '@/components/shared/RoleGuard'
import { getUsersAction } from '@/lib/actions/user.actions'
import { Search, Plus, UserPlus } from 'lucide-react'
import Link from 'next/link'

export default function UsersPage() {
    const { organization, role } = useCurrentUser()
    const [users, setUsers] = useState<any[]>([])
    const [loading, setLoading] = useState(true)

    const [searchTerm, setSearchTerm] = useState('')

    useEffect(() => {
        if (organization?.id) {
            loadData()
        }
    }, [organization?.id])

    const loadData = async () => {
        if (!organization?.id) return
        const res = await getUsersAction(organization.id)
        if (res.success) setUsers(res.data || [])
        setLoading(false)
    }

    const filteredUsers = users.filter(u =>
        u.full_name?.toLowerCase().includes(searchTerm.toLowerCase())
    )

    return (
        <RoleGuard allowedRoles={['SUPER_ADMIN', 'GROUP_ADMIN']}>
            <div className="space-y-6">
                <div className="flex justify-between items-center">
                    <div>
                        <h1 className="text-2xl font-bold font-display text-navy-900">User Management</h1>
                        <p className="text-sm text-text-500 mt-1">Manage team members and your organization's divisions.</p>
                    </div>
                    <Link
                        href="/dashboard/hrd/users/new"
                        className="btn btn-primary flex flex-row items-center gap-2"
                    >
                        <UserPlus size={18} /> Create User
                    </Link>
                </div>

                {/* Navigation tabs removed - moved to sidebar */}

                <div className="card">
                    <div className="p-4 border-b flex justify-between items-center">
                        <div className="relative w-72">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-text-300" size={18} />
                            <input
                                type="text"
                                placeholder="Search users..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-10 pr-4 py-2 border rounded-md w-full focus:ring-navy-600 focus:border-navy-600 outline-none"
                            />
                        </div>
                        <div className="text-sm text-text-500">
                            Total: {users.length} users
                        </div>
                    </div>

                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-surface-50 text-text-500 text-sm">
                                <th className="p-4 font-medium border-b">Name</th>
                                <th className="p-4 font-medium border-b">Role</th>
                                <th className="p-4 font-medium border-b">Division</th>
                                <th className="p-4 font-medium border-b">Status</th>
                                <th className="p-4 font-medium border-b w-32">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan={5} className="p-8 text-center text-text-500">Loading...</td></tr>
                            ) : filteredUsers.length === 0 ? (
                                <tr><td colSpan={5} className="p-8 text-center text-text-500">No users found.</td></tr>
                            ) : (
                                filteredUsers.map((u) => (
                                    <tr key={u.id} className="border-b last:border-none hover:bg-surface-50">
                                        <td className="p-4">
                                            <div className="font-medium text-navy-900">{u.full_name}</div>
                                            <div className="text-sm text-text-500">{u.job_title}</div>
                                        </td>
                                        <td className="p-4">
                                            <span className="inline-block px-2 py-1 bg-surface-100 text-text-700 text-xs rounded border">
                                                {u.user_divisions?.[0]?.role || 'NO_ROLE'}
                                            </span>
                                        </td>
                                        <td className="p-4 text-sm text-text-500">
                                            {u.user_divisions?.[0]?.division?.name || '-'}
                                        </td>
                                        <td className="p-4">
                                            <div className="flex items-center gap-2">
                                                <span className={`w-2 h-2 rounded-full ${u.is_active ? 'bg-green-500' : 'bg-red-500'}`}></span>
                                                <span className="text-sm text-text-500">{u.is_active ? 'Active' : 'Inactive'}</span>
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <Link
                                                href={`/dashboard/hrd/users/${u.id}/edit`}
                                                className="text-navy-600 hover:text-navy-700 hover:underline text-sm font-medium transition-colors"
                                            >
                                                Edit
                                            </Link>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </RoleGuard>
    )
}
