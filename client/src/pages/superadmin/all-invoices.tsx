import { useQuery, useMutation } from "@tanstack/react-query";
import { Receipt, CreditCard, FileText, Download, Eye, Send } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
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

interface MandateInvoice {
  id: string;
  invoiceNumber: string;
  orderId: string;
  tenantId: string;
  tenantName?: string;
  status: string;
  totalAmount: number;
  dueDate: string;
  sentAt: string | null;
  paidAt: string | null;
  createdAt: string;
}

interface StripeInvoice {
  id: string;
  number: string | null;
  customer: string;
  customerEmail?: string;
  amount_due: number;
  amount_paid: number;
  currency: string;
  status: string | null;
  created: number;
  due_date: number | null;
  paid: boolean;
}

interface Invoice {
  id: string;
  invoiceNumber: string;
  tenantId: string | null;
  tenantName?: string;
  status: string;
  total: number;
  dueDate: string;
  paidAt: string | null;
  createdAt: string;
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
  return value.toFixed(2) + " EUR HT";
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

function getMandateInvoiceStatusBadge(status: string) {
  switch (status) {
    case "DRAFT":
      return <Badge variant="outline">Brouillon</Badge>;
    case "SENT":
      return <Badge className="bg-blue-500">Envoyee</Badge>;
    case "PAID":
      return <Badge className="bg-green-500">Payee</Badge>;
    case "OVERDUE":
      return <Badge variant="destructive">En retard</Badge>;
    case "CANCELLED":
      return <Badge variant="secondary">Annulee</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

function getStripeInvoiceStatusBadge(status: string | null, paid: boolean) {
  if (paid) return <Badge className="bg-green-500">Payee</Badge>;
  switch (status) {
    case "draft":
      return <Badge variant="outline">Brouillon</Badge>;
    case "open":
      return <Badge className="bg-blue-500">Ouverte</Badge>;
    case "paid":
      return <Badge className="bg-green-500">Payee</Badge>;
    case "void":
      return <Badge variant="secondary">Annulee</Badge>;
    case "uncollectible":
      return <Badge variant="destructive">Irrecuperable</Badge>;
    default:
      return <Badge variant="outline">{status || "N/A"}</Badge>;
  }
}

function getInvoiceStatusBadge(status: string) {
  switch (status) {
    case "DRAFT":
      return <Badge variant="outline">Brouillon</Badge>;
    case "SENT":
      return <Badge className="bg-blue-500">Envoyee</Badge>;
    case "PAID":
      return <Badge className="bg-green-500">Payee</Badge>;
    case "OVERDUE":
      return <Badge variant="destructive">En retard</Badge>;
    case "CANCELLED":
      return <Badge variant="secondary">Annulee</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

export default function SuperadminAllInvoices() {
  const { toast } = useToast();
  
  const { data: mandateInvoices, isLoading: mandateLoading } = useQuery<MandateInvoice[]>({
    queryKey: ["/api/superadmin/mandate-invoices"],
  });

  const { data: stripeInvoices, isLoading: stripeLoading } = useQuery<StripeInvoice[]>({
    queryKey: ["/api/superadmin/stripe/invoices"],
  });

  const { data: invoices, isLoading: invoicesLoading } = useQuery<Invoice[]>({
    queryKey: ["/api/superadmin/invoices"],
  });

  const sendInvoiceMutation = useMutation({
    mutationFn: async (invoiceId: string) => {
      return await apiRequest("PUT", `/api/superadmin/mandate-invoices/${invoiceId}/status`, { 
        status: "SENT" 
      });
    },
    onSuccess: () => {
      toast({ title: "Facture envoyee", description: "La facture a ete envoyee au client par email" });
      queryClient.invalidateQueries({ queryKey: ["/api/superadmin/mandate-invoices"] });
    },
    onError: (error: any) => {
      toast({ title: "Erreur", description: error.message || "Impossible d'envoyer la facture", variant: "destructive" });
    },
  });

  const paidMandateInvoices = mandateInvoices?.filter(i => i.status === "PAID") || [];
  const pendingMandateInvoices = mandateInvoices?.filter(i => i.status !== "PAID" && i.status !== "CANCELLED") || [];
  
  return (
    <SuperadminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-all-invoices-title">
              Factures
            </h1>
            <p className="text-muted-foreground">
              Toutes les factures (Mandats, Stripe, Manuelles)
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <FileText className="h-8 w-8 text-purple-500" />
                <div>
                  <p className="text-2xl font-bold">{mandateInvoices?.length || 0}</p>
                  <p className="text-sm text-muted-foreground">Factures Mandats</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <CreditCard className="h-8 w-8 text-blue-500" />
                <div>
                  <p className="text-2xl font-bold">{stripeInvoices?.length || 0}</p>
                  <p className="text-sm text-muted-foreground">Factures Stripe</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Receipt className="h-8 w-8 text-gray-500" />
                <div>
                  <p className="text-2xl font-bold">{invoices?.length || 0}</p>
                  <p className="text-sm text-muted-foreground">Factures manuelles</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Receipt className="h-8 w-8 text-green-500" />
                <div>
                  <p className="text-2xl font-bold">{paidMandateInvoices.length}</p>
                  <p className="text-sm text-muted-foreground">Mandats payes</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="mandate">
          <TabsList>
            <TabsTrigger value="mandate" className="gap-2">
              <Badge className="bg-purple-600 text-xs">Mandat</Badge>
              Factures ({mandateInvoices?.length || 0})
            </TabsTrigger>
            <TabsTrigger value="stripe" className="gap-2">
              <Badge className="bg-blue-500 text-xs">Stripe</Badge>
              Factures ({stripeInvoices?.length || 0})
            </TabsTrigger>
            <TabsTrigger value="manual" className="gap-2">
              Manuelles ({invoices?.length || 0})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="mandate" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-purple-500" />
                  Factures - Mandats Administratifs
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
                        <TableHead>Numero</TableHead>
                        <TableHead>Client</TableHead>
                        <TableHead>Montant</TableHead>
                        <TableHead>Statut</TableHead>
                        <TableHead>Echeance</TableHead>
                        <TableHead>Envoyee le</TableHead>
                        <TableHead>Payee le</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {mandateInvoices?.map((invoice) => (
                        <TableRow key={invoice.id} data-testid={`row-mandate-invoice-${invoice.id}`}>
                          <TableCell className="font-medium">{invoice.invoiceNumber}</TableCell>
                          <TableCell>{invoice.tenantName || invoice.tenantId}</TableCell>
                          <TableCell>{(invoice.totalAmount || 0).toFixed(2)} EUR HT</TableCell>
                          <TableCell>{getMandateInvoiceStatusBadge(invoice.status)}</TableCell>
                          <TableCell>{formatDate(invoice.dueDate)}</TableCell>
                          <TableCell>{formatDate(invoice.sentAt)}</TableCell>
                          <TableCell>{formatDate(invoice.paidAt)}</TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Link href={`/superadmin/mandate-invoices?view=${invoice.id}`}>
                                <Button size="icon" variant="ghost" data-testid={`button-view-invoice-${invoice.id}`}>
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </Link>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => downloadPdf(`/api/superadmin/mandate-invoices/${invoice.id}/pdf`, `${invoice.invoiceNumber}.pdf`)}
                                data-testid={`button-download-invoice-${invoice.id}`}
                              >
                                <Download className="h-4 w-4" />
                              </Button>
                              {invoice.status === "DRAFT" && (
                                <Button
                                  size="sm"
                                  variant="default"
                                  onClick={() => sendInvoiceMutation.mutate(invoice.id)}
                                  disabled={sendInvoiceMutation.isPending}
                                  data-testid={`button-send-invoice-${invoice.id}`}
                                >
                                  <Send className="h-4 w-4 mr-1" />
                                  Envoyer
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                      {(!mandateInvoices || mandateInvoices.length === 0) && (
                        <TableRow>
                          <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                            Aucune facture mandat
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
                  Factures Stripe
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
                        <TableHead>Numero</TableHead>
                        <TableHead>Client</TableHead>
                        <TableHead>Montant du</TableHead>
                        <TableHead>Montant paye</TableHead>
                        <TableHead>Statut</TableHead>
                        <TableHead>Echeance</TableHead>
                        <TableHead>Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {stripeInvoices?.map((invoice) => (
                        <TableRow key={invoice.id} data-testid={`row-stripe-invoice-${invoice.id}`}>
                          <TableCell className="font-medium">{invoice.number || invoice.id.substring(0, 15)}</TableCell>
                          <TableCell>{invoice.customerEmail || invoice.customer}</TableCell>
                          <TableCell>{formatAmount(invoice.amount_due, true)}</TableCell>
                          <TableCell>{formatAmount(invoice.amount_paid, true)}</TableCell>
                          <TableCell>{getStripeInvoiceStatusBadge(invoice.status, invoice.paid)}</TableCell>
                          <TableCell>{formatDate(invoice.due_date)}</TableCell>
                          <TableCell>{formatDate(invoice.created)}</TableCell>
                        </TableRow>
                      ))}
                      {(!stripeInvoices || stripeInvoices.length === 0) && (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                            Aucune facture Stripe
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="manual" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Receipt className="h-5 w-5" />
                  Factures manuelles
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {invoicesLoading ? (
                  <div className="p-8 text-center text-muted-foreground">Chargement...</div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Numero</TableHead>
                        <TableHead>Client</TableHead>
                        <TableHead>Montant</TableHead>
                        <TableHead>Statut</TableHead>
                        <TableHead>Echeance</TableHead>
                        <TableHead>Payee le</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {invoices?.map((invoice) => (
                        <TableRow key={invoice.id} data-testid={`row-invoice-${invoice.id}`}>
                          <TableCell className="font-medium">{invoice.invoiceNumber}</TableCell>
                          <TableCell>{invoice.tenantName || invoice.tenantId || "-"}</TableCell>
                          <TableCell>{formatAmount(invoice.total)}</TableCell>
                          <TableCell>{getInvoiceStatusBadge(invoice.status)}</TableCell>
                          <TableCell>{formatDate(invoice.dueDate)}</TableCell>
                          <TableCell>{formatDate(invoice.paidAt)}</TableCell>
                          <TableCell>
                            <Link href={`/superadmin/invoices?view=${invoice.id}`}>
                              <Button size="icon" variant="ghost" data-testid={`button-view-manual-invoice-${invoice.id}`}>
                                <Eye className="h-4 w-4" />
                              </Button>
                            </Link>
                          </TableCell>
                        </TableRow>
                      ))}
                      {(!invoices || invoices.length === 0) && (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                            Aucune facture manuelle
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
