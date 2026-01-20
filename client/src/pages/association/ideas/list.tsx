import { useState, useEffect } from "react";
import { useParams, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { AssociationLayout } from "@/components/layout/association-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge } from "@/components/status-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Lightbulb, Plus, ThumbsUp, ThumbsDown, Search, Filter } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Tenant, Association, AssociationIdea } from "@shared/schema";
import { IDEA_CATEGORIES } from "@shared/schema";

function getAnonymousVoterId(): string {
  const key = "voxpopulous_anonymous_id";
  let id = localStorage.getItem(key);
  if (!id) {
    const array = new Uint8Array(16);
    crypto.getRandomValues(array);
    id = Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
    localStorage.setItem(key, id);
  }
  return id;
}

interface VoteResponse {
  success: boolean;
  action: 'created' | 'changed' | 'removed';
  upVotes: number;
  downVotes: number;
  totalVotes: number;
  userVote: 'up' | 'down' | null;
}

interface VoteStatusResponse {
  userVote: 'up' | 'down' | null;
  upVotes: number;
  downVotes: number;
  totalVotes: number;
}

export default function AssociationIdeasList() {
  const params = useParams<{ slug: string; assocSlug: string }>();
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [userVotes, setUserVotes] = useState<Record<string, 'up' | 'down' | null>>({});
  const [voteCounts, setVoteCounts] = useState<Record<string, { up: number; down: number }>>({});

  const { data: tenant } = useQuery<Tenant>({
    queryKey: ["/api/tenants", params.slug],
  });

  const { data: association } = useQuery<Association>({
    queryKey: ["/api/tenants", params.slug, "associations", params.assocSlug],
  });

  const { data: ideas, isLoading } = useQuery<AssociationIdea[]>({
    queryKey: ["/api/associations", association?.id, "ideas"],
    enabled: !!association?.id,
  });

  // Initialize vote counts and fetch user's vote status
  useEffect(() => {
    if (ideas && ideas.length > 0 && association?.id) {
      const anonymousVoterId = getAnonymousVoterId();
      const newVoteCounts: Record<string, { up: number; down: number }> = {};
      ideas.forEach(idea => {
        newVoteCounts[idea.id] = {
          up: idea.upVotesCount || 0,
          down: idea.downVotesCount || 0
        };
      });
      setVoteCounts(newVoteCounts);

      // Fetch vote status for each idea
      ideas.forEach(async (idea) => {
        try {
          const response = await fetch(
            `/api/associations/${association.id}/ideas/${idea.id}/vote-status?anonymousVoterId=${anonymousVoterId}`
          );
          if (response.ok) {
            const data: VoteStatusResponse = await response.json();
            setUserVotes(prev => ({ ...prev, [idea.id]: data.userVote }));
          }
        } catch (e) {
          console.error("Failed to fetch vote status:", e);
        }
      });
    }
  }, [ideas, association?.id]);

  const voteMutation = useMutation({
    mutationFn: async ({ ideaId, voteType }: { ideaId: string; voteType: 'up' | 'down' }) => {
      const anonymousVoterId = getAnonymousVoterId();
      const response = await apiRequest("POST", `/api/associations/${association?.id}/ideas/${ideaId}/vote`, {
        voteType,
        anonymousVoterId
      });
      const data: VoteResponse = await response.json();
      return { ideaId, response: data };
    },
    onSuccess: ({ ideaId, response }) => {
      setUserVotes(prev => ({ ...prev, [ideaId]: response.userVote }));
      setVoteCounts(prev => ({
        ...prev,
        [ideaId]: { up: response.upVotes, down: response.downVotes }
      }));
      
      if (response.action === 'created') {
        toast({
          title: "Vote enregistre",
          description: response.userVote === 'up' ? "Vous soutenez cette idee !" : "Vous etes contre cette idee.",
        });
      } else if (response.action === 'changed') {
        toast({
          title: "Vote modifie",
          description: "Votre vote a ete mis a jour.",
        });
      } else if (response.action === 'removed') {
        toast({
          title: "Vote retire",
          description: "Votre vote a ete retire.",
        });
      }
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Impossible d'enregistrer votre vote.",
        variant: "destructive",
      });
    },
  });

  const filteredIdeas = ideas?.filter((idea) => {
    const matchesStatus = statusFilter === "all" || idea.status === statusFilter;
    const matchesCategory = categoryFilter === "all" || idea.category === categoryFilter;
    const matchesSearch = !searchQuery || 
      idea.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      idea.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesCategory && matchesSearch;
  }) || [];

  const getVotePercentages = (ideaId: string) => {
    const counts = voteCounts[ideaId] || { up: 0, down: 0 };
    const total = counts.up + counts.down;
    if (total === 0) return { upPct: 0, downPct: 0 };
    return {
      upPct: Math.round((counts.up / total) * 100),
      downPct: Math.round((counts.down / total) * 100)
    };
  };

  return (
    <AssociationLayout association={association || null} tenant={tenant || null}>
      <div className="mx-auto max-w-7xl px-4 py-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="font-display text-3xl font-bold" data-testid="text-ideas-title">
              Boite a idees
            </h1>
            <p className="text-muted-foreground mt-1">
              Proposez vos idees et votez pour celles que vous soutenez.
            </p>
          </div>
          <Link href={`/structures/${params.slug}/${params.assocSlug}/ideas/new`}>
            <Button className="gap-2" data-testid="button-new-idea">
              <Plus className="h-4 w-4" />
              Proposer une idee
            </Button>
          </Link>
        </div>

        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher une idee..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
              data-testid="input-search"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full md:w-48" data-testid="select-status">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Statut" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les statuts</SelectItem>
              <SelectItem value="NEW">Nouvelle</SelectItem>
              <SelectItem value="UNDER_REVIEW">En cours d'examen</SelectItem>
              <SelectItem value="IN_PROGRESS">En cours</SelectItem>
              <SelectItem value="DONE">Realisee</SelectItem>
              <SelectItem value="REJECTED">Rejetee</SelectItem>
            </SelectContent>
          </Select>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-full md:w-48" data-testid="select-category">
              <SelectValue placeholder="Categorie" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes categories</SelectItem>
              {IDEA_CATEGORIES.map((cat) => (
                <SelectItem key={cat} value={cat}>{cat}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Card key={i}>
                <CardContent className="p-6">
                  <Skeleton className="h-6 w-3/4 mb-3" />
                  <Skeleton className="h-4 w-full mb-2" />
                  <Skeleton className="h-4 w-2/3" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filteredIdeas.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4">
                <Lightbulb className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="font-semibold text-lg mb-2">Aucune idee trouvee</h3>
              <p className="text-muted-foreground mb-6">
                {searchQuery || statusFilter !== "all" || categoryFilter !== "all"
                  ? "Essayez de modifier vos filtres."
                  : "Soyez le premier a proposer une idee !"}
              </p>
              <Link href={`/structures/${params.slug}/${params.assocSlug}/ideas/new`}>
                <Button data-testid="button-empty-new-idea">
                  Proposer une idee
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredIdeas.map((idea) => {
              const userVote = userVotes[idea.id];
              const counts = voteCounts[idea.id] || { up: 0, down: 0 };
              const { upPct, downPct } = getVotePercentages(idea.id);
              const totalVotes = counts.up + counts.down;

              return (
                <Card key={idea.id} className="flex flex-col hover-elevate" data-testid={`card-idea-${idea.id}`}>
                  <CardContent className="p-5 flex-1 flex flex-col">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <StatusBadge type="idea" status={idea.status} />
                      <span className="text-xs text-muted-foreground shrink-0">
                        {idea.category}
                      </span>
                    </div>
                    <h3 className="font-semibold mb-2 line-clamp-2">{idea.title}</h3>
                    <p className="text-sm text-muted-foreground line-clamp-3 flex-1">
                      {idea.description}
                    </p>
                    
                    {/* Vote Statistics - Count display for public */}
                    {totalVotes > 0 && (
                      <div className="mt-4">
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-blue-600 dark:text-blue-400 font-medium">
                            {counts.up} Pour
                          </span>
                          <span className="text-red-600 dark:text-red-400 font-medium">
                            {counts.down} Contre
                          </span>
                        </div>
                        <div className="h-2 rounded-full bg-muted overflow-hidden flex">
                          {upPct > 0 && (
                            <div 
                              className="bg-blue-500 h-full transition-all duration-300" 
                              style={{ width: `${upPct}%` }}
                            />
                          )}
                          {downPct > 0 && (
                            <div 
                              className="bg-red-500 h-full transition-all duration-300" 
                              style={{ width: `${downPct}%` }}
                            />
                          )}
                        </div>
                      </div>
                    )}

                    <div className="flex items-center justify-between mt-4 pt-4 border-t gap-2">
                      <div className="flex items-center gap-1">
                        {/* Upvote Button */}
                        <Button
                          variant="ghost"
                          size="sm"
                          className={`gap-1.5 ${userVote === 'up' ? 'text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-950' : ''}`}
                          onClick={() => voteMutation.mutate({ ideaId: idea.id, voteType: 'up' })}
                          disabled={voteMutation.isPending}
                          data-testid={`button-upvote-${idea.id}`}
                        >
                          <ThumbsUp className={`h-4 w-4 ${userVote === 'up' ? 'fill-current' : ''}`} />
                          <span className="font-semibold">{counts.up}</span>
                        </Button>

                        {/* Downvote Button */}
                        <Button
                          variant="ghost"
                          size="sm"
                          className={`gap-1.5 ${userVote === 'down' ? 'text-red-600 bg-red-50 dark:text-red-400 dark:bg-red-950' : ''}`}
                          onClick={() => voteMutation.mutate({ ideaId: idea.id, voteType: 'down' })}
                          disabled={voteMutation.isPending}
                          data-testid={`button-downvote-${idea.id}`}
                        >
                          <ThumbsDown className={`h-4 w-4 ${userVote === 'down' ? 'fill-current' : ''}`} />
                          <span className="font-semibold">{counts.down}</span>
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </AssociationLayout>
  );
}
