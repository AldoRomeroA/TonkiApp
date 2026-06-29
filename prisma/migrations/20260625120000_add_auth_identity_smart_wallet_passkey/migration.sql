-- CreateTable
CREATE TABLE `AuthIdentity` (
    `identity_id` CHAR(36) NOT NULL,
    `user_id` CHAR(36) NOT NULL,
    `provider` VARCHAR(50) NOT NULL,
    `provider_subject` VARCHAR(255) NOT NULL,
    `email` VARCHAR(255) NULL,
    `email_verified` BOOLEAN NOT NULL DEFAULT false,
    `display_name` VARCHAR(255) NULL,
    `avatar_url` VARCHAR(2048) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `AuthIdentity_user_id_idx`(`user_id`),
    INDEX `AuthIdentity_email_idx`(`email`),
    UNIQUE INDEX `AuthIdentity_provider_provider_subject_key`(`provider`, `provider_subject`),
    PRIMARY KEY (`identity_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SmartWallet` (
    `wallet_id` CHAR(36) NOT NULL,
    `user_id` CHAR(36) NOT NULL,
    `network` VARCHAR(50) NOT NULL,
    `contract_address` VARCHAR(100) NOT NULL,
    `status` VARCHAR(50) NOT NULL DEFAULT 'pending',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `SmartWallet_user_id_idx`(`user_id`),
    UNIQUE INDEX `SmartWallet_network_contract_address_key`(`network`, `contract_address`),
    UNIQUE INDEX `SmartWallet_user_id_network_key`(`user_id`, `network`),
    PRIMARY KEY (`wallet_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PasskeyCredential` (
    `passkey_credential_id` CHAR(36) NOT NULL,
    `user_id` CHAR(36) NOT NULL,
    `wallet_id` CHAR(36) NULL,
    `credential_id` VARCHAR(512) NOT NULL,
    `public_key` TEXT NOT NULL,
    `public_key_algorithm` INTEGER NULL,
    `sign_count` BIGINT NOT NULL DEFAULT 0,
    `transports` JSON NULL,
    `device_label` VARCHAR(100) NULL,
    `last_used_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `PasskeyCredential_credential_id_key`(`credential_id`),
    INDEX `PasskeyCredential_user_id_idx`(`user_id`),
    INDEX `PasskeyCredential_wallet_id_idx`(`wallet_id`),
    PRIMARY KEY (`passkey_credential_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `AuthIdentity` ADD CONSTRAINT `AuthIdentity_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `User`(`user_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SmartWallet` ADD CONSTRAINT `SmartWallet_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `User`(`user_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PasskeyCredential` ADD CONSTRAINT `PasskeyCredential_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `User`(`user_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PasskeyCredential` ADD CONSTRAINT `PasskeyCredential_wallet_id_fkey` FOREIGN KEY (`wallet_id`) REFERENCES `SmartWallet`(`wallet_id`) ON DELETE SET NULL ON UPDATE CASCADE;
