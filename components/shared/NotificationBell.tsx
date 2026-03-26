'use client'

import { useState, useEffect, useRef } from 'react'
import { Bell, Check, Info, AlertTriangle, BookOpen, Key } from 'lucide-react'
import { getUserNotificationsAction, markNotificationAsReadAction, markAllNotificationsAsReadAction } from '@/lib/actions/notification.actions'
import Link from 'next/link'

export function NotificationBell({ userId }: { userId: string }) {
    const [notifications, setNotifications] = useState<any[]>([])
    const [isOpen, setIsOpen] = useState(false)
    const dropdownRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const loadNotifs = async () => {
            const res = await getUserNotificationsAction(userId)
            if (res.success) setNotifications(res.data || [])
        }
        loadNotifs()

        // Simple polling every 30s (consider using websockets/SSE in the future)
        const interval = setInterval(loadNotifs, 30000)
        return () => clearInterval(interval)
    }, [userId])

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setIsOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    const unreadCount = notifications.filter(n => !n.is_read).length

    const handleMarkAsRead = async (id: string, e: React.MouseEvent) => {
        e.preventDefault()
        e.stopPropagation()
        const res = await markNotificationAsReadAction(id)
        if (res.success) {
            setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n))
        }
    }

    const handleMarkAllAsRead = async () => {
        const res = await markAllNotificationsAsReadAction(userId)
        if (res.success) {
            setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
            setIsOpen(false)
        }
    }

    const getIcon = (type: string) => {
        switch (type) {
            case 'CONTENT_APPROVAL': return <Check className="text-blue-500" size={16} />
            case 'MANDATORY_READ': return <BookOpen className="text-red-500" size={16} />
            case 'AI_QUOTA_LOW': return <AlertTriangle className="text-orange-500" size={16} />
            case 'REVISION_SUGGESTION': return <Info className="text-indigo-500" size={16} />
            default: return <Bell className="text-slate-400" size={16} />
        }
    }

    const getLink = (notif: any) => {
        if (notif.reference_type === 'CONTENT') return `/dashboard/contents/${notif.reference_id}`
        if (notif.reference_type === 'QUIZ') return `/dashboard/quizzes/${notif.reference_id}`
        if (notif.reference_type === 'APPROVAL') return `/dashboard/approvals`
        if (notif.reference_type === 'SUGGESTION') return `/dashboard/suggestions`
        return '#'
    }

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="text-text-500 dark:text-text-300 hover:text-navy-600 dark:hover:text-navy-400 relative p-2 rounded-full hover:bg-surface-100 dark:hover:bg-surface-0 transition"
            >
                <Bell size={20} />
                {unreadCount > 0 && (
                    <span className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-4 h-4 text-[10px] font-bold flex items-center justify-center">
                        {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                )}
            </button>

            {isOpen && (
                <div className="absolute top-full right-0 mt-2 w-80 md:w-96 bg-white dark:bg-surface-0 rounded-xl shadow-xl border border-surface-200 dark:border-surface-100 overflow-hidden z-50">
                    <div className="p-4 border-b dark:border-surface-100 bg-surface-50 dark:bg-surface-50 flex justify-between items-center">
                        <h3 className="font-bold text-text-900">Notifications</h3>
                        {unreadCount > 0 && (
                            <button
                                onClick={handleMarkAllAsRead}
                                className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                            >
                                Mark all as read
                            </button>
                        )}
                    </div>

                    <div className="max-h-[400px] overflow-y-auto">
                        {notifications.length === 0 ? (
                            <div className="p-8 text-center text-slate-500 text-sm">
                                You have no notifications.
                            </div>
                        ) : (
                            <ul className="divide-y divide-surface-100 dark:divide-surface-100">
                                {notifications.map(notif => (
                                    <li key={notif.id} className={`hover:bg-surface-50 dark:hover:bg-surface-100 transition ${!notif.is_read ? 'bg-blue-50/30 dark:bg-blue-900/10' : ''}`}>
                                        <Link
                                            href={getLink(notif)}
                                            onClick={() => { if (!notif.is_read) handleMarkAsRead(notif.id, { preventDefault: () => { } } as any) }}
                                            className="p-4 flex gap-3 items-start"
                                        >
                                            <div className={`mt-1 flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${!notif.is_read ? 'bg-white dark:bg-surface-0 shadow-sm' : 'bg-surface-100 dark:bg-surface-100'}`}>
                                                {getIcon(notif.type)}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className={`text-sm ${!notif.is_read ? 'font-bold text-slate-900' : 'font-medium text-slate-700'}`}>
                                                    {notif.title}
                                                </p>
                                                <p className="text-xs text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                                                    {notif.message}
                                                </p>
                                                <p className="text-[10px] font-medium text-slate-400 mt-2">
                                                    {new Date(notif.created_at).toLocaleString()}
                                                </p>
                                            </div>
                                            {!notif.is_read && (
                                                <div className="w-2 h-2 rounded-full bg-blue-500 mt-2 flex-shrink-0"></div>
                                            )}
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>

                    {notifications.length > 0 && (
                        <div className="p-3 border-t text-center bg-slate-50">
                            <span className="text-xs text-slate-500">Only showing the latest 20 notifications.</span>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
