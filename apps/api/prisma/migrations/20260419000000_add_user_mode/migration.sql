ALTER TABLE "User" ADD COLUMN "mode" TEXT NOT NULL DEFAULT 'dark';

UPDATE "User" SET "mode"  = 'light'          WHERE "theme" =   'light';
UPDATE "User" SET "theme" = 'scanner-darkly' WHERE "theme" IN ('light', 'dark');
