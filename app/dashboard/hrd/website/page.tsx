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
import { 
    Save, Globe, Image as ImageIcon, Layout, Type, 
    Settings, ToggleLeft, ToggleRight, Plus, Building2, 
    Shield, Users, FolderTree, FileText, BarChart3, Loader2
} from 'lucide-react'

export default function WebsiteSettingsPage() {
    const { organization, refresh } = useCurrentUser()
    
    // Organization & Feature Flags State
    const [flags, setFlags] = useState<any[]>([])
    const [org, setOrg] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [newFlagKey, setNewFlagKey] = useState('')
    const [addingFlag, setAddingFlag] = useState(false)
    
    // Form State
    const [orgName, setOrgName] = useState('')
    const [appName, setAppName] = useState('DIAMOND KMS')
    const [slogan, setSlogan] = useState('AI Powered Knowledge Management System')
    const [logo, setLogo] = useState('logo_movio.png')
    const [crossDiv, setCrossDiv] = useState(false)
    const [systemLanguage, setSystemLanguage] = useState('en-US')
    
    const [isSaving, setIsSaving] = useState(false)
    const [success, setSuccess] = useState('')

    const loadData = async () => {
        if (!organization?.id) return
        const [flagRes, orgRes] = await Promise.all([
            getFeatureFlagsAction(organization.id),
            getOrganizationAction(organization.id)
        ])
        if (flagRes.success) setFlags(flagRes.data || [])
        if (orgRes.success && orgRes.data) {
            setOrg(orgRes.data)
            setOrgName(orgRes.data.name || '')
            setAppName(orgRes.data.app_name || 'DIAMOND KMS')
            setSlogan(orgRes.data.slogan || 'AI Powered Knowledge Management System')
            setLogo(orgRes.data.logo_url || 'logo_movio.png')
            setSystemLanguage(orgRes.data.system_language || 'en-US')
            setCrossDiv(orgRes.data.cross_division_query_enabled ?? false)
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

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!organization?.id) return

        setIsSaving(true)
        setSuccess('')

        try {
            const res = await updateOrganizationAction(organization.id, {
                name: orgName,
                appName: appName,
                slogan: slogan,
                logoUrl: logo,
                systemLanguage: systemLanguage,
                crossDivisionQueryEnabled: crossDiv
            })

            if (res.success) {
                await new Promise(r => setTimeout(r, 800))
                setSuccess('Settings and Branding updated successfully!')
                await refresh()
            } else {
                alert('Failed to save settings')
            }
        } catch (err) {
            console.error(err)
        } finally {
            setIsSaving(false)
            setTimeout(() => setSuccess(''), 5000)
        }
    }

    return (
        <RoleGuard allowedRoles={['SUPER_ADMIN', 'MAINTAINER']}>
            <div className="space-y-6 max-w-6xl mx-auto">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-[28px] font-bold font-display text-navy-900 leading-tight">Application Settings</h1>
                        <p className="text-sm text-text-500 mt-1">Configure your workspace branding, system preferences, and feature flags.</p>
                    </div>
                </div>

                {loading ? (
                    <div className="flex flex-col items-center justify-center py-20 bg-white/50 rounded-2xl border-2 border-dashed border-navy-100">
                        <Loader2 className="w-10 h-10 text-navy-600 animate-spin mb-4" />
                        <p className="text-text-500 font-medium font-display">Loading your settings...</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                        <div className="lg:col-span-3 space-y-6">
                            {success && (
                                <div className="p-4 bg-success-bg text-success rounded-xl border border-green-200 text-sm font-medium flex items-center gap-2 animate-in fade-in slide-in-from-top-4">
                                    <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
                                    {success}
                                </div>
                            )}

                            <form onSubmit={handleSave} className="space-y-6">
                                {/* Brand Identity Card */}
                                <div className="card p-6 space-y-8 overflow-hidden relative">
                                    <div className="absolute top-0 right-0 p-8 opacity-[0.03] pointer-events-none">
                                        <Globe size={120} className="text-navy-900" />
                                    </div>

                                    <div className="space-y-4 relative">
                                        <h2 className="text-lg font-bold text-navy-900 flex items-center gap-2">
                                            <div className="p-1.5 bg-navy-50 rounded-lg">
                                                <Layout size={18} className="text-navy-600" />
                                            </div>
                                            Brand Identity
                                        </h2>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <div className="space-y-2">
                                                <label className="text-sm font-semibold text-text-700">Organization Name</label>
                                                <input
                                                    type="text"
                                                    value={orgName}
                                                    onChange={(e) => setOrgName(e.target.value)}
                                                    className="input-field"
                                                    placeholder="Example: WELDN_AI"
                                                />
                                                <p className="text-[10px] text-text-400 font-mono mt-1">
                                                    INTERNAL ID: <span className="bg-surface-100 px-1 py-0.5 rounded">{organization?.id || '...'}</span>
                                                </p>
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-sm font-semibold text-text-700">Application Name</label>
                                                <input
                                                    type="text"
                                                    value={appName}
                                                    onChange={(e) => setAppName(e.target.value)}
                                                    className="input-field"
                                                    placeholder="Example: DIAMOND KMS"
                                                />
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <label className="text-sm font-semibold text-text-700 flex items-center gap-2">
                                                <Type size={14} className="text-text-400" /> Application Slogan
                                            </label>
                                            <input
                                                type="text"
                                                value={slogan}
                                                onChange={(e) => setSlogan(e.target.value)}
                                                className="input-field"
                                                placeholder="Brief description of the application slogan..."
                                            />
                                        </div>
                                    </div>

                                    {/* Visual Assets */}
                                    <div className="space-y-4 pt-6 border-t border-surface-100 relative">
                                        <h2 className="text-lg font-bold text-navy-900 flex items-center gap-2">
                                            <div className="p-1.5 bg-navy-50 rounded-lg">
                                                <ImageIcon size={18} className="text-navy-600" />
                                            </div>
                                            Visual Assets
                                        </h2>
                                        <div className="flex items-center gap-6">
                                            <div className="w-24 h-24 rounded-2xl bg-surface-50 border border-surface-200 flex items-center justify-center overflow-hidden shrink-0 shadow-inner group relative">
                                                <div className="font-display font-black text-navy-600 text-[10px] text-center px-1 truncate leading-relaxed">
                                                    {logo}
                                                </div>
                                                <div className="absolute inset-0 bg-navy-900/0 group-hover:bg-navy-900/40 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                                                    <ImageIcon size={20} className="text-white" />
                                                </div>
                                            </div>
                                            <div className="flex-1 space-y-3">
                                                <button type="button" className="btn bg-white border border-surface-300 text-text-600 w-full md:w-auto px-6 text-sm hover:bg-surface-50 hover:border-navy-300 transition-all font-semibold">
                                                    Change Logo
                                                </button>
                                                <p className="text-[10px] text-text-400 max-w-sm">
                                                    Supported formats: <span className="font-semibold text-text-600">PNG, SVG, WEBP</span>. Recommended size: <span className="font-semibold text-text-600">512x512px</span>.
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Preferences Card */}
                                <div className="card p-6 space-y-5">
                                    <h2 className="font-bold font-display text-navy-900 text-lg flex items-center gap-2">
                                        <div className="p-1.5 bg-navy-50 rounded-lg">
                                            <Settings size={18} className="text-navy-600" />
                                        </div>
                                        System Preferences
                                    </h2>

                                    <div className="flex items-start gap-4 bg-surface-50 border border-surface-200 rounded-2xl p-5 transition-all hover:bg-surface-100/50 hover:shadow-sm group">
                                        <button
                                            type="button"
                                            onClick={() => setCrossDiv(!crossDiv)}
                                            className="mt-0.5 shrink-0 transition-transform active:scale-95"
                                        >
                                            {crossDiv ? (
                                                <ToggleRight size={32} className="text-navy-600" />
                                            ) : (
                                                <ToggleLeft size={32} className="text-text-300" />
                                            )}
                                        </button>
                                        <div>
                                            <p className="font-bold text-navy-900 group-hover:text-navy-600 transition-colors">Cross-Division Documents Query</p>
                                            <p className="text-sm text-text-500 mt-1 leading-relaxed">
                                                Allow users to search and ask questions across all divisions. Enabling this might compromise division-level data privacy.
                                            </p>
                                        </div>
                                    </div>

                                    {/* System Language Picker */}
                                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-surface-50 border border-surface-200 rounded-2xl p-5 transition-all hover:bg-surface-100/50 hover:shadow-sm group overflow-hidden relative">
                                        <div className="flex items-start gap-4">
                                            <div className="p-2 bg-navy-50 rounded-xl group-hover:bg-navy-100 transition-colors">
                                                <Globe size={18} className="text-navy-600" />
                                            </div>
                                            <div>
                                                <p className="font-bold text-navy-900 group-hover:text-navy-600 transition-colors">System Language</p>
                                                <p className="text-sm text-text-500 mt-1">Select your preferred language for the system interface.</p>
                                            </div>
                                        </div>
                                        
                                        <div className="relative min-w-[160px]">
                                            <select
                                                value={systemLanguage}
                                                onChange={(e) => setSystemLanguage(e.target.value)}
                                                className="w-full bg-white border border-surface-300 text-navy-900 text-sm rounded-xl px-4 py-2.5 outline-none focus:border-navy-500 focus:ring-4 focus:ring-navy-500/10 appearance-none font-semibold cursor-pointer transition-all"
                                            >
                                                <option value="en-US">English (US)</option>
                                                <option value="id-ID">Indonesia</option>
                                            </select>
                                            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-text-400">
                                                <Settings size={14} className="opacity-50" />
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex justify-end pt-2">
                                    <button
                                        type="submit"
                                        disabled={isSaving}
                                        className="btn btn-primary px-10 py-3 flex items-center gap-2 shadow-xl shadow-navy-600/20 active:scale-95 transition-transform"
                                    >
                                        {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                                        Save All Changes
                                    </button>
                                </div>
                            </form>

                            {/* Feature Flags Section */}
                            <div className="card overflow-hidden mt-8 border-navy-100">
                                <div className="p-5 border-b border-surface-200 bg-surface-50/50 flex items-center justify-between">
                                    <h2 className="font-bold font-display text-navy-900 flex items-center gap-2 text-lg">
                                        <div className="p-1.5 bg-navy-100 rounded-lg">
                                            <Shield size={18} className="text-navy-700" />
                                        </div>
                                        Enterprise Feature Flags
                                    </h2>
                                    <span className="text-[10px] font-bold text-navy-500 bg-navy-50 px-2 py-0.5 rounded-full uppercase tracking-widest">Advanced</span>
                                </div>

                                <div className="divide-y divide-surface-100">
                                    {flags.length === 0 ? (
                                        <div className="p-12 text-center text-text-400 italic font-display">
                                            No special feature flags configured for this organization.
                                        </div>
                                    ) : (
                                        flags.map(flag => (
                                            <div key={flag.id} className="p-5 flex items-center justify-between hover:bg-surface-50 transition group">
                                                <div className="space-y-1">
                                                    <p className="font-bold text-navy-900 font-mono text-sm group-hover:text-navy-600 transition-colors">{flag.flag_key}</p>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-[10px] text-text-300 font-mono">ID: {flag.id.slice(0, 8)}...</span>
                                                        <span className="w-1 h-1 rounded-full bg-surface-200" />
                                                        <span className="text-[10px] text-text-300">Enabled: {new Date(flag.created_at).toLocaleDateString()}</span>
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => handleToggleFlag(flag.id, flag.is_enabled)}
                                                    className="shrink-0 transition-transform active:scale-90"
                                                >
                                                    {flag.is_enabled ? (
                                                        <ToggleRight size={32} className="text-success" />
                                                    ) : (
                                                        <ToggleLeft size={32} className="text-text-300" />
                                                    )}
                                                </button>
                                            </div>
                                        ))
                                    )}
                                </div>

                                <div className="p-5 border-t bg-surface-50 flex gap-4 items-center">
                                    <div className="relative flex-1">
                                        <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                                            <Plus size={14} className="text-text-300" />
                                        </div>
                                        <input
                                            type="text"
                                            placeholder="new_feature_key"
                                            value={newFlagKey}
                                            onChange={(e) => setNewFlagKey(e.target.value)}
                                            className="input-field pl-9 font-mono text-sm bg-white"
                                            onKeyDown={(e) => { if (e.key === 'Enter') handleAddFlag() }}
                                        />
                                    </div>
                                    <button
                                        onClick={handleAddFlag}
                                        disabled={addingFlag || !newFlagKey.trim()}
                                        className="btn btn-primary bg-navy-600 hover:bg-navy-700 shrink-0 flex items-center gap-2 px-6"
                                    >
                                        {addingFlag ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                                        Add Flag
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Right: Quick Stats Sidebar */}
                        <div className="space-y-6">
                            <h3 className="text-xs font-bold text-text-400 uppercase tracking-widest px-1">System Statistics</h3>

                            <div className="grid grid-cols-1 gap-4">
                                <div className="card p-6 text-center shadow-sm hover:shadow-md transition-shadow group">
                                    <div className="w-12 h-12 bg-blue-50 text-blue-500 rounded-2xl flex items-center justify-center mx-auto mb-3 group-hover:bg-blue-500 group-hover:text-white transition-all">
                                        <Users size={24} />
                                    </div>
                                    <p className="text-text-500 text-xs font-semibold uppercase tracking-wider">Team Size</p>
                                    <p className="text-3xl font-black font-display text-navy-900 mt-1">
                                        {org?._count?.users || 0}
                                    </p>
                                    <p className="text-[10px] text-text-300 mt-1">registered users</p>
                                </div>

                                <div className="card p-6 text-center shadow-sm hover:shadow-md transition-shadow group">
                                    <div className="w-12 h-12 bg-purple-50 text-purple-500 rounded-2xl flex items-center justify-center mx-auto mb-3 group-hover:bg-purple-500 group-hover:text-white transition-all">
                                        <FolderTree size={24} />
                                    </div>
                                    <p className="text-text-500 text-xs font-semibold uppercase tracking-wider">Divisions</p>
                                    <p className="text-3xl font-black font-display text-navy-900 mt-1">
                                        {org?._count?.divisions || 0}
                                    </p>
                                </div>

                                <div className="card p-6 text-center shadow-sm hover:shadow-md transition-shadow group">
                                    <div className="w-12 h-12 bg-amber-50 text-amber-500 rounded-2xl flex items-center justify-center mx-auto mb-3 group-hover:bg-amber-500 group-hover:text-white transition-all">
                                        <FileText size={24} />
                                    </div>
                                    <p className="text-text-500 text-xs font-semibold uppercase tracking-wider">Documents</p>
                                    <p className="text-3xl font-black font-display text-navy-900 mt-1">
                                        {org?._count?.documents || 0}
                                    </p>
                                </div>

                                <div className="card p-6 text-center shadow-sm hover:shadow-md transition-shadow group">
                                    <div className="w-12 h-12 bg-emerald-50 text-emerald-500 rounded-2xl flex items-center justify-center mx-auto mb-3 group-hover:bg-emerald-500 group-hover:text-white transition-all">
                                        <BarChart3 size={24} />
                                    </div>
                                    <p className="text-text-500 text-xs font-semibold uppercase tracking-wider">KB Articles</p>
                                    <p className="text-3xl font-black font-display text-navy-900 mt-1">
                                        {org?._count?.contents || 0}
                                    </p>
                                </div>
                            </div>

                            <div className="bg-navy-900 rounded-2xl p-6 text-white overflow-hidden relative group">
                                <div className="absolute -right-4 -bottom-4 opacity-10 group-hover:scale-110 transition-transform">
                                    <Shield size={100} />
                                </div>
                                <h4 className="font-bold text-sm relative">Need Help?</h4>
                                <p className="text-xs text-navy-200 mt-2 leading-relaxed relative">
                                    If you need advanced system configuration or data migration assistance, contact WELDN_AI support team.
                                </p>
                                <button className="mt-4 text-[10px] font-bold bg-white/10 hover:bg-white/20 transition-colors px-3 py-1.5 rounded-lg relative border border-white/20">
                                    Contact Support
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </RoleGuard>
    )
}
