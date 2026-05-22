set lock_timeout = '1s';
set statement_timeout = '5s';

alter table "User" add column "welcomedAt" timestamp(3);

update "User" set "welcomedAt" = now() where "welcomedAt" is null;
