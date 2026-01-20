import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { 
  Users, 
  LayoutDashboard, 
  Lightbulb, 
  AlertTriangle, 
  Calendar, 
  LogOut,
  Menu,
  X,
  ExternalLink,
  UserCog,
  Image,
  Settings,
  Tags,
  Lock,
  Share2,
  Music, Palette, Dumbbell, Heart, BookOpen, TreePine, Camera, Utensils, 
  Gamepad2, Bike, Globe, Star, Award, Zap, Coffee, Sparkles, Handshake,
  type LucideIcon
} from "lucide-react";

const LOGO_ICONS: Record<string, LucideIcon> = {
  Users, Music, Palette, Dumbbell, Heart, BookOpen, TreePine, Camera, Utensils,
  Gamepad2, Bike, Globe, Star, Award, Zap, Coffee, Sparkles, Handshake
};

const ACTIVITY_IMAGES: Record<string, string> = {
  Users: "/activity-images/community_charity_volunteers.png",
  Football: "/activity-images/football_soccer_action_shot.png",
  Basketball: "/activity-images/basketball_players_in_action.png",
  Tennis: "/activity-images/tennis_player_serving.png",
  Swimming: "/activity-images/swimming_pool_athletes.png",
  Athletics: "/activity-images/athletics_track_runners.png",
  Cycling: "/activity-images/road_cycling_race.png",
  Dance: "/activity-images/dance_performance_artistic.png",
  MartialArts: "/activity-images/martial_arts_training.png",
  Music: "/activity-images/orchestra_music_performance.png",
  Palette: "/activity-images/artist_painting_studio.png",
  Theater: "/activity-images/theater_stage_performance.png",
  Camera: "/activity-images/photography_creative_session.png",
  BookOpen: "/activity-images/book_club_reading_group.png",
  TreePine: "/activity-images/nature_conservation_volunteers.png",
  Gamepad2: "/activity-images/chess_club_gaming_activity.png",
  Handshake: "/activity-images/community_charity_volunteers.png",
  Heart: "/activity-images/community_charity_volunteers.png",
  Dumbbell: "/activity-images/martial_arts_training.png",
  Bike: "/activity-images/road_cycling_race.png",
  Globe: "/activity-images/community_charity_volunteers.png",
  Star: "/activity-images/theater_stage_performance.png",
  Award: "/activity-images/athletics_track_runners.png",
  Zap: "/activity-images/martial_arts_training.png",
  Coffee: "/activity-images/community_charity_volunteers.png",
  Sparkles: "/activity-images/dance_performance_artistic.png",
  Utensils: "/activity-images/community_charity_volunteers.png",
};
import { useState, useMemo } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Association, AssociationUser } from "@shared/schema";

type SafeAssociationUser = Omit<AssociationUser, "passwordHash">;

interface AssociationAdminLayoutProps {
  children: React.ReactNode;
  association: Association | null;
  user: SafeAssociationUser | null;
  tenantSlug: string;
}

interface TenantFeatures {
  hasIdeas: boolean;
  hasIncidents: boolean;
  hasMeetings: boolean;
  features: string[];
}

