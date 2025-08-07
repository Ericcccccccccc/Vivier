export interface User {
  id: string
  email: string
  name: string
  avatar: string
  subscription: 'free' | 'pro' | 'enterprise'
  usage: {
    emailsProcessed: number
    emailsLimit: number
    aiResponses: number
    aiLimit: number
  }
}

export interface Email {
  id: string
  subject: string
  from: string
  fromName: string
  to: string[]
  cc?: string[]
  preview: string
  body: string
  received: Date
  hasAttachment: boolean
  attachments?: Array<{ name: string; size: number; type: string }>
  isRead: boolean
  isImportant: boolean
  isStarred: boolean
  category: 'work' | 'personal' | 'marketing' | 'social' | 'updates'
  aiResponse?: {
    text: string
    confidence: number
    generatedAt: Date
    status: 'draft' | 'sent' | 'edited'
    style?: 'formal' | 'casual' | 'brief'
  }
}

export interface Template {
  id: string
  name: string
  description: string
  content: string
  variables: string[]
  category: 'meeting' | 'followup' | 'rejection' | 'inquiry' | 'general'
  usageCount: number
  lastUsed?: Date
  isDefault?: boolean
}

export const mockUser: User = {
  id: '1',
  email: 'john.doe@company.com',
  name: 'John Doe',
  avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=John',
  subscription: 'pro',
  usage: {
    emailsProcessed: 47,
    emailsLimit: 500,
    aiResponses: 23,
    aiLimit: 200,
  }
}

