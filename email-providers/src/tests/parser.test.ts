import { EmailParser } from '../utils/parser';

describe('EmailParser', () => {
  describe('parseEmailAddress', () => {
    it('should parse email with name', () => {
      const result = EmailParser.parseEmailAddress('John Doe <john@example.com>');
      expect(result).toEqual({
        email: 'john@example.com',
        name: 'John Doe',
      });
    });

    it('should parse email with quoted name', () => {
      const result = EmailParser.parseEmailAddress('"Doe, John" <john@example.com>');
      expect(result).toEqual({
        email: 'john@example.com',
        name: 'Doe, John',
      });
    });

    it('should parse plain email address', () => {
      const result = EmailParser.parseEmailAddress('john@example.com');
      expect(result).toEqual({
        email: 'john@example.com',
      });
    });

    it('should handle invalid email', () => {
      const result = EmailParser.parseEmailAddress('invalid-email');
      expect(result).toEqual({
        email: 'unknown@unknown.com',
      });
    });

    it('should handle empty string', () => {
      const result = EmailParser.parseEmailAddress('');
      expect(result).toEqual({
        email: 'unknown@unknown.com',
      });
    });
  });

  describe('parseEmailAddresses', () => {
    it('should parse multiple comma-separated addresses', () => {
      const result = EmailParser.parseEmailAddresses('john@example.com, jane@example.com');
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ email: 'john@example.com' });
      expect(result[1]).toEqual({ email: 'jane@example.com' });
    });

    it('should parse array of addresses', () => {
      const result = EmailParser.parseEmailAddresses(['john@example.com', 'Jane Doe <jane@example.com>']);
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ email: 'john@example.com' });
      expect(result[1]).toEqual({ email: 'jane@example.com', name: 'Jane Doe' });
    });

    it('should handle undefined input', () => {
      const result = EmailParser.parseEmailAddresses(undefined);
      expect(result).toEqual([]);
    });
  });

  describe('htmlToText', () => {
    it('should convert basic HTML to text', () => {
      const html = '<p>Hello</p><p>World</p>';
      const result = EmailParser.htmlToText(html);
      expect(result).toBe('Hello\n\nWorld');
    });

    it('should handle line breaks', () => {
      const html = 'Line 1<br>Line 2<br/>Line 3';
      const result = EmailParser.htmlToText(html);
      expect(result).toBe('Line 1\nLine 2\nLine 3');
    });

    it('should convert list items', () => {
      const html = '<ul><li>Item 1</li><li>Item 2</li></ul>';
      const result = EmailParser.htmlToText(html);
      expect(result).toBe('• Item 1\n• Item 2');
    });

    it('should decode HTML entities', () => {
      const html = '&lt;div&gt; &amp; &quot;text&quot; &#39;here&#39;';
      const result = EmailParser.htmlToText(html);
      expect(result).toBe('<div> & "text" \'here\'');
    });

    it('should remove script and style tags', () => {
      const html = '<script>alert("test")</script><style>body{color:red}</style><p>Content</p>';
      const result = EmailParser.htmlToText(html);
      expect(result).toBe('Content');
    });
  });

  describe('detectLanguage', () => {
    it('should detect Chinese', () => {
      const result = EmailParser.detectLanguage('这是中文文本');
      expect(result).toBe('zh');
    });

    it('should detect Japanese', () => {
      const result = EmailParser.detectLanguage('これは日本語のテキストです');
      expect(result).toBe('ja');
    });

    it('should detect Arabic', () => {
      const result = EmailParser.detectLanguage('هذا نص عربي');
      expect(result).toBe('ar');
    });

    it('should detect Spanish', () => {
      const result = EmailParser.detectLanguage('Este es un texto en español con muchas palabras para detectar el idioma');
      expect(result).toBe('es');
    });

    it('should default to English', () => {
      const result = EmailParser.detectLanguage('This is English text');
      expect(result).toBe('en');
    });
  });

  describe('extractSignature', () => {
    it('should extract signature with common marker', () => {
      const body = 'Main content\n\nBest regards,\nJohn Doe\nCEO';
      const result = EmailParser.extractSignature(body);
      expect(result.content).toBe('Main content');
      expect(result.signature).toBe('Best regards,\nJohn Doe\nCEO');
    });

    it('should extract signature with dash separator', () => {
      const body = 'Main content\n\n--\nJohn Doe\njohn@example.com';
      const result = EmailParser.extractSignature(body);
      expect(result.content).toBe('Main content');
      expect(result.signature).toBe('--\nJohn Doe\njohn@example.com');
    });

    it('should detect mobile signatures', () => {
      const body = 'Quick reply\n\nSent from my iPhone';
      const result = EmailParser.extractSignature(body);
      expect(result.content).toBe('Quick reply');
      expect(result.signature).toBe('Sent from my iPhone');
    });

    it('should return full body when no signature found', () => {
      const body = 'This is just regular content without any signature';
      const result = EmailParser.extractSignature(body);
      expect(result.content).toBe(body);
      expect(result.signature).toBeUndefined();
    });
  });

  describe('extractThreadId', () => {
    it('should use first reference if available', () => {
      const result = EmailParser.extractThreadId('Subject', ['ref1', 'ref2']);
      expect(result).toBe('ref1');
    });

    it('should generate from normalized subject', () => {
      const result1 = EmailParser.extractThreadId('Re: Important Topic');
      const result2 = EmailParser.extractThreadId('RE: Important Topic');
      const result3 = EmailParser.extractThreadId('Important Topic');
      
      expect(result1).toBe(result2);
      expect(result2).toBe(result3);
    });

    it('should remove forward indicators', () => {
      const result1 = EmailParser.extractThreadId('Fwd: Meeting Notes');
      const result2 = EmailParser.extractThreadId('FW: Meeting Notes');
      const result3 = EmailParser.extractThreadId('Meeting Notes');
      
      expect(result1).toBe(result2);
      expect(result2).toBe(result3);
    });
  });

  describe('extractSubjectIndicators', () => {
    it('should detect reply', () => {
      const result = EmailParser.extractSubjectIndicators('Re: Meeting tomorrow');
      expect(result.isReply).toBe(true);
      expect(result.isForward).toBe(false);
      expect(result.cleanSubject).toBe('Meeting tomorrow');
    });

    it('should detect forward', () => {
      const result = EmailParser.extractSubjectIndicators('Fwd: Important document');
      expect(result.isReply).toBe(false);
      expect(result.isForward).toBe(true);
      expect(result.cleanSubject).toBe('Important document');
    });

    it('should handle multiple indicators', () => {
      const result = EmailParser.extractSubjectIndicators('Re: Fwd: Re: Original subject');
      expect(result.isReply).toBe(true);
      expect(result.isForward).toBe(true);
      expect(result.cleanSubject).toBe('Original subject');
    });

    it('should handle no indicators', () => {
      const result = EmailParser.extractSubjectIndicators('Regular subject');
      expect(result.isReply).toBe(false);
      expect(result.isForward).toBe(false);
      expect(result.cleanSubject).toBe('Regular subject');
    });
  });
});