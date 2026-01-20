import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { 
  ClipboardList, 
  Check, 
  X, 
  Eye, 
  FileText, 
  Building2,
  Clock,
  AlertCircle,
  CheckCircle,
  Loader2,
  Download,
  Trash2
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
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
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface AddonSnapshot {
  id: string;
  code: string;
  name: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

interface MandateOrder {
  id: string;
  orderNumber: string;
  tenantId: string;
  planId: string;
  status: string;
  billingCycle: string;
  planAmount: number | null;
  addonsAmount: number | null;
  addonsSnapshot: string | null;
  annualAmount: number;
  discountAmount: number | null;
  finalAmount: number;
  clientName: string;
  clientSiret: string;
  clientAddress: string | null;
  billingService: string | null;
  accountingContactName: string | null;
  accountingContactEmail: string | null;
  purchaseOrderNumber: string | null;
  engagementNumber: string | null;
  serviceCode: string | null;
  useChorusPro: boolean;
  validatedAt: string | null;
  rejectedAt: string | null;
  rejectionReason: string | null;
  createdAt: string;
}

interface MandateActivity {
  id: string;
  activityType: string;
  title: string;
  description: string | null;
  oldValue: string | null;
  newValue: string | null;
  performedByType: string;
  createdAt: string;
}

interface Tenant {
  id: string;
  name: string;
  slug: string;
  tenantType: string;
  contactEmail: string;
  contactName: string;
}

interface OrderDetails {
  order: MandateOrder;
  tenant: Tenant | null;
  documents: any[];
  activities: MandateActivity[];
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  PENDING_VALIDATION: { label: "En attente validation", color: "bg-yellow-500 text-white", icon: Clock },
  PENDING_BC: { label: "En attente BC", color: "bg-orange-500 text-white", icon: AlertCircle },
  ACCEPTED: { label: "Acceptee", color: "bg-green-500 text-white", icon: CheckCircle },
  INVOICED: { label: "Facturee", color: "bg-blue-500 text-white", icon: FileText },
  REJECTED: { label: "Rejetee", color: "bg-red-500 text-white", icon: X },
};

async function downloadPdf(orderId: string, orderNumber: string) {
  try {
    const response = await fetch(`/api/superadmin/mandate-orders/${orderId}/pdf`, {
      credentials: 'include',
    });
    if (!response.ok) {
      throw new Error('Erreur lors du telechargement');
    }
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${orderNumber}.pdf`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  } catch (error) {
    console.error('PDF download error:', error);
    throw error;
  }
}

export default function SuperadminMandateOrders() {
  const { toast } = useToast();
  const [selectedOrder, setSelectedOrder] = useState<MandateOrder | null>(null);
  const [orderDetails, setOrderDetails] = useState<OrderDetails | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isValidateOpen, setIsValidateOpen] = useState(false);
  const [isRejectOpen, setIsRejectOpen] = useState(false);
  const [hasPurchaseOrder, setHasPurchaseOrder] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [deleteOrderId, setDeleteOrderId] = useState<string | null>(null);

  const { data: orders, isLoading } = useQuery<MandateOrder[]>({
    queryKey: ["/api/superadmin/mandate-orders"],
  });

  const validateMutation = useMutation({
    mutationFn: async ({ id, hasPurchaseOrder }: { id: string; hasPurchaseOrder: boolean }) => {
      const res = await apiRequest("PUT", `/api/superadmin/mandate-orders/${id}/validate`, { hasPurchaseOrder });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/superadmin/mandate-orders"] });
      setIsValidateOpen(false);
      setSelectedOrder(null);
      toast({ title: "Commande validee avec succes" });
    },
    onError: (error: any) => {
      toast({ 
        title: "Erreur", 
        description: error.message || "Impossible de valider la commande", 
        variant: "destructive" 
      });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const res = await apiRequest("PUT", `/api/superadmin/mandate-orders/${id}/reject`, { reason });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/superadmin/mandate-orders"] });
      setIsRejectOpen(false);
      setSelectedOrder(null);
      setRejectionReason("");
      toast({ title: "Commande rejetee" });
    },
    onError: (error: any) => {
      toast({ 
        title: "Erreur", 
        description: error.message || "Impossible de rejeter la commande", 
        variant: "destructive" 
      });
    },
  });

  const generateInvoiceMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("POST", `/api/superadmin/mandate-orders/${id}/generate-invoice`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/superadmin/mandate-orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/superadmin/mandate-invoices"] });
      toast({ title: "Facture generee avec succes" });
    },
    onError: (error: any) => {
      toast({ 
        title: "Erreur", 
        description: error.message || "Impossible de generer la facture", 
        variant: "destructive" 
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/superadmin/mandate-orders/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/superadmin/mandate-orders"] });
      setDeleteOrderId(null);
      toast({ title: "Commande supprimee avec succes" });
    },
    onError: (error: any) => {
      toast({ 
        title: "Erreur", 
        description: error.message || "Impossible de supprimer la commande", 
        variant: "destructive" 
      });
    },
  });

  const openDetails = async (order: MandateOrder) => {
    setSelectedOrder(order);
    setLoadingDetails(true);
    setIsDetailsOpen(true);
    try {
      const res = await apiRequest("GET", `/api/superadmin/mandate-orders/${order.id}`);
      const details = await res.json();
      setOrderDetails(details);
    } catch (error) {
      toast({ title: "Erreur", description: "Impossible de charger les details", variant: "destructive" });
    } finally {
      setLoadingDetails(false);
    }
  };

  const openValidate = (order: MandateOrder) => {
    setSelectedOrder(order);
    setHasPurchaseOrder(false);
    setIsValidateOpen(true);
  };

  const openReject = (order: MandateOrder) => {
    setSelectedOrder(order);
    setRejectionReason("");
    setIsRejectOpen(true);
  };

  const pendingOrders = orders?.filter(o => ["PENDING_VALIDATION", "PENDING_BC"].includes(o.status)) || [];
  const acceptedOrders = orders?.filter(o => o.status === "ACCEPTED") || [];
  const processedOrders = orders?.filter(o => ["INVOICED", "REJECTED"].includes(o.status)) || [];

  return (
    <SuperadminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ClipboardList className="h-8 w-8 text-primary" />
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Badge className="bg-purple-600 text-white" data-testid="badge-mandate-indicator">
                  Mandat Administratif
                </Badge>
              </div>
              <h1 className="text-2xl font-bold">Commandes Mandats</h1>
              <p className="text-muted-foreground">Gestion des commandes par mandat administratif</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-yellow-500" />
                <div>
                  <div className="text-2xl font-bold">{pendingOrders.length}</div>
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
                  <div className="text-2xl font-bold">{acceptedOrders.length}</div>
                  <div className="text-sm text-muted-foreground">Acceptees</div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-blue-500" />
                <div>
                  <div className="text-2xl font-bold">{processedOrders.filter(o => o.status === "INVOICED").length}</div>
                  <div className="text-sm text-muted-foreground">Facturees</div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <X className="h-5 w-5 text-red-500" />
                <div>
                  <div className="text-2xl font-bold">{processedOrders.filter(o => o.status === "REJECTED").length}</div>
                  <div className="text-sm text-muted-foreground">Rejetees</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="pending">
          <TabsList>
            <TabsTrigger value="pending" data-testid="tab-pending">
              En attente ({pendingOrders.length})
            </TabsTrigger>
            <TabsTrigger value="accepted" data-testid="tab-accepted">
              Acceptees ({acceptedOrders.length})
            </TabsTrigger>
            <TabsTrigger value="processed" data-testid="tab-processed">
              Traitees ({processedOrders.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pending">
            <Card>
              <CardHeader>
                <CardTitle>Commandes en attente de validation</CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="flex justify-center p-8">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : pendingOrders.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Aucune commande en attente
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>N Commande</TableHead>
                        <TableHead>Client</TableHead>
                        <TableHead>SIRET</TableHead>
                        <TableHead>Montant</TableHead>
                        <TableHead>Statut</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pendingOrders.map((order) => {
                        const statusConfig = STATUS_CONFIG[order.status];
                        return (
                          <TableRow key={order.id}>
                            <TableCell className="font-mono">{order.orderNumber}</TableCell>
                            <TableCell>{order.clientName}</TableCell>
                            <TableCell className="font-mono">{order.clientSiret}</TableCell>
                            <TableCell>{order.finalAmount.toFixed(2)} EUR</TableCell>
                            <TableCell>
                              <Badge className={statusConfig?.color}>
                                {statusConfig?.label || order.status}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {format(new Date(order.createdAt), "dd/MM/yyyy", { locale: fr })}
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => openDetails(order)}
                                  data-testid={`button-view-${order.id}`}
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => downloadPdf(order.id, order.orderNumber).catch(() => toast({ title: "Erreur", description: "Impossible de telecharger le PDF", variant: "destructive" }))}
                                  data-testid={`button-pdf-${order.id}`}
                                >
                                  <Download className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="default"
                                  onClick={() => openValidate(order)}
                                  data-testid={`button-validate-${order.id}`}
                                >
                                  <Check className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => openReject(order)}
                                  data-testid={`button-reject-${order.id}`}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setDeleteOrderId(order.id)}
                                  data-testid={`button-delete-order-${order.id}`}
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

          <TabsContent value="accepted">
            <Card>
              <CardHeader>
                <CardTitle>Commandes acceptees (en attente de facturation)</CardTitle>
              </CardHeader>
              <CardContent>
                {acceptedOrders.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Aucune commande acceptee
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>N Commande</TableHead>
                        <TableHead>Client</TableHead>
                        <TableHead>Montant</TableHead>
                        <TableHead>Date validation</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {acceptedOrders.map((order) => (
                        <TableRow key={order.id}>
                          <TableCell className="font-mono">{order.orderNumber}</TableCell>
                          <TableCell>{order.clientName}</TableCell>
                          <TableCell>{order.finalAmount.toFixed(2)} EUR</TableCell>
                          <TableCell>
                            {order.validatedAt 
                              ? format(new Date(order.validatedAt), "dd/MM/yyyy", { locale: fr })
                              : "-"
                            }
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => openDetails(order)}
                                data-testid={`button-view-${order.id}`}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => downloadPdf(order.id, order.orderNumber).catch(() => toast({ title: "Erreur", description: "Impossible de telecharger le PDF", variant: "destructive" }))}
                                data-testid={`button-pdf-${order.id}`}
                              >
                                <Download className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="default"
                                onClick={() => generateInvoiceMutation.mutate(order.id)}
                                disabled={generateInvoiceMutation.isPending}
                                data-testid={`button-generate-invoice-${order.id}`}
                              >
                                {generateInvoiceMutation.isPending ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <FileText className="h-4 w-4 mr-1" />
                                )}
                                Generer facture
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setDeleteOrderId(order.id)}
                                data-testid={`button-delete-order-${order.id}`}
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

          <TabsContent value="processed">
            <Card>
              <CardHeader>
                <CardTitle>Commandes traitees</CardTitle>
              </CardHeader>
              <CardContent>
                {processedOrders.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Aucune commande traitee
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>N Commande</TableHead>
                        <TableHead>Client</TableHead>
                        <TableHead>Montant</TableHead>
                        <TableHead>Statut</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {processedOrders.map((order) => {
                        const statusConfig = STATUS_CONFIG[order.status];
                        return (
                          <TableRow key={order.id}>
                            <TableCell className="font-mono">{order.orderNumber}</TableCell>
                            <TableCell>{order.clientName}</TableCell>
                            <TableCell>{order.finalAmount.toFixed(2)} EUR</TableCell>
                            <TableCell>
                              <Badge className={statusConfig?.color}>
                                {statusConfig?.label || order.status}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {format(new Date(order.createdAt), "dd/MM/yyyy", { locale: fr })}
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => openDetails(order)}
                                  data-testid={`button-view-${order.id}`}
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => downloadPdf(order.id, order.orderNumber).catch(() => toast({ title: "Erreur", description: "Impossible de telecharger le PDF", variant: "destructive" }))}
                                  data-testid={`button-pdf-${order.id}`}
                                >
                                  <Download className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setDeleteOrderId(order.id)}
                                  data-testid={`button-delete-order-${order.id}`}
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
        </Tabs>

        <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
          <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ClipboardList className="h-5 w-5" />
                Commande {selectedOrder?.orderNumber}
              </DialogTitle>
            </DialogHeader>
            {loadingDetails ? (
              <div className="flex justify-center p-8">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : orderDetails ? (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <h3 className="font-semibold flex items-center gap-2">
                      <Building2 className="h-4 w-4" />
                      Client
                    </h3>
                    <div className="text-sm space-y-1">
                      <p><strong>Nom:</strong> {orderDetails.order.clientName}</p>
                      <p><strong>SIRET:</strong> {orderDetails.order.clientSiret}</p>
                      <p><strong>Adresse:</strong> {orderDetails.order.clientAddress || "Non renseignee"}</p>
                      <p><strong>Service:</strong> {orderDetails.order.billingService || "Non renseigne"}</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <h3 className="font-semibold">Contact comptabilite</h3>
                    <div className="text-sm space-y-1">
                      <p><strong>Nom:</strong> {orderDetails.order.accountingContactName || "Non renseigne"}</p>
                      <p><strong>Email:</strong> {orderDetails.order.accountingContactEmail || "Non renseigne"}</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <h3 className="font-semibold">Details financiers</h3>
                  <div className="bg-muted p-4 rounded-lg space-y-1">
                    <div className="flex justify-between">
                      <span>Forfait de base:</span>
                      <span>{(orderDetails.order.planAmount || orderDetails.order.annualAmount).toFixed(2)} EUR</span>
                    </div>
                    {(() => {
                      try {
                        const addons: AddonSnapshot[] = orderDetails.order.addonsSnapshot 
                          ? JSON.parse(orderDetails.order.addonsSnapshot) 
                          : [];
                        return addons.map((addon) => (
                          <div key={addon.id} className="flex justify-between text-sm text-muted-foreground">
                            <span>Option: {addon.name} x{addon.quantity}</span>
                            <span>{addon.totalPrice.toFixed(2)} EUR</span>
                          </div>
                        ));
                      } catch { return null; }
                    })()}
                    <div className="flex justify-between border-t pt-1 mt-1">
                      <span>Total HT:</span>
                      <span>{orderDetails.order.annualAmount.toFixed(2)} EUR</span>
                    </div>
                    {orderDetails.order.discountAmount && orderDetails.order.discountAmount > 0 && (
                      <div className="flex justify-between text-green-600">
                        <span>Remise (2 mois offerts):</span>
                        <span>-{orderDetails.order.discountAmount.toFixed(2)} EUR</span>
                      </div>
                    )}
                    <div className="flex justify-between font-bold border-t pt-2 mt-2">
                      <span>Total TTC:</span>
                      <span>{orderDetails.order.finalAmount.toFixed(2)} EUR</span>
                    </div>
                  </div>
                </div>

                {orderDetails.order.useChorusPro && (
                  <div className="space-y-2">
                    <h3 className="font-semibold">Chorus Pro</h3>
                    <Badge variant="outline">Active</Badge>
                  </div>
                )}

                {orderDetails.activities.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="font-semibold">Historique</h3>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {orderDetails.activities.map((activity) => (
                        <div key={activity.id} className="text-sm border-l-2 border-muted-foreground/20 pl-3 py-1">
                          <div className="font-medium">{activity.title}</div>
                          {activity.description && (
                            <div className="text-muted-foreground">{activity.description}</div>
                          )}
                          <div className="text-xs text-muted-foreground">
                            {format(new Date(activity.createdAt), "dd/MM/yyyy HH:mm", { locale: fr })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : null}
          </DialogContent>
        </Dialog>

        <Dialog open={isValidateOpen} onOpenChange={setIsValidateOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Valider la commande</DialogTitle>
              <DialogDescription>
                Validez la commande {selectedOrder?.orderNumber} pour {selectedOrder?.clientName}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="hasPurchaseOrder"
                  checked={hasPurchaseOrder}
                  onCheckedChange={(checked) => setHasPurchaseOrder(checked === true)}
                  data-testid="checkbox-has-purchase-order"
                />
                <Label htmlFor="hasPurchaseOrder">
                  Le bon de commande (BC) a ete recu
                </Label>
              </div>
              <p className="text-sm text-muted-foreground">
                {hasPurchaseOrder 
                  ? "La commande sera acceptee et l'abonnement active immediatement."
                  : "La commande sera mise en attente du bon de commande."
                }
              </p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsValidateOpen(false)}>
                Annuler
              </Button>
              <Button
                onClick={() => selectedOrder && validateMutation.mutate({ 
                  id: selectedOrder.id, 
                  hasPurchaseOrder 
                })}
                disabled={validateMutation.isPending}
                data-testid="button-confirm-validate"
              >
                {validateMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Valider
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={isRejectOpen} onOpenChange={setIsRejectOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Rejeter la commande</DialogTitle>
              <DialogDescription>
                Rejeter la commande {selectedOrder?.orderNumber} pour {selectedOrder?.clientName}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="rejectionReason">Raison du rejet</Label>
                <Textarea
                  id="rejectionReason"
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Expliquez la raison du rejet..."
                  data-testid="input-rejection-reason"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsRejectOpen(false)}>
                Annuler
              </Button>
              <Button
                variant="destructive"
                onClick={() => selectedOrder && rejectMutation.mutate({ 
                  id: selectedOrder.id, 
                  reason: rejectionReason 
                })}
                disabled={rejectMutation.isPending}
                data-testid="button-confirm-reject"
              >
                {rejectMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Rejeter
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <AlertDialog open={!!deleteOrderId} onOpenChange={(open) => !open && setDeleteOrderId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Supprimer cette commande ?</AlertDialogTitle>
              <AlertDialogDescription>
                Cette action est irreversible. La commande sera definitivement supprimee.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel data-testid="button-cancel-delete">Annuler</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => deleteOrderId && deleteMutation.mutate(deleteOrderId)}
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
