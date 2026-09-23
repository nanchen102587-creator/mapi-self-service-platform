CREATE TABLE `connections` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`channel` text NOT NULL,
	`product` text NOT NULL,
	`account` text NOT NULL,
	`name` text NOT NULL,
	`secret` text NOT NULL,
	`status` text DEFAULT 'unverified' NOT NULL,
	`expires_at` text,
	`verified_at` text,
	`last_error` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `unique_connection_scope` ON `connections` (`owner`,`channel`,`product`,`account`);--> statement-breakpoint
CREATE TABLE `report_partitions` (
	`scope_key` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`active_run_id` text,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `partition_owner` ON `report_partitions` (`owner`);--> statement-breakpoint
CREATE TABLE `report_rows` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`row_key` text NOT NULL,
	`payload` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `unique_report_run_row` ON `report_rows` (`run_id`,`row_key`);--> statement-breakpoint
CREATE TABLE `runs` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`connection_id` text NOT NULL,
	`channel` text NOT NULL,
	`product` text NOT NULL,
	`account` text NOT NULL,
	`day` text NOT NULL,
	`dimension` text NOT NULL,
	`parent` text DEFAULT '' NOT NULL,
	`scope_key` text NOT NULL,
	`base_run_id` text,
	`status` text NOT NULL,
	`count` integer DEFAULT 0 NOT NULL,
	`requests` integer DEFAULT 0 NOT NULL,
	`error` text,
	`evidence` text,
	`created_at` text NOT NULL,
	`finished_at` text
);
--> statement-breakpoint
CREATE INDEX `runs_owner_date` ON `runs` (`owner`,`created_at`);