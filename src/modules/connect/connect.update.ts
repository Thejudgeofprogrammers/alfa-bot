import { Ctx, On, Start, Update } from 'nestjs-telegraf';
import { Context, Markup } from 'telegraf';
import { ConnectService } from './connect.service';
import { ConfigService } from '@nestjs/config';
import { UserService } from '../user/user.service';

@Update()
export class ConnectUpdate {
  constructor(
    private readonly connectService: ConnectService,
    private configService: ConfigService,
    private readonly userService: UserService,
  ) {}

  @Start()
  async onStart(@Ctx() ctx: Context) {
    const { id: telegram_id, username, last_name, first_name } = ctx.from;
    const user = await this.userService.findUser(telegram_id);

    if (!user) {
      await this.userService.createUser({
        telegram_id,
        username,
        last_name,
        first_name,
      });
    }

    await ctx.reply(
      'Добро пожаловать в корпоративного бота Альфа-Банка!',
      Markup.keyboard([
        ['📚 Пройти квиз'],
        ['👤 Коллега недели'],
        ['❓ FAQ'],
        ['🏆 Челлендж недели'],
      ])
        .resize()
        .oneTime(false),
    );
  }

  @On('text')
  async onText(@Ctx() ctx: any) {
    const text = ctx.message.text;

    switch (text) {
      case '📚 Пройти квиз':
        await this.connectService.handleQuiz(ctx);
        break;
      case '👤 Коллега недели':
        await this.connectService.handleColleague(ctx);
        break;
      case '❓ FAQ':
        await this.connectService.handleFAQ(ctx);
        break;
      case '🏆 Челлендж недели':
        await this.connectService.handleChallenge(ctx);
        break;
      default:
        await ctx.reply('Пожалуйста, выбери одну из кнопок на клавиатуре.');
        break;
    }
  }
}
