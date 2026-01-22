import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { 
  Building2, 
  LayoutDashboard, 
  Lightbulb, 
  AlertTriangle, 
  Calendar, 
  LogOut,
  Menu,
  X,
  ExternalLink,
  CreditCard,
  ShieldAlert,
  Users,
  UserCog,
  UserCircle,
  Image,
  Settings,
  Tags,
  Lock,
  Landmark,
  Share2
} from "lucide-react";
import { useState, useMemo } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { Tenant, AdminMenuCode } from "@shared/schema";
import type { ElectedOfficialSession, UserSession } from "@/hooks/use-admin-session";

interface AdminLayoutProps {
  children: React.ReactNode;
  tenant: Tenant | null;
  user: UserSession | null;
  electedOfficial?: ElectedOfficialSession | null;
  accountBlocked?: boolean;
  blockReason?: string;
}

interface TenantFeatures {
  hasIdeas: boolean;
  hasIncidents: boolean;
  hasEvents: boolean;
  features: string[];
}

const getTenantTypeTheme = (tenantType: string | undefined) => {
  switch (tenantType) {
    case "EPCI":
      return {
        headerBg: "bg-violet-600 dark:bg-violet-800",
        headerText: "text-white",
        sidebarBg: "bg-violet-50 dark:bg-violet-950",
        sidebarBorder: "border-violet-200 dark:border-violet-800",
        logoBg: "bg-violet-700",
        activeButton: "!bg-violet-100 dark:!bg-violet-900 !text-violet-900 dark:!text-violet-100 hover:!bg-violet-200 dark:hover:!bg-violet-800",
        label: "EPCI",
        badgeBg: "bg-violet-100 dark:bg-violet-900 text-violet-700 dark:text-violet-300",
      };
    case "ASSOCIATION":
      return {
        headerBg: "bg-emerald-600 dark:bg-emerald-800",
        headerText: "text-white",
        sidebarBg: "bg-emerald-50 dark:bg-emerald-950",
        sidebarBorder: "border-emerald-200 dark:border-emerald-800",
        logoBg: "bg-emerald-700",
        activeButton: "!bg-emerald-100 dark:!bg-emerald-900 !text-emerald-900 dark:!text-emerald-100 hover:!bg-emerald-200 dark:hover:!bg-emerald-800",
        label: "Association",
        badgeBg: "bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300",
      };
    case "MAIRIE":
    default:
      return {
        headerBg: "bg-blue-600 dark:bg-blue-800",
        headerText: "text-white",
        sidebarBg: "bg-blue-50 dark:bg-blue-950",
        sidebarBorder: "border-blue-200 dark:border-blue-800",
        logoBg: "bg-blue-700",
        activeButton: "!bg-blue-100 dark:!bg-blue-900 !text-blue-900 dark:!text-blue-100 hover:!bg-blue-200 dark:hover:!bg-blue-800",
        label: "Commune",
        badgeBg: "bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300",
      };
  }
};

const ROUTE_TO_MENU_CODE: Record<string, AdminMenuCode> = {
  "admin": "DASHBOARD",
  "ideas": "IDEAS",
  "incidents": "INCIDENTS",
  "events": "EVENTS",
  "associations": "ASSOCIATIONS",
  "communes": "ASSOCIATIONS",
  "elus": "ELUS",
  "domains": "DOMAINS",
  "photos": "PHOTOS",
  "admins": "ADMINS",
  "sharing": "SHARE",
  "settings": "SETTINGS",
  "billing": "BILLING",
};

