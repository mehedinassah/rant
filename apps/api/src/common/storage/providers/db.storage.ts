import { PrismaService } from '../../prisma/prisma.service';
import { StorageProvider } from '../storage.types';

/** Default provider: bytes live in the storage_blobs table. Streamed back
 * through the API, so signedUrl is null. */
export class DbStorageProvider implements StorageProvider {
  readonly name = 'db';

  constructor(private readonly prisma: PrismaService) {}

  async put(key: string, bytes: Buffer, contentType?: string): Promise<void> {
    const content = new Uint8Array(bytes);
    await this.prisma.storageBlob.upsert({
      where: { key },
      create: { key, content, contentType: contentType ?? null, sizeBytes: bytes.length },
      update: { content, contentType: contentType ?? null, sizeBytes: bytes.length },
    });
  }

  async get(key: string): Promise<Buffer | null> {
    const blob = await this.prisma.storageBlob.findUnique({
      where: { key },
      select: { content: true },
    });
    return blob ? Buffer.from(blob.content) : null;
  }

  async remove(key: string): Promise<void> {
    await this.prisma.storageBlob.deleteMany({ where: { key } });
  }

  async signedUrl(): Promise<string | null> {
    return null;
  }
}
