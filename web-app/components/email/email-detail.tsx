'use client'

import { Email } from '@/lib/mock-data'
import { formatRelativeTime, formatFileSize } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { 
  Reply, 
  ReplyAll, 
  Forward, 
  Archive, 
  Trash2, 
  Star,
  StarOff,
  Paperclip,
  Download,
  MoreVertical,
  ArrowLeft
} from 'lucide-react'

interface EmailDetailProps {
  email: Email
  onBack?: () => void
  onReply?: () => void
  onToggleStar?: () => void
  onDelete?: () => void
  onArchive?: () => void
}

export function EmailDetail({ 
  email, 
  onBack,
  onReply,
  onToggleStar,
  onDelete,
  onArchive
}: EmailDetailProps) {
  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="border-b p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            {onBack && (
              <Button variant="ghost" size="icon" onClick={onBack}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            <h2 className="text-xl font-semibold line-clamp-1">{email.subject}</h2>
          </div>
          
          <div className="flex items-center space-x-2">
            <Button variant="ghost" size="icon" onClick={onToggleStar}>
              {email.isStarred ? (
                <Star className="h-4 w-4 fill-yellow-500 text-yellow-500" />
              ) : (
                <StarOff className="h-4 w-4" />
              )}
            </Button>
            <Button variant="ghost" size="icon" onClick={onArchive}>
              <Archive className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={onDelete}>
              <Trash2 className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </div>
        </div>
        
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            {email.isImportant && (
              <Badge variant="destructive">Important</Badge>
            )}
            <Badge variant="outline">{email.category}</Badge>
          </div>
          
          <div className="flex items-center space-x-2">
            <Button variant="outline" size="sm" onClick={onReply}>
              <Reply className="h-4 w-4 mr-2" />
              Reply
            </Button>
            <Button variant="outline" size="sm">
              <ReplyAll className="h-4 w-4 mr-2" />
              Reply All
            </Button>
            <Button variant="outline" size="sm">
              <Forward className="h-4 w-4 mr-2" />
              Forward
            </Button>
          </div>
        </div>
      </div>
      
      {/* Email Content */}
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-4xl mx-auto">
          {/* Sender Info */}
          <div className="flex items-start justify-between mb-6">
            <div className="flex items-start space-x-3">
              <img
                src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${email.from}`}
                alt={email.fromName}
                className="h-10 w-10 rounded-full"
              />
              <div>
                <div className="font-medium">{email.fromName}</div>
                <div className="text-sm text-muted-foreground">{email.from}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  to {email.to.join(', ')}
                  {email.cc && email.cc.length > 0 && (
                    <span>, cc: {email.cc.join(', ')}</span>
                  )}
                </div>
              </div>
            </div>
            <div className="text-sm text-muted-foreground">
              {formatRelativeTime(email.received)}
            </div>
          </div>
          
          {/* Email Body */}
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <div className="whitespace-pre-wrap">{email.body}</div>
          </div>
          
          {/* Attachments */}
          {email.hasAttachment && email.attachments && (
            <Card className="mt-6 p-4">
              <h3 className="font-medium mb-3 flex items-center">
                <Paperclip className="h-4 w-4 mr-2" />
                Attachments ({email.attachments.length})
              </h3>
              <div className="space-y-2">
                {email.attachments.map((attachment, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-2 rounded hover:bg-muted transition-colors"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="p-2 bg-muted rounded">
                        <Paperclip className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="text-sm font-medium">{attachment.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {formatFileSize(attachment.size)}
                        </div>
                      </div>
                    </div>
                    <Button variant="ghost" size="icon">
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}