// App-specific types for BucketFlow
// Do NOT re-export types already defined in types/index.ts (User, Notification, Bookmark, Achievement, SubscriptionState, ApiResponse, PaginatedResponse)

// ─── Supabase Row Types ────────────────────────────────────────────────────────

export interface UserRow {
  id: string;
  email: string;
  display_name: string | null;
  created_at: string;
  subscription_tier: string;
  trial_started_at: string | null;
  trial_ends_at: string | null;
  revenuecat_customer_id: string | null;
  onboarding_completed: boolean;
  avatar_initials: string | null;
  theme_preference: string;
  pay_frequency: string | null;
  pay_day: string | null;
  notifications_enabled: boolean;
  paycheck_reminder_enabled: boolean;
  due_date_warning_enabled: boolean;
  monthly_summary_notif_enabled: boolean;
  post_onboarding_upsell_shown_at: string | null;
  last_monthly_summary_shown: string | null;
  push_token: string | null;
  updated_at: string;
}

export interface BucketRow {
  id: string;
  user_id: string;
  name: string;
  target_amount: number;
  target_date: string;
  monthly_set_aside: number;
  total_saved: number;
  status: BucketStatus;
  template_id: string | null;
  archived_at: string | null;
  funded_at: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface ContributionRow {
  id: string;
  bucket_id: string;
  user_id: string;
  amount: number;
  contributed_on: string;
  note: string | null;
  running_total_after: number;
  created_at: string;
}

export interface BucketTemplateRow {
  id: string;
  name: string;
  icon_key: string;
  suggested_amount: number;
  smart_date_hint: string;
  smart_date_logic: SmartDateLogic;
  description: string | null;
  sort_order: number;
  is_active: boolean;
}

export interface FeedbackRow {
  id: string;
  user_id: string;
  feedback_type: FeedbackType;
  description: string;
  screenshot_url: string | null;
  os_version: string;
  app_version: string;
  device_model: string | null;
  created_at: string;
}

export interface NotificationLogRow {
  id: string;
  user_id: string;
  notification_type: NotificationLogType;
  bucket_id: string | null;
  scheduled_for: string;
  sent_at: string | null;
  status: NotificationLogStatus;
  expo_ticket_id: string | null;
  created_at: string;
}

export interface SubscriptionEventRow {
  id: string;
  user_id: string;
  event_type: SubscriptionEventType;
  revenuecat_product_id: string;
  price_usd: number | null;
  effective_at: string;
  expires_at: string | null;
  raw_payload: Record<string, unknown> | null;
  created_at: string;
}

// ─── Discriminated Union / Literal Types ──────────────────────────────────────

export type BucketStatus = 'active' | 'funded' | 'archived';

export type FeedbackType = 'bug' | 'feature_request' | 'general' | 'billing';

export type NotificationLogType = 'paycheck_reminder' | 'due_date_warning' | 'monthly_summary' | 'funded_celebration';

export type NotificationLogStatus = 'scheduled' | 'sent' | 'failed' | 'cancelled';

export type SubscriptionEventType =
  | 'initial_purchase'
  | 'renewal'
  | 'cancellation'
  | 'expiration'
  | 'trial_started'
  | 'trial_converted'
  | 'trial_cancelled'
  | 'billing_issue';

export type SubscriptionTier = 'free' | 'pro' | 'pro_annual';

export type PayFrequency = 'weekly' | 'biweekly' | 'semimonthly' | 'monthly';

export type ThemePreference = 'light' | 'dark' | 'system';

// ─── Computed / Derived Types ─────────────────────────────────────────────────

export interface BucketWithContributions extends BucketRow {
  contributions: ContributionRow[];
}

export interface LogContributionResult {
  contribution: ContributionRow;
  bucket: BucketRow;
}

export interface MonthlyContributionSummary {
  bucket_id: string;
  bucket_name: string;
  total_contributed: number;
  contribution_count: number;
  month: number;
  year: number;
}

export interface SmartDateLogic {
  type: 'fixed_month' | 'relative_months' | 'next_occurrence';
  month?: number;
  day?: number;
  months_ahead?: number;
}

export interface DashboardTotals {
  total_target: number;
  total_saved: number;
  total_monthly_set_aside: number;
  percent_funded: number;
  active_bucket_count: number;
}

export interface ContributeSessionSummary {
  buckets_contributed_to: number;
  total_amount: number;
  session_date: string;
}

// ─── Form / UI Payload Types ──────────────────────────────────────────────────

export interface CreateBucketPayload {
  name: string;
  target_amount: number;
  target_date: string;
  template_id?: string | null;
  sort_order?: number;
}

export interface UpdateBucketPayload {
  name?: string;
  target_amount?: number;
  target_date?: string;
  monthly_set_aside?: number;
  sort_order?: number;
}

export interface SubmitFeedbackPayload {
  feedback_type: FeedbackType;
  description: string;
  screenshot_uri?: string;
  os_version: string;
  app_version: string;
  device_model?: string | null;
}

export interface UserNotificationPreferences {
  notifications_enabled: boolean;
  paycheck_reminder_enabled: boolean;
  due_date_warning_enabled: boolean;
  monthly_summary_notif_enabled: boolean;
}

export interface UserPaySettings {
  pay_frequency: PayFrequency | null;
  pay_day: string | null;
}

// ─── Formatting Helpers ───────────────────────────────────────────────────────

/** Null-safe formatter for Supabase numeric columns */
export function formatCurrency(value: number | null | undefined): string {
  return `$${(value ?? 0).toFixed(2)}`;
}

export function formatPercent(value: number | null | undefined): string {
  return `${(value ?? 0).toFixed(1)}%`;
}

export function computeMonthlySetAside(
  targetAmount: number | null,
  totalSaved: number | null,
  monthsRemaining: number
): number {
  const remaining = (targetAmount ?? 0) - (totalSaved ?? 0);
  if (monthsRemaining <= 0 || remaining <= 0) return 0;
  return Math.ceil((remaining / monthsRemaining) * 100) / 100;
}