export const mockEmails: Email[] = [
  {
    id: '1',
    subject: 'Q4 Budget Review Meeting',
    from: 'sarah.miller@company.com',
    fromName: 'Sarah Miller',
    to: ['john.doe@company.com'],
    cc: ['team@company.com'],
    preview: 'Hi John, I wanted to schedule a meeting to review our Q4 budget projections and discuss the upcoming fiscal year planning...',
    body: `Hi John,

I wanted to schedule a meeting to review our Q4 budget projections and discuss the upcoming fiscal year planning. We have several important items to cover:

1. Current quarter performance vs. projections
2. Resource allocation for next quarter
3. Capital expenditure requests
4. Team expansion plans

Could you please review the attached financial reports before our meeting? I've included the latest P&L statements and forecast models.

I'm available this Thursday or Friday afternoon. Please let me know what works best for your schedule.

Best regards,
Sarah Miller
Finance Director`,
    received: new Date(Date.now() - 2 * 60 * 60 * 1000),
    hasAttachment: true,
    attachments: [
      { name: 'Q4_Budget_Report.pdf', size: 2457600, type: 'application/pdf' },
      { name: 'Financial_Forecast.xlsx', size: 1048576, type: 'application/vnd.ms-excel' }
    ],
    isRead: false,
    isImportant: true,
    isStarred: true,
    category: 'work',
    aiResponse: {
      text: `Hi Sarah,

Thank you for reaching out about the Q4 budget review. I'd be happy to meet to discuss these important items.

Thursday afternoon works well for me. How about 2:00 PM? That would give me time to thoroughly review the attached reports beforehand.

I'll make sure to pay special attention to the resource allocation and team expansion plans, as these will be critical for our next quarter's success.

Looking forward to our discussion.

Best regards,
John`,
      confidence: 0.92,
      generatedAt: new Date(Date.now() - 1 * 60 * 60 * 1000),
      status: 'draft',
      style: 'formal'
    }
  },
  {
    id: '2',
    subject: 'New Product Launch Strategy',
    from: 'mike.chen@marketing.com',
    fromName: 'Mike Chen',
    to: ['john.doe@company.com'],
    preview: 'Hey John! Exciting news about our upcoming product launch. We need to finalize the marketing strategy...',
    body: `Hey John!

Exciting news about our upcoming product launch. We need to finalize the marketing strategy for Q1 2024. 

Key points to discuss:
- Target audience segmentation
- Digital marketing channels
- Budget allocation
- Timeline and milestones
- KPIs and success metrics

Can we schedule a brainstorming session this week? I have some innovative ideas I'd love to share with you.

Cheers,
Mike`,
    received: new Date(Date.now() - 4 * 60 * 60 * 1000),
    hasAttachment: false,
    isRead: true,
    isImportant: false,
    isStarred: false,
    category: 'work',
  },
  {
    id: '3',
    subject: 'Team Building Event Next Friday',
    from: 'hr@company.com',
    fromName: 'HR Department',
    to: ['all-staff@company.com'],
    preview: 'Dear Team, We are excited to announce our upcoming team building event scheduled for next Friday...',
    body: `Dear Team,

We are excited to announce our upcoming team building event scheduled for next Friday, January 26th!

Event Details:
- Date: Friday, January 26th
- Time: 2:00 PM - 6:00 PM
- Location: Riverside Park Recreation Center
- Activities: Team challenges, outdoor games, BBQ dinner

Please RSVP by Wednesday so we can finalize the headcount for catering.

Looking forward to seeing everyone there!

Best,
HR Team`,
    received: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
    hasAttachment: false,
    isRead: true,
    isImportant: false,
    isStarred: false,
    category: 'social',
  },
  {
    id: '4',
    subject: 'Client Feedback on Prototype',
    from: 'alex.johnson@clientcorp.com',
    fromName: 'Alex Johnson',
    to: ['john.doe@company.com'],
    preview: 'Hi John, We've completed our review of the prototype you sent last week. Overall, we're impressed...',
    body: `Hi John,

We've completed our review of the prototype you sent last week. Overall, we're impressed with the progress, but we have some feedback:

Positive Points:
- Excellent user interface design
- Smooth performance
- Intuitive navigation

Areas for Improvement:
- Need additional features in the dashboard
- Some minor bugs in the reporting module
- Would like to see more customization options

Could we schedule a call to discuss these points in detail? We're eager to move forward with the next phase.

Best regards,
Alex Johnson
Product Manager, ClientCorp`,
    received: new Date(Date.now() - 3 * 60 * 60 * 1000),
    hasAttachment: false,
    isRead: false,
    isImportant: true,
    isStarred: false,
    category: 'work',
    aiResponse: {
      text: `Hi Alex,

Thank you for the thorough review and valuable feedback on our prototype. I'm glad to hear you're impressed with the overall progress.

I appreciate you highlighting both the strengths and areas for improvement. Your feedback on the dashboard features and customization options is particularly helpful.

I'm available for a call tomorrow afternoon or Thursday morning to discuss your feedback in detail. We can go through each point and create an action plan for the improvements.

I'll also have our development team look into the reporting module bugs immediately.

Looking forward to our discussion.

Best regards,
John`,
      confidence: 0.88,
      generatedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
      status: 'draft',
      style: 'formal'
    }
  },
  {
    id: '5',
    subject: 'Quick question about the API documentation',
    from: 'developer@techteam.com',
    fromName: 'David Kim',
    to: ['john.doe@company.com'],
    preview: 'Hey John, quick question - where can I find the latest API documentation for the authentication endpoints?',
    body: `Hey John,

Quick question - where can I find the latest API documentation for the authentication endpoints? I'm working on the integration and need to verify some parameters.

Also, is there a Postman collection available for testing?

Thanks!
David`,
    received: new Date(Date.now() - 30 * 60 * 1000),
    hasAttachment: false,
    isRead: false,
    isImportant: false,
    isStarred: false,
    category: 'work',
  },
  {
    id: '6',
    subject: 'Your Monthly Newsletter',
    from: 'newsletter@techdigest.com',
    fromName: 'Tech Digest',
    to: ['john.doe@company.com'],
    preview: 'Top tech trends this month: AI advancements, Cloud Computing updates, and Cybersecurity insights...',
    body: `Top tech trends this month:

1. AI Advancements
   - New LLM models breaking records
   - AI in healthcare showing promising results

2. Cloud Computing
   - Major providers announce new services
   - Cost optimization strategies

3. Cybersecurity
   - Latest threat reports
   - Best practices for 2024

Read more on our website!`,
    received: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    hasAttachment: false,
    isRead: true,
    isImportant: false,
    isStarred: false,
    category: 'marketing',
  },
  {
    id: '7',
    subject: 'Performance Review Schedule',
    from: 'manager@company.com',
    fromName: 'Lisa Thompson',
    to: ['john.doe@company.com'],
    preview: 'Hi John, It's time for our quarterly performance reviews. I'd like to schedule your review for next week...',
    body: `Hi John,

It's time for our quarterly performance reviews. I'd like to schedule your review for next week.

Please come prepared to discuss:
- Your achievements this quarter
- Challenges you've faced
- Goals for next quarter
- Any support you need from the team

Available slots:
- Tuesday 10:00 AM
- Wednesday 2:00 PM
- Thursday 3:00 PM

Let me know which works best for you.

Best,
Lisa`,
    received: new Date(Date.now() - 5 * 60 * 60 * 1000),
    hasAttachment: false,
    isRead: false,
    isImportant: true,
    isStarred: true,
    category: 'work',
  },
  {
    id: '8',
    subject: 'Re: Project Timeline Update',
    from: 'pm@company.com',
    fromName: 'Robert Brown',
    to: ['john.doe@company.com'],
    preview: 'Thanks for the update, John. The revised timeline looks good. One question about the testing phase...',
    body: `Thanks for the update, John. 

The revised timeline looks good. One question about the testing phase - do we have enough buffer time for potential bug fixes?

Also, please make sure to update the project board with these new dates.

Robert`,
    received: new Date(Date.now() - 6 * 60 * 60 * 1000),
    hasAttachment: false,
    isRead: true,
    isImportant: false,
    isStarred: false,
    category: 'work',
  },
  {
    id: '9',
    subject: 'LinkedIn Connection Request',
    from: 'noreply@linkedin.com',
    fromName: 'LinkedIn',
    to: ['john.doe@company.com'],
    preview: 'You have a new connection request from Emma Watson, Senior Developer at TechCorp...',
    body: `You have a new connection request from Emma Watson, Senior Developer at TechCorp.

Emma says: "Hi John, I enjoyed your recent article on microservices architecture. Would love to connect!"

Accept or View Profile on LinkedIn`,
    received: new Date(Date.now() - 8 * 60 * 60 * 1000),
    hasAttachment: false,
    isRead: true,
    isImportant: false,
    isStarred: false,
    category: 'social',
  },
  {
    id: '10',
    subject: 'Security Alert: New Sign-in',
    from: 'security@company.com',
    fromName: 'Security Team',
    to: ['john.doe@company.com'],
    preview: 'A new sign-in to your account was detected from Chrome on Windows...',
    body: `A new sign-in to your account was detected:

Device: Chrome on Windows
Location: New York, NY
Time: Today at 9:15 AM

If this was you, no action is needed. If not, please reset your password immediately.

Stay secure,
Security Team`,
    received: new Date(Date.now() - 10 * 60 * 60 * 1000),
    hasAttachment: false,
    isRead: false,
    isImportant: true,
    isStarred: false,
    category: 'updates',
  },
  {
    id: '11',
    subject: 'Invitation: Design Review Meeting',
    from: 'designer@company.com',
    fromName: 'Emma Wilson',
    to: ['john.doe@company.com'],
    preview: 'You're invited to the design review meeting for the new dashboard features...',
    body: `Hi John,

You're invited to the design review meeting for the new dashboard features.

When: Tomorrow, 11:00 AM - 12:00 PM
Where: Conference Room B / Zoom Link
Agenda: Review mockups, discuss user feedback, finalize design decisions

Please review the attached mockups before the meeting.

Thanks,
Emma`,
    received: new Date(Date.now() - 12 * 60 * 60 * 1000),
    hasAttachment: true,
    attachments: [
      { name: 'Dashboard_Mockups_v2.fig', size: 5242880, type: 'application/figma' }
    ],
    isRead: false,
    isImportant: false,
    isStarred: false,
    category: 'work',
  },
  {
    id: '12',
    subject: 'Expense Report Approval Needed',
    from: 'finance@company.com',
    fromName: 'Finance Team',
    to: ['john.doe@company.com'],
    preview: 'Your expense report for December requires approval. Total amount: $1,234.56...',
    body: `Your expense report for December requires approval.

Total amount: $1,234.56

Items:
- Client dinner: $456.78
- Travel expenses: $567.89
- Software subscription: $209.89

Please review and approve by end of week.

Finance Team`,
    received: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
    hasAttachment: true,
    attachments: [
      { name: 'Expense_Report_Dec.pdf', size: 1048576, type: 'application/pdf' }
    ],
    isRead: false,
    isImportant: true,
    isStarred: false,
    category: 'work',
  },
  {
    id: '13',
    subject: 'Happy Birthday from the Team!',
    from: 'team@company.com',
    fromName: 'Your Team',
    to: ['john.doe@company.com'],
    preview: 'Happy Birthday John! Wishing you a fantastic day filled with joy and celebration...',
    body: `Happy Birthday John!

Wishing you a fantastic day filled with joy and celebration!

We've organized a small celebration in the break room at 3 PM today. Hope you can join us for cake and refreshments!

Best wishes,
Your Team`,
    received: new Date(Date.now() - 14 * 60 * 60 * 1000),
    hasAttachment: false,
    isRead: true,
    isImportant: false,
    isStarred: true,
    category: 'personal',
  },
  {
    id: '14',
    subject: 'System Maintenance Notice',
    from: 'it@company.com',
    fromName: 'IT Support',
    to: ['all-staff@company.com'],
    preview: 'Scheduled maintenance this Saturday from 2 AM to 6 AM. Services may be temporarily unavailable...',
    body: `Dear All,

We will be performing scheduled maintenance this Saturday from 2 AM to 6 AM EST.

Affected services:
- Email system
- Internal dashboard
- File servers

Please save your work before the maintenance window. We apologize for any inconvenience.

IT Support Team`,
    received: new Date(Date.now() - 16 * 60 * 60 * 1000),
    hasAttachment: false,
    isRead: true,
    isImportant: false,
    isStarred: false,
    category: 'updates',
  },
  {
    id: '15',
    subject: 'Customer Complaint - Urgent',
    from: 'support@company.com',
    fromName: 'Support Team',
    to: ['john.doe@company.com'],
    preview: 'We received a high-priority complaint from BigCorp about service downtime. Need immediate attention...',
    body: `Hi John,

We received a high-priority complaint from BigCorp about service downtime yesterday.

Issue: API endpoints were unavailable for 2 hours
Impact: Their production systems were affected
Customer: Very frustrated, considering alternatives

We need to:
1. Investigate root cause
2. Provide detailed report
3. Offer compensation/resolution

Please treat this as highest priority.

Support Team`,
    received: new Date(Date.now() - 45 * 60 * 1000),
    hasAttachment: false,
    isRead: false,
    isImportant: true,
    isStarred: true,
    category: 'work',
    aiResponse: {
      text: `Hi Support Team,

Thank you for bringing this urgent matter to my attention. I understand the severity of the situation with BigCorp.

I'll take immediate action:

1. I'll initiate a root cause analysis with the engineering team right away
2. I'll prepare a detailed incident report within the next 2 hours
3. I'll personally reach out to BigCorp's account manager to discuss resolution options

I'll also schedule an emergency meeting with the infrastructure team to ensure this doesn't happen again.

I'll keep you updated on progress every hour.

John`,
      confidence: 0.95,
      generatedAt: new Date(Date.now() - 30 * 60 * 1000),
      status: 'sent',
      style: 'formal'
    }
  }
]

