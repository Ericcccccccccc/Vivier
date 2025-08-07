import { Email, EmailSummary, DailyStats } from '../types';

export function formatEmailNotification(email: Email): string {
  const importance = email.isImportant ? '⚠️ *IMPORTANT*' : '📧 *New Email*';
  const attachmentInfo = email.attachments?.length 
    ? `\n📎 *Attachments:* ${email.attachments.length} file(s)` 
    : '';
  
  return `
${importance}

*From:* ${email.from.name || email.from.email}
*Subject:* ${email.subject}
*Time:* ${new Date(email.date).toLocaleTimeString()}${attachmentInfo}

*Preview:*
${email.preview}

*Actions:*
• Reply /view ${email.id} to read full email
• Reply /reply ${email.id} for AI response
• Reply /ignore to mark as read
  `.trim();
}

export function formatEmailDetails(email: Email): string {
  const attachmentList = email.attachments?.map(
    att => `  • ${att.name} (${formatFileSize(att.size)})`
  ).join('\n') || 'None';
  
  return `
📧 *Email Details*

*From:* ${email.from.name || email.from.email}
*To:* ${email.to}
*Subject:* ${email.subject}
*Date:* ${new Date(email.date).toLocaleString()}
*Category:* ${email.category || 'Uncategorized'}

*Attachments:*
${attachmentList}

*Content:*
${email.body || email.preview}

*Actions:*
• /reply ${email.id} - Generate AI response
• /forward ${email.id} - Forward email
• /delete ${email.id} - Delete email
  `.trim();
}

export function formatEmailSummary(summary: EmailSummary): string {
  const topSendersList = summary.topSenders
    .slice(0, 5)
    .map(s => `  • ${s.name}: ${s.count} emails`)
    .join('\n');
  
  const categoryList = Object.entries(summary.categories)
    .slice(0, 5)
    .map(([cat, count]) => `  • ${cat}: ${count}`)
    .join('\n');
  
  return `
📊 *Email Summary*

*📅 Today's Activity:*
  • Received: ${summary.today.received}
  • Sent: ${summary.today.sent}
  • AI Responses: ${summary.today.aiResponses}

*📥 Unread Emails:*
  • Total: ${summary.unread.total}
  • Important: ${summary.unread.important} ${summary.unread.important > 0 ? '⚠️' : ''}
  • Needs Response: ${summary.unread.requiresResponse}

*👥 Top Senders:*
${topSendersList}

*📁 Categories:*
${categoryList}

_Last updated: ${new Date().toLocaleTimeString()}_
  `.trim();
}

export function formatAIResponse(email: Email, response: string): string {
  return `
🤖 *AI Response Ready*

*Replying to:* ${email.subject}
*From:* ${email.from.name || email.from.email}

*Generated Response:*
${response}

*Actions:*
• Reply /send to send this response
• Reply /edit <new text> to modify
• Reply /regenerate for a new response
• Reply /cancel to discard
  `.trim();
}

export function formatDailySummary(stats: DailyStats): string {
  const topCategories = stats.topCategories
    .slice(0, 3)
    .map(c => `  • ${c.name}: ${c.count}`)
    .join('\n');
  
  return `
☀️ *Good Morning! Here's Your Daily Summary*

*📅 ${new Date(stats.date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}*

*📊 Yesterday's Activity:*
  • Emails Received: ${stats.received}
  • Emails Sent: ${stats.sent}
  • AI Responses: ${stats.aiResponses}
  • Avg Response Time: ${stats.avgResponseTime}

*📁 Top Categories:*
${topCategories}

*💡 Tip of the Day:*
Use /pause to temporarily disable notifications during meetings or focus time.

Have a productive day! 🚀
  `.trim();
}

