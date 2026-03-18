'use client'

import { useState } from 'react'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { RoleGuard } from '@/components/shared/RoleGuard'
import {
    KeyRound, ShieldCheck, Lock, Unlock, CheckCircle, AlertTriangle,
    Package, Sparkles, FileText, Users, Bot, BarChart3, Loader2
} from 'lucide-react'

/* ═══════════════════════════════════════════
   MOCK: Feature packages that can be unlocked
   ═══════════════════════════════════════════ */
interface FeaturePackage {
    id: string
    name: string
    description: string
    icon: React.ReactNode
    unlocked: boolean
    unlockedAt?: string
}

const INITIAL_PACKAGES: FeaturePackage[] = [
    {
        id: 'pkg-documents',
        name: 'Document Management',
        description: 'Upload, analyze, and search documents with AI',
        icon: <FileText size={20} />,
        unlocked: false,
    },
    {
        id: 'pkg-knowledge',
        name: 'Knowledge Base',
        description: 'Create and manage knowledge bases from documents & content',
        icon: <Package size={20} />,
        unlocked: false,
    },
    {
        id: 'pkg-ai-assistant',
        name: 'AI Assistant',
        description: 'AI Chat with RAG for document Q&A',
        icon: <Bot size={20} />,
        unlocked: false,
    },
    {
        id: 'pkg-quiz',
        name: 'Quiz & Leaderboard',
<<<<<<< Updated upstream
        description: 'Automatic quiz creation and employee comprehension tracking',
=======
        description: 'Automated quiz generation and employee understanding tracking',
>>>>>>> Stashed changes
        icon: <BarChart3 size={20} />,
        unlocked: false,
    },
    {
        id: 'pkg-hr',
        name: 'HR Management',
<<<<<<< Updated upstream
        description: 'User, division, and approval workflow management',
=======
        description: 'User management, divisions, and approval workflows',
>>>>>>> Stashed changes
        icon: <Users size={20} />,
        unlocked: false,
    },
    {
        id: 'pkg-advanced-ai',
        name: 'Advanced AI Features',
        description: 'Multi-model support, BYOK, auto-summary, and analytics',
        icon: <Sparkles size={20} />,
        unlocked: false,
    },
]

/* ═══════════════════════════════════════════
   MOCK OTP CODES for demo
   ═══════════════════════════════════════════ */
const VALID_OTPS: Record<string, string[]> = {
    'OTP-DOC-2025': ['pkg-documents'],
    'OTP-KB-2025': ['pkg-knowledge'],
    'OTP-AI-2025': ['pkg-ai-assistant'],
    'OTP-QUIZ-2025': ['pkg-quiz'],
    'OTP-HR-2025': ['pkg-hr'],
    'OTP-ADV-2025': ['pkg-advanced-ai'],
    'OTP-ALL-2025': ['pkg-documents', 'pkg-knowledge', 'pkg-ai-assistant', 'pkg-quiz', 'pkg-hr', 'pkg-advanced-ai'],
}

