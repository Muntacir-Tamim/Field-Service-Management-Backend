export interface IAnalyticsQuery {
  from?: string; // e.g. 2026-10-01 or full ISO date
  to?: string; // e.g. 2026-10-31 (date-only value includes the whole day)
  limit?: string; // leaderboard size
  sortBy?: string; // completedJobs | averageRating | laborHours
}
