import { BadRequestException, Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, type Profile } from 'passport-google-oauth20';
import { verifyLinkState } from './oauth-link-state.js';

const FIVE_MINUTES_MS = 5 * 60 * 1000;

@Injectable()
export class GoogleLinkStrategy extends PassportStrategy(
  Strategy,
  'google-link',
) {
  constructor() {
    if (!process.env.GOOGLE_CLIENT_ID)
      throw new Error('GOOGLE_CLIENT_ID must be set');
    if (!process.env.GOOGLE_CLIENT_SECRET)
      throw new Error('GOOGLE_CLIENT_SECRET must be set');
    if (!process.env.GOOGLE_LINK_CALLBACK_URL)
      throw new Error('GOOGLE_LINK_CALLBACK_URL must be set');

    super({
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_LINK_CALLBACK_URL,
      scope: ['email', 'profile'],
      passReqToCallback: true,
      state: false,
    });
  }

  async validate(
    request: { query?: { state?: string } },
    _accessToken: string,
    _refreshToken: string,
    profile: Profile,
  ) {
    const state = request.query?.state ?? '';
    const userId = verifyLinkState(
      state,
      process.env.JWT_SECRET!,
      FIVE_MINUTES_MS,
    );
    if (!userId) {
      throw new BadRequestException('Invalid or expired link state');
    }

    const providerEmail = profile.emails?.[0]?.value ?? '';
    return { userId, providerId: profile.id, providerEmail };
  }
}
