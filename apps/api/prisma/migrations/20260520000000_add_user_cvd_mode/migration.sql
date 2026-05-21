set lock_timeout = '1s';
set statement_timeout = '5s';

alter table "User" add column "cvdMode" boolean not null default false;
