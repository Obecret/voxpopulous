import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { TrendingUp, Package, Puzzle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SuperadminLayout } from "./layout";
import type { Tenant, SubscriptionPlan } from "@shared/schema";

type BillingPeriod = "monthly" | "yearly";

interface AddonTierStat {
  addonId: string;
  addonName: string;
  addonCode: string;
  tierId: string;
  tierName: string;
  minQuantity: number;
  maxQuantity: number | null;
  monthlyPrice: number;
  yearlyPrice: number;
  count: number;
}

export default function SuperadminSubscriptions() {
  const [period, setPeriod] = useState<BillingPeriod>("monthly");

  const { data: tenantsData, isLoading: tenantsLoading } = useQuery<{ tenants: Tenant[] }>({
    queryKey: ["/api/superadmin/tenants"],
  });
  const tenants = tenantsData?.tenants;

  const { data: plans, isLoading: plansLoading } = useQuery<SubscriptionPlan[]>({
    queryKey: ["/api/superadmin/plans"],
  });

  const { data: addonStats, isLoading: addonsLoading } = useQuery<AddonTierStat[]>({
    queryKey: ["/api/superadmin/addon-tier-stats"],
  });

  const isLoading = tenantsLoading || plansLoading || addonsLoading;

  const activeSubscribers = tenants?.filter(t => t.billingStatus === "ACTIVE") || [];

  const getSubscribersByPlan = (planId: string) => {
    return activeSubscribers.filter(t => t.subscriptionPlanId === planId).length;
  };

  const getPlanRevenue = (plan: SubscriptionPlan, count: number) => {
    const price = period === "monthly" ? plan.monthlyPrice : plan.yearlyPrice;
    return price * count; // All prices in euros
  };

  const formatPrice = (euros: number) => {
    return euros.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const formatEuros = (euros: number) => {
    return euros.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const totalPlansRevenue = plans?.filter(p => p.isActive).reduce((sum, plan) => {
    const count = getSubscribersByPlan(plan.id);
    return sum + getPlanRevenue(plan, count);
  }, 0) || 0;

  const groupedAddons = addonStats?.reduce((acc, stat) => {
    if (!acc[stat.addonId]) {
      acc[stat.addonId] = {
        addonId: stat.addonId,
        addonName: stat.addonName,
        addonCode: stat.addonCode,
        tiers: [],
      };
    }
    acc[stat.addonId].tiers.push(stat);
    return acc;
  }, {} as Record<string, { addonId: string; addonName: string; addonCode: string; tiers: AddonTierStat[] }>) || {};

  const getAddonTierPrice = (stat: AddonTierStat) => {
    return period === "monthly" ? stat.monthlyPrice : stat.yearlyPrice;
  };

  const getAddonTierRevenue = (stat: AddonTierStat) => {
    const price = getAddonTierPrice(stat);
    return price * stat.count;
  };

  const totalAddonsRevenue = addonStats?.reduce((sum, stat) => {
    return sum + getAddonTierRevenue(stat);
  }, 0) || 0;

  const grandTotal = totalPlansRevenue + totalAddonsRevenue;

  return (
    <SuperadminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-subscriptions-title">
              Abonnements
            </h1>
            <p className="text-muted-foreground">
              Synthese des revenus par forfait et options
            </p>
          </div>
          <Select value={period} onValueChange={(v) => setPeriod(v as BillingPeriod)}>
            <SelectTrigger className="w-40" data-testid="select-period">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="monthly">Mensuel</SelectItem>
              <SelectItem value="yearly">Annuel</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground">
            Chargement...
          </div>
        ) : (
          <>
            <Card data-testid="card-plans-table">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Package className="h-5 w-5 text-muted-foreground" />
                  <CardTitle>Forfaits</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Forfait</TableHead>
                      <TableHead className="text-right">
                        Prix {period === "monthly" ? "mensuel" : "annuel"}
                      </TableHead>
                      <TableHead className="text-right">Quantite vendue</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {plans?.filter(p => p.isActive).map((plan) => {
                      const count = getSubscribersByPlan(plan.id);
                      const revenue = getPlanRevenue(plan, count);
                      const price = period === "monthly" ? plan.monthlyPrice : plan.yearlyPrice;

                      return (
                        <TableRow key={plan.id} data-testid={`row-plan-${plan.code.toLowerCase()}`}>
                          <TableCell className="font-medium">{plan.name}</TableCell>
                          <TableCell className="text-right">{formatPrice(price)} €</TableCell>
                          <TableCell className="text-right">{count}</TableCell>
                          <TableCell className="text-right font-medium">
                            {formatEuros(revenue)} €
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    <TableRow className="bg-muted/50 font-semibold">
                      <TableCell colSpan={3}>Total Forfaits</TableCell>
                      <TableCell className="text-right text-green-600">
                        {formatEuros(totalPlansRevenue)} €
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card data-testid="card-addons-table">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Puzzle className="h-5 w-5 text-muted-foreground" />
                  <CardTitle>Options</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {Object.keys(groupedAddons).length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground">
                    Aucune option configuree
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Option</TableHead>
                        <TableHead>Palier</TableHead>
                        <TableHead className="text-right">
                          Prix {period === "monthly" ? "mensuel" : "annuel"}
                        </TableHead>
                        <TableHead className="text-right">Quantite vendue</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {Object.values(groupedAddons).map((addon) => {
                        const addonTotal = addon.tiers.reduce((sum, tier) => sum + getAddonTierRevenue(tier), 0);
                        
                        return addon.tiers.map((tier, idx) => (
                          <TableRow key={tier.tierId} data-testid={`row-addon-tier-${tier.tierId}`}>
                            {idx === 0 && (
                              <TableCell rowSpan={addon.tiers.length} className="font-medium align-top">
                                {addon.addonName}
                              </TableCell>
                            )}
                            <TableCell>
                              {tier.tierName}
                              <span className="text-muted-foreground text-sm ml-2">
                                ({tier.minQuantity}{tier.maxQuantity ? `-${tier.maxQuantity}` : "+"})
                              </span>
                            </TableCell>
                            <TableCell className="text-right">
                              {formatEuros(getAddonTierPrice(tier))} €
                            </TableCell>
                            <TableCell className="text-right">{tier.count}</TableCell>
                            <TableCell className="text-right">
                              {formatEuros(getAddonTierRevenue(tier))} €
                            </TableCell>
                          </TableRow>
                        ));
                      })}
                      <TableRow className="bg-muted/50 font-semibold">
                        <TableCell colSpan={4}>Total Options</TableCell>
                        <TableCell className="text-right text-green-600">
                          {formatEuros(totalAddonsRevenue)} €
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            <Card data-testid="card-grand-total">
              <CardContent className="p-6">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-green-500/10 text-green-500">
                      <TrendingUp className="h-6 w-6" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">
                        Total {period === "monthly" ? "mensuel" : "annuel"}
                      </p>
                      <p className="text-2xl font-bold text-green-600">
                        {formatEuros(grandTotal)} €
                      </p>
                    </div>
                  </div>
                  <div className="text-right text-sm text-muted-foreground">
                    <p>{activeSubscribers.length} client{activeSubscribers.length !== 1 ? "s" : ""} actif{activeSubscribers.length !== 1 ? "s" : ""}</p>
                    <p>Forfaits: {formatEuros(totalPlansRevenue)} € + Options: {formatEuros(totalAddonsRevenue)} €</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </SuperadminLayout>
  );
}
