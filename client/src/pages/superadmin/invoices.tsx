import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Receipt, Send, Check, CreditCard, Banknote, FileText, Eye, Download, Mail, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SuperadminLayout } from "./layout";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Invoice } from "@shared/schema";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  DRAFT: { label: "Brouillon", color: "bg-muted text-muted-foreground" },
  SENT: { label: "Envoyee", color: "bg-blue-500 text-white" },
  PAID: { label: "Payee", color: "bg-green-500 text-white" },
  OVERDUE: { label: "En retard", color: "bg-red-500 text-white" },
  CANCELLED: { label: "Annulee", color: "bg-muted text-muted-foreground" },
};

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  STRIPE: "Carte bancaire",
  BANK_TRANSFER: "Virement",
  CHECK: "Cheque",
  ADMINISTRATIVE_MANDATE: "Mandat administratif",
};

interface InvoiceLineItem {
  id?: string;
  productId: string | null;
  planId: string | null;
  billingInterval: "MONTHLY" | "YEARLY" | null;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

interface InvoiceWithLineItems extends Invoice {
  lineItems?: InvoiceLineItem[];
}

export default function SuperadminInvoices() {
  const { toast } = useToast();
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [viewingInvoice, setViewingInvoice] = useState<InvoiceWithLineItems | null>(null);
  const [sendingInvoiceId, setSendingInvoiceId] = useState<string | null>(null);
  const [paymentData, setPaymentData] = useState({
    method: "BANK_TRANSFER",
    reference: "",
    notes: "",
  });

  const { data: invoices, isLoading } = useQuery<Invoice[]>({
    queryKey: ["/api/superadmin/invoices"],
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const res = await apiRequest("PUT", `/api/superadmin/invoices/${id}`, { status });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/superadmin/invoices"] });
      toast({ title: "Statut mis a jour" });
    },
  });

