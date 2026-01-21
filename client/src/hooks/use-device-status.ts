import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";

interface DeviceStatus {
  deviceId: string;
  blocked: boolean;
  reason?: string;
}

export function useDeviceStatus() {
  const { data, isLoading, error } = useQuery<DeviceStatus>({
    queryKey: ["/api/device/status"],
    staleTime: 60000, // Cache for 1 minute
    retry: false,
  });

  return {
    deviceId: data?.deviceId,
    isBlocked: data?.blocked || false,
    blockReason: data?.reason,
    isLoading,
    error,
  };
}
