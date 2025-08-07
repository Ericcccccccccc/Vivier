import { OutgoingEmail, EmailAddress } from '../interface';

export class EmailFormatter {
  /**
   * Create a MIME message from email data
   */
  static createMimeMessage(email: OutgoingEmail, messageId?: string): string {
    const boundary = `boundary_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const date = new Date().toUTCString();
    
    let message = '';
    
    // Headers
    message += `Message-ID: ${messageId || this.generateMessageId(email.from)}\r\n`;
    message += `Date: ${date}\r\n`;
    message += `From: ${this.formatEmailAddress(email.from)}\r\n`;
    message += `To: ${email.to.map(addr => this.formatEmailAddress(addr)).join(', ')}\r\n`;
    
    if (email.cc && email.cc.length > 0) {
      message += `Cc: ${email.cc.map(addr => this.formatEmailAddress(addr)).join(', ')}\r\n`;
    }
    
    if (email.bcc && email.bcc.length > 0) {
      message += `Bcc: ${email.bcc.map(addr => this.formatEmailAddress(addr)).join(', ')}\r\n`;
    }
    
    message += `Subject: ${this.encodeSubject(email.subject)}\r\n`;
    
    if (email.replyTo) {
      message += `Reply-To: ${this.formatEmailAddress(email.replyTo)}\r\n`;
    }
    
    if (email.inReplyTo) {
      message += `In-Reply-To: ${email.inReplyTo}\r\n`;
    }
    
    if (email.references && email.references.length > 0) {
      message += `References: ${email.references.join(' ')}\r\n`;
    }
    
    message += `MIME-Version: 1.0\r\n`;
    
    // Body
    if (email.attachments && email.attachments.length > 0) {
      // Multipart mixed for attachments
      message += `Content-Type: multipart/mixed; boundary="${boundary}"\r\n\r\n`;
      
      // Add body parts
      const altBoundary = `alt_${boundary}`;
      message += `--${boundary}\r\n`;
      message += `Content-Type: multipart/alternative; boundary="${altBoundary}"\r\n\r\n`;
      
      // Text part
      message += `--${altBoundary}\r\n`;
      message += `Content-Type: text/plain; charset=utf-8\r\n`;
      message += `Content-Transfer-Encoding: quoted-printable\r\n\r\n`;
      message += `${this.encodeQuotedPrintable(email.body.text)}\r\n\r\n`;
      
      // HTML part (if provided)
      if (email.body.html) {
        message += `--${altBoundary}\r\n`;
        message += `Content-Type: text/html; charset=utf-8\r\n`;
        message += `Content-Transfer-Encoding: quoted-printable\r\n\r\n`;
        message += `${this.encodeQuotedPrintable(email.body.html)}\r\n\r\n`;
      }
      
      message += `--${altBoundary}--\r\n`;
      
      // Add attachments
      for (const attachment of email.attachments) {
        message += `--${boundary}\r\n`;
        message += `Content-Type: ${attachment.contentType}; name="${attachment.filename}"\r\n`;
        message += `Content-Transfer-Encoding: base64\r\n`;
        message += `Content-Disposition: attachment; filename="${attachment.filename}"\r\n`;
        
        if (attachment.contentId) {
          message += `Content-ID: <${attachment.contentId}>\r\n`;
        }
        
        message += `\r\n`;
        
        if (attachment.content) {
          message += `${attachment.content.toString('base64').match(/.{1,76}/g)?.join('\r\n')}\r\n`;
        }
        
        message += `\r\n`;
      }
      
      message += `--${boundary}--`;
    } else if (email.body.html) {
      // Multipart alternative for text and HTML
      message += `Content-Type: multipart/alternative; boundary="${boundary}"\r\n\r\n`;
      
      // Text part
      message += `--${boundary}\r\n`;
      message += `Content-Type: text/plain; charset=utf-8\r\n`;
      message += `Content-Transfer-Encoding: quoted-printable\r\n\r\n`;
      message += `${this.encodeQuotedPrintable(email.body.text)}\r\n\r\n`;
      
      // HTML part
      message += `--${boundary}\r\n`;
      message += `Content-Type: text/html; charset=utf-8\r\n`;
      message += `Content-Transfer-Encoding: quoted-printable\r\n\r\n`;
      message += `${this.encodeQuotedPrintable(email.body.html)}\r\n\r\n`;
      
      message += `--${boundary}--`;
    } else {
      // Plain text only
      message += `Content-Type: text/plain; charset=utf-8\r\n`;
      message += `Content-Transfer-Encoding: quoted-printable\r\n\r\n`;
      message += `${this.encodeQuotedPrintable(email.body.text)}`;
    }
    
    return message;
  }

  /**
   * Format a reply email with proper quoting
   */
  static formatReply(
    originalEmail: {
      from: EmailAddress;
      date: Date;
      body: { text: string; html?: string };
    },
    replyText: string,
    includeOriginal: boolean = true
  ): { text: string; html?: string } {
    const formattedDate = originalEmail.date.toLocaleString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
    
    const fromName = originalEmail.from.name || originalEmail.from.email;
    
    let text = replyText;
    let html = `<p>${this.escapeHtml(replyText).replace(/\n/g, '<br>')}</p>`;
    
    if (includeOriginal) {
      const quotedText = originalEmail.body.text
        .split('\n')
        .map(line => `> ${line}`)
        .join('\n');
      
      text += `\n\nOn ${formattedDate}, ${fromName} wrote:\n${quotedText}`;
      
      if (originalEmail.body.html) {
        html += `
          <br><br>
          <div style="border-left: 2px solid #ccc; padding-left: 10px; margin-left: 0;">
            <p>On ${formattedDate}, ${this.escapeHtml(fromName)} wrote:</p>
            ${originalEmail.body.html}
          </div>
        `;
      } else {
        html += `
          <br><br>
          <div style="border-left: 2px solid #ccc; padding-left: 10px; margin-left: 0;">
            <p>On ${formattedDate}, ${this.escapeHtml(fromName)} wrote:</p>
            <p>${this.escapeHtml(originalEmail.body.text).replace(/\n/g, '<br>')}</p>
          </div>
        `;
      }
    }
    
    return { text, html };
  }

  /**
   * Format a forwarded email
   */
  static formatForward(
    originalEmail: {
      from: EmailAddress;
      to: EmailAddress[];
      subject: string;
      date: Date;
      body: { text: string; html?: string };
    },
    forwardText: string
  ): { text: string; html?: string } {
    const formattedDate = originalEmail.date.toLocaleString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
    
    const fromName = originalEmail.from.name || originalEmail.from.email;
    const toNames = originalEmail.to
      .map(addr => addr.name || addr.email)
      .join(', ');
    
    let text = forwardText;
    if (forwardText) {
      text += '\n\n';
    }
    
    text += '---------- Forwarded message ----------\n';
    text += `From: ${fromName}\n`;
    text += `Date: ${formattedDate}\n`;
    text += `Subject: ${originalEmail.subject}\n`;
    text += `To: ${toNames}\n\n`;
    text += originalEmail.body.text;
    
    let html = '';
    if (forwardText) {
      html = `<p>${this.escapeHtml(forwardText).replace(/\n/g, '<br>')}</p><br><br>`;
    }
    
    html += `
      <div style="border: 1px solid #ccc; padding: 10px; margin: 10px 0;">
        <p><strong>---------- Forwarded message ----------</strong></p>
        <p><strong>From:</strong> ${this.escapeHtml(fromName)}<br>
        <strong>Date:</strong> ${formattedDate}<br>
        <strong>Subject:</strong> ${this.escapeHtml(originalEmail.subject)}<br>
        <strong>To:</strong> ${this.escapeHtml(toNames)}</p>
        <br>
    `;
    
    if (originalEmail.body.html) {
      html += originalEmail.body.html;
    } else {
      html += `<p>${this.escapeHtml(originalEmail.body.text).replace(/\n/g, '<br>')}</p>`;
    }
    
    html += '</div>';
    
    return { text, html };
  }

  /**
   * Add signature to email body
   */
  static addSignature(
    body: { text: string; html?: string },
    signature: { text: string; html?: string }
  ): { text: string; html?: string } {
    const text = `${body.text}\n\n--\n${signature.text}`;
    
    let html: string | undefined;
    if (body.html || signature.html) {
      const bodyHtml = body.html || `<p>${this.escapeHtml(body.text).replace(/\n/g, '<br>')}</p>`;
      const sigHtml = signature.html || `<p>${this.escapeHtml(signature.text).replace(/\n/g, '<br>')}</p>`;
      
      html = `${bodyHtml}<br><br><div>--<br>${sigHtml}</div>`;
    }
    
    return { text, html };
  }

  /**
   * Create multipart message structure
   */
  static createMultipart(
    parts: Array<{
      contentType: string;
      content: string;
      encoding?: string;
      headers?: Record<string, string>;
    }>,
    boundary?: string
  ): string {
    const useBoundary = boundary || `boundary_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    let message = '';
    
    for (const part of parts) {
      message += `--${useBoundary}\r\n`;
      message += `Content-Type: ${part.contentType}\r\n`;
      
      if (part.encoding) {
        message += `Content-Transfer-Encoding: ${part.encoding}\r\n`;
      }
      
      if (part.headers) {
        for (const [key, value] of Object.entries(part.headers)) {
          message += `${key}: ${value}\r\n`;
        }
      }
      
      message += `\r\n${part.content}\r\n`;
    }
    
    message += `--${useBoundary}--`;
    
    return message;
  }

