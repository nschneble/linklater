import {
  GOOGLE_SIGN_IN_CALLBACK_ROUTE,
  publicCallbackUrl,
} from './oauth-callback-urls.js';
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
      callbackURL: publicCallbackUrl(GOOGLE_SIGN_IN_CALLBACK_ROUTE),
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
    const primaryEmail = profile.emails?.[0];
    if (!primaryEmail?.value) throw new Error('No email returned from Google');
    // providers send email_verified as a boolean or as a string
    const claim: unknown = primaryEmail.verified;
    return this.oauthSignInService.findOrCreateOAuthUser(
      'google',
      profile.id,
      primaryEmail.value,
      claim === true || claim === 'true',
    );
  }
}
