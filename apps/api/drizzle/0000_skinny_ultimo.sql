CREATE TABLE `episode` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`item_id` integer NOT NULL,
	`season_id` integer NOT NULL,
	`end_date` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`item_id`) REFERENCES `item`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`season_id`) REFERENCES `media`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `episode_item_id_idx` ON `episode` (`item_id`);--> statement-breakpoint
CREATE INDEX `episode_season_id_idx` ON `episode` (`season_id`);--> statement-breakpoint
CREATE TABLE `item` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`media_id` text NOT NULL,
	`source` text NOT NULL,
	`media_type` text NOT NULL,
	`title` text NOT NULL,
	`image` text NOT NULL,
	`season_number` integer,
	`episode_number` integer,
	CONSTRAINT "item_season_numbering" CHECK("item"."media_type" <> 'season' OR ("item"."season_number" IS NOT NULL AND "item"."episode_number" IS NULL)),
	CONSTRAINT "item_episode_numbering" CHECK("item"."media_type" <> 'episode' OR ("item"."season_number" IS NOT NULL AND "item"."episode_number" IS NOT NULL)),
	CONSTRAINT "item_numbering_only_for_tv_parts" CHECK("item"."media_type" IN ('season', 'episode') OR ("item"."season_number" IS NULL AND "item"."episode_number" IS NULL))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `item_unique_without_season_episode` ON `item` (`media_id`,`source`,`media_type`) WHERE "item"."season_number" IS NULL AND "item"."episode_number" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `item_unique_with_season` ON `item` (`media_id`,`source`,`media_type`,`season_number`) WHERE "item"."season_number" IS NOT NULL AND "item"."episode_number" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `item_unique_with_season_episode` ON `item` (`media_id`,`source`,`media_type`,`season_number`,`episode_number`) WHERE "item"."season_number" IS NOT NULL AND "item"."episode_number" IS NOT NULL;--> statement-breakpoint
CREATE TABLE `item_link` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`item_id` integer NOT NULL,
	`source` text NOT NULL,
	`media_id` text NOT NULL,
	`season_number` integer,
	`episode_start` integer,
	`episode_end` integer,
	FOREIGN KEY (`item_id`) REFERENCES `item`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "item_link_range_complete" CHECK(("item_link"."episode_start" IS NULL) = ("item_link"."episode_end" IS NULL)),
	CONSTRAINT "item_link_range_needs_season" CHECK("item_link"."episode_start" IS NULL OR "item_link"."season_number" IS NOT NULL),
	CONSTRAINT "item_link_range_order" CHECK("item_link"."episode_start" IS NULL OR ("item_link"."episode_start" >= 1 AND "item_link"."episode_end" >= "item_link"."episode_start"))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `item_link_unique_whole_item` ON `item_link` (`source`,`media_id`,`item_id`) WHERE "item_link"."season_number" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `item_link_unique_whole_season` ON `item_link` (`source`,`media_id`,`item_id`,`season_number`) WHERE "item_link"."season_number" IS NOT NULL AND "item_link"."episode_start" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `item_link_unique_range` ON `item_link` (`source`,`media_id`,`item_id`,`season_number`,`episode_start`) WHERE "item_link"."episode_start" IS NOT NULL;--> statement-breakpoint
CREATE INDEX `item_link_item_id_idx` ON `item_link` (`item_id`);--> statement-breakpoint
CREATE TABLE `media` (
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
	CONSTRAINT "media_score_range" CHECK("media"."score" IS NULL OR "media"."score" BETWEEN 0 AND 10),
	CONSTRAINT "media_progress_non_negative" CHECK("media"."progress" >= 0)
);
--> statement-breakpoint
CREATE INDEX `media_item_id_idx` ON `media` (`item_id`);--> statement-breakpoint
CREATE INDEX `media_parent_id_idx` ON `media` (`parent_id`);