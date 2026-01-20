import { useParams, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { AdminLayout } from "@/components/layout/admin-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Lightbulb, AlertTriangle, Calendar, ArrowRight } from "lucide-react";
import { useAdminSession } from "@/hooks/use-admin-session";

interface DashboardStats {
  ideas: { total: number; new: number };
  incidents: { total: number; new: number };
  meetings: { total: number; upcoming: number };
}

export default function AdminDashboard() {
  const params = useParams<{ slug: string }>();
  const { session, tenant, user, electedOfficial, isLoading, accountBlocked, blockReason } = useAdminSession(params.slug);

  const { data: stats, isLoading: statsLoading } = useQuery<DashboardStats>({
    queryKey: ["/api/tenants", params.slug, "admin", "stats"],
    enabled: !!session,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="p-6">
          <Skeleton className="h-10 w-64 mb-6" />
          <div className="grid gap-4 md:grid-cols-3">
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
          </div>
        </div>
      </div>
    );
  }

  const statCards = [
    {
      title: "Idees",
      icon: Lightbulb,
      total: stats?.ideas.total || 0,
      new: stats?.ideas.new || 0,
      href: `/structures/${params.slug}/admin/ideas`,
      color: "text-amber-600 dark:text-amber-400",
      bgColor: "bg-amber-500/10",
    },
    {
      title: "Signalements",
      icon: AlertTriangle,
      total: stats?.incidents.total || 0,
      new: stats?.incidents.new || 0,
      href: `/structures/${params.slug}/admin/incidents`,
      color: "text-red-600 dark:text-red-400",
      bgColor: "bg-red-500/10",
    },
    {
      title: "Evenements",
      icon: Calendar,
      total: stats?.meetings.total || 0,
      new: stats?.meetings.upcoming || 0,
      newLabel: "a venir",
      href: `/structures/${params.slug}/admin/meetings`,
      color: "text-blue-600 dark:text-blue-400",
      bgColor: "bg-blue-500/10",
    },
  ];

  return (
    <AdminLayout 
      tenant={tenant || null} 
      user={user}
      electedOfficial={electedOfficial}
      accountBlocked={accountBlocked}
      blockReason={blockReason}
    >
      <div className="p-6">
        <div className="mb-8">
          <h1 className="font-display text-3xl font-bold" data-testid="text-dashboard-title">
            Tableau de bord
          </h1>
          <p className="text-muted-foreground mt-1">
            Bienvenue, {session?.name}. Voici un apercu de votre espace.
          </p>
        </div>

        {statsLoading ? (
          <div className="grid gap-4 md:grid-cols-3">
            <Skeleton className="h-40" />
            <Skeleton className="h-40" />
            <Skeleton className="h-40" />
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-3">
            {statCards.map((card) => (
              <Card key={card.title} className="hover-elevate" data-testid={`card-stat-${card.title.toLowerCase()}`}>
                <CardHeader className="flex flex-row items-center justify-between gap-4 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {card.title}
                  </CardTitle>
                  <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${card.bgColor}`}>
                    <card.icon className={`h-5 w-5 ${card.color}`} />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{card.total}</div>
                  {card.new > 0 && (
                    <p className="text-sm text-muted-foreground mt-1">
                      <span className={`font-medium ${card.color}`}>{card.new}</span>{" "}
                      {card.newLabel || "nouveaux"}
                    </p>
                  )}
                  <Link href={card.href}>
                    <Button variant="ghost" size="sm" className="mt-3 -ml-2 gap-2" data-testid={`button-view-${card.title.toLowerCase()}`}>
                      Voir tout
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Actions rapides</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3">
              <Link href={`/structures/${params.slug}/admin/meetings`}>
                <Button variant="outline" className="w-full justify-start gap-3" data-testid="button-new-meeting">
                  <Calendar className="h-4 w-4" />
                  Planifier un evenement
                </Button>
              </Link>
              <Link href={`/structures/${params.slug}/admin/ideas?status=NEW`}>
                <Button variant="outline" className="w-full justify-start gap-3" data-testid="button-review-ideas">
                  <Lightbulb className="h-4 w-4" />
                  Examiner les nouvelles idees
                </Button>
              </Link>
              <Link href={`/structures/${params.slug}/admin/incidents?status=NEW`}>
                <Button variant="outline" className="w-full justify-start gap-3" data-testid="button-review-incidents">
                  <AlertTriangle className="h-4 w-4" />
                  Traiter les nouveaux signalements
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Informations du compte</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-muted-foreground">Structure</span>
                <span className="font-medium">{tenant?.name}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-muted-foreground">Abonnement</span>
                <span className="font-medium capitalize">
                  {tenant?.subscriptionPlan?.toLowerCase().replace("_", " ")}
                </span>
              </div>
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-muted-foreground">Statut</span>
                <span className="font-medium capitalize">
                  {tenant?.billingStatus?.toLowerCase()}
                </span>
              </div>
              {tenant?.trialEndsAt && (
                <div className="flex justify-between items-center py-2">
                  <span className="text-muted-foreground">Fin de l'essai</span>
                  <span className="font-medium">
                    {new Date(tenant.trialEndsAt).toLocaleDateString("fr-FR")}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
}
