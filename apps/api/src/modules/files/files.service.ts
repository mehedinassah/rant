import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { StorageService } from '../../common/storage/storage.service';
import { MAX_FILE_BYTES, UploadedFileLike, makeStorageRef } from './files.constants';

const META_SELECT = {
  id: true,
  name: true,
  mimeType: true,
  sizeBytes: true,
  storageKey: true,
  url: true,
  targetType: true,
  targetId: true,
  createdAt: true,
  uploader: { select: { id: true, name: true, avatarUrl: true } },
};

@Injectable()
export class FilesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly storage: StorageService,
  ) {}

  async store(
    orgId: string,
    uploaderId: string,
    file: UploadedFileLike | undefined,
    target?: { targetType?: string; targetId?: string },
  ) {
    if (!file) throw new BadRequestException('No file provided (expected multipart field "file")');
    if (file.size > MAX_FILE_BYTES) {
      throw new BadRequestException(`File exceeds the ${MAX_FILE_BYTES / (1024 * 1024)}MB limit`);
    }
    const { storageKey, url } = makeStorageRef(file.originalname);
    const mimeType = file.mimetype || 'application/octet-stream';

    // Bytes go to the selected storage backend (DB blob store or S3/R2), not
    // inline on the row.
    await this.storage.put(storageKey, file.buffer, mimeType);

    const created = await this.prisma.fileObject.create({
      data: {
        organizationId: orgId,
        uploaderId,
        name: file.originalname,
        mimeType,
        sizeBytes: file.size,
        storageKey,
        url,
        storageProvider: this.storage.name,
        targetType: target?.targetType || null,
        targetId: target?.targetId || null,
      },
      select: META_SELECT,
    });

    await this.audit.record({
      organizationId: orgId,
      actorId: uploaderId,
      action: 'file.uploaded',
      targetType: 'FileObject',
      targetId: created.id,
      metadata: { name: file.originalname, sizeBytes: file.size },
    });
    return created;
  }

  list(orgId: string, target?: { targetType?: string; targetId?: string }) {
    return this.prisma.fileObject.findMany({
      where: {
        organizationId: orgId,
        ...(target?.targetType ? { targetType: target.targetType } : {}),
        ...(target?.targetId ? { targetId: target.targetId } : {}),
      },
      select: META_SELECT,
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async get(orgId: string, fileId: string) {
    const file = await this.prisma.fileObject.findFirst({
      where: { id: fileId, organizationId: orgId },
      select: META_SELECT,
    });
    if (!file) throw new NotFoundException('File not found');
    return file;
  }

  /**
   * Resolves a download. When the provider supports direct URLs (S3/R2) returns
   * a `redirectUrl`; otherwise streams the `bytes` (DB provider). Legacy rows
   * with inline content are still served.
   */
  async getDownload(orgId: string, fileId: string) {
    const file = await this.prisma.fileObject.findFirst({
      where: { id: fileId, organizationId: orgId },
      select: { name: true, mimeType: true, storageKey: true, content: true },
    });
    if (!file) throw new NotFoundException('File not found');

    const redirectUrl = await this.storage.signedUrl(file.storageKey, file.name);
    if (redirectUrl) return { name: file.name, mimeType: file.mimeType, redirectUrl, bytes: null };

    const bytes = file.content
      ? Buffer.from(file.content)
      : await this.storage.get(file.storageKey);
    if (!bytes) throw new NotFoundException('File contents unavailable');
    return { name: file.name, mimeType: file.mimeType, redirectUrl: null, bytes };
  }

  async remove(orgId: string, actorId: string, fileId: string) {
    const file = await this.prisma.fileObject.findFirst({
      where: { id: fileId, organizationId: orgId },
      select: { id: true, storageKey: true },
    });
    if (!file) throw new NotFoundException('File not found');
    await this.storage.remove(file.storageKey).catch(() => undefined);
    await this.prisma.fileObject.delete({ where: { id: fileId } });
    await this.audit.record({
      organizationId: orgId,
      actorId,
      action: 'file.deleted',
      targetType: 'FileObject',
      targetId: fileId,
    });
    return { success: true };
  }
}
