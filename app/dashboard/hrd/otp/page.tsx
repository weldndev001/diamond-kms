'use client'

import { useState, useEffect } from 'react'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { RoleGuard } from '@/components/shared/RoleGuard'
import {
    KeyRound, ShieldCheck, ShieldAlert, Wifi, WifiOff,
    Copy, Check, Loader2, AlertTriangle, CheckCircle,
    Fingerprint, Globe, Lock, Unlock, RefreshCw,
    Clock, Users, Zap, XCircle, Info, ArrowRight
} from 'lucide-react'

interface LicenseStatus {
    is_valid: boolean
    fingerprint: string
    plan: string | null
    expires_at: string | null
    days_remaining: number
    max_users: number
    mode: string
    is_expired: boolean
    is_expiring_soon: boolean
    instance_key: string
    instance_name: string
    center_url: string
    license_details: any
}

type ActivationMode = 'online' | 'offline'
type ActionStatus = 'idle' | 'loading' | 'success' | 'error'

export default function ActivationPage() {
    const { organization } = useCurrentUser()

    // License status
    const [status, setStatus] = useState<LicenseStatus | null>(null)
    const [loading, setLoading] = useState(true)

    // Mode toggle
    const [mode, setMode] = useState<ActivationMode>('offline')

    // Online form
    const [centerUrl, setCenterUrl] = useState('')
    const [username, setUsername] = useState('')
    const [password, setPassword] = useState('')
    const [showPassword, setShowPassword] = useState(false)
    const [onlineStatus, setOnlineStatus] = useState<ActionStatus>('idle')
    const [onlineMessage, setOnlineMessage] = useState('')

    // Offline form
    const [licenseKeyInput, setLicenseKeyInput] = useState('')
    const [offlineStatus, setOfflineStatus] = useState<ActionStatus>('idle')
    const [offlineMessage, setOfflineMessage] = useState('')

    // Copied state
    const [copied, setCopied] = useState(false)

    // Fetch license status
    const fetchStatus = async () => {
        try {
            const res = await fetch('/api/activation/status')
            const data = await res.json()
            setStatus(data)
            setMode(data.mode === 'online' ? 'online' : 'offline')
            if (data.center_url) setCenterUrl(data.center_url)
        } catch (error) {
            console.error('Failed to fetch status:', error)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchStatus()
    }, [])

    // Copy fingerprint
    const handleCopyFingerprint = () => {
        if (status?.fingerprint) {
            navigator.clipboard.writeText(status.fingerprint)
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
        }
    }

    // Online activation
    const handleOnlineActivation = async (e: React.FormEvent) => {
        e.preventDefault()
        setOnlineStatus('loading')
        setOnlineMessage('')

        try {
            const res = await fetch('/api/activation/online', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ center_url: centerUrl, username, password })
            })
            const data = await res.json()

            if (!res.ok || !data.success) {
                setOnlineStatus('error')
                setOnlineMessage(data.error || 'Activation failed')
                setTimeout(() => setOnlineStatus('idle'), 5000)
                return
            }

            setOnlineStatus('success')
            setOnlineMessage(`License berhasil diaktivasi! Plan: ${data.plan}`)
            setUsername('')
            setPassword('')
            fetchStatus()
            setTimeout(() => setOnlineStatus('idle'), 5000)
        } catch (error: any) {
            setOnlineStatus('error')
            setOnlineMessage(error.message || 'Network error')
            setTimeout(() => setOnlineStatus('idle'), 5000)
        }
    }

    // Offline activation
    const handleOfflineActivation = async (e: React.FormEvent) => {
        e.preventDefault()
        setOfflineStatus('loading')
        setOfflineMessage('')

        try {
            const res = await fetch('/api/activation/offline', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ license_key: licenseKeyInput })
            })
            const data = await res.json()

            if (!res.ok || !data.success) {
                setOfflineStatus('error')
                setOfflineMessage(data.error || 'Activation failed')
                setTimeout(() => setOfflineStatus('idle'), 5000)
                return
            }

            setOfflineStatus('success')
            setOfflineMessage('License berhasil diaktivasi!')
            setLicenseKeyInput('')
            fetchStatus()
            setTimeout(() => setOfflineStatus('idle'), 5000)
        } catch (error: any) {
            setOfflineStatus('error')
            setOfflineMessage(error.message || 'Invalid license key')
            setTimeout(() => setOfflineStatus('idle'), 5000)
        }
    }

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-20 bg-white/50 rounded-2xl border-2 border-dashed border-navy-100">
                <Loader2 className="w-10 h-10 text-navy-600 animate-spin mb-4" />
                <p className="text-text-500 font-medium font-display">Loading activation status...</p>
            </div>
        )
    }

    const planBadgeColor = (plan: string | null) => {
        switch (plan) {
            case 'enterprise': return 'bg-purple-100 text-purple-700 border-purple-200'
            case 'professional': return 'bg-blue-100 text-blue-700 border-blue-200'
            default: return 'bg-slate-100 text-slate-700 border-slate-200'
        }
    }

    return (
        <RoleGuard allowedRoles={['SUPER_ADMIN']}>
            <div className="space-y-8">
                {/* Header */}
                <div>
                    <h1 className="text-[28px] font-bold font-display text-navy-900 leading-tight flex items-center gap-2">
                        <KeyRound className="text-amber-500" size={28} />
                        License Activation
                    </h1>
                    <p className="text-sm text-text-500 mt-1">
                        Aktivasi lisensi Diamond KMS melalui mode Online atau Offline.
                    </p>
                </div>

                {/* ═══ License Status Banner ═══ */}
                {status && (
                    <div className={`card p-5 border-2 ${
                        status.is_valid
                            ? status.is_expiring_soon
                                ? 'border-amber-300 bg-amber-50/50'
                                : 'border-green-300 bg-green-50/50'
                            : status.is_expired
                                ? 'border-red-300 bg-red-50/50'
                                : 'border-surface-200 bg-surface-50'
                    }`}>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                                    status.is_valid
                                        ? status.is_expiring_soon ? 'bg-amber-100' : 'bg-green-100'
                                        : status.is_expired ? 'bg-red-100' : 'bg-surface-100'
                                }`}>
                                    {status.is_valid ? (
                                        status.is_expiring_soon
                                            ? <AlertTriangle size={22} className="text-amber-600" />
                                            : <ShieldCheck size={22} className="text-green-600" />
                                    ) : status.is_expired ? (
                                        <XCircle size={22} className="text-red-600" />
                                    ) : (
                                        <ShieldAlert size={22} className="text-text-400" />
                                    )}
                                </div>
                                <div>
                                    <h3 className={`font-bold text-sm ${
                                        status.is_valid
                                            ? status.is_expiring_soon ? 'text-amber-800' : 'text-green-800'
                                            : status.is_expired ? 'text-red-800' : 'text-navy-900'
                                    }`}>
                                        {status.is_valid
                                            ? status.is_expiring_soon
                                                ? `⚠️ License Expiring Soon (${status.days_remaining} hari lagi)`
                                                : '✅ License Active'
                                            : status.is_expired
                                                ? '🚫 License Expired'
                                                : '🔒 No License'}
                                    </h3>
                                    <div className="flex items-center gap-4 mt-1 text-xs text-text-500">
                                        {status.plan && (
                                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${planBadgeColor(status.plan)}`}>
                                                {status.plan}
                                            </span>
                                        )}
                                        {status.expires_at && (
                                            <span className="flex items-center gap-1">
                                                <Clock size={11} />
                                                Expires: {new Date(status.expires_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                                            </span>
                                        )}
                                        {status.max_users > 0 && (
                                            <span className="flex items-center gap-1">
                                                <Users size={11} />
                                                Max {status.max_users} users
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <button
                                onClick={fetchStatus}
                                className="p-2 text-text-400 hover:text-navy-600 hover:bg-surface-100 rounded-lg transition-all"
                                title="Refresh status"
                            >
                                <RefreshCw size={16} />
                            </button>
                        </div>
                    </div>
                )}

                {/* ═══ Mode Toggle ═══ */}
                <div className="card p-5">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h3 className="font-bold text-navy-900 text-sm">Activation Mode</h3>
                            <p className="text-[11px] text-text-400 mt-0.5">Pilih cara aktivasi lisensi Anda</p>
                        </div>
                    </div>

                    <div className="flex bg-surface-100 rounded-xl p-1 gap-1">
                        <button
                            onClick={() => setMode('online')}
                            className={`flex-1 flex items-center justify-center gap-2.5 px-5 py-3.5 rounded-lg text-sm font-bold transition-all ${
                                mode === 'online'
                                    ? 'bg-white text-navy-900 shadow-md shadow-navy-100'
                                    : 'text-text-400 hover:text-text-600'
                            }`}
                        >
                            <Wifi size={16} className={mode === 'online' ? 'text-green-500' : ''} />
                            ONLINE
                            <span className={`text-[9px] font-medium uppercase tracking-wider px-2 py-0.5 rounded-full ${
                                mode === 'online' ? 'bg-green-100 text-green-700' : 'bg-surface-200 text-text-400'
                            }`}>Auto</span>
                        </button>
                        <button
                            onClick={() => setMode('offline')}
                            className={`flex-1 flex items-center justify-center gap-2.5 px-5 py-3.5 rounded-lg text-sm font-bold transition-all ${
                                mode === 'offline'
                                    ? 'bg-white text-navy-900 shadow-md shadow-navy-100'
                                    : 'text-text-400 hover:text-text-600'
                            }`}
                        >
                            <WifiOff size={16} className={mode === 'offline' ? 'text-amber-500' : ''} />
                            OFFLINE
                            <span className={`text-[9px] font-medium uppercase tracking-wider px-2 py-0.5 rounded-full ${
                                mode === 'offline' ? 'bg-amber-100 text-amber-700' : 'bg-surface-200 text-text-400'
                            }`}>Manual</span>
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* ═══ Left: Activation Form ═══ */}
                    <div className="lg:col-span-2 space-y-6">
                        {mode === 'online' ? (
                            /* ─── ONLINE MODE ─── */
                            <div className="card p-6 space-y-5 border-2 border-green-200 bg-green-50/20">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
                                        <Globe size={18} className="text-green-600" />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-navy-900 text-sm">Online Activation</h3>
                                        <p className="text-[11px] text-text-400">Koneksi langsung ke Diamond KMS Center untuk aktivasi otomatis</p>
                                    </div>
                                </div>

                                <form onSubmit={handleOnlineActivation} className="space-y-4">
                                    <div>
                                        <label className="text-[11px] font-semibold text-text-600 mb-1.5 block">Center URL</label>
                                        <input
                                            type="url"
                                            value={centerUrl}
                                            onChange={e => setCenterUrl(e.target.value)}
                                            placeholder="https://center.diamondkms.com atau http://localhost:1000"
                                            required
                                            className="w-full px-4 py-3 border-2 border-surface-200 rounded-xl text-sm focus:ring-green-500 focus:border-green-500 bg-white"
                                        />
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-[11px] font-semibold text-text-600 mb-1.5 block">Username</label>
                                            <input
                                                type="text"
                                                value={username}
                                                onChange={e => setUsername(e.target.value)}
                                                placeholder="client-orgname"
                                                required
                                                className="w-full px-4 py-3 border-2 border-surface-200 rounded-xl text-sm focus:ring-green-500 focus:border-green-500 bg-white"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-[11px] font-semibold text-text-600 mb-1.5 block">Password</label>
                                            <div className="relative">
                                                <input
                                                    type={showPassword ? 'text' : 'password'}
                                                    value={password}
                                                    onChange={e => setPassword(e.target.value)}
                                                    placeholder="••••••••"
                                                    required
                                                    className="w-full px-4 py-3 border-2 border-surface-200 rounded-xl text-sm focus:ring-green-500 focus:border-green-500 bg-white pr-10"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => setShowPassword(!showPassword)}
                                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-text-300 hover:text-text-600"
                                                >
                                                    {showPassword ? <Lock size={14} /> : <Unlock size={14} />}
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    <button
                                        type="submit"
                                        disabled={onlineStatus === 'loading' || !centerUrl || !username || !password}
                                        className="btn btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50 py-3"
                                    >
                                        {onlineStatus === 'loading' ? (
                                            <><Loader2 size={16} className="animate-spin" /> Connecting to Center...</>
                                        ) : (
                                            <><Zap size={16} /> Connect & Activate</>
                                        )}
                                    </button>
                                </form>

                                {/* Status Message */}
                                {onlineMessage && (
                                    <div className={`p-3 rounded-xl text-sm font-medium flex items-center gap-2 ${
                                        onlineStatus === 'success'
                                            ? 'bg-green-50 text-green-700 border border-green-200'
                                            : 'bg-red-50 text-red-700 border border-red-200'
                                    }`}>
                                        {onlineStatus === 'success' ? <CheckCircle size={14} /> : <AlertTriangle size={14} />}
                                        {onlineMessage}
                                    </div>
                                )}
                            </div>
                        ) : (
                            /* ─── OFFLINE MODE ─── */
                            <div className="space-y-6">
                                {/* Step 1: Fingerprint */}
                                <div className="card p-6 space-y-4 border-2 border-amber-200 bg-amber-50/20">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 bg-amber-500 text-white rounded-full flex items-center justify-center text-sm font-bold">1</div>
                                        <div>
                                            <h3 className="font-bold text-navy-900 text-sm">Copy Fingerprint Token</h3>
                                            <p className="text-[11px] text-text-400">Kirimkan fingerprint ini ke tim Weldn/Movio untuk digenerate-kan license key</p>
                                        </div>
                                    </div>

                                    <div className="bg-white border-2 border-surface-200 rounded-xl p-4">
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-[10px] font-bold text-text-400 uppercase tracking-wider flex items-center gap-1">
                                                <Fingerprint size={12} /> Hardware Fingerprint
                                            </span>
                                            <button
                                                onClick={handleCopyFingerprint}
                                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                                    copied
                                                        ? 'bg-green-100 text-green-700'
                                                        : 'bg-navy-100 text-navy-700 hover:bg-navy-200'
                                                }`}
                                            >
                                                {copied ? <><Check size={12} /> Copied!</> : <><Copy size={12} /> Copy</>}
                                            </button>
                                        </div>
                                        <code className="block text-lg font-mono font-bold text-navy-900 tracking-widest select-all break-all">
                                            {status?.fingerprint || 'Loading...'}
                                        </code>
                                    </div>

                                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex items-start gap-2">
                                        <Info size={14} className="text-blue-500 mt-0.5 shrink-0" />
                                        <div className="text-xs text-blue-700">
                                            <p className="font-semibold mb-1">Cara aktivasi offline:</p>
                                            <ol className="list-decimal list-inside space-y-0.5 text-blue-600">
                                                <li>Copy fingerprint di atas</li>
                                                <li>Kirim ke tim Weldn/Movio via WhatsApp/Email</li>
                                                <li>Tim akan generate license key melalui Diamond Center</li>
                                                <li>Paste license key yang diterima di Step 2 bawah ini</li>
                                            </ol>
                                        </div>
                                    </div>
                                </div>

                                {/* Step 2: License Key Input */}
                                <div className="card p-6 space-y-4 border-2 border-surface-200">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 bg-navy-600 text-white rounded-full flex items-center justify-center text-sm font-bold">2</div>
                                        <div>
                                            <h3 className="font-bold text-navy-900 text-sm">Input License Key</h3>
                                            <p className="text-[11px] text-text-400">Paste license key yang sudah digenerate oleh tim Weldn/Movio</p>
                                        </div>
                                    </div>

                                    <form onSubmit={handleOfflineActivation} className="space-y-4">
                                        <textarea
                                            value={licenseKeyInput}
                                            onChange={e => setLicenseKeyInput(e.target.value)}
                                            placeholder="Paste license key di sini... (contoh: eyJpbnN0YW5jZV9rZXk...)"
                                            rows={4}
                                            required
                                            className="w-full px-4 py-3 border-2 border-surface-200 rounded-xl text-sm font-mono focus:ring-navy-500 focus:border-navy-500 resize-none bg-white"
                                        />

                                        <button
                                            type="submit"
                                            disabled={offlineStatus === 'loading' || !licenseKeyInput.trim()}
                                            className="btn btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50 py-3"
                                        >
                                            {offlineStatus === 'loading' ? (
                                                <><Loader2 size={16} className="animate-spin" /> Activating...</>
                                            ) : (
                                                <><KeyRound size={16} /> Activate License Key</>
                                            )}
                                        </button>
                                    </form>

                                    {/* Status Message */}
                                    {offlineMessage && (
                                        <div className={`p-3 rounded-xl text-sm font-medium flex items-center gap-2 ${
                                            offlineStatus === 'success'
                                                ? 'bg-green-50 text-green-700 border border-green-200'
                                                : 'bg-red-50 text-red-700 border border-red-200'
                                        }`}>
                                            {offlineStatus === 'success' ? <CheckCircle size={14} /> : <AlertTriangle size={14} />}
                                            {offlineMessage}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* ═══ Right: Info Panel ═══ */}
                    <div className="space-y-6">
                        {/* System Info */}
                        <div className="card p-5 space-y-4">
                            <h4 className="font-bold text-navy-900 text-sm flex items-center gap-2">
                                <Fingerprint size={14} className="text-navy-500" />
                                System Info
                            </h4>
                            <div className="space-y-3">
                                <div>
                                    <span className="text-[10px] font-bold text-text-400 uppercase tracking-wider block mb-0.5">Instance Key</span>
                                    <code className="text-xs font-mono text-navy-700 bg-surface-100 px-2 py-1 rounded">{status?.instance_key}</code>
                                </div>
                                <div>
                                    <span className="text-[10px] font-bold text-text-400 uppercase tracking-wider block mb-0.5">Instance Name</span>
                                    <p className="text-sm text-navy-900 font-medium">{status?.instance_name}</p>
                                </div>
                                <div>
                                    <span className="text-[10px] font-bold text-text-400 uppercase tracking-wider block mb-0.5">Fingerprint</span>
                                    <code className="text-[11px] font-mono text-navy-700 bg-surface-100 px-2 py-1 rounded break-all block">{status?.fingerprint}</code>
                                </div>
                                <div>
                                    <span className="text-[10px] font-bold text-text-400 uppercase tracking-wider block mb-0.5">Activation Mode</span>
                                    <div className="flex items-center gap-1.5">
                                        {status?.mode === 'online' ? (
                                            <><Wifi size={12} className="text-green-500" /> <span className="text-sm text-green-700 font-medium">Online</span></>
                                        ) : (
                                            <><WifiOff size={12} className="text-amber-500" /> <span className="text-sm text-amber-700 font-medium">Offline</span></>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* How it works */}
                        <div className="card p-5 bg-navy-50 border-navy-200 space-y-3">
                            <h4 className="font-bold text-navy-900 text-sm flex items-center gap-2">
                                <Info size={14} className="text-navy-500" />
                                Panduan Mode
                            </h4>
                            <div className="space-y-3">
                                <div className="bg-white rounded-lg p-3 border border-surface-200">
                                    <div className="flex items-center gap-2 mb-1.5">
                                        <Wifi size={12} className="text-green-500" />
                                        <span className="font-bold text-navy-900 text-xs">ONLINE</span>
                                    </div>
                                    <p className="text-[11px] text-text-500 leading-relaxed">
                                        Koneksi langsung ke Diamond Center. Masukkan URL server, username & password. License otomatis diterbitkan dan diaktivasi.
                                    </p>
                                </div>
                                <div className="bg-white rounded-lg p-3 border border-surface-200">
                                    <div className="flex items-center gap-2 mb-1.5">
                                        <WifiOff size={12} className="text-amber-500" />
                                        <span className="font-bold text-navy-900 text-xs">OFFLINE</span>
                                    </div>
                                    <p className="text-[11px] text-text-500 leading-relaxed">
                                        Tanpa koneksi internet. Copy fingerprint → kirim ke tim Weldn/Movio → terima license key → paste di sini.
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Contact */}
                        <div className="card p-5 bg-surface-50 space-y-2">
                            <h4 className="font-bold text-navy-900 text-sm flex items-center gap-2">
                                <ShieldCheck size={14} className="text-amber-500" />
                                Bantuan
                            </h4>
                            <ul className="text-xs text-text-500 space-y-1.5">
                                <li>• Hubungi tim <strong>Weldn/Movio</strong> untuk mendapatkan credential</li>
                                <li>• License terikat ke hardware (fingerprint mesin)</li>
                                <li>• Jika ganti server/mesin, license perlu diterbitkan ulang</li>
                                <li>• License yang expired akan mendapat warning 30 hari sebelumnya</li>
                            </ul>
                        </div>
                    </div>
                </div>
            </div>
        </RoleGuard>
    )
}
