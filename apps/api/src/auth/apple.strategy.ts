import {
  APPLE_SIGN_IN_CALLBACK_ROUTE,
  publicCallbackUrl,
} from './oauth-callback-urls.js';
import AppleStrategyLib from '@nicokaiser/passport-apple';
import { Injectable } from '@nestjs/common';
import { OAuthSignInService } from './oauth-sign-in.service.js';
import { PassportStrategy } from '@nestjs/passport';
import { requireEnv } from '../common/index.js';

const APPLE_PARAMS = ['CLIENT_ID', 'KEY_ID', 'PRIVATE_KEY', 'TEAM_ID'] as const;

interface AppleProfile {
  id: string;
  email?: string;
  // the strategy normalizes Apple's email_verified claim, and omits the field
  // entirely when Apple sends nothing
  emailVerified?: boolean;
  provider: string;
}

@Injectable()
export class AppleStrategy extends PassportStrategy(
  AppleStrategyLib.Strategy,
  'apple',
) {
  constructor(private readonly oauthSignInService: OAuthSignInService) {
    for (const key of APPLE_PARAMS) {
      requireEnv(`APPLE_${key}`);
    }

    super({
      callbackURL: publicCallbackUrl(APPLE_SIGN_IN_CALLBACK_ROUTE),
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
    return this.oauthSignInService.findOrCreateOAuthUser(
      'apple',
      profile.id,
      email,
      profile.emailVerified === true,
    );
  }
}
