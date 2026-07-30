import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { StorageProvider } from './storage.types';
import { DbStorageProvider } from './providers/db.storage';
import { S3StorageProvider } from './providers/s3.storage';

/**
 * Object-storage facade. Selects a provider from config (DB blobs by default,
 * S3/R2 when configured) and exposes a stable API so the Files module doesn't
 * care where bytes live.
 */
@Injectable()
export class StorageService {
  private readonly logger = new Logger('Storage');
  private readonly provider: StorageProvider;

  constructor(config: ConfigService, prisma: PrismaService) {
    this.provider = StorageService.select(config, prisma);
    this.logger.log(`storage provider: ${this.provider.name}`);
  }

  private static select(config: ConfigService, prisma: PrismaService): StorageProvider {
    const explicit = config.get<string>('STORAGE_PROVIDER', '');
    const bucket = config.get<string>('S3_BUCKET', '');
    const useS3 = explicit === 's3' || (explicit === '' && Boolean(bucket));
    if (useS3 && bucket) {
      return new S3StorageProvider({
        bucket,
        region: config.get<string>('S3_REGION', 'auto'),
        accessKeyId: config.get<string>('S3_ACCESS_KEY_ID', ''),
        secretAccessKey: config.get<string>('S3_SECRET_ACCESS_KEY', ''),
        endpoint: config.get<string>('S3_ENDPOINT', '') || undefined,
      });
    }
    return new DbStorageProvider(prisma);
  }

  get name(): string {
    return this.provider.name;
  }

  put(key: string, bytes: Buffer, contentType?: string): Promise<void> {
    return this.provider.put(key, bytes, contentType);
  }

  get(key: string): Promise<Buffer | null> {
    return this.provider.get(key);
  }

  remove(key: string): Promise<void> {
    return this.provider.remove(key);
  }

  signedUrl(key: string, filename?: string): Promise<string | null> {
    return this.provider.signedUrl(key, filename);
  }
}
