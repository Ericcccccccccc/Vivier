'use client'

import { Email } from '@/lib/api-client'
import { cn, formatRelativeTime } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { 
  Paperclip, 
  Star, 
  StarOff,
  Sparkles,
  Circle,
  CheckCircle,
  AlertCircle
} from 'lucide-react'
import { motion } from 'framer-motion'
import { useMarkAsRead } from '@/hooks/useEmails'
import { Alert, AlertDescription } from '@/components/ui/alert'

interface EmailListProps {
  emails: Email[]
  selectedId?: string | null
  onSelect: (id: string) => void
  onToggleStar?: (id: string) => void
  isLoading?: boolean
  error?: Error | null
}

export function EmailList({ 
  emails, 
  selectedId, 
  onSelect,
  onToggleStar,
  isLoading,
  error
}: EmailListProps) {
  const markAsRead = useMarkAsRead();
  
  if (error) {
    return (
      <div className="p-4">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Failed to load emails. Please try again.
          </AlertDescription>
        </Alert>
      </div>
    )
  }
  
  if (isLoading) {
    return (
      <div className="space-y-2">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="p-4 rounded-lg border">
            <div className="flex items-start justify-between mb-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-16" />
            </div>
            <Skeleton className="h-5 w-full mb-2" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        ))}
      </div>
    )
  }

  if (emails.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="rounded-full bg-muted p-3 mb-4">
          <CheckCircle className="h-6 w-6 text-muted-foreground" />
        </div>
        <h3 className="font-semibold mb-1">No emails</h3>
        <p className="text-sm text-muted-foreground">
          Your inbox is empty
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {emails.map((email, index) => (
        <motion.div
          key={email.id}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: index * 0.05 }}
          className={cn(
            "p-4 rounded-lg border cursor-pointer transition-all",
            "hover:bg-muted/50 hover:shadow-sm",
            selectedId === email.id && "bg-muted border-primary shadow-sm",
            !email.isRead && "bg-background"
          )}
          onClick={() => {
            onSelect(email.id)
            if (!email.isRead) {
              markAsRead.mutate(email.id)
            }
          }}
        >
          <div className="flex items-start justify-between mb-1">
            <div className="flex items-center space-x-2">
              {!email.isRead && (
                <Circle className="h-2 w-2 fill-primary text-primary" />
              )}
              <span className={cn(
                "text-sm",
                !email.isRead && "font-semibold"
              )}>
                {email.from}
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-xs text-muted-foreground">
                {formatRelativeTime(new Date(email.receivedAt))}
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onToggleStar?.(email.id)
                }}
                className="hover:text-yellow-500 transition-colors"
              >
                {email.isStarred ? (
                  <Star className="h-4 w-4 fill-yellow-500 text-yellow-500" />
                ) : (
                  <StarOff className="h-4 w-4 text-muted-foreground" />
                )}
              </button>
            </div>
          </div>
          
          <h3 className={cn(
            "text-sm mb-1 line-clamp-1",
            !email.isRead && "font-semibold"
          )}>
            {email.subject}
          </h3>
          
          <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
            {email.preview}
          </p>
          
          <div className="flex items-center gap-2">
            {email.hasAttachment && (
              <Badge variant="secondary" className="text-xs">
                <Paperclip className="w-3 h-3 mr-1" />
                Attachment
              </Badge>
            )}
            {email.aiResponse && (
              <Badge variant="success" className="text-xs">
                <Sparkles className="w-3 h-3 mr-1" />
                AI Response
              </Badge>
            )}
            {email.isImportant && (
              <Badge variant="destructive" className="text-xs">
                Important
              </Badge>
            )}
            <Badge variant="outline" className="text-xs">
              {email.category}
            </Badge>
          </div>
        </motion.div>
      ))}
    </div>
  )
}