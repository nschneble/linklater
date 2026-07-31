import { Injectable, UnauthorizedException, mixin } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { consumeOAuthState, issueOAuthState } from './oauth-state-cookie.js';
import type { CanActivate, ExecutionContext, Type } from '@nestjs/common';
import type { IAuthModuleOptions } from '@nestjs/passport';
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

/**
 * Builds a guard for an OAuth sign-in CALLBACK route. Verifies the
 * double-submit state cookie BEFORE the strategy exchanges the code with the
 * provider, so a forged/replayed callback (CWE-352 login-CSRF) is rejected
 * without spending a network round-trip on it.
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
        // reject a Promise, not throw, to match AuthGuard.canActivate's return
        return Promise.reject(
          new UnauthorizedException('Invalid or expired OAuth state'),
        );
      }
      return super.canActivate(context);
    }
  }
  return mixin(OAuthCallbackGuard);
}
