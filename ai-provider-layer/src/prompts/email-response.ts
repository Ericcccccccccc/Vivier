import { EmailContext, Email, ResponseStyle } from '../interface';

export class EmailPromptBuilder {
  private systemPrompts: Map<ResponseStyle, string>;

  constructor() {
    this.systemPrompts = new Map();
    this.initializeSystemPrompts();
  }

  private initializeSystemPrompts(): void {
    const basePrompt = `You are a professional email assistant. Your responses should be:
- Clear and concise
- Professional yet friendly
- Action-oriented when appropriate
- Free of spelling and grammar errors
- Properly formatted with appropriate greetings and closings`;

    this.systemPrompts.set('formal', basePrompt + `
- Use formal language and proper salutations
- Maintain professional distance
- Use complete sentences and proper grammar
- Include formal closings (Sincerely, Best regards, etc.)
- Avoid contractions and colloquialisms`);

    this.systemPrompts.set('casual', basePrompt + `
- Use conversational tone
- Be friendly and approachable
- Use contractions when natural
- Include warm greetings and closings
- Feel free to use appropriate humor when suitable`);

    this.systemPrompts.set('brief', basePrompt + `
- Maximum 3 paragraphs
- Get straight to the point
- Use bullet points when listing items
- Skip unnecessary pleasantries
- Focus on key information and actions`);
  }

  buildSystemPrompt(style: ResponseStyle = 'formal'): string {
    return this.systemPrompts.get(style) || this.systemPrompts.get('formal')!;
  }

  buildEmailPrompt(context: EmailContext): string {
    const lines: string[] = [];
    
    lines.push('Email to respond to:');
    lines.push(`From: ${context.from}`);
    lines.push(`To: ${context.to.join(', ')}`);
    lines.push(`Subject: ${context.subject}`);
    lines.push(`Body:\n${context.body}`);
    lines.push('');
    
    // Add thread context if available
    if (context.thread && context.thread.length > 0) {
      lines.push('Previous conversation thread (for context):');
      
      // Include last 3 emails max for context
      const recentThread = context.thread.slice(-3);
      recentThread.forEach((email, index) => {
        lines.push(`---`);
        lines.push(`Email ${index + 1}:`);
        lines.push(`From: ${email.from}`);
        lines.push(`Date: ${email.timestamp.toISOString()}`);
        lines.push(`${this.truncateBody(email.body, 500)}`);
      });
      lines.push('');
    }
    
    // Add response requirements
    lines.push('Generate a response that:');
    lines.push('1. Addresses all points raised in the email');
    lines.push(`2. Maintains a ${context.responseStyle || 'professional'} tone`);
    
    if (context.maxLength) {
      lines.push(`3. Is no longer than ${context.maxLength} words`);
    }
    
    lines.push('4. Includes appropriate greeting and closing');
    lines.push('5. Suggests clear next steps when applicable');
    
    if (context.includeSignature) {
      lines.push('6. Includes a professional signature at the end');
    }
    
    return lines.join('\n');
  }

  buildFollowUpPrompt(
    originalEmail: EmailContext,
    daysElapsed: number,
    followUpNumber: number = 1
  ): string {
    const lines: string[] = [];
    
    lines.push(`Generate a follow-up email (follow-up #${followUpNumber})`);
    lines.push(`Days since original email: ${daysElapsed}`);
    lines.push('');
    lines.push('Original email:');
    lines.push(`Subject: ${originalEmail.subject}`);
    lines.push(`Body: ${this.truncateBody(originalEmail.body, 300)}`);
    lines.push('');
    lines.push('Requirements:');
    lines.push('1. Reference the original email');
    lines.push('2. Be polite but show appropriate urgency');
    
    if (followUpNumber > 1) {
      lines.push('3. Acknowledge previous follow-ups');
      lines.push('4. Escalate tone slightly if appropriate');
    }
    
    lines.push(`5. Maintain ${originalEmail.responseStyle || 'professional'} tone`);
    lines.push('6. Provide alternative contact methods if urgent');
    
    return lines.join('\n');
  }

  buildSummaryPrompt(thread: Email[]): string {
    const lines: string[] = [];
    
    lines.push('Summarize the following email thread:');
    lines.push(`Number of emails: ${thread.length}`);
    lines.push('');
    
    thread.forEach((email, index) => {
      lines.push(`Email ${index + 1}:`);
      lines.push(`From: ${email.from}`);
      lines.push(`Date: ${email.timestamp.toISOString()}`);
      lines.push(`Subject: ${email.subject}`);
      lines.push(`Body: ${this.truncateBody(email.body, 200)}`);
      lines.push('---');
    });
    
    lines.push('');
    lines.push('Provide a summary that includes:');
    lines.push('1. Main topic and purpose of the conversation');
    lines.push('2. Key decisions made');
    lines.push('3. Action items identified');
    lines.push('4. Unresolved questions or issues');
    lines.push('5. Next steps agreed upon');
    
    return lines.join('\n');
  }

