export interface UploadResult {
  url: string;
  path: string;
}

export interface IStorageProvider {
  upload(file: Express.Multer.File, path: string): Promise<UploadResult>;
  delete(path: string): Promise<void>;
  getSignedUrl(path: string, expiresIn?: number): Promise<string>;
}

export const STORAGE_PROVIDER = 'STORAGE_PROVIDER';
