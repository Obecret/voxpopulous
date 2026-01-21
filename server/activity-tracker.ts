import { Request } from "express";
import { storage } from "./storage";
import type { InsertActivityLog } from "@shared/schema";

interface DeviceInfo {
  deviceType: "DESKTOP" | "MOBILE" | "TABLET" | "UNKNOWN";
  browserName: string;
  osName: string;
}

export function parseUserAgent(userAgent: string | undefined): DeviceInfo {
  if (!userAgent) {
    return { deviceType: "UNKNOWN", browserName: "Unknown", osName: "Unknown" };
  }

  let deviceType: "DESKTOP" | "MOBILE" | "TABLET" | "UNKNOWN" = "DESKTOP";
  let browserName = "Unknown";
  let osName = "Unknown";

  const ua = userAgent.toLowerCase();

  if (ua.includes("mobile") || ua.includes("android") && !ua.includes("tablet")) {
    deviceType = "MOBILE";
  } else if (ua.includes("tablet") || ua.includes("ipad")) {
    deviceType = "TABLET";
  } else if (ua.includes("windows") || ua.includes("macintosh") || ua.includes("linux")) {
    deviceType = "DESKTOP";
  }

  if (ua.includes("firefox")) {
    browserName = "Firefox";
  } else if (ua.includes("edg")) {
    browserName = "Edge";
  } else if (ua.includes("chrome")) {
    browserName = "Chrome";
  } else if (ua.includes("safari")) {
    browserName = "Safari";
  } else if (ua.includes("opera") || ua.includes("opr")) {
    browserName = "Opera";
  }

  if (ua.includes("windows")) {
    osName = "Windows";
  } else if (ua.includes("mac os") || ua.includes("macintosh")) {
    osName = "macOS";
  } else if (ua.includes("linux")) {
    osName = "Linux";
  } else if (ua.includes("android")) {
    osName = "Android";
  } else if (ua.includes("iphone") || ua.includes("ipad")) {
    osName = "iOS";
  }

  return { deviceType, browserName, osName };
}

export function getClientIp(req: Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (forwarded) {
    const ips = typeof forwarded === "string" ? forwarded : forwarded[0];
    return ips.split(",")[0].trim();
  }
  return req.socket.remoteAddress || req.ip || "Unknown";
}

export function getDeviceIdFromCookie(req: Request): string | undefined {
  return req.cookies?.vp_device_id;
}

interface LogActivityParams {
  req: Request;
  deviceId: string;
  activityType?: "LOGIN" | "LOGOUT" | "PAGE_VIEW" | "ACTION";
  tenantId?: string;
  tenantSlug?: string;
  tenantName?: string;
  associationTenantId?: string;
  associationSlug?: string;
  associationName?: string;
  userId?: string;
  userName?: string;
  userEmail?: string;
  userRole?: string;
  electedOfficialId?: string;
  electedOfficialName?: string;
  bureauMemberId?: string;
  bureauMemberName?: string;
  superadminId?: string;
  superadminEmail?: string;
  actionDetails?: string;
}

export async function logActivity(params: LogActivityParams): Promise<void> {
  try {
    const userAgent = params.req.headers["user-agent"];
    const deviceInfo = parseUserAgent(userAgent);
    const ipAddress = getClientIp(params.req);

    const log: InsertActivityLog = {
      deviceId: params.deviceId,
      ipAddress,
      userAgent,
      deviceType: deviceInfo.deviceType,
      browserName: deviceInfo.browserName,
      osName: deviceInfo.osName,
      activityType: params.activityType || "LOGIN",
      tenantId: params.tenantId,
      tenantSlug: params.tenantSlug,
      tenantName: params.tenantName,
      associationTenantId: params.associationTenantId,
      associationSlug: params.associationSlug,
      associationName: params.associationName,
      userId: params.userId,
      userName: params.userName,
      userEmail: params.userEmail,
      userRole: params.userRole,
      electedOfficialId: params.electedOfficialId,
      electedOfficialName: params.electedOfficialName,
      bureauMemberId: params.bureauMemberId,
      bureauMemberName: params.bureauMemberName,
      superadminId: params.superadminId,
      superadminEmail: params.superadminEmail,
      actionDetails: params.actionDetails,
    };

    await storage.createActivityLog(log);
  } catch (error) {
    console.error("Failed to log activity:", error);
  }
}

export async function isDeviceBlocked(deviceId: string): Promise<{ blocked: boolean; reason?: string }> {
  try {
    const blockedDevice = await storage.getBlockedDeviceByDeviceId(deviceId);
    if (blockedDevice && blockedDevice.isActive) {
      return { blocked: true, reason: blockedDevice.reason || "Appareil bloque par l'administrateur" };
    }
    return { blocked: false };
  } catch (error) {
    console.error("Failed to check device block status:", error);
    return { blocked: false };
  }
}
