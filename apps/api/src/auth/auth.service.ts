import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService, withoutPasswordHash } from '@linklater/users';
import * as bcrypt from 'bcryptjs';

type LoginUser =
  | { id: string; email: string }
  | { userId: string; email: string };

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  async validateUser(email: string, password: string) {
    const user = await this.usersService.findByEmail(email);
    if (!user) return null;

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) return null;

    return withoutPasswordHash(user);
  }

  async login(user: LoginUser) {
    const userId = 'id' in user ? user.id : user.userId;
    const payload = { subject: userId, email: user.email };

    return { accessToken: this.jwtService.sign(payload) };
  }
}
