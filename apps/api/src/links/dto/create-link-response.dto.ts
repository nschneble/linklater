import { ApiProperty } from '@nestjs/swagger';

import { LinkResponseDto } from './link-response.dto.js';

/**
 * Whether a save produced a brand-new link or brought an existing one back to
 * the top. Both are a successful 201; the frontend uses this to vary copy
 * ("Saved" vs "Already saved, moved to top").
 */
export type CreateLinkStatus = 'created' | 'resurfaced';

/**
 * Response shape for POST /links. Extends the plain link with a `status`
 * discriminator so the caller can tell a fresh save from a resurfaced one.
 * Other link endpoints keep returning `LinkResponseDto` without `status`.
 */
export class CreateLinkResponseDto extends LinkResponseDto {
  @ApiProperty({
    enum: ['created', 'resurfaced'],
    example: 'created',
    description:
      '"created" for a newly saved URL, "resurfaced" when the URL was already saved and got moved back to the top.',
  })
  status: CreateLinkStatus;
}
