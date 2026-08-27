import * as dotenv from 'dotenv';
import { Global, Logger, Module } from '@nestjs/common';
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

        const boss = new PgBoss({
          connectionString: connectionString,
          max: 5,
        });

        // unlistened 'error' events crash the whole process, not just the job
        const logger = new Logger('PgBoss');
        boss.on('error', (error) => logger.error(error));

        return boss;
      },
    },
    QueueService,
  ],
  exports: [QueueService],
})
export class QueueModule {}
