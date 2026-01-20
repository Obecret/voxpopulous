import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { 
  CreditCard, 
  Receipt, 
  DollarSign,
  ExternalLink,
  CheckCircle,
  Clock,
  XCircle,
  AlertCircle
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { SuperadminLayout } from "./layout";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface StripeSubscription {
  id: string;
  customer: string;
  status: string;
  current_period_start: number | null;
  current_period_end: number | null;
  cancel_at_period_end: boolean;
  canceled_at: number | null;
  metadata: Record<string, string> | null;
  updated_at: string;
  customer_email: string | null;
  customer_name: string | null;
  customer_metadata: Record<string, string> | null;
}

interface StripeInvoice {
  id: string;
  customer: string;
  status: string;
  amount_due: number;
  amount_paid: number;
  total: number;
  currency: string;
  period_start: number | null;
  period_end: number | null;
  hosted_invoice_url: string | null;
  metadata: Record<string, string> | null;
  updated_at: string;
  customer_email: string | null;
  customer_name: string | null;
  customer_metadata: Record<string, string> | null;
}

interface StripePayment {
  id: string;
  customer: string;
  status: string;
  amount: number;
  currency: string;
  payment_method: string | null;
  metadata: Record<string, string> | null;
  updated_at: string;
  customer_email: string | null;
  customer_name: string | null;
}

const SUBSCRIPTION_STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  active: { label: "Actif", color: "bg-green-500 text-white", icon: CheckCircle },
  past_due: { label: "En retard", color: "bg-red-500 text-white", icon: AlertCircle },
  canceled: { label: "Annule", color: "bg-muted text-muted-foreground", icon: XCircle },
  incomplete: { label: "Incomplet", color: "bg-yellow-500 text-white", icon: Clock },
  incomplete_expired: { label: "Expire", color: "bg-muted text-muted-foreground", icon: XCircle },
  trialing: { label: "Essai", color: "bg-blue-500 text-white", icon: Clock },
  unpaid: { label: "Impaye", color: "bg-red-500 text-white", icon: AlertCircle },
};

const INVOICE_STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  draft: { label: "Brouillon", color: "bg-muted text-muted-foreground", icon: Clock },
  open: { label: "Ouverte", color: "bg-blue-500 text-white", icon: Clock },
  paid: { label: "Payee", color: "bg-green-500 text-white", icon: CheckCircle },
  void: { label: "Annulee", color: "bg-muted text-muted-foreground", icon: XCircle },
  uncollectible: { label: "Irrecuperable", color: "bg-red-500 text-white", icon: XCircle },
};

const PAYMENT_STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  succeeded: { label: "Reussi", color: "bg-green-500 text-white", icon: CheckCircle },
  processing: { label: "En cours", color: "bg-blue-500 text-white", icon: Clock },
  requires_payment_method: { label: "Methode requise", color: "bg-yellow-500 text-white", icon: AlertCircle },
  requires_confirmation: { label: "Confirmation requise", color: "bg-yellow-500 text-white", icon: AlertCircle },
  requires_action: { label: "Action requise", color: "bg-yellow-500 text-white", icon: AlertCircle },
  canceled: { label: "Annule", color: "bg-muted text-muted-foreground", icon: XCircle },
  requires_capture: { label: "Capture requise", color: "bg-yellow-500 text-white", icon: Clock },
};

const formatCents = (cents: number, currency: string = "eur") => {
  return (cents / 100).toLocaleString("fr-FR", {
    style: "currency",
    currency: currency.toUpperCase(),
  });
};

const formatTimestamp = (timestamp: number | null) => {
  if (!timestamp) return "-";
  return format(new Date(timestamp * 1000), "dd MMM yyyy", { locale: fr });
};

