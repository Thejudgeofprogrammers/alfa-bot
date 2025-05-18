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

  async findUser(telegram_id: number) {
    try {
      const user = await this.prismaService.user.findUnique({
        where: { telegram_id },
      });
      return user !== null;
    } catch (e) {
      console.error(e);
      throw new InternalServerErrorException('Ошибка при поиске пользователя');
    }
  }

  async createUser(data: CreateUserDTO) {
    try {
      const { telegram_id, username, last_name, first_name } = data;
      if (!telegram_id) {
        throw new BadRequestException('BadRequest');
      }

      await this.prismaService.user.create({
        data: {
          telegram_id,
          username,
          last_name,
          first_name,
        },
      });
      console.log(telegram_id, username, last_name, first_name);
    } catch (e) {
      throw new InternalServerErrorException('Server Internal');
    }
  }
}
