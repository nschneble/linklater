import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Metadata extracted from the link's destination URL (Open Graph tags,
 * title, favicon, image). Populated asynchronously by the metadata-fetch
 * worker, so any field except `id` and `linkId` may be `null` until the
 * fetch completes.
 */
export class MetaResponseDto {
  @ApiProperty({ example: 'clz1abc123' })
  id: string;

  @ApiProperty({ example: 'clz1xyz456' })
  linkId: string;

  @ApiPropertyOptional({ example: 'Example Domain' })
  title: string | null;

  @ApiPropertyOptional({
    example: 'This domain is for use in illustrative examples in documents.',
  })
  description: string | null;

  @ApiPropertyOptional({ example: 'https://example.com/og-image.png' })
  imageUrl: string | null;

  @ApiPropertyOptional({ example: 'https://example.com/favicon.ico' })
  faviconUrl: string | null;

  @ApiPropertyOptional({ example: 'Example' })
  siteName: string | null;

  @ApiPropertyOptional({
    example: 'opengraph',
    description: 'Where the metadata was sourced from.',
  })
  source: string | null;

  @ApiPropertyOptional({
    example: '2026-05-27T12:00:00.000Z',
    description: 'When the metadata fetch completed. Null until the job runs.',
  })
  fetchedAt: string | null;

  @ApiProperty({ example: '2026-05-27T12:00:00.000Z' })
  createdAt: string;

  @ApiProperty({ example: '2026-05-27T12:00:00.000Z' })
  updatedAt: string;
}

/** Response shape for a single saved link. */
export class LinkResponseDto {
  @ApiProperty({ example: 'clz1xyz456' })
  id: string;

  @ApiProperty({ example: 'https://example.com/great-article' })
  url: string;

  @ApiPropertyOptional({
    type: () => MetaResponseDto,
    nullable: true,
    description: 'Extracted metadata. Null until the fetch worker completes.',
  })
  meta: MetaResponseDto | null;

  @ApiProperty({ example: '2026-05-27T12:00:00.000Z' })
  createdAt: string;

  @ApiProperty({ example: '2026-05-27T12:00:00.000Z' })
  updatedAt: string;

  @ApiPropertyOptional({
    example: null,
    description:
      'Timestamp the link was marked read. Null while the link is unread.',
  })
  readAt: string | null;
}
