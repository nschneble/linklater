import {
  registerDecorator,
  ValidatorConstraint,
  type ValidatorConstraintInterface,
  type ValidationOptions,
} from 'class-validator';
import { isPrivateHost } from './private-host.js';

/**
 * Rejects URLs whose hostname resolves to a loopback, RFC 1918, link-local,
 * or IPv6 unique-local address. Runs at validation time so private-network
 * URLs are rejected at the DTO layer rather than reaching the fetch worker.
 */
@ValidatorConstraint({ name: 'isPublicUrl', async: false })
export class IsPublicUrlConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    if (typeof value !== 'string') return false;

    let hostname: string;
    try {
      hostname = new URL(value).hostname;
    } catch {
      return false;
    }

    return !isPrivateHost(hostname);
  }

  defaultMessage(): string {
    return 'Url must not point to a private or loopback address';
  }
}

export function IsPublicUrl(options?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options,
      validator: IsPublicUrlConstraint,
    });
  };
}
