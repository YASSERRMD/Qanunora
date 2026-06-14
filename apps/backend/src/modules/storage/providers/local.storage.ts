import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as fsp from 'fs/promises';
import * as nodePath from 'path';
import { IStorageProvider, UploadResult } from '../storage.interface';

@Injectable()
export class LocalStorageProvider implements IStorageProvider {
  private readonly logger = new Logger(LocalStorageProvider.name);
  private readonly storageDir: string;

  constructor() {
    this.storageDir = process.env.STORAGE_LOCAL_DIR ?? nodePath.join(process.cwd(), 'uploads');
    if (!fs.existsSync(this.storageDir)) {
      fs.mkdirSync(this.storageDir, { recursive: true });
    }
  }

  async upload(file: Express.Multer.File, filePath: string): Promise<UploadResult> {
    const fullPath = nodePath.join(this.storageDir, filePath);
    const dir = nodePath.dirname(fullPath);

    await fsp.mkdir(dir, { recursive: true });
    await fsp.writeFile(fullPath, file.buffer);

    this.logger.log(`File stored at: ${fullPath}`);

    return {
      url: `/uploads/${filePath.replace(/\\/g, '/')}`,
      path: filePath,
    };
  }

  async delete(filePath: string): Promise<void> {
    const fullPath = nodePath.join(this.storageDir, filePath);
    try {
      await fsp.unlink(fullPath);
      this.logger.log(`Deleted file: ${fullPath}`);
    } catch (err: unknown) {
      const error = err as NodeJS.ErrnoException;
      if (error.code !== 'ENOENT') throw err;
    }
  }

  async getSignedUrl(filePath: string, expiresIn = 3600): Promise<string> {
    // For local storage, return a direct URL with an expiry hint in the query string
    const expires = Math.floor(Date.now() / 1000) + expiresIn;
    return `/uploads/${filePath.replace(/\\/g, '/')}?expires=${expires}`;
  }
}
