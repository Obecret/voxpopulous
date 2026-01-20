import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { 
  History, 
  Loader2,
  ChevronDown,
  ChevronRight,
  Filter
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { SuperadminLayout } from "./layout";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface AuditLog {
  id: string;
  actionType: string;
  targetType: string;
  targetId: string;
  targetName: string | null;
  actorId: string;
  actorName: string;
  metadata: string | null;
  createdAt: string;
}

interface AuditLogsResponse {
  logs: AuditLog[];
  total: number;
  limit: number;
  offset: number;
}

const ACTION_TYPES = [
  "DELETE_TENANT",
  "DELETE_MANDATE_ORDER",
  "DELETE_MANDATE_INVOICE",
  "HIDE_STRIPE_SUBSCRIPTION",
  "HIDE_STRIPE_INVOICE",
  "HIDE_STRIPE_PAYMENT",
  "ARCHIVE_TENANT",
  "SUSPEND_TENANT",
  "RESTORE_TENANT",
];

const TARGET_TYPES = [
  "tenant",
  "mandate_order",
  "mandate_invoice",
  "stripe_subscription",
  "stripe_invoice",
  "stripe_payment",
];

const ACTION_LABELS: Record<string, string> = {
  DELETE_TENANT: "Suppression client",
  DELETE_MANDATE_ORDER: "Suppression commande",
  DELETE_MANDATE_INVOICE: "Suppression facture",
  HIDE_STRIPE_SUBSCRIPTION: "Masquer abonnement",
  HIDE_STRIPE_INVOICE: "Masquer facture Stripe",
  HIDE_STRIPE_PAYMENT: "Masquer paiement",
  ARCHIVE_TENANT: "Archivage client",
  SUSPEND_TENANT: "Suspension client",
  RESTORE_TENANT: "Restauration client",
};

const TARGET_LABELS: Record<string, string> = {
  tenant: "Client",
  mandate_order: "Commande mandat",
  mandate_invoice: "Facture mandat",
  stripe_subscription: "Abonnement Stripe",
  stripe_invoice: "Facture Stripe",
  stripe_payment: "Paiement Stripe",
};

function getActionBadgeColor(actionType: string): string {
  if (actionType.startsWith("DELETE_")) {
    return "bg-red-500 text-white";
  }
  if (actionType.startsWith("HIDE_")) {
    return "bg-orange-500 text-white";
  }
  if (actionType === "ARCHIVE_TENANT" || actionType === "SUSPEND_TENANT") {
    return "bg-blue-500 text-white";
  }
  if (actionType === "RESTORE_TENANT") {
    return "bg-green-500 text-white";
  }
  return "bg-gray-500 text-white";
}

const ITEMS_PER_PAGE = 50;

export default function SuperadminAuditHistory() {
  const [actionFilter, setActionFilter] = useState<string>("");
  const [targetFilter, setTargetFilter] = useState<string>("");
  const [currentPage, setCurrentPage] = useState(0);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const offset = currentPage * ITEMS_PER_PAGE;

  const queryParams = new URLSearchParams();
  queryParams.set("limit", ITEMS_PER_PAGE.toString());
  queryParams.set("offset", offset.toString());
  if (actionFilter) {
    queryParams.set("actionType", actionFilter);
  }
  if (targetFilter) {
    queryParams.set("targetType", targetFilter);
  }

  const { data, isLoading } = useQuery<AuditLogsResponse>({
    queryKey: ["/api/superadmin/audit-logs", actionFilter, targetFilter, offset],
    queryFn: async () => {
      const res = await fetch(`/api/superadmin/audit-logs?${queryParams.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch audit logs");
      return res.json();
    },
  });

  const logs = data?.logs || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / ITEMS_PER_PAGE);

  const toggleRow = (id: string) => {
    setExpandedRows(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const clearFilters = () => {
    setActionFilter("");
    setTargetFilter("");
    setCurrentPage(0);
  };

  const parseMetadata = (metadata: string | null): Record<string, any> | null => {
    if (!metadata) return null;
    try {
      return JSON.parse(metadata);
    } catch {
      return null;
    }
  };

  return (
    <SuperadminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <History className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-2xl font-bold">Historique d'audit</h1>
              <p className="text-muted-foreground">Journal des actions administratives</p>
            </div>
          </div>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <CardTitle className="flex items-center gap-2">
                <Filter className="h-5 w-5" />
                Filtres
              </CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={clearFilters}
                data-testid="button-clear-filters"
              >
                Effacer les filtres
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4 flex-wrap">
              <div className="w-64">
                <Select
                  value={actionFilter}
                  onValueChange={(value) => {
                    setActionFilter(value === "all" ? "" : value);
                    setCurrentPage(0);
                  }}
                >
                  <SelectTrigger data-testid="select-action-type">
                    <SelectValue placeholder="Type d'action" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Toutes les actions</SelectItem>
                    {ACTION_TYPES.map((action) => (
                      <SelectItem key={action} value={action}>
                        {ACTION_LABELS[action] || action}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="w-64">
                <Select
                  value={targetFilter}
                  onValueChange={(value) => {
                    setTargetFilter(value === "all" ? "" : value);
                    setCurrentPage(0);
                  }}
                >
                  <SelectTrigger data-testid="select-target-type">
                    <SelectValue placeholder="Type de cible" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Toutes les cibles</SelectItem>
                    {TARGET_TYPES.map((target) => (
                      <SelectItem key={target} value={target}>
                        {TARGET_LABELS[target] || target}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              Journal d'audit ({total} {total === 1 ? "entree" : "entrees"})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center p-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : logs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Aucun log d'audit trouve
              </div>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12"></TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Acteur</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>Cible</TableHead>
                      <TableHead>Details</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.map((log) => {
                      const isExpanded = expandedRows.has(log.id);
                      const metadata = parseMetadata(log.metadata);
                      const hasMetadata = metadata && Object.keys(metadata).length > 0;

                      return (
                        <Collapsible key={log.id} open={isExpanded} asChild>
                          <>
                            <TableRow data-testid={`row-audit-${log.id}`}>
                              <TableCell>
                                {hasMetadata && (
                                  <CollapsibleTrigger asChild>
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      onClick={() => toggleRow(log.id)}
                                      data-testid={`button-expand-${log.id}`}
                                    >
                                      {isExpanded ? (
                                        <ChevronDown className="h-4 w-4" />
                                      ) : (
                                        <ChevronRight className="h-4 w-4" />
                                      )}
                                    </Button>
                                  </CollapsibleTrigger>
                                )}
                              </TableCell>
                              <TableCell data-testid={`text-date-${log.id}`}>
                                {format(new Date(log.createdAt), "dd/MM/yyyy HH:mm", { locale: fr })}
                              </TableCell>
                              <TableCell data-testid={`text-actor-${log.id}`}>
                                {log.actorName}
                              </TableCell>
                              <TableCell>
                                <Badge 
                                  className={getActionBadgeColor(log.actionType)}
                                  data-testid={`badge-action-${log.id}`}
                                >
                                  {ACTION_LABELS[log.actionType] || log.actionType}
                                </Badge>
                              </TableCell>
                              <TableCell data-testid={`text-target-${log.id}`}>
                                <div className="flex flex-col">
                                  <span>{log.targetName || log.targetId}</span>
                                  <span className="text-xs text-muted-foreground">
                                    {TARGET_LABELS[log.targetType] || log.targetType}
                                  </span>
                                </div>
                              </TableCell>
                              <TableCell>
                                {hasMetadata ? (
                                  <span className="text-sm text-muted-foreground">
                                    {Object.keys(metadata).length} champ(s)
                                  </span>
                                ) : (
                                  <span className="text-sm text-muted-foreground">-</span>
                                )}
                              </TableCell>
                            </TableRow>
                            {hasMetadata && (
                              <CollapsibleContent asChild>
                                <TableRow className="bg-muted/50">
                                  <TableCell colSpan={6}>
                                    <div className="p-4" data-testid={`details-${log.id}`}>
                                      <h4 className="font-semibold mb-2">Metadata</h4>
                                      <pre className="text-sm bg-background p-3 rounded-md overflow-x-auto">
                                        {JSON.stringify(metadata, null, 2)}
                                      </pre>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              </CollapsibleContent>
                            )}
                          </>
                        </Collapsible>
                      );
                    })}
                  </TableBody>
                </Table>

                {totalPages > 1 && (
                  <div className="flex items-center justify-between mt-4">
                    <div className="text-sm text-muted-foreground">
                      Page {currentPage + 1} sur {totalPages} ({total} resultats)
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(p => Math.max(0, p - 1))}
                        disabled={currentPage === 0}
                        data-testid="button-prev-page"
                      >
                        Precedent
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(p => Math.min(totalPages - 1, p + 1))}
                        disabled={currentPage >= totalPages - 1}
                        data-testid="button-next-page"
                      >
                        Suivant
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </SuperadminLayout>
  );
}
