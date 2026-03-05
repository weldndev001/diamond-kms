'use client'

import { useEffect, useState } from 'react'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { RoleGuard } from '@/components/shared/RoleGuard'
import { getUsersAction, getDivisionsAction } from '@/lib/actions/user.actions'
import InviteUserModal from '@/components/users/InviteUserModal'
import EditUserModal from '@/components/users/EditUserModal'
import { Search, Plus } from 'lucide-react'

export default function UsersPage() {
    const { organization, role } = useCurrentUser()
    const [users, setUsers] = useState<any[]>([])
    const [divisions, setDivisions] = useState<any[]>([])
    const [loading, setLoading] = useState(true)

    const [isInviteOpen, setIsInviteOpen] = useState(false)
    const [editingUser, setEditingUser] = useState<any>(null)
    const [searchTerm, setSearchTerm] = useState('')

    useEffect(() => {
        if (organization?.id) {
            loadData()
        }
    }, [organization?.id, isInviteOpen, editingUser]) // reload when modals close

    const loadData = async () => {
        if (!organization?.id) return
        const [usersRes, divRes] = await Promise.all([
            getUsersAction(organization.id),
            getDivisionsAction(organization.id)
        ])
        if (usersRes.success) setUsers(usersRes.data || [])
        if (divRes.success) setDivisions(divRes.data || [])
        setLoading(false)
    }

    const filteredUsers = users.filter(u =>
        u.full_name?.toLowerCase().includes(searchTerm.toLowerCase())
    )

    return (
        <RoleGuard allowedRoles={['SUPER_ADMIN', 'GROUP_ADMIN']}>
            <div className="space-y-6">
                <div className="flex justify-between items-center">
                    <h1 className="text-2xl font-bold font-display text-navy-900">User Management</h1>
                    <button
                        onClick={() => setIsInviteOpen(true)}
                        className="btn btn-primary"
                    >
                        <Plus size={18} /> Buat User
                    </button>
                </div>

                <div className="card">
                    <div className="p-4 border-b flex justify-between items-center">
                        <div className="relative w-72">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-text-300" size={18} />
                            <input
                                type="text"
                                placeholder="Search users..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-10 pr-4 py-2 border rounded-md w-full focus:ring-navy-600 focus:border-navy-600"
                            />
                        </div>
                        <div className="text-sm text-text-500">
                            Total: {users.length} users
                        </div>
                    </div>

                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-surface-50 text-text-500 text-sm">
                                <th className="p-4 font-medium">Name</th>
                                <th className="p-4 font-medium">Role</th>
                                <th className="p-4 font-medium">Division</th>
                                <th className="p-4 font-medium">Status</th>
                                <th className="p-4 font-medium w-32">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan={5} className="p-8 text-center text-text-500">Loading...</td></tr>
                            ) : filteredUsers.length === 0 ? (
                                <tr><td colSpan={5} className="p-8 text-center text-text-500">No users found.</td></tr>
                            ) : (
                                filteredUsers.map((u) => (
                                    <tr key={u.id} className="border-t hover:bg-surface-50">
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
                                            <span className={`inline-block w-2.5 h-2.5 rounded-full mr-2 ${u.is_active ? 'bg-green-500' : 'bg-red-500'}`}></span>
                                            <span className="text-sm text-text-500">{u.is_active ? 'Active' : 'Inactive'}</span>
                                        </td>
                                        <td className="p-4">
                                            <button
                                                onClick={() => setEditingUser(u)}
                                                className="text-navy-600 hover:underline text-sm font-medium"
                                            >
                                                Edit
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                <InviteUserModal
                    isOpen={isInviteOpen}
                    onClose={() => setIsInviteOpen(false)}
                    divisions={divisions}
                    creatorRole={role}
                />

                <EditUserModal
                    isOpen={!!editingUser}
                    onClose={() => setEditingUser(null)}
                    user={editingUser}
                    divisions={divisions}
                />
            </div>
        </RoleGuard>
    )
}
