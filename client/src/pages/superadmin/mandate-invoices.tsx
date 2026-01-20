import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { 
  FileCheck, 
  Send, 
  CreditCard, 
  Eye, 
  Download,
  Clock,
  CheckCircle,
  AlertCircle,
  Loader2,
  Mail,
  Trash2
} from "lucide-react";
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
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SuperadminLayout } from "./layout";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format, differenceInDays } from "date-fns";
import { fr } from "date-fns/locale";

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

interface AddonSnapshot {
  id: string;
  code: string;
  name: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

interface MandateInvoice {
  id: string;
  invoiceNumber: string;
  orderId: string;
  subscriptionId: string;
  tenantId: string;
  status: string;
  planAmount: number | null;
  addonsAmount: number | null;
  addonsSnapshot: string | null;
  subtotal: number;
  discountAmount: number;
  totalAmount: number;
  periodStart: string;
  periodEnd: string;
  clientName: string;
  clientSiret: string;
  clientAddress: string | null;
  billingService: string | null;
  purchaseOrderNumber: string | null;
  dueDate: string;
  sentAt: string | null;
  mandatedAt: string | null;
  paidAt: string | null;
  paymentReference: string | null;
  createdAt: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  DRAFT: { label: "Brouillon", color: "bg-muted text-muted-foreground", icon: Clock },
  SENT: { label: "Envoyee", color: "bg-blue-500 text-white", icon: Send },
  MANDATED: { label: "Mandat emis", color: "bg-purple-500 text-white", icon: FileCheck },
  PAID: { label: "Payee", color: "bg-green-500 text-white", icon: CheckCircle },
  OVERDUE: { label: "En retard", color: "bg-red-500 text-white", icon: AlertCircle },
  CANCELLED: { label: "Annulee", color: "bg-muted text-muted-foreground", icon: Clock },
};

export default function SuperadminMandateInvoices() {
  const { toast } = useToast();
  const [selectedInvoice, setSelectedInvoice] = useState<MandateInvoice | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [paymentReference, setPaymentReference] = useState("");
  const [deleteInvoiceId, setDeleteInvoiceId] = useState<string | null>(null);

  const { data: invoices, isLoading } = useQuery<MandateInvoice[]>({
    queryKey: ["/api/superadmin/mandate-invoices"],
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status, paymentReference }: { id: string; status: string; paymentReference?: string }) => {
      const res = await apiRequest("PUT", `/api/superadmin/mandate-invoices/${id}/status`, { 
        status,
        paymentReference 
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/superadmin/mandate-invoices"] });
      setIsPaymentOpen(false);
      setSelectedInvoice(null);
      setPaymentReference("");
      toast({ title: "Statut mis a jour" });
    },
    onError: (error: any) => {
      toast({ 
        title: "Erreur", 
        description: error.message || "Impossible de mettre a jour le statut", 
        variant: "destructive" 
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/superadmin/mandate-invoices/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/superadmin/mandate-invoices"] });
      setDeleteInvoiceId(null);
      toast({ title: "Facture supprimee avec succes" });
    },
    onError: (error: any) => {
      toast({ 
        title: "Erreur", 
        description: error.message || "Impossible de supprimer la facture", 
        variant: "destructive" 
      });
    },
  });

  const openDetails = (invoice: MandateInvoice) => {
    setSelectedInvoice(invoice);
    setIsDetailsOpen(true);
  };

  const openPayment = (invoice: MandateInvoice) => {
    setSelectedInvoice(invoice);
    setPaymentReference("");
    setIsPaymentOpen(true);
  };

  const getInvoiceStatus = (invoice: MandateInvoice): string => {
    if (invoice.status === "SENT" || invoice.status === "MANDATED") {
      const dueDate = new Date(invoice.dueDate);
      const today = new Date();
      if (today > dueDate) {
        return "OVERDUE";
      }
    }
    return invoice.status;
  };

  const getDaysUntilDue = (invoice: MandateInvoice): number => {
    return differenceInDays(new Date(invoice.dueDate), new Date());
  };

  const draftInvoices = invoices?.filter(i => i.status === "DRAFT") || [];
  const sentInvoices = invoices?.filter(i => ["SENT", "MANDATED"].includes(i.status)) || [];
  const paidInvoices = invoices?.filter(i => i.status === "PAID") || [];
  const cancelledInvoices = invoices?.filter(i => i.status === "CANCELLED") || [];

  const totalPending = sentInvoices.reduce((sum, i) => sum + i.totalAmount, 0);
  const totalPaid = paidInvoices.reduce((sum, i) => sum + i.totalAmount, 0);

  return (
    <SuperadminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FileCheck className="h-8 w-8 text-primary" />
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Badge className="bg-purple-600 text-white" data-testid="badge-mandate-indicator">
                  Mandat Administratif
                </Badge>
              </div>
              <h1 className="text-2xl font-bold">Factures Mandats</h1>
              <p className="text-muted-foreground">Suivi des factures par mandat administratif</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-muted-foreground" />
                <div>
                  <div className="text-2xl font-bold">{draftInvoices.length}</div>
                  <div className="text-sm text-muted-foreground">Brouillons</div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Send className="h-5 w-5 text-blue-500" />
                <div>
                  <div className="text-2xl font-bold">{sentInvoices.length}</div>
                  <div className="text-sm text-muted-foreground">En attente</div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-500" />
                <div>
                  <div className="text-2xl font-bold">{totalPaid.toFixed(2)} EUR HT</div>
                  <div className="text-sm text-muted-foreground">Encaisse</div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-orange-500" />
                <div>
                  <div className="text-2xl font-bold">{totalPending.toFixed(2)} EUR HT</div>
                  <div className="text-sm text-muted-foreground">A encaisser</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="pending">
          <TabsList>
            <TabsTrigger value="draft" data-testid="tab-draft">
              Brouillons ({draftInvoices.length})
            </TabsTrigger>
            <TabsTrigger value="pending" data-testid="tab-pending">
              En attente ({sentInvoices.length})
            </TabsTrigger>
            <TabsTrigger value="paid" data-testid="tab-paid">
              Payees ({paidInvoices.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="draft">
            <Card>
              <CardHeader>
                <CardTitle>Factures brouillon</CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="flex justify-center p-8">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : draftInvoices.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Aucune facture brouillon
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>N Facture</TableHead>
                        <TableHead>Client</TableHead>
                        <TableHead>Montant</TableHead>
                        <TableHead>Echeance</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {draftInvoices.map((invoice) => (
                        <TableRow key={invoice.id}>
                          <TableCell className="font-mono">{invoice.invoiceNumber}</TableCell>
                          <TableCell>{invoice.clientName}</TableCell>
                          <TableCell>{invoice.totalAmount.toFixed(2)} EUR HT</TableCell>
                          <TableCell>
                            {format(new Date(invoice.dueDate), "dd/MM/yyyy", { locale: fr })}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => openDetails(invoice)}
                                data-testid={`button-view-${invoice.id}`}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => downloadPdf(`/api/superadmin/mandate-invoices/${invoice.id}/pdf`, `${invoice.invoiceNumber}.pdf`)}
                                data-testid={`button-pdf-${invoice.id}`}
                              >
                                <Download className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="default"
                                onClick={() => updateStatusMutation.mutate({ id: invoice.id, status: "SENT" })}
                                disabled={updateStatusMutation.isPending}
                                data-testid={`button-send-${invoice.id}`}
                              >
                                <Send className="h-4 w-4 mr-1" />
                                Envoyer
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setDeleteInvoiceId(invoice.id)}
                                data-testid={`button-delete-invoice-${invoice.id}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="pending">
            <Card>
              <CardHeader>
                <CardTitle>Factures en attente de paiement</CardTitle>
              </CardHeader>
              <CardContent>
                {sentInvoices.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Aucune facture en attente
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>N Facture</TableHead>
                        <TableHead>Client</TableHead>
                        <TableHead>Montant</TableHead>
                        <TableHead>Echeance</TableHead>
                        <TableHead>Statut</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sentInvoices.map((invoice) => {
                        const displayStatus = getInvoiceStatus(invoice);
                        const statusConfig = STATUS_CONFIG[displayStatus];
                        const daysUntilDue = getDaysUntilDue(invoice);
                        return (
                          <TableRow key={invoice.id}>
                            <TableCell className="font-mono">{invoice.invoiceNumber}</TableCell>
                            <TableCell>{invoice.clientName}</TableCell>
                            <TableCell>{invoice.totalAmount.toFixed(2)} EUR HT</TableCell>
                            <TableCell>
                              <div className="flex flex-col">
                                <span>{format(new Date(invoice.dueDate), "dd/MM/yyyy", { locale: fr })}</span>
                                {daysUntilDue < 0 ? (
                                  <span className="text-xs text-red-500">
                                    {Math.abs(daysUntilDue)} jours de retard
                                  </span>
                                ) : daysUntilDue <= 7 ? (
                                  <span className="text-xs text-orange-500">
                                    {daysUntilDue} jours restants
                                  </span>
                                ) : null}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge className={statusConfig?.color}>
                                {statusConfig?.label || displayStatus}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => openDetails(invoice)}
                                  data-testid={`button-view-${invoice.id}`}
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => downloadPdf(`/api/superadmin/mandate-invoices/${invoice.id}/pdf`, `${invoice.invoiceNumber}.pdf`)}
                                  data-testid={`button-pdf-${invoice.id}`}
                                >
                                  <Download className="h-4 w-4" />
                                </Button>
                                {invoice.status === "SENT" && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => updateStatusMutation.mutate({ id: invoice.id, status: "MANDATED" })}
                                    disabled={updateStatusMutation.isPending}
                                    data-testid={`button-mandate-${invoice.id}`}
                                  >
                                    <FileCheck className="h-4 w-4 mr-1" />
                                    Mandate
                                  </Button>
                                )}
                                <Button
                                  size="sm"
                                  variant="default"
                                  onClick={() => openPayment(invoice)}
                                  data-testid={`button-payment-${invoice.id}`}
                                >
                                  <CreditCard className="h-4 w-4 mr-1" />
                                  Paiement
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setDeleteInvoiceId(invoice.id)}
                                  data-testid={`button-delete-invoice-${invoice.id}`}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
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
          </TabsContent>

          <TabsContent value="paid">
            <Card>
              <CardHeader>
                <CardTitle>Factures payees</CardTitle>
              </CardHeader>
              <CardContent>
                {paidInvoices.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Aucune facture payee
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>N Facture</TableHead>
                        <TableHead>Client</TableHead>
                        <TableHead>Montant</TableHead>
                        <TableHead>Date paiement</TableHead>
                        <TableHead>Reference</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paidInvoices.map((invoice) => (
                        <TableRow key={invoice.id}>
                          <TableCell className="font-mono">{invoice.invoiceNumber}</TableCell>
                          <TableCell>{invoice.clientName}</TableCell>
                          <TableCell>{invoice.totalAmount.toFixed(2)} EUR HT</TableCell>
                          <TableCell>
                            {invoice.paidAt 
                              ? format(new Date(invoice.paidAt), "dd/MM/yyyy", { locale: fr })
                              : "-"
                            }
                          </TableCell>
                          <TableCell className="font-mono">
                            {invoice.paymentReference || "-"}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => openDetails(invoice)}
                                data-testid={`button-view-${invoice.id}`}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => downloadPdf(`/api/superadmin/mandate-invoices/${invoice.id}/pdf`, `${invoice.invoiceNumber}.pdf`)}
                                data-testid={`button-pdf-${invoice.id}`}
                              >
                                <Download className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setDeleteInvoiceId(invoice.id)}
                                data-testid={`button-delete-invoice-${invoice.id}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileCheck className="h-5 w-5" />
                Facture {selectedInvoice?.invoiceNumber}
              </DialogTitle>
            </DialogHeader>
            {selectedInvoice && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <h3 className="font-semibold">Client</h3>
                    <div className="text-sm space-y-1">
                      <p><strong>Nom:</strong> {selectedInvoice.clientName}</p>
                      <p><strong>SIRET:</strong> {selectedInvoice.clientSiret}</p>
                      <p><strong>Adresse:</strong> {selectedInvoice.clientAddress || "Non renseignee"}</p>
                      <p><strong>Service:</strong> {selectedInvoice.billingService || "Non renseigne"}</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <h3 className="font-semibold">Periode</h3>
                    <div className="text-sm space-y-1">
                      <p><strong>Du:</strong> {format(new Date(selectedInvoice.periodStart), "dd/MM/yyyy", { locale: fr })}</p>
                      <p><strong>Au:</strong> {format(new Date(selectedInvoice.periodEnd), "dd/MM/yyyy", { locale: fr })}</p>
                      <p><strong>Echeance:</strong> {format(new Date(selectedInvoice.dueDate), "dd/MM/yyyy", { locale: fr })}</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <h3 className="font-semibold">Montants</h3>
                  <div className="bg-muted p-4 rounded-lg space-y-1">
                    <div className="flex justify-between">
                      <span>Forfait de base:</span>
                      <span>{(selectedInvoice.planAmount || selectedInvoice.subtotal).toFixed(2)} EUR HT</span>
                    </div>
                    {(() => {
                      try {
                        const addons: AddonSnapshot[] = selectedInvoice.addonsSnapshot 
                          ? JSON.parse(selectedInvoice.addonsSnapshot) 
                          : [];
                        return addons.map((addon) => (
                          <div key={addon.id} className="flex justify-between text-sm text-muted-foreground">
                            <span>Option: {addon.name} x{addon.quantity}</span>
                            <span>{addon.totalPrice.toFixed(2)} EUR HT</span>
                          </div>
                        ));
                      } catch { return null; }
                    })()}
                    <div className="flex justify-between border-t pt-1 mt-1">
                      <span>Sous-total:</span>
                      <span>{selectedInvoice.subtotal.toFixed(2)} EUR HT</span>
                    </div>
                    {selectedInvoice.discountAmount > 0 && (
                      <div className="flex justify-between text-green-600">
                        <span>Remise:</span>
                        <span>-{selectedInvoice.discountAmount.toFixed(2)} EUR</span>
                      </div>
                    )}
                    <div className="flex justify-between font-bold border-t pt-2 mt-2">
                      <span>Total:</span>
                      <span>{selectedInvoice.totalAmount.toFixed(2)} EUR HT</span>
                    </div>
                    <p className="text-xs text-muted-foreground italic mt-2">
                      TVA non applicable - auto-entrepreneur (art. 293 B du CGI)
                    </p>
                  </div>
                </div>

                {selectedInvoice.purchaseOrderNumber && (
                  <div>
                    <h3 className="font-semibold">References</h3>
                    <p className="text-sm">N BC: {selectedInvoice.purchaseOrderNumber}</p>
                  </div>
                )}

                <div className="flex gap-2">
                  <Badge className={STATUS_CONFIG[selectedInvoice.status]?.color}>
                    {STATUS_CONFIG[selectedInvoice.status]?.label || selectedInvoice.status}
                  </Badge>
                  {selectedInvoice.sentAt && (
                    <span className="text-sm text-muted-foreground">
                      Envoyee le {format(new Date(selectedInvoice.sentAt), "dd/MM/yyyy", { locale: fr })}
                    </span>
                  )}
                  {selectedInvoice.paidAt && (
                    <span className="text-sm text-green-600">
                      Payee le {format(new Date(selectedInvoice.paidAt), "dd/MM/yyyy", { locale: fr })}
                    </span>
                  )}
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        <Dialog open={isPaymentOpen} onOpenChange={setIsPaymentOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Enregistrer le paiement</DialogTitle>
              <DialogDescription>
                Facture {selectedInvoice?.invoiceNumber} - {selectedInvoice?.clientName}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="bg-muted p-4 rounded-lg text-center">
                <div className="text-2xl font-bold">
                  {selectedInvoice && selectedInvoice.totalAmount.toFixed(2)} EUR HT
                </div>
                <div className="text-sm text-muted-foreground">Montant a encaisser</div>
                <div className="text-xs text-muted-foreground italic mt-1">TVA non applicable</div>
              </div>
              <div>
                <Label htmlFor="paymentReference">Reference du paiement</Label>
                <Input
                  id="paymentReference"
                  value={paymentReference}
                  onChange={(e) => setPaymentReference(e.target.value)}
                  placeholder="Ex: VIR-2026-001 ou reference mandat"
                  data-testid="input-payment-reference"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsPaymentOpen(false)}>
                Annuler
              </Button>
              <Button
                onClick={() => selectedInvoice && updateStatusMutation.mutate({ 
                  id: selectedInvoice.id, 
                  status: "PAID",
                  paymentReference
                })}
                disabled={updateStatusMutation.isPending}
                data-testid="button-confirm-payment"
              >
                {updateStatusMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Confirmer le paiement
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <AlertDialog open={!!deleteInvoiceId} onOpenChange={(open) => !open && setDeleteInvoiceId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Supprimer cette facture ?</AlertDialogTitle>
              <AlertDialogDescription>
                Cette action est irreversible. La facture sera definitivement supprimee.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel data-testid="button-cancel-delete">Annuler</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => deleteInvoiceId && deleteMutation.mutate(deleteInvoiceId)}
                disabled={deleteMutation.isPending}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                data-testid="button-confirm-delete"
              >
                {deleteMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Supprimer
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </SuperadminLayout>
  );
}
