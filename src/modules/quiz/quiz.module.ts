import { Module } from '@nestjs/common';
import { QuizService } from './quiz.service';

@Module({
  providers: [QuizService],
  exports: [QuizService],
})
export class QuizModule {}
