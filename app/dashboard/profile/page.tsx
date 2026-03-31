'use client'

import { useCurrentUser } from '@/hooks/useCurrentUser'
import { useState } from 'react'
import { signOut } from 'next-auth/react'
import { updatePasswordAction } from '@/lib/actions/auth.actions'
import { LogOut } from 'lucide-react'
import { useTranslation } from '@/hooks/useTranslation'

export default function ProfilePage() {
    const { user, role, organization, isLoading } = useCurrentUser()
    const { t } = useTranslation()
    const [updating, setUpdating] = useState(false)
    const [msg, setMsg] = useState({ type: '', text: '' })

    const [password, setPassword] = useState('')

    const handleLogout = async () => {
        await signOut({ callbackUrl: '/login' })
    }

    const handleUpdatePassword = async (e: React.FormEvent) => {
        e.preventDefault()
        setUpdating(true)
        setMsg({ type: '', text: '' })

        try {
            const res = await updatePasswordAction(password)

            if (!res.success) {
                setMsg({ type: 'error', text: res.error || t('profile.password_update_failed') })
            } else {
                setMsg({ type: 'success', text: t('profile.password_update_success') })
                setPassword('')
            }
        } catch (e: any) {
            setMsg({ type: 'error', text: e.message })
        } finally {
            setUpdating(false)
        }
    }

    if (isLoading) return <div>Loading profile...</div>
    if (!user) return null

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold font-display text-navy-900">{t('profile.title')}</h1>
                <button
                    onClick={handleLogout}
                    className="flex items-center gap-2 text-danger hover:text-red-700 bg-danger-bg hover:bg-danger-bg px-4 py-2 rounded-md font-medium transition"
                >
                    <LogOut size={16} />
                    {t('common.logout')}
                </button>
            </div>

            {msg.text && (
                <div className={`p-4 rounded-md text-sm ${msg.type === 'error' ? 'bg-danger-bg text-red-700' : 'bg-success-bg text-green-700'}`}>
                    {msg.text}
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

                {/* Personal Details Panel */}
                <div className="md:col-span-2 card p-6">
                    <h2 className="text-lg font-semibold text-navy-900 mb-4">{t('profile.personal_details')}</h2>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-text-700 mb-1">{t('profile.full_name')}</label>
                            <input
                                type="text"
                                defaultValue={user.full_name}
                                disabled
                                className="w-full border-surface-200 bg-surface-50 rounded-md shadow-sm py-2 px-3 text-text-500 sm:text-sm"
                            />
                            <p className="mt-1 text-xs text-text-300">{t('profile.name_update_disabled')}</p>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-text-700 mb-1">{t('profile.job_title')}</label>
                            <input
                                type="text"
                                defaultValue={user.job_title || ''}
                                disabled
                                className="w-full border-surface-200 bg-surface-50 rounded-md shadow-sm py-2 px-3 text-text-500 sm:text-sm"
                            />
                        </div>

                        <div className="pt-4 mt-4 border-t border-surface-200">
                            <h3 className="text-sm font-medium text-text-700 mb-1">{t('profile.role_organization')}</h3>
                            <p className="text-text-500 bg-surface-50 p-3 rounded-md text-sm">
                                {t('profile.assigned_as')} <strong className="text-navy-600">{role?.replace('_', ' ')}</strong> {t('profile.at')} <strong>{organization?.name}</strong>.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Change Password Panel */}
                <div className="card p-6">
                    <h2 className="text-lg font-semibold text-navy-900 mb-4">{t('profile.change_password')}</h2>

                    <form onSubmit={handleUpdatePassword} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-text-700 mb-1">{t('profile.new_password')}</label>
                            <input
                                type="password"
                                required
                                minLength={6}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full border border-surface-200 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-navy-600 focus:border-navy-600 sm:text-sm"
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={updating || !password}
                            className="btn btn-primary"
                        >
                            {updating ? t('profile.updating') : t('profile.update_password')}
                        </button>
                    </form>
                </div>

            </div>
        </div>
    )
}
