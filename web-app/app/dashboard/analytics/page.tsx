'use client'

import { mockAnalytics } from '@/lib/mock-data'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { 
  Mail, 
  Clock, 
  TrendingUp, 
  BarChart3,
  Activity,
  Users,
  Zap,
  Target
} from 'lucide-react'
import { motion } from 'framer-motion'

export default function AnalyticsPage() {
  const stats = [
    {
      title: 'Emails Today',
      value: mockAnalytics.emailsProcessedToday,
      change: '+12%',
      icon: Mail,
      color: 'text-blue-500'
    },
    {
      title: 'This Week',
      value: mockAnalytics.emailsProcessedWeek,
      change: '+8%',
      icon: Activity,
      color: 'text-green-500'
    },
    {
      title: 'This Month',
      value: mockAnalytics.emailsProcessedMonth,
      change: '+23%',
      icon: TrendingUp,
      color: 'text-purple-500'
    },
    {
      title: 'Avg Response Time',
      value: `${mockAnalytics.avgResponseTime}min`,
      change: '-15%',
      icon: Clock,
      color: 'text-orange-500'
    }
  ]

  return (
    <div className="h-full overflow-auto">
      <div className="max-w-7xl mx-auto p-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold mb-1">Analytics Dashboard</h1>
          <p className="text-muted-foreground">
            Track your email productivity and AI assistant performance
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {stats.map((stat, index) => (
            <motion.div
              key={stat.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: index * 0.1 }}
            >
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      {stat.title}
                    </CardTitle>
                    <stat.icon className={`h-4 w-4 ${stat.color}`} />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-baseline justify-between">
                    <div className="text-2xl font-bold">{stat.value}</div>
                    <Badge variant={stat.change.startsWith('+') ? 'success' : 'secondary'}>
                      {stat.change}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Response Time by Hour */}
          <Card>
            <CardHeader>
              <CardTitle>Response Time by Hour</CardTitle>
              <CardDescription>Average response time throughout the day</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {mockAnalytics.responseTimeByHour.map((item) => (
                  <div key={item.hour} className="flex items-center justify-between">
                    <span className="text-sm font-medium w-16">{item.hour}</span>
                    <div className="flex-1 mx-4">
                      <div className="h-6 bg-secondary rounded-full overflow-hidden">
                        <motion.div
                          className="h-full bg-primary"
                          initial={{ width: 0 }}
                          animate={{ width: `${(item.time / 3.5) * 100}%` }}
                          transition={{ duration: 0.5, delay: 0.1 }}
                        />
                      </div>
                    </div>
                    <span className="text-sm text-muted-foreground w-12 text-right">
                      {item.time}m
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Email Categories */}
          <Card>
            <CardHeader>
              <CardTitle>Emails by Category</CardTitle>
              <CardDescription>Distribution of processed emails</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {mockAnalytics.emailsByCategory.map((item, index) => (
                  <div key={item.category} className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <div className={`w-3 h-3 rounded-full bg-primary`} 
                        style={{ opacity: 1 - (index * 0.15) }}
                      />
                      <span className="text-sm font-medium capitalize">{item.category}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="w-32">
                        <div className="h-2 bg-secondary rounded-full overflow-hidden">
                          <motion.div
                            className="h-full bg-primary"
                            initial={{ width: 0 }}
                            animate={{ width: `${(item.count / 200) * 100}%` }}
                            transition={{ duration: 0.5, delay: index * 0.1 }}
                            style={{ opacity: 1 - (index * 0.15) }}
                          />
                        </div>
                      </div>
                      <span className="text-sm text-muted-foreground w-12 text-right">
                        {item.count}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* AI Performance */}
        <Card>
          <CardHeader>
            <CardTitle>AI Assistant Performance</CardTitle>
            <CardDescription>Key metrics for AI-generated responses</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-3">
                  <Target className="h-8 w-8 text-primary" />
                </div>
                <div className="text-2xl font-bold mb-1">
                  {Math.round(mockAnalytics.aiAccuracy * 100)}%
                </div>
                <div className="text-sm text-muted-foreground">Accuracy Rate</div>
              </div>
              
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-500/10 mb-3">
                  <Zap className="h-8 w-8 text-green-500" />
                </div>
                <div className="text-2xl font-bold mb-1">2.3s</div>
                <div className="text-sm text-muted-foreground">Avg Generation Time</div>
              </div>
              
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-purple-500/10 mb-3">
                  <Users className="h-8 w-8 text-purple-500" />
                </div>
                <div className="text-2xl font-bold mb-1">89%</div>
                <div className="text-sm text-muted-foreground">User Satisfaction</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Most Used Templates */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Most Used Templates</CardTitle>
            <CardDescription>Your top performing response templates</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {mockAnalytics.mostUsedTemplates.map((template, index) => (
                <div key={template.name} className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-muted text-sm font-medium">
                      {index + 1}
                    </div>
                    <span className="font-medium">{template.name}</span>
                  </div>
                  <Badge variant="secondary">{template.count} uses</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}