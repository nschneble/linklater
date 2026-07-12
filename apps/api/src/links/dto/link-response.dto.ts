import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Metadata extracted from the link's destination URL (Open Graph tags,
 * title, favicon, image). Populated asynchronously by the metadata-fetch
 * worker, so any field except `id`, `linkId`, `createdAt`, and `updatedAt`
 * may be `null` until the fetch completes.
 */
export class MetaResponseDto {
  @ApiProperty({ example: 'clz1abc123' })
  id: string;

  @ApiProperty({ example: 'clz1xyz456' })
  linkId: string;

  @ApiProperty({ example: 'Programming Sucks', nullable: true })
  title: string | null;

  @ApiProperty({
    example: 'All programming teams are constructed by and of crazy people.',
    nullable: true,
  })
  description: string | null;

  @ApiProperty({
    example: 'https://www.stilldrinking.org/blog_images/programming-sucks.jpg',
    nullable: true,
  })
  imageUrl: string | null;

  @ApiProperty({
    example: 'http://www.stilldrinking.org/favicon.ico',
    nullable: true,
  })
  faviconUrl: string | null;

  @ApiProperty({ example: 'Still Drinking', nullable: true })
  siteName: string | null;

  @ApiProperty({
    example: '2026-05-27T12:00:00.000Z',
    description: "When this metadata was fetched. Null until it's not.",
    nullable: true,
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

  @ApiProperty({ example: 'http://www.stilldrinking.org/programming-sucks' })
  url: string;

  @ApiPropertyOptional({
    type: () => MetaResponseDto,
    nullable: true,
    description: "Link metadata. Null if the metadata hasn't been fetched.",
  })
  meta: MetaResponseDto | null;

  @ApiProperty({ example: '2026-05-27T12:00:00.000Z' })
  createdAt: string;

  @ApiProperty({ example: '2026-05-27T12:00:00.000Z' })
  updatedAt: string;

  @ApiProperty({
    example: null,
    description: 'Timestamp for when the link was read. Null if unread.',
    nullable: true,
  })
  readAt: string | null;
}
