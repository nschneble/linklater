import { SetMetadata } from '@nestjs/common';

export const THROTTLE_MESSAGE_KEY = 'throttleMessage';

export const ThrottleMessage = (message: string) =>
  SetMetadata(THROTTLE_MESSAGE_KEY, message);
