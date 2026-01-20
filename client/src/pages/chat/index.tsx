import { useState, useEffect, useRef } from "react";
import { useParams } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Loader2, Send, MessageCircle, Lock, Clock } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import type { ChatThread, ChatMessage } from "@shared/schema";

interface ChatData {
  thread: ChatThread & { accessType: 'public' | 'official' };
  messages: ChatMessage[];
}

const messageFormSchema = z.object({
  content: z.string().min(1, "Le message est requis"),
  senderName: z.string().optional(),
});

type MessageFormData = z.infer<typeof messageFormSchema>;

export default function ChatPage() {
  const params = useParams();
  const accessType = params.type as 'public' | 'official';
  const token = params.token as string;
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  
  if (accessType !== 'public' && accessType !== 'official') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <Lock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2" data-testid="text-error-title">Lien invalide</h2>
            <p className="text-muted-foreground" data-testid="text-error-message">
              Ce lien n'est pas valide.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  const { data, isLoading, error } = useQuery<ChatData>({
    queryKey: ["/api/chat", accessType, token],
    queryFn: async () => {
      const response = await fetch(`/api/chat/${accessType}/${token}`);
      if (!response.ok) {
        throw new Error("Conversation non trouvee");
      }
      return response.json();
    },
  });

  const form = useForm<MessageFormData>({
    resolver: zodResolver(messageFormSchema),
    defaultValues: {
      content: "",
      senderName: "",
    },
  });

  const sendMessageMutation = useMutation({
    mutationFn: async (formData: MessageFormData) => {
      const body: any = { content: formData.content };
      if (accessType === 'official') {
        body.senderName = formData.senderName || "Responsable";
      }
      return apiRequest("POST", `/api/chat/${accessType}/${token}/messages`, body);
    },
    onSuccess: () => {
      form.setValue("content", "");
      localStorage.removeItem(`chat_draft_${token}`);
      queryClient.invalidateQueries({ queryKey: ["/api/chat", accessType, token] });
    },
  });

  const closeThreadMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", `/api/chat/official/${token}/close`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/chat", accessType, token] });
    },
  });

  useEffect(() => {
    if (data?.thread?.id) {
      const sseUrl = `/api/chat/sse/${data.thread.id}?token=${encodeURIComponent(token)}&type=${encodeURIComponent(accessType)}`;
      eventSourceRef.current = new EventSource(sseUrl);
      
      eventSourceRef.current.onmessage = (event) => {
        const eventData = JSON.parse(event.data);
        if (eventData.type === 'new_message' || eventData.type === 'thread_closed') {
          queryClient.invalidateQueries({ queryKey: ["/api/chat", accessType, token] });
        }
      };
      
      eventSourceRef.current.onerror = () => {
        eventSourceRef.current?.close();
        setTimeout(() => {
          if (data?.thread?.id) {
            const retrySseUrl = `/api/chat/sse/${data.thread.id}?token=${encodeURIComponent(token)}&type=${encodeURIComponent(accessType)}`;
            eventSourceRef.current = new EventSource(retrySseUrl);
          }
        }, 5000);
      };
      
      return () => {
        eventSourceRef.current?.close();
      };
    }
  }, [data?.thread?.id, accessType, token]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [data?.messages]);

  useEffect(() => {
    const storedName = localStorage.getItem(`chat_sender_name_${token}`);
    if (storedName) {
      form.setValue("senderName", storedName);
    }
  }, [token, form]);

  useEffect(() => {
    const senderName = form.watch("senderName");
    if (senderName) {
      localStorage.setItem(`chat_sender_name_${token}`, senderName);
    }
  }, [form.watch("senderName"), token]);

  useEffect(() => {
    const draft = localStorage.getItem(`chat_draft_${token}`);
    if (draft) {
      form.setValue("content", draft);
    }
  }, [token, form]);

  useEffect(() => {
    const subscription = form.watch((value) => {
      if (value.content) {
        localStorage.setItem(`chat_draft_${token}`, value.content);
      } else {
        localStorage.removeItem(`chat_draft_${token}`);
      }
    });
    return () => subscription.unsubscribe();
  }, [form, token]);

  const handleSubmit = (formData: MessageFormData) => {
    if (accessType === 'official' && !formData.senderName?.trim()) {
      form.setError("senderName", { message: "Votre nom est requis" });
      return;
    }
    sendMessageMutation.mutate(formData);
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" data-testid="loading-spinner" />
          <p className="mt-4 text-muted-foreground" data-testid="text-loading">Chargement de la conversation...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <Lock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2" data-testid="text-not-found-title">Conversation non trouvee</h2>
            <p className="text-muted-foreground" data-testid="text-not-found-message">
              Ce lien a peut-etre expire ou la conversation n'existe plus.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { thread, messages } = data;
  const isClosed = thread.status === "CLOSED";

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto p-4">
        <Card className="mb-4">
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <MessageCircle className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-lg" data-testid="text-thread-subject">{thread.subject}</CardTitle>
                  <p className="text-sm text-muted-foreground mt-1" data-testid="text-thread-participant">
                    {accessType === 'official' 
                      ? `Conversation avec ${thread.requesterName}`
                      : "Votre conversation"
                    }
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {isClosed ? (
                  <Badge variant="secondary" data-testid="badge-status-closed">Fermee</Badge>
                ) : (
                  <Badge variant="default" className="bg-green-500" data-testid="badge-status-active">Active</Badge>
                )}
              </div>
            </div>
          </CardHeader>
        </Card>

        <Card className="mb-4">
          <CardContent className="p-4">
            <div className="space-y-4 max-h-[60vh] overflow-y-auto" data-testid="chat-messages-container">
              {messages.length === 0 ? (
                <p className="text-center text-muted-foreground py-8" data-testid="text-no-messages">
                  Aucun message dans cette conversation.
                </p>
              ) : (
                messages.map((message) => {
                  const isOwnMessage = 
                    (accessType === 'public' && message.senderType === 'requester') ||
                    (accessType === 'official' && message.senderType === 'official');
                  
                  return (
                    <div
                      key={message.id}
                      className={`flex gap-3 ${isOwnMessage ? 'flex-row-reverse' : ''}`}
                      data-testid={`chat-message-${message.id}`}
                    >
                      <Avatar className="h-8 w-8 shrink-0">
                        <AvatarFallback className={isOwnMessage ? 'bg-primary text-primary-foreground' : 'bg-muted'}>
                          {getInitials(message.senderName)}
                        </AvatarFallback>
                      </Avatar>
                      <div className={`flex-1 max-w-[80%] ${isOwnMessage ? 'text-right' : ''}`}>
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          {!isOwnMessage && (
                            <span className="text-sm font-medium" data-testid={`text-sender-name-${message.id}`}>{message.senderName}</span>
                          )}
                          <span className="text-xs text-muted-foreground flex items-center gap-1" data-testid={`text-message-time-${message.id}`}>
                            <Clock className="h-3 w-3" />
                            {format(new Date(message.createdAt), "d MMM HH:mm", { locale: fr })}
                          </span>
                          {isOwnMessage && (
                            <span className="text-sm font-medium" data-testid={`text-sender-name-${message.id}`}>{message.senderName}</span>
                          )}
                        </div>
                        <div 
                          className={`rounded-lg p-3 ${
                            isOwnMessage 
                              ? 'bg-primary text-primary-foreground' 
                              : 'bg-muted'
                          }`}
                          data-testid={`text-message-content-${message.id}`}
                        >
                          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>
          </CardContent>
        </Card>

        {!isClosed ? (
          <Card>
            <CardContent className="p-4">
              <Form {...form}>
                <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                  {accessType === 'official' && (
                    <FormField
                      control={form.control}
                      name="senderName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Votre nom</FormLabel>
                          <FormControl>
                            <Input 
                              {...field} 
                              placeholder="Entrez votre nom..."
                              data-testid="input-sender-name"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                  <FormField
                    control={form.control}
                    name="content"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Textarea
                            {...field}
                            placeholder="Ecrivez votre message..."
                            className="min-h-[100px] resize-none"
                            data-testid="textarea-message"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="flex items-center justify-between gap-4 flex-wrap">
                    {accessType === 'official' && (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => closeThreadMutation.mutate()}
                        disabled={closeThreadMutation.isPending}
                        data-testid="button-close-thread"
                      >
                        Fermer la conversation
                      </Button>
                    )}
                    <Button
                      type="submit"
                      disabled={sendMessageMutation.isPending}
                      className={accessType === 'public' ? 'w-full' : ''}
                      data-testid="button-send-message"
                    >
                      {sendMessageMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <Send className="h-4 w-4 mr-2" />
                      )}
                      Envoyer
                    </Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-6 text-center">
              <Lock className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground" data-testid="text-thread-closed">
                Cette conversation a ete fermee. Vous ne pouvez plus y repondre.
              </p>
            </CardContent>
          </Card>
        )}

        <div className="mt-6 text-center text-xs text-muted-foreground">
          <p data-testid="text-security-notice">Les messages sont envoyes de maniere securisee.</p>
          <p className="mt-1" data-testid="text-email-notice">Vous recevrez une notification par email pour chaque nouvelle reponse.</p>
        </div>
      </div>
    </div>
  );
}
