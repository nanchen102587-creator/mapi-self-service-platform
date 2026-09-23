CREATE TABLE `report_schedules` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`connection_id` text NOT NULL,
	`data_topic` text NOT NULL,
	`dimensions` text NOT NULL,
	`metrics` text NOT NULL,
	`start_date` text NOT NULL,
	`end_date` text,
	`next_date` text NOT NULL,
	`warehouse_name` text NOT NULL,
	`warehouse_url` text NOT NULL,
	`warehouse_secret` text,
	`status` text DEFAULT 'active' NOT NULL,
	`last_run_at` text,
	`last_success_date` text,
	`last_error` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `report_schedules_owner_status` ON `report_schedules` (`owner`,`status`);--> statement-breakpoint
CREATE INDEX `report_schedules_next_date` ON `report_schedules` (`status`,`next_date`);