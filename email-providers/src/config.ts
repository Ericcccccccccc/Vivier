export const providerConfigs = {
  gmail: {
    name: 'Gmail',
    scopes: [
      'https://www.googleapis.com/auth/gmail.modify',
      'https://www.googleapis.com/auth/gmail.send',
      'https://www.googleapis.com/auth/gmail.labels',
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile',
    ],
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    revokeUrl: 'https://oauth2.googleapis.com/revoke',
    userInfoUrl: 'https://www.googleapis.com/oauth2/v2/userinfo',
    apiBaseUrl: 'https://gmail.googleapis.com/gmail/v1',
    quotaLimit: 250, // Gmail API quota units per user per second
    batchSize: 10, // Optimal batch size for API calls
    maxAttachmentSize: 25 * 1024 * 1024, // 25 MB
    supportedFeatures: {
      oauth: true,
      webhooks: true,
      labels: true,
      folders: false,
      threading: true,
      push: true,
      search: true,
      filters: true,
      autoResponder: true,
      signatures: true,
    },
  },
  
  outlook: {
    name: 'Outlook',
    scopes: [
      'https://graph.microsoft.com/Mail.ReadWrite',
      'https://graph.microsoft.com/Mail.Send',
      'https://graph.microsoft.com/User.Read',
      'offline_access',
    ],
    authUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
    tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
    userInfoUrl: 'https://graph.microsoft.com/v1.0/me',
    apiBaseUrl: 'https://graph.microsoft.com/v1.0',
    quotaLimit: 500, // Requests per 10 seconds
    batchSize: 20, // Optimal batch size for Graph API
    maxAttachmentSize: 150 * 1024 * 1024, // 150 MB for Outlook.com
    supportedFeatures: {
      oauth: true,
      webhooks: true,
      labels: false,
      folders: true,
      threading: true,
      push: true,
      search: true,
      filters: true,
      autoResponder: true,
      signatures: true,
      categories: true,
      focusedInbox: true,
    },
  },
  
  imap: {
    name: 'IMAP/SMTP',
    commonPorts: {
      imap: {
        secure: 993,
        starttls: 143,
      },
      smtp: {
        secure: 465,
        starttls: 587,
        plain: 25,
      },
    },
    connectionTimeout: 30000, // 30 seconds
    authTimeout: 10000, // 10 seconds
    keepAliveInterval: 300000, // 5 minutes
    maxConnections: 5, // Per account
    supportedFeatures: {
      oauth: false,
      webhooks: false,
      labels: false,
      folders: true,
      threading: false,
      push: false,
      search: true,
      filters: false,
      autoResponder: false,
      signatures: false,
    },
  },
};

export const knownProviders = {
  // Gmail variants
  'gmail.com': {
    provider: 'gmail',
    displayName: 'Gmail',
  },
  'googlemail.com': {
    provider: 'gmail',
    displayName: 'Gmail',
  },
  
  // Outlook/Microsoft variants
  'outlook.com': {
    provider: 'outlook',
    displayName: 'Outlook.com',
  },
  'hotmail.com': {
    provider: 'outlook',
    displayName: 'Hotmail',
  },
  'live.com': {
    provider: 'outlook',
    displayName: 'Live.com',
  },
  'msn.com': {
    provider: 'outlook',
    displayName: 'MSN',
  },
  
  // IMAP providers with known configurations
  'yahoo.com': {
    provider: 'imap',
    displayName: 'Yahoo Mail',
    config: {
      imapHost: 'imap.mail.yahoo.com',
      imapPort: 993,
      smtpHost: 'smtp.mail.yahoo.com',
      smtpPort: 587,
      requiresAppPassword: true,
    },
  },
  'icloud.com': {
    provider: 'imap',
    displayName: 'iCloud Mail',
    config: {
      imapHost: 'imap.mail.me.com',
      imapPort: 993,
      smtpHost: 'smtp.mail.me.com',
      smtpPort: 587,
      requiresAppPassword: true,
    },
  },
  'aol.com': {
    provider: 'imap',
    displayName: 'AOL Mail',
    config: {
      imapHost: 'imap.aol.com',
      imapPort: 993,
      smtpHost: 'smtp.aol.com',
      smtpPort: 587,
      requiresAppPassword: true,
    },
  },
  'zoho.com': {
    provider: 'imap',
    displayName: 'Zoho Mail',
    config: {
      imapHost: 'imap.zoho.com',
      imapPort: 993,
      smtpHost: 'smtp.zoho.com',
      smtpPort: 587,
    },
  },
  'protonmail.com': {
    provider: 'imap',
    displayName: 'ProtonMail',
    config: {
      imapHost: '127.0.0.1',
      imapPort: 1143,
      smtpHost: '127.0.0.1',
      smtpPort: 1025,
      note: 'Requires ProtonMail Bridge',
    },
  },
  'fastmail.com': {
    provider: 'imap',
    displayName: 'FastMail',
    config: {
      imapHost: 'imap.fastmail.com',
      imapPort: 993,
      smtpHost: 'smtp.fastmail.com',
      smtpPort: 587,
      requiresAppPassword: true,
    },
  },
};

