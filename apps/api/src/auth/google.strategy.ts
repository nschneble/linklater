import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, type Profile } from 'passport-google-oauth20';
import { requireEnv } from '../common/index.js';
import { OAuthSignInService } from './oauth-sign-in.service.js';

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
    const primaryEmail = profile.emails?.[0];
    if (!primaryEmail?.value) throw new Error('No email returned from Google');
    // OIDC providers send email_verified as either a boolean or the string
    // "true"; anything else, including absent, counts as unverified
    const claim: unknown = primaryEmail.verified;
    return this.oauthSignInService.findOrCreateOAuthUser(
      'google',
      profile.id,
      primaryEmail.value,
      claim === true || claim === 'true',
    );
  }
}
