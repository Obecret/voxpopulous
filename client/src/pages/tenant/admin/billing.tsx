import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { AdminLayout } from "@/components/layout/admin-layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { CreditCard, Check, AlertCircle, ExternalLink, Package, Calendar, Clock, Plus, Minus, Wallet, ArrowRight, X, Loader2, Download, FileText, Building2, Save, Upload, File, XCircle, Info, ChevronDown, ChevronUp, HelpCircle, AlertTriangle } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Tenant, User, SubscriptionPlan, Feature, PlanFeatureAssignment, Addon, TenantBillingChange, BillingLedgerEntry, MandateOrder, MandateInvoice } from "@shared/schema";

interface UserWithBlockStatus extends User {
  accountBlocked?: boolean;
  blockReason?: string;
}

interface BillingInfo {
  subscriptionPlan: string;
  subscriptionPlanId: string | null;
  billingStatus: string;
  trialEndsAt: string | null;
  hasStripeCustomer: boolean;
  hasSubscription: boolean;
}

interface AddonWithQuantity {
  addon: Addon;
  quantity: number;
  effectivePrice: { monthlyPrice: number; yearlyPrice: number } | null;
  pendingQuantity?: number | null;
  pendingEffectiveDate?: string | null;
}

interface AddonWithPricing {
  id: string;
  addonId: string;
  quantity: number;
  addon: Addon;
  monthlyUnitPrice: number;
  yearlyUnitPrice: number;
  effectiveUnitPrice: number;
  subtotal: number;
}

interface AvailableAddon extends Addon {
  isEnabled: boolean;
  monthlyPrice: number;
  yearlyPrice: number;
  currentQuantity: number;
}

interface PlanIncludedAddon {
  id: string;
  name: string;
  description: string | null;
  quantity: number;
}

interface EnrichedPendingChange extends TenantBillingChange {
  addonName: string | null;
  addonUnitPrice: number | null;
  fromPlanName: string | null;
  toPlanName: string | null;
  priceDelta: number | null;
}

interface BillingSummary {
  tenant: Tenant;
  plan: SubscriptionPlan | null;
  planCost: number;
  billingInterval: "MONTHLY" | "YEARLY";
  addons: AddonWithPricing[];
  addonsTotalCost: number;
  totalCost: number;
  preferences: { preferredPaymentMethod: "STRIPE" | "ADMINISTRATIVE_MANDATE" } | null;
  pendingChanges: EnrichedPendingChange[];
  ledgerBalance: number;
  availableAddons: AvailableAddon[];
  planIncludedAddons: PlanIncludedAddon[];
  allPlans: SubscriptionPlan[];
  hasStripeCustomer: boolean;
  hasSubscription: boolean;
}

interface AddonPreview {
  addonId: string;
  addonName: string;
  currentQuantity: number;
  newQuantity: number;
  quantityDiff: number;
  unitPrice: number;
  billingInterval: string;
  immediateCharge: number;
  immediateCredit: number;
  recurringDelta: number;
  currentAddonCost: number;
  newAddonCost: number;
  currentTotalCost: number;
  newTotalCost: number;
}

interface BillingInfoFull {
  plan: SubscriptionPlan | null;
  billingInterval: "MONTHLY" | "YEARLY" | null;
  addons: AddonWithQuantity[];
  pendingChanges: TenantBillingChange[];
  ledgerBalance: number;
  preferences: { preferredPaymentMethod: "STRIPE" | "ADMINISTRATIVE_MANDATE" } | null;
}

type PlanWithCatalog = SubscriptionPlan & { catalogFeatures: (PlanFeatureAssignment & { feature: Feature })[] };

interface MandateBillingInfo {
  siret: string | null;
  mandateBillingAddress: string | null;
  mandateBillingService: string | null;
  mandateAccountingContactName: string | null;
  mandateAccountingContactEmail: string | null;
  mandateAccountingContactPhone: string | null;
  mandateServiceCode: string | null;
  mandateEngagementNumber: string | null;
  mandatePurchaseOrderNumber: string | null;
  mandateUseChorusPro: boolean | null;
  mandateChorusProSiret: string | null;
  mandateChorusProServiceCode: string | null;
  mandateChorusProServiceLabel: string | null;
  mandateChorusProEngagementNumber: string | null;
}

interface StripeInvoice {
  id: string;
  invoice_number: string | null;
  status: string;
  amount_due: number;
  amount_paid: number;
  total: number;
  currency: string;
  period_start: number | null;
  period_end: number | null;
  hosted_invoice_url: string | null;
  invoice_pdf: string | null;
  created: number;
  updated_at: string;
}

interface BillingHistoryEvent {
  id: string;
  type: 'ledger' | 'change';
  date: string;
  eventType: string;
  description: string;
  amount?: number;
  recurringDelta?: number;
  prorataCredit?: number;
  prorataDebit?: number;
  status?: string;
  addonName?: string | null;
  fromQuantity?: number | null;
  toQuantity?: number | null;
  fromPlanName?: string | null;
  toPlanName?: string | null;
  paymentMethod?: string | null;
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

export default function AdminBilling() {
  const params = useParams<{ slug: string }>();
  const [location] = useLocation();
  const { toast } = useToast();
  
  const [changePlanOpen, setChangePlanOpen] = useState(false);
  const [changeAddonOpen, setChangeAddonOpen] = useState(false);
  const [addAddonOpen, setAddAddonOpen] = useState(false);
  const [optionsHelpOpen, setOptionsHelpOpen] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [selectedInterval, setSelectedInterval] = useState<"MONTHLY" | "YEARLY">("MONTHLY");
  const [selectedAddon, setSelectedAddon] = useState<AddonWithPricing | null>(null);
  const [selectedAvailableAddon, setSelectedAvailableAddon] = useState<AvailableAddon | null>(null);
  const [newAddonQuantity, setNewAddonQuantity] = useState(0);
  const [addonPreview, setAddonPreview] = useState<AddonPreview | null>(null);
  const [applyImmediate, setApplyImmediate] = useState(false);
  
  // State for editing mandate order BC info
  const [editOrderOpen, setEditOrderOpen] = useState(false);
  const [selectedOrderForEdit, setSelectedOrderForEdit] = useState<MandateOrder | null>(null);
  const [orderBcFormData, setOrderBcFormData] = useState({
    engagementNumber: "",
    purchaseOrderNumber: "",
    serviceCode: "",
  });
  const [uploadingBc, setUploadingBc] = useState(false);
  const [orderDocuments, setOrderDocuments] = useState<any[]>([]);
  const [cancelRequestOpen, setCancelRequestOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");

  const searchParams = new URLSearchParams(location.split('?')[1] || '');
  const success = searchParams.get('success');
  const canceled = searchParams.get('canceled');

  const { data: tenant, isLoading: tenantLoading } = useQuery<Tenant>({
    queryKey: ["/api/tenants", params.slug],
  });

  const { data: user, isLoading: userLoading, error: userError } = useQuery<UserWithBlockStatus>({
    queryKey: ["/api/tenants", params.slug, "admin", "me"],
    retry: false,
  });

  const { data: billing, isLoading: billingLoading } = useQuery<BillingInfo>({
    queryKey: ["/api/tenants", params.slug, "admin", "billing"],
    enabled: !!user,
  });

  const { data: billingInfo, isLoading: billingInfoLoading } = useQuery<BillingInfoFull>({
    queryKey: ["/api/tenants", params.slug, "admin", "billing", "info"],
    enabled: !!user,
  });

  const { data: billingSummary, isLoading: billingSummaryLoading } = useQuery<BillingSummary>({
    queryKey: ["/api/tenants", params.slug, "admin", "billing", "summary"],
    enabled: !!user,
  });

  const { data: plans, isLoading: plansLoading } = useQuery<PlanWithCatalog[]>({
    queryKey: ["/api/public/plans-catalog", tenant?.tenantType],
    queryFn: async () => {
      const url = tenant?.tenantType 
        ? `/api/public/plans-catalog?tenantType=${tenant.tenantType}`
        : "/api/public/plans-catalog";
      const response = await fetch(url);
      if (!response.ok) throw new Error("Failed to fetch plans");
      return response.json();
    },
    enabled: !!tenant,
  });

  const { data: stripeModeData, isLoading: stripeModeLoading } = useQuery<{ stripeMode: 'test' | 'live' }>({
    queryKey: ["/api/public/stripe-mode"],
  });
  const stripeMode = stripeModeData?.stripeMode || 'test';

  const { data: ledgerEntries } = useQuery<BillingLedgerEntry[]>({
    queryKey: ["/api/tenants", params.slug, "admin", "billing", "ledger"],
    enabled: !!user,
  });

  const { data: billingHistory, isLoading: historyLoading } = useQuery<BillingHistoryEvent[]>({
    queryKey: ["/api/tenants", params.slug, "admin", "billing", "history"],
    enabled: !!user,
  });

  const { data: mandateOrders, isLoading: mandateOrdersLoading } = useQuery<MandateOrder[]>({
    queryKey: ["/api/tenants", params.slug, "admin", "billing", "mandate-orders"],
    enabled: !!user && billingInfo?.preferences?.preferredPaymentMethod === "ADMINISTRATIVE_MANDATE",
  });

  const { data: mandateInvoices, isLoading: mandateInvoicesLoading } = useQuery<MandateInvoice[]>({
    queryKey: ["/api/tenants", params.slug, "admin", "billing", "mandate-invoices"],
    enabled: !!user && billingInfo?.preferences?.preferredPaymentMethod === "ADMINISTRATIVE_MANDATE",
  });

  const { data: mandateBillingInfo, isLoading: mandateBillingInfoLoading } = useQuery<MandateBillingInfo>({
    queryKey: ["/api/tenants", params.slug, "admin", "billing", "mandate-info"],
    enabled: !!user, // Load for all tenants - billing info is needed for both Stripe and mandate
  });

  // Stripe invoices for Stripe payment method tenants
  const { data: stripeInvoices, isLoading: stripeInvoicesLoading } = useQuery<StripeInvoice[]>({
    queryKey: ["/api/tenants", params.slug, "admin", "billing", "stripe-invoices"],
    enabled: !!user && billingInfo?.preferences?.preferredPaymentMethod === "STRIPE",
  });

  interface ActiveMandateSubscription {
    active: boolean;
    subscription?: {
      id: string;
      status: string;
      startDate: string;
      endDate: string;
      planId: string;
    };
    plan?: {
      id: string;
      name: string;
      monthlyPrice: number;
      yearlyPrice: number;
    };
    addons?: Array<{
      id: string;
      name: string;
      quantity: number;
      unitPrice: number;
      totalPrice: number;
    }>;
    latestInvoice?: {
      id: string;
      invoiceNumber: string;
      status: string;
      totalAmount: number;
      periodStart: string;
      periodEnd: string;
      paidAt: string | null;
    };
  }

  const { data: activeMandateSubscription, isLoading: activeMandateSubLoading } = useQuery<ActiveMandateSubscription>({
    queryKey: ["/api/tenants", params.slug, "admin", "billing", "active-subscription"],
    enabled: !!user && billingInfo?.preferences?.preferredPaymentMethod === "ADMINISTRATIVE_MANDATE",
  });

  // State for mandate billing form
  const [mandateFormData, setMandateFormData] = useState<{
    mandateBillingAddress: string;
    mandateBillingService: string;
    mandateAccountingContactName: string;
    mandateAccountingContactEmail: string;
    mandateAccountingContactPhone: string;
    mandateServiceCode: string;
    mandateEngagementNumber: string;
    mandatePurchaseOrderNumber: string;
    mandateUseChorusPro: boolean;
    mandateChorusProSiret: string;
    mandateChorusProServiceCode: string;
    mandateChorusProServiceLabel: string;
    mandateChorusProEngagementNumber: string;
  }>({
    mandateBillingAddress: "",
    mandateBillingService: "",
    mandateAccountingContactName: "",
    mandateAccountingContactEmail: "",
    mandateAccountingContactPhone: "",
    mandateServiceCode: "",
    mandateEngagementNumber: "",
    mandatePurchaseOrderNumber: "",
    mandateUseChorusPro: false,
    mandateChorusProSiret: "",
    mandateChorusProServiceCode: "",
    mandateChorusProServiceLabel: "",
    mandateChorusProEngagementNumber: "",
  });

  // Update form data when mandate billing info loads
  const [mandateFormInitialized, setMandateFormInitialized] = useState(false);
  if (mandateBillingInfo && !mandateFormInitialized) {
    setMandateFormData({
      mandateBillingAddress: mandateBillingInfo.mandateBillingAddress || "",
      mandateBillingService: mandateBillingInfo.mandateBillingService || "",
      mandateAccountingContactName: mandateBillingInfo.mandateAccountingContactName || "",
      mandateAccountingContactEmail: mandateBillingInfo.mandateAccountingContactEmail || "",
      mandateAccountingContactPhone: mandateBillingInfo.mandateAccountingContactPhone || "",
      mandateServiceCode: mandateBillingInfo.mandateServiceCode || "",
      mandateEngagementNumber: mandateBillingInfo.mandateEngagementNumber || "",
      mandatePurchaseOrderNumber: mandateBillingInfo.mandatePurchaseOrderNumber || "",
      mandateUseChorusPro: mandateBillingInfo.mandateUseChorusPro || false,
      mandateChorusProSiret: mandateBillingInfo.mandateChorusProSiret || "",
      mandateChorusProServiceCode: mandateBillingInfo.mandateChorusProServiceCode || "",
      mandateChorusProServiceLabel: mandateBillingInfo.mandateChorusProServiceLabel || "",
      mandateChorusProEngagementNumber: mandateBillingInfo.mandateChorusProEngagementNumber || "",
    });
    setMandateFormInitialized(true);
  }

  const updateMandateBillingMutation = useMutation({
    mutationFn: async (data: typeof mandateFormData) => {
      const response = await apiRequest("PUT", `/api/tenants/${params.slug}/admin/billing/mandate-info`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tenants", params.slug, "admin", "billing", "mandate-info"] });
      toast({
        title: "Informations enregistrees",
        description: "Les informations de facturation ont ete mises a jour.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.message || "Impossible de mettre a jour les informations",
        variant: "destructive",
      });
    },
  });

  const updateOrderBcMutation = useMutation({
    mutationFn: async ({ orderId, data }: { orderId: string; data: typeof orderBcFormData }) => {
      const response = await apiRequest("PUT", `/api/tenants/${params.slug}/admin/billing/mandate-orders/${orderId}/bc-info`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tenants", params.slug, "admin", "billing", "mandate-orders"] });
      setEditOrderOpen(false);
      setSelectedOrderForEdit(null);
      toast({
        title: "Informations enregistrees",
        description: "Les references du bon de commande ont ete mises a jour.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.message || "Impossible de mettre a jour les informations",
        variant: "destructive",
      });
    },
  });

  const validateOrderMutation = useMutation({
    mutationFn: async (orderId: string) => {
      // First save BC info before validating
      await apiRequest("PUT", `/api/tenants/${params.slug}/admin/billing/mandate-orders/${orderId}/bc-info`, orderBcFormData);
      // Then validate
      const response = await apiRequest("PUT", `/api/tenants/${params.slug}/admin/billing/mandate-orders/${orderId}/validate`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tenants", params.slug, "admin", "billing", "mandate-orders"] });
      setEditOrderOpen(false);
      setSelectedOrderForEdit(null);
      toast({
        title: "Commande validee",
        description: "Votre bon de commande a ete envoye. Il sera traite par notre equipe.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.message || "Impossible de valider la commande",
        variant: "destructive",
      });
    },
  });

  const openEditOrder = async (order: MandateOrder) => {
    setSelectedOrderForEdit(order);
    setOrderBcFormData({
      engagementNumber: order.engagementNumber || "",
      purchaseOrderNumber: order.purchaseOrderNumber || "",
      serviceCode: order.serviceCode || "",
    });
    setEditOrderOpen(true);
    
    // Load existing documents
    try {
      const response = await fetch(`/api/tenants/${params.slug}/admin/billing/mandate-orders/${order.id}/documents`, {
        credentials: 'include',
      });
      if (response.ok) {
        const docs = await response.json();
        setOrderDocuments(docs);
      } else {
        setOrderDocuments([]);
      }
    } catch (e) {
      setOrderDocuments([]);
    }
  };

  const handleBcFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0] || !selectedOrderForEdit) return;
    
    const file = e.target.files[0];
    setUploadingBc(true);
    
    try {
      // Step 1: Get signed upload URL
      const uploadResponse = await apiRequest("POST", `/api/tenants/${params.slug}/admin/billing/mandate-orders/${selectedOrderForEdit.id}/upload-bc`);
      const { uploadURL } = await uploadResponse.json();
      
      // Step 2: Upload file to object storage
      const uploadResult = await fetch(uploadURL, {
        method: "PUT",
        body: file,
        headers: {
          "Content-Type": file.type,
        },
      });
      
      if (!uploadResult.ok) {
        throw new Error("Upload failed");
      }
      
      // Step 3: Save document metadata
      const saveResponse = await apiRequest("POST", `/api/tenants/${params.slug}/admin/billing/mandate-orders/${selectedOrderForEdit.id}/save-bc-document`, {
        fileName: file.name,
        fileUrl: uploadURL.split("?")[0], // Remove query params from signed URL
        fileSize: file.size,
        mimeType: file.type,
        reference: orderBcFormData.purchaseOrderNumber,
      });
      
      const newDoc = await saveResponse.json();
      setOrderDocuments(prev => [...prev, newDoc]);
      
      toast({
        title: "Document uploade",
        description: `Le fichier ${file.name} a ete uploade avec succes.`,
      });
    } catch (error: any) {
      toast({
        title: "Erreur d'upload",
        description: error.message || "Impossible d'uploader le document",
        variant: "destructive",
      });
    } finally {
      setUploadingBc(false);
      e.target.value = "";
    }
  };

  const checkoutMutation = useMutation({
    mutationFn: async ({ planId, interval }: { planId: string; interval: 'monthly' | 'yearly' }) => {
      const response = await apiRequest("POST", `/api/tenants/${params.slug}/admin/billing/create-checkout`, { planId, interval });
      return response.json();
    },
    onSuccess: (data) => {
      if (data.url) {
        window.location.href = data.url;
      }
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.message || "Impossible de creer la session de paiement",
        variant: "destructive",
      });
    },
  });

