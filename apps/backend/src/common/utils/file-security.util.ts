import * as path from 'path';

const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'image/png',
  'image/jpeg',
  'image/jpg',
]);

const ALLOWED_EXTENSIONS = new Set([
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.txt', '.png', '.jpg', '.jpeg',
]);

const DANGEROUS_EXTENSIONS = new Set([
  '.exe', '.bat', '.cmd', '.sh', '.ps1', '.msi', '.dll', '.so',
  '.js', '.ts', '.php', '.py', '.rb', '.pl', '.vbs', '.wsf',
  '.jar', '.class', '.war', '.ear',
]);

const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB

export interface FileValidationResult {
  valid: boolean;
  reason?: string;
}

export function validateFile(
  originalName: string,
  mimeType: string,
  sizeBytes: number,
): FileValidationResult {
  const ext = path.extname(originalName).toLowerCase();

  if (sizeBytes > MAX_FILE_SIZE_BYTES) {
    return { valid: false, reason: `File exceeds maximum size of ${MAX_FILE_SIZE_BYTES / 1024 / 1024}MB` };
  }

  if (DANGEROUS_EXTENSIONS.has(ext)) {
    return { valid: false, reason: `File extension ${ext} is not permitted` };
  }

  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return { valid: false, reason: `File extension ${ext} is not allowed` };
  }

  if (!ALLOWED_MIME_TYPES.has(mimeType)) {
    return { valid: false, reason: `MIME type ${mimeType} is not allowed` };
  }

  // Prevent path traversal in filename
  const basename = path.basename(originalName);
  if (basename !== originalName.replace(/^.*[\\/]/, '')) {
    return { valid: false, reason: 'Invalid file name' };
  }

  return { valid: true };
}

export function sanitizeFileName(originalName: string): string {
  const ext = path.extname(originalName).toLowerCase();
  const base = path.basename(originalName, ext)
    .replace(/[^a-zA-Z0-9_\-. ]/g, '_')
    .replace(/\s+/g, '_')
    .substring(0, 100);
  return `${base}${ext}`;
}
