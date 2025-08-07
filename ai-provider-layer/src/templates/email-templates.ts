export interface EmailTemplate {
  name: string;
  category: string;
  template: string;
  variables: string[];
  description: string;
  tags: string[];
}

export const emailTemplates: Record<string, EmailTemplate> = {
  meeting_accept: {
    name: 'Meeting Acceptance',
    category: 'meeting',
    template: `Thank you for the meeting invitation. I would be happy to attend the {{meeting_type}} on {{date}} at {{time}}.

{{#if agenda}}
I've reviewed the agenda and {{agenda_comment}}.
{{/if}}

{{#if location}}
I'll see you at {{location}}.
{{else}}
I'll be ready for the {{meeting_platform}} call.
{{/if}}

Looking forward to our discussion.

{{closing}},
{{sender_name}}`,
    variables: ['meeting_type', 'date', 'time', 'agenda', 'agenda_comment', 'location', 'meeting_platform', 'closing', 'sender_name'],
    description: 'Accept a meeting invitation with professional tone',
    tags: ['meeting', 'acceptance', 'professional'],
  },

  meeting_decline: {
    name: 'Meeting Decline',
    category: 'meeting',
    template: `Thank you for the invitation to {{meeting_subject}}.

Unfortunately, I have a {{conflict_reason}} at that time and won't be able to attend.

{{#if alternative_times}}
Would any of these alternative times work for you?
{{alternative_times}}
{{else}}
Could we explore alternative time slots? I'm generally available {{availability}}.
{{/if}}

{{#if delegate}}
Alternatively, {{delegate_name}} from my team could attend in my place if that would be helpful.
{{/if}}

{{closing}},
{{sender_name}}`,
    variables: ['meeting_subject', 'conflict_reason', 'alternative_times', 'availability', 'delegate', 'delegate_name', 'closing', 'sender_name'],
    description: 'Politely decline a meeting with alternatives',
    tags: ['meeting', 'decline', 'professional'],
  },

  information_request: {
    name: 'Information Request',
    category: 'request',
    template: `I hope this email finds you well.

I'm reaching out regarding {{subject_matter}}. To {{purpose}}, I would need the following information:

{{#each information_points}}
• {{this}}
{{/each}}

{{#if deadline}}
If possible, I would appreciate receiving this information by {{deadline}} as {{deadline_reason}}.
{{/if}}

{{#if context}}
For context, {{context}}.
{{/if}}

Please let me know if you need any clarification or if there's additional information I should provide.

{{closing}},
{{sender_name}}`,
    variables: ['subject_matter', 'purpose', 'information_points', 'deadline', 'deadline_reason', 'context', 'closing', 'sender_name'],
    description: 'Request specific information professionally',
    tags: ['request', 'information', 'professional'],
  },

  task_acknowledgment: {
    name: 'Task Acknowledgment',
    category: 'task',
    template: `Thank you for {{task_description}}.

I've received your request and {{action_taken}}. {{#if timeline}}I expect to have this completed by {{timeline}}.{{/if}}

{{#if clarifications}}
Before I proceed, I have a few clarifications:
{{#each clarifications}}
• {{this}}
{{/each}}
{{/if}}

{{#if dependencies}}
Please note that this task depends on {{dependencies}}.
{{/if}}

I'll {{update_frequency}} on my progress. {{#if concerns}}{{concerns}}{{/if}}

{{closing}},
{{sender_name}}`,
    variables: ['task_description', 'action_taken', 'timeline', 'clarifications', 'dependencies', 'update_frequency', 'concerns', 'closing', 'sender_name'],
    description: 'Acknowledge receipt of a task or assignment',
    tags: ['task', 'acknowledgment', 'professional'],
  },

  follow_up: {
    name: 'Follow Up',
    category: 'follow_up',
    template: `I hope you're doing well.

I wanted to follow up on {{original_subject}} that we discussed {{timeframe}}.

{{#if previous_action}}
As mentioned, {{previous_action}}.
{{/if}}

{{#if current_status}}
Current status: {{current_status}}
{{/if}}

{{#if next_steps}}
Next steps:
{{#each next_steps}}
• {{this}}
{{/each}}
{{/if}}

{{#if question}}
{{question}}
{{/if}}

Please let me know if you need any additional information or if there's anything else I can help with.

{{closing}},
{{sender_name}}`,
    variables: ['original_subject', 'timeframe', 'previous_action', 'current_status', 'next_steps', 'question', 'closing', 'sender_name'],
    description: 'Follow up on previous communication',
    tags: ['follow_up', 'professional'],
  },

  thank_you: {
    name: 'Thank You',
    category: 'appreciation',
    template: `{{#if personalized_greeting}}{{personalized_greeting}}{{else}}I hope this email finds you well.{{/if}}

I wanted to take a moment to thank you for {{reason_for_thanks}}.

{{#if specific_impact}}
{{specific_impact}}
{{/if}}

{{#if future_collaboration}}
I look forward to {{future_collaboration}}.
{{/if}}

{{#if offer_reciprocal}}
Please don't hesitate to reach out if there's anything I can do to return the favor.
{{/if}}

{{closing}},
{{sender_name}}`,
    variables: ['personalized_greeting', 'reason_for_thanks', 'specific_impact', 'future_collaboration', 'offer_reciprocal', 'closing', 'sender_name'],
    description: 'Express gratitude professionally',
    tags: ['thank_you', 'appreciation', 'professional'],
  },

  out_of_office: {
    name: 'Out of Office',
    category: 'auto_reply',
    template: `Thank you for your email.

I am currently out of the office {{#if reason}}{{reason}}{{/if}} and will have limited access to email {{#if return_date}}until {{return_date}}{{/if}}.

{{#if will_respond}}
I will respond to your message when I return.
{{/if}}

{{#if urgent_contact}}
For urgent matters, please contact {{urgent_contact_name}} at {{urgent_contact_email}}.
{{/if}}

{{#if alternative_instructions}}
{{alternative_instructions}}
{{/if}}

{{closing}},
{{sender_name}}`,
    variables: ['reason', 'return_date', 'will_respond', 'urgent_contact', 'urgent_contact_name', 'urgent_contact_email', 'alternative_instructions', 'closing', 'sender_name'],
    description: 'Automatic out of office reply',
    tags: ['out_of_office', 'auto_reply'],
  },

  introduction: {
    name: 'Introduction',
    category: 'networking',
    template: `{{greeting}},

{{#if mutual_connection}}
{{mutual_connection_name}} suggested I reach out to you regarding {{topic}}.
{{else}}
I'm reaching out to introduce myself. My name is {{sender_name}} and I {{sender_role}}.
{{/if}}

{{#if common_interest}}
I noticed that we both {{common_interest}}, and I thought it would be valuable to connect.
{{/if}}

{{#if purpose}}
{{purpose}}
{{/if}}

{{#if specific_request}}
I was wondering if {{specific_request}}.
{{/if}}

{{#if availability}}
If you're interested, I'm generally available {{availability}}.
{{/if}}

Looking forward to {{desired_outcome}}.

{{closing}},
{{sender_name}}
{{#if sender_title}}
{{sender_title}}
{{/if}}`,
    variables: ['greeting', 'mutual_connection', 'mutual_connection_name', 'topic', 'sender_name', 'sender_role', 'common_interest', 'purpose', 'specific_request', 'availability', 'desired_outcome', 'closing', 'sender_title'],
    description: 'Introduce yourself professionally',
    tags: ['introduction', 'networking', 'professional'],
  },

  status_update: {
    name: 'Status Update',
    category: 'project',
    template: `Subject: {{project_name}} - Status Update {{#if date}}({{date}}){{/if}}

Team,

Here's the latest update on {{project_name}}:

**Progress:**
{{#each completed_items}}
✓ {{this}}
{{/each}}

**In Progress:**
{{#each in_progress_items}}
• {{this}}
{{/each}}

**Upcoming:**
{{#each upcoming_items}}
• {{this}}
{{/each}}

{{#if blockers}}
**Blockers:**
{{#each blockers}}
⚠️ {{this}}
{{/each}}
{{/if}}

{{#if metrics}}
**Key Metrics:**
{{metrics}}
{{/if}}

{{#if next_milestone}}
Next milestone: {{next_milestone}}
{{/if}}

{{#if questions}}
{{questions}}
{{/if}}

{{closing}},
{{sender_name}}`,
    variables: ['project_name', 'date', 'completed_items', 'in_progress_items', 'upcoming_items', 'blockers', 'metrics', 'next_milestone', 'questions', 'closing', 'sender_name'],
    description: 'Provide project status update',
    tags: ['status', 'update', 'project'],
  },

  feedback_request: {
    name: 'Feedback Request',
    category: 'request',
    template: `Hi {{recipient_name}},

I hope you're doing well. I'm reaching out to request your feedback on {{subject_matter}}.

{{#if context}}
{{context}}
{{/if}}

I would particularly value your input on:
{{#each feedback_areas}}
• {{this}}
{{/each}}

{{#if deadline}}
If possible, I would appreciate your feedback by {{deadline}}{{#if deadline_reason}} as {{deadline_reason}}{{/if}}.
{{/if}}

{{#if format_preference}}
Feel free to share your thoughts {{format_preference}}.
{{/if}}

Your insights would be invaluable in {{purpose}}.

Thank you in advance for your time and consideration.

{{closing}},
{{sender_name}}`,
    variables: ['recipient_name', 'subject_matter', 'context', 'feedback_areas', 'deadline', 'deadline_reason', 'format_preference', 'purpose', 'closing', 'sender_name'],
    description: 'Request feedback professionally',
    tags: ['feedback', 'request', 'professional'],
  },

  complaint_response: {
    name: 'Complaint Response',
    category: 'customer_service',
    template: `Dear {{customer_name}},

Thank you for bringing {{issue}} to our attention. I sincerely apologize for {{apology_reason}}.

I understand how {{impact_acknowledgment}}, and I want to assure you that we take this matter seriously.

{{#if investigation}}
We are currently investigating {{investigation_details}}.
{{/if}}

{{#if resolution}}
To resolve this issue, we will:
{{#each resolution_steps}}
• {{this}}
{{/each}}
{{/if}}

{{#if timeline}}
{{timeline}}
{{/if}}

{{#if compensation}}
As a gesture of goodwill, {{compensation_offer}}.
{{/if}}

We value your {{relationship}} and appreciate your patience as we work to resolve this matter.

{{#if follow_up}}
I will personally follow up with you {{follow_up_timeline}}.
{{/if}}

Please don't hesitate to contact me directly if you have any questions or concerns.

{{closing}},
{{sender_name}}
{{sender_title}}`,
    variables: ['customer_name', 'issue', 'apology_reason', 'impact_acknowledgment', 'investigation', 'investigation_details', 'resolution', 'resolution_steps', 'timeline', 'compensation', 'compensation_offer', 'relationship', 'follow_up', 'follow_up_timeline', 'closing', 'sender_name', 'sender_title'],
    description: 'Respond to customer complaint',
    tags: ['complaint', 'customer_service', 'apology'],
  },

  invoice_reminder: {
    name: 'Invoice Reminder',
    category: 'finance',
    template: `Subject: {{#if reminder_number}}{{reminder_number}} Reminder: {{/if}}Invoice {{invoice_number}} - Payment Due

Dear {{client_name}},

I hope this email finds you well.

This is a friendly reminder that invoice {{invoice_number}} for {{amount}} is {{status}}.

**Invoice Details:**
• Invoice Date: {{invoice_date}}
• Due Date: {{due_date}}
• Amount: {{amount}}
• Description: {{description}}

{{#if payment_methods}}
**Payment Methods:**
{{payment_methods}}
{{/if}}

{{#if late_fee}}
Please note that a late fee of {{late_fee}} may apply after {{late_fee_date}}.
{{/if}}

If you have already sent the payment, please disregard this reminder. If you have any questions about this invoice or need to discuss payment arrangements, please don't hesitate to contact me.

Thank you for your prompt attention to this matter.

{{closing}},
{{sender_name}}
{{#if sender_department}}
{{sender_department}}
{{/if}}`,
    variables: ['reminder_number', 'invoice_number', 'client_name', 'amount', 'status', 'invoice_date', 'due_date', 'description', 'payment_methods', 'late_fee', 'late_fee_date', 'closing', 'sender_name', 'sender_department'],
    description: 'Send invoice payment reminder',
    tags: ['invoice', 'reminder', 'finance'],
  },
};