  const portalMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/tenants/${params.slug}/admin/billing/portal`, {});
      return response.json();
    },
    onSuccess: (data) => {
      if (data.url) {
        window.location.href = data.url;
      }
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.message || "Impossible d'acceder au portail de facturation",
        variant: "destructive",
      });
    },
  });

  const cancelRequestMutation = useMutation({
    mutationFn: async (reason: string) => {
      const response = await apiRequest("POST", `/api/tenants/${params.slug}/admin/billing/cancel-request`, { reason });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Erreur lors de la demande");
      }
      return data;
    },
    onSuccess: (data) => {
      setCancelRequestOpen(false);
      setCancelReason("");
      toast({
        title: "Demande envoyee",
        description: data.message || "Votre demande d'annulation a ete envoyee.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.message || "Impossible d'envoyer la demande",
        variant: "destructive",
      });
    },
  });

  const changePlanMutation = useMutation({
    mutationFn: async ({ newPlanId, newBillingInterval }: { newPlanId: string; newBillingInterval: "MONTHLY" | "YEARLY" }) => {
      const response = await apiRequest("POST", `/api/tenants/${params.slug}/admin/billing/change-plan`, { newPlanId, newBillingInterval });
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/tenants", params.slug, "admin", "billing"] });
      setChangePlanOpen(false);
      toast({
        title: "Changement programme",
        description: data.message,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.message || "Impossible de programmer le changement",
        variant: "destructive",
      });
    },
  });

  const changeAddonMutation = useMutation({
    mutationFn: async ({ addonId, newQuantity, immediate }: { addonId: string; newQuantity: number; immediate: boolean }) => {
      const response = await apiRequest("POST", `/api/tenants/${params.slug}/admin/billing/change-addon`, { addonId, newQuantity, immediate });
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/tenants", params.slug, "admin", "billing"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tenants", params.slug, "admin", "billing", "summary"] });
      setChangeAddonOpen(false);
      setAddAddonOpen(false);
      setSelectedAddon(null);
      setSelectedAvailableAddon(null);
      setAddonPreview(null);
      toast({
        title: data.immediate ? "Modification appliquee" : "Changement programme",
        description: data.message,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.message || "Impossible de modifier l'option",
        variant: "destructive",
      });
    },
  });

  const addonPreviewMutation = useMutation({
    mutationFn: async ({ addonId, newQuantity }: { addonId: string; newQuantity: number }) => {
      const response = await apiRequest("POST", `/api/tenants/${params.slug}/admin/billing/addon-preview`, { addonId, newQuantity });
      return response.json();
    },
    onSuccess: (data: AddonPreview) => {
      setAddonPreview(data);
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.message || "Impossible de calculer le preview",
        variant: "destructive",
      });
    },
  });

  const cancelChangeMutation = useMutation({
    mutationFn: async (changeId: string) => {
      const response = await apiRequest("DELETE", `/api/tenants/${params.slug}/admin/billing/changes/${changeId}`, {});
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tenants", params.slug, "admin", "billing"] });
      toast({
        title: "Annulation confirmee",
        description: "Le changement a ete annule.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.message || "Impossible d'annuler le changement",
        variant: "destructive",
      });
    },
  });

  const updatePreferencesMutation = useMutation({
    mutationFn: async ({ preferredPaymentMethod }: { preferredPaymentMethod: "STRIPE" | "ADMINISTRATIVE_MANDATE" }) => {
      const response = await apiRequest("PUT", `/api/tenants/${params.slug}/admin/billing/preferences`, { preferredPaymentMethod });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tenants", params.slug, "admin", "billing"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tenants", params.slug, "admin", "billing", "summary"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tenants", params.slug, "admin", "billing", "info"] });
      toast({
        title: "Preferences mises a jour",
        description: "Votre mode de paiement prefere a ete enregistre.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.message || "Impossible de mettre a jour les preferences",
        variant: "destructive",
      });
    },
  });

  if (userError) {
    window.location.href = `/structures/${params.slug}/admin/login`;
    return null;
  }

  if (tenantLoading || userLoading || plansLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="p-6">
          <Skeleton className="h-10 w-64 mb-6" />
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Skeleton className="h-96" />
            <Skeleton className="h-96" />
            <Skeleton className="h-96" />
          </div>
        </div>
      </div>
    );
  }

  const formatPrice = (euros: number) => euros.toFixed(2).replace(".", ",");
  const formatDate = (date: string) => new Date(date).toLocaleDateString("fr-FR");

  const getCurrentPlanName = () => {
    if (billingInfo?.plan) return billingInfo.plan.name;
    if (billing?.subscriptionPlanId) {
      const currentPlan = plans?.find(p => p.id === billing.subscriptionPlanId);
      if (currentPlan) return currentPlan.name;
    }
    if (billing?.subscriptionPlan === "FREE_TRIAL") return "Essai gratuit";
    return billing?.subscriptionPlan || "Aucun";
  };

  const getBillingStatusBadge = () => {
    switch (billing?.billingStatus) {
      case "TRIAL":
        return <Badge variant="secondary" data-testid="badge-billing-trial">Essai gratuit</Badge>;
      case "ACTIVE":
        return <Badge className="bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20" data-testid="badge-billing-active">Actif</Badge>;
      case "SUSPENDED":
        return <Badge variant="destructive" data-testid="badge-billing-suspended">Suspendu</Badge>;
      case "CANCELLED":
        return <Badge variant="outline" data-testid="badge-billing-cancelled">Annule</Badge>;
      default:
        return null;
    }
  };

  const trialDaysLeft = billing?.trialEndsAt 
    ? Math.max(0, Math.ceil((new Date(billing.trialEndsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : 0;

  const openAddonChangeDialog = (addon: AddonWithPricing) => {
    setSelectedAddon(addon);
    setNewAddonQuantity(addon.quantity);
    setAddonPreview(null);
    setApplyImmediate(false);
    setChangeAddonOpen(true);
  };

  const openAddAddonDialog = (addon: AvailableAddon) => {
    setSelectedAvailableAddon(addon);
    setNewAddonQuantity(addon.currentQuantity > 0 ? addon.currentQuantity : 1);
    setAddonPreview(null);
    setApplyImmediate(false);
    setAddAddonOpen(true);
  };

  const handleQuantityChange = (delta: number, addonId: string) => {
    const newQty = Math.max(0, newAddonQuantity + delta);
    setNewAddonQuantity(newQty);
    addonPreviewMutation.mutate({ addonId, newQuantity: newQty });
  };

  const getPaymentMethodLabel = () => {
    if (billingSummary?.preferences?.preferredPaymentMethod === "ADMINISTRATIVE_MANDATE") {
      return "Mandat administratif";
    }
    return "Stripe";
  };

  return (
    <AdminLayout tenant={tenant || null} user={user || null} accountBlocked={user?.accountBlocked} blockReason={user?.blockReason}>
      <div className="p-6">
        <div className="mb-8">
          <h1 className="font-display text-3xl font-bold" data-testid="text-billing-title">
            Facturation
          </h1>
          <p className="text-muted-foreground mt-1">
            Gerez votre abonnement et vos options
          </p>
        </div>

        {success && (
          <Card className="mb-6 border-green-500/20 bg-green-500/5">
            <CardContent className="flex items-center gap-3 py-4">
              <Check className="h-5 w-5 text-green-600" />
              <p className="text-green-600" data-testid="text-payment-success">
                Paiement reussi ! Votre abonnement est maintenant actif.
              </p>
            </CardContent>
          </Card>
        )}

        {canceled && (
          <Card className="mb-6 border-amber-500/20 bg-amber-500/5">
            <CardContent className="flex items-center gap-3 py-4">
              <AlertCircle className="h-5 w-5 text-amber-600" />
              <p className="text-amber-600" data-testid="text-payment-canceled">
                Paiement annule. Vous pouvez reessayer quand vous le souhaitez.
              </p>
            </CardContent>
          </Card>
        )}

        <Tabs defaultValue="current" className="space-y-6">
          <TabsList className="flex-wrap">
            <TabsTrigger value="current" data-testid="tab-current">Abonnement actuel</TabsTrigger>
            <TabsTrigger value="plans" data-testid="tab-plans">Changer de forfait</TabsTrigger>
            <TabsTrigger value="history" data-testid="tab-history">Historique</TabsTrigger>
            <TabsTrigger value="notice" data-testid="tab-notice">Notice</TabsTrigger>
            <TabsTrigger value="informations" data-testid="tab-informations">Informations</TabsTrigger>
            <TabsTrigger value="documents" data-testid="tab-documents">Documents</TabsTrigger>
          </TabsList>

          <TabsContent value="current" className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {/* Hide "Votre forfait" card when mandate subscription is active - info is in mandate card */}
              {!(billingInfo?.preferences?.preferredPaymentMethod === "ADMINISTRATIVE_MANDATE" && activeMandateSubscription?.active) && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CreditCard className="h-5 w-5" />
                    Votre forfait
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {billingLoading || billingInfoLoading ? (
                    <Skeleton className="h-20" />
                  ) : (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between flex-wrap gap-4">
                        <div>
                          <p className="text-sm text-muted-foreground">Plan</p>
                          <p className="font-medium text-lg" data-testid="text-current-plan">
                            {getCurrentPlanName()}
                          </p>
                          {billingInfo?.billingInterval && (
                            <p className="text-sm text-muted-foreground">
                              Facturation {billingInfo.billingInterval === "MONTHLY" ? "mensuelle" : "annuelle"}
                            </p>
                          )}
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Statut</p>
                          {getBillingStatusBadge()}
                        </div>
                      </div>

                      {billing?.billingStatus === "TRIAL" && trialDaysLeft > 0 && (
                        <div className="flex items-center gap-2 text-amber-600 bg-amber-500/10 p-3 rounded-lg">
                          <Clock className="h-4 w-4" />
                          <span>{trialDaysLeft} jours restants dans votre essai gratuit</span>
                        </div>
                      )}

                      {(billingInfo?.plan || billingSummary?.plan) && (
                        <div className="pt-4 border-t">
                          <p className="text-sm font-medium mb-2">Prix actuel</p>
                          {/* For mandate tenants, use billingSummary which has correct annual pricing */}
                          {billingSummary?.billingInterval === "YEARLY" ? (
                            <div className="space-y-1">
                              <p className="text-2xl font-bold">
                                {formatPrice(billingSummary.planCost)} EUR
                                <span className="text-sm font-normal text-muted-foreground">/an</span>
                              </p>
                              {billingSummary.addonsTotalCost > 0 && (
                                <p className="text-lg font-medium text-muted-foreground">
                                  + {formatPrice(billingSummary.addonsTotalCost)} EUR/an (options)
                                </p>
                              )}
                              {billing?.billingStatus === "TRIAL" && (
                                <span className="block text-sm font-normal text-amber-600 mt-1">
                                  (periode d'essai en cours)
                                </span>
                              )}
                            </div>
                          ) : (
                            <p className="text-2xl font-bold">
                              {formatPrice(billingInfo?.plan?.monthlyPrice || billingSummary?.planCost || 0)} EUR
                              <span className="text-sm font-normal text-muted-foreground">/mois</span>
                              {billing?.billingStatus === "TRIAL" && (
                                <span className="block text-sm font-normal text-amber-600 mt-1">
                                  (mois de periode gratuite en cours)
                                </span>
                              )}
                            </p>
                          )}
                        </div>
                      )}

                      <div className="flex gap-2 flex-wrap pt-2">
                        {billing?.hasStripeCustomer && (
                          <Button 
                            variant="outline" 
                            onClick={() => portalMutation.mutate()}
                            disabled={portalMutation.isPending}
                            data-testid="button-billing-portal"
                          >
                            {portalMutation.isPending ? "Chargement..." : "Portail Stripe"}
                            <ExternalLink className="h-4 w-4 ml-2" />
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
              )}

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Wallet className="h-5 w-5" />
                    Solde de credits
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {billingInfoLoading ? (
                    <Skeleton className="h-16" />
                  ) : (
                    <div>
                      <p className={`text-3xl font-bold ${(billingInfo?.ledgerBalance || 0) >= 0 ? "text-green-600" : "text-red-600"}`}>
                        {(billingInfo?.ledgerBalance || 0) >= 0 ? "+" : ""}{formatPrice(billingInfo?.ledgerBalance || 0)} EUR
                      </p>
                      <p className="text-sm text-muted-foreground mt-1">
                        {(billingInfo?.ledgerBalance || 0) >= 0 
                          ? "Credit a deduire de votre prochaine facture"
                          : "Montant a payer sur votre prochaine facture"}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CreditCard className="h-5 w-5" />
                    Mode de paiement
                  </CardTitle>
                  <CardDescription>
                    Choisissez comment vous souhaitez regler vos factures
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div 
                      className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                        (billingSummary?.preferences?.preferredPaymentMethod || "STRIPE") === "STRIPE"
                          ? "border-primary bg-primary/5"
                          : "border-border hover-elevate"
                      }`}
                      onClick={() => updatePreferencesMutation.mutate({ preferredPaymentMethod: "STRIPE" })}
                      data-testid="option-payment-stripe"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                          (billingSummary?.preferences?.preferredPaymentMethod || "STRIPE") === "STRIPE"
                            ? "border-primary"
                            : "border-muted-foreground"
                        }`}>
                          {(billingSummary?.preferences?.preferredPaymentMethod || "STRIPE") === "STRIPE" && (
                            <div className="w-2 h-2 rounded-full bg-primary" />
                          )}
                        </div>
                        <div>
                          <p className="font-medium">Carte bancaire (Stripe)</p>
                          <p className="text-xs text-muted-foreground">Paiement automatique par carte</p>
                        </div>
                      </div>
                    </div>

                    <div 
                      className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                        billingSummary?.preferences?.preferredPaymentMethod === "ADMINISTRATIVE_MANDATE"
                          ? "border-primary bg-primary/5"
                          : "border-border hover-elevate"
                      }`}
                      onClick={() => updatePreferencesMutation.mutate({ preferredPaymentMethod: "ADMINISTRATIVE_MANDATE" })}
                      data-testid="option-payment-mandate"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                          billingSummary?.preferences?.preferredPaymentMethod === "ADMINISTRATIVE_MANDATE"
                            ? "border-primary"
                            : "border-muted-foreground"
                        }`}>
                          {billingSummary?.preferences?.preferredPaymentMethod === "ADMINISTRATIVE_MANDATE" && (
                            <div className="w-2 h-2 rounded-full bg-primary" />
                          )}
                        </div>
                        <div>
                          <p className="font-medium">Mandat administratif</p>
                          <p className="text-xs text-muted-foreground">Devis + bon de commande + virement</p>
                        </div>
                      </div>
                    </div>

                    {updatePreferencesMutation.isPending && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Mise a jour...
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            {billingInfo?.preferences?.preferredPaymentMethod === "ADMINISTRATIVE_MANDATE" && activeMandateSubscription?.active && (
              <Card data-testid="card-mandate-subscription">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Building2 className="h-5 w-5" />
                    Abonnement Mandat Administratif
                  </CardTitle>
                  <CardDescription>
                    Details de votre abonnement actif via mandat administratif
                    <br />
                    <span className="text-xs italic">TVA non applicable - auto-entrepreneur (art. 293 B du CGI)</span>
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {activeMandateSubLoading ? (
                    <Skeleton className="h-32" />
                  ) : (
                    <div className="space-y-4">
                      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        <div className="p-3 rounded-lg bg-muted/50">
                          <p className="text-sm text-muted-foreground">Forfait</p>
                          <p className="font-medium text-lg" data-testid="text-mandate-plan-name">
                            {activeMandateSubscription.plan?.name || "N/A"}
                          </p>
                          {activeMandateSubscription.plan?.yearlyPrice && (
                            <p className="text-sm text-muted-foreground">
                              {formatPrice(activeMandateSubscription.plan.yearlyPrice)} EUR HT/an
                            </p>
                          )}
                        </div>
                        <div className="p-3 rounded-lg bg-muted/50">
                          <p className="text-sm text-muted-foreground">Statut</p>
                          <Badge 
                            variant={activeMandateSubscription.subscription?.status === "ACTIVE" ? "default" : "secondary"}
                            className={activeMandateSubscription.subscription?.status === "ACTIVE" ? "bg-green-600" : ""}
                            data-testid="badge-mandate-status"
                          >
                            {activeMandateSubscription.subscription?.status === "ACTIVE" ? "Actif" :
                             activeMandateSubscription.subscription?.status === "PENDING_ACTIVATION" ? "En attente" :
                             activeMandateSubscription.subscription?.status === "GRACE_PERIOD" ? "Periode de grace" :
                             activeMandateSubscription.subscription?.status}
                          </Badge>
                        </div>
                        <div className="p-3 rounded-lg bg-muted/50">
                          <p className="text-sm text-muted-foreground">Date de debut</p>
                          <p className="font-medium" data-testid="text-mandate-start-date">
                            {activeMandateSubscription.subscription?.startDate 
                              ? new Date(activeMandateSubscription.subscription.startDate).toLocaleDateString('fr-FR')
                              : "N/A"}
                          </p>
                        </div>
                        <div className="p-3 rounded-lg bg-muted/50">
                          <p className="text-sm text-muted-foreground">Date de fin</p>
                          <p className="font-medium" data-testid="text-mandate-end-date">
                            {activeMandateSubscription.subscription?.endDate 
                              ? new Date(activeMandateSubscription.subscription.endDate).toLocaleDateString('fr-FR')
                              : "N/A"}
                          </p>
                        </div>
                      </div>

                      {activeMandateSubscription.addons && activeMandateSubscription.addons.length > 0 && (
                        <div className="pt-4 border-t">
                          <p className="text-sm font-medium mb-3">Options souscrites</p>
                          <div className="grid gap-2 sm:grid-cols-2">
                            {activeMandateSubscription.addons.map((addon, idx) => (
                              <div 
                                key={addon.id || idx}
                                className="flex items-center justify-between gap-2 p-3 rounded-lg bg-muted/30"
                                data-testid={`mandate-addon-${idx}`}
                              >
                                <div className="flex items-center gap-2">
                                  <Package className="h-4 w-4 text-muted-foreground" />
                                  <span className="font-medium">{addon.name}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Badge variant="outline">{addon.quantity}</Badge>
                                  <span className="text-sm text-muted-foreground">
                                    {formatPrice(addon.totalPrice || addon.unitPrice * addon.quantity)} EUR HT
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {activeMandateSubscription.latestInvoice && (
                        <div className="pt-4 border-t">
                          <p className="text-sm font-medium mb-2">Derniere facture</p>
                          <div className="flex items-center justify-between gap-4 flex-wrap p-3 rounded-lg bg-muted/30">
                            <div className="flex items-center gap-3">
                              <FileText className="h-5 w-5 text-muted-foreground" />
                              <div>
                                <p className="font-medium">{activeMandateSubscription.latestInvoice.invoiceNumber}</p>
                                <p className="text-sm text-muted-foreground">
                                  {formatPrice(activeMandateSubscription.latestInvoice.totalAmount)} EUR HT
                                </p>
                              </div>
                            </div>
                            <Badge 
                              variant={activeMandateSubscription.latestInvoice.status === "PAID" ? "default" : "secondary"}
                              className={activeMandateSubscription.latestInvoice.status === "PAID" ? "bg-green-600" : ""}
                            >
                              {activeMandateSubscription.latestInvoice.status === "PAID" ? "Payee" :
                               activeMandateSubscription.latestInvoice.status === "SENT" ? "Envoyee" :
                               activeMandateSubscription.latestInvoice.status === "MANDATED" ? "Mandatee" :
                               activeMandateSubscription.latestInvoice.status}
                            </Badge>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Hide "Vos options" card when mandate subscription is active - options are shown in mandate card */}
            {!(billingInfo?.preferences?.preferredPaymentMethod === "ADMINISTRATIVE_MANDATE" && activeMandateSubscription?.active) && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-4 flex-wrap">
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  Vos options
                </CardTitle>
                <div className="flex items-center gap-2 flex-wrap">
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => setOptionsHelpOpen(!optionsHelpOpen)}
                    className="text-muted-foreground"
                    data-testid="button-options-help"
                  >
                    <HelpCircle className="h-4 w-4 mr-1" />
                    Aide
                    {optionsHelpOpen ? <ChevronUp className="h-4 w-4 ml-1" /> : <ChevronDown className="h-4 w-4 ml-1" />}
                  </Button>
                  {billingSummary?.availableAddons && billingSummary.availableAddons.filter(a => a.currentQuantity === 0).length > 0 && (
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => {
                        const firstAvailable = billingSummary.availableAddons.find(a => a.currentQuantity === 0);
                        if (firstAvailable) openAddAddonDialog(firstAvailable);
                      }}
                      data-testid="button-add-addon"
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Ajouter une option
                    </Button>
                  )}
                </div>
              </CardHeader>
              
              {/* Options help notice */}
              <Collapsible open={optionsHelpOpen} onOpenChange={setOptionsHelpOpen}>
                <CollapsibleContent className="px-6 pb-4">
                  <Alert className="bg-blue-500/5 border-blue-500/20">
                    <Info className="h-4 w-4 text-blue-600" />
                    <AlertDescription className="text-sm space-y-3 mt-2">
                      <p className="font-medium text-foreground">Comment modifier vos options ?</p>
                      <div className="space-y-2 text-muted-foreground">
                        <p>
                          Cliquez sur <strong className="text-foreground">Modifier</strong> pour ajuster la quantite d'une option. 
                          Un apercu du cout s'affiche avant validation.
                        </p>
                        <p className="font-medium text-foreground mt-3">Deux modes d'application :</p>
                        <ul className="list-disc list-inside space-y-1 ml-2">
                          <li>
                            <strong className="text-foreground">Appliquer</strong> : Le changement est effectif immediatement. 
                            Un prorata est calcule pour la periode restante du mois en cours.
                          </li>
                          <li>
                            <strong className="text-foreground">Programmer</strong> : Le changement sera applique automatiquement 
                            le 1er du mois suivant, sans prorata supplementaire.
                          </li>
                        </ul>
                        <p className="font-medium text-foreground mt-3">Calcul du prorata :</p>
                        <ul className="list-disc list-inside space-y-1 ml-2">
                          <li>
                            <strong className="text-foreground">Abonnement mensuel</strong> : Prorata calcule sur les jours restants du mois en cours.
                          </li>
                          <li>
                            <strong className="text-foreground">Abonnement annuel</strong> : Prorata calcule sur les jours restants jusqu'a la date de renouvellement.
                          </li>
                          <li>
                            <span className="text-red-600">Augmentation (+)</span> : Montant a payer pour la periode restante.
                          </li>
                          <li>
                            <span className="text-green-600">Reduction (-)</span> : Credit deduit de la prochaine facture.
                          </li>
                        </ul>
                      </div>
                    </AlertDescription>
                  </Alert>
                </CollapsibleContent>
              </Collapsible>

              <CardContent>
                {billingSummaryLoading ? (
                  <Skeleton className="h-32" />
                ) : (
                  <div className="space-y-6">
                    {/* Options incluses dans le forfait */}
                    {billingSummary?.planIncludedAddons && billingSummary.planIncludedAddons.length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                          <Check className="h-4 w-4 text-green-600" />
                          Inclus dans votre forfait
                        </h4>
                        <div className="grid gap-2 sm:grid-cols-2">
                          {billingSummary.planIncludedAddons.map((addon) => (
                            <div 
                              key={addon.id} 
                              className="flex items-center justify-between gap-2 p-3 rounded-lg bg-green-500/5 border border-green-500/20"
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <Check className="h-4 w-4 text-green-600 shrink-0" />
                                <div className="min-w-0">
                                  <p className="font-medium truncate">{addon.name}</p>
                                  {addon.description && (
                                    <p className="text-xs text-muted-foreground truncate">{addon.description}</p>
                                  )}
                                </div>
                              </div>
                              {addon.quantity > 0 && (
                                <Badge variant="secondary" className="shrink-0">
                                  {addon.quantity}
                                </Badge>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Options souscrites separement */}
                    {billingSummary?.addons && billingSummary.addons.length > 0 ? (
                      <>
                        {billingSummary.planIncludedAddons && billingSummary.planIncludedAddons.length > 0 && (
                          <h4 className="text-sm font-medium text-muted-foreground">Options supplementaires</h4>
                        )}
                        <div className="overflow-x-auto -mx-6 px-6">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="min-w-[150px]">Option</TableHead>
                                <TableHead className="text-center min-w-[140px]">Quantite</TableHead>
                                <TableHead className="text-right min-w-[100px]">Prix unitaire</TableHead>
                                <TableHead className="text-right min-w-[100px]">Sous-total</TableHead>
                                <TableHead className="min-w-[80px]"></TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {billingSummary.addons.map((item) => (
                                <TableRow key={item.addon.id}>
                                  <TableCell>
                                    <div>
                                      <p className="font-medium">{item.addon.name}</p>
                                      {item.addon.description && (
                                        <p className="text-sm text-muted-foreground line-clamp-1">{item.addon.description}</p>
                                      )}
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-center">
                                    <div className="flex items-center justify-center gap-1">
                                      <Button
                                        variant="outline"
                                        size="icon"
                                        onClick={() => {
                                          setSelectedAddon(item);
                                          setNewAddonQuantity(item.quantity - 1);
                                          addonPreviewMutation.mutate({ addonId: item.addonId, newQuantity: item.quantity - 1 });
                                          setChangeAddonOpen(true);
                                        }}
                                        disabled={item.quantity <= 0}
                                        data-testid={`button-decrease-${item.addon.id}`}
                                      >
                                        <Minus className="h-4 w-4" />
                                      </Button>
                                      <Badge variant="secondary" className="min-w-[2rem] justify-center">{item.quantity}</Badge>
                                      <Button
                                        variant="outline"
                                        size="icon"
                                        onClick={() => {
                                          setSelectedAddon(item);
                                          setNewAddonQuantity(item.quantity + 1);
                                          addonPreviewMutation.mutate({ addonId: item.addonId, newQuantity: item.quantity + 1 });
                                          setChangeAddonOpen(true);
                                        }}
                                        data-testid={`button-increase-${item.addon.id}`}
                                      >
                                        <Plus className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-right whitespace-nowrap">
                                    {formatPrice(item.effectiveUnitPrice)} EUR
                                  </TableCell>
                                  <TableCell className="text-right font-medium whitespace-nowrap">
                                    {formatPrice(item.subtotal)} EUR
                                  </TableCell>
                                  <TableCell>
                                    <Button 
                                      variant="ghost" 
                                      size="sm"
                                      onClick={() => openAddonChangeDialog(item)}
                                      data-testid={`button-change-addon-${item.addon.id}`}
                                    >
                                      Modifier
                                    </Button>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                        <div className="pt-4 border-t flex items-center justify-between flex-wrap gap-2">
                          <span className="text-sm text-muted-foreground">Total options</span>
                          <span className="font-medium">{formatPrice(billingSummary.addonsTotalCost)} EUR/{billingSummary.billingInterval === "YEARLY" ? "an" : "mois"}</span>
                        </div>
                      </>
                    ) : !billingSummary?.planIncludedAddons?.length ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <p>Aucune option souscrite</p>
                        {billingSummary?.availableAddons && billingSummary.availableAddons.length > 0 && (
                          <p className="text-sm mt-2">
                            {billingSummary.availableAddons.length} option(s) disponible(s) pour votre forfait
                          </p>
                        )}
                      </div>
                    ) : null}
                  </div>
                )}
              </CardContent>
            </Card>
            )}

            {billingSummary && (
              <Card className="bg-primary/5 border-primary/20">
                <CardContent className="py-6">
                  <div className="flex items-center justify-between flex-wrap gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Total abonnement</p>
                      <p className="text-sm text-muted-foreground">
                        Forfait ({formatPrice(billingSummary.planCost)} EUR) + Options ({formatPrice(billingSummary.addonsTotalCost)} EUR)
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-3xl font-bold">{formatPrice(billingSummary.totalCost)} EUR</p>
                      <p className="text-sm text-muted-foreground">
                        /{billingSummary.billingInterval === "YEARLY" ? "an" : "mois"} - Paiement par {getPaymentMethodLabel()}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {billingSummary?.pendingChanges && billingSummary.pendingChanges.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="h-5 w-5" />
                    Changements programmes
                  </CardTitle>
                  <CardDescription>
                    Modifications en attente qui seront appliquees automatiquement
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {billingSummary.pendingChanges.map((change) => (
                      <div 
                        key={change.id} 
                        className="flex items-center justify-between p-4 bg-muted/50 rounded-lg border"
                        data-testid={`pending-change-${change.id}`}
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant={change.changeType === "PLAN_CHANGE" ? "default" : "secondary"}>
                              {change.changeType === "PLAN_CHANGE" ? "Forfait" : "Option"}
                            </Badge>
                            <Badge variant="outline">
                              {change.paymentMethod === "STRIPE" ? "CB" : "Mandat"}
                            </Badge>
                          </div>
                          
                          {change.changeType === "ADDON_CHANGE" && change.addonName && (
                            <div className="mt-2">
                              <p className="font-medium">{change.addonName}</p>
                              <p className="text-sm text-muted-foreground flex items-center gap-2">
                                <span>{change.fromQuantity || 0} unites</span>
                                <ArrowRight className="h-3 w-3" />
                                <span className="font-medium">{change.toQuantity || 0} unites</span>
                                {change.priceDelta !== null && change.priceDelta !== 0 && (
                                  <span className={change.priceDelta > 0 ? "text-orange-600" : "text-green-600"}>
                                    ({change.priceDelta > 0 ? "+" : ""}{formatPrice(change.priceDelta)} EUR/{billingSummary.billingInterval === "YEARLY" ? "an" : "mois"})
                                  </span>
                                )}
                              </p>
                            </div>
                          )}
                          
                          {change.changeType === "PLAN_CHANGE" && (
                            <div className="mt-2">
                              <p className="text-sm text-muted-foreground flex items-center gap-2">
                                <span>{change.fromPlanName || "Aucun"}</span>
                                <ArrowRight className="h-3 w-3" />
                                <span className="font-medium">{change.toPlanName || "Aucun"}</span>
                              </p>
                              {change.fromBillingInterval !== change.toBillingInterval && (
                                <p className="text-sm text-muted-foreground">
                                  Facturation: {change.fromBillingInterval === "YEARLY" ? "Annuelle" : "Mensuelle"} → {change.toBillingInterval === "YEARLY" ? "Annuelle" : "Mensuelle"}
                                </p>
                              )}
                            </div>
                          )}
                          
                          <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              Effectif le {formatDate(change.effectiveDate as unknown as string)}
                            </span>
                          </div>
                          
                          {(change.prorataCredit || change.prorataDebit) && (
                            <p className="text-sm mt-1">
                              {change.prorataCredit && change.prorataCredit > 0 && (
                                <span className="text-green-600">Credit: +{formatPrice(change.prorataCredit)} EUR</span>
                              )}
                              {change.prorataDebit && change.prorataDebit > 0 && (
                                <span className="text-red-600 ml-2">Debit: -{formatPrice(change.prorataDebit)} EUR</span>
                              )}
                            </p>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => cancelChangeMutation.mutate(change.id)}
                          disabled={cancelChangeMutation.isPending}
                          data-testid={`button-cancel-change-${change.id}`}
                        >
                          {cancelChangeMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
                        </Button>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Cancellation Request Card */}
            {billing?.billingStatus !== "CANCELLED" && (
              <Card className="border-destructive/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-destructive">
                    <XCircle className="h-5 w-5" />
                    Annuler mon abonnement
                  </CardTitle>
                  <CardDescription>
                    Si vous souhaitez mettre fin a votre abonnement, vous pouvez envoyer une demande a notre equipe.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4">
                    Notre equipe examinera votre demande et vous contactera pour confirmer l'annulation.
                    Veuillez noter que l'annulation prendra effet selon les conditions de votre contrat.
                  </p>
                  <Button 
                    variant="outline" 
                    className="text-destructive border-destructive/50 hover:bg-destructive/10"
                    onClick={() => setCancelRequestOpen(true)}
                    data-testid="button-request-cancellation"
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    Demander l'annulation
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="plans">
            <h2 className="text-xl font-semibold mb-4">Choisir un forfait</h2>
            
            {!plans?.length ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <Package className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                  <p className="text-muted-foreground">Aucun forfait disponible pour le moment.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {plans.filter(p => !p.isFree).map((plan) => (
                  <Card 
                    key={plan.id} 
                    className={plan.isBestValue ? "border-primary relative" : ""}
                    data-testid={`card-plan-${plan.id}`}
                  >
                    {plan.isBestValue && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                        <Badge className="bg-primary text-primary-foreground">Meilleur choix</Badge>
                      </div>
                    )}
                    {plan.hasPromo && plan.promoPercent && plan.promoPercent > 0 && (
                      <div className="absolute -top-3 right-4">
                        <Badge variant="destructive">-{plan.promoPercent}%</Badge>
                      </div>
                    )}
                    <CardHeader>
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                          <Package className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <CardTitle>{plan.name}</CardTitle>
                          <CardDescription>{plan.description}</CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="mb-4">
                        <span className="text-3xl font-bold">{formatPrice(plan.monthlyPrice || 0)}</span>
                        <span className="text-muted-foreground"> EUR/mois</span>
                        <p className="text-sm text-muted-foreground">
                          ou {formatPrice(plan.yearlyPrice || 0)} EUR/an
                        </p>
                      </div>
                      <ul className="space-y-2">
                        {plan.catalogFeatures?.map((cf) => (
                          <li key={cf.featureId} className="flex items-center gap-2">
                            <Check className="h-4 w-4 text-green-600" />
                            <span className="text-sm">{cf.feature.name}</span>
                          </li>
                        ))}
                        {(!plan.catalogFeatures || plan.catalogFeatures.length === 0) && (
                          <>
                            {plan.hasIdeas && (
                              <li className="flex items-center gap-2">
                                <Check className="h-4 w-4 text-green-600" />
                                <span className="text-sm">Boite a idees</span>
                              </li>
                            )}
                            {plan.hasIncidents && (
                              <li className="flex items-center gap-2">
                                <Check className="h-4 w-4 text-green-600" />
                                <span className="text-sm">Signalements</span>
                              </li>
                            )}
                            {plan.hasMeetings && (
                              <li className="flex items-center gap-2">
                                <Check className="h-4 w-4 text-green-600" />
                                <span className="text-sm">Reunions publiques</span>
                              </li>
                            )}
                          </>
                        )}
                      </ul>
                    </CardContent>
                    <CardFooter className="flex flex-col gap-2">
                      {billing?.subscriptionPlanId === plan.id ? (
                        <Badge variant="secondary" className="w-full justify-center py-2">Plan actuel</Badge>
                      ) : stripeModeLoading ? (
                        <div className="w-full text-center text-sm text-muted-foreground">Chargement...</div>
                      ) : (() => {
                        const hasMonthlyPrice = stripeMode === 'live' 
                          ? !!plan.stripePriceIdMonthlyLive 
                          : !!plan.stripePriceIdMonthlyTest;
                        const hasYearlyPrice = stripeMode === 'live' 
                          ? !!plan.stripePriceIdYearlyLive 
                          : !!plan.stripePriceIdYearlyTest;
                        
                        if (!hasMonthlyPrice && !hasYearlyPrice) {
                          return (
                            <div className="w-full">
                              <Button
                                variant="outline"
                                className="w-full mb-2"
                                onClick={() => {
                                  setSelectedPlanId(plan.id);
                                  setSelectedInterval("MONTHLY");
                                  setChangePlanOpen(true);
                                }}
                                data-testid={`button-schedule-plan-${plan.id}`}
                              >
                                Programmer le changement
                              </Button>
                              <p className="text-xs text-muted-foreground text-center">
                                Facturation par mandat administratif
                              </p>
                            </div>
                          );
                        }
                        
                        return (
                          <div className="flex gap-2 flex-wrap w-full">
                            {hasMonthlyPrice && (
                              <Button
                                onClick={() => checkoutMutation.mutate({ planId: plan.id, interval: 'monthly' })}
                                disabled={checkoutMutation.isPending}
                                variant={plan.isBestValue ? "default" : "outline"}
                                className="flex-1"
                                data-testid={`button-subscribe-${plan.id}-monthly`}
                              >
                                {checkoutMutation.isPending ? "Chargement..." : "Mensuel"}
                              </Button>
                            )}
                            {hasYearlyPrice && (
                              <Button
                                onClick={() => checkoutMutation.mutate({ planId: plan.id, interval: 'yearly' })}
                                disabled={checkoutMutation.isPending}
                                variant="secondary"
                                className="flex-1"
                                data-testid={`button-subscribe-${plan.id}-yearly`}
                              >
                                {checkoutMutation.isPending ? "Chargement..." : "Annuel"}
                              </Button>
                            )}
                          </div>
                        );
                      })()}
                    </CardFooter>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="history">
            <Card>
              <CardHeader>
                <CardTitle>Historique de facturation</CardTitle>
                <CardDescription>Historique complet des operations et modifications de votre abonnement</CardDescription>
              </CardHeader>
              <CardContent>
                {historyLoading ? (
                  <div className="space-y-3">
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                  </div>
                ) : !billingHistory?.length ? (
                  <p className="text-muted-foreground text-center py-8">Aucune operation pour le moment.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Statut</TableHead>
                        <TableHead className="text-right">Montant</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {billingHistory.map((event) => (
                        <TableRow key={`${event.type}-${event.id}`} data-testid={`history-row-${event.id}`}>
                          <TableCell className="whitespace-nowrap">
                            {formatDate(event.date)}
                          </TableCell>
                          <TableCell>
                            {event.type === 'ledger' ? (
                              <Badge variant={event.eventType === 'CREDIT' ? 'default' : 'secondary'}>
                                {event.eventType === 'CREDIT' ? 'Credit' : 'Debit'}
                              </Badge>
                            ) : (
                              <Badge variant="outline">
                                {event.eventType === 'ADDON_CHANGE' ? 'Option' : 'Forfait'}
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>{event.description}</TableCell>
                          <TableCell>
                            {event.status && (
                              <Badge variant={
                                event.status === 'APPLIED' ? 'default' :
                                event.status === 'PENDING' ? 'secondary' :
                                event.status === 'CANCELLED' ? 'destructive' : 'outline'
                              }>
                                {event.status === 'APPLIED' ? 'Applique' :
                                 event.status === 'PENDING' ? 'En attente' :
                                 event.status === 'CANCELLED' ? 'Annule' : event.status}
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {event.type === 'ledger' && event.amount !== undefined ? (
                              <span className={`font-medium ${event.eventType === 'CREDIT' ? 'text-green-600' : 'text-red-600'}`}>
                                {event.eventType === 'CREDIT' ? '+' : '-'}{formatPrice(event.amount)} EUR
                              </span>
                            ) : event.type === 'change' ? (
                              <div className="space-y-1">
                                {event.recurringDelta !== undefined && event.recurringDelta !== 0 && (
                                  <div className={`font-medium ${event.recurringDelta > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                                    {event.recurringDelta > 0 ? '+' : ''}{formatPrice(event.recurringDelta)} EUR/mois
                                  </div>
                                )}
                                {(event.prorataCredit !== undefined && event.prorataCredit > 0) && (
                                  <div className="text-sm text-green-600">
                                    Prorata: +{formatPrice(event.prorataCredit)} EUR
                                  </div>
                                )}
                                {(event.prorataDebit !== undefined && event.prorataDebit > 0) && (
                                  <div className="text-sm text-red-600">
                                    Prorata: -{formatPrice(event.prorataDebit)} EUR
                                  </div>
                                )}
                                {(!event.recurringDelta || event.recurringDelta === 0) && 
                                 (!event.prorataCredit || event.prorataCredit === 0) && 
                                 (!event.prorataDebit || event.prorataDebit === 0) && '-'}
                              </div>
                            ) : '-'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="notice">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  {billingInfo?.preferences?.preferredPaymentMethod === "ADMINISTRATIVE_MANDATE" 
                    ? "Comment payer par mandat administratif" 
                    : "Comment payer par carte bancaire"}
                </CardTitle>
                <CardDescription>
                  Guide etape par etape pour finaliser votre abonnement
                </CardDescription>
              </CardHeader>
              <CardContent>
                {/* Mandatory step notice - visible for both payment methods */}
                <Alert className="mb-6 border-2 border-orange-500 bg-orange-50 dark:bg-orange-950/30">
                  <AlertTriangle className="h-5 w-5 text-orange-600" />
                  <AlertTitle className="text-orange-800 dark:text-orange-300 font-semibold">
                    Etape prealable obligatoire
                  </AlertTitle>
                  <AlertDescription className="text-orange-700 dark:text-orange-400">
                    <p className="mt-2">
                      <strong>Avant toute commande</strong>, vous devez renseigner vos informations de facturation dans l'onglet <strong>"Informations"</strong>.
                    </p>
                    <ul className="list-disc list-inside mt-2 space-y-1 text-sm">
                      <li>Adresse complete de votre entite</li>
                      <li>Service en charge de la commande</li>
                      <li>Contact comptabilite (nom, email, telephone)</li>
                      <li>Numero SIRET (pour les collectivites)</li>
                    </ul>
                    <p className="mt-2 text-sm font-medium">
                      Ces informations sont indispensables pour generer des documents conformes (bons de commande, factures).
                    </p>
                  </AlertDescription>
                </Alert>

                {billingInfo?.preferences?.preferredPaymentMethod === "ADMINISTRATIVE_MANDATE" ? (
                  <div className="space-y-6">
                    <div className="bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800 rounded-lg p-4">
                      <h3 className="font-semibold text-purple-800 dark:text-purple-300 mb-2">
                        Paiement par mandat administratif
                      </h3>
                      <p className="text-sm text-purple-700 dark:text-purple-400">
                        Ce mode de paiement est reserve aux collectivites territoriales et etablissements publics francais.
                      </p>
                    </div>

                    <div className="space-y-4">
                      <div className="flex gap-4">
                        <div className="flex-shrink-0 w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-bold">1</div>
                        <div>
                          <h4 className="font-medium">Validation de votre commande</h4>
                          <p className="text-sm text-muted-foreground mt-1">
                            Apres votre inscription, un bon de commande est automatiquement genere. Notre equipe le valide sous 24 a 48h ouvrees.
                          </p>
                        </div>
                      </div>

                      <div className="flex gap-4">
                        <div className="flex-shrink-0 w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-bold">2</div>
                        <div>
                          <h4 className="font-medium">Emission du bon de commande</h4>
                          <p className="text-sm text-muted-foreground mt-1">
                            Une fois valide, vous recevez par email le bon de commande officiel a faire signer par votre ordonnateur.
                          </p>
                        </div>
                      </div>

                      <div className="flex gap-4">
                        <div className="flex-shrink-0 w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-bold">3</div>
                        <div>
                          <h4 className="font-medium">Retour du bon de commande signe</h4>
                          <p className="text-sm text-muted-foreground mt-1">
                            Vous nous retournez le bon de commande signe par email ou via l'onglet "Documents". Vous pouvez egalement renseigner vos references internes (numero d'engagement, code service, etc.).
                          </p>
                        </div>
                      </div>

                      <div className="flex gap-4">
                        <div className="flex-shrink-0 w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-bold">4</div>
                        <div>
                          <h4 className="font-medium">Activation de votre abonnement</h4>
                          <p className="text-sm text-muted-foreground mt-1">
                            Des reception du bon de commande signe, votre abonnement est active et la facture est emise.
                          </p>
                        </div>
                      </div>

                      <div className="flex gap-4">
                        <div className="flex-shrink-0 w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-bold">5</div>
                        <div>
                          <h4 className="font-medium">Paiement sous 30 jours</h4>
                          <p className="text-sm text-muted-foreground mt-1">
                            La facture est payable sous 30 jours par virement ou via Chorus Pro pour les entites concernees.
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-4 mt-6">
                      <h4 className="font-medium text-amber-800 dark:text-amber-300 mb-2 flex items-center gap-2">
                        <Info className="h-4 w-4" />
                        Chorus Pro
                      </h4>
                      <p className="text-sm text-amber-700 dark:text-amber-400">
                        L'integration Chorus Pro n'est pas encore activee. Cependant, l'ensemble de nos documents (bons de commande, factures) sont <strong>compatibles Chorus Pro</strong>. 
                        Des reception de notre bon de commande, vous pourrez renseigner dans l'onglet "Informations" :
                      </p>
                      <ul className="text-sm text-amber-700 dark:text-amber-400 list-disc list-inside mt-2 space-y-1">
                        <li>Votre numero d'engagement</li>
                        <li>Votre numero de bon de commande interne</li>
                        <li>Votre code service</li>
                      </ul>
                    </div>

                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                      <h3 className="font-semibold text-blue-800 dark:text-blue-300 mb-2">
                        Paiement par carte bancaire (Stripe)
                      </h3>
                      <p className="text-sm text-blue-700 dark:text-blue-400">
                        Paiement securise et instantane via notre partenaire Stripe.
                      </p>
                    </div>

                    <div className="space-y-4">
                      <div className="flex gap-4">
                        <div className="flex-shrink-0 w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-bold">1</div>
                        <div>
                          <h4 className="font-medium">Choisissez votre forfait</h4>
                          <p className="text-sm text-muted-foreground mt-1">
                            Rendez-vous dans l'onglet "Changer de forfait" pour voir les offres disponibles. Vous pouvez choisir une facturation mensuelle ou annuelle.
                          </p>
                        </div>
                      </div>

                      <div className="flex gap-4">
                        <div className="flex-shrink-0 w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-bold">2</div>
                        <div>
                          <h4 className="font-medium">Cliquez sur "Mensuel" ou "Annuel"</h4>
                          <p className="text-sm text-muted-foreground mt-1">
                            Selectionnez la periodicite souhaitee. L'abonnement annuel vous fait beneficier d'une remise de 2 mois offerts.
                          </p>
                        </div>
                      </div>

                      <div className="flex gap-4">
                        <div className="flex-shrink-0 w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-bold">3</div>
                        <div>
                          <h4 className="font-medium">Paiement securise</h4>
                          <p className="text-sm text-muted-foreground mt-1">
                            Vous etes redirige vers la page de paiement Stripe. Entrez vos informations de carte bancaire en toute securite.
                          </p>
                        </div>
                      </div>

                      <div className="flex gap-4">
                        <div className="flex-shrink-0 w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-bold">4</div>
                        <div>
                          <h4 className="font-medium">Activation immediate</h4>
                          <p className="text-sm text-muted-foreground mt-1">
                            Une fois le paiement confirme, votre abonnement est immediatement active. Vous recevez une confirmation par email.
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="bg-muted/50 rounded-lg p-4 mt-6">
                      <h4 className="font-medium mb-2">Gestion de votre abonnement</h4>
                      <p className="text-sm text-muted-foreground">
                        Apres souscription, vous pourrez acceder au portail Stripe pour modifier votre moyen de paiement, telecharger vos factures ou gerer votre abonnement.
                      </p>
                    </div>

                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="documents">
            <div className="space-y-6">
              {/* Stripe Invoices Section - only for Stripe payment method */}
              {billingInfo?.preferences?.preferredPaymentMethod === "STRIPE" && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <FileText className="h-5 w-5" />
                      Factures
                      <Badge variant="secondary" className="bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">Stripe</Badge>
                    </CardTitle>
                    <CardDescription>
                      Vos factures generees suite aux paiements par carte bancaire
                      <br />
                      <span className="text-xs italic">TVA non applicable - auto-entrepreneur (art. 293 B du CGI)</span>
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {stripeInvoicesLoading ? (
                      <div className="space-y-3">
                        <Skeleton className="h-12 w-full" />
                        <Skeleton className="h-12 w-full" />
                      </div>
                    ) : !stripeInvoices?.length ? (
                      <p className="text-muted-foreground text-center py-8">Aucune facture pour le moment.</p>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Numero</TableHead>
                            <TableHead>Date</TableHead>
                            <TableHead>Periode</TableHead>
                            <TableHead>Statut</TableHead>
                            <TableHead className="text-right">Montant</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {stripeInvoices.map((invoice) => (
                            <TableRow key={invoice.id} data-testid={`stripe-invoice-row-${invoice.id}`}>
                              <TableCell>
                                <p className="font-medium">{invoice.invoice_number || invoice.id.slice(0, 12)}</p>
                              </TableCell>
                              <TableCell>
                                <p className="text-sm">{invoice.created ? formatDate(new Date(invoice.created * 1000).toISOString()) : "-"}</p>
                              </TableCell>
                              <TableCell>
                                <div className="text-sm">
                                  {invoice.period_start && invoice.period_end ? (
                                    <>
                                      <p>{formatDate(new Date(invoice.period_start * 1000).toISOString())}</p>
                                      <p className="text-muted-foreground">au {formatDate(new Date(invoice.period_end * 1000).toISOString())}</p>
                                    </>
                                  ) : "-"}
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge variant={
                                  invoice.status === "paid" ? "default" :
                                  invoice.status === "open" ? "secondary" :
                                  invoice.status === "uncollectible" ? "destructive" : "outline"
                                }>
                                  {invoice.status === "paid" ? "Payee" :
                                   invoice.status === "open" ? "En attente" :
                                   invoice.status === "draft" ? "Brouillon" :
                                   invoice.status === "void" ? "Annulee" :
                                   invoice.status === "uncollectible" ? "Irrecouv." : invoice.status}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right font-medium">
                                {(invoice.total / 100).toLocaleString("fr-FR", { style: "currency", currency: invoice.currency?.toUpperCase() || "EUR" })}
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex gap-2 justify-end">
                                  {invoice.hosted_invoice_url && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => window.open(invoice.hosted_invoice_url!, "_blank")}
                                      data-testid={`button-view-stripe-invoice-${invoice.id}`}
                                    >
                                      <ExternalLink className="h-4 w-4 mr-2" />
                                      Voir
                                    </Button>
                                  )}
                                  {invoice.invoice_pdf && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => window.open(invoice.invoice_pdf!, "_blank")}
                                      data-testid={`button-download-stripe-invoice-${invoice.id}`}
                                    >
                                      <Download className="h-4 w-4 mr-2" />
                                      PDF
                                    </Button>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Mandate Orders and Invoices Section - only for administrative mandate */}
              {billingInfo?.preferences?.preferredPaymentMethod === "ADMINISTRATIVE_MANDATE" && (
                <>
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <FileText className="h-5 w-5" />
                        Commandes
                        <Badge variant="secondary" className="bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300">Mandat</Badge>
                      </CardTitle>
                      <CardDescription>Vos commandes pour le mandat administratif</CardDescription>
                    </CardHeader>
                  <CardContent>
                    {mandateOrdersLoading ? (
                      <div className="space-y-3">
                        <Skeleton className="h-12 w-full" />
                        <Skeleton className="h-12 w-full" />
                      </div>
                    ) : !mandateOrders?.length ? (
                      <p className="text-muted-foreground text-center py-8">Aucune commande pour le moment.</p>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Numero</TableHead>
                            <TableHead>Forfait / Options</TableHead>
                            <TableHead>References BC</TableHead>
                            <TableHead>Statut</TableHead>
                            <TableHead className="text-right">Montant HT</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {mandateOrders.map((order) => {
                            const orderAddons: Array<{name: string; quantity: number; totalPrice: number}> = [];
                            if (order.addonsSnapshot) {
                              try {
                                const parsed = JSON.parse(order.addonsSnapshot);
                                if (Array.isArray(parsed)) orderAddons.push(...parsed);
                              } catch {}
                            }
                            return (
                              <TableRow key={order.id} data-testid={`mandate-order-row-${order.id}`}>
                                <TableCell>
                                  <div className="space-y-1">
                                    <p className="font-medium">{order.orderNumber}</p>
                                    <p className="text-xs text-muted-foreground">{formatDate(new Date(order.createdAt).toISOString())}</p>
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <div className="space-y-1">
                                    <p className="font-medium">{(order as any).planName || "Forfait"}</p>
                                    <p className="text-xs text-muted-foreground">
                                      {order.billingCycle === "MONTHLY" ? "Mensuel" : "Annuel"} - {formatPrice(order.planAmount || 0)} EUR HT
                                    </p>
                                    {orderAddons.length > 0 && (
                                      <div className="flex flex-wrap gap-1 mt-1">
                                        {orderAddons.map((addon, idx) => (
                                          <Badge key={idx} variant="outline" className="text-xs">
                                            {addon.name} x{addon.quantity}
                                          </Badge>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <div className="space-y-0.5 text-xs text-muted-foreground">
                                    {order.purchaseOrderNumber && <p>BC: {order.purchaseOrderNumber}</p>}
                                    {order.engagementNumber && <p>Eng: {order.engagementNumber}</p>}
                                    {order.serviceCode && <p>Code: {order.serviceCode}</p>}
                                    {!order.purchaseOrderNumber && !order.engagementNumber && !order.serviceCode && (
                                      <span className="italic">-</span>
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <Badge variant={
                                    order.status === "ACCEPTED" ? "default" :
                                    order.status === "PENDING_VALIDATION" || order.status === "PENDING_BC" ? "secondary" :
                                    order.status === "INVOICED" ? "outline" : "destructive"
                                  }>
                                    {order.status === "PENDING_VALIDATION" ? "En attente" :
                                     order.status === "PENDING_BC" ? "Attente BC" :
                                     order.status === "ACCEPTED" ? "Accepte" :
                                     order.status === "INVOICED" ? "Facture" :
                                     order.status === "REJECTED" ? "Refuse" : order.status}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-right font-medium">
                                  {order.finalAmount.toLocaleString("fr-FR", { style: "currency", currency: "EUR" })}
                                </TableCell>
                                <TableCell className="text-right">
                                  <div className="flex gap-2 justify-end">
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => openEditOrder(order)}
                                      data-testid={`button-edit-order-${order.id}`}
                                    >
                                      <FileText className="h-4 w-4 mr-2" />
                                      BC
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => downloadPdf(`/api/tenants/${params.slug}/admin/billing/mandate-orders/${order.id}/pdf`, `${order.orderNumber}.pdf`)}
                                      data-testid={`button-download-order-${order.id}`}
                                    >
                                      <Download className="h-4 w-4 mr-2" />
                                      PDF
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

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <FileText className="h-5 w-5" />
                      Factures
                    </CardTitle>
                    <CardDescription>
                      Vos factures pour le mandat administratif
                      <br />
                      <span className="text-xs italic">TVA non applicable - auto-entrepreneur (art. 293 B du CGI)</span>
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {mandateInvoicesLoading ? (
                      <div className="space-y-3">
                        <Skeleton className="h-12 w-full" />
                        <Skeleton className="h-12 w-full" />
                      </div>
                    ) : !mandateInvoices?.length ? (
                      <p className="text-muted-foreground text-center py-8">Aucune facture pour le moment.</p>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Numero</TableHead>
                            <TableHead>Forfait / Options</TableHead>
                            <TableHead>Periode</TableHead>
                            <TableHead>Statut</TableHead>
                            <TableHead className="text-right">Montant HT</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {mandateInvoices.map((invoice) => {
                            const invoiceAddons: Array<{name: string; quantity: number; totalPrice: number}> = [];
                            if (invoice.addonsSnapshot) {
                              try {
                                const parsed = JSON.parse(invoice.addonsSnapshot);
                                if (Array.isArray(parsed)) invoiceAddons.push(...parsed);
                              } catch {}
                            }
                            return (
                              <TableRow key={invoice.id} data-testid={`mandate-invoice-row-${invoice.id}`}>
                                <TableCell>
                                  <div className="space-y-1">
                                    <p className="font-medium">{invoice.invoiceNumber}</p>
                                    <p className="text-xs text-muted-foreground">{formatDate(new Date(invoice.createdAt).toISOString())}</p>
                                    <p className="text-xs text-muted-foreground">Ech. {formatDate(new Date(invoice.dueDate).toISOString())}</p>
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <div className="space-y-1">
                                    <p className="font-medium">{(invoice as any).planName || "Forfait"}</p>
                                    <p className="text-xs text-muted-foreground">
                                      {formatPrice(invoice.planAmount || 0)} EUR HT
                                    </p>
                                    {invoiceAddons.length > 0 && (
                                      <div className="flex flex-wrap gap-1 mt-1">
                                        {invoiceAddons.map((addon, idx) => (
                                          <Badge key={idx} variant="outline" className="text-xs">
                                            {addon.name} x{addon.quantity}
                                          </Badge>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <div className="text-sm">
                                    {invoice.periodStart && invoice.periodEnd ? (
                                      <>
                                        <p>{formatDate(new Date(invoice.periodStart).toISOString())}</p>
                                        <p className="text-muted-foreground">au {formatDate(new Date(invoice.periodEnd).toISOString())}</p>
                                      </>
                                    ) : "-"}
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <Badge variant={
                                    invoice.status === "PAID" ? "default" :
                                    invoice.status === "SENT" ? "secondary" :
                                    invoice.status === "OVERDUE" ? "destructive" : "outline"
                                  }>
                                    {invoice.status === "DRAFT" ? "Brouillon" :
                                     invoice.status === "SENT" ? "Envoyee" :
                                     invoice.status === "PAID" ? "Payee" :
                                     invoice.status === "OVERDUE" ? "En retard" : invoice.status}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-right font-medium">
                                  {invoice.totalAmount.toLocaleString("fr-FR", { style: "currency", currency: "EUR" })}
                                </TableCell>
                                <TableCell className="text-right">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => downloadPdf(`/api/tenants/${params.slug}/admin/billing/mandate-invoices/${invoice.id}/pdf`, `${invoice.invoiceNumber}.pdf`)}
                                    data-testid={`button-download-invoice-${invoice.id}`}
                                  >
                                    <Download className="h-4 w-4 mr-2" />
                                    PDF
                                  </Button>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>
                </>
              )}
            </div>
          </TabsContent>

          <TabsContent value="informations">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  Informations de facturation
                </CardTitle>
                <CardDescription>
                  Renseignez les informations de votre entite. Ces donnees seront utilisees pour generer vos documents de facturation (factures, bons de commande).
                </CardDescription>
              </CardHeader>
              <CardContent>
                {mandateBillingInfoLoading ? (
                  <div className="space-y-4">
                    <Skeleton className="h-20 w-full" />
                    <Skeleton className="h-20 w-full" />
                  </div>
                ) : (
                  <form onSubmit={(e) => { e.preventDefault(); updateMandateBillingMutation.mutate(mandateFormData); }} className="space-y-6">
                    <div className="space-y-4">
                      <h3 className="font-medium text-lg">Adresse de facturation</h3>
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2 md:col-span-2">
                          <Label htmlFor="mandate-billing-address">Adresse complete *</Label>
                          <Textarea
                            id="mandate-billing-address"
                            placeholder="Adresse de facturation de votre organisation..."
                            value={mandateFormData.mandateBillingAddress}
                            onChange={(e) => setMandateFormData(prev => ({ ...prev, mandateBillingAddress: e.target.value }))}
                            data-testid="input-mandate-billing-address"
                            rows={3}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="mandate-billing-service">Service destinataire</Label>
                          <Input
                            id="mandate-billing-service"
                            placeholder="Ex: Direction des Finances"
                            value={mandateFormData.mandateBillingService}
                            onChange={(e) => setMandateFormData(prev => ({ ...prev, mandateBillingService: e.target.value }))}
                            data-testid="input-mandate-billing-service"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4 pt-4 border-t">
                      <h3 className="font-medium text-lg">Contact comptabilite</h3>
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor="mandate-accounting-name">Nom du contact *</Label>
                          <Input
                            id="mandate-accounting-name"
                            placeholder="Nom du responsable comptable"
                            value={mandateFormData.mandateAccountingContactName}
                            onChange={(e) => setMandateFormData(prev => ({ ...prev, mandateAccountingContactName: e.target.value }))}
                            data-testid="input-mandate-accounting-name"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="mandate-accounting-email">Email *</Label>
                          <Input
                            id="mandate-accounting-email"
                            type="email"
                            placeholder="comptabilite@mairie.fr"
                            value={mandateFormData.mandateAccountingContactEmail}
                            onChange={(e) => setMandateFormData(prev => ({ ...prev, mandateAccountingContactEmail: e.target.value }))}
                            data-testid="input-mandate-accounting-email"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="mandate-accounting-phone">Telephone</Label>
                          <Input
                            id="mandate-accounting-phone"
                            placeholder="01 23 45 67 89"
                            value={mandateFormData.mandateAccountingContactPhone}
                            onChange={(e) => setMandateFormData(prev => ({ ...prev, mandateAccountingContactPhone: e.target.value }))}
                            data-testid="input-mandate-accounting-phone"
                          />
                        </div>
                      </div>
                    </div>

                    {billingInfo?.preferences?.preferredPaymentMethod === "ADMINISTRATIVE_MANDATE" && (
                      <div className="space-y-4 pt-4 border-t">
                        <div className="flex items-center justify-between">
                          <div className="space-y-0.5">
                            <h3 className="font-medium text-lg flex items-center gap-2">
                              Chorus Pro
                              <Badge variant="secondary" className="text-xs">Non active</Badge>
                            </h3>
                            <p className="text-sm text-muted-foreground">
                              L'integration automatique Chorus Pro n'est pas encore disponible. Cependant, tous nos documents sont compatibles Chorus Pro.
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="pt-4 flex justify-end">
                      <Button 
                        type="submit" 
                        disabled={updateMandateBillingMutation.isPending}
                        data-testid="button-save-mandate-info"
                      >
                        {updateMandateBillingMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : (
                          <Save className="h-4 w-4 mr-2" />
                        )}
                        Enregistrer les modifications
                      </Button>
                    </div>
                  </form>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <Dialog open={changePlanOpen} onOpenChange={setChangePlanOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Programmer un changement de forfait</DialogTitle>
              <DialogDescription>
                Le changement sera effectif le 1er du mois prochain. Un prorata sera calcule automatiquement.
              </DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-4 py-2">
              <div className="space-y-2">
                <Label>Nouveau forfait</Label>
                <Select value={selectedPlanId} onValueChange={setSelectedPlanId}>
                  <SelectTrigger data-testid="select-new-plan">
                    <SelectValue placeholder="Selectionnez un forfait" />
                  </SelectTrigger>
                  <SelectContent>
                    {plans?.filter(p => !p.isFree && p.id !== billing?.subscriptionPlanId).map((plan) => (
                      <SelectItem key={plan.id} value={plan.id}>
                        {plan.name} - {formatPrice(plan.monthlyPrice || 0)} EUR/mois
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Facturation</Label>
                <Select value={selectedInterval} onValueChange={(v) => setSelectedInterval(v as "MONTHLY" | "YEARLY")}>
                  <SelectTrigger data-testid="select-billing-interval">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MONTHLY">Mensuelle</SelectItem>
                    <SelectItem value="YEARLY">Annuelle</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setChangePlanOpen(false)}>
                Annuler
              </Button>
              <Button 
                onClick={() => changePlanMutation.mutate({ newPlanId: selectedPlanId, newBillingInterval: selectedInterval })}
                disabled={!selectedPlanId || changePlanMutation.isPending}
                data-testid="button-confirm-plan-change"
              >
                {changePlanMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Confirmer
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={changeAddonOpen} onOpenChange={(open) => {
          if (!open) {
            setAddonPreview(null);
            setSelectedAddon(null);
          }
          setChangeAddonOpen(open);
        }}>
          <DialogContent className="w-full max-w-sm sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Modifier la quantite</DialogTitle>
              <DialogDescription className="truncate">
                {selectedAddon?.addon.name}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4 overflow-hidden">
              <div className="flex items-center justify-center gap-2 flex-wrap">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => selectedAddon && handleQuantityChange(-1, selectedAddon.addonId)}
                  disabled={newAddonQuantity <= 0}
                  data-testid="button-addon-decrease"
                >
                  <Minus className="h-4 w-4" />
                </Button>
                <Input
                  type="number"
                  value={newAddonQuantity}
                  onChange={(e) => {
                    const val = Math.max(0, parseInt(e.target.value) || 0);
                    setNewAddonQuantity(val);
                    if (selectedAddon) {
                      addonPreviewMutation.mutate({ addonId: selectedAddon.addonId, newQuantity: val });
                    }
                  }}
                  className="w-16 text-center shrink-0"
                  data-testid="input-addon-quantity"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => selectedAddon && handleQuantityChange(1, selectedAddon.addonId)}
                  data-testid="button-addon-increase"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>

              {addonPreviewMutation.isPending && (
                <div className="text-center">
                  <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                </div>
              )}

              {addonPreview && !addonPreviewMutation.isPending && (
                <div className="space-y-2 p-3 bg-muted/50 rounded-lg text-sm overflow-hidden">
                  <div className="flex flex-col sm:flex-row sm:justify-between gap-1">
                    <span className="text-muted-foreground">Prix unitaire:</span>
                    <span className="font-medium">{formatPrice(addonPreview.unitPrice)} EUR</span>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:justify-between gap-1">
                    <span className="text-muted-foreground">Quantite:</span>
                    <span>{addonPreview.currentQuantity} → <span className="font-medium">{addonPreview.newQuantity}</span></span>
                  </div>
                  <div className="border-t pt-2 mt-2 space-y-1">
                    {addonPreview.immediateCharge > 0 && (
                      <div className="flex flex-col sm:flex-row sm:justify-between gap-1">
                        <span className="text-muted-foreground">Prorata:</span>
                        <span className="text-red-600 font-medium">+{formatPrice(addonPreview.immediateCharge)} EUR</span>
                      </div>
                    )}
                    {addonPreview.immediateCredit > 0 && (
                      <div className="flex flex-col sm:flex-row sm:justify-between gap-1">
                        <span className="text-muted-foreground">Credit:</span>
                        <span className="text-green-600 font-medium">+{formatPrice(addonPreview.immediateCredit)} EUR</span>
                      </div>
                    )}
                    <div className="flex flex-col sm:flex-row sm:justify-between gap-1 pt-1">
                      <span className="text-muted-foreground">Nouveau total:</span>
                      <span className="font-bold">{formatPrice(addonPreview.newTotalCost)} EUR</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
            <DialogFooter className="flex-col gap-2 sm:flex-row">
              <Button variant="outline" onClick={() => setChangeAddonOpen(false)} className="w-full sm:w-auto">
                Annuler
              </Button>
              {billingSummary?.preferences?.preferredPaymentMethod === "ADMINISTRATIVE_MANDATE" ? (
                <Button 
                  onClick={() => selectedAddon && changeAddonMutation.mutate({ 
                    addonId: selectedAddon.addonId, 
                    newQuantity: newAddonQuantity, 
                    immediate: false 
                  })}
                  disabled={!selectedAddon || changeAddonMutation.isPending || newAddonQuantity === selectedAddon?.quantity}
                  className="w-full sm:w-auto"
                  data-testid="button-request-quote"
                >
                  {changeAddonMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Demander un devis
                </Button>
              ) : (
                <>
                  <Button 
                    variant="secondary"
                    onClick={() => selectedAddon && changeAddonMutation.mutate({ 
                      addonId: selectedAddon.addonId, 
                      newQuantity: newAddonQuantity, 
                      immediate: false 
                    })}
                    disabled={!selectedAddon || changeAddonMutation.isPending || newAddonQuantity === selectedAddon?.quantity}
                    className="w-full sm:w-auto"
                    data-testid="button-schedule-addon-change"
                  >
                    Programmer
                  </Button>
                  <Button 
                    onClick={() => selectedAddon && changeAddonMutation.mutate({ 
                      addonId: selectedAddon.addonId, 
                      newQuantity: newAddonQuantity, 
                      immediate: true 
                    })}
                    disabled={!selectedAddon || changeAddonMutation.isPending || newAddonQuantity === selectedAddon?.quantity}
                    className="w-full sm:w-auto"
                    data-testid="button-apply-addon-change"
                  >
                    {changeAddonMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    Appliquer
                  </Button>
                </>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={addAddonOpen} onOpenChange={(open) => {
          if (!open) {
            setAddonPreview(null);
            setSelectedAvailableAddon(null);
          }
          setAddAddonOpen(open);
        }}>
          <DialogContent className="w-full max-w-sm sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Ajouter une option</DialogTitle>
              <DialogDescription>
                Choisissez une option a ajouter
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4 overflow-hidden">
              <div className="space-y-2">
                <Label>Option</Label>
                <Select 
                  value={selectedAvailableAddon?.id || ""} 
                  onValueChange={(id) => {
                    const addon = billingSummary?.availableAddons.find(a => a.id === id);
                    if (addon) {
                      setSelectedAvailableAddon(addon);
                      setNewAddonQuantity(1);
                      addonPreviewMutation.mutate({ addonId: addon.id, newQuantity: 1 });
                    }
                  }}
                >
                  <SelectTrigger data-testid="select-addon" className="w-full">
                    <SelectValue placeholder="Selectionnez une option" />
                  </SelectTrigger>
                  <SelectContent>
                    {billingSummary?.availableAddons.filter(a => a.currentQuantity === 0).map((addon) => (
                      <SelectItem key={addon.id} value={addon.id}>
                        <span className="truncate">{addon.name}</span>
                        <span className="text-muted-foreground ml-1">
                          {formatPrice(billingSummary.billingInterval === "YEARLY" ? addon.yearlyPrice : addon.monthlyPrice)} EUR
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedAvailableAddon && (
                <div className="space-y-4">
                  <div className="flex items-center justify-center gap-2 flex-wrap">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => {
                        const newQty = Math.max(1, newAddonQuantity - 1);
                        setNewAddonQuantity(newQty);
                        addonPreviewMutation.mutate({ addonId: selectedAvailableAddon.id, newQuantity: newQty });
                      }}
                      disabled={newAddonQuantity <= 1}
                      data-testid="button-new-addon-decrease"
                    >
                      <Minus className="h-4 w-4" />
                    </Button>
                    <Input
                      type="number"
                      value={newAddonQuantity}
                      onChange={(e) => {
                        const val = Math.max(1, parseInt(e.target.value) || 1);
                        setNewAddonQuantity(val);
                        addonPreviewMutation.mutate({ addonId: selectedAvailableAddon.id, newQuantity: val });
                      }}
                      className="w-16 text-center shrink-0"
                      data-testid="input-new-addon-quantity"
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => {
                        const newQty = newAddonQuantity + 1;
                        setNewAddonQuantity(newQty);
                        addonPreviewMutation.mutate({ addonId: selectedAvailableAddon.id, newQuantity: newQty });
                      }}
                      data-testid="button-new-addon-increase"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>

                  {addonPreviewMutation.isPending && (
                    <div className="text-center">
                      <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                    </div>
                  )}

                  {addonPreview && !addonPreviewMutation.isPending && (
                    <div className="space-y-2 p-3 bg-muted/50 rounded-lg text-sm overflow-hidden">
                      <div className="flex flex-col sm:flex-row sm:justify-between gap-1">
                        <span className="text-muted-foreground">Prix unitaire:</span>
                        <span className="font-medium">{formatPrice(addonPreview.unitPrice)} EUR</span>
                      </div>
                      <div className="flex flex-col sm:flex-row sm:justify-between gap-1">
                        <span className="text-muted-foreground">Quantite:</span>
                        <span className="font-medium">{addonPreview.newQuantity}</span>
                      </div>
                      <div className="border-t pt-2 mt-2 space-y-1">
                        {addonPreview.immediateCharge > 0 && (
                          <div className="flex flex-col sm:flex-row sm:justify-between gap-1">
                            <span className="text-muted-foreground">Prorata:</span>
                            <span className="text-red-600 font-medium">+{formatPrice(addonPreview.immediateCharge)} EUR</span>
                          </div>
                        )}
                        <div className="flex flex-col sm:flex-row sm:justify-between gap-1 pt-1">
                          <span className="text-muted-foreground">Nouveau total:</span>
                          <span className="font-bold">{formatPrice(addonPreview.newTotalCost)} EUR</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
            <DialogFooter className="flex-col gap-2 sm:flex-row">
              <Button variant="outline" onClick={() => setAddAddonOpen(false)} className="w-full sm:w-auto">
                Annuler
              </Button>
              {billingSummary?.preferences?.preferredPaymentMethod === "ADMINISTRATIVE_MANDATE" ? (
                <Button 
                  onClick={() => selectedAvailableAddon && changeAddonMutation.mutate({ 
                    addonId: selectedAvailableAddon.id, 
                    newQuantity: newAddonQuantity, 
                    immediate: false 
                  })}
                  disabled={!selectedAvailableAddon || changeAddonMutation.isPending || newAddonQuantity < 1}
                  className="w-full sm:w-auto"
                  data-testid="button-request-addon-quote"
                >
                  {changeAddonMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Demander un devis
                </Button>
              ) : (
                <>
                  <Button 
                    variant="secondary"
                    onClick={() => selectedAvailableAddon && changeAddonMutation.mutate({ 
                      addonId: selectedAvailableAddon.id, 
                      newQuantity: newAddonQuantity, 
                      immediate: false 
                    })}
                    disabled={!selectedAvailableAddon || changeAddonMutation.isPending || newAddonQuantity < 1}
                    className="w-full sm:w-auto"
                    data-testid="button-schedule-add-addon"
                  >
                    Programmer
                  </Button>
                  <Button 
                    onClick={() => selectedAvailableAddon && changeAddonMutation.mutate({ 
                      addonId: selectedAvailableAddon.id, 
                      newQuantity: newAddonQuantity, 
                      immediate: true 
                    })}
                    disabled={!selectedAvailableAddon || changeAddonMutation.isPending || newAddonQuantity < 1}
                    className="w-full sm:w-auto"
                    data-testid="button-add-addon-now"
                  >
                    {changeAddonMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    Ajouter
                  </Button>
                </>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={editOrderOpen} onOpenChange={setEditOrderOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader className="pb-4 border-b">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <FileText className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <DialogTitle className="text-lg">Valider votre commande</DialogTitle>
                  <DialogDescription className="text-sm mt-1">
                    Commande <span className="font-medium">{selectedOrderForEdit?.orderNumber}</span>
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>
            
            <div className="space-y-5 py-4">
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  References administratives
                  <span className="text-xs font-normal">(optionnel)</span>
                </h4>
                <div className="grid gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="engagementNumber" className="text-xs">Numero d'engagement</Label>
                    <Input
                      id="engagementNumber"
                      value={orderBcFormData.engagementNumber}
                      onChange={(e) => setOrderBcFormData(prev => ({ ...prev, engagementNumber: e.target.value }))}
                      placeholder="Ex: ENG-2026-001"
                      className="h-9"
                      data-testid="input-engagement-number"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="purchaseOrderNumber" className="text-xs">Numero de bon de commande</Label>
                    <Input
                      id="purchaseOrderNumber"
                      value={orderBcFormData.purchaseOrderNumber}
                      onChange={(e) => setOrderBcFormData(prev => ({ ...prev, purchaseOrderNumber: e.target.value }))}
                      placeholder="Ex: BC-2026-001234"
                      className="h-9"
                      data-testid="input-purchase-order-number"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="serviceCode" className="text-xs">Code service</Label>
                    <Input
                      id="serviceCode"
                      value={orderBcFormData.serviceCode}
                      onChange={(e) => setOrderBcFormData(prev => ({ ...prev, serviceCode: e.target.value }))}
                      placeholder="Ex: DSI"
                      className="h-9"
                      data-testid="input-service-code"
                    />
                  </div>
                </div>
              </div>
              
              <div className="pt-2 border-t">
                <h4 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                  <Upload className="h-4 w-4" />
                  Document du bon de commande
                  <span className="text-xs font-normal text-destructive">*</span>
                </h4>
                <div className="space-y-3">
                  {orderDocuments.length > 0 ? (
                    <div className="space-y-2">
                      {orderDocuments.map((doc) => (
                        <div key={doc.id} className="flex items-center justify-between p-2.5 rounded-lg border bg-muted/30">
                          <div className="flex items-center gap-2.5">
                            <div className="p-1.5 rounded bg-green-100 dark:bg-green-900/30">
                              <File className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
                            </div>
                            <span className="text-sm font-medium">{doc.fileName}</span>
                          </div>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => window.open(doc.fileUrl, '_blank')}
                            data-testid={`button-download-bc-doc-${doc.id}`}
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="border-2 border-dashed rounded-lg p-4 text-center bg-muted/20">
                      <Upload className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
                      <p className="text-sm text-muted-foreground">Aucun document joint</p>
                    </div>
                  )}
                  
                  <div className="flex items-center justify-between gap-3">
                    <input
                      type="file"
                      id="bc-file-upload"
                      className="hidden"
                      accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                      onChange={handleBcFileUpload}
                      disabled={uploadingBc}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => document.getElementById('bc-file-upload')?.click()}
                      disabled={uploadingBc}
                      className="flex-1"
                      data-testid="button-upload-bc-document"
                    >
                      {uploadingBc ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Upload className="h-4 w-4 mr-2" />
                      )}
                      {uploadingBc ? "Telechargement..." : "Telecharger le BC signe"}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground text-center">
                    PDF, Word ou image (max 10 Mo)
                  </p>
                </div>
              </div>
            </div>
            
            {selectedOrderForEdit?.status !== "PENDING_VALIDATION" && (
              <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800">
                <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-amber-800 dark:text-amber-200">Commande deja traitee</p>
                  <p className="text-xs text-amber-700 dark:text-amber-300 mt-0.5">
                    Statut: {selectedOrderForEdit?.status === "PENDING_BC" ? "En attente de validation" : selectedOrderForEdit?.status === "ACCEPTED" ? "Acceptee" : selectedOrderForEdit?.status === "INVOICED" ? "Facturee" : selectedOrderForEdit?.status}
                  </p>
                </div>
              </div>
            )}
            
            {selectedOrderForEdit?.status === "PENDING_VALIDATION" && orderDocuments.length === 0 && (
              <div className="flex items-start gap-3 p-3 rounded-lg bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800">
                <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  Joignez votre bon de commande signe pour valider la commande.
                </p>
              </div>
            )}
            
            {selectedOrderForEdit?.status === "PENDING_VALIDATION" && orderDocuments.length > 0 && (
              <div className="flex items-start gap-3 p-3 rounded-lg bg-green-50 dark:bg-green-950/50 border border-green-200 dark:border-green-800">
                <Check className="h-5 w-5 text-green-600 dark:text-green-400 shrink-0 mt-0.5" />
                <p className="text-sm text-green-800 dark:text-green-200">
                  Document joint. Vous pouvez maintenant valider votre commande.
                </p>
              </div>
            )}
            
            <DialogFooter className="pt-4 border-t gap-2 sm:gap-3">
              <Button variant="ghost" onClick={() => setEditOrderOpen(false)} size="sm">
                Annuler
              </Button>
              <Button
                onClick={() => selectedOrderForEdit && updateOrderBcMutation.mutate({
                  orderId: selectedOrderForEdit.id,
                  data: orderBcFormData,
                })}
                disabled={updateOrderBcMutation.isPending}
                variant="outline"
                size="sm"
                data-testid="button-save-bc-info"
              >
                {updateOrderBcMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                <Save className="h-4 w-4 mr-1.5" />
                Enregistrer
              </Button>
              <Button
                onClick={() => selectedOrderForEdit && validateOrderMutation.mutate(selectedOrderForEdit.id)}
                disabled={
                  validateOrderMutation.isPending || 
                  orderDocuments.length === 0 ||
                  selectedOrderForEdit?.status !== "PENDING_VALIDATION"
                }
                size="sm"
                data-testid="button-validate-order"
              >
                {validateOrderMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                <Check className="h-4 w-4 mr-1.5" />
                Valider la commande
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Cancellation Request Dialog */}
        <Dialog open={cancelRequestOpen} onOpenChange={setCancelRequestOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Demander l'annulation de l'abonnement</DialogTitle>
              <DialogDescription>
                Veuillez indiquer la raison de votre demande d'annulation. Notre equipe vous contactera pour confirmer et finaliser la procedure.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="cancelReason">Raison de la demande</Label>
                <Textarea
                  id="cancelReason"
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="Veuillez expliquer pourquoi vous souhaitez annuler votre abonnement..."
                  rows={4}
                  data-testid="input-cancel-reason"
                />
              </div>
            </div>
            <DialogFooter>
              <Button 
                variant="outline" 
                onClick={() => {
                  setCancelRequestOpen(false);
                  setCancelReason("");
                }}
              >
                Annuler
              </Button>
              <Button 
                variant="destructive"
                onClick={() => cancelRequestMutation.mutate(cancelReason)}
                disabled={!cancelReason.trim() || cancelRequestMutation.isPending}
                data-testid="button-confirm-cancel-request"
              >
                {cancelRequestMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Envoi...
                  </>
                ) : (
                  "Envoyer la demande"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
