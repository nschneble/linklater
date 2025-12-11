import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { UsersService } from '../users/users.service';

type LoginUser = { id: string; email: string } | { userId: string; email: string };

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

    const { passwordHash: _passwordHash, ...result } = user;
    return result;
  }

  async login(user: LoginUser) {
    const userId = 'id' in user ? user.id : user.userId;
    const payload = { sub: userId, email: user.email };
    return {
      accessToken: this.jwtService.sign(payload),
    };
  }
}
