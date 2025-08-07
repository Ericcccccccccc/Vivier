'use client'

import { useState, useEffect } from 'react'
import { Email, ResponseStyle } from '@/lib/api-client'
import { useGenerateResponse } from '@/hooks/useAI'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { 
  Sparkles, 
  RefreshCw, 
  Send, 
  Copy, 
  Check,
  Loader2,
  Edit,
  Save
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

interface ResponseGeneratorProps {
  email: Email
  onSend?: (response: string) => void
}

export function ResponseGenerator({ email, onSend }: ResponseGeneratorProps) {
  const [displayedResponse, setDisplayedResponse] = useState('')
  const [style, setStyle] = useState<ResponseStyle>('professional')
  const [confidence, setConfidence] = useState(0)
  const [copied, setCopied] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editedResponse, setEditedResponse] = useState('')
  
  const generateMutation = useGenerateResponse()

  useEffect(() => {
    if (email.aiResponse) {
      setDisplayedResponse(email.aiResponse.response)
      setConfidence(email.aiResponse.confidence)
      setStyle(email.aiResponse.style || 'professional')
    } else if (generateMutation.data) {
      setDisplayedResponse(generateMutation.data.response)
      setConfidence(generateMutation.data.confidence)
      setStyle(generateMutation.data.style || 'professional')
    }
  }, [email, generateMutation.data])

  const handleGenerate = async () => {
    try {
      const result = await generateMutation.mutateAsync({
        emailId: email.id,
        style,
      })
      
      // Simulate streaming effect for better UX
      const fullResponse = result.response
      let currentIndex = 0
      setDisplayedResponse('')
      
      const streamInterval = setInterval(() => {
        if (currentIndex < fullResponse.length) {
          setDisplayedResponse(fullResponse.slice(0, currentIndex + 10))
          currentIndex += 10
        } else {
          setDisplayedResponse(fullResponse)
          clearInterval(streamInterval)
        }
      }, 30)
    } catch (error) {
      console.error('Failed to generate response:', error)
    }
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(displayedResponse)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleEdit = () => {
    setEditedResponse(displayedResponse)
    setIsEditing(true)
  }

  const handleSave = () => {
    setDisplayedResponse(editedResponse)
    setIsEditing(false)
  }

  const handleCancel = () => {
    setEditedResponse('')
    setIsEditing(false)
  }

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="border-b">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center space-x-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <span>AI Response</span>
          </CardTitle>
          
          <div className="flex items-center space-x-2">
            <Select value={style} onValueChange={(value: any) => setStyle(value)}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="professional">Professional</SelectItem>
                <SelectItem value="casual">Casual</SelectItem>
                <SelectItem value="brief">Brief</SelectItem>
              </SelectContent>
            </Select>
            
            {displayedResponse && !isEditing && (
              <Button variant="outline" size="icon" onClick={handleEdit}>
                <Edit className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="flex-1 flex flex-col p-6">
        {!displayedResponse && !generateMutation.isPending ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="rounded-full bg-muted p-4 mb-4 mx-auto w-fit">
                <Sparkles className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="font-semibold mb-2">Generate AI Response</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Click below to generate a {style} response to this email
              </p>
              <Button 
                onClick={handleGenerate} 
                size="lg"
                disabled={generateMutation.isPending}
              >
                {generateMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Generate Response
                  </>
                )}
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-auto">
              {isEditing ? (
                <textarea
                  value={editedResponse}
                  onChange={(e) => setEditedResponse(e.target.value)}
                  className="w-full h-full p-4 bg-muted rounded-lg border-0 resize-none focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Edit your response..."
                />
              ) : (
                <div className="p-4 bg-muted rounded-lg">
                  <AnimatePresence mode="wait">
                    <motion.p
                      key={displayedResponse}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="whitespace-pre-wrap text-sm"
                    >
                      {displayedResponse}
                      {generateMutation.isPending && <span className="inline-block w-2 h-4 bg-primary animate-pulse ml-1" />}
                    </motion.p>
                  </AnimatePresence>
                </div>
              )}
              
              {confidence > 0 && !isEditing && (
                <div className="mt-4 flex items-center space-x-2">
                  <span className="text-sm text-muted-foreground">Confidence:</span>
                  <div className="flex-1 max-w-xs">
                    <div className="h-2 bg-secondary rounded-full overflow-hidden">
                      <motion.div
                        className="h-full bg-primary"
                        initial={{ width: 0 }}
                        animate={{ width: `${confidence * 100}%` }}
                        transition={{ duration: 0.5, ease: "easeOut" }}
                      />
                    </div>
                  </div>
                  <span className="text-sm font-medium">{Math.round(confidence * 100)}%</span>
                </div>
              )}
            </div>
            
            <div className="flex items-center justify-between mt-4 pt-4 border-t">
              {isEditing ? (
                <div className="flex items-center space-x-2 w-full">
                  <Button onClick={handleSave} className="flex-1">
                    <Save className="h-4 w-4 mr-2" />
                    Save Changes
                  </Button>
                  <Button variant="outline" onClick={handleCancel} className="flex-1">
                    Cancel
                  </Button>
                </div>
              ) : (
                <>
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleCopy}
                      disabled={generateMutation.isPending}
                    >
                      {copied ? (
                        <>
                          <Check className="h-4 w-4 mr-2" />
                          Copied
                        </>
                      ) : (
                        <>
                          <Copy className="h-4 w-4 mr-2" />
                          Copy
                        </>
                      )}
                    </Button>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleGenerate}
                      disabled={generateMutation.isPending}
                    >
                      {generateMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <RefreshCw className="h-4 w-4" />
                      )}
                      <span className="ml-2">Regenerate</span>
                    </Button>
                  </div>
                  
                  <Button 
                    onClick={() => onSend?.(displayedResponse)}
                    disabled={generateMutation.isPending || !displayedResponse}
                  >
                    <Send className="h-4 w-4 mr-2" />
                    Send Response
                  </Button>
                </>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}