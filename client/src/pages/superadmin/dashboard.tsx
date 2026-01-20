import { useQuery } from "@tanstack/react-query";
import { Building2, Users, TrendingUp, Clock, CheckCircle, XCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SuperadminLayout } from "./layout";
import type { Tenant } from "@shared/schema";

interface GlobalStats {
  tenants: { total: number; trial: number; active: number; cancelled: number };
  leads: { total: number; new: number; converted: number };
}

const PLAN_PRICES = {
  STANDARD: { monthly: 49, yearly: 490 },
  PREMIUM: { monthly: 99, yearly: 990 },
};

export default function SuperadminDashboard() {
  const { data: stats, isLoading: statsLoading } = useQuery<GlobalStats>({
    queryKey: ["/api/superadmin/stats"],
  });

  const { data: tenantsData, isLoading: tenantsLoading } = useQuery<{ tenants: Tenant[] }>({
    queryKey: ["/api/superadmin/tenants"],
  });
  const tenants = tenantsData?.tenants;

  const calculateMRR = () => {
    if (!tenants) return 0;
    return tenants.reduce((total, tenant) => {
      if (tenant.billingStatus !== "ACTIVE") return total;
      if (tenant.subscriptionPlan === "STANDARD") return total + PLAN_PRICES.STANDARD.monthly;
      if (tenant.subscriptionPlan === "PREMIUM") return total + PLAN_PRICES.PREMIUM.monthly;
      return total;
    }, 0);
  };

  const mrr = calculateMRR();
  const arr = mrr * 12;

  const statCards = [
    {
      title: "Clients total",
      value: stats?.tenants.total || 0,
      icon: Building2,
      color: "bg-blue-500/10 text-blue-500",
    },
    {
      title: "En periode d'essai",
      value: stats?.tenants.trial || 0,
      icon: Clock,
      color: "bg-yellow-500/10 text-yellow-500",
    },
    {
      title: "Abonnements actifs",
      value: stats?.tenants.active || 0,
      icon: CheckCircle,
      color: "bg-green-500/10 text-green-500",
    },
    {
      title: "Prospects",
      value: stats?.leads.total || 0,
      icon: Users,
      color: "bg-purple-500/10 text-purple-500",
    },
  ];

  const revenueCards = [
    {
      title: "MRR (Revenu Mensuel)",
      value: `${mrr.toLocaleString()} €`,
      description: "Revenus recurrents mensuels",
      icon: TrendingUp,
      color: "bg-emerald-500/10 text-emerald-500",
    },
    {
      title: "ARR (Revenu Annuel)",
      value: `${arr.toLocaleString()} €`,
      description: "Revenus recurrents annuels",
      icon: TrendingUp,
      color: "bg-emerald-500/10 text-emerald-500",
    },
  ];

  const isLoading = statsLoading || tenantsLoading;

  return (
    <SuperadminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-dashboard-title">
            Tableau de bord
          </h1>
          <p className="text-muted-foreground">
            Vue d'ensemble de la plateforme Voxpopulous.fr
          </p>
        </div>

        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <Card key={i}>
                <CardContent className="p-6">
                  <div className="animate-pulse space-y-2">
                    <div className="h-4 bg-muted rounded w-1/2" />
                    <div className="h-8 bg-muted rounded w-1/3" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {statCards.map((stat, index) => (
                <Card key={index} data-testid={`card-stat-${index}`}>
                  <CardContent className="p-6">
                    <div className="flex items-center gap-4">
                      <div className={`flex h-12 w-12 items-center justify-center rounded-lg ${stat.color}`}>
                        <stat.icon className="h-6 w-6" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">{stat.title}</p>
                        <p className="text-2xl font-bold">{stat.value}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {revenueCards.map((card, index) => (
                <Card key={index} data-testid={`card-revenue-${index}`}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${card.color}`}>
                        <card.icon className="h-4 w-4" />
                      </div>
                      {card.title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-3xl font-bold">{card.value}</p>
                    <p className="text-sm text-muted-foreground mt-1">{card.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Card data-testid="card-leads-summary">
                <CardHeader>
                  <CardTitle className="text-lg">Prospects</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Nouveaux</span>
                    <span className="font-semibold">{stats?.leads.new || 0}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Convertis</span>
                    <span className="font-semibold text-green-600">{stats?.leads.converted || 0}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Total</span>
                    <span className="font-semibold">{stats?.leads.total || 0}</span>
                  </div>
                </CardContent>
              </Card>

              <Card data-testid="card-clients-summary">
                <CardHeader>
                  <CardTitle className="text-lg">Clients par statut</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Periode d'essai</span>
                    <span className="font-semibold text-yellow-600">{stats?.tenants.trial || 0}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Actifs</span>
                    <span className="font-semibold text-green-600">{stats?.tenants.active || 0}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Annules</span>
                    <span className="font-semibold text-red-600">{stats?.tenants.cancelled || 0}</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>
    </SuperadminLayout>
  );
}
