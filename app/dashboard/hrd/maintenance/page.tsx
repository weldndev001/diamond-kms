'use client'

import React, { useState, useEffect, useRef } from 'react'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import {
    getFeatureFlagsAction,
    toggleFeatureFlagAction,
    createFeatureFlagAction
} from '@/lib/actions/admin.actions'
import { RoleGuard } from '@/components/shared/RoleGuard'
import {
    Shield, ToggleLeft, ToggleRight, Plus, AlertTriangle,
    Bell, Database, Wrench, Clock, Download, Upload, CheckCircle, Loader2, FileDown, FileUp,
    KeyRound, Copy, MonitorDot
} from 'lucide-react'
import Link from 'next/link'
import { ErrorLogsSection } from './ErrorLogsSection'

export default function MaintenancePage() {
    const { organization } = useCurrentUser()
    const [flags, setFlags] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [maintenanceMode, setMaintenanceMode] = useState(false)
    const [maintenanceMsg, setMaintenanceMsg] = useState('System is under maintenance. Please try again later.')
    const [newFlagKey, setNewFlagKey] = useState('')
    const [addingFlag, setAddingFlag] = useState(false)

    // Backup & Restore state
    const [backupStatus, setBackupStatus] = useState<'idle' | 'running' | 'done' | 'error'>('idle')
    const [restoreStatus, setRestoreStatus] = useState<'idle' | 'running' | 'done' | 'error'>('idle')
    const [restoreResult, setRestoreResult] = useState<any>(null)
    const [dbStats, setDbStats] = useState<any>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)

    const loadData = async () => {
        if (!organization?.id) return
        const res = await getFeatureFlagsAction(organization.id)
        if (res.success && res.data) {
            setFlags(res.data)
            const mmFlag = res.data.find((f: any) => f.flag_key === 'maintenance_mode')
            if (mmFlag) {
                setMaintenanceMode(mmFlag.is_enabled)
            }
        }
        setLoading(false)
    }

    const loadDbStats = async () => {
        try {
            setDbStats({ loading: true })
            const res = await fetch('/api/admin/backup')
            if (res.ok) {
                const data = await res.json()
                setDbStats(data)
            } else {
                setDbStats(null)
            }
        } catch {
            setDbStats(null)
        }
    }

    useEffect(() => { loadData() }, [organization?.id])

    const handleToggleFlag = async (flagId: string, currentVal: boolean) => {
        const res = await toggleFeatureFlagAction(flagId, !currentVal)
        if (res.success) {
            setFlags(prev => prev.map(f => f.id === flagId ? { ...f, is_enabled: !currentVal } : f))
            const flag = flags.find(f => f.id === flagId)
            if (flag?.flag_key === 'maintenance_mode') {
                setMaintenanceMode(!currentVal)
            }
        }
    }

    const handleToggleMaintenance = async () => {
        if (!organization?.id) return
        let mmFlag = flags.find((f: any) => f.flag_key === 'maintenance_mode')
        if (!mmFlag) {
            const res = await createFeatureFlagAction(organization.id, 'maintenance_mode')
            if (res.success) {
                await loadData()
                mmFlag = flags.find((f: any) => f.flag_key === 'maintenance_mode')
            }
        }
        if (mmFlag) {
            await handleToggleFlag(mmFlag.id, maintenanceMode)
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

    // Download backup as JSON file
    const handleBackup = async () => {
        setBackupStatus('running')
        try {
            const res = await fetch('/api/admin/backup', { method: 'POST' })
            if (!res.ok) throw new Error('Backup failed')

            const blob = await res.blob()
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `diamond-kms-backup-${new Date().toISOString().slice(0, 10)}.json`
            document.body.appendChild(a)
            a.click()
            document.body.removeChild(a)
            URL.revokeObjectURL(url)

            setBackupStatus('done')
            setTimeout(() => setBackupStatus('idle'), 5000)
        } catch (err) {
            setBackupStatus('error')
            setTimeout(() => setBackupStatus('idle'), 3000)
        }
    }

    // Import/restore from JSON file
    const handleRestore = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        if (!confirm('⚠️ Importing data will add to or overwrite existing data. Continue?')) {
            if (fileInputRef.current) fileInputRef.current.value = ''
            return
        }

        setRestoreStatus('running')
        setRestoreResult(null)

        try {
            const text = await file.text()
            const backup = JSON.parse(text)

            const res = await fetch('/api/admin/restore', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(backup),
            })

            const data = await res.json()

            if (res.ok && data.success) {
                setRestoreStatus('done')
                setRestoreResult(data.results)
                loadDbStats()
                setTimeout(() => setRestoreStatus('idle'), 10000)
            } else {
                setRestoreStatus('error')
                alert(`Import failed: ${data.error || 'Unknown error'}`)
                setTimeout(() => setRestoreStatus('idle'), 3000)
            }
        } catch (err: any) {
            setRestoreStatus('error')
            alert(`Invalid file: ${err.message}`)
            setTimeout(() => setRestoreStatus('idle'), 3000)
        }

        if (fileInputRef.current) fileInputRef.current.value = ''
    }

    return (
        <RoleGuard allowedRoles={['SUPER_ADMIN', 'MAINTAINER']}>
            <div className="space-y-8">
                <div>
                    <h1 className="text-[28px] font-bold font-display text-navy-900 leading-tight flex items-center gap-2">
                        <Wrench className="text-amber-500" size={28} />
                        Maintenance Dashboard
                    </h1>
                    <p className="text-sm text-text-500 mt-1">
                        Manage maintenance mode, feature flags, and database backups.
                    </p>
                </div>

                {loading ? (
                    <div className="flex flex-col items-center justify-center py-20">
                        <div className="w-10 h-10 border-4 border-navy-200 border-t-navy-600 rounded-full animate-spin mb-4" />
                        <p className="text-text-500 font-medium">Loading...</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        <div className="lg:col-span-2 space-y-6">
                            {/* Maintenance Mode Toggle */}
                            <div className={`card p-6 border-2 transition ${maintenanceMode ? 'border-warning bg-warning-bg/30' : 'border-surface-200'}`}>
                                <div className="flex items-start justify-between">
                                    <div className="flex items-start gap-4">
                                        <div className={`p-3 rounded-xl ${maintenanceMode ? 'bg-warning/10 text-warning' : 'bg-surface-100 text-text-400'}`}>
                                            <AlertTriangle size={24} />
                                        </div>
                                        <div>
                                            <h2 className="font-bold font-display text-navy-900 text-lg">Maintenance Mode</h2>
                                            <p className="text-sm text-text-500 mt-1 max-w-md">
                                                When active, users will see a maintenance page and cannot access main features.
                                            </p>
                                            {maintenanceMode && (
                                                <div className="mt-3 flex items-center gap-2 text-sm text-warning font-semibold">
                                                    <Clock size={14} />
                                                    Maintenance Mode ACTIVE
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <button
                                        onClick={handleToggleMaintenance}
                                        className="shrink-0"
                                    >
                                        {maintenanceMode ? (
                                            <ToggleRight size={36} className="text-warning" />
                                        ) : (
                                            <ToggleLeft size={36} className="text-text-300" />
                                        )}
                                    </button>
                                </div>

                                {maintenanceMode && (
                                    <div className="mt-4 pt-4 border-t border-warning/20">
                                        <label className="block text-sm font-medium text-text-700 mb-2">
                                            <Bell size={14} className="inline mr-1.5" />
                                            Message for Users
                                        </label>
                                        <textarea
                                            value={maintenanceMsg}
                                            onChange={(e) => setMaintenanceMsg(e.target.value)}
                                            rows={2}
                                            className="w-full border-surface-200 border rounded-md p-2.5 text-sm focus:ring-navy-600 focus:border-navy-600"
                                        />
                                    </div>
                                )}
                            </div>

                            {/* Remote Maintenance OTP Link */}
                            <div className="card p-6 border-2 border-surface-200">
                                <div className="flex items-start gap-4">
                                    <div className="p-3 rounded-xl bg-navy-100 text-navy-600">
                                        <MonitorDot size={24} />
                                    </div>
                                    <div className="flex-1">
                                        <h2 className="font-bold font-display text-navy-900 text-lg">Remote Maintenance Access</h2>
                                        <p className="text-sm text-text-500 mt-1 max-w-md">
                                            Access the OTP code generation feature for WELDN_AI technical remote maintenance.
                                        </p>
                                        <Link 
                                            href="/dashboard/hrd/remote-access"
                                            className="btn btn-primary mt-4 inline-flex items-center gap-2"
                                        >
                                            <KeyRound size={16} />
                                            Open Remote Access Page
                                        </Link>
                                    </div>
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
                                    {flags.filter(f => f.flag_key !== 'maintenance_mode').length === 0 ? (
                                        <div className="p-8 text-center text-text-500">
                                            No other feature flags found. Add below.
                                        </div>
                                    ) : (
                                        flags.filter(f => f.flag_key !== 'maintenance_mode').map(flag => (
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
                                        placeholder="e.g. enable_new_search"
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

                            {/* Error Logs Section */}
                            <ErrorLogsSection />
                        </div>

                        {/* Right Sidebar */}
                        <div className="space-y-6">
                            {/* Database Backup — Download */}
                            <div className="card p-5 space-y-4">
                                <h3 className="font-bold font-display text-navy-900 flex items-center gap-2">
                                    <FileDown size={16} className="text-navy-600" /> Export Database
                                </h3>
                                <p className="text-sm text-text-500">
                                    Download all database data as a JSON file (includes chats, leaderboard, documents, etc.).
                                </p>
                                <button
                                    onClick={handleBackup}
                                    disabled={backupStatus === 'running'}
                                    className={`btn w-full justify-center ${backupStatus === 'done' ? 'bg-success text-white hover:bg-green-700' : backupStatus === 'error' ? 'bg-danger text-white' : 'btn-primary'}`}
                                >
                                    {backupStatus === 'running' ? (
                                        <>
                                            <Loader2 size={16} className="animate-spin" />
                                            Downloading...
                                        </>
                                    ) : backupStatus === 'done' ? (
                                        <>
                                            <CheckCircle size={16} />
                                            Download Complete!
                                        </>
                                    ) : backupStatus === 'error' ? (
                                        'Export Failed'
                                    ) : (
                                        <>
                                            <Download size={16} />
                                            Download Backup
                                        </>
                                    )}
                                </button>
                            </div>

                            {/* Database Import */}
                            <div className="card p-5 space-y-4">
                                <h3 className="font-bold font-display text-navy-900 flex items-center gap-2">
                                    <FileUp size={16} className="text-navy-600" /> Import Database
                                </h3>
                                <p className="text-sm text-text-500">
                                    Upload a JSON backup file to restore data. Existing data will be updated.
                                </p>
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept=".json"
                                    onChange={handleRestore}
                                    className="hidden"
                                />
                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    disabled={restoreStatus === 'running'}
                                    className={`btn w-full justify-center ${restoreStatus === 'done' ? 'bg-success text-white hover:bg-green-700' : restoreStatus === 'error' ? 'bg-danger text-white' : 'border border-navy-600 text-navy-600 hover:bg-navy-50'}`}
                                >
                                    {restoreStatus === 'running' ? (
                                        <>
                                            <Loader2 size={16} className="animate-spin" />
                                            Importing...
                                        </>
                                    ) : restoreStatus === 'done' ? (
                                        <>
                                            <CheckCircle size={16} />
                                            Import Complete!
                                        </>
                                    ) : restoreStatus === 'error' ? (
                                        'Import Failed'
                                    ) : (
                                        <>
                                            <Upload size={16} />
                                            Upload & Import
                                        </>
                                    )}
                                </button>

                                {/* Import Results */}
                                {restoreResult && restoreStatus === 'done' && (
                                    <div className="bg-success-bg border border-green-200 rounded-lg p-3 space-y-1">
                                        <p className="text-xs font-semibold text-green-800">Import Results:</p>
                                        <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs text-green-700">
                                            {Object.entries(restoreResult).map(([key, val]) => (
                                                <div key={key} className="flex justify-between">
                                                    <span className="capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                                                    <span className="font-mono font-semibold">{String(val)}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* DB Stats */}
                            <div className="card p-5 space-y-3">
                                <h3 className="font-bold font-display text-navy-900 flex items-center justify-between gap-2 text-sm">
                                    <span className="flex items-center gap-2">
                                        <Database size={14} className="text-navy-600" /> Database Stats
                                    </span>
                                    {!dbStats && (
                                        <button
                                            onClick={loadDbStats}
                                            className="text-xs font-semibold text-navy-600 hover:text-navy-700 bg-navy-50 hover:bg-navy-100 px-2.5 py-1 rounded transition"
                                        >
                                            Load Data
                                        </button>
                                    )}
                                </h3>

                                {!dbStats ? (
                                    <p className="text-xs text-text-400">Click "Load Data" to see current database statistics.</p>
                                ) : dbStats?.loading ? (
                                    <div className="flex items-center justify-center p-4">
                                        <Loader2 size={24} className="text-navy-400 animate-spin" />
                                    </div>
                                ) : (
                                    <div className="space-y-1.5 pt-2">
                                        {Object.entries(dbStats.tables || {}).map(([key, val]) => (
                                            <div key={key} className="flex justify-between text-xs">
                                                <span className="text-text-500 capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                                                <span className="font-mono font-semibold text-navy-900">{String(val)}</span>
                                            </div>
                                        ))}
                                        <div className="pt-2 mt-2 border-t border-surface-200 flex justify-between text-xs font-semibold">
                                            <span className="text-text-700">Total Records</span>
                                            <span className="text-navy-900 font-mono">{dbStats.totalRecords}</span>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Quick Stats */}
                            <div className="card p-5 text-center">
                                <p className="text-text-500 text-xs font-semibold uppercase tracking-wider">Active Flags</p>
                                <p className="text-3xl font-black font-display text-navy-900 mt-2">
                                    {flags.filter(f => f.is_enabled).length}
                                </p>
                                <p className="text-xs text-text-300 mt-1">out of {flags.length} total</p>
                            </div>

                            <div className="card p-5 text-center">
                                <p className="text-text-500 text-xs font-semibold uppercase tracking-wider">System Status</p>
                                <p className={`text-lg font-bold mt-2 ${maintenanceMode ? 'text-warning' : 'text-success'}`}>
                                    {maintenanceMode ? '🔧 Maintenance' : '✅ Operational'}
                                </p>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </RoleGuard>
    )
}
