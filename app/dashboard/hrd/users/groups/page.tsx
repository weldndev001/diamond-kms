'use client'

import { useState, useEffect } from 'react'
import { RoleGuard } from '@/components/shared/RoleGuard'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { getGroupsAction, deleteGroupAction } from '@/lib/actions/user.actions'
import { Plus, Trash2 } from 'lucide-react'
import Link from 'next/link'
import { useTranslation } from '@/hooks/useTranslation'
import { Skeleton } from '@/components/ui/skeleton'

function GroupsSkeleton() {
    return (
        <>
            {[1, 2, 3, 4, 5].map((i) => (
                <tr key={i} className="border-b last:border-0">
                    <td className="p-4">
                        <Skeleton className="h-5 w-40 rounded-md" />
                    </td>
                    <td className="p-4">
                        <Skeleton className="h-4 w-full max-w-xs rounded-md" />
                    </td>
                    <td className="p-4">
                        <Skeleton className="h-6 w-24 rounded border" />
                    </td>
                    <td className="p-4">
                        <Skeleton className="h-9 w-9 rounded-md" />
                    </td>
                </tr>
            ))}
        </>
    )
}

export default function GroupsPage() {
    const { organization } = useCurrentUser()
    const { t } = useTranslation()
    const [groups, setGroups] = useState<any[]>([])
    const [loading, setLoading] = useState(true)

    const loadData = async () => {
        if (!organization?.id) return
        const res = await getGroupsAction(organization.id)
        if (res.success) {
            setGroups(res.data || [])
        }
        setLoading(false)
    }

    useEffect(() => {
        loadData()
    }, [organization?.id])

    const handleDelete = async (groupId: string) => {
        if (!confirm(t('groups.delete_confirm'))) return

        const res = await deleteGroupAction(groupId)
        if (res.success) {
            loadData()
        } else {
            alert(res.error || t('groups.delete_failed'))
        }
    }

    return (
        <RoleGuard allowedRoles={['SUPER_ADMIN']}>
            <div className="space-y-6">
                <div className="flex justify-between items-center">
                    <div>
                        <h1 className="text-2xl font-bold font-display text-navy-900">{t('groups.title')}</h1>
                        <p className="text-sm text-text-500 mt-1">{t('groups.subtitle')}</p>
                    </div>
                    <Link
                        href="/dashboard/hrd/users/groups/new"
                        className="btn btn-primary flex flex-row items-center gap-2"
                    >
                        <Plus size={18} /> {t('groups.add_btn')}
                    </Link>
                </div>

                {/* Navigation tabs removed - moved to sidebar */}

                <div className="card">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-surface-50 text-text-500 text-sm border-b">
                                <th className="p-4 font-medium">{t('groups.th_name')}</th>
                                <th className="p-4 font-medium">{t('groups.th_description')}</th>
                                <th className="p-4 font-medium">{t('groups.th_members')}</th>
                                <th className="p-4 font-medium w-32">{t('common.actions')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <GroupsSkeleton />
                            ) : groups.length === 0 ? (
                                <tr><td colSpan={4} className="p-8 text-center text-text-500">{t('groups.no_groups')}</td></tr>
                            ) : (
                                groups.map((d) => (
                                    <tr key={d.id} className="border-b last:border-0 hover:bg-surface-50">
                                        <td className="p-4 font-medium text-navy-900">{d.name}</td>
                                        <td className="p-4 text-sm text-text-500">{d.description || '-'}</td>
                                        <td className="p-4">
                                            <span className="inline-block px-2 py-1 bg-surface-100 text-text-500 font-medium text-xs rounded border">
                                                {d._count?.user_groups || 0} {t('common.members')}
                                            </span>
                                        </td>
                                        <td className="p-4">
                                            <button onClick={() => handleDelete(d.id)} className="p-2 text-text-300 hover:text-danger rounded-md transition" title="Delete Group">
                                                <Trash2 size={18} />
                                            </button>
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
