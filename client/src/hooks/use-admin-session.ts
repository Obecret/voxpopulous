import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import type { Tenant, AdminMenuCode } from "@shared/schema";

export interface ElectedOfficialSession {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  hasFullAccess: boolean;
  menuPermissions: AdminMenuCode[];
}

export interface UserSession {
  id: string;
  name: string;
  email: string;
  role?: string;
}

export interface AdminSession {
  id: string;
  name: string;
  email: string;
  role?: string;
  accountBlocked?: boolean;
  blockReason?: string;
  isElectedOfficial: boolean;
  electedOfficial?: ElectedOfficialSession;
}

interface UseAdminSessionResult {
  session: AdminSession | undefined;
  tenant: Tenant | undefined;
  user: UserSession | null;
  electedOfficial: ElectedOfficialSession | null | undefined;
  isLoading: boolean;
  accountBlocked?: boolean;
  blockReason?: string;
  hasMenuAccess: (menuCode: AdminMenuCode) => boolean;
}

export function useAdminSession(slug: string): UseAdminSessionResult {
  const [, navigate] = useLocation();

  const { data: tenant, isLoading: tenantLoading } = useQuery<Tenant>({
    queryKey: ["/api/tenants", slug],
    enabled: !!slug,
  });

  const { data: session, isLoading: sessionLoading, error: sessionError } = useQuery<AdminSession>({
    queryKey: ["/api/tenants", slug, "admin", "me"],
    retry: false,
    enabled: !!slug,
  });

  if (sessionError) {
    navigate(`/structures/${slug}/admin/login`);
  }

  const user: UserSession | null = session && !session.isElectedOfficial ? {
    id: session.id,
    name: session.name,
    email: session.email,
    role: session.role,
  } : null;

  const hasMenuAccess = (menuCode: AdminMenuCode): boolean => {
    if (!session) return false;
    if (!session.isElectedOfficial) return true;
    if (!session.electedOfficial) return false;
    if (session.electedOfficial.hasFullAccess) return true;
    return session.electedOfficial.menuPermissions.includes(menuCode);
  };

  return {
    session,
    tenant,
    user,
    electedOfficial: session?.electedOfficial,
    isLoading: tenantLoading || sessionLoading,
    accountBlocked: session?.accountBlocked,
    blockReason: session?.blockReason,
    hasMenuAccess,
  };
}
