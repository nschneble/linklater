import { applyDecorators } from '@nestjs/common';
import { ApiResponse } from '@nestjs/swagger';

/**
 * Attaches the standard 401 response shape used by every PAT-callable
 * endpoint. Composed via `applyDecorators` so the rendered OpenAPI is
 * byte-for-byte identical to the inline `@ApiResponse({ status: 401, ... })`
 * it replaces — Scalar consumers see no change. Use on any controller
 * method guarded by `AnyAuthGuard` or `JwtAuthGuard`.
 *
 * @example
 * @ApiUnauthorized()
 * @Get()
 * async findAll(@Req() request: AuthRequest) { … }
 */
export const ApiUnauthorized = () =>
  applyDecorators(
    ApiResponse({
      status: 401,
      description: 'Missing or invalid token (JWT or PAT).',
    }),
  );
