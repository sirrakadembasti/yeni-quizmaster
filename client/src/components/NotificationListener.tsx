import { useEffect, useRef } from "react";
import { useAuth } from "@/context/auth-context";
import { io } from "socket.io-client";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getVersionedNotificationPreferences, newerNotificationPreferences, type VersionedNotificationPreferences } from "@/lib/versioned-notification-preferences";
import { prependNotification, type NotificationPage } from "@/lib/notification-cache";
import { useAcademicYear } from '@/context/academic-year-context';

export function NotificationListener() {
  const { user, role, isAuthenticated } = useAuth();
  const academic = useAcademicYear();
  const historicalRef = useRef(false);
  historicalRef.current = role === 'admin' && (!!academic?.pending || !!academic?.error || academic?.year?.status === 'closed');
  const queryClient = useQueryClient();
  const { data: preferences } = useQuery({
    queryKey: ["notifications", "preferences", "versioned", user?.id],
    queryFn: getVersionedNotificationPreferences,
    structuralSharing: (previous, incoming) => newerNotificationPreferences(previous as VersionedNotificationPreferences | undefined, incoming as VersionedNotificationPreferences),
    enabled: isAuthenticated && !!user,
  });
  const mutedRef = useRef(true);

  useEffect(() => {
    mutedRef.current = preferences?.muted ?? true;
  }, [preferences?.muted]);

  useEffect(() => {
    if (!isAuthenticated || !user) return;

    // Use empty string to connect to the current host
    // or rely on proxy settings in vite.config.ts
    const socket = io(window.location.origin, {
      path: "/socket.io/",
      transports: ["websocket", "polling"],
      withCredentials: true,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 10000,
    });

    socket.on("connect", () => {
      socket.emit("joinUserRoom", user.id);
      queryClient.refetchQueries({ queryKey: ["notifications"], type: "active" });
    });

    socket.on("notification", (notification) => {
      queryClient.setQueryData<NotificationPage>(
        ["notifications", "nav"],
        current => prependNotification(current, notification, 5)
      );
      queryClient.setQueryData<NotificationPage>(
        ["notifications", "all", 1],
        current => prependNotification(current, notification, 20)
      );
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      if (mutedRef.current || historicalRef.current) return;

      if (notification.type === "success") {
        toast.success(notification.title, { description: notification.message });
      } else if (notification.type === "error") {
        toast.error(notification.title, { description: notification.message });
      } else {
        toast.info(notification.title, { description: notification.message });
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [user?.id, isAuthenticated, queryClient]);

  return null;
}
