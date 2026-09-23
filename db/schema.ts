// Intentionally empty by default.
// Add Drizzle tables here when the site actually needs a database.
// See examples/d1/db/schema.ts for an opt-in example.
export {};
import { sqliteTable, text, integer, uniqueIndex, index } from 'drizzle-orm/sqlite-core';

export const connections = sqliteTable('connections', {
  id: text('id').primaryKey(), owner: text('owner').notNull(), channel: text('channel').notNull(),
  product: text('product').notNull(), account: text('account').notNull(), name: text('name').notNull(),
  secret: text('secret').notNull(), status: text('status').notNull().default('unverified'),
  authGrantId: text('auth_grant_id'),
  expiresAt: text('expires_at'), verifiedAt: text('verified_at'), lastError: text('last_error'),
  createdAt: text('created_at').notNull(), updatedAt: text('updated_at').notNull(),
}, t => [uniqueIndex('unique_connection_scope').on(t.owner,t.channel,t.product,t.account)]);

export const channelApps = sqliteTable('channel_apps', {
  id: text('id').primaryKey(), owner: text('owner').notNull(), channel: text('channel').notNull(),
  appName: text('app_name').notNull(), appType: text('app_type').notNull(), appId: text('app_id').notNull(),
  secret: text('secret').notNull(), authorizationUrl: text('authorization_url').notNull(),
  redirectUri: text('redirect_uri').notNull(), scopes: text('scopes').notNull().default('[]'),
  materialAuth: integer('material_auth').notNull().default(0), status: text('status').notNull().default('configured'),
  lastError: text('last_error'), createdAt: text('created_at').notNull(), updatedAt: text('updated_at').notNull(),
}, t => [uniqueIndex('unique_channel_app').on(t.owner,t.channel,t.appId),index('channel_apps_owner_channel').on(t.owner,t.channel)]);

export const oauthGrants = sqliteTable('oauth_grants', {
  id: text('id').primaryKey(), owner: text('owner').notNull(), channel: text('channel').notNull(),
  appConfigId: text('app_config_id').notNull(), token: text('token').notNull(),
  status: text('status').notNull().default('active'), accessExpiresAt: text('access_expires_at'),
  refreshExpiresAt: text('refresh_expires_at'), authorizedAt: text('authorized_at').notNull(),
  lastRefreshedAt: text('last_refreshed_at'), lastError: text('last_error'),
  createdAt: text('created_at').notNull(), updatedAt: text('updated_at').notNull(),
}, t => [index('oauth_grants_owner_channel').on(t.owner,t.channel,t.status)]);

export const authorizedAccounts = sqliteTable('authorized_accounts', {
  id: text('id').primaryKey(), owner: text('owner').notNull(), channel: text('channel').notNull(),
  grantId: text('grant_id').notNull(), accountId: text('account_id').notNull(),
  accountName: text('account_name').notNull(), accountType: text('account_type').notNull(),
  parentAccountId: text('parent_account_id'), source: text('source').notNull(),
  isValid: integer('is_valid').notNull().default(1), selectable: integer('selectable').notNull().default(1),
  createdAt: text('created_at').notNull(), updatedAt: text('updated_at').notNull(),
}, t => [uniqueIndex('unique_authorized_account').on(t.grantId,t.accountId),index('authorized_accounts_owner_grant').on(t.owner,t.grantId)]);

export const oauthStates = sqliteTable('oauth_states', {
  stateHash: text('state_hash').primaryKey(), owner: text('owner').notNull(), channel: text('channel').notNull(),
  appConfigId: text('app_config_id').notNull(), grantId: text('grant_id'), returnPath: text('return_path').notNull().default('/'),
  expiresAt: text('expires_at').notNull(), consumedAt: text('consumed_at'), createdAt: text('created_at').notNull(),
}, t => [index('oauth_states_owner_expiry').on(t.owner,t.expiresAt)]);

export const runs = sqliteTable('runs', {
  id: text('id').primaryKey(), owner: text('owner').notNull(), connectionId: text('connection_id').notNull(),
  channel: text('channel').notNull(), product: text('product').notNull(), account: text('account').notNull(),
  day: text('day').notNull(), dimension: text('dimension').notNull(), parent: text('parent').notNull().default(''),
  scopeKey: text('scope_key').notNull(), baseRunId: text('base_run_id'), status: text('status').notNull(),
  count: integer('count').notNull().default(0), requests: integer('requests').notNull().default(0),
  error: text('error'), evidence: text('evidence'), createdAt: text('created_at').notNull(), finishedAt: text('finished_at'),
}, t => [index('runs_owner_date').on(t.owner,t.createdAt)]);

export const reportRows = sqliteTable('report_rows', {
  id: text('id').primaryKey(), runId: text('run_id').notNull(), rowKey: text('row_key').notNull(),
  payload: text('payload').notNull(),
}, t => [uniqueIndex('unique_report_run_row').on(t.runId,t.rowKey)]);

export const partitions = sqliteTable('report_partitions', {
  scopeKey: text('scope_key').primaryKey(), owner: text('owner').notNull(), activeRunId: text('active_run_id'), updatedAt: text('updated_at').notNull(),
}, t => [index('partition_owner').on(t.owner)]);

export const reportSchedules = sqliteTable('report_schedules', {
  id: text('id').primaryKey(), owner: text('owner').notNull(), connectionId: text('connection_id').notNull(),
  dataTopic: text('data_topic').notNull(), dimensions: text('dimensions').notNull(), metrics: text('metrics').notNull(),
  startDate: text('start_date').notNull(), endDate: text('end_date'), nextDate: text('next_date').notNull(),
  warehouseName: text('warehouse_name').notNull(), warehouseUrl: text('warehouse_url').notNull(),
  warehouseSecret: text('warehouse_secret'), status: text('status').notNull().default('active'),
  lastRunAt: text('last_run_at'), lastSuccessDate: text('last_success_date'), lastError: text('last_error'),
  createdAt: text('created_at').notNull(), updatedAt: text('updated_at').notNull(),
}, t => [index('report_schedules_owner_status').on(t.owner,t.status),index('report_schedules_next_date').on(t.status,t.nextDate)]);