  /**
   * Encode attachments to base64
   */
  static encodeAttachments(attachments: Array<{ content: Buffer; filename: string }>): Array<{
    filename: string;
    content: string;
    encoding: string;
  }> {
    return attachments.map(att => ({
      filename: att.filename,
      content: att.content.toString('base64'),
      encoding: 'base64',
    }));
  }

  /**
   * Generate a unique message ID
   */
  private static generateMessageId(from: string): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 9);
    const domain = from.split('@')[1] || 'localhost';
    
    return `<${timestamp}.${random}@${domain}>`;
  }

  /**
   * Format email address for headers
   */
  private static formatEmailAddress(address: string | EmailAddress): string {
    if (typeof address === 'string') {
      return address;
    }
    
    if (address.name) {
      // Encode name if it contains special characters
      const needsEncoding = /[^\x20-\x7E]/.test(address.name);
      const name = needsEncoding 
        ? `=?UTF-8?B?${Buffer.from(address.name).toString('base64')}?=`
        : `"${address.name.replace(/"/g, '\\"')}"`;
      
      return `${name} <${address.email}>`;
    }
    
    return address.email;
  }

  /**
   * Encode subject line for non-ASCII characters
   */
  private static encodeSubject(subject: string): string {
    if (!/[^\x20-\x7E]/.test(subject)) {
      return subject;
    }
    
    return `=?UTF-8?B?${Buffer.from(subject).toString('base64')}?=`;
  }

  /**
   * Encode text using quoted-printable encoding
   */
  private static encodeQuotedPrintable(text: string): string {
    return text
      .replace(/([^\x20-\x7E])/g, (match) => {
        const hex = match.charCodeAt(0).toString(16).toUpperCase();
        return `=${hex.padStart(2, '0')}`;
      })
      .replace(/(.{1,73})(\s|$)/g, '$1\r\n')
      .trim();
  }

  /**
   * Escape HTML special characters
   */
  private static escapeHtml(text: string): string {
    const escapeMap: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    };
    
    return text.replace(/[&<>"']/g, char => escapeMap[char]);
  }

  /**
   * Create a plain text version from HTML
   */
  static createPlainTextFromHtml(html: string): string {
    return html
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<\/div>/gi, '\n')
      .replace(/<li>/gi, '• ')
      .replace(/<\/li>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }
}