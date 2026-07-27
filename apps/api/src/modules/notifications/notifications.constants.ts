import { NotificationCategory, NotificationPriority, NotificationType } from '@rant/database';

/** Static metadata for each notification type: its category + default priority. */
export const NOTIFICATION_META: Record<
  NotificationType,
  { category: NotificationCategory; priority: NotificationPriority }
> = {
  [NotificationType.CI_FAILED]: {
    category: NotificationCategory.CI,
    priority: NotificationPriority.NORMAL,
  },
  [NotificationType.DEPLOYMENT_READY]: {
    category: NotificationCategory.DEPLOYMENT,
    priority: NotificationPriority.NORMAL,
  },
  [NotificationType.DEPLOYMENT_FAILED]: {
    category: NotificationCategory.DEPLOYMENT,
    priority: NotificationPriority.HIGH,
  },
  [NotificationType.INCIDENT_OPENED]: {
    category: NotificationCategory.INCIDENT,
    priority: NotificationPriority.HIGH,
  },
  [NotificationType.INCIDENT_RESOLVED]: {
    category: NotificationCategory.INCIDENT,
    priority: NotificationPriority.NORMAL,
  },
  [NotificationType.PULL_REQUEST_OPENED]: {
    category: NotificationCategory.PULL_REQUEST,
    priority: NotificationPriority.LOW,
  },
};

/** Every category, used to hydrate a user's default preference set. */
export const ALL_CATEGORIES: NotificationCategory[] = [
  NotificationCategory.CI,
  NotificationCategory.DEPLOYMENT,
  NotificationCategory.INCIDENT,
  NotificationCategory.PULL_REQUEST,
];