export default function SuperadminStripeBilling() {
  const [activeTab, setActiveTab] = useState("subscriptions");

  const { data: subscriptions, isLoading: subsLoading } = useQuery<StripeSubscription[]>({
    queryKey: ["/api/superadmin/stripe/subscriptions"],
  });

  const { data: invoices, isLoading: invLoading } = useQuery<StripeInvoice[]>({
    queryKey: ["/api/superadmin/stripe/invoices"],
  });

  const { data: payments, isLoading: payLoading } = useQuery<StripePayment[]>({
    queryKey: ["/api/superadmin/stripe/payments"],
  });

  const activeSubscriptions = subscriptions?.filter(s => s.status === "active").length || 0;
  const totalPaid = invoices?.filter(i => i.status === "paid").reduce((sum, i) => sum + i.amount_paid, 0) || 0;
  const pendingPayments = payments?.filter(p => p.status === "processing" || p.status === "requires_action").length || 0;

  return (
    <SuperadminLayout>
      <div className="space-y-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Badge className="bg-blue-500 text-white" data-testid="badge-stripe-indicator">
              <CreditCard className="h-3 w-3 mr-1" />
              Stripe
            </Badge>
          </div>
          <h1 className="text-2xl font-bold" data-testid="text-stripe-billing-title">
            Suivi Stripe
          </h1>
          <p className="text-muted-foreground">
            Abonnements, factures et paiements par carte bancaire
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card data-testid="card-active-subscriptions">
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Abonnements actifs</CardTitle>
              <CreditCard className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{activeSubscriptions}</div>
            </CardContent>
          </Card>
          <Card data-testid="card-total-paid">
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total encaisse</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{formatCents(totalPaid)}</div>
            </CardContent>
          </Card>
          <Card data-testid="card-pending-payments">
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Paiements en attente</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{pendingPayments}</div>
            </CardContent>
          </Card>
        </div>

        <Card data-testid="card-stripe-tables">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <CardHeader>
              <TabsList>
                <TabsTrigger value="subscriptions" data-testid="tab-subscriptions">
                  <CreditCard className="h-4 w-4 mr-2" />
                  Abonnements ({subscriptions?.length || 0})
                </TabsTrigger>
                <TabsTrigger value="invoices" data-testid="tab-invoices">
                  <Receipt className="h-4 w-4 mr-2" />
                  Factures ({invoices?.length || 0})
                </TabsTrigger>
                <TabsTrigger value="payments" data-testid="tab-payments">
                  <DollarSign className="h-4 w-4 mr-2" />
                  Paiements ({payments?.length || 0})
                </TabsTrigger>
              </TabsList>
            </CardHeader>

            <CardContent className="p-0">
              <TabsContent value="subscriptions" className="m-0">
                {subsLoading ? (
                  <div className="p-8 text-center text-muted-foreground">Chargement...</div>
                ) : !subscriptions?.length ? (
                  <div className="p-8 text-center text-muted-foreground">Aucun abonnement Stripe</div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>ID</TableHead>
                        <TableHead>Client</TableHead>
                        <TableHead>Statut</TableHead>
                        <TableHead>Periode</TableHead>
                        <TableHead>Mise a jour</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {subscriptions.map((sub) => {
                        const statusConfig = SUBSCRIPTION_STATUS_CONFIG[sub.status] || { label: sub.status, color: "bg-muted text-muted-foreground", icon: Clock };
                        const StatusIcon = statusConfig.icon;
                        return (
                          <TableRow key={sub.id} data-testid={`row-subscription-${sub.id}`}>
                            <TableCell className="font-mono text-xs">{sub.id.slice(0, 20)}...</TableCell>
                            <TableCell>
                              <div>
                                <div className="font-medium">{sub.customer_name || "Client inconnu"}</div>
                                <div className="text-sm text-muted-foreground">{sub.customer_email}</div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge className={statusConfig.color}>
                                <StatusIcon className="h-3 w-3 mr-1" />
                                {statusConfig.label}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {formatTimestamp(sub.current_period_start)} - {formatTimestamp(sub.current_period_end)}
                            </TableCell>
                            <TableCell className="text-muted-foreground text-sm">
                              {sub.updated_at ? format(new Date(sub.updated_at), "dd/MM/yyyy HH:mm", { locale: fr }) : "-"}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </TabsContent>

              <TabsContent value="invoices" className="m-0">
                {invLoading ? (
                  <div className="p-8 text-center text-muted-foreground">Chargement...</div>
                ) : !invoices?.length ? (
                  <div className="p-8 text-center text-muted-foreground">Aucune facture Stripe</div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>ID</TableHead>
                        <TableHead>Client</TableHead>
                        <TableHead>Statut</TableHead>
                        <TableHead className="text-right">Montant</TableHead>
                        <TableHead className="text-right">Paye</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {invoices.map((inv) => {
                        const statusConfig = INVOICE_STATUS_CONFIG[inv.status] || { label: inv.status, color: "bg-muted text-muted-foreground", icon: Clock };
                        const StatusIcon = statusConfig.icon;
                        return (
                          <TableRow key={inv.id} data-testid={`row-invoice-${inv.id}`}>
                            <TableCell className="font-mono text-xs">{inv.id.slice(0, 20)}...</TableCell>
                            <TableCell>
                              <div>
                                <div className="font-medium">{inv.customer_name || "Client inconnu"}</div>
                                <div className="text-sm text-muted-foreground">{inv.customer_email}</div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge className={statusConfig.color}>
                                <StatusIcon className="h-3 w-3 mr-1" />
                                {statusConfig.label}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right font-medium">
                              {formatCents(inv.total, inv.currency)}
                            </TableCell>
                            <TableCell className="text-right text-green-600">
                              {formatCents(inv.amount_paid, inv.currency)}
                            </TableCell>
                            <TableCell>
                              {inv.hosted_invoice_url && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => window.open(inv.hosted_invoice_url!, "_blank")}
                                  data-testid={`button-view-invoice-${inv.id}`}
                                >
                                  <ExternalLink className="h-3 w-3 mr-1" />
                                  Voir
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </TabsContent>

              <TabsContent value="payments" className="m-0">
                {payLoading ? (
                  <div className="p-8 text-center text-muted-foreground">Chargement...</div>
                ) : !payments?.length ? (
                  <div className="p-8 text-center text-muted-foreground">Aucun paiement Stripe</div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>ID</TableHead>
                        <TableHead>Client</TableHead>
                        <TableHead>Statut</TableHead>
                        <TableHead className="text-right">Montant</TableHead>
                        <TableHead>Mise a jour</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {payments.map((pay) => {
                        const statusConfig = PAYMENT_STATUS_CONFIG[pay.status] || { label: pay.status, color: "bg-muted text-muted-foreground", icon: Clock };
                        const StatusIcon = statusConfig.icon;
                        return (
                          <TableRow key={pay.id} data-testid={`row-payment-${pay.id}`}>
                            <TableCell className="font-mono text-xs">{pay.id.slice(0, 20)}...</TableCell>
                            <TableCell>
                              <div>
                                <div className="font-medium">{pay.customer_name || "Client inconnu"}</div>
                                <div className="text-sm text-muted-foreground">{pay.customer_email}</div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge className={statusConfig.color}>
                                <StatusIcon className="h-3 w-3 mr-1" />
                                {statusConfig.label}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right font-medium">
                              {formatCents(pay.amount, pay.currency)}
                            </TableCell>
                            <TableCell className="text-muted-foreground text-sm">
                              {pay.updated_at ? format(new Date(pay.updated_at), "dd/MM/yyyy HH:mm", { locale: fr }) : "-"}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </TabsContent>
            </CardContent>
          </Tabs>
        </Card>
      </div>
    </SuperadminLayout>
  );
}
