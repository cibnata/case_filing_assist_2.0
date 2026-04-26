CREATE TABLE `cases` (
	`id` int AUTO_INCREMENT NOT NULL,
	`caseNumber` varchar(64) NOT NULL,
	`qrToken` varchar(128) NOT NULL,
	`officerId` int NOT NULL,
	`officerName` varchar(64) NOT NULL,
	`officerUnit` varchar(128) NOT NULL,
	`status` enum('pending','submitted','ocr_pending','ocr_done','analyzing','analyzed','closed') NOT NULL DEFAULT 'pending',
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `cases_id` PRIMARY KEY(`id`),
	CONSTRAINT `cases_caseNumber_unique` UNIQUE(`caseNumber`),
	CONSTRAINT `cases_qrToken_unique` UNIQUE(`qrToken`)
);
--> statement-breakpoint
CREATE TABLE `evidence_files` (
	`id` int AUTO_INCREMENT NOT NULL,
	`caseId` int NOT NULL,
	`storageKey` varchar(512) NOT NULL,
	`storageUrl` text NOT NULL,
	`originalName` varchar(256),
	`mimeType` varchar(64),
	`fileSize` bigint,
	`uploadedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `evidence_files_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `intel_reports` (
	`id` int AUTO_INCREMENT NOT NULL,
	`caseId` int NOT NULL,
	`caseSummary` text,
	`victim` json,
	`suspects` json,
	`relatedAccounts` json,
	`timeline` json,
	`walletAddresses` json,
	`unverified` json,
	`rawAnalysis` text,
	`analyzedAt` timestamp,
	`analyzedBy` int,
	CONSTRAINT `intel_reports_id` PRIMARY KEY(`id`),
	CONSTRAINT `intel_reports_caseId_unique` UNIQUE(`caseId`)
);
--> statement-breakpoint
CREATE TABLE `ocr_results` (
	`id` int AUTO_INCREMENT NOT NULL,
	`caseId` int NOT NULL,
	`rawText` text,
	`confirmedText` text,
	`status` enum('pending','processing','done','confirmed') NOT NULL DEFAULT 'pending',
	`processedAt` timestamp,
	`confirmedAt` timestamp,
	`confirmedBy` int,
	CONSTRAINT `ocr_results_id` PRIMARY KEY(`id`),
	CONSTRAINT `ocr_results_caseId_unique` UNIQUE(`caseId`)
);
--> statement-breakpoint
CREATE TABLE `reporters` (
	`id` int AUTO_INCREMENT NOT NULL,
	`caseId` int NOT NULL,
	`name` varchar(64) NOT NULL,
	`idNumber` varchar(10) NOT NULL,
	`birthDate` varchar(16) NOT NULL,
	`address` text NOT NULL,
	`caseType` varchar(64) NOT NULL,
	`phone` varchar(20),
	`submittedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `reporters_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `wallet_profiles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`caseId` int NOT NULL,
	`address` varchar(128) NOT NULL,
	`chain` varchar(32) NOT NULL,
	`createTime` varchar(64),
	`lastTransactionDate` varchar(64),
	`transactionTimes` int,
	`transInTimes` int,
	`transInAmount` varchar(64),
	`transOutTimes` int,
	`transOutAmount` varchar(64),
	`trc20Ledger` json,
	`rawData` json,
	`queriedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `wallet_profiles_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `users` ADD `unit` varchar(128);--> statement-breakpoint
ALTER TABLE `users` ADD `badgeNumber` varchar(32);