import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { 
  ArrowLeft, Plus, Calendar, Clock, Users, FileText, Loader2
} from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { sendNotifications } from "@/lib/notifications";
import { CouncilFileUpload } from "@/components/CouncilFileUpload";
import { useCouncilRealtime } from "@/hooks/useCouncilRealtime";

interface Patient {
  id: string;
  full_name: string;
  diagnosis: string;
}

interface Council {
  id: string;
  title: string;
  date: string;
  time: string;
  status: string;
  location: string | null;
  summary: string | null;
  transcript: string | null;
  has_ai_summary: boolean;
}

interface Participant {
  id: string;
  role: string | null;
  profiles: {
    full_name: string;
    avatar_url: string | null;
  };
}

const Council = () => {
  const navigate = useNavigate();
  const { patientId } = useParams();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [summarizing, setSummarizing] = useState(false);
  const [patient, setPatient] = useState<Patient | null>(null);
  const [councils, setCouncils] = useState<Council[]>([]);
  const [selectedCouncil, setSelectedCouncil] = useState<Council | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  
  // Form state
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [location, setLocation] = useState("");

  useEffect(() => {
    if (patientId) {
      loadData();
    }
  }, [patientId]);

  useEffect(() => {
    if (selectedCouncil) {
      loadParticipants(selectedCouncil.id);
    }
  }, [selectedCouncil]);

  const loadData = async () => {
    try {
      // Load patient
      const { data: patientData, error: patientError } = await supabase
        .from('patients')
        .select('id, full_name, diagnosis')
        .eq('id', patientId)
        .single();

      if (patientError) throw patientError;
      setPatient(patientData);

      // Load councils
      const { data: councilsData, error: councilsError } = await supabase
        .from('councils')
        .select('*')
        .eq('patient_id', patientId)
        .order('date', { ascending: false });

      if (councilsError) throw councilsError;
      setCouncils(councilsData || []);
      
      if (councilsData && councilsData.length > 0) {
        setSelectedCouncil(councilsData[0]);
      }
    } catch (error) {
      console.error('Error loading data:', error);
      toast({
        title: "Ошибка",
        description: "Не удалось загрузить данные",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Real-time updates for councils
  useCouncilRealtime(loadData);

  const loadParticipants = async (councilId: string) => {
    try {
      const { data, error } = await supabase
        .from('council_participants')
        .select(`
          id,
          role,
          profiles:user_id (
            full_name,
            avatar_url
          )
        `)
        .eq('council_id', councilId);

      if (error) throw error;
      setParticipants(data as any);
    } catch (error) {
      console.error('Error loading participants:', error);
    }
  };

  const handleCreateCouncil = async () => {
    if (!title.trim() || !date || !time || !patientId || !user) {
      toast({
        title: "Ошибка",
        description: "Заполните все обязательные поля",
        variant: "destructive",
      });
      return;
    }

    setCreating(true);
    try {
      // Create council
      const { data: councilData, error: councilError } = await supabase
        .from('councils')
        .insert({
          patient_id: patientId,
          title: title.trim(),
          date,
          time,
          location: location.trim() || null,
          status: 'scheduled',
        })
        .select()
        .single();

      if (councilError) throw councilError;

      // Add current user as participant
      const { error: participantError } = await supabase
        .from('council_participants')
        .insert({
          council_id: councilData.id,
          user_id: user.id,
          role: 'organizer',
        });

      if (participantError) throw participantError;

      // Send notifications to all medical staff about new council
      const { data: medicalStaff } = await supabase
        .from('profiles')
        .select('id')
        .neq('id', user.id);

      if (medicalStaff && medicalStaff.length > 0 && patient) {
        await sendNotifications({
          userIds: medicalStaff.map(s => s.id),
          type: 'council',
          title: 'Новый консилиум',
          message: `Запланирован консилиум: ${title.trim()} - ${patient.full_name}`,
          relatedId: councilData.id,
        });
      }

      toast({
        title: "Успешно",
        description: "Консилиум создан",
      });

      // Reload councils
      await loadData();
      setDialogOpen(false);
      
      // Reset form
      setTitle("");
      setDate("");
      setTime("");
      setLocation("");
    } catch (error) {
      console.error('Error creating council:', error);
      toast({
        title: "Ошибка",
        description: "Не удалось создать консилиум",
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  };

  const handleSummarize = async (filePath?: string) => {
    if (!selectedCouncil) return;

    setSummarizing(true);
    try {
      const { data, error } = await supabase.functions.invoke('summarize-council', {
        body: { 
          councilId: selectedCouncil.id,
          filePath: filePath || undefined
        },
      });

      if (error) throw error;

      toast({
        title: "Успешно",
        description: "Резюме создано с помощью AI",
      });

      // Update local state with the summary and transcript
      setSelectedCouncil({
        ...selectedCouncil,
        transcript: data.transcript || selectedCouncil.transcript,
        summary: data.summary,
        has_ai_summary: true,
      });

      // Reload councils to update the list
      await loadData();
    } catch (error) {
      console.error('Error summarizing council:', error);
      toast({
        title: "Ошибка",
        description: "Не удалось создать резюме",
        variant: "destructive",
      });
    } finally {
      setSummarizing(false);
    }
  };

  const handleFileUpload = async (filePath: string) => {
    // Automatically summarize after file upload
    await handleSummarize(filePath);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "scheduled":
        return { label: "Запланирован", variant: "secondary" as const };
      case "in_progress":
        return { label: "Идёт", variant: "default" as const };
      case "completed":
        return { label: "Завершён", variant: "outline" as const };
      case "cancelled":
        return { label: "Отменён", variant: "destructive" as const };
      default:
        return { label: status, variant: "secondary" as const };
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Загрузка консилиумов...</p>
        </div>
      </div>
    );
  }

  if (!patient) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="p-8 text-center">
          <p className="text-muted-foreground mb-4">Пациент не найден</p>
          <Button onClick={() => navigate('/patients')}>
            Вернуться к пациентам
          </Button>
        </Card>
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
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => navigate(`/patients/${patientId}/chat`)}
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div>
                <h1 className="text-lg font-bold">Консилиумы</h1>
                <p className="text-sm text-muted-foreground">
                  {patient.full_name} • {patient.diagnosis}
                </p>
              </div>
            </div>
            
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  Создать консилиум
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Новый консилиум</DialogTitle>
                  <DialogDescription>
                    Создайте консилиум для пациента {patient.full_name}
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="title">Название *</Label>
                    <Input
                      id="title"
                      placeholder="Например: Обсуждение тактики лечения"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="date">Дата *</Label>
                      <Input
                        id="date"
                        type="date"
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="time">Время *</Label>
                      <Input
                        id="time"
                        type="time"
                        value={time}
                        onChange={(e) => setTime(e.target.value)}
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="location">Место проведения</Label>
                    <Input
                      id="location"
                      placeholder="Например: Кабинет 305"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                    />
                  </div>
                  <Button 
                    onClick={handleCreateCouncil} 
                    disabled={creating}
                    className="w-full"
                  >
                    {creating ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Создание...
                      </>
                    ) : (
                      'Создать консилиум'
                    )}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6">
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Councils List */}
          <Card className="lg:col-span-1 p-4">
            <h3 className="font-semibold mb-4">История консилиумов</h3>
            {councils.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                Консилиумы еще не проводились
              </p>
            ) : (
              <ScrollArea className="h-[calc(100vh-250px)]">
                <div className="space-y-3">
                  {councils.map((council) => {
                    const statusBadge = getStatusBadge(council.status);
                    return (
                      <Card
                        key={council.id}
                        className={`p-4 cursor-pointer transition-all ${
                          selectedCouncil?.id === council.id
                            ? 'border-primary bg-primary/5'
                            : 'hover:bg-accent'
                        }`}
                        onClick={() => setSelectedCouncil(council)}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <h4 className="font-medium text-sm">{council.title}</h4>
                          <Badge variant={statusBadge.variant}>
                            {statusBadge.label}
                          </Badge>
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Calendar className="w-3 h-3" />
                            {formatDate(council.date)}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Clock className="w-3 h-3" />
                            {council.time}
                          </div>
                          {council.location && (
                            <p className="text-xs text-muted-foreground">
                              {council.location}
                            </p>
                          )}
                        </div>
                      </Card>
                    );
                  })}
                </div>
              </ScrollArea>
            )}
          </Card>

          {/* Council Details */}
          <Card className="lg:col-span-2 p-6">
            {selectedCouncil ? (
              <>
                <div className="mb-6">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h2 className="text-2xl font-bold mb-2">
                        {selectedCouncil.title}
                      </h2>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4" />
                          {formatDate(selectedCouncil.date)}
                        </div>
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4" />
                          {selectedCouncil.time}
                        </div>
                      </div>
                    </div>
                    <Badge variant={getStatusBadge(selectedCouncil.status).variant}>
                      {getStatusBadge(selectedCouncil.status).label}
                    </Badge>
                  </div>
                  
                  {selectedCouncil.location && (
                    <p className="text-sm text-muted-foreground mb-4">
                      Место: {selectedCouncil.location}
                    </p>
                  )}
                </div>

                {/* Participants */}
                <div className="mb-6">
                  <div className="flex items-center gap-2 mb-4">
                    <Users className="w-5 h-5" />
                    <h3 className="font-semibold">Участники</h3>
                    <Badge variant="secondary">{participants.length}</Badge>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {participants.map((participant) => (
                      <div
                        key={participant.id}
                        className="flex items-center gap-3 p-3 border rounded-lg"
                      >
                        <Avatar className="w-10 h-10">
                          <AvatarFallback>
                            {getInitials(participant.profiles.full_name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {participant.profiles.full_name}
                          </p>
                          {participant.role && (
                            <p className="text-xs text-muted-foreground">
                              {participant.role}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Protocol/Summary */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <FileText className="w-5 h-5" />
                      <h3 className="font-semibold">
                        {selectedCouncil.has_ai_summary ? 'AI Резюме' : 'Протокол'}
                      </h3>
                    </div>
                    <div className="flex items-center gap-2">
                      {!selectedCouncil.has_ai_summary && (
                        <CouncilFileUpload 
                          councilId={selectedCouncil.id}
                          onUploadComplete={handleFileUpload}
                        />
                      )}
                      {selectedCouncil.transcript && !selectedCouncil.has_ai_summary && (
                        <Button
                          onClick={() => handleSummarize()}
                          disabled={summarizing}
                          size="sm"
                        >
                          {summarizing ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              Суммаризация...
                            </>
                          ) : (
                            'Суммаризировать'
                          )}
                        </Button>
                      )}
                    </div>
                  </div>
                  {selectedCouncil.transcript || selectedCouncil.summary ? (
                    <Card className="p-4 bg-muted/50">
                      <ScrollArea className="h-[300px]">
                        <p className="text-sm whitespace-pre-wrap">
                          {selectedCouncil.summary || selectedCouncil.transcript}
                        </p>
                      </ScrollArea>
                    </Card>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
                      <p className="text-sm mb-4">Протокол еще не загружен</p>
                      <CouncilFileUpload 
                        councilId={selectedCouncil.id}
                        onUploadComplete={handleFileUpload}
                      />
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <Calendar className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p>Выберите консилиум для просмотра деталей</p>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Council;
