import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { RandomLinkQueryDto } from './random-link-query.dto.js';
import type { ArgumentMetadata } from '@nestjs/common';

const META: ArgumentMetadata = {
  type: 'query',
  metatype: RandomLinkQueryDto,
  data: '',
};

const pipe = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
});

describe('RandomLinkQueryDto', () => {
  it('coerces read=true to the boolean true', async () => {
    const result = await pipe.transform({ read: 'true' }, META);
    expect(result.read).toBe(true);
  });

  it('coerces read=false to the boolean false', async () => {
    const result = await pipe.transform({ read: 'false' }, META);
    expect(result.read).toBe(false);
  });

  it('leaves omitted read undefined so the service defaults to unread', async () => {
    const result = await pipe.transform({}, META);
    expect(result.read).toBeUndefined();
  });

  it('rejects a non-boolean read with 400', async () => {
    await expect(
      pipe.transform({ read: 'maybe' }, META),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
