import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  ArrowLeft, Send, Loader2, Bot, User, Sparkles
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

const AIAssistant = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "Здравствуйте! Я AI-ассистент MedAI. Могу помочь с анализом симптомов, рекомендациями по диагностике и информацией о медицинских процедурах. Чем могу быть полезен?",
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      role: "user",
      content: input.trim(),
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      // TODO: Интеграция с Lovable AI
      // Здесь будет вызов AI edge function
      
      // Временная заглушка
      setTimeout(() => {
        const assistantMessage: Message = {
          role: "assistant",
          content: "Функция AI-ассистента находится в разработке. Скоро здесь будет интеграция с Lovable AI для медицинских консультаций и анализа данных пациентов.",
          timestamp: new Date()
        };
        setMessages(prev => [...prev, assistantMessage]);
        setIsLoading(false);
      }, 1000);

    } catch (error: any) {
      console.error('Error sending message:', error);
      toast.error("Ошибка отправки сообщения");
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('ru-RU', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-primary to-primary/60 rounded-full flex items-center justify-center">
                  <Bot className="w-6 h-6 text-primary-foreground" />
                </div>
                <div>
                  <h1 className="text-lg font-semibold">AI Ассистент</h1>
                  <p className="text-sm text-muted-foreground">Медицинский помощник на базе ИИ</p>
                </div>
              </div>
            </div>
            <Sparkles className="w-5 h-5 text-primary" />
          </div>
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 container mx-auto px-4 py-6">
        <ScrollArea className="h-[calc(100vh-220px)]" ref={scrollAreaRef}>
          <div className="space-y-6 max-w-4xl mx-auto">
            {messages.map((message, index) => (
              <div
                key={index}
                className={`flex gap-4 ${message.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
              >
                <Avatar className="w-10 h-10 flex-shrink-0">
                  <AvatarFallback className={message.role === 'assistant' ? 'bg-gradient-to-br from-primary to-primary/60' : 'bg-primary/10'}>
                    {message.role === 'assistant' ? (
                      <Bot className="w-5 h-5 text-primary-foreground" />
                    ) : (
                      <User className="w-5 h-5 text-primary" />
                    )}
                  </AvatarFallback>
                </Avatar>

                <div className={`flex flex-col ${message.role === 'user' ? 'items-end' : 'items-start'} max-w-[80%]`}>
                  <div
                    className={`px-4 py-3 rounded-2xl ${
                      message.role === 'assistant'
                        ? 'bg-muted'
                        : 'bg-primary text-primary-foreground'
                    }`}
                  >
                    <p className="text-sm whitespace-pre-wrap break-words">
                      {message.content}
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground mt-1">
                    {formatTime(message.timestamp)}
                  </span>
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex gap-4">
                <Avatar className="w-10 h-10 flex-shrink-0">
                  <AvatarFallback className="bg-gradient-to-br from-primary to-primary/60">
                    <Bot className="w-5 h-5 text-primary-foreground" />
                  </AvatarFallback>
                </Avatar>
                <div className="bg-muted px-4 py-3 rounded-2xl">
                  <Loader2 className="w-5 h-5 animate-spin text-primary" />
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Input */}
      <div className="border-t bg-card sticky bottom-0">
        <div className="container mx-auto px-4 py-4">
          <div className="max-w-4xl mx-auto">
            <Card className="p-2">
              <div className="flex gap-2">
                <Input
                  placeholder="Задайте вопрос AI-ассистенту..."
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyPress={handleKeyPress}
                  disabled={isLoading}
                  className="flex-1 border-0 focus-visible:ring-0"
                />
                <Button
                  onClick={handleSend}
                  disabled={!input.trim() || isLoading}
                  size="icon"
                  className="flex-shrink-0"
                >
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </Button>
              </div>
            </Card>
            <p className="text-xs text-center text-muted-foreground mt-2">
              AI может совершать ошибки. Проверяйте важную информацию.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AIAssistant;
