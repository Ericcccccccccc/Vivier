'use client'

import { Sidebar } from '@/components/layout/sidebar'
import { MobileNav } from '@/components/layout/mobile-nav'
import { ProtectedRoute } from '@/components/protected-route'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ProtectedRoute>
      <div className="flex h-screen bg-background">
        {/* Desktop Sidebar */}
        <aside className="hidden md:flex">
          <Sidebar />
        </aside>
        
        {/* Mobile Navigation */}
        <MobileNav />
        
        {/* Main Content */}
        <main className="flex-1 overflow-auto">
          <div className="h-full pt-14 md:pt-0">
            {children}
          </div>
        </main>
      </div>
    </ProtectedRoute>
  )
}