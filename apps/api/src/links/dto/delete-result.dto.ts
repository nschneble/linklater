import { ApiProperty } from '@nestjs/swagger';

/** Response shape for DELETE /links/:id. */
export class DeleteResultDto {
  @ApiProperty({ example: true, description: 'Always true on success.' })
  success: true;
}

/** Response shape for DELETE /links/read (bulk delete of read links). */
export class BulkDeleteResultDto {
  @ApiProperty({
    example: 5,
    description: 'Number of links deleted by the bulk operation.',
  })
  count: number;
}