export class EmailTemplateManager {
  private templates: Map<string, EmailTemplate>;
  private customTemplates: Map<string, EmailTemplate>;

  constructor() {
    this.templates = new Map(Object.entries(emailTemplates));
    this.customTemplates = new Map();
  }

  getTemplate(name: string): EmailTemplate | undefined {
    return this.customTemplates.get(name) || this.templates.get(name);
  }

  getAllTemplates(): EmailTemplate[] {
    const all = [...this.templates.values(), ...this.customTemplates.values()];
    return all;
  }

  getTemplatesByCategory(category: string): EmailTemplate[] {
    return this.getAllTemplates().filter(t => t.category === category);
  }

  getTemplatesByTags(tags: string[]): EmailTemplate[] {
    return this.getAllTemplates().filter(t => 
      tags.some(tag => t.tags.includes(tag))
    );
  }

  addCustomTemplate(template: EmailTemplate): void {
    this.customTemplates.set(template.name, template);
  }

  removeCustomTemplate(name: string): boolean {
    return this.customTemplates.delete(name);
  }

  renderTemplate(templateName: string, variables: Record<string, any>): string {
    const template = this.getTemplate(templateName);
    if (!template) {
      throw new Error(`Template '${templateName}' not found`);
    }

    return this.render(template.template, variables);
  }

