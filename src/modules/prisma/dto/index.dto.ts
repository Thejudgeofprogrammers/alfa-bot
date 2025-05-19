import { IsNumber, IsString } from 'class-validator';

export class CreateUserDTO {
  @IsNumber()
  telegram_id: number;

  @IsString()
  username: string;

  @IsString()
  first_name: string;

  @IsString()
  last_name: string;

  @IsString()
  photo_url: string;
}
