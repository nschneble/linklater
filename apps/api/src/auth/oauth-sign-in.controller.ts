import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import {
  APPLE_SIGN_IN_CALLBACK_ROUTE,
  AUTH_ROUTE_PREFIX,
  GOOGLE_SIGN_IN_CALLBACK_ROUTE,
} from './oauth-callback-urls.js';
import { AuthService } from './auth.service.js';
import { Controller, Get, Post, Req, Res, UseGuards } from '@nestjs/common';
import {
  createOAuthCallbackGuard,
  createOAuthInitiateGuard,
} from './oauth-csrf.guard.js';
import { redirectOAuthSignInFailure } from './oauth-sign-in-failure.js';
import type { AuthRequest } from './auth-request.type.js';
import type { Response } from 'express';

/**
 * OAuth sign-in flows (Google, Apple). Kept on the shared `auth` route prefix
 * so provider callback URLs remain stable.
 *
 * Every route answers with a redirect, including every refusal:
 * `OAuthCallbackGuard` sends the browser back to the SPA before it rejects,
 * and Nest's exception filter finds the headers already sent, so the 302
 * stands and no error status reaches the client. That is deliberate (a
 * provider callback is a top-level navigation, and a JSON error body on the
 * API origin strands the user), which is why no 4xx is documented here.
 */
@ApiTags('auth')
@Controller(AUTH_ROUTE_PREFIX)
export class OAuthSignInController {
  constructor(private readonly authService: AuthService) {}

  @ApiOperation({ summary: 'Initiate Google OAuth sign-in' })
  @ApiResponse({
    status: 302,
    description: "Redirects to Google's sign-in screen.",
  })
  @UseGuards(createOAuthInitiateGuard('google'))
  @Get('google')
  async googleAuth() {
    // Passport redirects to Google, no body needed
  }

  @ApiOperation({ summary: 'Google OAuth callback' })
  @ApiResponse({
    status: 302,
    description:
      'Redirects to the app with the session tokens in the URL fragment, or back to the login page with a failure code when the state cookie, the provider, or an MFA enrolment blocks the sign-in.',
  })
  @UseGuards(createOAuthCallbackGuard('google'))
  @Get(GOOGLE_SIGN_IN_CALLBACK_ROUTE)
  async googleCallback(@Req() request: AuthRequest, @Res() response: Response) {
    await this.completeOAuthLogin(request, response, 'google');
  }

  @ApiOperation({ summary: 'Initiate Apple Sign In' })
  @ApiResponse({
    status: 302,
    description: "Redirects to Apple's sign-in screen.",
  })
  @UseGuards(createOAuthInitiateGuard('apple'))
  @Get('apple')
  async appleAuth() {
    // Passport redirects to Apple, no body needed
  }

  @ApiOperation({ summary: 'Apple Sign In callback' })
  @ApiResponse({
    status: 302,
    description:
      'Redirects to the app with the session tokens in the URL fragment, or back to the login page with a failure code when the state cookie, the provider, or an MFA enrolment blocks the sign-in.',
  })
  @UseGuards(createOAuthCallbackGuard('apple'))
  @Post(APPLE_SIGN_IN_CALLBACK_ROUTE)
  async appleCallback(@Req() request: AuthRequest, @Res() response: Response) {
    await this.completeOAuthLogin(request, response, 'apple');
  }

  /**
   * Shared OAuth post-login handler. Issues a session for the authenticated
   * user and redirects the browser to the SPA's `/oauth/callback` route with
   * the tokens in the URL fragment (fragments are never sent to servers or
   * logged in Referer headers). When MFA is enabled, redirects to `/login`
   * with a failure code instead, since OAuth callbacks can't show an OTP
   * form. `provider` rides along so the login page can name it in the copy.
   */
  private async completeOAuthLogin(
    request: AuthRequest,
    response: Response,
    provider: string,
  ): Promise<void> {
    const result = await this.authService.login(request.user.userId);
    if (!('accessToken' in result)) {
      redirectOAuthSignInFailure(response, 'mfa_required', provider);
      return;
    }
    response.redirect(
      `${process.env.APP_URL}/oauth/callback#token=${result.accessToken}&refresh=${result.refreshToken}`,
    );
  }
}
