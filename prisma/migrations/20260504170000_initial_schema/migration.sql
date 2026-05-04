-- CreateTable
CREATE TABLE `User` (
    `user_id` CHAR(36) NOT NULL,
    `email` VARCHAR(100) NULL,
    `name` VARCHAR(100) NOT NULL,
    `wallet_address` VARCHAR(191) NULL,
    `age` INTEGER NULL,
    `birth_date` DATETIME(3) NULL,
    `type` VARCHAR(100) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'active',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`user_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Post` (
    `post_id` CHAR(36) NOT NULL,
    `author_id` CHAR(36) NOT NULL,
    `title` VARCHAR(500) NOT NULL,
    `body` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `Post_created_at_post_id_idx`(`created_at` DESC, `post_id` ASC),
    PRIMARY KEY (`post_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PostAttachment` (
    `attachment_id` CHAR(36) NOT NULL,
    `post_id` CHAR(36) NOT NULL,
    `url` VARCHAR(2048) NOT NULL,
    `mime_type` VARCHAR(255) NOT NULL,
    `original_name` VARCHAR(255) NULL,

    INDEX `PostAttachment_post_id_idx`(`post_id`),
    PRIMARY KEY (`attachment_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Credential` (
    `credential_id` CHAR(36) NOT NULL,
    `user_id` CHAR(36) NOT NULL,
    `username` VARCHAR(100) NOT NULL,
    `password_hash` VARCHAR(256) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Credential_username_key`(`username`),
    PRIMARY KEY (`credential_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Establishment` (
    `establishment_id` CHAR(36) NOT NULL,
    `admin_id` CHAR(36) NOT NULL,
    `name` VARCHAR(150) NOT NULL,
    `address` VARCHAR(255) NULL,
    `category` VARCHAR(100) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`establishment_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Reward` (
    `reward_id` CHAR(36) NOT NULL,
    `user_id` CHAR(36) NOT NULL,
    `establishment_id` CHAR(36) NOT NULL,
    `title` VARCHAR(150) NOT NULL,
    `description` VARCHAR(191) NULL,
    `points` INTEGER NOT NULL DEFAULT 0,
    `status` VARCHAR(191) NOT NULL DEFAULT 'active',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`reward_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AirdropConfig` (
    `config_id` CHAR(36) NOT NULL,
    `user_id` CHAR(36) NOT NULL,
    `amount` DOUBLE NOT NULL,
    `scheduled_date` DATETIME(3) NOT NULL,
    `periodicity_months` INTEGER NOT NULL,
    `max_users` INTEGER NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`config_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AirdropLog` (
    `log_id` CHAR(36) NOT NULL,
    `config_id` CHAR(36) NOT NULL,
    `transaction_hash` VARCHAR(100) NULL,
    `total_amount` DOUBLE NOT NULL,
    `users_involved` INTEGER NOT NULL,
    `executed_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `success` BOOLEAN NOT NULL DEFAULT true,
    `error_message` VARCHAR(255) NULL,
    `response_json` VARCHAR(191) NULL,

    PRIMARY KEY (`log_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Post` ADD CONSTRAINT `Post_author_id_fkey` FOREIGN KEY (`author_id`) REFERENCES `User`(`user_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PostAttachment` ADD CONSTRAINT `PostAttachment_post_id_fkey` FOREIGN KEY (`post_id`) REFERENCES `Post`(`post_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Credential` ADD CONSTRAINT `Credential_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `User`(`user_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Establishment` ADD CONSTRAINT `Establishment_admin_id_fkey` FOREIGN KEY (`admin_id`) REFERENCES `User`(`user_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Reward` ADD CONSTRAINT `Reward_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `User`(`user_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Reward` ADD CONSTRAINT `Reward_establishment_id_fkey` FOREIGN KEY (`establishment_id`) REFERENCES `Establishment`(`establishment_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AirdropConfig` ADD CONSTRAINT `AirdropConfig_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `User`(`user_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AirdropLog` ADD CONSTRAINT `AirdropLog_config_id_fkey` FOREIGN KEY (`config_id`) REFERENCES `AirdropConfig`(`config_id`) ON DELETE RESTRICT ON UPDATE CASCADE;
