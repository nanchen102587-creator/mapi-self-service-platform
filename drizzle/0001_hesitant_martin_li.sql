CREATE TABLE `authorized_accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`channel` text NOT NULL,
	`grant_id` text NOT NULL,
	`account_id` text NOT NULL,
	`account_name` text NOT NULL,
	`account_type` text NOT NULL,
	`parent_account_id` text,
	`source` text NOT NULL,
	`is_valid` integer DEFAULT 1 NOT NULL,
	`selectable` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `unique_authorized_account` ON `authorized_accounts` (`grant_id`,`account_id`);--> statement-breakpoint
CREATE INDEX `authorized_accounts_owner_grant` ON `authorized_accounts` (`owner`,`grant_id`);--> statement-breakpoint
CREATE TABLE `channel_apps` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`channel` text NOT NULL,
	`app_name` text NOT NULL,
	`app_type` text NOT NULL,
	`app_id` text NOT NULL,
	`secret` text NOT NULL,
	`authorization_url` text NOT NULL,
	`redirect_uri` text NOT NULL,
	`scopes` text DEFAULT '[]' NOT NULL,
	`material_auth` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'configured' NOT NULL,
	`last_error` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `unique_channel_app` ON `channel_apps` (`owner`,`channel`,`app_id`);--> statement-breakpoint
CREATE INDEX `channel_apps_owner_channel` ON `channel_apps` (`owner`,`channel`);--> statement-breakpoint
CREATE TABLE `oauth_grants` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`channel` text NOT NULL,
	`app_config_id` text NOT NULL,
	`token` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`access_expires_at` text,
	`refresh_expires_at` text,
	`authorized_at` text NOT NULL,
	`last_refreshed_at` text,
	`last_error` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `oauth_grants_owner_channel` ON `oauth_grants` (`owner`,`channel`,`status`);--> statement-breakpoint
CREATE TABLE `oauth_states` (
	`state_hash` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`channel` text NOT NULL,
	`app_config_id` text NOT NULL,
	`grant_id` text,
	`return_path` text DEFAULT '/' NOT NULL,
	`expires_at` text NOT NULL,
	`consumed_at` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `oauth_states_owner_expiry` ON `oauth_states` (`owner`,`expires_at`);--> statement-breakpoint
ALTER TABLE `connections` ADD `auth_grant_id` text;