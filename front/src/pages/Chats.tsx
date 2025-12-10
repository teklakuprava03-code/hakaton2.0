import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  ArrowLeft, Search, MessageSquare, Users, Loader2
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { RealtimeChannel } from "@supabase/supabase-js";
import { NewChatDialog } from "@/components/NewChatDialog";

interface ChatParticipant {
  user_id: string;
  profiles: {
    full_name: string;
    avatar_url: string | null;
  };
}

interface Chat {
  id: string;
  name: string | null;
  type: string;
  patient_id: string | null;
  updated_at: string;
  participants: ChatParticipant[];
  lastMessage?: {
    content: string;
    created_at: string;
    sender_id: string;
  };
  patient?: {
    full_name: string;
    diagnosis: string;
  };
}

const Chats = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [personalChats, setPersonalChats] = useState<Chat[]>([]);
  const [patientChats, setPatientChats] = useState<Chat[]>([]);
  
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    loadChats();
    subscribeToMessages();
    
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, []);

  const loadChats = async () => {
    if (!user) return;
    
    try {
      console.log('[Chats] Loading chats for user:', user.id);
      
      // Get all chats where user is a participant
      const { data: participantData, error: participantError } = await supabase
        .from('chat_participants')
        .select('chat_id')
        .eq('user_id', user.id);

      if (participantError) {
        console.error('[Chats] Error loading participants:', participantError);
        throw participantError;
      }

      console.log('[Chats] Participant data:', participantData);
      const chatIds = participantData.map(p => p.chat_id);

      if (chatIds.length === 0) {
        console.log('[Chats] No chats found for user');
        setLoading(false);
        return;
      }

      console.log('[Chats] Loading chats with IDs:', chatIds);

      // Load chats with participants
      const { data: chatsData, error: chatsError } = await supabase
        .from('chats')
        .select(`
          id,
          name,
          type,
          patient_id,
          updated_at,
          chat_participants!inner (
            user_id,
            profiles:user_id (
              full_name,
              avatar_url
            )
          ),
          patients (
            full_name,
            diagnosis
          )
        `)
        .in('id', chatIds)
        .order('updated_at', { ascending: false });

      if (chatsError) {
        console.error('[Chats] Error loading chats:', chatsError);
        throw chatsError;
      }

      console.log('[Chats] Loaded chats data:', chatsData);

      // Load last message for each chat
      const chatsWithMessages = await Promise.all(
        (chatsData || []).map(async (chat: any) => {
          const { data: messageData } = await supabase
            .from('messages')
            .select('content, created_at, sender_id')
            .eq('chat_id', chat.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          // Normalize patient data - could be array or object
          let patientData = chat.patients;
          if (Array.isArray(patientData) && patientData.length > 0) {
            patientData = patientData[0];
          }

          return {
            ...chat,
            participants: chat.chat_participants,
            patient: patientData,
            lastMessage: messageData || undefined,
          };
        })
      );

      console.log('[Chats] Chats with messages:', chatsWithMessages);

      // Separate personal and patient chats
      const personal = chatsWithMessages.filter((c: Chat) => c.type === 'personal');
      const patient = chatsWithMessages.filter((c: Chat) => c.type === 'patient_chat');

      console.log('[Chats] Personal chats:', personal.length, 'Patient chats:', patient.length);

      setPersonalChats(personal);
      setPatientChats(patient);
    } catch (error) {
      console.error('Error loading chats:', error);
      toast({
        title: "Ошибка",
        description: "Не удалось загрузить чаты",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const subscribeToMessages = () => {
    const channel = supabase
      .channel('all-messages')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages'
        },
        () => {
          // Reload chats when new message arrives
          loadChats();
        }
      )
      .subscribe();

    channelRef.current = channel;
  };

  const getOtherParticipant = (chat: Chat) => {
    return chat.participants.find(p => p.user_id !== user?.id);
  };

  const getChatName = (chat: Chat) => {
    if (chat.type === 'patient_chat' && chat.patient) {
      return `Чат по пациенту: ${chat.patient.full_name}`;
    }
    
    const otherParticipant = getOtherParticipant(chat);
    return otherParticipant?.profiles.full_name || 'Неизвестный';
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Только что';
    if (diffMins < 60) return `${diffMins} мин`;
    if (diffHours < 24) return `${diffHours} ч`;
    if (diffDays === 1) return 'Вчера';
    if (diffDays < 7) return `${diffDays} дн`;
    
    return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
  };

  const handleChatClick = (chat: Chat) => {
    if (chat.type === 'patient_chat') {
      navigate(`/patients/${chat.patient_id}/chat`);
    } else {
      navigate(`/chats/${chat.id}`);
    }
  };

  const filteredPersonalChats = personalChats.filter(chat => {
    const otherParticipant = getOtherParticipant(chat);
    return otherParticipant?.profiles.full_name.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const filteredPatientChats = patientChats.filter(chat => {
    return chat.patient?.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
           chat.patient?.diagnosis.toLowerCase().includes(searchQuery.toLowerCase());
  });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Загрузка чатов...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <h1 className="text-xl font-bold">Чаты</h1>
            </div>
            <NewChatDialog onChatCreated={loadChats} />
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6">
        {/* Search */}
        <Card className="p-4 mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="Поиск чатов..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </Card>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Personal Chats */}
          <div>
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <MessageSquare className="w-5 h-5" />
              Личные чаты
              <Badge variant="secondary">{filteredPersonalChats.length}</Badge>
            </h2>
            {filteredPersonalChats.length === 0 ? (
              <Card className="p-8 text-center">
                <MessageSquare className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p className="text-sm text-muted-foreground">
                  {searchQuery ? 'Чаты не найдены' : 'У вас пока нет личных чатов'}
                </p>
              </Card>
            ) : (
              <ScrollArea className="h-[calc(100vh-300px)]">
                <div className="space-y-3">
                  {filteredPersonalChats.map((chat) => {
                    const otherParticipant = getOtherParticipant(chat);
                    return (
                      <Card
                        key={chat.id}
                        className="p-4 cursor-pointer hover:shadow-md transition-all"
                        onClick={() => handleChatClick(chat)}
                      >
                        <div className="flex items-center gap-3">
                          <Avatar className="w-12 h-12">
                            <AvatarFallback>
                              {otherParticipant ? getInitials(otherParticipant.profiles.full_name) : '?'}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1">
                              <h3 className="font-semibold truncate">
                                {otherParticipant?.profiles.full_name || 'Неизвестный'}
                              </h3>
                              {chat.lastMessage && (
                                <span className="text-xs text-muted-foreground">
                                  {formatTime(chat.lastMessage.created_at)}
                                </span>
                              )}
                            </div>
                            {chat.lastMessage ? (
                              <p className="text-sm text-muted-foreground truncate">
                                {chat.lastMessage.sender_id === user?.id ? 'Вы: ' : ''}
                                {chat.lastMessage.content}
                              </p>
                            ) : (
                              <p className="text-sm text-muted-foreground italic">
                                Нет сообщений
                              </p>
                            )}
                          </div>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              </ScrollArea>
            )}
          </div>

          {/* Patient Chats */}
          <div>
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Users className="w-5 h-5" />
              Чаты по пациентам
              <Badge variant="secondary">{filteredPatientChats.length}</Badge>
            </h2>
            {filteredPatientChats.length === 0 ? (
              <Card className="p-8 text-center">
                <Users className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p className="text-sm text-muted-foreground">
                  {searchQuery ? 'Чаты не найдены' : 'У вас пока нет чатов по пациентам'}
                </p>
              </Card>
            ) : (
              <ScrollArea className="h-[calc(100vh-300px)]">
                <div className="space-y-3">
                  {filteredPatientChats.map((chat) => (
                    <Card
                      key={chat.id}
                      className="p-4 cursor-pointer hover:shadow-md transition-all"
                      onClick={() => handleChatClick(chat)}
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                          <Users className="w-6 h-6 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <h3 className="font-semibold truncate">
                              {chat.patient?.full_name || 'Неизвестный пациент'}
                            </h3>
                            {chat.lastMessage && (
                              <span className="text-xs text-muted-foreground">
                                {formatTime(chat.lastMessage.created_at)}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mb-2">
                            {chat.patient?.diagnosis}
                          </p>
                          {chat.lastMessage ? (
                            <p className="text-sm text-muted-foreground truncate">
                              {chat.lastMessage.sender_id === user?.id ? 'Вы: ' : ''}
                              {chat.lastMessage.content}
                            </p>
                          ) : (
                            <p className="text-sm text-muted-foreground italic">
                              Нет сообщений
                            </p>
                          )}
                          <div className="flex items-center gap-2 mt-2">
                            <Badge variant="outline" className="text-xs">
                              <Users className="w-3 h-3 mr-1" />
                              {chat.participants.length} участников
                            </Badge>
                          </div>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Chats;
