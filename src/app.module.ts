import { Module } from '@nestjs/common';
import { ConnectModule } from './modules/connect/connect.module';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './modules/prisma/prisma.module';
import { QuizModule } from './modules/quiz/quiz.module';
import { UserModule } from './modules/user/user.module';

@Module({
  imports: [
    UserModule,
    PrismaModule,
    QuizModule,
    ConnectModule,
    ConfigModule.forRoot({
      isGlobal: true,
    }),
  ],
})
export class AppModule {}
