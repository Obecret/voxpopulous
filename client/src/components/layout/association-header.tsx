import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { 
  Users, Menu, X, Lightbulb, AlertTriangle, Calendar, Settings, UserCircle,
  Music, Palette, Dumbbell, Heart, BookOpen, TreePine, Camera, Utensils, 
  Gamepad2, Bike, Globe, Star, Award, Zap, Coffee, Sparkles, Handshake,
  type LucideIcon
} from "lucide-react";
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Association, Tenant } from "@shared/schema";

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

interface AssociationHeaderProps {
  association: Association | null;
  tenant: Tenant | null;
}

interface TenantFeatures {
  hasIdeas: boolean;
  hasIncidents: boolean;
  hasEvents: boolean;
  features: string[];
}

export function AssociationHeader({ association, tenant }: AssociationHeaderProps) {
  const [location] = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const slug = tenant?.slug || "";
  const assocSlug = association?.slug || "";
  const basePath = `/structures/${slug}/${assocSlug}`;

  const { data: features } = useQuery<TenantFeatures>({
    queryKey: [`/api/structures/${slug}/${assocSlug}/features`],
    enabled: !!slug && !!assocSlug,
  });

  const allLinks = useMemo(() => [
    { href: `${basePath}/ideas`, label: "Idees", icon: Lightbulb, featureKey: "hasIdeas" as const },
    { href: `${basePath}/incidents`, label: "Signalements", icon: AlertTriangle, featureKey: "hasIncidents" as const },
    { href: `${basePath}/events`, label: "Evenements", icon: Calendar, featureKey: "hasEvents" as const },
    { href: `${basePath}/bureau`, label: "Bureau", icon: UserCircle, featureKey: null },
  ], [basePath]);

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
          <Link href={basePath} className="flex items-center gap-2" data-testid="link-association-home">
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
            <div className="flex flex-col">
              <span className="font-display text-lg font-bold tracking-tight truncate max-w-[200px]">
                {association?.name || "Association"}
              </span>
              {tenant && (
                <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                  {tenant.name}
                </span>
              )}
            </div>
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
            <Link href={`${basePath}/login`} className="hidden sm:block">
              <Button variant="outline" size="sm" data-testid="button-admin">
                <Settings className="h-4 w-4 mr-2" />
                Admin
              </Button>
            </Link>
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
              <Link href={`${basePath}/login`} onClick={() => setMobileMenuOpen(false)}>
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
