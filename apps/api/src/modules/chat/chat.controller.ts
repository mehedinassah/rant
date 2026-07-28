import { Body, Controller, Get, Param, Post, Sse } from '@nestjs/common';
import type { Observable } from 'rxjs';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ChatService } from './chat.service';
import { CreateChannelDto, PostMessageDto } from './dto/chat.dto';

@Controller('organizations/:orgId/channels')
export class ChatController {
  constructor(private readonly chat: ChatService) {}

  @Get()
  list(@Param('orgId') orgId: string) {
    return this.chat.listChannels(orgId);
  }

  @Post()
  create(@Param('orgId') orgId: string, @Body() dto: CreateChannelDto) {
    return this.chat.createChannel(orgId, dto);
  }

  @Get(':channelId/messages')
  messages(@Param('orgId') orgId: string, @Param('channelId') channelId: string) {
    return this.chat.listMessages(orgId, channelId);
  }

  @Post(':channelId/messages')
  post(
    @Param('orgId') orgId: string,
    @Param('channelId') channelId: string,
    @CurrentUser('userId') userId: string,
    @Body() dto: PostMessageDto,
  ) {
    return this.chat.postMessage(orgId, channelId, userId, dto.body);
  }

  /** Server-Sent Events: live message thread for a channel. */
  @Sse(':channelId/stream')
  stream(@Param('orgId') orgId: string, @Param('channelId') channelId: string): Observable<MessageEvent> {
    return this.chat.stream(orgId, channelId);
  }
}
