import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { MainLayout } from "@/components/layout/main-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, Building2, Users, Landmark, ArrowRight } from "lucide-react";

interface Organization {
  id: string;
  name: string;
  type: "MAIRIE" | "EPCI" | "ASSOCIATION";
  slug: string;
  parentSlug?: string;
  logoUrl?: string | null;
}

const typeLabels = {
  MAIRIE: "Mairie",
  EPCI: "EPCI",
  ASSOCIATION: "Association",
};

const typeIcons = {
  MAIRIE: Landmark,
  EPCI: Building2,
  ASSOCIATION: Users,
};

const typeColors = {
  MAIRIE: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  EPCI: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  ASSOCIATION: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
};

export default function SearchOrganizations() {
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  const { data: organizations = [], isLoading } = useQuery<Organization[]>({
    queryKey: ["/api/public/organizations", typeFilter !== "all" ? typeFilter : null, searchQuery].filter(Boolean),
    queryFn: async () => {
      const params = new URLSearchParams();
      if (typeFilter && typeFilter !== "all") {
        params.set("type", typeFilter);
      }
      if (searchQuery.trim()) {
        params.set("search", searchQuery.trim());
      }
      const response = await fetch(`/api/public/organizations?${params.toString()}`);
      if (!response.ok) throw new Error("Failed to fetch organizations");
      return response.json();
    },
  });

  const getOrganizationLink = (org: Organization) => {
    if (org.type === "ASSOCIATION" && org.parentSlug) {
      return `/structures/${org.parentSlug}/${org.slug}`;
    }
    return `/structures/${org.slug}`;
  };

  return (
    <MainLayout>
      <div className="mx-auto max-w-4xl px-4 py-12">
        <div className="text-center mb-10">
          <h1 className="font-display text-3xl font-bold sm:text-4xl mb-4" data-testid="text-search-title">
            Trouver une organisation
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Recherchez une mairie, un EPCI ou une association pour acceder a leur espace citoyen
            et participer a la vie locale.
          </p>
        </div>

        <Card className="mb-8">
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Rechercher par nom ou ville..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                  data-testid="input-search-organizations"
                />
              </div>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-full sm:w-48" data-testid="select-organization-type">
                  <SelectValue placeholder="Type d'organisme" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les types</SelectItem>
                  <SelectItem value="MAIRIE">Mairies</SelectItem>
                  <SelectItem value="EPCI">EPCI</SelectItem>
                  <SelectItem value="ASSOCIATION">Associations</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <Card key={i}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    <Skeleton className="h-12 w-12 rounded-lg" />
                    <div className="flex-1">
                      <Skeleton className="h-5 w-48 mb-2" />
                      <Skeleton className="h-4 w-32" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : organizations.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <Search className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="font-semibold text-lg mb-2">Aucune organisation trouvee</h3>
              <p className="text-muted-foreground">
                {searchQuery || typeFilter !== "all"
                  ? "Essayez de modifier vos criteres de recherche."
                  : "Aucune organisation n'est encore inscrite sur la plateforme."}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground mb-4">
              {organizations.length} organisation{organizations.length > 1 ? "s" : ""} trouvee{organizations.length > 1 ? "s" : ""}
            </p>
            {organizations.map((org) => {
              const TypeIcon = typeIcons[org.type];
              return (
                <Link key={org.id} href={getOrganizationLink(org)}>
                  <Card className="overflow-visible hover-elevate cursor-pointer" data-testid={`card-org-${org.id}`}>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-4">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-muted">
                          {org.logoUrl ? (
                            <img 
                              src={org.logoUrl} 
                              alt={org.name} 
                              className="h-10 w-10 rounded-md object-cover"
                            />
                          ) : (
                            <TypeIcon className="h-6 w-6 text-muted-foreground" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-semibold truncate">{org.name}</h3>
                            <Badge 
                              variant="secondary" 
                              className={`text-xs ${typeColors[org.type]}`}
                            >
                              {typeLabels[org.type]}
                            </Badge>
                          </div>
                        </div>
                        <ArrowRight className="h-5 w-5 text-muted-foreground shrink-0" />
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </MainLayout>
  );
}
