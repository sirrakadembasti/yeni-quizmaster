export interface NotificationPage {
  notifications: any[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    unread: number;
    totalPages: number;
  };
}

export function prependNotification(
  current: NotificationPage | undefined,
  notification: any,
  limit: number
): NotificationPage | undefined {
  if (!current?.notifications) return current;
  if (current.notifications.some(item => item.id === notification.id)) return current;

  const total = (current.pagination?.total ?? current.notifications.length) + 1;
  return {
    ...current,
    notifications: [notification, ...current.notifications].slice(0, limit),
    pagination: current.pagination
      ? {
          ...current.pagination,
          total,
          unread: current.pagination.unread + (notification.isRead ? 0 : 1),
          totalPages: Math.max(1, Math.ceil(total / current.pagination.limit)),
        }
      : current.pagination,
  };
}

export function removeNotification(
  current: NotificationPage | undefined,
  notificationId: string
): NotificationPage | undefined {
  if (!current?.notifications) return current;
  const removed = current.notifications.find(item => item.id === notificationId);
  if (!removed) return current;

  const total = Math.max(0, (current.pagination?.total ?? current.notifications.length) - 1);
  return {
    ...current,
    notifications: current.notifications.filter(item => item.id !== notificationId),
    pagination: current.pagination
      ? {
          ...current.pagination,
          total,
          unread: Math.max(0, current.pagination.unread - (removed.isRead ? 0 : 1)),
          totalPages: Math.max(1, Math.ceil(total / current.pagination.limit)),
        }
      : current.pagination,
  };
}
