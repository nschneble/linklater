import * as dotenv from 'dotenv';
import { Global, Module } from '@nestjs/common';
import { PgBoss } from 'pg-boss';
import { PGBOSS_INSTANCE } from './queue.constants.js';
import { QueueService } from './queue.service.js';

dotenv.config();

@Global()
@Module({
  providers: [
    {
      provide: PGBOSS_INSTANCE,
      useFactory: () => {
        const connectionString = process.env.DATABASE_URL;
        if (!connectionString) throw new Error('DATABASE_URL is not set');

        return new PgBoss({
          connectionString: connectionString,
          max: 5,
        });
      },
    },
    QueueService,
  ],
  exports: [QueueService],
})
export class QueueModule {}