export const mockTemplates: Template[] = [
  {
    id: '1',
    name: 'Professional Meeting Response',
    description: 'Formal response for meeting requests',
    content: `Thank you for reaching out about {topic}.

I would be happy to discuss this further. {day} at {time} works well for me.

Please let me know if this time suits your schedule, or feel free to suggest an alternative.

Looking forward to our discussion.

Best regards,
{sender_name}`,
    variables: ['topic', 'day', 'time', 'sender_name'],
    category: 'meeting',
    usageCount: 45,
    lastUsed: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    isDefault: true
  },
  {
    id: '2',
    name: 'Follow-up After Meeting',
    description: 'Template for following up after meetings',
    content: `Thank you for taking the time to meet with me today to discuss {topic}.

As discussed, the next steps are:
{action_items}

I'll {commitment} by {deadline}.

Please don't hesitate to reach out if you have any questions or need clarification on anything we discussed.

Best regards,
{sender_name}`,
    variables: ['topic', 'action_items', 'commitment', 'deadline', 'sender_name'],
    category: 'followup',
    usageCount: 32,
    lastUsed: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000)
  },
  {
    id: '3',
    name: 'Polite Rejection',
    description: 'Professionally decline requests or proposals',
    content: `Thank you for considering me for {opportunity}.

After careful consideration, I won't be able to {action} at this time due to {reason}.

I appreciate your understanding and hope we can explore opportunities to collaborate in the future.

Best wishes,
{sender_name}`,
    variables: ['opportunity', 'action', 'reason', 'sender_name'],
    category: 'rejection',
    usageCount: 18,
    lastUsed: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000)
  },
  {
    id: '4',
    name: 'Information Request',
    description: 'Request additional information or clarification',
    content: `Thank you for your email regarding {topic}.

To better assist you, could you please provide:
{information_needed}

Once I have this information, I'll be able to {action}.

Thank you for your patience.

Best regards,
{sender_name}`,
    variables: ['topic', 'information_needed', 'action', 'sender_name'],
    category: 'inquiry',
    usageCount: 27,
    lastUsed: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)
  },
  {
    id: '5',
    name: 'Project Update',
    description: 'Provide status updates on ongoing projects',
    content: `Hi {recipient_name},

I wanted to provide you with an update on {project_name}:

Current Status: {status}
Progress: {progress_percentage}% complete
Recent Achievements:
{achievements}

Next Steps:
{next_steps}

Expected Completion: {deadline}

Please let me know if you have any questions or concerns.

Best regards,
{sender_name}`,
    variables: ['recipient_name', 'project_name', 'status', 'progress_percentage', 'achievements', 'next_steps', 'deadline', 'sender_name'],
    category: 'general',
    usageCount: 41,
    lastUsed: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
    isDefault: true
  },
  {
    id: '6',
    name: 'Quick Acknowledgment',
    description: 'Brief acknowledgment of received emails',
    content: `Hi {recipient_name},

Thank you for your email. I've received your message about {topic} and will {action}.

I'll get back to you by {timeframe}.

Best,
{sender_name}`,
    variables: ['recipient_name', 'topic', 'action', 'timeframe', 'sender_name'],
    category: 'general',
    usageCount: 67,
    lastUsed: new Date(Date.now() - 6 * 60 * 60 * 1000)
  },
  {
    id: '7',
    name: 'Deadline Extension Request',
    description: 'Request more time for deliverables',
    content: `Hi {recipient_name},

I'm writing to request an extension for {deliverable}.

Due to {reason}, I need additional time to ensure quality delivery. 

Would it be possible to extend the deadline to {new_deadline}? This will allow me to {benefit}.

I apologize for any inconvenience and appreciate your understanding.

Best regards,
{sender_name}`,
    variables: ['recipient_name', 'deliverable', 'reason', 'new_deadline', 'benefit', 'sender_name'],
    category: 'general',
    usageCount: 12,
    lastUsed: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000)
  },
  {
    id: '8',
    name: 'Thank You Note',
    description: 'Express gratitude for help or opportunities',
    content: `Dear {recipient_name},

I wanted to take a moment to thank you for {reason}.

Your {quality} has been invaluable, and I truly appreciate {specific_impact}.

{additional_comment}

Thank you again for your {attribute}.

Warm regards,
{sender_name}`,
    variables: ['recipient_name', 'reason', 'quality', 'specific_impact', 'additional_comment', 'attribute', 'sender_name'],
    category: 'general',
    usageCount: 23,
    lastUsed: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  },
  {
    id: '9',
    name: 'Introduction Email',
    description: 'Introduce yourself or make connections',
    content: `Hi {recipient_name},

{introduction_context}

My name is {sender_name}, and I'm {role} at {company}. 

{reason_for_contact}

I'd love to {proposed_action}. Would you be available for {meeting_type} {timeframe}?

Looking forward to connecting!

Best regards,
{sender_name}`,
    variables: ['recipient_name', 'introduction_context', 'sender_name', 'role', 'company', 'reason_for_contact', 'proposed_action', 'meeting_type', 'timeframe'],
    category: 'general',
    usageCount: 15,
    lastUsed: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000)
  },
  {
    id: '10',
    name: 'Issue Escalation',
    description: 'Escalate problems that need urgent attention',
    content: `Hi {recipient_name},

I need to escalate an issue that requires immediate attention:

Issue: {issue_description}
Impact: {impact_description}
Affected: {affected_parties}
Priority: {priority_level}

Attempted Solutions:
{attempted_solutions}

Recommended Action:
{recommended_action}

Please advise on next steps.

Regards,
{sender_name}`,
    variables: ['recipient_name', 'issue_description', 'impact_description', 'affected_parties', 'priority_level', 'attempted_solutions', 'recommended_action', 'sender_name'],
    category: 'general',
    usageCount: 8,
    lastUsed: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  }
]

