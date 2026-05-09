import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const AppleStrategyLib = require('@nicokaiser/passport-apple');
import { AuthService } from './auth.service.js';

interface AppleProfile {
  id: string;
  email?: string;
  provider: string;
}

@Injectable()
export class AppleStrategy extends PassportStrategy(
  AppleStrategyLib.Strategy,
  'apple',
) {
  constructor(private readonly authService: AuthService) {
    super({
      clientID: process.env.APPLE_CLIENT_ID ?? '',
      teamID: process.env.APPLE_TEAM_ID ?? '',
      keyID: process.env.APPLE_KEY_ID ?? '',
      key: process.env.APPLE_PRIVATE_KEY ?? '',
      callbackURL: process.env.APPLE_CALLBACK_URL ?? '',
      scope: ['email', 'name'],
    });
  }

  async validate(
    _accessToken: string,
    _refreshToken: string,
    profile: AppleProfile,
  ) {
    const email = profile.email;
    if (!email) throw new Error('No email returned from Apple');
    return this.authService.findOrCreateOAuthUser('apple', profile.id, email);
  }
}