export const errorMessages = {
  authentication: {
    invalidCredentials: 'Invalid email or password. Please check your credentials and try again.',
    oauth2Failed: 'OAuth2 authentication failed. Please try again.',
    tokenExpired: 'Your authentication token has expired. Please sign in again.',
    accountLocked: 'Your account appears to be locked. Please check with your email provider.',
    appPasswordRequired: 'This provider requires an app-specific password. Please generate one in your account settings.',
  },
  
  connection: {
    timeout: 'Connection timed out. Please check your internet connection and try again.',
    serverUnavailable: 'Email server is unavailable. Please try again later.',
    tlsRequired: 'Secure connection (TLS) is required but not available.',
    portBlocked: 'Connection blocked. Port may be blocked by firewall or ISP.',
    invalidHost: 'Invalid server hostname. Please check your server settings.',
  },
  
  quota: {
    rateLimitExceeded: 'API rate limit exceeded. Please wait a moment and try again.',
    quotaExceeded: 'Email quota exceeded. Please free up space in your mailbox.',
    tooManyConnections: 'Too many simultaneous connections. Please close other email clients.',
  },
  
  operations: {
    fetchFailed: 'Failed to fetch emails. Please try again.',
    sendFailed: 'Failed to send email. Please check recipient addresses and try again.',
    attachmentTooLarge: 'Attachment size exceeds the maximum allowed limit.',
    invalidRecipient: 'Invalid recipient email address.',
    messageNotFound: 'Email message not found.',
    folderNotFound: 'Email folder not found.',
  },
};

export const defaultSettings = {
  fetchLimit: 50,
  fetchInterval: 300000, // 5 minutes
  connectionTimeout: 30000, // 30 seconds
  maxRetries: 3,
  retryDelay: 1000, // 1 second
  maxAttachmentSize: 25 * 1024 * 1024, // 25 MB default
  enableWebhooks: true,
  enableAutoSync: true,
  syncOnStartup: true,
  markAsReadOnFetch: false,
  downloadAttachments: false,
  preserveOriginalHtml: true,
  quotedTextHandling: 'collapse', // 'collapse', 'remove', 'preserve'
  signatureDetection: true,
  threadGrouping: true,
  spamDetection: true,
};

export const webhookConfig = {
  gmail: {
    topicName: process.env.GMAIL_TOPIC_NAME || 'projects/your-project/topics/gmail-updates',
    subscriptionName: process.env.GMAIL_SUBSCRIPTION_NAME || 'gmail-push-subscription',
    ackDeadlineSeconds: 600,
    messageRetentionDuration: '604800s', // 7 days
  },
  
  outlook: {
    changeTypes: ['created', 'updated', 'deleted'],
    notificationUrl: process.env.OUTLOOK_WEBHOOK_URL || 'https://your-domain.com/webhooks/outlook',
    expirationMinutes: 4230, // Maximum ~3 days
    clientState: process.env.OUTLOOK_CLIENT_STATE || 'SecretClientState',
  },
};

export const searchOperators = {
  gmail: {
    from: 'from:',
    to: 'to:',
    subject: 'subject:',
    label: 'label:',
    has: 'has:',
    is: 'is:',
    after: 'after:',
    before: 'before:',
    larger: 'larger:',
    smaller: 'smaller:',
    filename: 'filename:',
    in: 'in:',
  },
  
  outlook: {
    from: "from/emailAddress/address eq",
    to: "toRecipients/any(r: r/emailAddress/address eq",
    subject: "contains(subject,",
    hasAttachment: "hasAttachments eq true",
    isRead: "isRead eq",
    importance: "importance eq",
    received: "receivedDateTime",
    categories: "categories/any(c: c eq",
  },
  
  imap: {
    ALL: 'ALL',
    ANSWERED: 'ANSWERED',
    DELETED: 'DELETED',
    DRAFT: 'DRAFT',
    FLAGGED: 'FLAGGED',
    NEW: 'NEW',
    SEEN: 'SEEN',
    RECENT: 'RECENT',
    UNANSWERED: 'UNANSWERED',
    UNDELETED: 'UNDELETED',
    UNDRAFT: 'UNDRAFT',
    UNFLAGGED: 'UNFLAGGED',
    UNSEEN: 'UNSEEN',
    FROM: 'FROM',
    TO: 'TO',
    SUBJECT: 'SUBJECT',
    BODY: 'BODY',
    BEFORE: 'BEFORE',
    SINCE: 'SINCE',
    LARGER: 'LARGER',
    SMALLER: 'SMALLER',
  },
};