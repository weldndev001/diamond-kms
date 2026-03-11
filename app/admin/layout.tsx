'use client'

import { ReactNode } from 'react'
import { Activity } from 'lucide-react'

export default function AdminLayout({ children }: { children: ReactNode }) {
    return (
        <div className="min-h-screen bg-[#0f1117] text-white">
            {/* Top Header Bar */}
            <header className="h-[56px] bg-[#0f1117] border-b border-white/10 flex items-center justify-between px-6 sticky top-0 z-50 backdrop-blur-xl">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-gradient-to-br from-amber-400 to-amber-600 rounded-lg flex items-center justify-center shadow-lg shadow-amber-500/20">
                        <span className="text-white font-black text-sm">◆</span>
                    </div>
                    <div>
                        <span className="font-display font-extrabold text-[15px] text-white tracking-tight">DIAMOND</span>
                        <span className="text-[10px] text-white/40 font-semibold tracking-widest ml-2 uppercase">Central Monitor</span>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 text-xs text-white/40">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        Live
                    </div>
                </div>
            </header>

            {/* Content */}
            <main className="p-6 md:p-8 max-w-[1400px] mx-auto">
                {children}
            </main>
        </div>
    )
}
