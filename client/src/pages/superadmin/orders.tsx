import { useQuery } from "@tanstack/react-query";
import { ClipboardList, CreditCard, FileText, Download, Eye } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SuperadminLayout } from "./layout";
import { Link } from "wouter";

interface MandateOrder {
  id: string;
  orderNumber: string;
  tenantId: string;
  tenantName?: string;
  planId: string;
  planName?: string;
  status: string;
  finalAmount: number;
  clientSiret: string;
  clientName: string;
  createdAt: string;
}

interface StripePayment {
  id: string;
  amount: number;
  currency: string;
  status: string;
  created: number;
  customer: string;
  customerEmail?: string;
  description?: string;
}

function formatDate(date: string | number | null | undefined): string {
  if (!date) return "-";
  if (typeof date === "number") {
    return new Date(date * 1000).toLocaleDateString("fr-FR");
  }
  return new Date(date).toLocaleDateString("fr-FR");
}

function formatAmount(amount: number, isStripe: boolean = false): string {
  // Stripe amounts are in cents, mandate amounts are in euros
  const value = isStripe ? amount / 100 : amount;
  return value.toFixed(2) + " EUR";
}

async function downloadPdf(url: string, filename: string) {
  try {
    const response = await fetch(url, { credentials: "include" });
    if (!response.ok) {
      throw new Error("Erreur de telechargement");
    }
    const blob = await response.blob();
    const blobUrl = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = blobUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(blobUrl);
  } catch (error) {
    console.error("PDF download error:", error);
    alert("Erreur lors du telechargement du PDF");
  }
}

