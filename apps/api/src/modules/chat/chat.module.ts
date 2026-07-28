import { Module } from '@nestjs/common';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { ChatListeners } from './chat.listeners';

@Module({
  controllers: [ChatController],
  providers: [ChatService, ChatListeners],
})
export class ChatModule {}
