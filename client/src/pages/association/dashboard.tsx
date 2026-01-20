import { useParams, useLocation, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { AssociationAdminLayout } from "@/components/layout/association-admin-layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Settings, Mail, User, Lightbulb, AlertTriangle, Calendar, Users, ArrowRight } from "lucide-react";
import type { Association, AssociationUser } from "@shared/schema";

type SafeAssociationUser = Omit<AssociationUser, "passwordHash">;

interface AssociationStats {
  ideasCount: number;
  ideasNew: number;
  incidentsCount: number;
  incidentsNew: number;
  meetingsCount: number;
  meetingsUpcoming: number;
  bureauMembersCount: number;
}

export default function AssociationDashboard() {
  const params = useParams<{ slug: string; assocSlug: string }>();
  const [, navigate] = useLocation();

  const { data, isLoading, error } = useQuery<{ user: SafeAssociationUser; association: Association }>({
    queryKey: ["/api/tenants", params.slug, "associations", params.assocSlug, "me"],
    retry: false,
  });

  const { data: stats, isLoading: statsLoading } = useQuery<AssociationStats>({
    queryKey: ["/api/associations", data?.association?.id, "admin", "stats"],
    enabled: !!data?.association?.id,
  });

  if (error) {
    navigate(`/structures/${params.slug}/${params.assocSlug}/login`);
    return null;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-muted/30 p-6">
        <div className="max-w-4xl mx-auto">
          <Skeleton className="h-16 w-full mb-6" />
          <Skeleton className="h-48 w-full" />
        </div>
      </div>
    );
  }

  const { user, association } = data || {};

  return (
    <AssociationAdminLayout association={association || null} user={user || null} tenantSlug={params.slug}>
      <div className="p-6">
        <div className="mb-8">
          <h1 className="font-display text-3xl font-bold" data-testid="text-assoc-dashboard-title">
            Bienvenue, {user?.name}
          </h1>
          <p className="text-muted-foreground mt-1">Gerez votre association depuis ce tableau de bord.</p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
              <CardTitle className="text-sm font-medium">Idees</CardTitle>
              <Lightbulb className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <>
                  <div className="text-2xl font-bold" data-testid="text-ideas-count">{stats?.ideasCount || 0}</div>
                  <p className="text-xs text-muted-foreground">{stats?.ideasNew || 0} nouvelle(s)</p>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
              <CardTitle className="text-sm font-medium">Signalements</CardTitle>
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <>
                  <div className="text-2xl font-bold" data-testid="text-incidents-count">{stats?.incidentsCount || 0}</div>
                  <p className="text-xs text-muted-foreground">{stats?.incidentsNew || 0} nouveau(x)</p>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
              <CardTitle className="text-sm font-medium">Evenements</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <>
                  <div className="text-2xl font-bold" data-testid="text-meetings-count">{stats?.meetingsCount || 0}</div>
                  <p className="text-xs text-muted-foreground">{stats?.meetingsUpcoming || 0} a venir</p>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
              <CardTitle className="text-sm font-medium">Bureau</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <>
                  <div className="text-2xl font-bold" data-testid="text-bureau-count">{stats?.bureauMembersCount || 0}</div>
                  <p className="text-xs text-muted-foreground">membre(s)</p>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Informations
              </CardTitle>
              <CardDescription>Details de l'association</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-sm text-muted-foreground">Nom</p>
                <p className="font-medium">{association?.name}</p>
              </div>
              {association?.description && (
                <div>
                  <p className="text-sm text-muted-foreground">Description</p>
                  <p className="font-medium">{association.description}</p>
                </div>
              )}
              {association?.contactEmail && (
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span>{association.contactEmail}</span>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Votre compte
              </CardTitle>
              <CardDescription>Vos informations</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-sm text-muted-foreground">Nom</p>
                <p className="font-medium">{user?.name}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Email</p>
                <p className="font-medium">{user?.email}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Role</p>
                <p className="font-medium">{user?.role === "ADMIN" ? "Administrateur" : "Membre"}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lightbulb className="h-5 w-5" />
                Actions rapides
              </CardTitle>
              <CardDescription>Acces aux fonctionnalites</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <Link href={`/structures/${params.slug}/${params.assocSlug}/admin/ideas`}>
                <Button variant="ghost" className="w-full justify-between" data-testid="link-ideas">
                  <span className="flex items-center gap-2">
                    <Lightbulb className="h-4 w-4" />
                    Gerer les idees
                  </span>
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link href={`/structures/${params.slug}/${params.assocSlug}/admin/incidents`}>
                <Button variant="ghost" className="w-full justify-between" data-testid="link-incidents">
                  <span className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    Gerer les signalements
                  </span>
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link href={`/structures/${params.slug}/${params.assocSlug}/admin/meetings`}>
                <Button variant="ghost" className="w-full justify-between" data-testid="link-meetings">
                  <span className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Gerer les evenements
                  </span>
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link href={`/structures/${params.slug}/${params.assocSlug}/admin/bureau`}>
                <Button variant="ghost" className="w-full justify-between" data-testid="link-bureau">
                  <span className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Gerer le bureau
                  </span>
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </AssociationAdminLayout>
  );
}
