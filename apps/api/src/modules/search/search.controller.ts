import { Body, Controller, Delete, Get, Param, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { SearchService, SearchType } from './search.service';
import { CreateSavedSearchDto } from './dto/search.dto';

@Controller('organizations/:orgId/search')
export class SearchController {
  constructor(private readonly search: SearchService) {}

  @Get()
  run(
    @Param('orgId') orgId: string,
    @Query('q') q = '',
    @Query('types') types?: string,
    @Query('limit') limit?: string,
  ) {
    const parsed = types
      ? (types.split(',').map((t) => t.trim()).filter(Boolean) as SearchType[])
      : undefined;
    return this.search.search(orgId, q, {
      types: parsed,
      perType: limit ? Number(limit) : undefined,
    });
  }

  @Get('saved')
  listSaved(@Param('orgId') orgId: string, @CurrentUser('userId') userId: string) {
    return this.search.listSaved(orgId, userId);
  }

  @Post('saved')
  createSaved(
    @Param('orgId') orgId: string,
    @CurrentUser('userId') userId: string,
    @Body() dto: CreateSavedSearchDto,
  ) {
    return this.search.createSaved(orgId, userId, dto);
  }

  @Delete('saved/:id')
  removeSaved(
    @Param('orgId') orgId: string,
    @Param('id') id: string,
    @CurrentUser('userId') userId: string,
  ) {
    return this.search.removeSaved(orgId, userId, id);
  }
}
