import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

interface JwtPayload {
  email: string;
  subject: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: (() => {
        if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET must be set');
        return process.env.JWT_SECRET;
      })(),
    });
  }

  async validate(payload: JwtPayload) {
    return { userId: payload.subject, email: payload.email };
  }
}
