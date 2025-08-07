import { db } from '../lib/database';
import { ai } from '../lib/ai';
import { 
  ProcessedEmail,
  NotFoundError,
  ForbiddenError,
  RateLimitError,
  ListOptions,
  PaginatedResponse
} from '../types';

export class EmailService {
  async processEmail(emailId: string, userId: string): Promise<ProcessedEmail> {
    // Get email
    const email = await db.getEmail(emailId);
    
    if (!email) {
      throw new NotFoundError('Email not found');
    }
    
    // Check ownership
    const account = await db.getEmailAccount(email.account_id);
    if (!account || account.user_id !== userId) {
      throw new ForbiddenError('Access denied');
    }
    
    // Check usage limits
    const usage = await db.getUsage(userId, 'ai_calls', new Date());
    const dailyLimit = 50; // Free tier limit
    
    if (usage && usage.count >= dailyLimit) {
      throw new RateLimitError('Daily AI usage limit exceeded');
    }
    
    // Generate AI response
    const startTime = Date.now();
    
    const aiResponse = await ai.generateEmailResponse({
      subject: email.subject,
      from: email.from_address,
      to: email.to_addresses,
      body: email.body_text || email.body_html || '',
      responseStyle: 'professional',
      context: {
        threadId: email.thread_id,
        isReply: !!email.in_reply_to,
      },
    });
    
    const responseTime = Date.now() - startTime;
    
    // Save response
    const saved = await db.saveAIResponse({
      email_id: emailId,
      response_text: aiResponse.text,
      model_used: aiResponse.model || 'groq-llama',
      confidence_score: aiResponse.confidence || 0.8,
      tokens_used: aiResponse.tokensUsed || 0,
      response_time_ms: responseTime,
    });
    
    // Update usage
    await db.incrementUsage(userId, 'ai_calls', aiResponse.tokensUsed || 100);
    
    // Mark email as processed
    await db.markEmailProcessed(emailId);
    
    return {
      email,
      aiResponse: saved,
      usage: {
        remaining: dailyLimit - (usage?.count || 0) - 1,
        resetAt: this.getResetDate(),
      },
    };
  }
  
  async listEmails(
    userId: string, 
    options: ListOptions
  ): Promise<PaginatedResponse<any>> {
    // Get user's email accounts
    const accounts = await db.getEmailAccounts(userId);
    
    if (accounts.length === 0) {
      return {
        data: [],
        meta: {
          page: options.page || 1,
          pageSize: options.pageSize || 20,
          total: 0,
          totalPages: 0,
        },
      };
    }
    
    // Get emails from all accounts
    const accountIds = accounts.map(a => a.id);
    
    const result = await db.getEmails(accountIds, {
      page: options.page || 1,
      pageSize: options.pageSize || 20,
      sortBy: options.sortBy || 'received_at',
      sortOrder: options.sortOrder || 'desc',
      filters: options.filters,
    });
    
    return {
      data: result.emails,
      meta: {
        page: result.page,
        pageSize: result.pageSize,
        total: result.total,
        totalPages: Math.ceil(result.total / result.pageSize),
      },
    };
  }
  
  async getEmail(emailId: string, userId: string): Promise<any> {
    const email = await db.getEmail(emailId);
    
    if (!email) {
      throw new NotFoundError('Email not found');
    }
    
    // Check ownership
    const account = await db.getEmailAccount(email.account_id);
    if (!account || account.user_id !== userId) {
      throw new ForbiddenError('Access denied');
    }
    
    // Get AI responses if any
    const aiResponses = await db.getAIResponses(emailId);
    
    return {
      ...email,
      aiResponses,
    };
  }
  
  async deleteEmail(emailId: string, userId: string): Promise<void> {
    const email = await db.getEmail(emailId);
    
    if (!email) {
      throw new NotFoundError('Email not found');
    }
    
    // Check ownership
    const account = await db.getEmailAccount(email.account_id);
    if (!account || account.user_id !== userId) {
      throw new ForbiddenError('Access denied');
    }
    
    await db.deleteEmail(emailId);
  }
  
  async archiveEmail(emailId: string, userId: string): Promise<void> {
    const email = await db.getEmail(emailId);
    
    if (!email) {
      throw new NotFoundError('Email not found');
    }
    
    // Check ownership
    const account = await db.getEmailAccount(email.account_id);
    if (!account || account.user_id !== userId) {
      throw new ForbiddenError('Access denied');
    }
    
    await db.archiveEmail(emailId);
  }
  
  private getResetDate(): Date {
    const tomorrow = new Date();
    tomorrow.setUTCHours(24, 0, 0, 0);
    return tomorrow;
  }
}

export const emailService = new EmailService();