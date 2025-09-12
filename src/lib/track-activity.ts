import { UserService } from './sqlite';

/**
 * Track user activity by updating their last_active_at timestamp
 */
export async function trackUserActivity(userId: string): Promise<void> {
  try {
    await UserService.updateLastActive(userId);
  } catch (error) {
    console.error('Failed to track user activity:', error);
    // Don't throw error to prevent breaking the main application flow
  }
}

/**
 * Track user activity with throttling to avoid too many database updates
 * Only updates if the last update was more than 5 minutes ago
 */
const lastActivityUpdate: Record<string, number> = {};
const ACTIVITY_THROTTLE_MS = 5 * 60 * 1000; // 5 minutes

export async function trackUserActivityThrottled(userId: string): Promise<void> {
  const now = Date.now();
  const lastUpdate = lastActivityUpdate[userId] || 0;
  
  if (now - lastUpdate > ACTIVITY_THROTTLE_MS) {
    lastActivityUpdate[userId] = now;
    await trackUserActivity(userId);
  }
}
