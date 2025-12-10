import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  ChevronLeft, Send, Paperclip, Users, Loader2, Calendar
} from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { RealtimeChannel } from "@supabase/supabase-js";
import { sendNotifications } from "@/lib/notifications";
import { FileUploadButton } from "@/components/FileUploadButton";
import { MessageFile } from "@/components/MessageFile";

interface Patient {
  id: string;
  full_name: string;
  diagnosis: string;
  room: string | null;
  date_of_birth?: string;
}

interface Message {
  id: string;
  content: string;
  created_at: string;
  sender_id: string;
  file_url: string | null;
  sender?: {
    full_name: string;
    avatar_url: string | null;
    user_roles?: Array<{
      role: string;
    }>;
  };
}

interface Participant {
  id: string;
  user_id: string;
  profiles: {
    full_name: string;
    avatar_url: string | null;
  };
  user_roles?: Array<{
    role: string;
  }>;
}

interface Chat {
  id: string;
  name: string | null;
}

const PatientChat = () => {
  const navigate = useNavigate();
  const { patientId } = useParams();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [creating, setCreating] = useState(false);
  const [patient, setPatient] = useState<Patient | null>(null);
  const [chat, setChat] = useState<Chat | null>(null);
  const [chatNotFound, setChatNotFound] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [messageText, setMessageText] = useState("");
  const [uploadedFile, setUploadedFile] = useState<{ url: string; name: string } | null>(null);
  
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    if (!patientId || patientId === ':patientId') {
      navigate('/patients');
      return;
    }
    
    loadPatientAndChat();
    
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [patientId]);

  const loadPatientAndChat = async () => {
    try {
      // Load patient
      const { data: patientData, error: patientError } = await supabase
        .from('patients')
        .select('id, full_name, diagnosis, room, date_of_birth')
        .eq('id', patientId)
        .single();

      if (patientError) throw patientError;
      setPatient(patientData);

      // Find chat for this patient - use a more specific query
      const { data: chatData, error: chatError } = await supabase
        .from('chats')
        .select(`
          *,
          chat_participants!inner(user_id)
        `)
        .eq('patient_id', patientId)
        .eq('type', 'patient_chat')
        .eq('chat_participants.user_id', user?.id)
        .maybeSingle();

      if (chatError) {
        console.error('Chat query error:', chatError);
        throw chatError;
      }

      if (chatData) {
        setChat(chatData);
        setChatNotFound(false);
        await loadChatData(chatData.id);
      } else {
        setChatNotFound(true);
      }
    } catch (error) {
      console.error('Error loading patient and chat:', error);
      toast({
        title: "Ошибка",
        description: "Не удалось загрузить данные",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadChatData = async (chatId: string) => {
      // Load participants with roles
      const { data: participantsData, error: participantsError } = await supabase
        .from('chat_participants')
        .select(`
          id,
          user_id,
          profiles:user_id (
            full_name,
            avatar_url
          ),
          user_roles:user_id (
            role
          )
        `)
        .eq('chat_id', chatId);

    if (participantsError) {
      console.error('Error loading participants:', participantsError);
    } else {
      setParticipants(participantsData as any);
    }

    // Load messages
    await loadMessages(chatId);

    // Subscribe to new messages
    subscribeToMessages(chatId);
  };

  const loadMessages = async (chatId: string) => {
    const { data: messagesData, error: messagesError } = await supabase
      .from('messages')
      .select(`
        id,
        content,
        created_at,
        sender_id,
        file_url,
        sender:profiles!messages_sender_id_fkey (
          full_name,
          avatar_url
        )
      `)
      .eq('chat_id', chatId)
      .order('created_at', { ascending: true });

    if (messagesError) {
      console.error('Error loading messages:', messagesError);
    } else {
      setMessages(messagesData as any);
      setTimeout(scrollToBottom, 100);
    }
  };

  const subscribeToMessages = (chatId: string) => {
    const channel = supabase
      .channel(`messages:${chatId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `chat_id=eq.${chatId}`
        },
        async (payload) => {
          const newMessage = payload.new as Message;
          
          // Fetch sender profile
          const { data: senderData } = await supabase
            .from('profiles')
            .select('full_name, avatar_url')
            .eq('id', newMessage.sender_id)
            .single();

          setMessages(prev => [...prev, {
            ...newMessage,
            sender: senderData || undefined
          }]);
          
          setTimeout(scrollToBottom, 100);
        }
      )
      .subscribe();

    channelRef.current = channel;
  };

  const scrollToBottom = () => {
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  };

  const handleSendMessage = async () => {
    if ((!messageText.trim() && !uploadedFile) || !chat || !user) return;

    setSending(true);
    try {
      const { error } = await supabase
        .from('messages')
        .insert({
          chat_id: chat.id,
          sender_id: user.id,
          content: messageText.trim() || (uploadedFile ? uploadedFile.name : ''),
          file_url: uploadedFile?.url || null,
        });

      if (error) throw error;
      
      // Send notifications to all participants except sender
      const recipientIds = participants
        .filter(p => p.user_id !== user.id)
        .map(p => p.user_id);

      if (recipientIds.length > 0 && patient) {
        const notificationMessage = uploadedFile 
          ? `Отправил файл: ${uploadedFile.name}`
          : messageText.trim().substring(0, 100);
        
        await sendNotifications({
          userIds: recipientIds,
          type: 'message',
          title: `Новое сообщение: ${patient.full_name}`,
          message: notificationMessage,
          relatedId: chat.id,
        });
      }
      
      setMessageText("");
      setUploadedFile(null);
    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        title: "Ошибка",
        description: "Не удалось отправить сообщение",
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  const handleFileUploaded = (fileUrl: string, fileName: string) => {
    setUploadedFile({ url: fileUrl, name: fileName });
  };

  const handleCreateChat = async () => {
    if (!patient || !user) return;

    setCreating(true);
    try {
      // Create chat
      const { data: newChat, error: chatError } = await supabase
        .from('chats')
        .insert({
          patient_id: patient.id,
          type: 'patient_chat',
          name: `Чат по пациенту: ${patient.full_name}`,
        })
        .select()
        .single();

      if (chatError) throw chatError;

      // Add current user as participant
      const { error: participantError } = await supabase
        .from('chat_participants')
        .insert({
          chat_id: newChat.id,
          user_id: user.id,
        });

      if (participantError) throw participantError;

      toast({
        title: "Чат создан",
        description: "Чат успешно создан",
      });

      setChat(newChat);
      setChatNotFound(false);
      await loadChatData(newChat.id);
    } catch (error) {
      console.error('Error creating chat:', error);
      toast({
        title: "Ошибка",
        description: "Не удалось создать чат",
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('ru-RU', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getRoleLabel = (role?: string) => {
    const roleMap: Record<string, string> = {
      'doctor': 'Врач',
      'nurse': 'Медсестра',
      'admin': 'Администратор',
      'chief_doctor': 'Главврач',
      'department_head': 'Заведующий отделением',
      'orderly': 'Санитар'
    };
    return role ? roleMap[role] || role : '';
  };

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Загрузка чата...</p>
        </div>
      </div>
    );
  }

  if (!patient) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <Card className="p-8 text-center">
          <p className="text-muted-foreground mb-4">Пациент не найден</p>
          <Button onClick={() => navigate('/patients')}>
            Вернуться к пациентам
          </Button>
        </Card>
      </div>
    );
  }

  if (chatNotFound && !chat) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <Card className="p-8 text-center max-w-md">
          <h2 className="text-xl font-bold mb-2">Чат не найден</h2>
          <p className="text-muted-foreground mb-6">
            Чат для пациента {patient.full_name} еще не создан. Создайте новый чат для начала общения.
          </p>
          <div className="flex gap-3 justify-center">
            <Button 
              variant="outline" 
              onClick={() => navigate('/patients')}
            >
              Вернуться к пациентам
            </Button>
            <Button 
              onClick={handleCreateChat}
              disabled={creating}
            >
              {creating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Создание...
                </>
              ) : (
                'Создать чат'
              )}
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  if (!chat) {
    return null;
  }

  return (
    <div className="min-h-screen bg-[#F8F9FA]">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate("/patients")}>
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-gray-900">Чат врачей</h1>
                  <Badge variant="secondary" className="bg-gray-100 text-gray-600 hover:bg-gray-100">
                    <Users className="h-3 w-3 mr-1" />
                    {participants.length} участника
                  </Badge>
                </div>
                <p className="text-sm text-gray-500 mt-0.5">
                  Пациент: {patient.full_name}, {new Date().getFullYear() - new Date(patient.date_of_birth || '2000-01-01').getFullYear()} лет{patient.room && `, Палата ${patient.room}`}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Chat Container */}
      <div className="max-w-5xl mx-auto px-6 py-6">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col h-[calc(100vh-180px)]">
          {/* Messages Area */}
          <ScrollArea className="flex-1 p-6" ref={scrollAreaRef}>
            <div className="space-y-6">
              {messages.map((msg) => {
                const isMe = msg.sender_id === user?.id;
                const senderRole = msg.sender?.user_roles?.[0]?.role;
                return (
                  <div
                    key={msg.id}
                    className={`flex gap-3 ${isMe ? 'flex-row-reverse' : ''}`}
                  >
                    <Avatar className="h-10 w-10 flex-shrink-0">
                      <AvatarFallback className={isMe ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'}>
                        {getInitials(msg.sender?.full_name || 'U')}
                      </AvatarFallback>
                    </Avatar>
                    
                    <div className={`flex-1 ${isMe ? 'flex flex-col items-end' : ''}`}>
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-sm ${isMe ? 'text-gray-900' : 'text-gray-900'}`}>
                          {isMe ? 'Вы' : msg.sender?.full_name}
                        </span>
                        {senderRole && (
                          <>
                            <span className="text-xs text-gray-400">·</span>
                            <span className="text-xs text-gray-500">{getRoleLabel(senderRole)}</span>
                          </>
                        )}
                        <span className="text-xs text-gray-400">·</span>
                        <span className="text-xs text-gray-400">{formatTime(msg.created_at)}</span>
                      </div>
                      
                      <div
                        className={`rounded-2xl px-4 py-3 max-w-2xl ${
                          isMe
                            ? 'bg-[#0066FF] text-white'
                            : 'bg-gray-50 text-gray-900'
                        }`}
                      >
                        <p className="text-sm whitespace-pre-line leading-relaxed">
                          {msg.content}
                        </p>
                        {msg.file_url && (
                          <div className="mt-2">
                            <MessageFile fileUrl={msg.file_url} />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>

          {/* Message Input */}
          <div className="border-t border-gray-200 p-4">
            {uploadedFile && (
              <div className="mb-2 flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
                <span className="text-sm flex-1 text-gray-700">Файл: {uploadedFile.name}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setUploadedFile(null)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  Отменить
                </Button>
              </div>
            )}
            <div className="flex items-end gap-3">
              <Button
                variant="ghost"
                size="icon"
                className="h-10 w-10 flex-shrink-0 text-gray-500 hover:text-gray-700"
                onClick={() => {}}
                disabled={sending}
              >
                <Paperclip className="h-5 w-5" />
              </Button>
              
              <div className="flex-1 bg-gray-50 rounded-xl border border-gray-200 focus-within:border-blue-500 transition-colors">
                <Input
                  placeholder="Введите сообщение..."
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  onKeyPress={handleKeyPress}
                  disabled={sending}
                  className="border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 px-4 py-3"
                />
              </div>
              
              <Button
                size="icon"
                className="h-10 w-10 flex-shrink-0 bg-[#0066FF] hover:bg-[#0052CC] text-white"
                onClick={handleSendMessage}
                disabled={(!messageText.trim() && !uploadedFile) || sending}
              >
                {sending ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Send className="h-5 w-5" />
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PatientChat;
