import { Module } from '@nestjs/common';
import { LinksService } from './links.service.js';
import { LinksController } from './links.controller.js';
import { MetadataModule } from '../metadata/metadata.module.js';

@Module({
  imports: [MetadataModule],
  providers: [LinksService],
  controllers: [LinksController],
})
export class LinksModule {}
