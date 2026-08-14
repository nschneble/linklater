import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

/**
 * Request body for `POST /auth/extension/authorize`. Starts the PKCE
 * authorization the extension finishes at `POST /auth/extension/token`.
 *
 * A body rather than query parameters because the route needs a session
 * JWT, and the page reaching it is a single-page app that can only attach
 * one to a `fetch`. A top-level navigation, which is what the browser
 * would perform against a redirecting endpoint, carries no Authorization
 * header at all.
 */
export class ExtensionAuthorizeDto {
  @ApiProperty({
    description:
      'PKCE code challenge: base64url-encoded SHA-256 of the verifier the' +
      ' extension keeps until the token exchange.',
    example: 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
  })
  @IsString()
  @MinLength(1)
  codeChallenge: string;

  @ApiProperty({
    description:
      'Extension callback URL the auth code is appended to. Must appear in' +
      ' the server-side EXTENSION_REDIRECT_URIS allowlist.',
    example: 'chrome-extension://abc/callback',
  })
  @IsString()
  @MinLength(1)
  redirectUri: string;
}
