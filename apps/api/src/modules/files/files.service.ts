import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
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

    const created = await this.prisma.fileObject.create({
      data: {
        organizationId: orgId,
        uploaderId,
        name: file.originalname,
        mimeType: file.mimetype || 'application/octet-stream',
        sizeBytes: file.size,
        storageKey,
        url,
        content: new Uint8Array(file.buffer),
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

  /** Loads the raw bytes for download. */
  async getContent(orgId: string, fileId: string) {
    const file = await this.prisma.fileObject.findFirst({
      where: { id: fileId, organizationId: orgId },
      select: { name: true, mimeType: true, content: true },
    });
    if (!file) throw new NotFoundException('File not found');
    return file;
  }

  async remove(orgId: string, actorId: string, fileId: string) {
    const file = await this.prisma.fileObject.findFirst({
      where: { id: fileId, organizationId: orgId },
      select: { id: true },
    });
    if (!file) throw new NotFoundException('File not found');
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
