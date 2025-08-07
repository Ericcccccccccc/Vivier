'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  Inbox, 
  FileText, 
  BarChart3, 
  Settings, 
  LogOut,
  Sparkles,
  Plus,
  ChevronLeft,
  ChevronRight
} from 'lucide-react'
import { useState } from 'react'
import { useMockAuth } from '@/lib/hooks/use-mock-auth'
import { useMockEmails } from '@/lib/hooks/use-mock-emails'

const navigation = [
  { name: 'Inbox', href: '/dashboard', icon: Inbox },
  { name: 'Templates', href: '/dashboard/templates', icon: FileText },
  { name: 'Analytics', href: '/dashboard/analytics', icon: BarChart3 },
  { name: 'Settings', href: '/settings', icon: Settings },
]

export function Sidebar() {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)
  const { user, logout } = useMockAuth()
  const { unreadCount } = useMockEmails()

  return (
    <div className={cn(
      "flex flex-col h-full bg-card border-r transition-all duration-300",
      collapsed ? "w-16" : "w-64"
    )}>
      {/* Logo */}
      <div className="p-4 border-b">
        <Link href="/dashboard" className="flex items-center space-x-2">
          <Sparkles className="h-8 w-8 text-primary flex-shrink-0" />
          {!collapsed && <span className="font-bold text-lg">AI Assistant</span>}
        </Link>
      </div>

      {/* New Email Button */}
      <div className="p-4">
        <Button className={cn("w-full", collapsed && "px-2")} size={collapsed ? "icon" : "default"}>
          <Plus className="h-4 w-4" />
          {!collapsed && <span className="ml-2">Compose</span>}
        </Button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 pb-4 space-y-1">
        {navigation.map((item) => {
          const isActive = pathname === item.href || 
            (item.href === '/dashboard' && pathname.startsWith('/dashboard/email'))
          
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "flex items-center px-2 py-2 text-sm font-medium rounded-md transition-colors",
                "hover:bg-accent hover:text-accent-foreground",
                isActive
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground",
                collapsed && "justify-center"
              )}
            >
              <item.icon className="h-5 w-5 flex-shrink-0" />
              {!collapsed && (
                <>
                  <span className="ml-3">{item.name}</span>
                  {item.name === 'Inbox' && unreadCount > 0 && (
                    <Badge variant="secondary" className="ml-auto">
                      {unreadCount}
                    </Badge>
                  )}
                </>
              )}
            </Link>
          )
        })}
      </nav>

      {/* User Profile */}
      <div className="border-t p-4">
        {!collapsed && user && (
          <div className="flex items-center mb-3">
            <img
              src={user.avatar}
              alt={user.name}
              className="h-8 w-8 rounded-full"
            />
            <div className="ml-3 flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user.name}</p>
              <p className="text-xs text-muted-foreground truncate">{user.email}</p>
            </div>
          </div>
        )}
        
        {!collapsed && (
          <div className="mb-3 space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Emails</span>
              <span>{user?.usage.emailsProcessed}/{user?.usage.emailsLimit}</span>
            </div>
            <div className="w-full bg-secondary rounded-full h-2">
              <div 
                className="bg-primary h-2 rounded-full transition-all"
                style={{ width: `${(user?.usage.emailsProcessed || 0) / (user?.usage.emailsLimit || 1) * 100}%` }}
              />
            </div>
          </div>
        )}

        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            size={collapsed ? "icon" : "sm"}
            onClick={logout}
            className={cn("flex-1", collapsed && "w-full")}
          >
            <LogOut className="h-4 w-4" />
            {!collapsed && <span className="ml-2">Logout</span>}
          </Button>
          
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setCollapsed(!collapsed)}
            className="ml-2"
          >
            {collapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}