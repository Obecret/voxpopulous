import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { 
  Calculator,
  Euro,
  CheckCircle,
  Clock,
  AlertCircle,
  FileText,
  TrendingUp,
  TrendingDown,
  Download
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
import { SuperadminLayout } from "./layout";
import { format, differenceInDays } from "date-fns";
import { fr } from "date-fns/locale";

interface MandateInvoice {
  id: string;
  invoiceNumber: string;
  orderId: string;
  subscriptionId: string;
  tenantId: string;
  status: string;
  planAmount: number | null;
  addonsAmount: number | null;
  subtotal: number;
  discountAmount: number;
  totalAmount: number;
  periodStart: string;
  periodEnd: string;
  clientName: string;
  clientSiret: string;
  purchaseOrderNumber: string | null;
  dueDate: string;
  sentAt: string | null;
  paidAt: string | null;
  paymentReference: string | null;
  createdAt: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  DRAFT: { label: "Brouillon", color: "bg-muted text-muted-foreground", icon: Clock },
  SENT: { label: "Envoyee", color: "bg-blue-500 text-white", icon: FileText },
  MANDATED: { label: "Mandat emis", color: "bg-purple-500 text-white", icon: FileText },
  PAID: { label: "Payee", color: "bg-green-500 text-white", icon: CheckCircle },
  OVERDUE: { label: "En retard", color: "bg-red-500 text-white", icon: AlertCircle },
  CANCELLED: { label: "Annulee", color: "bg-muted text-muted-foreground", icon: Clock },
};

function formatPrice(price: number): string {
  return price.toFixed(2);
}

export default function SuperadminAccounting() {
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const { data: invoices, isLoading } = useQuery<MandateInvoice[]>({
    queryKey: ["/api/superadmin/mandate-invoices"],
  });

  const getDisplayStatus = (invoice: MandateInvoice): string => {
    if (["SENT", "MANDATED"].includes(invoice.status)) {
      const dueDate = new Date(invoice.dueDate);
      if (new Date() > dueDate) {
        return "OVERDUE";
      }
    }
    return invoice.status;
  };

  const getBalance = (invoice: MandateInvoice): number => {
    if (invoice.status === "PAID") {
      return 0;
    }
    return invoice.totalAmount;
  };

  const getPaidAmount = (invoice: MandateInvoice): number => {
    if (invoice.status === "PAID") {
      return invoice.totalAmount;
    }
    return 0;
  };

  const filteredInvoices = invoices?.filter(inv => {
    if (statusFilter === "all") return true;
    if (statusFilter === "pending") return ["SENT", "MANDATED"].includes(inv.status);
    if (statusFilter === "overdue") return getDisplayStatus(inv) === "OVERDUE";
    if (statusFilter === "paid") return inv.status === "PAID";
    return true;
  }) || [];

  const totalDue = invoices?.filter(inv => ["SENT", "MANDATED"].includes(inv.status))
    .reduce((sum, inv) => sum + inv.totalAmount, 0) || 0;
  
  const totalPaid = invoices?.filter(inv => inv.status === "PAID")
    .reduce((sum, inv) => sum + inv.totalAmount, 0) || 0;
  
  const totalOverdue = invoices?.filter(inv => {
    if (!["SENT", "MANDATED"].includes(inv.status)) return false;
    return new Date() > new Date(inv.dueDate);
  }).reduce((sum, inv) => sum + inv.totalAmount, 0) || 0;

  const overdueCount = invoices?.filter(inv => {
    if (!["SENT", "MANDATED"].includes(inv.status)) return false;
    return new Date() > new Date(inv.dueDate);
  }).length || 0;

  return (
    <SuperadminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <Calculator className="h-8 w-8 text-primary" />
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Badge className="bg-purple-600 text-white" data-testid="badge-mandate-indicator">
                  Mandat Administratif
                </Badge>
              </div>
              <h1 className="text-2xl font-bold" data-testid="text-accounting-title">Comptabilite</h1>
              <p className="text-muted-foreground">Suivi des paiements par facture mandat</p>
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card data-testid="card-total-due">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-amber-500/10">
                  <Clock className="h-5 w-5 text-amber-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">En attente de paiement</p>
                  <p className="text-2xl font-bold">{formatPrice(totalDue)} EUR HT</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card data-testid="card-total-overdue">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-red-500/10">
                  <AlertCircle className="h-5 w-5 text-red-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">En retard ({overdueCount})</p>
                  <p className="text-2xl font-bold text-red-600">{formatPrice(totalOverdue)} EUR HT</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card data-testid="card-total-paid">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-500/10">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Paye</p>
                  <p className="text-2xl font-bold text-green-600">{formatPrice(totalPaid)} EUR HT</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card data-testid="card-total-all">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Euro className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total facture</p>
                  <p className="text-2xl font-bold">{formatPrice(totalDue + totalPaid)} EUR HT</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Suivi des paiements par facture</CardTitle>
            <CardDescription>
              Montant, paiement recu et solde restant pour chaque facture
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={statusFilter} onValueChange={setStatusFilter} className="mb-4">
              <TabsList>
                <TabsTrigger value="all" data-testid="tab-filter-all">
                  Toutes ({invoices?.length || 0})
                </TabsTrigger>
                <TabsTrigger value="pending" data-testid="tab-filter-pending">
                  En attente ({invoices?.filter(i => ["SENT", "MANDATED"].includes(i.status)).length || 0})
                </TabsTrigger>
                <TabsTrigger value="overdue" data-testid="tab-filter-overdue">
                  En retard ({overdueCount})
                </TabsTrigger>
                <TabsTrigger value="paid" data-testid="tab-filter-paid">
                  Payees ({invoices?.filter(i => i.status === "PAID").length || 0})
                </TabsTrigger>
              </TabsList>
            </Tabs>

            {isLoading ? (
              <div className="flex justify-center p-8">
                <Clock className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : filteredInvoices.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">Aucune facture</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>N Facture</TableHead>
                      <TableHead>Client</TableHead>
                      <TableHead>Date creation</TableHead>
                      <TableHead>Echeance</TableHead>
                      <TableHead className="text-right">Montant</TableHead>
                      <TableHead className="text-right">Paye</TableHead>
                      <TableHead className="text-right">Solde</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead>Reference paiement</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredInvoices.map((invoice) => {
                      const displayStatus = getDisplayStatus(invoice);
                      const balance = getBalance(invoice);
                      const paidAmount = getPaidAmount(invoice);
                      const daysUntilDue = differenceInDays(new Date(invoice.dueDate), new Date());
                      
                      return (
                        <TableRow key={invoice.id} data-testid={`accounting-row-${invoice.id}`}>
                          <TableCell className="font-medium">
                            {invoice.invoiceNumber}
                          </TableCell>
                          <TableCell>
                            <div>
                              <div className="font-medium">{invoice.clientName}</div>
                              <div className="text-xs text-muted-foreground">{invoice.clientSiret}</div>
                            </div>
                          </TableCell>
                          <TableCell>
                            {format(new Date(invoice.createdAt), "dd/MM/yyyy", { locale: fr })}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <span>{format(new Date(invoice.dueDate), "dd/MM/yyyy", { locale: fr })}</span>
                              {displayStatus === "OVERDUE" && (
                                <Badge variant="destructive" className="text-xs">
                                  +{Math.abs(daysUntilDue)}j
                                </Badge>
                              )}
                              {displayStatus !== "PAID" && displayStatus !== "OVERDUE" && daysUntilDue <= 7 && daysUntilDue >= 0 && (
                                <Badge variant="secondary" className="text-xs bg-amber-100 text-amber-800">
                                  {daysUntilDue}j
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {formatPrice(invoice.totalAmount)} EUR HT
                          </TableCell>
                          <TableCell className="text-right">
                            <span className={paidAmount > 0 ? "text-green-600 font-medium" : "text-muted-foreground"}>
                              {formatPrice(paidAmount)} EUR HT
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            <span className={balance > 0 ? "text-amber-600 font-medium" : "text-green-600 font-medium"}>
                              {formatPrice(balance)} EUR HT
                            </span>
                          </TableCell>
                          <TableCell>
                            <Badge className={STATUS_CONFIG[displayStatus]?.color}>
                              {STATUS_CONFIG[displayStatus]?.label || displayStatus}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {invoice.paymentReference ? (
                              <span className="text-sm">{invoice.paymentReference}</span>
                            ) : invoice.status === "PAID" ? (
                              <span className="text-sm text-muted-foreground">-</span>
                            ) : (
                              <span className="text-sm text-muted-foreground">En attente</span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}

            {filteredInvoices.length > 0 && (
              <div className="mt-4 pt-4 border-t flex justify-between items-center flex-wrap gap-4">
                <div className="flex gap-6">
                  <div>
                    <span className="text-sm text-muted-foreground">Total montant:</span>
                    <span className="ml-2 font-bold">
                      {formatPrice(filteredInvoices.reduce((sum, inv) => sum + inv.totalAmount, 0))} EUR HT
                    </span>
                  </div>
                  <div>
                    <span className="text-sm text-muted-foreground">Total paye:</span>
                    <span className="ml-2 font-bold text-green-600">
                      {formatPrice(filteredInvoices.reduce((sum, inv) => sum + getPaidAmount(inv), 0))} EUR HT
                    </span>
                  </div>
                  <div>
                    <span className="text-sm text-muted-foreground">Total solde:</span>
                    <span className="ml-2 font-bold text-amber-600">
                      {formatPrice(filteredInvoices.reduce((sum, inv) => sum + getBalance(inv), 0))} EUR HT
                    </span>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </SuperadminLayout>
  );
}
