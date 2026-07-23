import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, type Profile } from 'passport-google-oauth20';
import { OAuthAccountService } from './oauth-account.service.js';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(private readonly oauthAccountService: OAuthAccountService) {
    if (!process.env.GOOGLE_CLIENT_ID)
      throw new Error('GOOGLE_CLIENT_ID must be set');
    if (!process.env.GOOGLE_CLIENT_SECRET)
      throw new Error('GOOGLE_CLIENT_SECRET must be set');
    if (!process.env.GOOGLE_CALLBACK_URL)
      throw new Error('GOOGLE_CALLBACK_URL must be set');

    super({
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL,
      scope: ['email', 'profile'],
      // `state: false` opts out of passport-oauth2's session-backed state
      // store (this app has no session middleware) – NOT out of CSRF
      // protection. The route guards (`createOAuthInitiateGuard`/
      // `createOAuthCallbackGuard` in `oauth-csrf.guard.ts`) supply and
      // verify a cookie-bound state value per request instead.
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
    return this.oauthAccountService.findOrCreateOAuthUser(
      'google',
      profile.id,
      email,
    );
  }
}
