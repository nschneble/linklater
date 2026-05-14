import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

interface MfaTokenPayload {
  subject: string;
  mfaPending: boolean;
}

/**
 * Guards the OTP verification endpoint by validating the short-lived MFA
 * challenge token submitted in the request body as `mfaToken`.
 *
 * Unlike `JwtAuthGuard` (which reads from `Authorization: Bearer`), this guard
 * reads `mfaToken` from the request body and only accepts tokens where
 * `mfaPending === true`. A full session JWT is rejected.
 */
@Injectable()
export class MfaAuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{
      body: Record<string, unknown>;
      user: unknown;
    }>();

    const mfaToken = request.body?.mfaToken;
    if (typeof mfaToken !== 'string' || !mfaToken) {
      throw new UnauthorizedException('MFA token is required');
    }

    let payload: MfaTokenPayload;
    try {
      payload = await this.jwtService.verifyAsync<MfaTokenPayload>(mfaToken);
    } catch {
      throw new UnauthorizedException('Invalid or expired MFA token');
    }

    if (!payload.mfaPending) {
      throw new UnauthorizedException('Invalid MFA token');
    }

    request.user = { userId: payload.subject, mfaPending: true };
    return true;
  }
}
