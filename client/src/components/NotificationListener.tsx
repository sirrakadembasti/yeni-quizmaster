import { useEffect, useRef } from "react";
import { useAuth } from "@/context/auth-context";
import { io } from "socket.io-client";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { notificationApi } from "@/lib/api";
import { prependNotification, type NotificationPage } from "@/lib/notification-cache";

export function NotificationListener() {
  const { user, isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const { data: preferences } = useQuery({
    queryKey: ["notifications", "preferences"],
    queryFn: () => notificationApi.getPreferences(),
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
      if (mutedRef.current) return;

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
