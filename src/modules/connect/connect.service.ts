import { Injectable, OnModuleInit } from '@nestjs/common';
import { Context, Markup } from 'telegraf';
import { mkdir, writeFile } from 'fs/promises';
import * as fs from 'fs';
import { join, dirname, resolve } from 'path';
import axios from 'axios';
import { readFileSync } from 'fs';
import { UserService } from '../user/user.service';
import { QuizService } from '../quiz/quiz.service';
import { text_for_quiz } from './text';

@Injectable()
export class ConnectService implements OnModuleInit {
  constructor(
    private readonly userService: UserService,
    private readonly quizService: QuizService,
  ) {}

  onModuleInit() {
    const dirPath = join(__dirname, '..', '..', '..', 'uploads', 'user_photos');

    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  }

  async handleQuiz(ctx: Context) {
    const quizzes = this.quizService.getAllQuizzes();

    if (!quizzes.length) {
      await ctx.reply('❌ Нет доступных квизов.');
      return;
    }

    const buttons = quizzes.map((quiz) => [
      Markup.button.callback(quiz.name, `start_quiz_${quiz.id}`),
    ]);

    await ctx.reply(text_for_quiz, Markup.inlineKeyboard(buttons));
  }

  async getQuizById(quizId: string) {
    const faqDataPath = resolve(__dirname, '../../../jsons/quiz.json');
    const faqData = JSON.parse(readFileSync(faqDataPath, 'utf-8'));
    return faqData.quizzes.find(
      (quiz) =>
        quiz.id.trim().toLowerCase() === String(quizId).trim().toLowerCase(),
    );
  }

  async handleColleague(ctx: Context) {
    const telegramId = ctx.from?.id;
    if (!telegramId) {
      await ctx.reply('Не удалось получить ваш Telegram ID. /start');
      return;
    }

    const user = await this.userService.getTopRatedUser();

    if (!user) {
      await ctx.reply('Не удалось найти коллег.');
      return;
    }

    const user_profile = await this.userService.getProfile(telegramId);

    if (user_profile) {
      const caption =
        `👤 ${user_profile.full_name}\n` +
        `💼 Должность: ${user_profile.position}\n` +
        `🏙️ Город: ${user_profile.city}\n` +
        `🦸 Суперспособность: ${user_profile.superpower}\n` +
        `🎨 Любимый цвет: ${user_profile.favorite_color}\n` +
        `🐾 Любимое животное: ${user_profile.favorite_animal}\n` +
        `🎬 Любимый фильм: ${user_profile.favorite_movie}\n` +
        `💭 Мечта: ${user_profile.dream}\n` +
        `📱 VK: ${user_profile.vk}\n` +
        `🚫 Запрещённые сети: ${user_profile.banned_social}\n` +
        `🎯 Увлечения: ${user_profile.hobbies}\n` +
        `🤝 Цель знакомства: ${user_profile.friend_goal}`;

      const photoPath = user.photo_url
        ? user.photo_url
        : join(
            __dirname,
            '..',
            '..',
            '..',
            'uploads',
            'user_photos',
            'not_user_photo.jpg',
          );

      if (fs.existsSync(photoPath)) {
        await ctx.replyWithPhoto({ source: photoPath }, { caption });
      } else {
        await ctx.reply(
          'Если вашего фото нету, то в настройке конфиденциальности разрешите фото: Для всех',
        );
        await ctx.replyWithPhoto(
          {
            source: join(
              __dirname,
              '..',
              '..',
              '..',
              'uploads',
              'user_photos',
              'not_user_photo.jpg',
            ),
          },
          { caption },
        );
      }
    } else {
      const caption =
        `👤 @${user?.username}\n` +
        `${user?.first_name} ${user?.last_name}` +
        (user.username ? `🔗 @${user.username}` : '');

      const photoPath = user.photo_url
        ? user.photo_url
        : join(
            __dirname,
            '..',
            '..',
            '..',
            'uploads',
            'user_photos',
            'not_user_photo.jpg',
          );

      if (fs.existsSync(photoPath)) {
        await ctx.replyWithPhoto({ source: photoPath }, { caption });
      } else {
        await ctx.reply(
          'Если вашего фото нету, то в настройке конфиденциальности разрешите фото: Для всех',
        );
        await ctx.replyWithPhoto(
          {
            source: join(
              __dirname,
              '..',
              '..',
              '..',
              'uploads',
              'user_photos',
              'not_user_photo.jpg',
            ),
          },
          { caption },
        );
      }
    }
  }

  async handleFAQ(ctx: Context) {
    const faqDataPath = resolve(__dirname, '../../../jsons/faq.json');
    const faqData = JSON.parse(readFileSync(faqDataPath, 'utf-8'));
    // eslint-disable-next-line
    const buttons = faqData.map(item =>
      // eslint-disable-next-line
      [Markup.button.callback(item.label, `faq_${item.key}`)]  
    );

    buttons.push([Markup.button.callback('Мой баллы и награды', 'my_balls')]);

    buttons.push([
      Markup.button.callback('Коды подразделений', 'additional_event'),
    ]);

    await ctx.reply(
      '📋 Часто задаваемые вопросы:',
      Markup.inlineKeyboard(buttons),
    );
  }

  async handleChallenge(ctx: Context) {
    const userId = ctx.from?.id;
    if (!userId) {
      return ctx.reply('Не удалось определить пользователя. Нажмите /start');
    }

    const user = await this.userService.findUser(userId);

    if (user.rating) {
      await ctx.reply(
        `💰 У тебя ${user.rating * 10} баллов.\n\nПродолжай участвовать, чтобы повышать уровень и открывать ачивки!`,
      );
    } else {
      await ctx.reply(
        `💰 У тебя 0 баллов.\n\nПродолжай участвовать, чтобы повышать уровень и открывать ачивки!`,
      );
    }
  }

  async downloadImage(url: string, dest: string): Promise<string> {
    try {
      const dir = dirname(dest);
      if (!fs.existsSync(dir)) {
        await mkdir(dir, { recursive: true });
      }

      const response = await axios.get<any>(url, {
        responseType: 'arraybuffer',
      });

      if (response.status !== 200) {
        throw new Error(`Failed to get '${url}' (${response.status})`);
      }

      await writeFile(dest, response.data);
      return dest;
    } catch (error) {
      throw new Error(`Ошибка при загрузке изображения: ${error}`);
    }
  }
}
