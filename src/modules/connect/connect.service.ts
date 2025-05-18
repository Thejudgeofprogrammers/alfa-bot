import { Injectable } from '@nestjs/common';
import { Context, Markup } from 'telegraf';

@Injectable()
export class ConnectService {
  async handleQuiz(ctx: Context) {
    await ctx.reply('🔍 Заглушка: здесь будет квиз.');
  }

  async handleColleague(ctx: Context) {
    await ctx.replyWithPhoto('https://i.pravatar.cc/300', {
      caption:
        '👤 Иван Иванов\n📌 Отдел разработки\n🎯 Любит TypeScript и шашки\n🔗 @ivan_dev',
    });
  }

  async handleFAQ(ctx: Context) {
    await ctx.reply(
      '📋 Часто задаваемые вопросы:',
      Markup.inlineKeyboard([
        [Markup.button.callback('Как оформить отпуск?', 'faq_vacation')],
        [Markup.button.callback('Как получить доступ в CRM?', 'faq_crm')],
      ]),
    );
  }

  async handleChallenge(ctx: Context) {
    await ctx.reply(
      '🏆 Челлендж недели: 10 000 шагов каждый день!\n\nНажми кнопку, если участвуешь:',
      Markup.inlineKeyboard([
        [Markup.button.callback('✅ Участвовать', 'challenge_join')],
      ]),
    );
  }
}
