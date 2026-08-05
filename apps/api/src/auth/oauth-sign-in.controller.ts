import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service.js';
import { Controller, Get, Post, Req, Res, UseGuards } from '@nestjs/common';
import {
  createOAuthCallbackGuard,
  createOAuthInitiateGuard,
} from './oauth-csrf.guard.js';
import type { AuthRequest } from './auth-request.type.js';
import type { Response } from 'express';

/**
 * OAuth sign-in flows (Google, Apple). Kept on the shared `auth` route prefix
 * so provider callback URLs remain stable.
 */
@ApiTags('auth')
@Controller('auth')
export class OAuthSignInController {
  constructor(private readonly authService: AuthService) {}

  @ApiOperation({ summary: 'Initiate Google OAuth sign-in' })
  @UseGuards(createOAuthInitiateGuard('google'))
  @Get('google')
  async googleAuth() {
    // Passport redirects to Google, no body needed
  }

  @ApiOperation({ summary: 'Google OAuth callback' })
  @UseGuards(createOAuthCallbackGuard('google'))
  @Get('google/callback')
  async googleCallback(@Req() request: AuthRequest, @Res() response: Response) {
    await this.completeOAuthLogin(request, response);
  }

  @ApiOperation({ summary: 'Initiate Apple Sign In' })
  @UseGuards(createOAuthInitiateGuard('apple'))
  @Get('apple')
  async appleAuth() {
    // Passport redirects to Apple, no body needed
  }

  @ApiOperation({ summary: 'Apple Sign In callback' })
  @UseGuards(createOAuthCallbackGuard('apple'))
  @Post('apple/callback')
  async appleCallback(@Req() request: AuthRequest, @Res() response: Response) {
    await this.completeOAuthLogin(request, response);
  }

  /**
   * Shared OAuth post-login handler. Issues a session for the authenticated
   * user and redirects the browser to the SPA's `/oauth/callback` route with
   * the tokens in the URL fragment (fragments are never sent to servers or
   * logged in Referer headers). When MFA is enabled, redirects to `/login`
   * with an error code instead, since OAuth callbacks can't show an OTP form.
   */
  private async completeOAuthLogin(
    request: AuthRequest,
    response: Response,
  ): Promise<void> {
    const result = await this.authService.login(request.user.userId);
    if (!('accessToken' in result)) {
      response.redirect(`${process.env.APP_URL}/login?error=mfa_required`);
      return;
    }
    response.redirect(
      `${process.env.APP_URL}/oauth/callback#token=${result.accessToken}&refresh=${result.refreshToken}`,
    );
  }
}
