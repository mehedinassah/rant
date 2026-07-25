import { Module } from '@nestjs/common';
import { ProjectsModule } from '../projects/projects.module';
import { IssuesController } from './issues.controller';
import { IssuesService } from './issues.service';
import { CommentsController } from './comments.controller';
import { CommentsService } from './comments.service';

@Module({
  imports: [ProjectsModule],
  controllers: [IssuesController, CommentsController],
  providers: [IssuesService, CommentsService],
})
export class IssuesModule {}
