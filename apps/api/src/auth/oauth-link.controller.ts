import {
  ConflictException,
  Controller,
  Delete,
  Get,
  HttpCode,
  Logger,
  Param,
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
import { JwtAuthGuard } from './jwt-auth.guard.js';
import { OAuthLinkService } from './oauth-link.service.js';
import type { Response } from 'express';
import type { AuthRequest } from './auth-request.type.js';

/**
 * OAuth account-linking flows. Shares the `auth` route prefix with the other
 * auth controllers so linking callback URLs remain stable.
 */
@ApiTags('auth')
@Controller('auth')
export class OAuthLinkController {
  private readonly logger = new Logger(OAuthLinkController.name);

  constructor(private readonly oauthLinkService: OAuthLinkService) {}

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
    // JSON not redirect: the SPA fetches this to attach the bearer JWT
    // (a top-level navigation can't send an Authorization header)
    return this.oauthLinkService.buildGoogleLinkUrl(request.user.userId);
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
      await this.oauthLinkService.linkOAuthAccountToUser(
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
      // don't let an unexpected error escape as HTML 500 in the OAuth popup;
      // log it, then redirect to a generic error state the SPA can render
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
    description: 'No password set – cannot disconnect.',
  })
  @ApiResponse({ status: 401, description: 'Missing or invalid JWT.' })
  @UseGuards(JwtAuthGuard)
  @Delete('providers/:provider')
  @HttpCode(200)
  async unlinkProvider(
    @Req() request: AuthRequest,
    @Param('provider') provider: string,
  ) {
    await this.oauthLinkService.unlinkOAuthProvider(
      request.user.userId,
      provider,
    );
    return { success: true };
  }
}
