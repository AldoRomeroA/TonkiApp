-- Persist selected airdrop payout asset on configuration.
ALTER TABLE `AirdropConfig`
ADD COLUMN `asset` VARCHAR(10) NOT NULL DEFAULT 'TONKI';
