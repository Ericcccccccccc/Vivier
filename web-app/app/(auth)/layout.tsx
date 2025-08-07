import { Sparkles } from 'lucide-react'
import Link from 'next/link'

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gradient-to-b from-background to-muted/50">
      <Link href="/" className="flex items-center space-x-2 mb-8">
        <Sparkles className="h-10 w-10 text-primary" />
        <span className="text-2xl font-bold">AI Email Assistant</span>
      </Link>
      <div className="w-full max-w-md">
        {children}
      </div>
      <p className="mt-8 text-sm text-muted-foreground text-center">
        By continuing, you agree to our{' '}
        <Link href="#" className="underline hover:text-foreground">
          Terms of Service
        </Link>{' '}
        and{' '}
        <Link href="#" className="underline hover:text-foreground">
          Privacy Policy
        </Link>
      </p>
    </div>
  )
}