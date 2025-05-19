import { Action, Ctx, On, Start, Update } from 'nestjs-telegraf';
import { Context, Markup } from 'telegraf';
import { ConnectService } from './connect.service';
import { ConfigService } from '@nestjs/config';
import { UserService } from '../user/user.service';
import { join, resolve } from 'path';
import { existsSync } from 'fs';
import { readFileSync } from 'fs';

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
    const filePath = join(
      __dirname,
      '..',
      '..',
      '..',
      'uploads',
      'user_photos',
      `${telegram_id}.jpg`,
    );

    const photo_url = `/app/uploads/user_photos/${telegram_id}.jpg`;

    const userExists = await this.userService.findUser(telegram_id);

    if (!userExists) {
      await this.userService.createUser({
        telegram_id,
        username,
        last_name,
        first_name,
        photo_url: '',
      });
    }

    const photos = await ctx.telegram.getUserProfilePhotos(
      Number(telegram_id),
      0,
      1,
    );

    const userPhotoInDB = await this.userService.existPhoto(telegram_id);

    if (photos.total_count > 0) {
      const fileId = photos.photos[0].at(-1).file_id;

      if (!existsSync(filePath) || userPhotoInDB === '') {
        const fileLink = await ctx.telegram.getFileLink(fileId);
        await this.connectService.downloadImage(fileLink.href, filePath);

        if (userPhotoInDB === '') {
          await this.userService.updatePhoto(telegram_id, photo_url);
        }
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
    await ctx.answerCbQuery();
    const data = ctx.update.callback_query.data;
    const match = data.match(/^start_quiz_(quiz_\d+)$/);
    const quizId = match ? match[1] : null;

    if (!quizId) {
      await ctx.reply('❌ Квиз не найден.');
      return;
    }
    const quiz = await this.connectService.getQuizById(quizId);

    if (!quiz) {
      await ctx.reply('❌ Квиз не найден.');
      return;
    }
    ctx.session.quiz = {
      quiz_id: quizId,
      currentIndex: 0,
      correctAnswers: 0,
      questions: quiz.questions.map((q) => ({
        text: `${q.name}\n\n${q.description}`,
        options: Object.values(q.answers),
        answers: q.answers,
        correct: q.correct,
      })),
    };

    await this.sendNextQuestion(ctx, quizId);
  }

  async sendNextQuestion(ctx: any, quizId: string) {
    const { quiz } = ctx.session;

    if (quiz.currentIndex >= quiz.questions.length) {
      const telegramId = ctx.from.id;

      // Надо посмотреть проходил ли пользователь quiz
      // Если нет, то сохранить пользователю какой квиз он проходил
      // И сохранить результат в баллах
      // А если проходил его, то вывести сообщение вы уже проходили этот квиз

      const check = await this.userService.checkQuiz(telegramId, quizId);
      console.log(check);
      if (!check) {
        await this.userService.updateQuizAndRating(
          telegramId,
          quizId,
          quiz.correctAnswers,
        );

        await ctx.reply(
          `✅ Квиз завершён! Правильных ответов: ${quiz.correctAnswers} из ${quiz.questions.length}`,
        );

        return;
      } else {
        await ctx.reply(
          `✅ Квиз был пройден вами ранее! Правильных ответов: ${quiz.correctAnswers} из ${quiz.questions.length}`,
        );
        return;
      }
    }

    const currentQuestion = quiz.questions[quiz.currentIndex];

    const buttons = Object.entries(currentQuestion.answers).map(
      ([key, value]) => Markup.button.callback(value as any, `answer_${key}`),
    );

    await ctx.reply(
      currentQuestion.text,
      Markup.inlineKeyboard(buttons, { columns: 2 }),
    );
  }

  @Action(/^answer_([A-D])$/)
  async handleAnswer(@Ctx() ctx: any) {
    await ctx.answerCbQuery();
    const answer = ctx.match[1];
    const quiz = ctx.session.quiz;

    const current = quiz.questions[quiz.currentIndex];
    if (answer === current.correct) {
      quiz.correctAnswers++;
      await ctx.reply('✅ Правильно!');
    } else {
      await ctx.reply(
        `❌ Неправильно. Правильный ответ: ${current.correct} — ${current.answers[current.correct]}`,
      );
    }

    quiz.currentIndex++;

    await this.sendNextQuestion(ctx, quiz.quiz_id);
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
