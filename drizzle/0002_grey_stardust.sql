CREATE TABLE `interrogation_records` (
	`id` int AUTO_INCREMENT NOT NULL,
	`caseId` int NOT NULL,
	`status` enum('pending','generating','draft','finalized') NOT NULL DEFAULT 'pending',
	`startTime` varchar(32),
	`endTime` varchar(32),
	`location` varchar(256),
	`questions` json,
	`rawGenerated` text,
	`generatedAt` timestamp,
	`finalizedAt` timestamp,
	`finalizedBy` int,
	CONSTRAINT `interrogation_records_id` PRIMARY KEY(`id`),
	CONSTRAINT `interrogation_records_caseId_unique` UNIQUE(`caseId`)
);
--> statement-breakpoint
ALTER TABLE `reporters` ADD `registeredAddress` text;--> statement-breakpoint
ALTER TABLE `reporters` ADD `gender` varchar(8);--> statement-breakpoint
ALTER TABLE `reporters` ADD `birthPlace` varchar(64);--> statement-breakpoint
ALTER TABLE `reporters` ADD `occupation` varchar(64);--> statement-breakpoint
ALTER TABLE `reporters` ADD `education` varchar(32);--> statement-breakpoint
ALTER TABLE `reporters` ADD `economicStatus` varchar(16);--> statement-breakpoint
ALTER TABLE `reporters` ADD `aliasId` varchar(32);