'use client'

import { useState, useEffect } from 'react'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { getSubscriptionAction } from '@/lib/actions/admin.actions'
import { RoleGuard } from '@/components/shared/RoleGuard'
import { CreditCard, FileText, Calendar, CheckCircle, AlertTriangle, Download } from 'lucide-react'
import { useTranslation } from '@/hooks/useTranslation'

export default function BillingPage() {
    const { organization } = useCurrentUser()
    const { t } = useTranslation()
    const [data, setData] = useState<any>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        if (organization?.id) {
            getSubscriptionAction(organization.id).then(res => {
                if (res.success) setData(res.data)
                setLoading(false)
            })
        }
    }, [organization?.id])

    const sub = data?.subscription
    const invoices = data?.invoices || []

    return (
        <RoleGuard allowedRoles={['SUPER_ADMIN', 'MAINTAINER']}>
            <div className="space-y-6">
                <div>
                    <h1 className="text-[28px] font-bold font-display text-navy-900 leading-tight">{t('billing.title')}</h1>
                    <p className="text-sm text-text-500 mt-1">{t('billing.subtitle')}</p>
                </div>

                {loading ? (
                    <div className="flex flex-col items-center justify-center py-20">
                        <div className="w-10 h-10 border-4 border-navy-200 border-t-navy-600 rounded-full animate-spin mb-4" />
                        <p className="text-text-500 font-medium">{t('billing.loading')}</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Current Plan */}
                        <div className="lg:col-span-2">
                            <div className="card p-6 space-y-6">
                                <div className="flex items-start justify-between">
                                    <div>
                                        <h2 className="font-bold font-display text-navy-900 text-lg">{t('billing.current_plan')}</h2>
                                        <p className="text-text-500 text-sm mt-1">{t('billing.plan_details')}</p>
                                    </div>
                                    {sub ? (
                                        <span className="badge bg-success-bg text-success"><CheckCircle size={12} /> {t('billing.status_active')}</span>
                                    ) : (
                                        <span className="badge bg-warning-bg text-warning"><AlertTriangle size={12} /> {t('billing.status_no_plan')}</span>
                                    )}
                                </div>

                                {sub ? (
                                    <div className="bg-gradient-to-br from-navy-900 to-navy-700 rounded-xl p-6 text-white">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <p className="text-navy-200 text-sm font-medium">{t('billing.plan_label')}</p>
                                                <h3 className="text-3xl font-black font-display mt-1">{sub.plan_name}</h3>
                                            </div>
                                            <CreditCard size={32} className="text-navy-400" />
                                        </div>
                                        <div className="grid grid-cols-2 gap-4 mt-6">
                                            <div>
                                                <p className="text-navy-200 text-xs">{t('billing.started_at')}</p>
                                                <p className="font-semibold mt-0.5">{new Date(sub.started_at).toLocaleDateString('en-US')}</p>
                                            </div>
                                            <div>
                                                <p className="text-navy-200 text-xs">{t('billing.expires_at')}</p>
                                                <p className="font-semibold mt-0.5">{new Date(sub.expires_at).toLocaleDateString('en-US')}</p>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="bg-surface-50 border border-surface-200 rounded-xl p-8 text-center">
                                        <CreditCard size={40} className="mx-auto text-text-300 mb-3" />
                                        <p className="text-text-500">{t('billing.no_sub_desc')}</p>
                                    </div>
                                )}

                                <button className="btn btn-primary w-full justify-center">
                                    {t('billing.upgrade_btn')}
                                </button>
                            </div>
                        </div>

                        {/* Quick Stats */}
                        <div className="space-y-6">
                            <div className="card p-5">
                                <p className="text-text-500 text-xs font-semibold uppercase tracking-wider">{t('billing.plan_status')}</p>
                                <p className="text-2xl font-black font-display text-navy-900 mt-2">{sub ? t('billing.status_active') : 'Inactive'}</p>
                            </div>
                            <div className="card p-5">
                                <p className="text-text-500 text-xs font-semibold uppercase tracking-wider">{t('billing.invoices_count')}</p>
                                <p className="text-2xl font-black font-display text-navy-900 mt-2">{invoices.length}</p>
                            </div>
                            {sub && (
                                <div className="card p-5">
                                    <p className="text-text-500 text-xs font-semibold uppercase tracking-wider">{t('billing.days_remaining')}</p>
                                    <p className="text-2xl font-black font-display text-navy-900 mt-2">
                                        {Math.max(0, Math.ceil((new Date(sub.expires_at).getTime() - Date.now()) / 86400000))}
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Invoices */}
                {invoices.length > 0 && (
                    <div className="card overflow-hidden">
                        <div className="p-5 border-b border-surface-200 bg-surface-0">
                            <h2 className="font-bold font-display text-navy-900 flex items-center gap-2">
                                <FileText size={18} className="text-navy-600" /> {t('billing.invoice_history')}
                            </h2>
                        </div>
                        <table className="w-full text-left">
                            <thead>
                                <tr className="bg-surface-50 text-text-500 text-sm border-b">
                                    <th className="p-4 font-medium">{t('billing.th_period')}</th>
                                    <th className="p-4 font-medium">{t('billing.th_amount')}</th>
                                    <th className="p-4 font-medium">{t('billing.th_created')}</th>
                                    <th className="p-4 font-medium text-right">{t('common.actions')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {invoices.map((inv: any) => (
                                    <tr key={inv.id} className="border-b last:border-0 hover:bg-surface-50">
                                        <td className="p-4 text-sm text-navy-900 font-medium">
                                            {new Date(inv.period_start).toLocaleDateString('en-US')} – {new Date(inv.period_end).toLocaleDateString('en-US')}
                                        </td>
                                        <td className="p-4 text-sm font-bold text-navy-900">
                                            {inv.currency} {Number(inv.amount).toLocaleString('en-US')}
                                        </td>
                                        <td className="p-4 text-sm text-text-500">
                                            {new Date(inv.created_at).toLocaleDateString('en-US')}
                                        </td>
                                        <td className="p-4 text-right">
                                            {inv.invoice_pdf_path && (
                                                <a
                                                    href={inv.invoice_pdf_path}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-navy-600 hover:text-navy-900 text-sm font-medium flex items-center gap-1 ml-auto"
                                                >
                                                    <Download size={14} /> PDF
                                                </a>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </RoleGuard>
    )
}
