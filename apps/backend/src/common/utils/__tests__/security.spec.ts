import { validateFile, sanitizeFileName } from '../file-security.util';
import { encryptApiKey, decryptApiKey, maskSecret } from '../encryption.util';

describe('File Security', () => {
  describe('validateFile', () => {
    it('accepts valid PDF under size limit', () => {
      const result = validateFile('document.pdf', 'application/pdf', 1024 * 1024);
      expect(result.valid).toBe(true);
    });

    it('rejects executable files', () => {
      const result = validateFile('malware.exe', 'application/octet-stream', 100);
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('.exe');
    });

    it('rejects files exceeding 50MB', () => {
      const result = validateFile('big.pdf', 'application/pdf', 51 * 1024 * 1024);
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('size');
    });

    it('rejects disallowed MIME type', () => {
      const result = validateFile('file.pdf', 'application/x-shockwave-flash', 100);
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('MIME type');
    });

    it('rejects script files', () => {
      const result = validateFile('attack.js', 'text/javascript', 100);
      expect(result.valid).toBe(false);
    });

    it('accepts docx files', () => {
      const result = validateFile('draft.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 500000);
      expect(result.valid).toBe(true);
    });
  });

  describe('sanitizeFileName', () => {
    it('removes special characters', () => {
      const result = sanitizeFileName('my file<script>.pdf');
      expect(result).not.toContain('<');
      expect(result).not.toContain('>');
      expect(result.endsWith('.pdf')).toBe(true);
    });

    it('preserves allowed characters', () => {
      expect(sanitizeFileName('annual_report-2024.pdf')).toBe('annual_report-2024.pdf');
    });
  });
});

describe('Encryption Utility', () => {
  it('encrypts and decrypts API keys round-trip', () => {
    const original = 'sk-test-1234567890abcdef';
    const encrypted = encryptApiKey(original);
    expect(encrypted).not.toBe(original);
    const decrypted = decryptApiKey(encrypted);
    expect(decrypted).toBe(original);
  });

  it('produces different ciphertext each time (random IV)', () => {
    const key = 'test-api-key-12345';
    const enc1 = encryptApiKey(key);
    const enc2 = encryptApiKey(key);
    expect(enc1).not.toBe(enc2);
  });

  it('masks secrets correctly', () => {
    const masked = maskSecret('sk-abcdefghijklmnop');
    expect(masked).toContain('****');
    expect(masked.startsWith('sk-a')).toBe(true);
    expect(masked.endsWith('mnop')).toBe(true);
  });

  it('masks short values safely', () => {
    expect(maskSecret('abc')).toBe('****');
  });
});