export default function OTPPage() {
    const { organization } = useCurrentUser()
    const [otpInput, setOtpInput] = useState('')
    const [packages, setPackages] = useState<FeaturePackage[]>(INITIAL_PACKAGES)
    const [status, setStatus] = useState<'idle' | 'verifying' | 'success' | 'error'>('idle')
    const [statusMessage, setStatusMessage] = useState('')
    const [recentlyUnlocked, setRecentlyUnlocked] = useState<string[]>([])

    const unlockedCount = packages.filter(p => p.unlocked).length

    const handleSubmitOTP = async () => {
        const code = otpInput.trim().toUpperCase()
        if (!code) return

        setStatus('verifying')
        setStatusMessage('')
        setRecentlyUnlocked([])

        // Simulate OTP verification delay
        await new Promise(r => setTimeout(r, 1500))

        const unlockPkgIds = VALID_OTPS[code]
        if (!unlockPkgIds) {
            setStatus('error')
            setStatusMessage('Invalid or expired OTP code. Please contact the WELDN_AI team.')
            setTimeout(() => setStatus('idle'), 4000)
            return
        }

        // Check if already all unlocked
        const newUnlocks = unlockPkgIds.filter(id => !packages.find(p => p.id === id)?.unlocked)
        if (newUnlocks.length === 0) {
            setStatus('error')
            setStatusMessage('All features in this package are already unlocked.')
            setTimeout(() => setStatus('idle'), 3000)
            return
        }

        setPackages(prev => prev.map(p =>
            unlockPkgIds.includes(p.id)
                ? { ...p, unlocked: true, unlockedAt: new Date().toLocaleString('en-US') }
                : p
        ))
        setRecentlyUnlocked(newUnlocks)
        setStatus('success')
        setStatusMessage(`${newUnlocks.length} features successfully unlocked!`)
        setOtpInput('')
        setTimeout(() => { setStatus('idle'); setRecentlyUnlocked([]) }, 5000)
    }

    return (
        <RoleGuard allowedRoles={['SUPER_ADMIN']}>
            <div className="space-y-8">
                {/* Header */}
                <div>
                    <h1 className="text-[28px] font-bold font-display text-navy-900 leading-tight flex items-center gap-2">
                        <KeyRound className="text-amber-500" size={28} />
                        Feature Activation (OTP)
                    </h1>
                    <p className="text-sm text-text-500 mt-1">
                        Enter the OTP code from the WELDN_AI team to unlock features according to your package.
                    </p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Left: OTP Input */}
                    <div className="lg:col-span-1 space-y-6">
                        {/* OTP Input Card */}
                        <div className="card p-6 space-y-5">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
                                    <Lock size={18} className="text-amber-600" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-navy-900 text-sm">Enter OTP Code</h3>
                                    <p className="text-[11px] text-text-400">One-time password from WELDN_AI</p>
                                </div>
                            </div>

                            <div>
                                <input
                                    type="text"
                                    value={otpInput}
                                    onChange={e => setOtpInput(e.target.value.toUpperCase())}
                                    onKeyDown={e => { if (e.key === 'Enter') handleSubmitOTP() }}
                                    placeholder="Example: OTP-DOC-2025"
                                    className="w-full px-4 py-3 border-2 rounded-xl text-center text-lg font-mono font-bold tracking-widest focus:ring-amber-500 focus:border-amber-500 uppercase"
                                    disabled={status === 'verifying'}
                                />
                            </div>

                            <button
                                onClick={handleSubmitOTP}
                                disabled={!otpInput.trim() || status === 'verifying'}
                                className="btn btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50"
                            >
                                {status === 'verifying' ? (
                                    <>
                                        <Loader2 size={16} className="animate-spin" />
                                        Verifying...
                                    </>
                                ) : (
                                    <>
                                        <ShieldCheck size={16} />
                                        Verify & Activate
                                    </>
                                )}
                            </button>

                            {/* Status Message */}
                            {statusMessage && (
                                <div className={`p-3 rounded-lg text-sm font-medium flex items-center gap-2 ${
                                    status === 'success'
                                        ? 'bg-green-50 text-green-700 border border-green-200'
                                        : status === 'error'
                                            ? 'bg-red-50 text-red-700 border border-red-200'
                                            : 'bg-surface-50 text-text-500'
                                }`}>
                                    {status === 'success' ? <CheckCircle size={14} /> : <AlertTriangle size={14} />}
                                    {statusMessage}
                                </div>
                            )}
                        </div>

                        {/* Progress */}
                        <div className="card p-5 text-center space-y-3">
                            <p className="text-text-500 text-xs font-semibold uppercase tracking-wider">Unlocked Features</p>
                            <p className="text-4xl font-black font-display text-navy-900">{unlockedCount}</p>
                            <p className="text-xs text-text-400">out of {packages.length} total features</p>
                            <div className="w-full bg-surface-100 rounded-full h-2 overflow-hidden">
                                <div
                                    className="h-2 bg-gradient-to-r from-amber-400 to-amber-600 rounded-full transition-all duration-700"
                                    style={{ width: `${(unlockedCount / packages.length) * 100}%` }}
                                />
                            </div>
                        </div>

                        {/* Info */}
                        <div className="card p-5 bg-navy-50 border-navy-200 space-y-2">
                            <h4 className="font-bold text-navy-900 text-sm flex items-center gap-2">
                                <ShieldCheck size={14} className="text-navy-500" /> Information
                            </h4>
                            <ul className="text-xs text-text-500 space-y-1.5">
                                <li>• OTP codes can only be used once</li>
<<<<<<< Updated upstream
                                <li>• Contact the WELDN_AI team to obtain a code</li>
=======
                                <li>• Contact the WELDN_AI team to get a code</li>
>>>>>>> Stashed changes
                                <li>• Unlocked features are permanent</li>
                                <li>• Full package: use code <code className="bg-white px-1.5 py-0.5 rounded font-mono font-bold text-navy-700">OTP-ALL-2025</code></li>
                            </ul>
                        </div>
                    </div>

                    {/* Right: Packages Grid */}
                    <div className="lg:col-span-2">
                        <h2 className="font-bold text-navy-900 text-lg mb-4 flex items-center gap-2">
                            <Package size={18} className="text-navy-500" />
                            Feature Package List
                        </h2>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {packages.map(pkg => {
                                const justUnlocked = recentlyUnlocked.includes(pkg.id)
                                return (
                                    <div
                                        key={pkg.id}
                                        className={`card p-5 transition-all duration-500 ${
                                            justUnlocked
                                                ? 'border-2 border-green-400 bg-green-50 shadow-lg shadow-green-100 scale-[1.02]'
                                                : pkg.unlocked
                                                    ? 'border-green-200 bg-green-50/30'
                                                    : 'border-surface-200'
                                        }`}
                                    >
                                        <div className="flex items-start justify-between mb-3">
                                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                                                pkg.unlocked
                                                    ? 'bg-green-100 text-green-600'
                                                    : 'bg-surface-100 text-text-400'
                                            }`}>
                                                {pkg.icon}
                                            </div>
                                            <div className={`flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full ${
                                                pkg.unlocked
                                                    ? 'bg-green-100 text-green-700'
                                                    : 'bg-surface-100 text-text-400'
                                            }`}>
                                                {pkg.unlocked ? (
                                                    <><Unlock size={10} /> Active</>
                                                ) : (
                                                    <><Lock size={10} /> Locked</>
                                                )}
                                            </div>
                                        </div>
                                        <h3 className={`font-bold text-sm mb-1 ${pkg.unlocked ? 'text-green-800' : 'text-navy-900'}`}>
                                            {pkg.name}
                                        </h3>
                                        <p className="text-xs text-text-400 mb-2">{pkg.description}</p>
                                        {pkg.unlockedAt && (
                                            <p className="text-[10px] text-green-600 font-medium">
                                                ✓ Unlocked at {pkg.unlockedAt}
                                            </p>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                </div>
            </div>
        </RoleGuard>
    )
}
