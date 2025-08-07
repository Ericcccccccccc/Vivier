'use client'

import { useState, useEffect } from 'react'
import { EmailList } from '@/components/email/email-list'
import { EmailDetail } from '@/components/email/email-detail'
import { ResponseGenerator } from '@/components/ai/response-generator'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  Search, 
  Filter,
  Inbox as InboxIcon,
  Mail,
  Loader2
} from 'lucide-react'
import { useEmails } from '@/hooks/useEmails'
import { useAuth } from '@/providers/auth-provider'
import { useEmailSubscription } from '@/hooks/useRealtime'
import { cn } from '@/lib/utils'
import { GetEmailsOptions } from '@/lib/api-client'

export default function DashboardPage() {
  const [selectedEmailId, setSelectedEmailId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [filter, setFilter] = useState<GetEmailsOptions>({
    page: 1,
    limit: 20,
    isRead: undefined,
  })
  
  const { user } = useAuth()
  const { data: emailsData, isLoading, error, refetch } = useEmails(filter)
  
  // Set up real-time subscriptions
  useEmailSubscription(user?.id)
  
  const emails = emailsData?.emails || []
  const selectedEmail = emails.find(e => e.id === selectedEmailId) || null
  const unreadCount = emails.filter(e => !e.isRead).length

  const handleEmailSelect = (id: string) => {
    setSelectedEmailId(id)
    // Mark as read will be handled by the EmailList component
  }

  const handleSearch = (query: string) => {
    setSearchQuery(query)
    setFilter({ ...filter, search: query })
  }

  const handleReply = () => {
    // In a real app, this would open the compose window
    console.log('Reply to email')
  }

  const handleSendResponse = (response: string) => {
    // In a real app, this would send the email via API
    console.log('Sending response:', response)
    if (selectedEmailId) {
      // Archive functionality can be added
      setSelectedEmailId(null)
      refetch()
    }
  }

  return (
    <div className="h-full flex">
      {/* Email List Panel */}
      <div className={cn(
        "border-r bg-background",
        selectedEmail ? "hidden lg:flex lg:w-96" : "w-full lg:w-96"
      )}>
        <div className="flex flex-col w-full">
          {/* Search and Filters */}
          <div className="p-4 border-b">
            <div className="flex items-center space-x-2 mb-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Search emails..."
                  value={searchQuery}
                  onChange={(e) => handleSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setShowFilters(!showFilters)}
              >
                <Filter className="h-4 w-4" />
              </Button>
            </div>
            
            {/* Quick Filters */}
            <div className="flex items-center space-x-2 overflow-x-auto">
              <Badge
                variant={filter.isRead === undefined ? "default" : "outline"}
                className="cursor-pointer whitespace-nowrap"
                onClick={() => setFilter({ ...filter, isRead: undefined })}
              >
                All
              </Badge>
              <Badge
                variant={filter.isRead === false ? "default" : "outline"}
                className="cursor-pointer whitespace-nowrap"
                onClick={() => setFilter({ ...filter, isRead: false })}
              >
                Unread ({unreadCount})
              </Badge>
              <Badge
                variant={filter.isImportant ? "default" : "outline"}
                className="cursor-pointer whitespace-nowrap"
                onClick={() => setFilter({ ...filter, isImportant: !filter.isImportant })}
              >
                Important
              </Badge>
              <Badge
                variant={filter.hasAttachment ? "default" : "outline"}
                className="cursor-pointer whitespace-nowrap"
                onClick={() => setFilter({ ...filter, hasAttachment: !filter.hasAttachment })}
              >
                Has Attachment
              </Badge>
            </div>
          </div>
          
          {/* Email List */}
          <div className="flex-1 overflow-auto p-4">
            <EmailList
              emails={emails}
              selectedId={selectedEmailId}
              onSelect={handleEmailSelect}
              isLoading={isLoading}
              error={error}
            />
          </div>
        </div>
      </div>

      {/* Email Detail and AI Response Panel */}
      {selectedEmail ? (
        <div className="flex-1 flex flex-col lg:flex-row">
          {/* Email Detail */}
          <div className="flex-1 border-r">
            <EmailDetail
              email={selectedEmail}
              onBack={() => setSelectedEmailId(null)}
              onReply={handleReply}
              onDelete={() => {
                // Delete functionality to be implemented with API
                setSelectedEmailId(null)
              }}
              onArchive={() => {
                // Archive functionality to be implemented with API
                setSelectedEmailId(null)
              }}
            />
          </div>
          
          {/* AI Response Generator */}
          <div className="w-full lg:w-96 xl:w-[450px] border-t lg:border-t-0">
            <ResponseGenerator
              email={selectedEmail}
              onSend={handleSendResponse}
            />
          </div>
        </div>
      ) : (
        <div className="hidden lg:flex flex-1 items-center justify-center text-center p-8">
          <div>
            <div className="rounded-full bg-muted p-4 mb-4 mx-auto w-fit">
              <Mail className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Select an email</h3>
            <p className="text-sm text-muted-foreground max-w-sm">
              Choose an email from the list to view its contents and generate AI responses
            </p>
          </div>
        </div>
      )}
    </div>
  )
}