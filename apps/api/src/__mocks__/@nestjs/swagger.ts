/**
 * Stub for @nestjs/swagger used in Jest unit tests. All Swagger decorators
 * are no-ops in the test environment because they only affect OpenAPI
 * documentation.
 */

const noopDecorator =
  () =>
  (..._arguments: unknown[]) => {};

export const ApiBearerAuth = noopDecorator;
export const ApiOperation = noopDecorator;
export const ApiParam = noopDecorator;
export const ApiProperty = noopDecorator;
export const ApiPropertyOptional = noopDecorator;
export const ApiQuery = noopDecorator;
export const ApiResponse = noopDecorator;
export const ApiTags = noopDecorator;
