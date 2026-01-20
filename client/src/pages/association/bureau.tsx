import { useParams, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { AssociationLayout } from "@/components/layout/association-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { UserCircle, Mail, MessageCircle, ArrowRight, ArrowLeft } from "lucide-react";
import type { Tenant, Association, BureauMember, AssociationInterventionDomain } from "@shared/schema";

type BureauMemberWithDomains = BureauMember & { domains?: AssociationInterventionDomain[] };

function getPhotoUrl(photoObjectPath: string | null | undefined, photoUrl: string | null | undefined): string | undefined {
  if (photoObjectPath) {
    const parts = photoObjectPath.split('/');
    const uploadsIndex = parts.findIndex(p => p === 'uploads');
    if (uploadsIndex !== -1) {
      return '/objects/' + parts.slice(uploadsIndex).join('/');
    }
  }
  return photoUrl || undefined;
}

function getFunctionLevel(fn: string | null): "primary" | "secondary" | "tertiary" {
  if (!fn) return "tertiary";
  const lower = fn.toLowerCase();
  if (lower.includes("president") && !lower.includes("vice")) return "primary";
  if (lower.includes("vice") || lower.includes("secretaire") || lower.includes("tresorier")) return "secondary";
  return "tertiary";
}

function getFunctionColors(level: "primary" | "secondary" | "tertiary") {
  switch (level) {
    case "primary":
      return {
        ring: "ring-2 ring-amber-500/50",
        bg: "bg-amber-50 dark:bg-amber-950/20",
        badge: "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200",
        text: "text-amber-700 dark:text-amber-400",
      };
    case "secondary":
      return {
        ring: "ring-2 ring-blue-500/50",
        bg: "bg-blue-50 dark:bg-blue-950/20",
        badge: "bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200",
        text: "text-blue-700 dark:text-blue-400",
      };
    case "tertiary":
      return {
        ring: "",
        bg: "",
        badge: "",
        text: "text-muted-foreground",
      };
  }
}

export default function AssociationBureau() {
  const params = useParams<{ slug: string; assocSlug: string }>();

  const { data: tenant } = useQuery<Tenant>({
    queryKey: ["/api/tenants", params.slug],
  });

  const { data: association } = useQuery<Association>({
    queryKey: ["/api/tenants", params.slug, "associations", params.assocSlug],
  });

  const { data: bureauMembers, isLoading } = useQuery<BureauMemberWithDomains[]>({
    queryKey: ["/api/associations", association?.id, "bureau"],
    enabled: !!association?.id,
  });

  const getInitials = (firstName: string, lastName: string) => {
    return ((firstName?.[0] || "") + (lastName?.[0] || "")).toUpperCase();
  };

  const getFullName = (member: BureauMember) => {
    return `${member.firstName} ${member.lastName}`.trim();
  };

  const renderMemberCard = (member: BureauMemberWithDomains, size: "large" | "medium" | "small" = "medium") => {
    const level = getFunctionLevel(member.function);
    const colors = getFunctionColors(level);
    
    const avatarSize = size === "large" ? "h-20 w-20" : size === "medium" ? "h-14 w-14" : "h-10 w-10";
    const nameSize = size === "large" ? "text-xl" : size === "medium" ? "text-base" : "text-sm";
    const padding = size === "large" ? "p-6" : size === "medium" ? "p-5" : "p-4";

    return (
      <Link href={`/structures/${params.slug}/${params.assocSlug}/bureau/${member.id}`} key={member.id} data-testid={`link-member-${member.id}`}>
        <Card 
          className={`hover-elevate cursor-pointer transition-all group ${colors.ring} ${colors.bg}`} 
          data-testid={`card-member-${member.id}`}
        >
          <CardContent className={padding}>
            <div className="flex flex-wrap items-start gap-4">
              <Avatar className={avatarSize}>
                <AvatarImage src={getPhotoUrl(member.photoObjectPath, member.photoUrl)} alt={getFullName(member)} />
                <AvatarFallback className={size === "large" ? "text-lg" : size === "small" ? "text-xs" : ""}>{getInitials(member.firstName, member.lastName)}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h3 className={`font-semibold ${nameSize}`} data-testid={`text-member-name-${member.id}`}>
                      {getFullName(member)}
                    </h3>
                    {member.function && (
                      <p className={`font-medium text-sm ${colors.text}`} data-testid={`text-member-function-${member.id}`}>
                        {member.function}
                      </p>
                    )}
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                </div>
                
                {size !== "small" && member.domains && member.domains.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {member.domains.slice(0, 3).map((domain) => (
                      <Badge 
                        key={domain.id} 
                        variant="secondary" 
                        className={`text-xs ${colors.badge}`}
                        data-testid={`badge-domain-${domain.id}`}
                      >
                        {domain.name}
                      </Badge>
                    ))}
                    {member.domains.length > 3 && (
                      <Badge variant="secondary" className="text-xs" data-testid={`badge-domains-more-${member.id}`}>
                        +{member.domains.length - 3}
                      </Badge>
                    )}
                  </div>
                )}

                {size !== "small" && (
                  <div className="flex flex-wrap items-center gap-3 mt-3 text-xs text-muted-foreground">
                    {member.email && (
                      <span className="inline-flex items-center gap-1" data-testid={`text-member-email-indicator-${member.id}`}>
                        <Mail className="h-3 w-3" />
                        Contact
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1" data-testid={`text-member-chat-indicator-${member.id}`}>
                      <MessageCircle className="h-3 w-3" />
                      Contacter
                    </span>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </Link>
    );
  };

  const sortedMembers = bureauMembers?.filter(m => m.isActive) || [];
  const primaryMembers = sortedMembers.filter(m => getFunctionLevel(m.function) === "primary");
  const secondaryMembers = sortedMembers.filter(m => getFunctionLevel(m.function) === "secondary");
  const tertiaryMembers = sortedMembers.filter(m => getFunctionLevel(m.function) === "tertiary");

  return (
    <AssociationLayout association={association || null} tenant={tenant || null}>
      <div className="mx-auto max-w-7xl px-4 py-8">
        <div className="mb-8">
          <Link href={`/structures/${params.slug}/${params.assocSlug}`} data-testid="link-back">
            <Button variant="ghost" size="sm" className="mb-4" data-testid="button-back">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Retour
            </Button>
          </Link>
          <h1 className="font-display text-3xl font-bold" data-testid="text-bureau-title">
            Le bureau
          </h1>
          <p className="text-muted-foreground mt-1" data-testid="text-bureau-subtitle">
            Decouvrez les membres du bureau et contactez-les directement.
          </p>
        </div>

        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <CardContent className="p-6">
                  <div className="flex flex-wrap items-center gap-4">
                    <Skeleton className="h-16 w-16 rounded-full" />
                    <div className="flex-1">
                      <Skeleton className="h-5 w-32 mb-2" />
                      <Skeleton className="h-4 w-24" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : sortedMembers.length > 0 ? (
          <div className="space-y-12">
            {primaryMembers.length > 0 && (
              <div>
                <h2 className="font-display text-xl font-semibold mb-4 flex flex-wrap items-center gap-2" data-testid="text-section-primary">
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  Presidence
                </h2>
                <div className="grid gap-6 md:grid-cols-2">
                  {primaryMembers.map((member) => renderMemberCard(member, "large"))}
                </div>
              </div>
            )}

            {secondaryMembers.length > 0 && (
              <div>
                <h2 className="font-display text-xl font-semibold mb-4 flex flex-wrap items-center gap-2" data-testid="text-section-secondary">
                  <span className="w-2 h-2 rounded-full bg-blue-500" />
                  Bureau executif
                </h2>
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                  {secondaryMembers.map((member) => renderMemberCard(member, "medium"))}
                </div>
              </div>
            )}

            {tertiaryMembers.length > 0 && (
              <div>
                <h2 className="font-display text-xl font-semibold mb-4 text-muted-foreground" data-testid="text-section-tertiary">
                  Autres membres du bureau
                </h2>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {tertiaryMembers.map((member) => renderMemberCard(member, "small"))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <Card>
            <CardContent className="py-16 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4">
                <UserCircle className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="font-semibold text-lg mb-2" data-testid="text-no-members-title">Bureau non renseigne</h3>
              <p className="text-muted-foreground" data-testid="text-no-members">
                Les membres du bureau n'ont pas encore ete ajoutes.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </AssociationLayout>
  );
}
