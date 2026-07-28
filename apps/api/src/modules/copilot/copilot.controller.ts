import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CopilotService } from './copilot.service';
import { AskDto } from './dto/copilot.dto';

@Controller('organizations/:orgId/copilot')
export class CopilotController {
  constructor(private readonly copilot: CopilotService) {}

  @Get('suggestions')
  suggestions() {
    return this.copilot.suggestions();
  }

  @Get('conversations')
  list(@Param('orgId') orgId: string, @CurrentUser('userId') userId: string) {
    return this.copilot.listConversations(orgId, userId);
  }

  @Get('conversations/:id')
  get(
    @Param('orgId') orgId: string,
    @Param('id') id: string,
    @CurrentUser('userId') userId: string,
  ) {
    return this.copilot.getConversation(orgId, userId, id);
  }

  @Delete('conversations/:id')
  remove(
    @Param('orgId') orgId: string,
    @Param('id') id: string,
    @CurrentUser('userId') userId: string,
  ) {
    return this.copilot.deleteConversation(orgId, userId, id);
  }

  @Post('ask')
  ask(
    @Param('orgId') orgId: string,
    @CurrentUser('userId') userId: string,
    @Body() dto: AskDto,
  ) {
    return this.copilot.ask(orgId, userId, dto.message, dto.conversationId);
  }
}
