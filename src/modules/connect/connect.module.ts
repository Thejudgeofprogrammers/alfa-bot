import { Module } from '@nestjs/common';
import { ConnectService } from './connect.service';
import { ConnectUpdate } from './connect.update';
import { TelegrafModule } from 'nestjs-telegraf';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { UserModule } from '../user/user.module';
import { QuizModule } from '../quiz/quiz.module';
import { session } from 'telegraf';

@Module({
  imports: [
    QuizModule,
    UserModule,
    ConfigModule,
    TelegrafModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        token: configService.get<string>('TELEGRAM_BOT_TOKEN'),
        middlewares: [session()],
      }),
    }),
  ],
  providers: [ConnectService, ConnectUpdate],
})
export class ConnectModule {}
