import { Action, Ctx, On, Start, Update } from 'nestjs-telegraf';
import { Context, Markup } from 'telegraf';
import { ConnectService } from './connect.service';
import { ConfigService } from '@nestjs/config';
import { UserService } from '../user/user.service';
import { join, resolve } from 'path';
import { existsSync } from 'fs';
import { readFileSync } from 'fs';
import { Param } from '@nestjs/common';

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
    const userExists = await this.userService.findUser(telegram_id);
    const photos = await ctx.telegram.getUserProfilePhotos(
      Number(telegram_id),
      0,
      1,
    );
    const filePath = join(
      __dirname,
      '..',
      '..',
      '..',
      'uploads',
      'user_photos',
      `${telegram_id}.jpg`,
    );

    if (!userExists) {
      await this.userService.createUser({
        telegram_id,
        username,
        last_name,
        first_name,
        photo_url: '',
      });
    }

    const photo_url = `/app/uploads/user_photos/${telegram_id}.jpg`;
    if (
      photos.total_count > 0 &&
      (await this.userService.existPhoto(telegram_id)) === ''
    ) {
      await this.userService.updatePhoto(telegram_id, photo_url);
    }

    if (photos.total_count > 0 && !existsSync(filePath)) {
      const fileId = photos.photos[0].at(-1).file_id;
      const fileLink = await ctx.telegram.getFileLink(fileId);

      await this.connectService.downloadImage(fileLink.href, filePath);

      const photo_url = `/app/uploads/user_photos/${telegram_id}.jpg`;
      if ((await this.userService.existPhoto(telegram_id)) === '') {
        await this.userService.updatePhoto(telegram_id, photo_url);
      }
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

  @Action(/faq_.+/)
  async onDynamicFAQ(@Ctx() ctx: any) {
    await ctx.answerCbQuery();

    const callbackData = ctx.callbackQuery?.data;
    const key = callbackData?.replace('faq_', '');
    const faqDataPath = resolve(__dirname, '../../../jsons/faq.json');
    const faqData = JSON.parse(readFileSync(faqDataPath, 'utf-8'));
    const faqItem = faqData.find((item: any) => item.key === key);

    if (faqItem) {
      await ctx.reply(faqItem.answer);
    } else {
      await ctx.reply('К сожалению, такой справки пока нет.');
    }
  }

  @Action(/^start_quiz_(quiz_\d+)$/)
  async startQuiz(@Ctx() ctx: any) {
    const data = ctx.update.callback_query.data;
    const match = data.match(/^start_quiz_(quiz_\d+)$/);
    const quizId = match ? match[1] : null;

    if (!quizId) {
      await ctx.reply('❌ Квиз не найден.');
      return;
    }
    console.log(quizId);
    const quiz = await this.connectService.getQuizById(quizId);

    if (!quiz) {
      await ctx.reply('❌ Квиз не найден.');
      return;
    }
    console.log(quiz);
    ctx.session.quiz = {
      currentIndex: 0,
      correctAnswers: 0,
      questions: quiz.questions.map((q) => ({
        text: `${q.name}\n\n${q.description}`,
        options: Object.values(q.answers),
        correct: q.correct,
      })),
    };

    await this.sendNextQuestion(ctx);
  }

  async sendNextQuestion(ctx: any) {
    const { quiz } = ctx.session;
    console.log(quiz);
    if (quiz.currentIndex >= quiz.questions.length) {
      await ctx.reply(
        `✅ Квиз завершён! Правильных ответов: ${quiz.correctAnswers} из ${quiz.questions.length}`,
      );
      return;
    }

    const currentQuestion = quiz.questions[quiz.currentIndex];

    const buttons = ['A', 'B', 'C', 'D'].map((key) =>
      Markup.button.callback(
        currentQuestion.options[['A', 'B', 'C', 'D'].indexOf(key)],
        `answer_${key}`,
      ),
    );

    await ctx.reply(
      currentQuestion.text,
      Markup.inlineKeyboard(buttons, { columns: 2 }),
    );
  }

  @Action(/^answer_([A-D])$/)
  async handleAnswer(@Ctx() ctx: any, @Param('0') answer: string) {
    const quiz = ctx.session.quiz;

    const current = quiz.questions[quiz.currentIndex];

    if (answer === current.correct) {
      quiz.correctAnswers++;
      await ctx.reply('✅ Правильно!');
    } else {
      await ctx.reply(`❌ Неправильно. Правильный ответ: ${current.correct}`);
    }

    quiz.currentIndex++;

    await this.sendNextQuestion(ctx);
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
