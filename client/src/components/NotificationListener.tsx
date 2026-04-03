import { useEffect } from "react";
import { useAuth } from "@/context/auth-context";
import { io } from "socket.io-client";
import { toast } from "sonner";

export function NotificationListener() {
  const { user, isAuthenticated } = useAuth();

  useEffect(() => {
    if (!isAuthenticated || !user) return;

    // Use empty string to connect to the current host
    // or rely on proxy settings in vite.config.ts
    const socket = io(window.location.origin, {
      path: "/socket.io/",
      transports: ["websocket", "polling"],
    });

    socket.on("connect", () => {
      socket.emit("joinUserRoom", user.id);
    });

    socket.on("notification", (notification) => {
      // Use sonner toast
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
  }, [user, isAuthenticated]);

  return null;
}