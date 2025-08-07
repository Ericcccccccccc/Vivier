import crypto from 'crypto';
import { EmailAddress } from '../interface';

export class EmailParser {
  /**
   * Parse a single email address string
   */
  static parseEmailAddress(raw: string): EmailAddress {
    if (!raw) {
      return { email: 'unknown@unknown.com' };
    }

    // Handle "Name <email@domain.com>" format
    const match = raw.match(/^(.*?)\s*<(.+?)>$/);
    if (match) {
      return {
        name: match[1].replace(/"/g, '').trim() || undefined,
        email: match[2].toLowerCase().trim(),
      };
    }

    // Handle plain email address
    const email = raw.toLowerCase().trim();
    if (this.isValidEmail(email)) {
      return { email };
    }

    return { email: 'unknown@unknown.com' };
  }

  /**
   * Parse multiple email addresses from a string or array
   */
  static parseEmailAddresses(raw: string | string[] | undefined): EmailAddress[] {
    if (!raw) return [];

    const addresses = Array.isArray(raw) 
      ? raw 
      : raw.split(/[,;]/).map(s => s.trim()).filter(Boolean);

    return addresses.map(addr => this.parseEmailAddress(addr));
  }

  /**
   * Validate email address format
   */
  static isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Convert HTML to plain text
   */
  static htmlToText(html: string): string {
    if (!html) return '';

    return html
      // Remove script and style elements
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
      // Replace BR tags with newlines
      .replace(/<br\s*\/?>/gi, '\n')
      // Replace paragraph and div endings with double newlines
      .replace(/<\/(p|div)>/gi, '\n\n')
      // Replace list items with bullet points
      .replace(/<li>/gi, '• ')
      .replace(/<\/li>/gi, '\n')
      // Remove all remaining HTML tags
      .replace(/<[^>]+>/g, '')
      // Decode HTML entities
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#039;/g, "'")
      .replace(/&#x27;/g, "'")
      .replace(/&#x2F;/g, '/')
      .replace(/&#(\d+);/g, (match, dec) => String.fromCharCode(dec))
      // Clean up extra whitespace
      .replace(/\n\s*\n\s*\n/g, '\n\n')
      .replace(/^\s+|\s+$/g, '')
      .trim();
  }

  /**
   * Extract thread ID from email headers or generate from subject
   */
  static extractThreadId(subject: string, references?: string[]): string {
    if (references && references.length > 0) {
      return references[0];
    }

    // Normalize subject for thread grouping
    const normalizedSubject = subject
      .replace(/^(Re|RE|Fwd|FWD|Fw|FW):\s*/gi, '')
      .replace(/^\[.*?\]\s*/, '') // Remove tags like [URGENT]
      .trim()
      .toLowerCase();

    return crypto
      .createHash('md5')
      .update(normalizedSubject)
      .digest('hex');
  }

  /**
   * Detect language from text content
   */
  static detectLanguage(text: string): string {
    if (!text) return 'en';

    // Simple language detection based on character sets
    const patterns = [
      { lang: 'zh', regex: /[\u4e00-\u9fa5]/ }, // Chinese
      { lang: 'ja', regex: /[\u3040-\u309f\u30a0-\u30ff]/ }, // Japanese
      { lang: 'ko', regex: /[\uac00-\ud7af]/ }, // Korean
      { lang: 'ar', regex: /[\u0600-\u06ff]/ }, // Arabic
      { lang: 'he', regex: /[\u0590-\u05ff]/ }, // Hebrew
      { lang: 'ru', regex: /[\u0400-\u04ff]/ }, // Cyrillic
      { lang: 'el', regex: /[\u0370-\u03ff]/ }, // Greek
      { lang: 'th', regex: /[\u0e00-\u0e7f]/ }, // Thai
      { lang: 'hi', regex: /[\u0900-\u097f]/ }, // Hindi
    ];

    for (const { lang, regex } of patterns) {
      if (regex.test(text)) {
        return lang;
      }
    }

    // Check for common European language patterns
    const words = text.toLowerCase().split(/\s+/).slice(0, 100);
    
    const languageIndicators: Record<string, string[]> = {
      'es': ['el', 'la', 'de', 'que', 'en', 'un', 'por', 'con', 'para', 'es'],
      'fr': ['le', 'de', 'un', 'la', 'et', 'est', 'pour', 'que', 'une', 'dans'],
      'de': ['der', 'die', 'und', 'in', 'das', 'von', 'zu', 'mit', 'ist', 'auf'],
      'it': ['il', 'di', 'e', 'la', 'che', 'un', 'per', 'con', 'del', 'è'],
      'pt': ['o', 'de', 'e', 'a', 'que', 'do', 'da', 'em', 'um', 'para'],
      'nl': ['de', 'het', 'een', 'van', 'en', 'in', 'is', 'op', 'aan', 'met'],
    };

    const scores: Record<string, number> = {};
    
    for (const [lang, indicators] of Object.entries(languageIndicators)) {
      scores[lang] = words.filter(word => indicators.includes(word)).length;
    }

    const detectedLang = Object.entries(scores)
      .sort(([, a], [, b]) => b - a)[0];

    if (detectedLang && detectedLang[1] > 3) {
      return detectedLang[0];
    }

    return 'en';
  }

  /**
   * Extract email signature
   */
  static extractSignature(body: string): { content: string; signature?: string } {
    if (!body) return { content: '' };

    // Common signature markers
    const markers = [
      /^--\s*$/m,
      /^_{3,}\s*$/m,
      /^-{3,}\s*$/m,
      /^Best regards,?\s*$/mi,
      /^Kind regards,?\s*$/mi,
      /^Sincerely,?\s*$/mi,
      /^Thanks,?\s*$/mi,
      /^Thank you,?\s*$/mi,
      /^Regards,?\s*$/mi,
      /^Cheers,?\s*$/mi,
      /^Best,?\s*$/mi,
      /^Sent from my (iPhone|iPad|Android|Windows Phone)/mi,
      /^Get Outlook for/mi,
    ];

    let earliestIndex = body.length;
    
    for (const marker of markers) {
      const match = body.match(marker);
      if (match && match.index !== undefined && match.index < earliestIndex) {
        earliestIndex = match.index;
      }
    }

    if (earliestIndex < body.length) {
      return {
        content: body.substring(0, earliestIndex).trim(),
        signature: body.substring(earliestIndex).trim(),
      };
    }

    // Look for patterns that might indicate a signature
    const lines = body.split('\n');
    const reversedLines = [...lines].reverse();
    
    let signatureStart = -1;
    let emptyLineCount = 0;
    
    for (let i = 0; i < reversedLines.length && i < 15; i++) {
      const line = reversedLines[i].trim();
      
      if (line === '') {
        emptyLineCount++;
        if (emptyLineCount >= 2) break;
      } else {
        emptyLineCount = 0;
        
        // Check if line looks like contact info
        if (
          /^\+?\d[\d\s()-]+$/.test(line) || // Phone number
          /^[\w._%+-]+@[\w.-]+\.[A-Za-z]{2,}$/.test(line) || // Email
          /^(www\.)?[\w.-]+\.[A-Za-z]{2,}/.test(line) || // Website
          /^[A-Z][a-z]+ [A-Z][a-z]+/.test(line) // Name
        ) {
          signatureStart = lines.length - i - 1;
        }
      }
    }

    if (signatureStart > 0 && signatureStart < lines.length - 1) {
      return {
        content: lines.slice(0, signatureStart).join('\n').trim(),
        signature: lines.slice(signatureStart).join('\n').trim(),
      };
    }

    return { content: body };
  }

  /**
   * Extract quoted text from replies
   */
  static extractQuotedText(body: string): { content: string; quoted?: string } {
    if (!body) return { content: '' };

    // Common quote markers
    const quoteMarkers = [
      /^On .+ wrote:$/m,
      /^Le .+ a écrit :$/m,
      /^Am .+ schrieb:$/m,
      /^From:\s*.*$/m,
      /^----+ Original Message ----+$/m,
      /^----+ Forwarded Message ----+$/m,
      /^>{1,}/m,
    ];

    let earliestIndex = body.length;
    
    for (const marker of quoteMarkers) {
      const match = body.match(marker);
      if (match && match.index !== undefined && match.index < earliestIndex) {
        earliestIndex = match.index;
      }
    }

    if (earliestIndex < body.length) {
      return {
        content: body.substring(0, earliestIndex).trim(),
        quoted: body.substring(earliestIndex).trim(),
      };
    }

    return { content: body };
  }

  /**
   * Parse email headers into a map
   */
  static parseHeaders(headers: Array<{ name: string; value: string }>): Map<string, string> {
    const headerMap = new Map<string, string>();
    
    for (const header of headers) {
      if (header.name && header.value) {
        headerMap.set(header.name.toLowerCase(), header.value);
      }
    }
    
    return headerMap;
  }

  /**
   * Extract domain from email address
   */
  static extractDomain(email: string): string {
    const parts = email.toLowerCase().split('@');
    return parts.length === 2 ? parts[1] : '';
  }

  /**
   * Sanitize email subject
   */
  static sanitizeSubject(subject: string): string {
    if (!subject) return '(No Subject)';
    
    return subject
      .replace(/[\r\n]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim() || '(No Subject)';
  }

  /**
   * Extract reply/forward indicators from subject
   */
  static extractSubjectIndicators(subject: string): {
    isReply: boolean;
    isForward: boolean;
    cleanSubject: string;
  } {
    const replyRegex = /^(Re|RE):\s*/;
    const forwardRegex = /^(Fwd|FWD|Fw|FW):\s*/;
    
    let cleanSubject = subject;
    let isReply = false;
    let isForward = false;
    
    // Remove all reply/forward indicators
    while (replyRegex.test(cleanSubject) || forwardRegex.test(cleanSubject)) {
      if (replyRegex.test(cleanSubject)) {
        isReply = true;
        cleanSubject = cleanSubject.replace(replyRegex, '');
      }
      if (forwardRegex.test(cleanSubject)) {
        isForward = true;
        cleanSubject = cleanSubject.replace(forwardRegex, '');
      }
    }
    
    return {
      isReply,
      isForward,
      cleanSubject: cleanSubject.trim(),
    };
  }

  /**
   * Extract attachments info from multipart message
   */
  static parseAttachmentInfo(contentType: string, contentDisposition?: string): {
    filename?: string;
    mimeType: string;
    isInline: boolean;
  } {
    const mimeType = contentType.split(';')[0].trim();
    let filename: string | undefined;
    let isInline = false;

    // Extract filename from Content-Type
    const nameMatch = contentType.match(/name=["']?([^"';]+)["']?/i);
    if (nameMatch) {
      filename = nameMatch[1];
    }

    // Extract filename from Content-Disposition
    if (contentDisposition) {
      const filenameMatch = contentDisposition.match(/filename=["']?([^"';]+)["']?/i);
      if (filenameMatch) {
        filename = filenameMatch[1];
      }
      
      isInline = contentDisposition.toLowerCase().includes('inline');
    }

    return {
      filename,
      mimeType,
      isInline,
    };
  }
}