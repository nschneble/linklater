import {
  ConflictException,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { AuthService } from './auth.service.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';
import { OAuthAccountService } from './oauth-account.service.js';
import { generateLinkState } from './oauth-link-state.js';
import type { AuthRequest } from './auth-request.type.js';

/**
 * OAuth sign-in (Google, Apple) and account-linking flows. Kept on the
 * shared `auth` route prefix so callbacks remain stable.
 */
@ApiTags('auth')
@Controller('auth')
export class OAuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly oauthAccountService: OAuthAccountService,
  ) {}

  @ApiOperation({ summary: 'Initiate Google OAuth sign-in' })
  @UseGuards(AuthGuard('google'))
  @Get('google')
  async googleAuth() {
    // Passport redirects to Google — no body needed
  }

  @ApiOperation({ summary: 'Google OAuth callback' })
  @UseGuards(AuthGuard('google'))
  @Get('google/callback')
  async googleCallback(@Req() request: AuthRequest, @Res() response: Response) {
    await this.completeOAuthLogin(request, response);
  }

  @ApiOperation({ summary: 'Initiate Apple Sign In' })
  @UseGuards(AuthGuard('apple'))
  @Get('apple')
  async appleAuth() {
    // Passport redirects to Apple — no body needed
  }

  @ApiOperation({ summary: 'Apple Sign In callback' })
  @UseGuards(AuthGuard('apple'))
  @Post('apple/callback')
  async appleCallback(@Req() request: AuthRequest, @Res() response: Response) {
    await this.completeOAuthLogin(request, response);
  }

  /**
   * Shared OAuth post-login handler. Issues a session for the authenticated
   * user and redirects the browser to the SPA's `/oauth/callback` route with
   * the tokens in the URL fragment (fragments are never sent to servers or
   * logged in Referer headers). When 2FA is enabled, redirects to `/login`
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

  @ApiOperation({ summary: 'Initiate Google OAuth account linking' })
  @ApiBearerAuth()
  @ApiResponse({ status: 302, description: 'Redirects to Google OAuth.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid JWT.' })
  @UseGuards(JwtAuthGuard)
  @Get('google/link')
  async googleLink(@Req() request: AuthRequest, @Res() response: Response) {
    const linkState = generateLinkState(
      request.user.userId,
      process.env.JWT_SECRET!,
    );
    const parameters = new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      redirect_uri: process.env.GOOGLE_LINK_CALLBACK_URL!,
      response_type: 'code',
      scope: 'email profile',
      state: linkState,
    });
    response.redirect(
      `https://accounts.google.com/o/oauth2/v2/auth?${parameters.toString()}`,
    );
  }

  @ApiOperation({ summary: 'Google OAuth account linking callback' })
  @ApiResponse({
    status: 302,
    description: 'Redirects to settings on success or failure.',
  })
  @UseGuards(AuthGuard('google-link'))
  @Get('google/link/callback')
  async googleLinkCallback(
    @Req()
    request: {
      user: { userId: string; providerId: string; providerEmail: string };
    },
    @Res() response: Response,
  ) {
    try {
      await this.oauthAccountService.linkOAuthAccountToUser(
        request.user.userId,
        'google',
        request.user.providerId,
        request.user.providerEmail,
      );
    } catch (error) {
      if (error instanceof ConflictException) {
        response.redirect(
          `${process.env.APP_URL}/settings?link_error=already_linked`,
        );
        return;
      }
      throw error;
    }
    response.redirect(`${process.env.APP_URL}/settings?linked=google`);
  }

  @ApiOperation({ summary: 'Disconnect an OAuth provider' })
  @ApiBearerAuth()
  @ApiResponse({ status: 200, description: 'Provider disconnected.' })
  @ApiResponse({
    status: 400,
    description: 'No password set — cannot disconnect.',
  })
  @ApiResponse({ status: 401, description: 'Missing or invalid JWT.' })
  @UseGuards(JwtAuthGuard)
  @Delete('providers/:provider')
  @HttpCode(200)
  async unlinkProvider(
    @Req() request: AuthRequest,
    @Param('provider') provider: string,
  ) {
    await this.oauthAccountService.unlinkOAuthProvider(
      request.user.userId,
      provider,
    );
    return { success: true };
  }
}
