import { Building2, Users, Network, LucideIcon } from "lucide-react";

export type OrganizationType = "MAIRIE" | "EPCI" | "ASSOCIATION";

export interface PlanTheme {
  type: OrganizationType;
  label: string;
  icon: LucideIcon;
  colors: {
    primary: string;
    primaryForeground: string;
    border: string;
    background: string;
    badgeBg: string;
    badgeText: string;
    gradientFrom: string;
    gradientTo: string;
  };
}

export const planThemes: Record<OrganizationType, PlanTheme> = {
  MAIRIE: {
    type: "MAIRIE",
    label: "Mairies",
    icon: Building2,
    colors: {
      primary: "hsl(221, 83%, 53%)",
      primaryForeground: "hsl(0, 0%, 100%)",
      border: "hsl(221, 83%, 70%)",
      background: "hsl(221, 83%, 97%)",
      badgeBg: "hsl(221, 83%, 53%)",
      badgeText: "hsl(0, 0%, 100%)",
      gradientFrom: "hsl(221, 83%, 53%)",
      gradientTo: "hsl(221, 83%, 40%)",
    },
  },
  EPCI: {
    type: "EPCI",
    label: "Intercommunalités",
    icon: Network,
    colors: {
      primary: "hsl(142, 71%, 45%)",
      primaryForeground: "hsl(0, 0%, 100%)",
      border: "hsl(142, 71%, 65%)",
      background: "hsl(142, 71%, 97%)",
      badgeBg: "hsl(142, 71%, 45%)",
      badgeText: "hsl(0, 0%, 100%)",
      gradientFrom: "hsl(142, 71%, 45%)",
      gradientTo: "hsl(142, 71%, 35%)",
    },
  },
  ASSOCIATION: {
    type: "ASSOCIATION",
    label: "Associations",
    icon: Users,
    colors: {
      primary: "hsl(262, 83%, 58%)",
      primaryForeground: "hsl(0, 0%, 100%)",
      border: "hsl(262, 83%, 75%)",
      background: "hsl(262, 83%, 97%)",
      badgeBg: "hsl(262, 83%, 58%)",
      badgeText: "hsl(0, 0%, 100%)",
      gradientFrom: "hsl(262, 83%, 58%)",
      gradientTo: "hsl(262, 83%, 45%)",
    },
  },
};

export function getPlanTheme(orgTypeOrCode: string): PlanTheme {
  const code = orgTypeOrCode.toUpperCase();
  
  if (code === "ASSO" || code === "ASSOCIATION") {
    return planThemes.ASSOCIATION;
  }
  if (code === "EPCI") {
    return planThemes.EPCI;
  }
  if (code === "MAIRIE") {
    return planThemes.MAIRIE;
  }
  return planThemes.MAIRIE;
}

export function getThemeClasses(theme: PlanTheme) {
  return {
    card: `border-2`,
    cardStyle: {
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.background,
    },
    header: `text-white`,
    headerStyle: {
      background: `linear-gradient(135deg, ${theme.colors.gradientFrom}, ${theme.colors.gradientTo})`,
    },
    badge: ``,
    badgeStyle: {
      backgroundColor: theme.colors.badgeBg,
      color: theme.colors.badgeText,
    },
    button: `text-white`,
    buttonStyle: {
      backgroundColor: theme.colors.primary,
    },
  };
}
