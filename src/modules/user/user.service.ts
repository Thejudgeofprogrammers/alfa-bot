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

  async getRandomUser() {
    try {
      const count = await this.prismaService.user.count();
      if (count === 0) return null;

      const randomSkip = Math.floor(Math.random() * count);

      const user = await this.prismaService.user.findFirst({
        skip: randomSkip,
      });

      return user;
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
