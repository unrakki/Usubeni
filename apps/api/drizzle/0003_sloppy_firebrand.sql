PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_media` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`item_id` integer NOT NULL,
	`parent_id` integer,
	`score` real,
	`progress` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'Completed' NOT NULL,
	`start_date` integer,
	`end_date` integer,
	`notes` text DEFAULT '' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`item_id`) REFERENCES `item`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`parent_id`) REFERENCES `media`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "media_score_range" CHECK("__new_media"."score" IS NULL OR "__new_media"."score" BETWEEN 0 AND 10),
	CONSTRAINT "media_status_valid" CHECK("__new_media"."status" IN ('Completed', 'In progress', 'Caught up', 'Planning', 'Paused', 'Dropped')),
	CONSTRAINT "media_progress_non_negative" CHECK("__new_media"."progress" >= 0)
);
--> statement-breakpoint
INSERT INTO `__new_media`("id", "item_id", "parent_id", "score", "progress", "status", "start_date", "end_date", "notes", "created_at") SELECT "id", "item_id", "parent_id", "score", "progress", "status", "start_date", "end_date", "notes", "created_at" FROM `media`;--> statement-breakpoint
DROP TABLE `media`;--> statement-breakpoint
ALTER TABLE `__new_media` RENAME TO `media`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `media_item_id_idx` ON `media` (`item_id`);--> statement-breakpoint
CREATE INDEX `media_parent_id_idx` ON `media` (`parent_id`);