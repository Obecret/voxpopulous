import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";

const THEMES: Record<string, { primary: string; accent: string }> = {
  blue: { primary: "217 91% 45%", accent: "199 89% 48%" },
  green: { primary: "142 76% 36%", accent: "158 64% 42%" },
  purple: { primary: "271 81% 56%", accent: "262 83% 58%" },
  orange: { primary: "24 95% 53%", accent: "38 92% 50%" },
  red: { primary: "0 72% 51%", accent: "348 83% 47%" },
  teal: { primary: "173 80% 40%", accent: "181 69% 47%" },
  pink: { primary: "330 81% 60%", accent: "322 81% 43%" },
  slate: { primary: "215 25% 47%", accent: "215 20% 55%" },
};

function applyTheme(themeKey: string) {
  const theme = THEMES[themeKey] || THEMES.blue;
  const root = document.documentElement;
  
  root.style.setProperty("--primary", theme.primary);
  root.style.setProperty("--ring", theme.primary);
  root.style.setProperty("--sidebar-primary", theme.primary);
  root.style.setProperty("--sidebar-ring", theme.primary);
  
  const isDark = root.classList.contains("dark");
  const accentLightness = isDark ? "14%" : "91%";
  const accentForegroundLightness = isDark ? "88%" : "12%";
  const hue = theme.primary.split(" ")[0];
  
  root.style.setProperty("--accent", `${hue} 15% ${accentLightness}`);
  root.style.setProperty("--accent-foreground", `${hue} 15% ${accentForegroundLightness}`);
}

export function useSuperadminTheme() {
  const { data } = useQuery<{ themeKey: string }>({
    queryKey: ["/api/superadmin/settings/theme"],
    staleTime: 1000 * 60 * 5,
  });

  useEffect(() => {
    if (data?.themeKey) {
      applyTheme(data.themeKey);
    }
  }, [data?.themeKey]);

  return data?.themeKey || "blue";
}
