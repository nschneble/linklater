-- AddColumn mode to User
ALTER TABLE "User" ADD COLUMN "mode" TEXT NOT NULL DEFAULT 'dark';

-- Migrate existing users: set mode based on their current theme value
UPDATE "User" SET "mode" = 'light' WHERE "theme" = 'light';

-- Remap standalone 'light'/'dark' theme values to 'scanner-darkly'
UPDATE "User" SET "theme" = 'scanner-darkly' WHERE "theme" IN ('light', 'dark');
