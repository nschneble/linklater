import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { CustomThrottlerGuard } from './custom-throttler.guard.js';
import { ExtensionAuthService } from './extension-auth.service.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';
import { ThrottleMessage } from './throttle-message.decorator.js';
import { ExtensionTokenDto } from './dto/extension-token.dto.js';
import type { AuthRequest } from './auth-request.type.js';

/**
 * Browser-extension PKCE authorization endpoints. Authorize step requires a
 * full browser session JWT; the token exchange is public and validates the
 * verifier against the stored challenge.
 */
@ApiTags('auth')
@Controller('auth')
export class ExtensionAuthController {
  constructor(private readonly extensionAuthService: ExtensionAuthService) {}

  @ApiOperation({ summary: 'Authorize a browser extension (PKCE flow)' })
  @ApiBearerAuth()
  @ApiQuery({
    name: 'code_challenge',
    required: true,
    description:
      'PKCE code challenge: base64url-encoded SHA-256 of the verifier.',
  })
  @ApiQuery({
    name: 'redirect_uri',
    required: true,
    description:
      'Extension callback URL the auth code is appended to on redirect.',
  })
  @ApiResponse({
    status: 302,
    description: 'Redirects to redirect_uri with auth code.',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid redirect_uri or missing parameters.',
  })
  @ApiResponse({ status: 401, description: 'Missing or invalid JWT.' })
  @UseGuards(JwtAuthGuard)
  @Get('extension/authorize')
  async extensionAuthorize(
    @Req() request: AuthRequest,
    @Res() response: Response,
    @Query('code_challenge') codeChallenge: string,
    @Query('redirect_uri') redirectUri: string,
  ) {
    const { code, callbackUrl } =
      await this.extensionAuthService.authorizeExtension(
        request.user.userId,
        codeChallenge,
        redirectUri,
      );

    const destination = new URL(callbackUrl);
    destination.searchParams.set('code', code);
    response.redirect(destination.toString());
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