export const mockAnalytics = {
  emailsProcessedToday: 12,
  emailsProcessedWeek: 47,
  emailsProcessedMonth: 189,
  avgResponseTime: 2.3,
  aiAccuracy: 0.91,
  mostUsedTemplates: [
    { name: 'Quick Acknowledgment', count: 67 },
    { name: 'Professional Meeting Response', count: 45 },
    { name: 'Project Update', count: 41 }
  ],
  emailsByCategory: [
    { category: 'work', count: 145 },
    { category: 'personal', count: 23 },
    { category: 'marketing', count: 67 },
    { category: 'social', count: 34 },
    { category: 'updates', count: 21 }
  ],
  responseTimeByHour: [
    { hour: '9 AM', time: 1.8 },
    { hour: '10 AM', time: 2.1 },
    { hour: '11 AM', time: 2.5 },
    { hour: '12 PM', time: 3.2 },
    { hour: '1 PM', time: 2.9 },
    { hour: '2 PM', time: 2.3 },
    { hour: '3 PM', time: 2.0 },
    { hour: '4 PM', time: 1.9 },
    { hour: '5 PM', time: 2.4 }
  ]
}

export function getMockResponse(email: Email, style: 'formal' | 'casual' | 'brief'): string {
  const responses = {
    formal: `Dear ${email.fromName},

Thank you for your email regarding "${email.subject}".

I have carefully reviewed your message and appreciate you taking the time to reach out. Your points are well-noted and I will ensure they receive the appropriate attention.

I will review this matter thoroughly and provide you with a comprehensive response shortly. If you have any additional information or concerns in the meantime, please don't hesitate to share them.

Thank you for your patience and understanding.

Best regards,
John Doe`,
    casual: `Hi ${email.fromName}!

Thanks for reaching out about "${email.subject}".

Got your message and I'm on it! I'll take a look at everything you mentioned and get back to you soon.

Let me know if you need anything else in the meantime!

Cheers,
John`,
    brief: `Hi ${email.fromName},

Received your message about "${email.subject}". Will review and respond shortly.

Thanks,
John`
  }
  
  return responses[style]
}