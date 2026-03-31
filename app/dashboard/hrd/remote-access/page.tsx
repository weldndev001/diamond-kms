'use client'

import { useState, useEffect } from 'react'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { useTranslation } from '@/hooks/useTranslation'
import { RoleGuard } from '@/components/shared/RoleGuard'
import {
    MonitorDot, KeyRound, Clock, Copy, CheckCircle, 
    AlertTriangle, ShieldCheck, RefreshCw, XCircle
} from 'lucide-react'

export default function RemoteAccessPage() {
    const { user } = useCurrentUser()
    const { t } = useTranslation()
    
    // OTP state
    const [remoteOtp, setRemoteOtp] = useState<string | null>(null)
    const [otpExpiry, setOtpExpiry] = useState<number>(0)
    const [otpCopied, setOtpCopied] = useState(false)
    const [isGenerating, setIsGenerating] = useState(false)

    // OTP countdown timer logic
    useEffect(() => {
        if (otpExpiry <= 0) return
        const interval = setInterval(() => {
            setOtpExpiry(prev => {
                if (prev <= 1) { 
                    setRemoteOtp(null)
                    return 0 
                }
                return prev - 1
            })
        }, 1000)
        return () => clearInterval(interval)
    }, [otpExpiry])

    const generateRemoteOtp = async () => {
        setIsGenerating(true)
        // Simulate API/Network delay
        await new Promise(r => setTimeout(r, 800))
        
        const code = Math.random().toString(36).substring(2, 8).toUpperCase()
        setRemoteOtp(code)
        setOtpExpiry(1800) // 30 minutes
        setOtpCopied(false)
        setIsGenerating(false)
    }

    const copyOtp = () => {
        if (remoteOtp) {
            navigator.clipboard.writeText(remoteOtp)
            setOtpCopied(true)
            setTimeout(() => setOtpCopied(false), 2000)
        }
    }

    const formatTime = (s: number) => {
        const mins = Math.floor(s / 60)
        const secs = s % 60
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
    }

    return (
        <RoleGuard allowedRoles={['SUPER_ADMIN']}>
            <div className="space-y-8">
                {/* Header */}
                <div>
                    <h1 className="text-[28px] font-bold font-display text-navy-900 leading-tight flex items-center gap-3">
                        <MonitorDot className="text-amber-500" size={32} />
                        {t('remote_access.title')}
                    </h1>
                    <p className="text-sm text-text-500 mt-2 max-w-2xl">
                        {t('remote_access.subtitle')}
                    </p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Main Action Area */}
                    <div className="lg:col-span-2 space-y-6">
                        <div className="card p-8 border-2 border-surface-200">
                            <div className="flex items-center gap-4 mb-8">
                                <div className="w-12 h-12 bg-navy-100 rounded-2xl flex items-center justify-center text-navy-600">
                                    <KeyRound size={24} />
                                </div>
                                <div>
                                    <h2 className="font-bold text-navy-900 text-lg">{t('remote_access.gen_otp_title')}</h2>
                                    <p className="text-sm text-text-400">{t('remote_access.gen_otp_subtitle')}</p>
                                </div>
                            </div>

                            <div className="bg-surface-50 border-2 border-dashed border-surface-200 rounded-3xl p-8 flex flex-col items-center justify-center text-center">
                                {remoteOtp ? (
                                    <div className="w-full space-y-6 fade-in">
                                        <div className="flex flex-col items-center">
                                            <div className="flex items-center gap-2 mb-2">
                                                <div className={`w-2 h-2 rounded-full animate-pulse ${otpExpiry > 300 ? 'bg-green-500' : 'bg-red-500'}`} />
                                                <span className="text-xs font-bold text-text-400 uppercase tracking-widest">{t('remote_access.otp_active')}</span>
                                            </div>
                                            
                                            <div className="flex items-center gap-4 group">
                                                <div className="bg-white border-2 border-navy-200 rounded-2xl px-10 py-6 shadow-xl shadow-navy-900/5 group-hover:border-amber-400 transition-colors">
                                                    <span className="text-5xl font-black font-mono tracking-[0.2em] text-navy-900 select-all">
                                                        {remoteOtp}
                                                    </span>
                                                </div>
                                                <button
                                                    onClick={copyOtp}
                                                    className={`w-16 h-16 rounded-2xl border-2 transition-all flex items-center justify-center shrink-0 ${
                                                        otpCopied 
                                                            ? 'bg-green-100 border-green-400 text-green-600' 
                                                            : 'bg-white border-surface-200 text-text-400 hover:border-amber-400 hover:text-amber-500'
                                                    }`}
                                                    title={t('remote_access.copy_code')}
                                                >
                                                    {otpCopied ? <CheckCircle size={28} /> : <Copy size={28} />}
                                                </button>
                                            </div>
                                        </div>

                                        <div className="max-w-md mx-auto space-y-3">
                                            <div className="flex items-center justify-between text-xs font-bold px-1">
                                                <span className="text-text-400">{t('remote_access.time_remaining')}</span>
                                                <span className={otpExpiry > 300 ? 'text-green-600' : 'text-red-500'}>
                                                    {formatTime(otpExpiry)}
                                                </span>
                                            </div>
                                            <div className="w-full bg-surface-200 rounded-full h-2.5 overflow-hidden">
                                                <div
                                                    className={`h-full rounded-full transition-all duration-1000 ${
                                                        otpExpiry > 300 ? 'bg-green-500' : 'bg-red-500'
                                                    }`}
                                                    style={{ width: `${(otpExpiry / 1800) * 100}%` }}
                                                />
                                            </div>
                                        </div>

                                        <div className="flex gap-3 justify-center pt-4">
                                            <button
                                                onClick={generateRemoteOtp}
                                                disabled={isGenerating}
                                                className="px-4 py-2 text-sm font-bold text-navy-600 bg-navy-50 hover:bg-navy-100 rounded-xl transition flex items-center gap-2"
                                            >
                                                <RefreshCw size={14} className={isGenerating ? 'animate-spin' : ''} />
                                                {t('remote_access.regenerate')}
                                            </button>
                                            <button
                                                onClick={() => { setRemoteOtp(null); setOtpExpiry(0) }}
                                                className="px-4 py-2 text-sm font-bold text-red-500 bg-red-50 hover:bg-red-100 rounded-xl transition flex items-center gap-2"
                                            >
                                                <XCircle size={14} />
                                                {t('remote_access.cancel_session')}
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="py-10 space-y-6">
                                        <div className="w-20 h-20 bg-amber-50 rounded-full flex items-center justify-center mx-auto">
                                            <ShieldCheck size={40} className="text-amber-500" />
                                        </div>
                                        <div className="space-y-2">
                                            <h3 className="font-bold text-navy-900">{t('remote_access.no_otp_title')}</h3>
                                            <p className="text-sm text-text-400 max-w-xs mx-auto">
                                                {t('remote_access.no_otp_desc')}
                                            </p>
                                        </div>
                                        <button
                                            onClick={generateRemoteOtp}
                                            disabled={isGenerating}
                                            className="btn btn-primary px-8 py-4 text-lg rounded-2xl flex items-center gap-3 mx-auto shadow-lg shadow-amber-500/20"
                                        >
                                            {isGenerating ? (
                                                <RefreshCw size={24} className="animate-spin" />
                                            ) : (
                                                <KeyRound size={24} />
                                            )}
                                            {t('remote_access.gen_otp_btn')}
                                        </button>
                                    </div>
                                )}
                            </div>

                            <div className="mt-8 flex items-start gap-3 p-4 bg-amber-50 border border-amber-100 rounded-2xl">
                                <AlertTriangle size={20} className="text-amber-600 shrink-0 mt-0.5" />
                                <div className="text-xs text-amber-800 leading-relaxed font-medium">
                                    <strong className="block mb-1">{t('remote_access.security_warning_title')}</strong>
                                    {t('remote_access.security_warning_desc')}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Instructions / Sidebar */}
                    <div className="space-y-6">
                        <div className="card p-6 space-y-4">
                            <h3 className="font-bold text-navy-900 flex items-center gap-2 text-sm">
                                <Clock size={16} className="text-navy-500" /> {t('remote_access.history_title')}
                            </h3>
                            <div className="text-xs text-text-500 space-y-3">
                                <div className="flex items-center justify-between py-2 border-b border-surface-100">
                                    <span>{t('remote_access.last_status')}</span>
                                    <span className="font-bold text-green-600">{t('remote_access.cleanup_complete')}</span>
                                </div>
                                <div className="flex items-center justify-between py-2 border-b border-surface-100">
                                    <span>{t('remote_access.requesting_user')}</span>
                                    <span className="font-bold text-navy-700">{user?.full_name?.split(' ')[0]}</span>
                                </div>
                                <div className="flex items-center justify-between py-2">
                                    <span>{t('remote_access.method')}</span>
                                    <span className="font-bold text-navy-700">{t('remote_access.remote_protocol')}</span>
                                </div>
                            </div>
                        </div>

                        <div className="card p-6 bg-navy-900 text-white space-y-4">
                            <h3 className="font-bold flex items-center gap-2 text-sm text-amber-400">
                                <ShieldCheck size={16} /> {t('remote_access.how_to_use')}
                            </h3>
                            <ul className="text-[11px] text-navy-200 space-y-3">
                                <li className="flex gap-3">
                                    <span className="w-5 h-5 rounded-full bg-navy-800 flex items-center justify-center text-[10px] font-bold text-amber-500 shrink-0">1</span>
                                    <span>{t('remote_access.step_1')}</span>
                                </li>
                                <li className="flex gap-3">
                                    <span className="w-5 h-5 rounded-full bg-navy-800 flex items-center justify-center text-[10px] font-bold text-amber-500 shrink-0">2</span>
                                    <span>{t('remote_access.step_2')}</span>
                                </li>
                                <li className="flex gap-3">
                                    <span className="w-5 h-5 rounded-full bg-navy-800 flex items-center justify-center text-[10px] font-bold text-amber-500 shrink-0">3</span>
                                    <span>{t('remote_access.step_3')}</span>
                                </li>
                                <li className="flex gap-3">
                                    <span className="w-5 h-5 rounded-full bg-navy-800 flex items-center justify-center text-[10px] font-bold text-amber-500 shrink-0">4</span>
                                    <span>{t('remote_access.step_4')}</span>
                                </li>
                            </ul>
                        </div>
                    </div>
                </div>
            </div>
        </RoleGuard>
    )
}