function getMandateStatusBadge(status: string) {
  switch (status) {
    case "PENDING_VALIDATION":
      return <Badge variant="outline">Validation en attente</Badge>;
    case "PENDING_BC":
      return <Badge className="bg-yellow-500">En attente BC</Badge>;
    case "ACCEPTED":
      return <Badge className="bg-green-500">Accepte</Badge>;
    case "INVOICED":
      return <Badge className="bg-blue-500">Facture</Badge>;
    case "REJECTED":
      return <Badge variant="destructive">Rejete</Badge>;
    case "CANCELLED":
      return <Badge variant="secondary">Annule</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

function getStripeStatusBadge(status: string) {
  switch (status) {
    case "succeeded":
      return <Badge className="bg-green-500">Paye</Badge>;
    case "pending":
    case "processing":
      return <Badge className="bg-yellow-500">En cours</Badge>;
    case "requires_payment_method":
    case "requires_confirmation":
    case "requires_action":
      return <Badge className="bg-orange-500">Action requise</Badge>;
    case "canceled":
      return <Badge variant="secondary">Annule</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

export default function SuperadminOrders() {
  const { data: mandateOrders, isLoading: mandateLoading } = useQuery<MandateOrder[]>({
    queryKey: ["/api/superadmin/mandate-orders"],
  });

  const { data: stripePayments, isLoading: stripeLoading } = useQuery<StripePayment[]>({
    queryKey: ["/api/superadmin/stripe/payments"],
  });

  const pendingMandates = mandateOrders?.filter(o => o.status === "PENDING_VALIDATION" || o.status === "PENDING_BC") || [];
  const acceptedMandates = mandateOrders?.filter(o => o.status === "ACCEPTED" || o.status === "INVOICED") || [];
  
  return (
    <SuperadminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-orders-title">
              Commandes
            </h1>
            <p className="text-muted-foreground">
              Commandes mandats administratifs et paiements Stripe
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <FileText className="h-8 w-8 text-purple-500" />
                <div>
                  <p className="text-2xl font-bold">{mandateOrders?.length || 0}</p>
                  <p className="text-sm text-muted-foreground">Commandes Mandats</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <ClipboardList className="h-8 w-8 text-yellow-500" />
                <div>
                  <p className="text-2xl font-bold">{pendingMandates.length}</p>
                  <p className="text-sm text-muted-foreground">En attente</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <CreditCard className="h-8 w-8 text-blue-500" />
                <div>
                  <p className="text-2xl font-bold">{stripePayments?.length || 0}</p>
                  <p className="text-sm text-muted-foreground">Paiements Stripe</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <CreditCard className="h-8 w-8 text-green-500" />
                <div>
                  <p className="text-2xl font-bold">
                    {stripePayments?.filter(p => p.status === "succeeded").length || 0}
                  </p>
                  <p className="text-sm text-muted-foreground">Stripe payes</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="mandate">
          <TabsList>
            <TabsTrigger value="mandate" className="gap-2">
              <Badge className="bg-purple-600 text-xs">Mandat</Badge>
              Commandes ({mandateOrders?.length || 0})
            </TabsTrigger>
            <TabsTrigger value="stripe" className="gap-2">
              <Badge className="bg-blue-500 text-xs">Stripe</Badge>
              Paiements ({stripePayments?.length || 0})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="mandate" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-purple-500" />
                  Commandes - Mandats Administratifs
                  <Badge className="bg-purple-600 ml-2">Mandat Administratif</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {mandateLoading ? (
                  <div className="p-8 text-center text-muted-foreground">Chargement...</div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>N Devis</TableHead>
                        <TableHead>Organisation</TableHead>
                        <TableHead>SIRET</TableHead>
                        <TableHead>Forfait</TableHead>
                        <TableHead>Montant</TableHead>
                        <TableHead>Statut</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {mandateOrders?.map((order) => (
                        <TableRow key={order.id} data-testid={`row-mandate-order-${order.id}`}>
                          <TableCell className="font-medium">{order.orderNumber}</TableCell>
                          <TableCell>{order.clientName}</TableCell>
                          <TableCell className="font-mono text-sm">{order.clientSiret}</TableCell>
                          <TableCell>{order.planName || order.planId}</TableCell>
                          <TableCell>{(order.finalAmount || 0).toFixed(2)} EUR</TableCell>
                          <TableCell>{getMandateStatusBadge(order.status)}</TableCell>
                          <TableCell>{formatDate(order.createdAt)}</TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Link href={`/superadmin/mandate-orders?view=${order.id}`}>
                                <Button size="icon" variant="ghost" data-testid={`button-view-order-${order.id}`}>
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </Link>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => downloadPdf(`/api/superadmin/mandate-orders/${order.id}/pdf`, `${order.orderNumber}.pdf`)}
                                data-testid={`button-download-order-${order.id}`}
                              >
                                <Download className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                      {(!mandateOrders || mandateOrders.length === 0) && (
                        <TableRow>
                          <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                            Aucune commande mandat
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="stripe" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5 text-blue-500" />
                  Paiements Stripe
                  <Badge className="bg-blue-500 ml-2">Stripe</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {stripeLoading ? (
                  <div className="p-8 text-center text-muted-foreground">Chargement...</div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>ID</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Client</TableHead>
                        <TableHead>Montant</TableHead>
                        <TableHead>Statut</TableHead>
                        <TableHead>Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {stripePayments?.map((payment) => (
                        <TableRow key={payment.id} data-testid={`row-stripe-payment-${payment.id}`}>
                          <TableCell className="font-mono text-sm">{payment.id.substring(0, 20)}...</TableCell>
                          <TableCell>{payment.description || "-"}</TableCell>
                          <TableCell>{payment.customerEmail || payment.customer}</TableCell>
                          <TableCell>{formatAmount(payment.amount, true)}</TableCell>
                          <TableCell>{getStripeStatusBadge(payment.status)}</TableCell>
                          <TableCell>{formatDate(payment.created)}</TableCell>
                        </TableRow>
                      ))}
                      {(!stripePayments || stripePayments.length === 0) && (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                            Aucun paiement Stripe
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </SuperadminLayout>
  );
}
