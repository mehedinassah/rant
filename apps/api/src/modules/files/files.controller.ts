import {
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Body,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { FilesService } from './files.service';
import { MAX_FILE_BYTES, UploadedFileLike } from './files.constants';

@Controller('organizations/:orgId/files')
export class FilesController {
  constructor(private readonly files: FilesService) {}

  @Post()
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_FILE_BYTES } }))
  upload(
    @Param('orgId') orgId: string,
    @CurrentUser('userId') userId: string,
    @UploadedFile() file: UploadedFileLike | undefined,
    @Body() body: { targetType?: string; targetId?: string },
  ) {
    return this.files.store(orgId, userId, file, {
      targetType: body?.targetType,
      targetId: body?.targetId,
    });
  }

  @Get()
  list(
    @Param('orgId') orgId: string,
    @Query('targetType') targetType?: string,
    @Query('targetId') targetId?: string,
  ) {
    return this.files.list(orgId, { targetType, targetId });
  }

  @Get(':fileId')
  get(@Param('orgId') orgId: string, @Param('fileId') fileId: string) {
    return this.files.get(orgId, fileId);
  }

  @Get(':fileId/download')
  async download(
    @Param('orgId') orgId: string,
    @Param('fileId') fileId: string,
    @Res() res: Response,
  ) {
    const file = await this.files.getContent(orgId, fileId);
    const buf = Buffer.from(file.content);
    res.set({
      'Content-Type': file.mimeType,
      'Content-Disposition': `attachment; filename="${file.name.replace(/"/g, '')}"`,
      'Content-Length': String(buf.length),
    });
    res.send(buf);
  }

  @Delete(':fileId')
  remove(
    @Param('orgId') orgId: string,
    @Param('fileId') fileId: string,
    @CurrentUser('userId') userId: string,
  ) {
    return this.files.remove(orgId, userId, fileId);
  }
}
