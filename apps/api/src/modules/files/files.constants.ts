import { randomBytes } from 'node:crypto';

/** Demo cap — real object storage would stream far larger files to S3/R2. */
export const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5 MB

/** Minimal shape of a Multer memory-storage upload (avoids @types/multer). */
export interface UploadedFileLike {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

/** Builds a synthetic storage key + public-looking URL (no real CDN). */
export function makeStorageRef(name: string): { storageKey: string; url: string } {
  const safe = name.replace(/[^a-zA-Z0-9._-]+/g, '-').slice(0, 80) || 'file';
  const storageKey = `files/${randomBytes(8).toString('hex')}/${safe}`;
  return { storageKey, url: `https://cdn.rant.app/${storageKey}` };
}
