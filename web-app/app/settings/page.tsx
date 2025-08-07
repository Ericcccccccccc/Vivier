'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Switch } from '@/components/ui/switch'
import { 
  User, 
  Moon, 
  Sun, 
  Monitor,
  Save,
  Camera,
  Loader2
} from 'lucide-react'
import { useTheme } from 'next-themes'
import { useAuth } from '@/providers/auth-provider'
import { useSettings, useUpdateSettings } from '@/hooks/useSettings'
import { toast } from 'sonner'

export default function SettingsPage() {
  const { user, updateUser } = useAuth()
  const { theme, setTheme } = useTheme()
  const { data: settings, isLoading: settingsLoading } = useSettings()
  const updateSettings = useUpdateSettings()
  
  const [profileData, setProfileData] = useState({
    name: '',
    email: '',
  })

  const [preferences, setPreferences] = useState({
    notifications: true,
    aiModel: 'groq' as const,
    responseStyle: 'professional' as const,
  })
  
  useEffect(() => {
    if (user) {
      setProfileData({
        name: user.name || '',
        email: user.email || '',
      })
    }
    if (settings) {
      setPreferences({
        notifications: settings.notifications,
        aiModel: settings.aiModel,
        responseStyle: settings.responseStyle,
      })
    }
  }, [user, settings])

  const handleSaveProfile = async () => {
    try {
      await updateUser({ name: profileData.name })
      toast.success('Profile updated successfully')
    } catch (error) {
      toast.error('Failed to update profile')
    }
  }
  
  const handleSavePreferences = async () => {
    try {
      await updateSettings.mutateAsync(preferences)
    } catch (error) {
      console.error('Settings update handled by mutation')
    }
  }

  return (
    <div className="p-6 max-w-4xl">
      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="appearance">Appearance</TabsTrigger>
          <TabsTrigger value="preferences">Preferences</TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Profile Information</CardTitle>
              <CardDescription>
                Update your personal information and profile picture
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Avatar */}
              <div className="flex items-center space-x-4">
                <img
                  src={user?.avatar}
                  alt={user?.name}
                  className="h-20 w-20 rounded-full"
                />
                <Button variant="outline">
                  <Camera className="h-4 w-4 mr-2" />
                  Change Photo
                </Button>
              </div>

              {/* Form Fields */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name</Label>
                  <Input
                    id="name"
                    value={profileData.name}
                    onChange={(e) => setProfileData({ ...profileData, name: e.target.value })}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    value={profileData.email}
                    onChange={(e) => setProfileData({ ...profileData, email: e.target.value })}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="company">Company</Label>
                  <Input
                    id="company"
                    value={profileData.company}
                    onChange={(e) => setProfileData({ ...profileData, company: e.target.value })}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="role">Role</Label>
                  <Input
                    id="role"
                    value={profileData.role}
                    onChange={(e) => setProfileData({ ...profileData, role: e.target.value })}
                  />
                </div>
              </div>

              <Button onClick={handleSave}>
                <Save className="h-4 w-4 mr-2" />
                {saved ? 'Saved!' : 'Save Changes'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="appearance" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Appearance Settings</CardTitle>
              <CardDescription>
                Customize how the application looks
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <Label>Theme</Label>
                <div className="grid grid-cols-3 gap-4">
                  <Button
                    variant={theme === 'light' ? 'default' : 'outline'}
                    onClick={() => setTheme('light')}
                    className="w-full"
                  >
                    <Sun className="h-4 w-4 mr-2" />
                    Light
                  </Button>
                  <Button
                    variant={theme === 'dark' ? 'default' : 'outline'}
                    onClick={() => setTheme('dark')}
                    className="w-full"
                  >
                    <Moon className="h-4 w-4 mr-2" />
                    Dark
                  </Button>
                  <Button
                    variant={theme === 'system' ? 'default' : 'outline'}
                    onClick={() => setTheme('system')}
                    className="w-full"
                  >
                    <Monitor className="h-4 w-4 mr-2" />
                    System
                  </Button>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Compact View</Label>
                    <p className="text-sm text-muted-foreground">
                      Show more emails in less space
                    </p>
                  </div>
                  <Switch
                    checked={preferences.compactView}
                    onCheckedChange={(checked) => 
                      setPreferences({ ...preferences, compactView: checked })
                    }
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Show Email Preview</Label>
                    <p className="text-sm text-muted-foreground">
                      Display email preview in list view
                    </p>
                  </div>
                  <Switch
                    checked={preferences.showPreview}
                    onCheckedChange={(checked) => 
                      setPreferences({ ...preferences, showPreview: checked })
                    }
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="preferences" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Email Preferences</CardTitle>
              <CardDescription>
                Configure how emails are handled
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Auto-mark as Read</Label>
                  <p className="text-sm text-muted-foreground">
                    Automatically mark emails as read when opened
                  </p>
                </div>
                <Switch
                  checked={preferences.autoMarkRead}
                  onCheckedChange={(checked) => 
                    setPreferences({ ...preferences, autoMarkRead: checked })
                  }
                />
              </div>
              
              <div className="flex items-center justify-between">
                <div>
                  <Label>Email Notifications</Label>
                  <p className="text-sm text-muted-foreground">
                    Receive email notifications for new messages
                  </p>
                </div>
                <Switch
                  checked={preferences.emailNotifications}
                  onCheckedChange={(checked) => 
                    setPreferences({ ...preferences, emailNotifications: checked })
                  }
                />
              </div>
              
              <div className="flex items-center justify-between">
                <div>
                  <Label>Desktop Notifications</Label>
                  <p className="text-sm text-muted-foreground">
                    Show desktop notifications for new emails
                  </p>
                </div>
                <Switch
                  checked={preferences.desktopNotifications}
                  onCheckedChange={(checked) => 
                    setPreferences({ ...preferences, desktopNotifications: checked })
                  }
                />
              </div>
              
              <div className="flex items-center justify-between">
                <div>
                  <Label>Sound Alerts</Label>
                  <p className="text-sm text-muted-foreground">
                    Play sound when new email arrives
                  </p>
                </div>
                <Switch
                  checked={preferences.soundAlerts}
                  onCheckedChange={(checked) => 
                    setPreferences({ ...preferences, soundAlerts: checked })
                  }
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}