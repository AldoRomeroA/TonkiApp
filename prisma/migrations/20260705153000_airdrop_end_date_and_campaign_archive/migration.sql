-- AlterTable
ALTER TABLE `AirdropConfig` ADD COLUMN `scheduled_end_date` DATETIME(3) NULL;

-- CreateTable
CREATE TABLE `AirdropCampaignArchive` (
    `archive_id` CHAR(36) NOT NULL,
    `config_id` CHAR(36) NOT NULL,
    `admin_id` CHAR(36) NOT NULL,
    `establishment_id` CHAR(36) NULL,
    `campaign_start` DATETIME(3) NOT NULL,
    `campaign_end` DATETIME(3) NOT NULL,
    `balance_sent` DOUBLE NOT NULL DEFAULT 0,
    `users_sent` INTEGER NOT NULL DEFAULT 0,
    `visitors_count` INTEGER NOT NULL DEFAULT 0,
    `purchase_count` INTEGER NOT NULL DEFAULT 0,
    `total_spent` DOUBLE NOT NULL DEFAULT 0,
    `archived_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `AirdropCampaignArchive_config_id_key`(`config_id`),
    INDEX `AirdropCampaignArchive_admin_id_campaign_end_idx`(`admin_id`, `campaign_end` DESC),
    PRIMARY KEY (`archive_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `AirdropCampaignArchive` ADD CONSTRAINT `AirdropCampaignArchive_config_id_fkey` FOREIGN KEY (`config_id`) REFERENCES `AirdropConfig`(`config_id`) ON DELETE CASCADE ON UPDATE CASCADE;