export function AssociationAdminLayout({ children, association, user, tenantSlug }: AssociationAdminLayoutProps) {
  const [location, navigate] = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const assocSlug = association?.slug || "";

  const { data: features } = useQuery<TenantFeatures>({
    queryKey: [`/api/structures/${tenantSlug}/${assocSlug}/features`],
    enabled: !!tenantSlug && !!assocSlug,
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", `/api/tenants/${tenantSlug}/associations/${assocSlug}/logout`);
    },
    onSuccess: () => {
      queryClient.clear();
      navigate(`/structures/${tenantSlug}/${assocSlug}/login`);
    },
  });

  const allNavItems = useMemo(() => [
    { href: `/structures/${tenantSlug}/${assocSlug}/admin`, label: "Tableau de bord", icon: LayoutDashboard, exact: true, featureKey: null },
    { href: `/structures/${tenantSlug}/${assocSlug}/admin/ideas`, label: "Idees", icon: Lightbulb, featureKey: "hasIdeas" as const },
    { href: `/structures/${tenantSlug}/${assocSlug}/admin/incidents`, label: "Signalements", icon: AlertTriangle, featureKey: "hasIncidents" as const },
    { href: `/structures/${tenantSlug}/${assocSlug}/admin/meetings`, label: "Evenements", icon: Calendar, featureKey: "hasMeetings" as const },
    { href: `/structures/${tenantSlug}/${assocSlug}/admin/bureau`, label: "Bureau", icon: UserCog, featureKey: null },
    { href: `/structures/${tenantSlug}/${assocSlug}/admin/domains`, label: "Domaines", icon: Tags, featureKey: null },
    { href: `/structures/${tenantSlug}/${assocSlug}/admin/photos`, label: "Photos", icon: Image, featureKey: null },
    { href: `/structures/${tenantSlug}/${assocSlug}/admin/sharing`, label: "Partage", icon: Share2, featureKey: null },
    { href: `/structures/${tenantSlug}/${assocSlug}/admin/settings`, label: "Parametres", icon: Settings, featureKey: null },
  ], [tenantSlug, assocSlug]);

  const isActive = (href: string, exact?: boolean) => {
    if (exact) return location === href;
    return location.startsWith(href);
  };

  const isFeatureEnabled = (featureKey: "hasIdeas" | "hasIncidents" | "hasMeetings" | null): boolean => {
    if (!featureKey) return true;
    if (!features) return true;
    return features[featureKey];
  };

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              data-testid="button-mobile-menu"
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
            <Link href={`/structures/${tenantSlug}/${assocSlug}/admin`} className="flex items-center gap-2" data-testid="link-assoc-admin-home">
              {association?.logoUrl ? (
                <img 
                  src={association.logoUrl.startsWith('/objects/') ? association.logoUrl : association.logoUrl.startsWith('http') ? association.logoUrl : `/objects/${association.logoUrl}`} 
                  alt={association.name || "Logo"} 
                  className="h-9 w-9 rounded-lg object-cover"
                  data-testid="img-association-logo"
                />
              ) : association?.logoIcon && ACTIVITY_IMAGES[association.logoIcon] ? (
                <img 
                  src={ACTIVITY_IMAGES[association.logoIcon]} 
                  alt={association.name || "Logo"} 
                  className="h-9 w-9 rounded-lg object-cover"
                  data-testid="img-association-logo"
                />
              ) : (
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
                  <Users className="h-5 w-5 text-primary-foreground" />
                </div>
              )}
              <div className="hidden sm:block">
                <span className="font-display font-bold">{association?.name || "Association"}</span>
                <span className="text-xs text-muted-foreground block">Administration</span>
              </div>
            </Link>
          </div>

          <div className="flex items-center gap-2">
            <Link href={`/structures/${tenantSlug}/${assocSlug}`} target="_blank">
              <Button variant="ghost" size="sm" className="gap-2 hidden sm:flex" data-testid="button-view-public">
                <ExternalLink className="h-4 w-4" />
                Voir le site
              </Button>
            </Link>
            <ThemeToggle />
            <Button
              variant="ghost"
              size="icon"
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
          fixed inset-y-0 left-0 z-40 w-64 transform bg-sidebar border-r transition-transform duration-200 ease-in-out lg:relative lg:translate-x-0 lg:pt-0 pt-16
          ${mobileMenuOpen ? "translate-x-0" : "-translate-x-full"}
        `}>
          <nav className="flex flex-col gap-1 p-4">
            {allNavItems.map((item) => {
              const enabled = isFeatureEnabled(item.featureKey);
              
              if (!enabled) {
                return (
                  <Tooltip key={item.href}>
                    <TooltipTrigger asChild>
                      <div className="w-full">
                        <Button
                          variant="ghost"
                          className="w-full justify-start gap-3 opacity-50 cursor-not-allowed"
                          disabled
                          data-testid={`link-assoc-admin-${item.label.toLowerCase()}-disabled`}
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
              
              return (
                <Link key={item.href} href={item.href}>
                  <Button
                    variant={isActive(item.href, item.exact) ? "secondary" : "ghost"}
                    className="w-full justify-start gap-3"
                    onClick={() => setMobileMenuOpen(false)}
                    data-testid={`link-assoc-admin-${item.label.toLowerCase()}`}
                  >
                    <item.icon className="h-4 w-4" />
                    {item.label}
                  </Button>
                </Link>
              );
            })}
          </nav>

          {user && (
            <div className="absolute bottom-0 left-0 right-0 p-4 border-t">
              <div className="text-sm">
                <p className="font-medium truncate">{user.name}</p>
                <p className="text-muted-foreground text-xs truncate">{user.email}</p>
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
          {children}
        </main>
      </div>
    </div>
  );
}
