import { Global, Module } from '@nestjs/common';
import { PGBOSS_INSTANCE } from './queue.constants.js';
import { PgBoss } from 'pg-boss';
import { QueueService } from './queue.service.js';
import * as dotenv from 'dotenv';

dotenv.config();

@Global()
@Module({
  providers: [
    {
      provide: PGBOSS_INSTANCE,
      useFactory: () => {
        const connectionString = process.env.DATABASE_URL;
        if (!connectionString) throw new Error('DATABASE_URL is not set');

        return new PgBoss(connectionString);
      },
    },
    QueueService,
  ],
  exports: [QueueService],
})
export class QueueModule {}
