'use client'

import { useCurrentUser, UserProvider } from '@/hooks/useCurrentUser'
import { ReactNode, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
    Home, FileText, Tags, Bot, Award, FileQuestion, Users,
    Network, CreditCard, Activity, CheckSquare, ListTodo,
    Shield, FolderTree, Settings, Menu, Sparkles, Wrench,
    ChevronDown, KeyRound, Building
} from 'lucide-react'
import { NotificationBell } from '@/components/shared/NotificationBell'

// Icon mapping function
const getIconForLabel = (label: string) => {
    switch (label) {
        case 'Documents': return <FileText size={16} />
        case 'Knowledge Base': return <Tags size={16} />
        case 'Quizzes': return <FileQuestion size={16} />
        case 'Pemahaman Pegawai': return <Award size={16} />
        case 'FAQs / Help': return <Bot size={16} />
        case 'AI Assistant': return <Sparkles size={16} />
        case 'Maintenance': return <Wrench size={16} />
        case 'Approvals': return <CheckSquare size={16} />
        case 'Read Trackers': return <Activity size={16} />
        case 'Suggestions': return <ListTodo size={16} />
        case 'Users': return <Users size={16} />
        case 'Divisions': return <Network size={16} />
        case 'Billing': return <CreditCard size={16} />
        case 'AI Usage': return <Bot size={16} />
        case 'System Overview': return <Shield size={16} />
        case 'Organizations': return <FolderTree size={16} />
        case 'Feature Flags': return <Settings size={16} />
        case 'AI Providers': return <Bot size={16} />
        case 'AI Management': return <Sparkles size={16} />
        case 'Logs': return <Activity size={16} />
        case 'Monitoring': return <Shield size={16} />
        case 'Dashboard': return <Home size={16} />
        case 'OTP': return <KeyRound size={16} />
        case 'Organization Settings': return <Building size={16} />
        default: return <FileText size={16} />
    }
}

interface NavItem {
    label: string
    href: string
}

interface NavGroup {
    label: string
    icon: string
    children: NavItem[]
}

type NavEntry = NavItem | NavGroup

function isNavGroup(entry: NavEntry): entry is NavGroup {
    return 'children' in entry
}

// Nav structure per role
const getNavEntries = (role?: string): NavEntry[] => {
    const base: NavEntry[] = [
        { label: 'Dashboard', href: '/dashboard' },
        { label: 'Documents', href: '/dashboard/documents' },
        { label: 'Knowledge Base', href: '/dashboard/contents' },
        { label: 'AI Assistant', href: '/dashboard/ai-assistant' },
        { label: 'Quizzes', href: '/dashboard/quizzes' },
        { label: 'Pemahaman Pegawai', href: '/dashboard/leaderboard' },
        { label: 'FAQs / Help', href: '/dashboard/faqs' }
    ]

    if (role === 'SUPER_ADMIN') {
        return [
            ...base,
            { label: 'Approvals', href: '/dashboard/approvals' },
            { label: 'Read Trackers', href: '/dashboard/trackers' },
            { label: 'Suggestions', href: '/dashboard/suggestions' },
            { label: 'Users', href: '/dashboard/hrd/users' },
            { label: 'Divisions', href: '/dashboard/hrd/divisions' },
            {
                label: 'Settings',
                icon: 'Settings',
                children: [
                    { label: 'Billing', href: '/dashboard/hrd/billing' },
                    { label: 'AI Management', href: '/dashboard/hrd/ai' },
                    { label: 'Maintenance', href: '/dashboard/hrd/maintenance' },
                    { label: 'OTP', href: '/dashboard/hrd/otp' },
                    { label: 'Organization Settings', href: '/dashboard/hrd/settings' },
                ],
            },
        ]
    }

    if (role === 'GROUP_ADMIN') {
        return [
            ...base,
            { label: 'Approvals', href: '/dashboard/approvals' },
            { label: 'Read Trackers', href: '/dashboard/trackers' },
            { label: 'Suggestions', href: '/dashboard/suggestions' },
            { label: 'Users', href: '/dashboard/hrd/users' },
        ]
    }

    if (role === 'SUPERVISOR') {
        return [
            ...base,
            { label: 'Read Trackers', href: '/dashboard/trackers' },
            { label: 'Suggestions', href: '/dashboard/suggestions' },
        ]
    }

    if (role === 'MAINTAINER') {
        return [
            { label: 'System Overview', href: '/dashboard/maintainer' },
            { label: 'Organizations', href: '/dashboard/maintainer/organizations' },
            { label: 'AI Providers', href: '/dashboard/maintainer/ai-providers' },
            { label: 'Monitoring', href: '/dashboard/maintainer/monitoring' },
            { label: 'Logs', href: '/dashboard/maintainer/logs' },
        ]
    }

    return base
}

