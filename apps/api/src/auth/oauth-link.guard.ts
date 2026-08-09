import { AuthGuard } from '@nestjs/passport';
import {
  BadRequestException,
  Injectable,
  mixin,
  UnauthorizedException,
} from '@nestjs/common';
import { redirectOAuthLinkFailure } from './oauth-link-failure.js';
import type { CanActivate, ExecutionContext, Type } from '@nestjs/common';
import type { OAuthLinkFailure } from './oauth-link-failure.js';
import type { Request, Response } from 'express';

/**
 * Picks the settings-page code for whatever stopped the link.
 *
 * A link strategy reports an expired, tampered or replayed state as a bad
 * request. Everything else comes from the provider: a declined consent
 * screen names itself on the callback query string and arrives as a
 * refusal carrying no error, while any other provider trouble arrives as
 * an error raised during the exchange.
 */
function failureFor(error: unknown, request: Request): OAuthLinkFailure {
  if (error instanceof BadRequestException) return 'state_invalid';
  if (error) return 'provider_error';
  if (request.query?.error === 'access_denied') return 'cancelled';
  return 'unknown';
}

/**
 * Builds a guard for an OAuth account-linking CALLBACK route.
 *
 * Every refusal redirects to the SPA's settings page before rejecting. The
 * rejection is still what stops the route handler from running, and it is
 * safe on top of a sent response: Nest's exception filter checks whether
 * the headers are already sent and ends the response instead of writing
 * JSON over the 302. The strategy verifies the callback inside the guard,
 * so a refusal never reaches the controller and a try/catch around the
 * route handler cannot fire.
 */
export function createOAuthLinkCallbackGuard(
  strategyName: string,
): Type<CanActivate> {
  @Injectable()
  class OAuthLinkCallbackGuard extends AuthGuard(strategyName) {
    override handleRequest<TUser>(
      error: unknown,
      user: TUser | false,
      _info: unknown,
      context: ExecutionContext,
    ): TUser {
      if (error || !user) {
        const request = context.switchToHttp().getRequest<Request>();
        const response = context.switchToHttp().getResponse<Response>();
        redirectOAuthLinkFailure(response, failureFor(error, request));
      }
      if (error) throw error;
      if (!user) throw new UnauthorizedException();
      return user;
    }
  }
  return mixin(OAuthLinkCallbackGuard);
}
