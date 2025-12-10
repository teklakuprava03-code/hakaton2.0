import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { MessageSquare, Plus, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";

interface NewChatDialogProps {
  onChatCreated?: () => void;
}

export function NewChatDialog({ onChatCreated }: NewChatDialogProps) {
  const [open, setOpen] = useState(false);
  const [chatType, setChatType] = useState<"personal" | "patient_chat">("personal");
  const [selectedUser, setSelectedUser] = useState<string>("");
  const [selectedPatient, setSelectedPatient] = useState<string>("");
  const [selectedDoctors, setSelectedDoctors] = useState<string[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [patients, setPatients] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    if (open) {
      loadUsers();
      loadPatients();
    }
  }, [open]);

  const loadUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .neq('id', user?.id)
        .order('full_name');
      
      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error('Error loading users:', error);
    }
  };

  const loadPatients = async () => {
    try {
      const { data, error } = await supabase
        .from('patients')
        .select('id, full_name, diagnosis')
        .order('full_name');
      
      if (error) throw error;
      setPatients(data || []);
    } catch (error) {
      console.error('Error loading patients:', error);
    }
  };

  const handleCreateChat = async () => {
    if (!user) return;

    if (chatType === "personal" && !selectedUser) {
      toast({
        title: "Ошибка",
        description: "Выберите собеседника",
        variant: "destructive",
      });
      return;
    }

    if (chatType === "patient_chat" && (!selectedPatient || selectedDoctors.length === 0)) {
      toast({
        title: "Ошибка",
        description: "Выберите пациента и хотя бы одного врача",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      if (chatType === "personal") {
        // Create personal chat
        const otherUser = users.find(u => u.id === selectedUser);
        const chatName = `${user.email} ↔ ${otherUser?.email}`;
        
        const { data: chatData, error: chatError } = await supabase
          .from('chats')
          .insert({
            type: 'personal',
            name: chatName,
          })
          .select()
          .single();

        if (chatError) throw chatError;

        // Add participants
        const { error: participantsError } = await supabase
          .from('chat_participants')
          .insert([
            { chat_id: chatData.id, user_id: user.id },
            { chat_id: chatData.id, user_id: selectedUser },
          ]);

        if (participantsError) throw participantsError;

        toast({
          title: "Успех",
          description: "Личный чат создан",
        });
      } else {
        // Create patient chat
        const patient = patients.find(p => p.id === selectedPatient);
        const chatName = `Чат по пациенту: ${patient?.full_name}`;
        
        const { data: chatData, error: chatError } = await supabase
          .from('chats')
          .insert({
            type: 'patient_chat',
            name: chatName,
            patient_id: selectedPatient,
          })
          .select()
          .single();

        if (chatError) throw chatError;

        // Add current user and selected doctors as participants
        const participantIds = [user.id, ...selectedDoctors];
        const participants = participantIds.map(id => ({
          chat_id: chatData.id,
          user_id: id,
        }));

        const { error: participantsError } = await supabase
          .from('chat_participants')
          .insert(participants);

        if (participantsError) throw participantsError;

        toast({
          title: "Успех",
          description: "Чат по пациенту создан",
        });

        navigate(`/patients/${selectedPatient}/chat`);
      }

      setOpen(false);
      onChatCreated?.();
      
      // Reset form
      setSelectedUser("");
      setSelectedPatient("");
      setSelectedDoctors([]);
    } catch (error: any) {
      console.error('Error creating chat:', error);
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось создать чат",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleDoctor = (doctorId: string) => {
    setSelectedDoctors(prev => 
      prev.includes(doctorId) 
        ? prev.filter(id => id !== doctorId)
        : [...prev, doctorId]
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="w-4 h-4 mr-2" />
          Новый чат
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Создать новый чат</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div>
            <Label>Тип чата</Label>
            <Select value={chatType} onValueChange={(v: any) => setChatType(v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="personal">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="w-4 h-4" />
                    Личный чат
                  </div>
                </SelectItem>
                <SelectItem value="patient_chat">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    Чат по пациенту
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {chatType === "personal" && (
            <div>
              <Label>Собеседник</Label>
              <Select value={selectedUser} onValueChange={setSelectedUser}>
                <SelectTrigger>
                  <SelectValue placeholder="Выберите пользователя" />
                </SelectTrigger>
                <SelectContent>
                  {users.map(u => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.full_name} ({u.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {chatType === "patient_chat" && (
            <>
              <div>
                <Label>Пациент</Label>
                <Select value={selectedPatient} onValueChange={setSelectedPatient}>
                  <SelectTrigger>
                    <SelectValue placeholder="Выберите пациента" />
                  </SelectTrigger>
                  <SelectContent>
                    {patients.map(p => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.full_name} - {p.diagnosis}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Участники (врачи)</Label>
                <div className="border rounded-md p-3 max-h-48 overflow-y-auto space-y-2">
                  {users.map(u => (
                    <label key={u.id} className="flex items-center gap-2 cursor-pointer hover:bg-accent p-2 rounded">
                      <input
                        type="checkbox"
                        checked={selectedDoctors.includes(u.id)}
                        onChange={() => toggleDoctor(u.id)}
                        className="rounded"
                      />
                      <span className="text-sm">{u.full_name}</span>
                    </label>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Выбрано: {selectedDoctors.length}
                </p>
              </div>
            </>
          )}

          <div className="flex gap-2 pt-4">
            <Button
              onClick={handleCreateChat}
              disabled={loading}
              className="flex-1"
            >
              {loading ? "Создание..." : "Создать чат"}
            </Button>
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={loading}
            >
              Отмена
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
