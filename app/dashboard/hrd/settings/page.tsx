'use client'

import { useState, useEffect } from 'react'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import {
    getFeatureFlagsAction,
    toggleFeatureFlagAction,
    createFeatureFlagAction,
    getOrganizationAction,
    updateOrganizationAction
} from '@/lib/actions/admin.actions'
import { RoleGuard } from '@/components/shared/RoleGuard'
import { Settings, ToggleLeft, ToggleRight, Plus, Save, Building2, Users, FolderTree, FileText, Shield } from 'lucide-react'

export default function SettingsPage() {
    const { organization, user, refresh } = useCurrentUser()
    const [flags, setFlags] = useState<any[]>([])
    const [org, setOrg] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [orgName, setOrgName] = useState('')
    const [crossDiv, setCrossDiv] = useState(false)
    const [saving, setSaving] = useState(false)
    const [newFlagKey, setNewFlagKey] = useState('')
    const [addingFlag, setAddingFlag] = useState(false)

    const loadData = async () => {
        if (!organization?.id) return
        const [flagRes, orgRes] = await Promise.all([
            getFeatureFlagsAction(organization.id),
            getOrganizationAction(organization.id)
        ])
        if (flagRes.success) setFlags(flagRes.data || [])
        if (orgRes.success && orgRes.data) {
            setOrg(orgRes.data)
            setOrgName(orgRes.data.name)
            setCrossDiv(orgRes.data.cross_division_query_enabled)
        }
        setLoading(false)
    }

    useEffect(() => { loadData() }, [organization?.id])

    const handleToggleFlag = async (flagId: string, currentVal: boolean) => {
        const res = await toggleFeatureFlagAction(flagId, !currentVal)
        if (res.success) {
            setFlags(prev => prev.map(f => f.id === flagId ? { ...f, is_enabled: !currentVal } : f))
        }
    }

    const handleAddFlag = async () => {
        if (!newFlagKey.trim() || !organization?.id) return
        setAddingFlag(true)
        const res = await createFeatureFlagAction(organization.id, newFlagKey.trim())
        if (res.success) {
            setNewFlagKey('')
            loadData()
        }
        setAddingFlag(false)
    }

    const handleSaveOrg = async () => {
        if (!organization?.id) return
        setSaving(true)
        await updateOrganizationAction(organization.id, {
            name: orgName,
            crossDivisionQueryEnabled: crossDiv
        })
        setSaving(false)
        // Refresh user context so sidebar picks up org name change instantly
        await refresh()
    }

    return (
        <RoleGuard allowedRoles={['SUPER_ADMIN']}>
            <div className="space-y-8">
                <div>
                    <h1 className="text-[28px] font-bold font-display text-navy-900 leading-tight">Organization Settings</h1>
                    <p className="text-sm text-text-500 mt-1">Configure your workspace, feature flags, and system preferences.</p>
                </div>

                {loading ? (
                    <div className="flex flex-col items-center justify-center py-20">
                        <div className="w-10 h-10 border-4 border-navy-200 border-t-navy-600 rounded-full animate-spin mb-4" />
                        <p className="text-text-500 font-medium">Loading settings...</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        {/* Left: General Settings */}
                        <div className="lg:col-span-2 space-y-6">
                            {/* Organization Info */}
                            <div className="card p-6 space-y-5">
                                <h2 className="font-bold font-display text-navy-900 text-lg flex items-center gap-2">
                                    <Building2 size={18} className="text-navy-600" /> General
                                </h2>

                                <div className="space-y-2">
                                    <label className="block text-sm font-medium text-text-700">Organization Name</label>
                                    <input
                                        type="text"
                                        value={orgName}
                                        onChange={(e) => setOrgName(e.target.value)}
                                        className="input-field max-w-md"
                                    />
                                </div>

                                <div className="flex items-start gap-4 bg-surface-50 border border-surface-200 rounded-lg p-4">
                                    <button
                                        type="button"
                                        onClick={() => setCrossDiv(!crossDiv)}
                                        className="mt-0.5 shrink-0"
                                    >
                                        {crossDiv ? (
                                            <ToggleRight size={28} className="text-navy-600" />
                                        ) : (
                                            <ToggleLeft size={28} className="text-text-300" />
                                        )}
                                    </button>
                                    <div>
                                        <p className="font-bold text-navy-900">Cross-Division Queries</p>
                                        <p className="text-sm text-text-500 mt-0.5">
                                            Allow users to search documents across all divisions, not just their own.
                                        </p>
                                    </div>
                                </div>

                                <div className="flex justify-end pt-2">
                                    <button
                                        onClick={handleSaveOrg}
                                        disabled={saving}
                                        className="btn btn-primary"
                                    >
                                        <Save size={16} /> {saving ? 'Saving...' : 'Save Changes'}
                                    </button>
                                </div>
                            </div>

                            {/* Feature Flags */}
                            <div className="card overflow-hidden">
                                <div className="p-5 border-b border-surface-200 bg-surface-0 flex justify-between items-center">
                                    <h2 className="font-bold font-display text-navy-900 flex items-center gap-2">
                                        <Shield size={18} className="text-navy-600" /> Feature Flags
                                    </h2>
                                </div>

                                <div className="divide-y divide-surface-100">
                                    {flags.length === 0 ? (
                                        <div className="p-8 text-center text-text-500">
                                            No feature flags configured. Add one below.
                                        </div>
                                    ) : (
                                        flags.map(flag => (
                                            <div key={flag.id} className="p-4 flex items-center justify-between hover:bg-surface-50 transition">
                                                <div>
                                                    <p className="font-medium text-navy-900 font-mono text-sm">{flag.flag_key}</p>
                                                    <p className="text-xs text-text-300 mt-0.5">
                                                        Created: {new Date(flag.created_at).toLocaleDateString('en-US')}
                                                    </p>
                                                </div>
                                                <button
                                                    onClick={() => handleToggleFlag(flag.id, flag.is_enabled)}
                                                    className="shrink-0"
                                                >
                                                    {flag.is_enabled ? (
                                                        <ToggleRight size={28} className="text-success" />
                                                    ) : (
                                                        <ToggleLeft size={28} className="text-text-300" />
                                                    )}
                                                </button>
                                            </div>
                                        ))
                                    )}
                                </div>

                                {/* Add new flag */}
                                <div className="p-4 border-t bg-surface-50 flex gap-3 items-center">
                                    <input
                                        type="text"
                                        placeholder="e.g. enable_ai_search"
                                        value={newFlagKey}
                                        onChange={(e) => setNewFlagKey(e.target.value)}
                                        className="input-field flex-1 font-mono text-sm"
                                        onKeyDown={(e) => { if (e.key === 'Enter') handleAddFlag() }}
                                    />
                                    <button
                                        onClick={handleAddFlag}
                                        disabled={addingFlag || !newFlagKey.trim()}
                                        className="btn btn-primary shrink-0"
                                    >
                                        <Plus size={16} /> Add Flag
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Right: Quick Stats */}
                        <div className="space-y-5">
                            <div className="card p-5 text-center">
                                <p className="text-text-500 text-xs font-semibold uppercase tracking-wider">Team Size</p>
                                <p className="text-3xl font-black font-display text-navy-900 mt-2">
                                    {org?._count?.users || 0}
                                </p>
                                <p className="text-xs text-text-300 mt-1">registered users</p>
                            </div>

                            <div className="card p-5 text-center">
                                <p className="text-text-500 text-xs font-semibold uppercase tracking-wider">Divisions</p>
                                <p className="text-3xl font-black font-display text-navy-900 mt-2">
                                    {org?._count?.divisions || 0}
                                </p>
                            </div>

                            <div className="card p-5 text-center">
                                <p className="text-text-500 text-xs font-semibold uppercase tracking-wider">Documents</p>
                                <p className="text-3xl font-black font-display text-navy-900 mt-2">
                                    {org?._count?.documents || 0}
                                </p>
                            </div>

                            <div className="card p-5 text-center">
                                <p className="text-text-500 text-xs font-semibold uppercase tracking-wider">KB Articles</p>
                                <p className="text-3xl font-black font-display text-navy-900 mt-2">
                                    {org?._count?.contents || 0}
                                </p>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </RoleGuard>
    )
}
