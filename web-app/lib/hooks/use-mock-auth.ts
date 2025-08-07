'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { mockUser, User } from '@/lib/mock-data'

export function useMockAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const storedAuth = localStorage.getItem('mock-auth')
    if (storedAuth) {
      setUser(mockUser)
    }
    setIsLoading(false)
  }, [])

  const login = async (email: string, password: string) => {
    setIsLoading(true)
    
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    // Mock login - any credentials work
    localStorage.setItem('mock-auth', JSON.stringify({ email }))
    setUser(mockUser)
    setIsLoading(false)
    router.push('/dashboard')
    return true
  }

  const signup = async (name: string, email: string, password: string) => {
    setIsLoading(true)
    
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    // Mock signup - any credentials work
    localStorage.setItem('mock-auth', JSON.stringify({ email, name }))
    setUser({ ...mockUser, name, email })
    setIsLoading(false)
    router.push('/dashboard')
    return true
  }

  const logout = () => {
    localStorage.removeItem('mock-auth')
    setUser(null)
    router.push('/')
  }

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    login,
    signup,
    logout
  }
}