  const recordPaymentMutation = useMutation({
    mutationFn: async (data: { invoiceId: string; amount: number; method: string; reference: string; notes: string }) => {
      const res = await apiRequest("POST", "/api/superadmin/payments", {
        ...data,
        status: "COMPLETED",
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/superadmin/invoices"] });
      queryClient.invalidateQueries({ queryKey: ["/api/superadmin/payments"] });
      setIsPaymentDialogOpen(false);
      setSelectedInvoice(null);
      toast({ title: "Paiement enregistre" });
    },
    onError: () => {
      toast({ title: "Erreur", description: "Impossible d'enregistrer le paiement", variant: "destructive" });
    },
  });

  const openPaymentDialog = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    setPaymentData({
      method: "BANK_TRANSFER",
      reference: "",
      notes: "",
    });
    setIsPaymentDialogOpen(true);
  };

  const handleRecordPayment = () => {
    if (!selectedInvoice) return;
    recordPaymentMutation.mutate({
      invoiceId: selectedInvoice.id,
      amount: selectedInvoice.total,
      method: paymentData.method,
      reference: paymentData.reference,
      notes: paymentData.notes,
    });
  };

  const loadInvoiceForView = async (invoiceId: string) => {
    try {
      const res = await fetch(`/api/superadmin/invoices/${invoiceId}`, { credentials: 'include' });
      const invoiceWithItems = await res.json();
      setViewingInvoice(invoiceWithItems);
      setIsViewDialogOpen(true);
    } catch (error) {
      toast({ title: "Erreur", description: "Impossible de charger la facture", variant: "destructive" });
    }
  };

  const sendInvoiceByEmail = async (invoiceId: string, recipientEmail: string) => {
    if (!recipientEmail) {
      toast({ title: "Erreur", description: "Aucun email client", variant: "destructive" });
      return;
    }
    setSendingInvoiceId(invoiceId);
    try {
      const res = await apiRequest("POST", `/api/superadmin/invoices/${invoiceId}/send`, { recipientEmail });
      const result = await res.json();
      if (result.success) {
        toast({ title: "Succes", description: result.message });
        queryClient.invalidateQueries({ queryKey: ["/api/superadmin/invoices"] });
      } else {
        toast({ title: "Erreur", description: result.error || "Erreur d'envoi", variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Erreur", description: "Impossible d'envoyer la facture", variant: "destructive" });
    } finally {
      setSendingInvoiceId(null);
    }
  };

  const formatPrice = (euros: number) => euros.toFixed(2);

  const downloadInvoicePdf = async (invoiceId: string, invoiceNumber: string) => {
    try {
      const res = await fetch(`/api/superadmin/invoices/${invoiceId}/pdf`, {
        credentials: 'include'
      });
      if (!res.ok) {
        throw new Error('Erreur de telechargement');
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${invoiceNumber}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      toast({ title: "Erreur", description: "Impossible de telecharger le PDF", variant: "destructive" });
    }
  };

  const stats = {
    total: invoices?.length || 0,
    draft: invoices?.filter(i => i.status === "DRAFT").length || 0,
    sent: invoices?.filter(i => i.status === "SENT").length || 0,
    paid: invoices?.filter(i => i.status === "PAID").length || 0,
    overdue: invoices?.filter(i => i.status === "OVERDUE").length || 0,
    totalRevenue: invoices?.filter(i => i.status === "PAID").reduce((sum, i) => sum + i.total, 0) || 0,
    pending: invoices?.filter(i => i.status === "SENT").reduce((sum, i) => sum + i.total, 0) || 0,
  };

  return (
    <SuperadminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-invoices-title">
              Factures
            </h1>
            <p className="text-muted-foreground">
              Gestion des factures et suivi des paiements
            </p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card data-testid="card-total-invoices">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-500/10 text-blue-500">
                  <FileText className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total factures</p>
                  <p className="text-2xl font-bold">{stats.total}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card data-testid="card-paid-invoices">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-green-500/10 text-green-500">
                  <Check className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Payees</p>
                  <p className="text-2xl font-bold">{stats.paid}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card data-testid="card-revenue">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-green-500/10 text-green-500">
                  <CreditCard className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Encaisse</p>
                  <p className="text-2xl font-bold">{formatPrice(stats.totalRevenue)} €</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card data-testid="card-pending">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-orange-500/10 text-orange-500">
                  <Banknote className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">En attente</p>
                  <p className="text-2xl font-bold">{formatPrice(stats.pending)} €</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Liste des factures</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-8 text-center text-muted-foreground">Chargement...</div>
            ) : !invoices?.length ? (
              <div className="p-8 text-center">
                <Receipt className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                <p className="text-muted-foreground">Aucune facture pour le moment.</p>
                <p className="text-sm text-muted-foreground mt-2">
                  Les factures sont creees a partir des devis acceptes.
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Numero</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Montant TTC</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Echeance</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoices.map((invoice) => {
                    const statusConfig = STATUS_LABELS[invoice.status];
                    const isOverdue = invoice.status === "SENT" && new Date(invoice.dueDate) < new Date();
                    
                    return (
                      <TableRow key={invoice.id} data-testid={`row-invoice-${invoice.id}`}>
                        <TableCell className="font-mono">{invoice.invoiceNumber}</TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">{invoice.clientName}</div>
                            <div className="text-sm text-muted-foreground">{invoice.clientEmail}</div>
                          </div>
                        </TableCell>
                        <TableCell className="font-medium">
                          {formatPrice(invoice.total)} €
                        </TableCell>
                        <TableCell>
                          <Badge className={isOverdue ? "bg-red-500 text-white" : statusConfig.color}>
                            {isOverdue ? "En retard" : statusConfig.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {format(new Date(invoice.dueDate), "dd MMM yyyy", { locale: fr })}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => loadInvoiceForView(invoice.id)}
                              data-testid={`button-view-invoice-${invoice.id}`}
                              title="Voir la facture"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => downloadInvoicePdf(invoice.id, invoice.invoiceNumber)}
                              data-testid={`button-download-invoice-${invoice.id}`}
                              title="Telecharger le PDF"
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => sendInvoiceByEmail(invoice.id, invoice.clientEmail || "")}
                              disabled={sendingInvoiceId === invoice.id}
                              data-testid={`button-email-invoice-${invoice.id}`}
                              title="Envoyer par email"
                            >
                              {sendingInvoiceId === invoice.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Mail className="h-4 w-4" />
                              )}
                            </Button>
                            {invoice.status === "DRAFT" && (
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => updateStatusMutation.mutate({ id: invoice.id, status: "SENT" })}
                                data-testid={`button-send-invoice-${invoice.id}`}
                                title="Marquer comme envoyee"
                              >
                                <Send className="h-4 w-4" />
                              </Button>
                            )}
                            {(invoice.status === "SENT" || isOverdue) && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => openPaymentDialog(invoice)}
                                data-testid={`button-record-payment-${invoice.id}`}
                              >
                                <Check className="h-4 w-4 mr-1" />
                                Paiement
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enregistrer un paiement</DialogTitle>
          </DialogHeader>
          {selectedInvoice && (
            <div className="space-y-4">
              <div className="p-4 bg-muted rounded-lg">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Facture</span>
                  <span className="font-mono">{selectedInvoice.invoiceNumber}</span>
                </div>
                <div className="flex justify-between items-center mt-2">
                  <span className="text-muted-foreground">Montant</span>
                  <span className="font-bold text-lg">{formatPrice(selectedInvoice.total)} €</span>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label>Mode de paiement</Label>
                <Select
                  value={paymentData.method}
                  onValueChange={(value) => setPaymentData({ ...paymentData, method: value })}
                >
                  <SelectTrigger data-testid="select-payment-method">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="BANK_TRANSFER">Virement bancaire</SelectItem>
                    <SelectItem value="CHECK">Cheque</SelectItem>
                    <SelectItem value="ADMINISTRATIVE_MANDATE">Mandat administratif</SelectItem>
                    <SelectItem value="STRIPE">Carte bancaire</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label>Reference (optionnel)</Label>
                <Input
                  value={paymentData.reference}
                  onChange={(e) => setPaymentData({ ...paymentData, reference: e.target.value })}
                  placeholder="Numero de mandat, reference virement..."
                  data-testid="input-payment-reference"
                />
              </div>
              
              <div className="space-y-2">
                <Label>Notes (optionnel)</Label>
                <Input
                  value={paymentData.notes}
                  onChange={(e) => setPaymentData({ ...paymentData, notes: e.target.value })}
                  data-testid="input-payment-notes"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPaymentDialogOpen(false)}>
              Annuler
            </Button>
            <Button
              onClick={handleRecordPayment}
              disabled={recordPaymentMutation.isPending}
              data-testid="button-confirm-payment"
            >
              {recordPaymentMutation.isPending ? "Enregistrement..." : "Confirmer le paiement"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-0">
          {viewingInvoice && (
            <div className="bg-background">
              <div className="bg-muted px-8 py-6 border-b">
                <div className="flex flex-col md:flex-row md:justify-between gap-6">
                  <div className="flex-shrink-0">
                    <div className="text-3xl font-bold tracking-tight text-primary">FACTURE</div>
                    <div className="text-lg font-mono mt-1" data-testid="text-invoice-number">{viewingInvoice.invoiceNumber}</div>
                    <div className="mt-2">
                      <Badge className={STATUS_LABELS[viewingInvoice.status]?.color} data-testid="badge-invoice-status">
                        {STATUS_LABELS[viewingInvoice.status]?.label}
                      </Badge>
                    </div>
                  </div>
                  <div className="md:text-right">
                    <h2 className="text-xl font-bold" data-testid="text-invoice-emitter-name">{viewingInvoice.emitterName}</h2>
                    {viewingInvoice.emitterAddress && (
                      <p className="text-sm text-muted-foreground mt-1">{viewingInvoice.emitterAddress.replace(/\n/g, ', ')}</p>
                    )}
                    {viewingInvoice.emitterSiret && (
                      <p className="text-xs text-muted-foreground mt-1">SIRET: {viewingInvoice.emitterSiret}</p>
                    )}
                    {viewingInvoice.emitterTva && (
                      <p className="text-xs text-muted-foreground">TVA: {viewingInvoice.emitterTva}</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="px-8 py-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Destinataire</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="font-semibold text-lg" data-testid="text-invoice-client-name">{viewingInvoice.clientName}</p>
                      <p className="text-sm text-muted-foreground">{viewingInvoice.clientEmail}</p>
                      {viewingInvoice.clientAddress && (
                        <p className="text-sm mt-2 whitespace-pre-line">{viewingInvoice.clientAddress}</p>
                      )}
                      {viewingInvoice.clientSiret && (
                        <p className="text-xs text-muted-foreground mt-2">SIRET: {viewingInvoice.clientSiret}</p>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Informations</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="flex justify-between gap-2 text-sm">
                        <span className="text-muted-foreground">Date d'emission:</span>
                        <span className="font-medium">{format(new Date(viewingInvoice.createdAt), "d MMMM yyyy", { locale: fr })}</span>
                      </div>
                      <div className="flex justify-between gap-2 text-sm">
                        <span className="text-muted-foreground">Date d'echeance:</span>
                        <span className="font-medium">{format(new Date(viewingInvoice.dueDate), "d MMMM yyyy", { locale: fr })}</span>
                      </div>
                      {viewingInvoice.paymentMethod && (
                        <div className="flex justify-between gap-2 text-sm">
                          <span className="text-muted-foreground">Mode de paiement:</span>
                          <span className="font-medium">{PAYMENT_METHOD_LABELS[viewingInvoice.paymentMethod] || viewingInvoice.paymentMethod}</span>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>

                <div className="w-full">
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted">
                          <TableHead className="font-semibold min-w-[200px]">Description</TableHead>
                          <TableHead className="text-center font-semibold w-16">Qte</TableHead>
                          <TableHead className="text-right font-semibold w-28">Prix HT</TableHead>
                          <TableHead className="text-right font-semibold w-28">Total HT</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {viewingInvoice.lineItems?.map((item, index) => (
                          <TableRow key={index} data-testid={`row-invoice-item-${index}`}>
                            <TableCell>
                              <span className="font-medium">{item.description}</span>
                              {item.billingInterval && (
                                <Badge variant="outline" className="ml-2 text-xs">
                                  {item.billingInterval === "MONTHLY" ? "Mensuel" : "Annuel"}
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-center">{item.quantity}</TableCell>
                            <TableCell className="text-right font-mono">{formatPrice(item.unitPrice)} €</TableCell>
                            <TableCell className="text-right font-mono font-medium">{formatPrice(item.total)} €</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>

                <div className="flex justify-end">
                  <Card className="w-72">
                    <CardContent className="p-4 space-y-2">
                      <div className="flex justify-between gap-2 text-sm">
                        <span className="text-muted-foreground">Sous-total HT</span>
                        <span className="font-mono">{formatPrice(viewingInvoice.subtotal)} €</span>
                      </div>
                      <div className="flex justify-between gap-2 text-sm">
                        <span className="text-muted-foreground">TVA ({viewingInvoice.taxRate}%)</span>
                        <span className="font-mono">{formatPrice(viewingInvoice.taxAmount)} €</span>
                      </div>
                      <div className="border-t pt-2 mt-2">
                        <div className="flex justify-between gap-2 items-center">
                          <span className="font-semibold text-lg">Total TTC</span>
                          <span className="font-mono font-bold text-xl" data-testid="text-invoice-total">{formatPrice(viewingInvoice.total)} €</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {viewingInvoice.notes && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Notes et conditions</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm whitespace-pre-line">{viewingInvoice.notes}</p>
                    </CardContent>
                  </Card>
                )}
              </div>

              <div className="border-t px-8 py-4 flex justify-between items-center bg-muted">
                <Button variant="outline" onClick={() => setIsViewDialogOpen(false)} data-testid="button-close-invoice-view">
                  Fermer
                </Button>
                <div className="flex gap-2">
                  {viewingInvoice.status !== "PAID" && viewingInvoice.status !== "CANCELLED" && (
                    <Button variant="outline" onClick={() => {
                      setIsViewDialogOpen(false);
                      openPaymentDialog(viewingInvoice);
                    }} data-testid="button-record-payment">
                      <Check className="h-4 w-4 mr-2" />
                      Enregistrer paiement
                    </Button>
                  )}
                  <Button onClick={() => downloadInvoicePdf(viewingInvoice.id, viewingInvoice.invoiceNumber)} data-testid="button-download-invoice-pdf">
                    <Download className="h-4 w-4 mr-2" />
                    Telecharger PDF
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </SuperadminLayout>
  );
}
