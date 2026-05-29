import {
  ConflictException,
  Controller,
  Delete,
  Get,
  HttpCode,
  Logger,
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
import type { AuthRequest } from './auth-request.type.js';

/**
 * OAuth sign-in (Google, Apple) and account-linking flows. Kept on the
 * shared `auth` route prefix so callbacks remain stable.
 */
@ApiTags('auth')
@Controller('auth')
export class OAuthController {
  private readonly logger = new Logger(OAuthController.name);

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

  @ApiOperation({ summary: 'Initiate Google OAuth account linking' })
  @ApiBearerAuth()
  @ApiResponse({
    status: 200,
    description:
      'Returns the Google authorization URL for the SPA to navigate to.',
  })
  @ApiResponse({ status: 401, description: 'Missing or invalid JWT.' })
  @UseGuards(JwtAuthGuard)
  @Get('google/link')
  googleLink(@Req() request: AuthRequest): { url: string } {
    // Returns JSON instead of redirecting because the SPA initiates this
    // flow with `fetch` (so it can attach the bearer JWT). A top-level
    // browser navigation cannot send an Authorization header, which is
    // why the previous redirect-based design produced a 401.
    return this.oauthAccountService.buildGoogleLinkUrl(request.user.userId);
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
      // Anything else — DB outage, network blip linking the row, etc. —
      // must not escape as a NestJS HTML 500 inside the OAuth-callback
      // popup. Log it for triage, then redirect to a generic error state
      // the SPA already knows how to render.
      this.logger.error(
        `Unexpected error linking google account for user ${request.user.userId}: ${String(error)}`,
      );
      response.redirect(`${process.env.APP_URL}/settings?link_error=unknown`);
      return;
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
