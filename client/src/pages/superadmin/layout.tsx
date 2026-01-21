import { useQuery } from "@tanstack/react-query";
import { useLocation, Link } from "wouter";
import { 
  LayoutDashboard, 
  Building2, 
  Users, 
  CreditCard, 
  LogOut,
  Shield,
  FileText,
  Receipt,
  Package,
  ShoppingCart,
  Sparkles,
  Puzzle,
  Settings,
  UserCog,
  ClipboardList,
  FileCheck,
  CalendarClock,
  History,
  Hash,
  Tag,
  Calculator,
  Activity,
  Layers
} from "lucide-react";
import { useSuperadminTheme } from "@/hooks/use-superadmin-theme";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Superadmin } from "@shared/schema";

// Menu principal
const mainMenuItems = [
  {
    title: "Tableau de bord",
    url: "/superadmin",
    icon: LayoutDashboard,
  },
  {
    title: "Clients",
    url: "/superadmin/tenants",
    icon: Building2,
  },
];

// Espace Facturation unifie
const billingMenuItems = [
  {
    title: "Pipeline Commercial",
    url: "/superadmin/billing-pipeline",
    icon: Users,
  },
  {
    title: "Commandes",
    url: "/superadmin/orders",
    icon: ClipboardList,
  },
  {
    title: "Factures",
    url: "/superadmin/all-invoices",
    icon: Receipt,
  },
  {
    title: "Abonnements",
    url: "/superadmin/client-subscriptions",
    icon: CalendarClock,
  },
  {
    title: "Historique",
    url: "/superadmin/audit-history",
    icon: History,
  },
  {
    title: "Comptabilite",
    url: "/superadmin/accounting",
    icon: Calculator,
  },
];

// Configuration produits
const catalogMenuItems = [
  {
    title: "Forfaits",
    url: "/superadmin/plans",
    icon: Package,
  },
  {
    title: "Fonctionnalites",
    url: "/superadmin/fonctionnalites",
    icon: Sparkles,
  },
  {
    title: "Options",
    url: "/superadmin/addons",
    icon: Puzzle,
  },
  {
    title: "Produits",
    url: "/superadmin/products",
    icon: ShoppingCart,
  },
];

// Administration
const adminMenuItems = [
  {
    title: "Administrateurs",
    url: "/superadmin/admins",
    icon: UserCog,
  },
  {
    title: "Suivi des Activites",
    url: "/superadmin/activity-tracking",
    icon: Activity,
  },
  {
    title: "Configuration",
    url: "/superadmin/configuration",
    icon: Settings,
  },
];

// Chorus Pro Configuration
const chorusProMenuItems = [
  {
    title: "Formats numerotation",
    url: "/superadmin/document-formats",
    icon: Hash,
  },
  {
    title: "Codes services",
    url: "/superadmin/service-codes",
    icon: Tag,
  },
  {
    title: "Fonctions",
    url: "/superadmin/functions",
    icon: Users,
  },
  {
    title: "Domaines",
    url: "/superadmin/domains",
    icon: Layers,
  },
];

interface SuperadminLayoutProps {
  children: React.ReactNode;
}

export function SuperadminLayout({ children }: SuperadminLayoutProps) {
  const [location, setLocation] = useLocation();
  useSuperadminTheme();

  const { data: authData, isLoading } = useQuery<{ superadmin: Superadmin }>({
    queryKey: ["/api/superadmin/me"],
  });

  const handleLogout = async () => {
    try {
      await apiRequest("POST", "/api/superadmin/logout");
      queryClient.clear();
      setLocation("/superadmin/login");
    } catch (error) {
      console.error("Logout error:", error);
      queryClient.clear();
      setLocation("/superadmin/login");
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-pulse text-muted-foreground">Chargement...</div>
      </div>
    );
  }

  if (!authData?.superadmin) {
    setLocation("/superadmin/login");
    return null;
  }

  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <Sidebar>
          <SidebarHeader className="p-4">
            <div className="flex items-center gap-2">
              <Shield className="h-6 w-6 text-primary" />
              <span className="font-semibold">SuperAdmin</span>
            </div>
          </SidebarHeader>
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel>Navigation</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {mainMenuItems.map((item) => (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton
                        asChild
                        isActive={location === item.url}
                      >
                        <Link href={item.url}>
                          <item.icon className="h-4 w-4" />
                          <span>{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
            <SidebarGroup>
              <SidebarGroupLabel>Espace Facturation</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {billingMenuItems.map((item) => (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton
                        asChild
                        isActive={location === item.url}
                      >
                        <Link href={item.url}>
                          <item.icon className="h-4 w-4" />
                          <span>{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
            <SidebarGroup>
              <SidebarGroupLabel>Catalogue</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {catalogMenuItems.map((item) => (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton
                        asChild
                        isActive={location === item.url}
                      >
                        <Link href={item.url}>
                          <item.icon className="h-4 w-4" />
                          <span>{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
            <SidebarGroup>
              <SidebarGroupLabel>Chorus Pro</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {chorusProMenuItems.map((item) => (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton
                        asChild
                        isActive={location === item.url}
                      >
                        <Link href={item.url}>
                          <item.icon className="h-4 w-4" />
                          <span>{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
            <SidebarGroup>
              <SidebarGroupLabel>Administration</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {adminMenuItems.map((item) => (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton
                        asChild
                        isActive={location === item.url}
                      >
                        <Link href={item.url}>
                          <item.icon className="h-4 w-4" />
                          <span>{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
          <SidebarFooter className="p-4">
            <div className="flex flex-col gap-2">
              <div className="text-sm text-muted-foreground truncate">
                {authData.superadmin.email}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleLogout}
                className="w-full gap-2"
                data-testid="button-logout"
              >
                <LogOut className="h-4 w-4" />
                Deconnexion
              </Button>
            </div>
          </SidebarFooter>
        </Sidebar>
        <div className="flex flex-col flex-1">
          <header className="flex items-center justify-between gap-2 p-3 border-b">
            <SidebarTrigger data-testid="button-sidebar-toggle" />
            <ThemeToggle />
          </header>
          <main className="flex-1 overflow-auto p-6">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