  private render(template: string, variables: Record<string, any>): string {
    let rendered = template;

    // Handle conditionals {{#if variable}}...{{/if}}
    rendered = rendered.replace(
      /\{\{#if\s+(\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g,
      (_, variable, content) => {
        return variables[variable] ? content : '';
      }
    );

    // Handle conditionals with else {{#if variable}}...{{else}}...{{/if}}
    rendered = rendered.replace(
      /\{\{#if\s+(\w+)\}\}([\s\S]*?)\{\{else\}\}([\s\S]*?)\{\{\/if\}\}/g,
      (_, variable, ifContent, elseContent) => {
        return variables[variable] ? ifContent : elseContent;
      }
    );

    // Handle loops {{#each array}}...{{/each}}
    rendered = rendered.replace(
      /\{\{#each\s+(\w+)\}\}([\s\S]*?)\{\{\/each\}\}/g,
      (_, arrayName, content) => {
        const array = variables[arrayName];
        if (!Array.isArray(array)) return '';
        
        return array.map(item => {
          let itemContent = content;
          // Replace {{this}} with the current item
          itemContent = itemContent.replace(/\{\{this\}\}/g, String(item));
          return itemContent;
        }).join('');
      }
    );

    // Handle simple variable substitution {{variable}}
    rendered = rendered.replace(
      /\{\{(\w+)\}\}/g,
      (_, variable) => {
        return variables[variable] !== undefined ? String(variables[variable]) : '';
      }
    );

    // Clean up any extra whitespace
    rendered = rendered.replace(/\n{3,}/g, '\n\n');
    
    return rendered.trim();
  }

  validateVariables(templateName: string, variables: Record<string, any>): {
    valid: boolean;
    missing: string[];
    extra: string[];
  } {
    const template = this.getTemplate(templateName);
    if (!template) {
      return { valid: false, missing: [], extra: [] };
    }

    const required = new Set(template.variables);
    const provided = new Set(Object.keys(variables));

    const missing = [...required].filter(v => !provided.has(v));
    const extra = [...provided].filter(v => !required.has(v));

    return {
      valid: missing.length === 0,
      missing,
      extra,
    };
  }

  suggestTemplate(context: {
    subject?: string;
    body?: string;
    intent?: string;
  }): EmailTemplate | undefined {
    const keywords = [
      ...(context.subject?.toLowerCase().split(/\s+/) || []),
      ...(context.body?.toLowerCase().split(/\s+/).slice(0, 20) || []),
    ];

    let bestMatch: { template: EmailTemplate; score: number } | undefined;

    for (const template of this.getAllTemplates()) {
      let score = 0;

      // Check intent match
      if (context.intent && template.tags.includes(context.intent)) {
        score += 10;
      }

      // Check keyword matches in tags
      for (const keyword of keywords) {
        if (template.tags.some(tag => tag.includes(keyword))) {
          score += 2;
        }
        if (template.name.toLowerCase().includes(keyword)) {
          score += 3;
        }
        if (template.description.toLowerCase().includes(keyword)) {
          score += 1;
        }
      }

      if (!bestMatch || score > bestMatch.score) {
        bestMatch = { template, score };
      }
    }

    return bestMatch && bestMatch.score > 5 ? bestMatch.template : undefined;
  }
}