export function formatHelp(): string {
  return `
📚 *Available Commands*

*Basic Commands:*
• /start - Initialize bot and register
• /help - Show this help message
• /status - Check bot and account status
• /settings - Open settings dashboard

*Email Commands:*
• /summary - Get email summary
• /view <id> - View full email
• /reply <id> - Generate AI response
• /send - Send pending response
• /ignore - Mark email as read

*Notification Control:*
• /pause - Pause all notifications
• /resume - Resume notifications
• /quiet <hours> - Pause for specific hours

*Advanced:*
• /search <query> - Search emails
• /filter <category> - View by category
• /stats - View usage statistics
• /feedback <message> - Send feedback

*Quick Tips:*
• Important emails are marked with ⚠️
• AI responses can be edited before sending
• Use /pause during meetings to avoid interruptions

_Need more help? Visit https://email-ai.app/help_
  `.trim();
}

export function formatWelcomeMessage(userId: string): string {
  return `
🎉 *Welcome to Email AI Assistant!*

I'm here to help you manage your emails efficiently through WhatsApp.

*Getting Started:*
1️⃣ Visit https://email-ai.app/connect
2️⃣ Link your email account
3️⃣ Configure your preferences
4️⃣ Start receiving smart notifications!

*Your Setup Code:* \`${userId.slice(-8)}\`
Use this code on the website to link your WhatsApp.

*Quick Commands:*
• /help - See all commands
• /status - Check connection
• /settings - Manage preferences

Ready to revolutionize your email experience? Let's go! 🚀
  `.trim();
}

export function formatErrorMessage(error: string): string {
  return `
❌ *Error Occurred*

${error}

*What you can do:*
• Try the command again
• Check your internet connection
• Ensure your email is linked (/status)
• Contact support if issue persists

_Error ID: ${Date.now().toString(36)}_
  `.trim();
}

export function formatQuietHoursMessage(hours: number): string {
  const resumeTime = new Date();
  resumeTime.setHours(resumeTime.getHours() + hours);
  
  return `
🔕 *Quiet Mode Activated*

Notifications paused for ${hours} hour(s).

I'll resume notifications at:
📅 ${resumeTime.toLocaleTimeString()}

*During quiet hours:*
• No email notifications
• Commands still work
• Emergency emails may still notify

Use /resume to end quiet mode early.
  `.trim();
}

export function formatSearchResults(results: Email[], query: string): string {
  if (results.length === 0) {
    return `🔍 No emails found matching "${query}"`;
  }
  
  const resultList = results
    .slice(0, 5)
    .map(email => `• ${email.subject}\n  From: ${email.from.name || email.from.email}\n  /view ${email.id}`)
    .join('\n\n');
  
  return `
🔍 *Search Results for "${query}"*

Found ${results.length} email(s):

${resultList}

${results.length > 5 ? `\n_Showing first 5 results. Refine your search for better results._` : ''}
  `.trim();
}

export function formatStatistics(stats: any): string {
  return `
📈 *Your Email Statistics*

*This Week:*
• Total Emails: ${stats.weekly.total}
• Sent: ${stats.weekly.sent}
• Received: ${stats.weekly.received}
• AI Responses: ${stats.weekly.aiResponses}

*This Month:*
• Total Emails: ${stats.monthly.total}
• Average Daily: ${Math.round(stats.monthly.total / 30)}
• Response Rate: ${stats.monthly.responseRate}%
• Most Active Day: ${stats.monthly.mostActiveDay}

*All Time:*
• Total Processed: ${stats.allTime.total}
• AI Responses: ${stats.allTime.aiResponses}
• Time Saved: ${stats.allTime.timeSaved}

*Top Achievements:*
${stats.achievements.map(a => `🏆 ${a}`).join('\n')}

_Member since: ${stats.memberSince}_
  `.trim();
}

// Helper functions
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

export function formatConnectionStatus(isConnected: boolean, lastSeen?: Date): string {
  if (isConnected) {
    return `
✅ *Bot Status: Online*

Connection established and working properly.
All systems operational.

_Last checked: ${new Date().toLocaleTimeString()}_
    `.trim();
  } else {
    return `
❌ *Bot Status: Offline*

Connection lost. Attempting to reconnect...

${lastSeen ? `_Last seen: ${lastSeen.toLocaleString()}_` : ''}

Please wait or contact support if issue persists.
    `.trim();
  }
}