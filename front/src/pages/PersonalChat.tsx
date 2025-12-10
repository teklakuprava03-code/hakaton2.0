import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  ArrowLeft, Send, Loader2, Phone, Video
} from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { RealtimeChannel } from "@supabase/supabase-js";
import { sendNotifications } from "@/lib/notifications";
import { FileUploadButton } from "@/components/FileUploadButton";
import { MessageFile } from "@/components/MessageFile";

interface Message {
  id: string;
  content: string;
  created_at: string;
  sender_id: string;
  file_url: string | null;
  sender?: {
    full_name: string;
    avatar_url: string | null;
  };
}

interface Participant {
  id: string;
  user_id: string;
  profiles: {
    full_name: string;
    avatar_url: string | null;
    email: string;
  };
}

interface Chat {
  id: string;
  name: string | null;
}

const PersonalChat = () => {
  const navigate = useNavigate();
  const { chatId } = useParams();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [chat, setChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [otherParticipant, setOtherParticipant] = useState<Participant | null>(null);
  const [messageText, setMessageText] = useState("");
  const [uploadedFile, setUploadedFile] = useState<{ url: string; name: string } | null>(null);
  
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    if (!chatId) return;
    
    loadChatData();
    
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [chatId]);

  const loadChatData = async () => {
    try {
      // Load chat
      const { data: chatData, error: chatError } = await supabase
        .from('chats')
        .select('*')
        .eq('id', chatId)
        .eq('type', 'personal')
        .single();

      if (chatError) throw chatError;
      setChat(chatData);

      // Load participants
      const { data: participantsData, error: participantsError } = await supabase
        .from('chat_participants')
        .select(`
          id,
          user_id,
          profiles:user_id (
            full_name,
            avatar_url,
            email
          )
        `)
        .eq('chat_id', chatId);

      if (participantsError) throw participantsError;

      const typedParticipants = participantsData as any as Participant[];
      setParticipants(typedParticipants);
      
      // Find the other participant
      const other = typedParticipants.find(p => p.user_id !== user?.id);
      setOtherParticipant(other || null);

      // Load messages
      await loadMessages(chatId);

      // Subscribe to new messages
      subscribeToMessages(chatId);
    } catch (error) {
      console.error('Error loading chat:', error);
      toast({
        title: "Ошибка",
        description: "Не удалось загрузить чат",
        variant: "destructive",
      });
      navigate("/chats");
    } finally {
      setLoading(false);
    }
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
      
      // Send notification to the other participant
      if (otherParticipant) {
        const notificationMessage = uploadedFile 
          ? `Отправил файл: ${uploadedFile.name}`
          : messageText.trim().substring(0, 100);
        
        await sendNotifications({
          userIds: [otherParticipant.user_id],
          type: 'message',
          title: `Новое сообщение от ${user.email}`,
          message: notificationMessage,
          relatedId: chat.id,
        });
      }
      
      setMessageText("");
      setUploadedFile(null);
    } catch (error: any) {
      console.error('Error sending message:', error);
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось отправить сообщение",
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
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
    return date.toLocaleTimeString('ru-RU', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return "Сегодня";
    } else if (date.toDateString() === yesterday.toDateString()) {
      return "Вчера";
    } else {
      return date.toLocaleDateString('ru-RU', { 
        day: 'numeric', 
        month: 'long' 
      });
    }
  };

  const groupMessagesByDate = () => {
    const groups: { [key: string]: Message[] } = {};
    
    messages.forEach(message => {
      const dateKey = new Date(message.created_at).toDateString();
      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(message);
    });

    return Object.entries(groups).map(([dateKey, msgs]) => ({
      date: dateKey,
      messages: msgs
    }));
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Загрузка чата...</p>
        </div>
      </div>
    );
  }

  if (!otherParticipant) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="p-8 text-center">
          <p className="text-muted-foreground">Участник чата не найден</p>
          <Button onClick={() => navigate("/chats")} className="mt-4">
            Вернуться к чатам
          </Button>
        </Card>
      </div>
    );
  }

  const messageGroups = groupMessagesByDate();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => navigate("/chats")}>
                  <ArrowLeft className="w-5 h-5" />
                </Button>
                <Avatar className="w-10 h-10">
                  {otherParticipant.profiles.avatar_url ? (
                    <AvatarImage src={otherParticipant.profiles.avatar_url} alt={otherParticipant.profiles.full_name} />
                  ) : null}
                  <AvatarFallback className="bg-primary/10 text-primary">
                    {getInitials(otherParticipant.profiles.full_name)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h1 className="text-lg font-semibold">{otherParticipant.profiles.full_name}</h1>
                  <p className="text-sm text-muted-foreground">{otherParticipant.profiles.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button 
                  variant="ghost" 
                  size="icon"
                  onClick={() => toast({
                    title: "Телефонный звонок",
                    description: "Функция в разработке",
                  })}
                >
                  <Phone className="w-5 h-5" />
                </Button>
                <Button 
                  variant="ghost" 
                  size="icon"
                  onClick={() => toast({
                    title: "Видеозвонок",
                    description: "Функция в разработке",
                  })}
                >
                  <Video className="w-5 h-5" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 container mx-auto px-4 py-6">
        <ScrollArea className="h-[calc(100vh-240px)]" ref={scrollAreaRef}>
          <div className="space-y-6">
            {messageGroups.map(group => (
              <div key={group.date}>
                <div className="flex justify-center mb-4">
                  <span className="text-xs text-muted-foreground bg-muted px-3 py-1 rounded-full">
                    {formatDate(group.messages[0].created_at)}
                  </span>
                </div>
                <div className="space-y-4">
                  {group.messages.map((message) => {
                    const isOwn = message.sender_id === user?.id;
                    return (
                      <div
                        key={message.id}
                        className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}
                      >
                        <div className={`flex gap-3 max-w-[70%] ${isOwn ? 'flex-row-reverse' : 'flex-row'}`}>
                          {!isOwn && (
                            <Avatar className="w-8 h-8 flex-shrink-0">
                              <AvatarFallback className="bg-primary/10 text-primary text-xs">
                                {message.sender ? getInitials(message.sender.full_name) : '?'}
                              </AvatarFallback>
                            </Avatar>
                          )}
                          <div className={`space-y-1 ${isOwn ? 'items-end' : 'items-start'} flex flex-col`}>
                            {!isOwn && message.sender && (
                              <span className="text-xs text-muted-foreground font-medium">
                                {message.sender.full_name}
                              </span>
                            )}
                            <div
                              className={`px-4 py-2 rounded-2xl ${
                                isOwn
                                  ? 'bg-primary text-primary-foreground'
                                  : 'bg-muted'
                              }`}
                            >
                              {message.file_url && (
                                <MessageFile 
                                  fileUrl={message.file_url}
                                  fileName={message.content}
                                />
                              )}
                              {message.content && !message.file_url && (
                                <p className="text-sm whitespace-pre-wrap break-words">
                                  {message.content}
                                </p>
                              )}
                            </div>
                            <span className="text-xs text-muted-foreground">
                              {formatTime(message.created_at)}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Message Input */}
      <div className="border-t bg-card sticky bottom-0">
        <div className="container mx-auto px-4 py-4">
          {uploadedFile && (
            <div className="mb-2 p-2 bg-muted rounded-lg flex items-center justify-between">
              <span className="text-sm truncate">{uploadedFile.name}</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setUploadedFile(null)}
              >
                Удалить
              </Button>
            </div>
          )}
          <div className="flex gap-2">
            <FileUploadButton
              onFileUploaded={(url, fileName) => setUploadedFile({ url, name: fileName })}
              disabled={sending}
            />
            <Input
              placeholder="Введите сообщение..."
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              onKeyPress={handleKeyPress}
              disabled={sending}
              className="flex-1"
            />
            <Button
              onClick={handleSendMessage}
              disabled={(!messageText.trim() && !uploadedFile) || sending}
              size="icon"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PersonalChat;
