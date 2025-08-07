'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  Menu,
  X,
  Inbox, 
  FileText, 
  BarChart3, 
  Settings,
  Sparkles,
  LogOut
} from 'lucide-react'
import { useMockAuth } from '@/lib/hooks/use-mock-auth'
import { useMockEmails } from '@/lib/hooks/use-mock-emails'

const navigation = [
  { name: 'Inbox', href: '/dashboard', icon: Inbox },
  { name: 'Templates', href: '/dashboard/templates', icon: FileText },
  { name: 'Analytics', href: '/dashboard/analytics', icon: BarChart3 },
  { name: 'Settings', href: '/settings', icon: Settings },
]

export function MobileNav() {
  const [isOpen, setIsOpen] = useState(false)
  const pathname = usePathname()
  const { user, logout } = useMockAuth()
  const { unreadCount } = useMockEmails()

  return (
    <>
      {/* Header */}
      <div className="fixed top-0 left-0 right-0 h-14 bg-background border-b z-50 md:hidden">
        <div className="flex items-center justify-between h-full px-4">
          <Link href="/dashboard" className="flex items-center space-x-2">
            <Sparkles className="h-6 w-6 text-primary" />
            <span className="font-bold">AI Assistant</span>
          </Link>
          
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsOpen(!isOpen)}
          >
            {isOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </div>

      {/* Mobile Menu Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Mobile Menu */}
      <div className={cn(
        "fixed top-14 left-0 bottom-0 w-64 bg-background border-r transform transition-transform duration-300 z-40 md:hidden",
        isOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <nav className="p-4 space-y-1">
          {navigation.map((item) => {
            const isActive = pathname === item.href || 
              (item.href === '/dashboard' && pathname.startsWith('/dashboard/email'))
            
            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={() => setIsOpen(false)}
                className={cn(
                  "flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors",
                  "hover:bg-accent hover:text-accent-foreground",
                  isActive
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground"
                )}
              >
                <item.icon className="h-5 w-5" />
                <span className="ml-3">{item.name}</span>
                {item.name === 'Inbox' && unreadCount > 0 && (
                  <Badge variant="secondary" className="ml-auto">
                    {unreadCount}
                  </Badge>
                )}
              </Link>
            )
          })}
        </nav>

        {/* User Profile */}
        {user && (
          <div className="absolute bottom-0 left-0 right-0 border-t p-4">
            <div className="flex items-center mb-3">
              <img
                src={user.avatar}
                alt={user.name}
                className="h-10 w-10 rounded-full"
              />
              <div className="ml-3">
                <p className="font-medium">{user.name}</p>
                <p className="text-sm text-muted-foreground">{user.email}</p>
              </div>
            </div>
            
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                logout()
                setIsOpen(false)
              }}
            >
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
          </div>
        )}
      </div>
    </>
  )
}