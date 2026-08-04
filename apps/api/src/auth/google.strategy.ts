import { Injectable } from '@nestjs/common';
import { OAuthSignInService } from './oauth-sign-in.service.js';
import { PassportStrategy } from '@nestjs/passport';
import { requireEnv } from '../common/index.js';
import { Strategy, type Profile } from 'passport-google-oauth20';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(private readonly oauthSignInService: OAuthSignInService) {
    super({
      clientID: requireEnv('GOOGLE_CLIENT_ID'),
      clientSecret: requireEnv('GOOGLE_CLIENT_SECRET'),
      callbackURL: requireEnv('GOOGLE_CALLBACK_URL'),
      scope: ['email', 'profile'],
      // `state: false` skips session state, not CSRF (oauth-csrf.guard.ts)
      state: false,
    });
  }

  async validate(
    _accessToken: string,
    _refreshToken: string,
    profile: Profile,
  ) {
    const email = profile.emails?.[0]?.value;
    if (!email) throw new Error('No email returned from Google');
    return this.oauthSignInService.findOrCreateOAuthUser(
      'google',
      profile.id,
      email,
    );
  }
}
