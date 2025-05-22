import { Action, Ctx, On, Start, Update } from 'nestjs-telegraf';
import { Context, Markup } from 'telegraf';
import { ConnectService } from './connect.service';
import { ConfigService } from '@nestjs/config';
import { UserService } from '../user/user.service';
import { join, resolve } from 'path';
import { existsSync } from 'fs';
import { readFileSync } from 'fs';
import {
  my_balls_and,
  text_for_collega,
  text_for_start,
  varCodes,
} from './text';

@Update()
export class ConnectUpdate {
  registrationSteps: Map<number, { step: string; data: any }>;
  constructor(
    private readonly connectService: ConnectService,
    private configService: ConfigService,
    private readonly userService: UserService,
  ) {
    this.registrationSteps = new Map();
  }

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

    const photoPath = join(
      __dirname,
      '..',
      '..',
      '..',
      'uploads',
      'user_photos',
      'lis.jpg',
    );

    await ctx.replyWithPhoto({ source: photoPath });
    await ctx.reply(
      text_for_start,
      Markup.keyboard([
        ['📚 Пройти квиз'],
        ['👤 Коллега недели'],
        ['❓ FAQ'],
        ['Ваше количество баллов'],
        ['Доп. регистрация для анкеты'],
      ])
        .resize()
        .oneTime(false),
    );
  }

  @Action('my_balls')
  async onMyBallsEvent(@Ctx() ctx: Context) {
    await ctx.answerCbQuery();

    const keyboard = Object.entries(my_balls_and).map(([key, obj]) =>
      // eslint-disable-next-line
      [Markup.button.callback(obj.label, `chapter_${key}`)],
    );
    await ctx.reply('Выберите раздел:', Markup.inlineKeyboard(keyboard));
  }

  @Action(/chapter_(.+)/)
  async onChapterSelected(@Ctx() ctx: any) {
    const code = ctx.match[1];
    await ctx.answerCbQuery();

    const section = my_balls_and[code];
    if (section) {
      await ctx.reply(section.text);
    } else {
      await ctx.reply('Раздел не найден.');
    }
  }

  @Action('additional_event')
  async onAdditionalEvent(@Ctx() ctx: Context) {
    await ctx.answerCbQuery();
    const keyboard = Object.entries(varCodes).map(([label, code]) =>
      // eslint-disable-next-line
      [Markup.button.callback(label, `code_${code}`)],
    );
    await ctx.reply('Выберите подразделение:', Markup.inlineKeyboard(keyboard));
  }

  @Action(/code_(.+)/)
  async onCodeSelected(@Ctx() ctx: any) {
    const code = ctx.match[1];
    await ctx.answerCbQuery();
    await ctx.reply(`Код подразделения: ${code}`);
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

      const check = await this.userService.checkQuiz(telegramId, quizId);
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
    const selected = quiz.selectedAnswers?.[quiz.currentIndex];

    const buttons = Object.entries(currentQuestion.answers).map(
      ([key, value]) => {
        const isSelected = selected === key;
        const prefix = isSelected ? '✅ ' : '◯ ';
        return Markup.button.callback(`${prefix}${value}`, `answer_${key}`);
      },
    );

    await ctx.reply(
      currentQuestion.text,
      Markup.inlineKeyboard(buttons, { columns: 1 }),
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
    const telegramId = ctx.from?.id;
    const text = ctx.message.text;

    if (this.registrationSteps.has(telegramId)) {
      const session = this.registrationSteps.get(telegramId);

      switch (session.step) {
        case 'full_name':
          session.data.full_name = text;
          session.step = 'position';
          await ctx.reply('Введите вашу должность:');
          return;

        case 'position':
          session.data.position = text;
          session.step = 'city';
          await ctx.reply('Введите ваш город:');
          return;

        case 'city':
          session.data.city = text;
          session.step = 'superpower';
          await ctx.reply('Ваша суперспособность?');
          return;

        case 'superpower':
          session.data.superpower = text;
          session.step = 'favorite_color';
          await ctx.reply('Любимый цвет:');
          return;

        case 'favorite_color':
          session.data.favorite_color = text;
          session.step = 'favorite_animal';
          await ctx.reply('Любимое животное:');
          return;

        case 'favorite_animal':
          session.data.favorite_animal = text;
          session.step = 'favorite_movie';
          await ctx.reply('Любимый фильм или актёр:');
          return;

        case 'favorite_movie':
          session.data.favorite_movie = text;
          session.step = 'dream';
          await ctx.reply('О чём вы мечтаете?');
          return;

        case 'dream':
          session.data.dream = text;
          session.step = 'vk';
          await ctx.reply('Ссылка на VK или @юзернейм:');
          return;

        case 'vk':
          session.data.vk = text;
          session.step = 'banned_social';
          await ctx.reply('Ник в запрещённых соцсетях (если есть):');
          return;

        case 'banned_social':
          session.data.banned_social = text;
          session.step = 'hobbies';
          await ctx.reply('Чем увлекаетесь вне работы?');
          return;

        case 'hobbies':
          session.data.hobbies = text;
          session.step = 'friend_goal';
          await ctx.reply('Для чего хотите познакомиться с коллегами?');
          return;

        case 'friend_goal':
          session.data.friend_goal = text;

          const user_prof = await this.userService.getProfile(telegramId);

          if (!user_prof) {
            await this.userService.saveProfile({
              telegram_id: telegramId,
              ...session.data,
            });
          } else {
            await this.userService.updateProfile({
              telegram_id: telegramId,
              ...session.data,
            });
          }

          this.registrationSteps.delete(telegramId);
          await ctx.reply('✅ Ваша анкета успешно сохранена!');
          return;
      }
    }

    switch (text) {
      case '📚 Пройти квиз':
        await this.connectService.handleQuiz(ctx);
        break;
      case '👤 Коллега недели':
        const photoPath = join(
          __dirname,
          '..',
          '..',
          '..',
          'uploads',
          'user_photos',
          'collega.jpg',
        );

        await ctx.replyWithPhoto(
          { source: photoPath },
          { caption: text_for_collega },
        );
        await this.connectService.handleColleague(ctx);
        break;
      case '❓ FAQ':
        await this.connectService.handleFAQ(ctx);
        break;
      case 'Ваше количество баллов':
        await this.connectService.handleChallenge(ctx);
        break;
      case 'Доп. регистрация для анкеты':
        this.registrationSteps.set(ctx.from.id, {
          step: 'full_name',
          data: {},
        });
        await ctx.reply('Добро пожаловать! Как вас зовут?');
        break;
      default:
        await ctx.reply('Пожалуйста, выбери одну из кнопок на клавиатуре.');
        break;
    }
  }
}
