import { Email, EmailIntent, SentimentAnalysis } from '../interface';

export class EmailAnalysisPromptBuilder {
  buildSentimentAnalysisPrompt(email: string): string {
    return `Analyze the sentiment and emotional tone of the following email.

Email content:
${email}

Provide analysis in the following format:
1. Overall sentiment: positive, negative, neutral, or mixed
2. Confidence score: 0.0 to 1.0
3. Detected emotions with intensity (0.0 to 1.0):
   - Joy
   - Anger
   - Sadness
   - Fear
   - Surprise
4. Urgency level: low, medium, or high
5. Professionalism score: 0.0 to 1.0
6. Key indicators that influenced the analysis

Be precise and consider both explicit and implicit emotional cues.`;
  }

  buildIntentClassificationPrompt(email: string): string {
    return `Classify the primary intent of this email and identify required actions.

Email content:
${email}

Classify into one of these categories:
- meeting_request: Requesting to schedule or discussing a meeting
- information_request: Asking for information, clarification, or data
- task_assignment: Assigning work or requesting action items
- feedback: Providing feedback, review, or evaluation
- complaint: Expressing dissatisfaction or raising issues
- thank_you: Expressing gratitude or appreciation
- introduction: Introducing people or initiating contact
- follow_up: Following up on previous communication
- announcement: Sharing news, updates, or announcements
- other: Doesn't fit other categories

Also identify:
1. Confidence level (0.0 to 1.0)
2. List of specific actions required from the recipient
3. Deadline if mentioned
4. Priority indicators
5. Secondary intents if present`;
  }

  buildPriorityDetectionPrompt(email: string): string {
    return `Determine the priority level of this email based on content, tone, and context.

Email content:
${email}

Analyze and provide:
1. Priority level: low, medium, high, or urgent
2. Factors contributing to this priority:
   - Explicit priority indicators (words like urgent, ASAP, etc.)
   - Sender's tone and language
   - Deadlines mentioned
   - Business impact implications
   - Escalation indicators
3. Suggested response timeframe
4. Risk of delayed response
5. Confidence in assessment (0.0 to 1.0)`;
  }

  buildEntityExtractionPrompt(email: string): string {
    return `Extract key entities and information from this email.

Email content:
${email}

Extract the following:
1. People mentioned (names, roles, organizations)
2. Dates and times (meetings, deadlines, events)
3. Locations (physical addresses, meeting rooms, venues)
4. Projects or products mentioned
5. Action items with assigned owners
6. Monetary amounts or budgets
7. Contact information (phone, email, addresses)
8. File names or document references
9. URLs or links
10. Key metrics or KPIs mentioned

Format each entity with its type and context.`;
  }

  buildTopicExtractionPrompt(emails: Email[]): string {
    const emailSummaries = emails.map((email, index) => 
      `Email ${index + 1} (${email.from}): ${email.subject}`
    ).join('\n');

    return `Identify the main topics discussed across these emails.

Email thread:
${emailSummaries}

Provide:
1. Primary topic/theme of the conversation
2. Sub-topics discussed
3. Topic evolution over time
4. Key decisions or conclusions reached
5. Unresolved topics requiring attention
6. Related topics that might need follow-up`;
  }

  buildLanguageDetectionPrompt(email: string): string {
    return `Detect the language and communication style of this email.

Email content:
${email}

Analyze:
1. Primary language
2. Formality level (very formal, formal, neutral, casual, very casual)
3. Technical level (non-technical, some technical, highly technical)
4. Cultural communication style indicators
5. Industry-specific jargon or terminology
6. Recommended response language and style`;
  }

  buildComplianceCheckPrompt(email: string, policies: string[]): string {
    const policyList = policies.join('\n- ');
    
    return `Check this email for compliance with company policies.

Email content:
${email}

Policies to check:
- ${policyList}

Identify:
1. Any policy violations
2. Potential compliance risks
3. Sensitive information that needs protection
4. Required disclaimers or notices missing
5. Recommendations for compliance
6. Severity of any issues found (low, medium, high)`;
  }

