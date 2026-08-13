import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Matches, MinLength } from 'class-validator';

/**
 * Request body for `POST /auth/refresh`. The refresh token is the raw
 * (un-hashed) token returned at login or at the end of any previous
 * refresh. Each token can only be used once; presenting it here deletes
 * it and returns a new rotated pair.
 *
 * A client may name the token that rotation should produce. That is what
 * lets it recover a rotation the server committed and answered on a
 * connection that died: it already holds the successor, so it can present
 * it on the next request instead of being signed out holding a token no
 * row matches. Only that client's own session is at stake in the value,
 * so the check is on shape alone, and a run of 64 zeros satisfies it. A
 * client that nominates something guessable weakens nothing but the
 * session it is naming for itself. The pattern carries the check alone:
 * `matches` type-guards before it tests, so anything that is
 * not a string fails it without a second decorator saying so. That is a
 * property of the decorator rather than of the expression it holds, and
 * the range on class-validator is a caret one, so the spec pins it with
 * values a bare test of the expression would accept.
 */
export class RefreshTokenDto {
  @ApiProperty({
    description:
      'The raw refresh token previously returned by login, magic link' +
      ' verification, or a prior refresh. Consumed on use – a new token' +
      ' is returned with every successful refresh.',
    example: 'a3f8c...64-character-hex-string...d91e',
  })
  @IsString()
  @MinLength(1)
  refreshToken: string;

  @ApiPropertyOptional({
    description:
      'The token the client asks this rotation to produce, so a rotation' +
      ' whose response is lost stays recoverable. 64 lowercase hex' +
      ' characters. Ignored when the hash is already taken.',
    example: '76752d9c27a74dc220dd7bd73b459790217dd0dda8fccee079c1153d43fb9fb7',
  })
  @IsOptional()
  @Matches(/^[0-9a-f]{64}$/, {
    message: 'nextRefreshToken must be 64 lowercase hexadecimal characters',
  })
  nextRefreshToken?: string;
}
