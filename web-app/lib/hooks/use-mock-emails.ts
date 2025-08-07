'use client'

import { useState, useEffect, useCallback } from 'react'
import { Email, mockEmails } from '@/lib/mock-data'

export function useMockEmails() {
  const [emails, setEmails] = useState<Email[]>(mockEmails)
  const [filter, setFilter] = useState<{
    category?: string
    isRead?: boolean
    hasAttachment?: boolean
    isImportant?: boolean
    search?: string
  }>({})

  const filteredEmails = emails.filter(email => {
    if (filter.category && email.category !== filter.category) return false
    if (filter.isRead !== undefined && email.isRead !== filter.isRead) return false
    if (filter.hasAttachment !== undefined && email.hasAttachment !== filter.hasAttachment) return false
    if (filter.isImportant !== undefined && email.isImportant !== filter.isImportant) return false
    if (filter.search) {
      const searchLower = filter.search.toLowerCase()
      return (
        email.subject.toLowerCase().includes(searchLower) ||
        email.from.toLowerCase().includes(searchLower) ||
        email.body.toLowerCase().includes(searchLower) ||
        email.fromName.toLowerCase().includes(searchLower)
      )
    }
    return true
  })

  const markAsRead = useCallback((id: string) => {
    setEmails(prev => prev.map(email => 
      email.id === id ? { ...email, isRead: true } : email
    ))
  }, [])

  const markAsUnread = useCallback((id: string) => {
    setEmails(prev => prev.map(email => 
      email.id === id ? { ...email, isRead: false } : email
    ))
  }, [])

  const toggleStar = useCallback((id: string) => {
    setEmails(prev => prev.map(email => 
      email.id === id ? { ...email, isStarred: !email.isStarred } : email
    ))
  }, [])

  const deleteEmail = useCallback((id: string) => {
    setEmails(prev => prev.filter(email => email.id !== id))
  }, [])

  const archiveEmail = useCallback((id: string) => {
    setEmails(prev => prev.filter(email => email.id !== id))
  }, [])

  const getEmailById = useCallback((id: string) => {
    return emails.find(email => email.id === id)
  }, [emails])

  const unreadCount = emails.filter(email => !email.isRead).length

  return {
    emails: filteredEmails,
    allEmails: emails,
    filter,
    setFilter,
    markAsRead,
    markAsUnread,
    toggleStar,
    deleteEmail,
    archiveEmail,
    getEmailById,
    unreadCount
  }
}