/* ── Accordion sidebar group ── */
function SidebarGroup({ group, pathname }: { group: NavGroup; pathname: string }) {
    const hasActiveChild = group.children.some(c => pathname.startsWith(c.href))
    const [open, setOpen] = useState(hasActiveChild)

    return (
        <div>
            <button
                onClick={() => setOpen(!open)}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-[14px] font-medium transition-colors ${
                    hasActiveChild
                        ? 'bg-navy-600/30 text-white'
                        : 'text-surface-300 hover:text-white hover:bg-white/5'
                }`}
            >
                <span className="flex items-center gap-3">
                    <span className={hasActiveChild ? 'text-navy-400' : 'text-surface-300'}>
                        <Settings size={16} />
                    </span>
                    {group.label}
                </span>
                <ChevronDown
                    size={14}
                    className={`transition-transform duration-200 ${open ? 'rotate-180' : ''} ${hasActiveChild ? 'text-navy-400' : 'text-surface-400'}`}
                />
            </button>

            {/* Sub-items */}
            <div className={`overflow-hidden transition-all duration-200 ${open ? 'max-h-[300px] mt-1' : 'max-h-0'}`}>
                <div className="pl-4 space-y-0.5">
                    {group.children.map(child => {
                        const isActive = pathname.startsWith(child.href)
                        return (
                            <Link
                                key={child.href}
                                href={child.href}
                                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors ${
                                    isActive
                                        ? 'bg-navy-600/20 text-white'
                                        : 'text-surface-400 hover:text-white hover:bg-white/5'
                                }`}
                            >
                                <span className={isActive ? 'text-amber-400' : 'text-surface-400'}>
                                    {getIconForLabel(child.label)}
                                </span>
                                {child.label}
                            </Link>
                        )
                    })}
                </div>
            </div>
        </div>
    )
}

function DashboardLayoutInner({ children }: { children: ReactNode }) {
    const { user, role, organization, isLoading } = useCurrentUser()
    const pathname = usePathname()

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-surface-50">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-navy-200 border-t-navy-600 rounded-full animate-spin"></div>
                    <p className="text-navy-700 font-medium">Loading Dashboard...</p>
                </div>
            </div>
        )
    }

    if (!user) {
        return null
    }

    const navEntries = getNavEntries(role)

    return (
        <div className="flex h-screen bg-surface-50 overflow-hidden">
            {/* Sidebar */}
            <aside className="w-[240px] bg-navy-900 border-r border-white/5 flex flex-col hidden md:flex shrink-0">
                {/* Brand Logo */}
                <div className="p-[24px_20px]">
                    <div className="font-display text-[18px] font-extrabold text-white flex items-center gap-2">
                        <span className="text-amber-400 text-xl leading-none">◆</span> DIAMOND
                    </div>
                    <div className="text-[11px] text-navy-400 mt-1 font-medium tracking-wide">
                        KNOWLEDGE MANAGEMENT
                    </div>
                    {organization?.name && (
                        <div className="text-[11px] text-navy-300 mt-2 font-medium truncate border-t border-white/10 pt-2">
                            {organization.name}
                        </div>
                    )}
                </div>

                {/* Navigation Links */}
                <nav className="flex-1 px-3 py-2 flex flex-col gap-1 overflow-y-auto scrollbar-thin">
                    {navEntries.map((entry, idx) => {
                        if (isNavGroup(entry)) {
                            return <SidebarGroup key={entry.label} group={entry} pathname={pathname} />
                        }
                        const link = entry as NavItem
                        const isActive = link.href === '/dashboard' ? pathname === '/dashboard' : pathname.startsWith(link.href)
                        return (
                            <Link
                                key={link.href}
                                href={link.href}
                                className={`flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-[14px] font-medium transition-colors ${isActive
                                    ? 'bg-navy-600/30 text-white'
                                    : 'text-surface-300 hover:text-white hover:bg-white/5'
                                    }`}
                            >
                                <span className={isActive ? 'text-navy-400' : 'text-surface-300'}>
                                    {getIconForLabel(link.label)}
                                </span>
                                {link.label}
                            </Link>
                        )
                    })}
                </nav>

                {/* Bottom User Area */}
                <div className="mt-auto p-4 border-t border-white/10">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-navy-600 to-navy-400 flex items-center justify-center text-white font-bold font-display text-xs shrink-0 shadow-md">
                            {user.full_name?.substring(0, 2).toUpperCase() || 'U'}
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="text-[13px] font-semibold text-navy-100 truncate">
                                {user.full_name}
                            </div>
                            <div className="text-[11px] text-navy-400 truncate">
                                {role?.replace('_', ' ')}
                            </div>
                        </div>
                    </div>
                </div>
            </aside>

            {/* Main Content */}
            <div className="flex-1 flex flex-col min-w-0">
                {/* Topbar */}
                <header className="h-[60px] bg-surface-0 border-b border-surface-200 flex items-center justify-between px-6 shrink-0 z-10">
                    <div className="flex flex-col">
                        <div className="font-semibold text-navy-900 text-sm">
                            {organization?.name || 'Workspace'}
                        </div>
                    </div>

                    <div className="flex gap-5 items-center">
                        <NotificationBell userId={user.id} />
                        <Link href="/dashboard/profile" className="flex items-center gap-2 text-sm font-medium text-text-700 hover:text-navy-600 transition-colors">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-navy-600 to-navy-400 flex items-center justify-center text-white font-bold font-display text-[10px] shadow-sm">
                                {user.full_name?.substring(0, 2).toUpperCase() || 'U'}
                            </div>
                            <span className="hidden sm:inline-block">{user.full_name?.split(' ')[0]}</span>
                        </Link>
                    </div>
                </header>

                {/* Page Content area */}
                <main className="flex-1 overflow-auto bg-surface-50 p-6 md:p-8">
                    <div className="max-w-6xl mx-auto fade-in">
                        {children}
                    </div>
                </main>
            </div>


        </div>
    )
}

export default function DashboardLayout({ children }: { children: ReactNode }) {
    return (
        <UserProvider>
            <DashboardLayoutInner>{children}</DashboardLayoutInner>
        </UserProvider>
    )
}
