-- Split name parts + avatar for account profile editing.
ALTER TABLE `User`
ADD COLUMN `first_name` VARCHAR(50) NULL,
ADD COLUMN `paternal_surname` VARCHAR(50) NULL,
ADD COLUMN `maternal_surname` VARCHAR(50) NULL,
ADD COLUMN `avatar_url` VARCHAR(2048) NULL;