export function AdminLayout({ children, tenant, user, electedOfficial, accountBlocked, blockReason }: AdminLayoutProps) {
  const [location, navigate] = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const slug = tenant?.slug || "";
  const theme = getTenantTypeTheme(tenant?.tenantType);

  const { data: features } = useQuery<TenantFeatures>({
    queryKey: [`/api/tenants/${slug}/features`],
    enabled: !!slug,
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", `/api/tenants/${slug}/admin/logout`);
    },
    onSuccess: () => {
      navigate(`/structures/${slug}/admin/login`);
    },
  });

  const allNavItems = useMemo(() => {
    const baseItems: Array<{ href: string; label: string; icon: typeof LayoutDashboard; exact?: boolean; featureKey: "hasIdeas" | "hasIncidents" | "hasEvents" | null }> = [
      { href: `/structures/${slug}/admin`, label: "Tableau de bord", icon: LayoutDashboard, exact: true, featureKey: null },
      { href: `/structures/${slug}/admin/ideas`, label: "Idees", icon: Lightbulb, featureKey: "hasIdeas" },
      { href: `/structures/${slug}/admin/incidents`, label: "Signalements", icon: AlertTriangle, featureKey: "hasIncidents" },
      { href: `/structures/${slug}/admin/events`, label: "Evenements", icon: Calendar, featureKey: "hasEvents" },
    ];
    
    if (tenant?.tenantType !== "ASSOCIATION") {
      baseItems.push({ href: `/structures/${slug}/admin/associations`, label: "Associations", icon: Users, featureKey: null });
    }
    
    if (tenant?.tenantType === "EPCI") {
      baseItems.push({ href: `/structures/${slug}/admin/communes`, label: "Communes", icon: Landmark, featureKey: null });
    }
    
    baseItems.push(
      { href: `/structures/${slug}/admin/elus`, label: tenant?.tenantType === "ASSOCIATION" ? "Membres Bureau" : "Elus", icon: UserCircle, featureKey: null },
      { href: `/structures/${slug}/admin/domains`, label: "Domaines", icon: Tags, featureKey: null },
      { href: `/structures/${slug}/admin/photos`, label: "Photos", icon: Image, featureKey: null },
      { href: `/structures/${slug}/admin/admins`, label: "Administrateurs", icon: UserCog, featureKey: null },
      { href: `/structures/${slug}/admin/sharing`, label: "Partage", icon: Share2, featureKey: null },
      { href: `/structures/${slug}/admin/settings`, label: "Parametres", icon: Settings, featureKey: null },
    );
    
    // Masquer la facturation pour les tenants enfants (mairies d'un EPCI ou associations d'une mairie/EPCI)
    const hasParent = tenant?.parentEpciId || tenant?.parentTenantId;
    if (!hasParent) {
      baseItems.push(
        { href: `/structures/${slug}/admin/billing`, label: "Facturation", icon: CreditCard, featureKey: null },
      );
    }
    
    return baseItems;
  }, [slug, tenant?.tenantType, tenant?.parentEpciId, tenant?.parentTenantId]);

  const isActive = (href: string, exact?: boolean) => {
    if (exact) return location === href;
    return location.startsWith(href);
  };

  const isFeatureEnabled = (featureKey: "hasIdeas" | "hasIncidents" | "hasEvents" | null): boolean => {
    if (!featureKey) return true;
    if (!features) return true;
    return features[featureKey];
  };

  const hasElectedOfficialMenuAccess = (href: string): boolean => {
    if (!electedOfficial) return true;
    if (electedOfficial.hasFullAccess) return true;
    const pathSegment = href.split("/").pop() || "";
    const menuCode = ROUTE_TO_MENU_CODE[pathSegment];
    if (!menuCode) return true;
    return electedOfficial.menuPermissions.includes(menuCode);
  };

  return (
    <div className="min-h-screen flex flex-col">
      <header className={`sticky top-0 z-50 w-full border-b ${theme.headerBg} ${theme.headerText}`}>
        <div className="flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden text-inherit hover:bg-white/20"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              data-testid="button-mobile-menu"
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
            <Link href={`/structures/${slug}/admin`} className="flex items-center gap-2" data-testid="link-admin-home">
              {tenant?.logoUrl ? (
                <img 
                  src={tenant.logoUrl} 
                  alt={tenant.name || "Logo"} 
                  className="h-9 w-9 rounded-lg object-cover"
                  data-testid="img-tenant-logo"
                />
              ) : (
                <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${theme.logoBg}`}>
                  <Building2 className="h-5 w-5 text-white" />
                </div>
              )}
              <div className="hidden sm:block">
                <span className="font-display font-bold">{tenant?.name || "Admin"}</span>
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-1.5 py-0.5 rounded ${theme.badgeBg}`}>{theme.label}</span>
                </div>
              </div>
            </Link>
          </div>

          <div className="flex items-center gap-2">
            <Link href={`/structures/${slug}`} target="_blank">
              <Button variant="ghost" size="sm" className="gap-2 hidden sm:flex text-inherit hover:bg-white/20" data-testid="button-view-public">
                <ExternalLink className="h-4 w-4" />
                Voir le site
              </Button>
            </Link>
            <ThemeToggle />
            <Button
              variant="ghost"
              size="icon"
              className="text-inherit hover:bg-white/20"
              onClick={() => logoutMutation.mutate()}
              disabled={logoutMutation.isPending}
              data-testid="button-logout"
            >
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </header>

      <div className="flex flex-1">
        <aside className={`
          fixed inset-y-0 left-0 z-40 w-64 transform ${theme.sidebarBg} ${theme.sidebarBorder} border-r transition-transform duration-200 ease-in-out lg:relative lg:translate-x-0 lg:pt-0 pt-16
          ${mobileMenuOpen ? "translate-x-0" : "-translate-x-full"}
        `}>
          <nav className="flex flex-col gap-1 p-4">
            {allNavItems.map((item) => {
              const enabled = isFeatureEnabled(item.featureKey);
              const hasAccess = hasElectedOfficialMenuAccess(item.href);
              
              if (!enabled) {
                return (
                  <Tooltip key={item.href}>
                    <TooltipTrigger asChild>
                      <div className="w-full">
                        <Button
                          variant="ghost"
                          className="w-full justify-start gap-3 opacity-50 cursor-not-allowed"
                          disabled
                          data-testid={`link-admin-${item.label.toLowerCase()}-disabled`}
                        >
                          <item.icon className="h-4 w-4" />
                          {item.label}
                          <Lock className="h-3 w-3 ml-auto" />
                        </Button>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="right">
                      <p>Disponible avec le forfait superieur</p>
                    </TooltipContent>
                  </Tooltip>
                );
              }
              
              if (!hasAccess) {
                return (
                  <Tooltip key={item.href}>
                    <TooltipTrigger asChild>
                      <div className="w-full">
                        <Button
                          variant="ghost"
                          className="w-full justify-start gap-3 opacity-50 cursor-not-allowed"
                          disabled
                          data-testid={`link-admin-${item.label.toLowerCase()}-no-access`}
                        >
                          <item.icon className="h-4 w-4" />
                          {item.label}
                          <Lock className="h-3 w-3 ml-auto" />
                        </Button>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="right">
                      <p>Acces non autorise pour votre compte</p>
                    </TooltipContent>
                  </Tooltip>
                );
              }
              
              const active = isActive(item.href, item.exact);
              return (
                <Link key={item.href} href={item.href}>
                  <Button
                    variant="ghost"
                    className={`w-full justify-start gap-3 ${active ? theme.activeButton : ""}`}
                    onClick={() => setMobileMenuOpen(false)}
                    data-testid={`link-admin-${item.label.toLowerCase()}`}
                  >
                    <item.icon className="h-4 w-4" />
                    {item.label}
                  </Button>
                </Link>
              );
            })}
          </nav>

          {(user || electedOfficial) && (
            <div className="absolute bottom-0 left-0 right-0 p-4 border-t">
              <div className="text-sm">
                {user ? (
                  <>
                    <p className="font-medium truncate">{user.name}</p>
                    <p className="text-muted-foreground text-xs truncate">{user.email}</p>
                  </>
                ) : electedOfficial ? (
                  <>
                    <p className="font-medium truncate">{electedOfficial.firstName} {electedOfficial.lastName}</p>
                    <p className="text-muted-foreground text-xs truncate">{electedOfficial.email}</p>
                  </>
                ) : null}
              </div>
            </div>
          )}
        </aside>

        {mobileMenuOpen && (
          <div 
            className="fixed inset-0 z-30 bg-background/80 backdrop-blur-sm lg:hidden"
            onClick={() => setMobileMenuOpen(false)}
          />
        )}

        <main className="flex-1 overflow-auto">
          {/* Lifecycle suspension banner */}
          {tenant?.lifecycleStatus === "SUSPENDED" && (
            <div className="bg-amber-100 dark:bg-amber-900/30 border-b border-amber-300 dark:border-amber-700 px-4 py-3" data-testid="banner-lifecycle-suspended">
              <div className="flex items-center gap-3 max-w-4xl mx-auto">
                <ShieldAlert className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-amber-800 dark:text-amber-200">Compte temporairement suspendu</p>
                  <p className="text-sm text-amber-700 dark:text-amber-300">
                    {tenant.suspendedReason || "Votre compte a ete suspendu. Vous pouvez consulter vos donnees mais ne pouvez pas les modifier."}
                  </p>
                </div>
              </div>
            </div>
          )}
          {/* Billing suspension banner */}
          {accountBlocked && (
            <div className="bg-destructive/10 border-b border-destructive/20 px-4 py-3" data-testid="banner-account-blocked">
              <div className="flex items-center gap-3 max-w-4xl mx-auto">
                <ShieldAlert className="h-5 w-5 text-destructive shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-destructive">Compte suspendu</p>
                  <p className="text-sm text-destructive/80">
                    {blockReason || "Votre compte est actuellement suspendu. Veuillez contacter le support."}
                  </p>
                </div>
                <Link href={`/structures/${slug}/admin/billing`}>
                  <Button size="sm" variant="destructive" data-testid="button-resolve-billing">
                    Regulariser
                  </Button>
                </Link>
              </div>
            </div>
          )}
          {children}
        </main>
      </div>
    </div>
  );
}
