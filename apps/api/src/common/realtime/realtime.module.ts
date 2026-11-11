import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { RealtimeGateway } from './realtime.gateway';
import { RealtimeBridge } from './realtime.bridge';

@Module({
  imports: [JwtModule.register({})],
  providers: [RealtimeGateway, RealtimeBridge],
  exports: [RealtimeGateway],
})
export class RealtimeModule {}
