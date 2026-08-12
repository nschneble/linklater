/**
 * Turns the raw `GET /auth/me` response into the `User` the app renders.
 *
 * The two narrowers exist because the API and this client deploy
 * separately, so a running client can meet a theme or mode id that shipped
 * after it did. Both fall back silently rather than disrupting the user,
 * and warn in development so an in-flight deploy is visible while
 * debugging.
 */

import { normalizeCustomTheme } from '../../theme/customTheme';
import { VALID_BASE_THEME_IDS } from '../../theme/constants';
import type { BaseTheme, Mode } from '../../theme/constants';
import type { MeResponse } from '../../lib/api';
import type { User } from './types';

export function narrowTheme(theme: string): BaseTheme {
  if (VALID_BASE_THEME_IDS.has(theme)) return theme as BaseTheme;
  if (import.meta.env.DEV) {
    console.warn(
      `[auth] Unknown server theme "${theme}"; falling back to "scanner-darkly".`,
    );
  }
  return 'scanner-darkly';
}

export function narrowMode(mode: string): Mode {
  if (mode === 'light' || mode === 'dark') return mode;
  if (import.meta.env.DEV) {
    console.warn(
      `[auth] Unknown server mode "${mode}"; falling back to "dark".`,
    );
  }
  return 'dark';
}

/** Reached through `adoptUser`, which every `getMe` caller goes through. */
export function mapMeToUser(me: MeResponse): User {
  return {
    cvdMode: me.cvdMode,
    dyslexicFont: me.dyslexicFont,
    customTheme: normalizeCustomTheme(me.customTheme),
    customThemeEnabled: me.customThemeEnabled,
    connectedProviders: me.connectedProviders,
    email: me.email,
    emailVerifiedAt: me.emailVerifiedAt,
    hasPassword: me.hasPassword,
    mode: narrowMode(me.mode),
    pendingEmail: me.pendingEmail,
    theme: narrowTheme(me.theme),
    multiFactorMethod: me.multiFactorMethod,
    multiFactorPending: me.multiFactorPending,
    accountDeletionPending: me.accountDeletionPending,
    userId: me.userId,
    welcomedAt: me.welcomedAt,
  };
}
