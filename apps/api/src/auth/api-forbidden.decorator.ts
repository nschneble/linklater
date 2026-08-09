import { ApiResponse } from '@nestjs/swagger';
import { applyDecorators } from '@nestjs/common';

/**
 * Attaches the standard 403 response shape for endpoints that `AnyAuthGuard`
 * protects. A valid PAT still fails here when its kind is confined to a
 * narrower purpose than the route it is calling: `TokenScopeService` lets a
 * bookmarklet token through only on routes marked `@AllowsBookmarkletToken()`
 * and refuses the API docs token everywhere. Pairs with `ApiUnauthorized`,
 * which covers the missing-or-invalid case; the two are distinct outcomes and
 * an integrator needs to tell them apart.
 *
 * @example
 * @ApiForbidden()
 * @Get()
 * async findAll(@Req() request: AuthRequest) { … }
 */
export const ApiForbidden = () =>
  applyDecorators(
    ApiResponse({
      status: 403,
      description:
        'Indicates a token whose scope does not cover this route, such as the bookmarklet token outside link creation.',
    }),
  );