  buildRelationshipAnalysisPrompt(thread: Email[]): string {
    const threadSummary = thread.map((email, index) => 
      `${index + 1}. From: ${email.from}, To: ${email.to.join(', ')}, Date: ${email.timestamp.toISOString()}`
    ).join('\n');

    return `Analyze the relationship dynamics in this email thread.

Thread participants:
${threadSummary}

Analyze:
1. Relationship type (professional, client, vendor, internal team)
2. Communication patterns (frequency, response times)
3. Power dynamics or hierarchy
4. Collaboration style
5. Conflict or tension indicators
6. Relationship strength (weak, moderate, strong)
7. Recommendations for maintaining/improving relationship`;
  }

  buildActionItemExtractionPrompt(email: string): string {
    return `Extract all action items from this email.

Email content:
${email}

For each action item, identify:
1. Description of the task
2. Assigned owner (if mentioned)
3. Deadline or timeline
4. Priority level
5. Dependencies on other tasks
6. Success criteria or deliverables
7. Whether it's a request or commitment
8. Status if mentioned (not started, in progress, completed)

Format as a structured list with clear ownership and deadlines.`;
  }

  buildSmartReplyPrompt(email: string): string {
    return `Generate 3 brief smart reply options for this email.

Email content:
${email}

Provide 3 different response options:
1. Positive/Accepting response (1-2 sentences)
2. Neutral/Acknowledging response (1-2 sentences)
3. Declining/Deferring response (1-2 sentences)

Each response should:
- Be complete and professional
- Address the main point of the email
- Be under 25 words
- Offer different strategic approaches`;
  }

  buildThreadCategorizationPrompt(thread: Email[]): string {
    const threadContent = thread.slice(0, 5).map(email => 
      `Subject: ${email.subject}\nFrom: ${email.from}\nPreview: ${email.body.substring(0, 100)}...`
    ).join('\n---\n');

    return `Categorize this email thread for inbox organization.

Thread sample:
${threadContent}

Assign categories:
1. Primary category (work, personal, promotional, social, updates)
2. Subcategory (project, meeting, report, invoice, newsletter, etc.)
3. Importance level (high, medium, low)
4. Suggested folder/label
5. Auto-archive recommendation (yes/no)
6. Follow-up required (yes/no)
7. Estimated reading time
8. Key stakeholders involved`;
  }

  parseSentimentResponse(response: string): SentimentAnalysis {
    // Parse AI response into structured sentiment analysis
    // This is a simplified parser - in production, use more robust parsing
    
    const sentimentMatch = response.match(/sentiment:\s*(positive|negative|neutral|mixed)/i);
    const scoreMatch = response.match(/score:\s*([\d.]+)/);
    const urgencyMatch = response.match(/urgency:\s*(low|medium|high)/i);
    const professionalismMatch = response.match(/professionalism:\s*([\d.]+)/);
    
    return {
      sentiment: (sentimentMatch?.[1] as any) || 'neutral',
      score: parseFloat(scoreMatch?.[1] || '0.5'),
      emotions: this.parseEmotions(response),
      urgency: (urgencyMatch?.[1] as any) || 'medium',
      professionalism: parseFloat(professionalismMatch?.[1] || '0.7'),
    };
  }

  private parseEmotions(response: string): Record<string, number> {
    const emotions: Record<string, number> = {};
    
    const emotionPatterns = [
      /joy:\s*([\d.]+)/i,
      /anger:\s*([\d.]+)/i,
      /sadness:\s*([\d.]+)/i,
      /fear:\s*([\d.]+)/i,
      /surprise:\s*([\d.]+)/i,
    ];
    
    emotionPatterns.forEach(pattern => {
      const match = response.match(pattern);
      if (match) {
        const emotionName = pattern.source.split(':')[0].replace(/\\/g, '').toLowerCase();
        emotions[emotionName] = parseFloat(match[1]);
      }
    });
    
    return emotions;
  }

  parseIntentResponse(response: string): EmailIntent {
    const typeMatch = response.match(/category:\s*(\w+)/i);
    const confidenceMatch = response.match(/confidence:\s*([\d.]+)/);
    
    // Extract required actions (looking for numbered or bulleted lists)
    const actionsMatch = response.match(/actions?:?\s*((?:[-•*]\s*.+\n?)+)/i);
    const actions = actionsMatch 
      ? actionsMatch[1].split(/[-•*]\s*/).filter(a => a.trim()).map(a => a.trim())
      : [];
    
    return {
      type: (typeMatch?.[1] as any) || 'other',
      confidence: parseFloat(confidenceMatch?.[1] || '0.5'),
      requiredActions: actions,
    };
  }
}