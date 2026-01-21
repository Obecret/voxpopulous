import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { SuperadminLayout } from "./layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { 
  Activity, 
  Monitor, 
  Smartphone, 
  Tablet, 
  Globe, 
  Ban, 
  CheckCircle, 
  Search,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Eye
} from "lucide-react";
import type { ActivityLog, BlockedDevice } from "@shared/schema";

interface ActivityLogsResponse {
  logs: ActivityLog[];
  total: number;
  limit: number;
  offset: number;
}

function getDeviceIcon(deviceType: string | null) {
  switch (deviceType) {
    case "MOBILE":
      return <Smartphone className="h-4 w-4" />;
    case "TABLET":
      return <Tablet className="h-4 w-4" />;
    case "DESKTOP":
      return <Monitor className="h-4 w-4" />;
    default:
      return <Globe className="h-4 w-4" />;
  }
}

function formatDate(date: string | Date | null) {
  if (!date) return "-";
  return new Date(date).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

export default function ActivityTrackingPage() {
  const { toast } = useToast();
  const [page, setPage] = useState(0);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
  const [blockDialogOpen, setBlockDialogOpen] = useState(false);
  const [blockReason, setBlockReason] = useState("");
  const [deviceToBlock, setDeviceToBlock] = useState<string | null>(null);
  const pageSize = 50;

  const { data: activityData, isLoading: activityLoading, refetch: refetchActivities } = useQuery<ActivityLogsResponse>({
    queryKey: ["/api/superadmin/activity-logs", page, pageSize],
    queryFn: async () => {
      const res = await fetch(`/api/superadmin/activity-logs?limit=${pageSize}&offset=${page * pageSize}`);
      return res.json();
    }
  });

  const { data: blockedDevices, isLoading: blockedLoading, refetch: refetchBlocked } = useQuery<BlockedDevice[]>({
    queryKey: ["/api/superadmin/blocked-devices"]
  });

  const { data: deviceLogs, isLoading: deviceLogsLoading } = useQuery<ActivityLog[]>({
    queryKey: ["/api/superadmin/activity-logs/device", selectedDeviceId],
    enabled: !!selectedDeviceId
  });

  const blockMutation = useMutation({
    mutationFn: async ({ deviceId, reason }: { deviceId: string; reason: string }) => {
      return apiRequest("POST", `/api/superadmin/devices/${deviceId}/block`, { reason });
    },
    onSuccess: () => {
      toast({ title: "Appareil bloque", description: "L'appareil a ete bloque avec succes." });
      setBlockDialogOpen(false);
      setBlockReason("");
      setDeviceToBlock(null);
      refetchBlocked();
      refetchActivities();
    },
    onError: (error: any) => {
      toast({ title: "Erreur", description: error.message || "Erreur lors du blocage", variant: "destructive" });
    }
  });

  const unblockMutation = useMutation({
    mutationFn: async (deviceId: string) => {
      return apiRequest("POST", `/api/superadmin/devices/${deviceId}/unblock`);
    },
    onSuccess: () => {
      toast({ title: "Appareil debloque", description: "L'appareil peut a nouveau se connecter." });
      refetchBlocked();
    },
    onError: (error: any) => {
      toast({ title: "Erreur", description: error.message || "Erreur lors du deblocage", variant: "destructive" });
    }
  });

  const filteredLogs = activityData?.logs.filter(log => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      log.deviceId?.toLowerCase().includes(search) ||
      log.ipAddress?.toLowerCase().includes(search) ||
      log.userName?.toLowerCase().includes(search) ||
      log.userEmail?.toLowerCase().includes(search) ||
      log.tenantName?.toLowerCase().includes(search) ||
      log.associationName?.toLowerCase().includes(search) ||
      log.electedOfficialName?.toLowerCase().includes(search) ||
      log.superadminEmail?.toLowerCase().includes(search) ||
      log.browserName?.toLowerCase().includes(search)
    );
  }) || [];

  const totalPages = Math.ceil((activityData?.total || 0) / pageSize);

  const openBlockDialog = (deviceId: string) => {
    setDeviceToBlock(deviceId);
    setBlockDialogOpen(true);
  };

  const handleBlock = () => {
    if (deviceToBlock) {
      blockMutation.mutate({ deviceId: deviceToBlock, reason: blockReason });
    }
  };

  const isDeviceBlocked = (deviceId: string) => {
    return blockedDevices?.some(d => d.deviceId === deviceId && d.isActive);
  };

  return (
    <SuperadminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Suivi des Activites</h1>
            <p className="text-muted-foreground">
              Suivez les connexions et bloquez les appareils suspects
            </p>
          </div>
          <Button 
            variant="outline" 
            onClick={() => { refetchActivities(); refetchBlocked(); }}
            data-testid="button-refresh"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Actualiser
          </Button>
        </div>

        <Tabs defaultValue="activities">
          <TabsList>
            <TabsTrigger value="activities" data-testid="tab-activities">
              <Activity className="h-4 w-4 mr-2" />
              Activites ({activityData?.total || 0})
            </TabsTrigger>
            <TabsTrigger value="blocked" data-testid="tab-blocked">
              <Ban className="h-4 w-4 mr-2" />
              Appareils bloques ({blockedDevices?.filter(d => d.isActive).length || 0})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="activities" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <CardTitle>Journal des connexions</CardTitle>
                    <CardDescription>Historique de toutes les connexions a l'application</CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Search className="h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Rechercher..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-64"
                      data-testid="input-search"
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {activityLoading ? (
                  <div className="space-y-2">
                    {[...Array(5)].map((_, i) => (
                      <Skeleton key={i} className="h-12 w-full" />
                    ))}
                  </div>
                ) : filteredLogs.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Aucune activite enregistree
                  </div>
                ) : (
                  <>
                    <div className="rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead>Appareil</TableHead>
                            <TableHead>IP</TableHead>
                            <TableHead>Navigateur / OS</TableHead>
                            <TableHead>Organisation</TableHead>
                            <TableHead>Utilisateur</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead>Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredLogs.map((log) => (
                            <TableRow key={log.id} data-testid={`row-activity-${log.id}`}>
                              <TableCell className="text-sm">
                                {formatDate(log.createdAt)}
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  {getDeviceIcon(log.deviceType)}
                                  <span className="text-xs font-mono text-muted-foreground">
                                    {log.deviceId?.substring(0, 8)}...
                                  </span>
                                </div>
                              </TableCell>
                              <TableCell className="font-mono text-xs">
                                {log.ipAddress || "-"}
                              </TableCell>
                              <TableCell className="text-sm">
                                <div>{log.browserName || "-"}</div>
                                <div className="text-xs text-muted-foreground">{log.osName || "-"}</div>
                              </TableCell>
                              <TableCell>
                                <div className="text-sm font-medium">{log.tenantName || "-"}</div>
                                {log.associationName && (
                                  <div className="text-xs text-muted-foreground">{log.associationName}</div>
                                )}
                              </TableCell>
                              <TableCell>
                                <div className="text-sm">
                                  {log.userName || log.electedOfficialName || log.superadminEmail || "-"}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {log.userEmail || log.userRole || ""}
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge variant={log.activityType === "LOGIN" ? "default" : "secondary"}>
                                  {log.activityType}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-1">
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    onClick={() => setSelectedDeviceId(log.deviceId)}
                                    data-testid={`button-view-device-${log.deviceId}`}
                                  >
                                    <Eye className="h-4 w-4" />
                                  </Button>
                                  {isDeviceBlocked(log.deviceId) ? (
                                    <Badge variant="destructive" className="text-xs">Bloque</Badge>
                                  ) : (
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      onClick={() => openBlockDialog(log.deviceId)}
                                      data-testid={`button-block-${log.deviceId}`}
                                    >
                                      <Ban className="h-4 w-4 text-destructive" />
                                    </Button>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                    
                    <div className="flex items-center justify-between pt-4">
                      <div className="text-sm text-muted-foreground">
                        Page {page + 1} sur {totalPages} ({activityData?.total} activites)
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setPage(p => Math.max(0, p - 1))}
                          disabled={page === 0}
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                          disabled={page >= totalPages - 1}
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="blocked" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Appareils bloques</CardTitle>
                <CardDescription>Ces appareils ne peuvent plus acceder a l'application</CardDescription>
              </CardHeader>
              <CardContent>
                {blockedLoading ? (
                  <div className="space-y-2">
                    {[...Array(3)].map((_, i) => (
                      <Skeleton key={i} className="h-12 w-full" />
                    ))}
                  </div>
                ) : !blockedDevices || blockedDevices.filter(d => d.isActive).length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Aucun appareil bloque
                  </div>
                ) : (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>ID Appareil</TableHead>
                          <TableHead>Derniere IP</TableHead>
                          <TableHead>Dernier utilisateur</TableHead>
                          <TableHead>Organisation</TableHead>
                          <TableHead>Raison</TableHead>
                          <TableHead>Bloque le</TableHead>
                          <TableHead>Par</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {blockedDevices.filter(d => d.isActive).map((device) => (
                          <TableRow key={device.id} data-testid={`row-blocked-${device.id}`}>
                            <TableCell className="font-mono text-xs">
                              {device.deviceId?.substring(0, 8)}...
                            </TableCell>
                            <TableCell className="font-mono text-xs">
                              {device.lastIpAddress || "-"}
                            </TableCell>
                            <TableCell>{device.lastUserName || "-"}</TableCell>
                            <TableCell>{device.lastTenantName || "-"}</TableCell>
                            <TableCell className="max-w-48 truncate">{device.reason || "-"}</TableCell>
                            <TableCell>{formatDate(device.createdAt)}</TableCell>
                            <TableCell>{device.blockedByEmail || "-"}</TableCell>
                            <TableCell>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => unblockMutation.mutate(device.deviceId)}
                                disabled={unblockMutation.isPending}
                                data-testid={`button-unblock-${device.deviceId}`}
                              >
                                <CheckCircle className="h-4 w-4 mr-1" />
                                Debloquer
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <Dialog open={blockDialogOpen} onOpenChange={setBlockDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Bloquer cet appareil</DialogTitle>
              <DialogDescription>
                L'appareil ne pourra plus se connecter a l'application.
                Cette action peut etre annulee.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Raison du blocage</label>
                <Textarea
                  placeholder="Activite suspecte, abus, etc."
                  value={blockReason}
                  onChange={(e) => setBlockReason(e.target.value)}
                  className="mt-1"
                  data-testid="input-block-reason"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setBlockDialogOpen(false)}>
                Annuler
              </Button>
              <Button 
                variant="destructive" 
                onClick={handleBlock}
                disabled={blockMutation.isPending}
                data-testid="button-confirm-block"
              >
                <Ban className="h-4 w-4 mr-2" />
                Bloquer l'appareil
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={!!selectedDeviceId} onOpenChange={(open) => !open && setSelectedDeviceId(null)}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Historique de l'appareil</DialogTitle>
              <DialogDescription>
                ID: {selectedDeviceId}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              {deviceLogsLoading ? (
                <div className="space-y-2">
                  {[...Array(3)].map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : !deviceLogs || deviceLogs.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Aucune activite pour cet appareil
                </div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>IP</TableHead>
                        <TableHead>Navigateur</TableHead>
                        <TableHead>Organisation</TableHead>
                        <TableHead>Utilisateur</TableHead>
                        <TableHead>Type</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {deviceLogs.map((log) => (
                        <TableRow key={log.id}>
                          <TableCell>{formatDate(log.createdAt)}</TableCell>
                          <TableCell className="font-mono text-xs">{log.ipAddress}</TableCell>
                          <TableCell>{log.browserName} / {log.osName}</TableCell>
                          <TableCell>{log.tenantName || log.associationName || "-"}</TableCell>
                          <TableCell>{log.userName || log.electedOfficialName || log.superadminEmail}</TableCell>
                          <TableCell>
                            <Badge variant="secondary">{log.activityType}</Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
              
              {selectedDeviceId && !isDeviceBlocked(selectedDeviceId) && (
                <div className="flex justify-end">
                  <Button 
                    variant="destructive" 
                    onClick={() => {
                      setSelectedDeviceId(null);
                      openBlockDialog(selectedDeviceId);
                    }}
                  >
                    <Ban className="h-4 w-4 mr-2" />
                    Bloquer cet appareil
                  </Button>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </SuperadminLayout>
  );
}
