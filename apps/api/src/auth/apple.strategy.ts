import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import AppleStrategyLib from '@nicokaiser/passport-apple';
import { requireEnv } from '../common/index.js';
import { OAuthAccountService } from './oauth-account.service.js';

const APPLE_PARAMS = [
  'CALLBACK_URL',
  'CLIENT_ID',
  'KEY_ID',
  'PRIVATE_KEY',
  'TEAM_ID',
] as const;

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
  constructor(private readonly oauthAccountService: OAuthAccountService) {
    for (const key of APPLE_PARAMS) {
      requireEnv(`APPLE_${key}`);
    }

    super({
      callbackURL: process.env.APPLE_CALLBACK_URL,
      clientID: process.env.APPLE_CLIENT_ID,
      key: process.env.APPLE_PRIVATE_KEY,
      keyID: process.env.APPLE_KEY_ID,
      scope: ['email', 'name'],
      teamID: process.env.APPLE_TEAM_ID,
      // state:false = no session state store (we have none), not disabled CSRF
      state: false,
    });
  }

  async validate(
    profile: AppleProfile,
    _accessToken: string,
    _refreshToken: string,
  ) {
    const email = profile.email;
    if (!email) throw new Error('No email returned from Apple');
    return this.oauthAccountService.findOrCreateOAuthUser(
      'apple',
      profile.id,
      email,
    );
  }
}
