import { AuthGuard } from '@nestjs/passport';
import { consumeOAuthState, issueOAuthState } from './oauth-state-cookie.js';
import { Injectable, UnauthorizedException, mixin } from '@nestjs/common';
import {
  ProviderEmailUnverifiedException,
  redirectOAuthSignInFailure,
} from './oauth-sign-in-failure.js';
import type { CanActivate, ExecutionContext, Type } from '@nestjs/common';
import type { IAuthModuleOptions } from '@nestjs/passport';
import type { OAuthSignInFailure } from './oauth-sign-in-failure.js';
import type { Request, Response } from 'express';

/** Request augmented with the nonce `OAuthInitiateGuard` stashes for `getAuthenticateOptions`. */
type RequestWithOAuthNonce = Request & { oauthStateNonce?: string };

/**
 * Builds a guard for an OAuth sign-in INITIATE route (`GET /auth/<provider>`).
 * Issues the double-submit CSRF cookie (see `oauth-state-cookie.ts`) and
 * passes the same nonce through as the provider's `state` param via
 * `getAuthenticateOptions` – stashed on the request object, not on `this`,
 * because Nest guards are singleton-scoped by default and a field on the
 * instance would leak between concurrent requests.
 */
export function createOAuthInitiateGuard(
  strategyName: string,
): Type<CanActivate> {
  @Injectable()
  class OAuthInitiateGuard extends AuthGuard(strategyName) {
    override canActivate(context: ExecutionContext) {
      const request = context
        .switchToHttp()
        .getRequest<RequestWithOAuthNonce>();
      const response = context.switchToHttp().getResponse<Response>();
      request.oauthStateNonce = issueOAuthState(response);
      return super.canActivate(context);
    }

    override getAuthenticateOptions(
      context: ExecutionContext,
    ): IAuthModuleOptions {
      const request = context
        .switchToHttp()
        .getRequest<RequestWithOAuthNonce>();
      return { state: request.oauthStateNonce };
    }
  }
  return mixin(OAuthInitiateGuard);
}

/** Picks the login-page failure code for whatever the strategy reported. */
function failureFor(error: unknown): OAuthSignInFailure {
  if (error instanceof ProviderEmailUnverifiedException) {
    return 'provider_email_unverified';
  }
  return 'oauth_failed';
}

/**
 * Builds a guard for an OAuth sign-in CALLBACK route. Verifies the
 * double-submit state cookie BEFORE the strategy exchanges the code with the
 * provider, so a forged/replayed callback (CWE-352 login-CSRF) is rejected
 * without spending a network round-trip on it.
 *
 * Both refusal paths redirect to the SPA's login page before rejecting. The
 * rejection is still what stops the route handler from running, and it is
 * safe on top of a sent response: Nest's exception filter checks
 * `headersSent` and ends the response instead of writing JSON over the 302.
 * Without the redirect the browser, which reached this route as a top-level
 * navigation, would sit on the API origin staring at a JSON error body.
 */
export function createOAuthCallbackGuard(
  strategyName: string,
): Type<CanActivate> {
  @Injectable()
  class OAuthCallbackGuard extends AuthGuard(strategyName) {
    override canActivate(context: ExecutionContext) {
      const request = context.switchToHttp().getRequest<Request>();
      const response = context.switchToHttp().getResponse<Response>();
      if (!consumeOAuthState(request, response)) {
        // browser-back and replays land here, not just forgeries
        redirectOAuthSignInFailure(
          response,
          'oauth_state_invalid',
          strategyName,
        );
        // reject a Promise, not throw, to match AuthGuard.canActivate's return
        return Promise.reject(
          new UnauthorizedException('Invalid or expired OAuth state'),
        );
      }
      return super.canActivate(context);
    }

    /**
     * Catches everything the strategy refuses. `validate()` runs inside
     * `super.canActivate`, so a throw there never reaches the controller and
     * a try/catch around the post-login handler would never fire.
     */
    override handleRequest<TUser>(
      error: unknown,
      user: TUser | false,
      _info: unknown,
      context: ExecutionContext,
    ): TUser {
      if (error || !user) {
        const response = context.switchToHttp().getResponse<Response>();
        redirectOAuthSignInFailure(response, failureFor(error), strategyName);
      }
      if (error) throw error;
      if (!user) throw new UnauthorizedException();
      return user;
    }
  }
  return mixin(OAuthCallbackGuard);
}
