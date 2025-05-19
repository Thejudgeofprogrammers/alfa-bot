import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { CreateUserDTO } from '../prisma/dto/index.dto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UserService {
  constructor(private readonly prismaService: PrismaService) {}

  async checkQuiz(tg_id: number, quiz_id: string): Promise<boolean> {
    try {
      const user = await this.findUser(tg_id);
      return user.completed_quiz.includes(quiz_id);
    } catch (e) {
      console.error(e);
      throw new InternalServerErrorException('Server panic');
    }
  }

  async updateQuizAndRating(tg_id: number, quiz_id: string, balls: number) {
    await this.prismaService.user.update({
      where: { telegram_id: tg_id },
      data: {
        completed_quiz: {
          push: quiz_id,
        },
        rating: {
          increment: balls,
        },
      },
    });
  }

  async existPhoto(telegram_id: number) {
    try {
      const user = await this.prismaService.user.findUnique({
        where: { telegram_id },
      });
      return user.photo_url;
    } catch (e) {
      console.error(e);
      throw new InternalServerErrorException('Server panic');
    }
  }

  async updatePhoto(telegram_id: number, photo_url) {
    try {
      await this.prismaService.user.update({
        where: { telegram_id },
        data: { photo_url },
      });
    } catch (e) {
      console.error(e);
      throw new InternalServerErrorException('Server panic');
    }
  }

  async findUser(telegram_id: number) {
    try {
      return await this.prismaService.user.findUnique({
        where: { telegram_id },
      });
    } catch (e) {
      console.error(e);
      throw new InternalServerErrorException('Ошибка при поиске пользователя');
    }
  }

  async getTopRatedUser() {
    try {
      return this.prismaService.user.findFirst({
        orderBy: {
          rating: 'desc',
        },
      });
    } catch (e) {
      console.error(e);
      throw new InternalServerErrorException('Ошибка при поиске пользователя');
    }
  }

  async createUser(data: CreateUserDTO) {
    try {
      const { telegram_id, username, last_name, first_name, photo_url } = data;
      if (!telegram_id) {
        throw new BadRequestException('BadRequest');
      }

      await this.prismaService.user.create({
        data: {
          telegram_id,
          username,
          last_name,
          first_name,
          photo_url,
        },
      });
    } catch (e) {
      throw new InternalServerErrorException('Server Internal');
    }
  }
}