  buildAutoReplyPrompt(
    context: EmailContext,
    reason: 'out_of_office' | 'vacation' | 'busy' | 'delayed_response',
    returnDate?: Date
  ): string {
    const lines: string[] = [];
    
    lines.push('Generate an automatic reply email:');
    lines.push(`Reason: ${reason}`);
    
    if (returnDate) {
      lines.push(`Return date: ${returnDate.toLocaleDateString()}`);
    }
    
    lines.push('');
    lines.push('Original email:');
    lines.push(`From: ${context.from}`);
    lines.push(`Subject: ${context.subject}`);
    lines.push('');
    lines.push('Requirements:');
    lines.push('1. Acknowledge receipt of their email');
    lines.push('2. Explain the delay in response');
    
    if (returnDate) {
      lines.push('3. Provide expected response date');
    }
    
    lines.push('4. Offer alternative contact for urgent matters');
    lines.push('5. Thank them for their patience');
    lines.push(`6. Use ${context.responseStyle || 'professional'} tone`);
    
    return lines.join('\n');
  }

  buildTemplatePrompt(
    templateType: string,
    variables: Record<string, string>
  ): string {
    const lines: string[] = [];
    
    lines.push(`Generate an email using the ${templateType} template`);
    lines.push('');
    lines.push('Variables:');
    
    Object.entries(variables).forEach(([key, value]) => {
      lines.push(`- ${key}: ${value}`);
    });
    
    lines.push('');
    lines.push('Requirements:');
    lines.push('1. Follow standard format for this type of email');
    lines.push('2. Include all necessary information');
    lines.push('3. Maintain professional tone');
    lines.push('4. Be clear and actionable');
    
    return lines.join('\n');
  }

  private truncateBody(body: string, maxLength: number): string {
    if (body.length <= maxLength) {
      return body;
    }
    return body.substring(0, maxLength) + '...';
  }

  // Advanced prompt techniques
  buildChainOfThoughtPrompt(context: EmailContext): string {
    const lines: string[] = [];
    
    lines.push('Let\'s think through this email step by step:');
    lines.push('');
    lines.push('1. First, identify the main purpose of the email');
    lines.push('2. List all questions or requests that need addressing');
    lines.push('3. Consider the sender\'s tone and urgency');
    lines.push('4. Determine appropriate response style');
    lines.push('5. Draft a response that addresses all points');
    lines.push('');
    lines.push('Email details:');
    lines.push(this.buildEmailPrompt(context));
    lines.push('');
    lines.push('Now, generate a well-thought-out response.');
    
    return lines.join('\n');
  }

  buildContextualPrompt(
    context: EmailContext,
    additionalContext: {
      senderRole?: string;
      relationship?: 'colleague' | 'client' | 'supervisor' | 'subordinate' | 'external';
      previousInteractions?: number;
      projectName?: string;
      deadline?: Date;
    }
  ): string {
    const lines: string[] = [];
    
    lines.push('Context for this email response:');
    
    if (additionalContext.senderRole) {
      lines.push(`Sender's role: ${additionalContext.senderRole}`);
    }
    
    if (additionalContext.relationship) {
      lines.push(`Relationship: ${additionalContext.relationship}`);
    }
    
    if (additionalContext.previousInteractions) {
      lines.push(`Previous interactions: ${additionalContext.previousInteractions}`);
    }
    
    if (additionalContext.projectName) {
      lines.push(`Related to project: ${additionalContext.projectName}`);
    }
    
    if (additionalContext.deadline) {
      lines.push(`Deadline: ${additionalContext.deadline.toLocaleDateString()}`);
    }
    
    lines.push('');
    lines.push(this.buildEmailPrompt(context));
    
    return lines.join('\n');
  }
}

export class PromptOptimizer {
  static optimize(prompt: string): string {
    // Remove unnecessary whitespace
    let optimized = prompt.replace(/\n{3,}/g, '\n\n');
    
    // Remove redundant words
    optimized = optimized.replace(/\b(very|really|actually|basically)\b/gi, '');
    
    // Simplify instructions
    optimized = optimized.replace(/Please make sure to/gi, '');
    optimized = optimized.replace(/It is important that/gi, '');
    
    // Trim each line
    optimized = optimized
      .split('\n')
      .map(line => line.trim())
      .join('\n');
    
    return optimized;
  }

  static estimateTokenCount(text: string): number {
    // Rough estimation: ~4 characters per token for English
    // More accurate would use a proper tokenizer
    const wordCount = text.split(/\s+/).length;
    const charCount = text.length;
    
    // Use average of word-based and char-based estimation
    const wordBasedEstimate = wordCount * 1.3;
    const charBasedEstimate = charCount / 4;
    
    return Math.ceil((wordBasedEstimate + charBasedEstimate) / 2);
  }

  static truncateToTokenLimit(text: string, maxTokens: number): string {
    const estimatedTokens = this.estimateTokenCount(text);
    
    if (estimatedTokens <= maxTokens) {
      return text;
    }
    
    // Calculate ratio to truncate
    const ratio = maxTokens / estimatedTokens;
    const targetLength = Math.floor(text.length * ratio * 0.95); // 95% to be safe
    
    return text.substring(0, targetLength) + '...';
  }
}