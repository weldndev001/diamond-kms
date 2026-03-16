'use client'

import { useState } from 'react'
import { RoleGuard } from '@/components/shared/RoleGuard'
import { Save, Globe, Image as ImageIcon, Layout, Type } from 'lucide-react'

export default function WebsiteSettingsPage() {
    const [orgName, setOrgName] = useState('WELDN_AI')
    const [appName, setAppName] = useState('DIAMOND KMS')
    const [slogan, setSlogan] = useState('AI Powered Knowledge Management System')
    const [logo, setLogo] = useState('logo_movio.png')
    const [isSaving, setIsSaving] = useState(false)
    const [success, setSuccess] = useState('')

    const handleSave = (e: React.FormEvent) => {
        e.preventDefault()
        setIsSaving(true)
        setSuccess('')
        
        // Dummy delay
        setTimeout(() => {
            setIsSaving(false)
            setSuccess('Konfigurasi website berhasil disimpan!')
        }, 1000)
    }

    return (
        <RoleGuard allowedRoles={['SUPER_ADMIN', 'MAINTAINER']}>
            <div className="space-y-6 max-w-4xl mx-auto">
                <div>
                    <h1 className="text-[28px] font-bold font-display text-navy-900 leading-tight">Website Settings</h1>
                    <p className="text-sm text-text-500 mt-1">Sesuaikan identitas visual dan branding aplikasi Anda.</p>
                </div>

                {success && (
                    <div className="p-4 bg-success-bg text-success rounded-lg border border-green-200 text-sm animate-in fade-in slide-in-from-top-4">
                        {success}
                    </div>
                )}

                <form onSubmit={handleSave} className="space-y-6">
                    <div className="card p-6 space-y-8">
                        {/* Identitas Dasar */}
                        <div className="space-y-4">
                            <h2 className="text-lg font-bold text-navy-900 flex items-center gap-2">
                                <Layout size={20} className="text-navy-500" />
                                Brand Identity
                            </h2>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-text-700 flex items-center gap-2">
                                        Organization Name
                                    </label>
                                    <input 
                                        type="text" 
                                        value={orgName}
                                        onChange={(e) => setOrgName(e.target.value)}
                                        className="input-field"
                                        placeholder="Contoh: WELDN_AI"
                                    />
                                    <p className="text-[11px] text-text-400 font-mono">ID: internal-org-001</p>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-text-700 flex items-center gap-2">
                                        Application Name
                                    </label>
                                    <input 
                                        type="text" 
                                        value={appName}
                                        onChange={(e) => setAppName(e.target.value)}
                                        className="input-field border-navy-200 focus:border-navy-600"
                                        placeholder="Contoh: DIAMOND KMS"
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
                                    placeholder="Kalimat deskripsi singkat aplikasi..."
                                />
                            </div>
                        </div>

                        {/* Visual Branding */}
                        <div className="space-y-4 pt-4 border-t border-surface-100">
                            <h2 className="text-lg font-bold text-navy-900 flex items-center gap-2">
                                <ImageIcon size={20} className="text-navy-500" />
                                Visual Assets
                            </h2>
                            
                            <div className="max-w-xl">
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <label className="text-sm font-semibold text-text-700">Application Logo</label>
                                        <div className="flex items-center gap-4">
                                            <div className="w-20 h-20 rounded-xl bg-surface-50 border border-surface-200 flex items-center justify-center overflow-hidden shrink-0">
                                                {/* Mock Logo Preview */}
                                                <div className="font-display font-black text-navy-600 text-xs text-center px-1">
                                                    {logo}
                                                </div>
                                            </div>
                                            <div className="flex-1">
                                                <button type="button" className="btn bg-white border border-surface-300 text-text-600 w-full text-sm hover:bg-surface-50">
                                                    Ganti Logo
                                                </button>
                                                <p className="text-[10px] text-text-400 mt-2">Format: PNG, SVG, atau WEBP. Rekomendasi 512x512px.</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-end gap-3">
                        <button 
                            type="button" 
                            className="btn bg-white border border-surface-300 text-text-600 px-6"
                            onClick={() => {
                                setAppName('DIAMOND KMS')
                                setSlogan('AI Powered Knowledge Management System')
                                setLogo('logo_movio.png')
                            }}
                        >
                            Reset
                        </button>
                        <button 
                            type="submit" 
                            disabled={isSaving}
                            className="btn btn-primary px-8 flex items-center gap-2 shadow-lg shadow-navy-600/20"
                        >
                            {isSaving ? (
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                <Save size={18} />
                            )}
                            Simpan Perubahan
                        </button>
                    </div>
                </form>
            </div>
        </RoleGuard>
    )
}
