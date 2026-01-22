import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { Building2, Menu, X, Lightbulb, AlertTriangle, Calendar, Settings, UserCircle, FileText } from "lucide-react";
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Tenant } from "@shared/schema";

interface TenantHeaderProps {
  tenant: Tenant | null;
  isAdmin?: boolean;
}

interface TenantFeatures {
  hasIdeas: boolean;
  hasIncidents: boolean;
  hasMeetings: boolean;
  hasEvents: boolean;
  features: string[];
}

export function TenantHeader({ tenant, isAdmin = false }: TenantHeaderProps) {
  const [location] = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const slug = tenant?.slug || "";

  const { data: features } = useQuery<TenantFeatures>({
    queryKey: [`/api/tenants/${slug}/features`],
    enabled: !!slug,
  });

  const isAssociation = tenant?.tenantType === "ASSOCIATION";
  
  const allLinks = useMemo(() => [
    { href: `/structures/${slug}/ideas`, label: "Idees", icon: Lightbulb, featureKey: "hasIdeas" as const },
    { href: `/structures/${slug}/incidents`, label: "Signalements", icon: AlertTriangle, featureKey: "hasIncidents" as const },
    { href: `/structures/${slug}/meetings`, label: "Evenements", icon: Calendar, featureKey: "hasMeetings" as const },
    { href: `/structures/${slug}/elus`, label: isAssociation ? "Membres" : "Elus", icon: UserCircle, featureKey: null },
    { href: `/structures/${slug}/mes-contributions`, label: "Mes contributions", icon: FileText, featureKey: null },
  ], [slug, isAssociation]);

  const publicLinks = useMemo(() => {
    if (!features) return allLinks;
    return allLinks.filter(link => {
      if (!link.featureKey) return true;
      return features[link.featureKey];
    });
  }, [allLinks, features]);

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto max-w-7xl px-4">
        <div className="flex h-16 items-center justify-between gap-4">
          <Link href={`/structures/${slug}`} className="flex items-center gap-2" data-testid="link-tenant-home">
            {tenant?.logoUrl ? (
              <img 
                src={tenant.logoUrl.startsWith('/objects/') ? tenant.logoUrl : tenant.logoUrl.startsWith('http') ? tenant.logoUrl : `/objects/${tenant.logoUrl}`}
                alt={`Logo ${tenant.name}`}
                className="h-9 w-9 object-contain rounded-lg"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                  const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                  if (fallback) fallback.style.display = 'flex';
                }}
                data-testid="img-tenant-logo"
              />
            ) : null}
            <div 
              className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary"
              style={{ display: tenant?.logoUrl ? 'none' : 'flex' }}
            >
              <Building2 className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="font-display text-lg font-bold tracking-tight truncate max-w-[200px]">
              {tenant?.name || "Structure"}
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-1">
            {publicLinks.map((link) => (
              <Link key={link.href} href={link.href}>
                <Button
                  variant={location.startsWith(link.href) ? "secondary" : "ghost"}
                  size="sm"
                  className="gap-2"
                  data-testid={`link-nav-${link.label.toLowerCase()}`}
                >
                  <link.icon className="h-4 w-4" />
                  {link.label}
                </Button>
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <ThemeToggle />
            {!isAdmin && (
              <Link href={`/structures/${slug}/admin/login`} className="hidden sm:block">
                <Button variant="outline" size="sm" data-testid="button-admin">
                  <Settings className="h-4 w-4 mr-2" />
                  Admin
                </Button>
              </Link>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              data-testid="button-mobile-menu"
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden py-4 border-t">
            <nav className="flex flex-col gap-2">
              {publicLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <Button
                    variant={location.startsWith(link.href) ? "secondary" : "ghost"}
                    className="w-full justify-start gap-2"
                    data-testid={`link-mobile-${link.label.toLowerCase()}`}
                  >
                    <link.icon className="h-4 w-4" />
                    {link.label}
                  </Button>
                </Link>
              ))}
              <Link href={`/structures/${slug}/admin/login`} onClick={() => setMobileMenuOpen(false)}>
                <Button variant="outline" className="w-full justify-start gap-2">
                  <Settings className="h-4 w-4" />
                  Administration
                </Button>
              </Link>
            </nav>
          </div>
        )}
      </div>
    </header>
  );
}
