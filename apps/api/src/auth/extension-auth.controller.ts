import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Query,
  Redirect,
  Req,
  UseGuards,
} from '@nestjs/common';
import { CustomThrottlerGuard } from './custom-throttler.guard.js';
import { ExtensionAuthorizeDto } from './dto/extension-authorize.dto.js';
import { ExtensionAuthService } from './extension-auth.service.js';
import { ExtensionTokenDto } from './dto/extension-token.dto.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';
import { Throttle } from '@nestjs/throttler';
import { ThrottleMessage } from './throttle-message.decorator.js';
import type { AuthRequest } from './auth-request.type.js';

/**
 * Browser-extension PKCE authorization endpoints. Authorize step requires a
 * full browser session JWT; the token exchange is public and validates the
 * verifier against the stored challenge.
 *
 * Authorize answers with the callback URL as JSON rather than redirecting
 * to it, for the reason `OAuthLinkController.googleLink` gives: only the
 * single-page app can attach the session JWT, and it can only attach one
 * to a `fetch`. A redirecting endpoint would be reached by a top-level
 * navigation instead, which carries no Authorization header, so the guard
 * would refuse every caller.
 *
 * Declining redirects for the same reason inverted. It is a plain link the
 * user follows, so it arrives as a navigation and can carry no header, and
 * it needs none: a refusal grants nothing and reveals nothing the
 * allowlist does not already publish to whoever holds a callback. Requiring
 * a session would take the exit away from the user who most needs it, the
 * one whose session died partway through the flow.
 *
 * It is not rate limited and it must stay that way, because it must not
 * acquire a reason to be. Nothing is written and nothing is read, so
 * there is no cost to spend; a limit would only turn a declined grant into
 * a 429 for a user pressing Cancel twice.
 */
@ApiTags('auth')
@Controller('auth')
export class ExtensionAuthController {
  constructor(private readonly extensionAuthService: ExtensionAuthService) {}

  @ApiOperation({ summary: 'Authorize a browser extension (PKCE flow)' })
  @ApiBearerAuth()
  @ApiResponse({
    status: 200,
    description:
      'Returns the extension callback URL with the auth code appended, for' +
      ' the caller to navigate to.',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid redirect_uri or missing parameters.',
  })
  @ApiResponse({ status: 401, description: 'Missing or invalid JWT.' })
  @ApiResponse({
    status: 429,
    description: 'Too many extension authorization attempts.',
  })
  @UseGuards(JwtAuthGuard, CustomThrottlerGuard)
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  @ThrottleMessage('Too many extension authorization attempts')
  @Post('extension/authorize')
  @HttpCode(200)
  async extensionAuthorize(
    @Req() request: AuthRequest,
    @Body() body: ExtensionAuthorizeDto,
  ): Promise<{ redirectUrl: string }> {
    const { code, callbackUrl } =
      await this.extensionAuthService.authorizeExtension(
        request.user.userId,
        body.codeChallenge,
        body.redirectUri,
      );

    const destination = new URL(callbackUrl);
    destination.searchParams.set('code', code);
    return { redirectUrl: destination.toString() };
  }

  @ApiOperation({ summary: 'Decline a browser-extension authorization' })
  @ApiResponse({
    status: 302,
    description:
      'Redirects to the extension callback with error=access_denied, or' +
      ' back into the app when the callback is not on the allowlist.',
  })
  @Get('extension/deny')
  @Redirect()
  extensionDeny(@Query('redirect_uri') redirectUri?: string): {
    url: string;
  } {
    return { url: this.extensionAuthService.denialRedirect(redirectUri ?? '') };
  }

  @ApiOperation({ summary: 'Exchange extension auth code for token pair' })
  @ApiResponse({
    status: 200,
    description: 'Returns accessToken and refreshToken.',
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid code or PKCE verifier.',
  })
  @ApiResponse({
    status: 429,
    description: 'Too many extension token-exchange attempts.',
  })
  @UseGuards(CustomThrottlerGuard)
  @Throttle({ default: { ttl: 60000, limit: 20 } })
  @ThrottleMessage('Too many extension token-exchange attempts')
  @Post('extension/token')
  @HttpCode(200)
  async extensionToken(@Body() body: ExtensionTokenDto) {
    return this.extensionAuthService.exchangeExtensionCode(
      body.code,
      body.codeVerifier,
    );
  }
}
