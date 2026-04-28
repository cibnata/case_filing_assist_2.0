ALTER TABLE `evidence_files` ADD `ocrStatus` enum('pending','processing','done','failed') DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE `evidence_files` ADD `ocrText` longtext;--> statement-breakpoint
ALTER TABLE `evidence_files` ADD `ocrProcessedAt` timestamp;