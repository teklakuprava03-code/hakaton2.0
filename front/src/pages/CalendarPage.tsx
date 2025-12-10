import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  ArrowLeft, Calendar as CalendarIcon, Clock, Users, MapPin, Loader2
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Council {
  id: string;
  title: string;
  date: string;
  time: string;
  status: string;
  location: string | null;
  patient_id: string;
  patients: {
    full_name: string;
    diagnosis: string;
  };
  participants_count?: number;
}

const CalendarPage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [councils, setCouncils] = useState<Council[]>([]);

  useEffect(() => {
    loadCouncils();
  }, []);

  const loadCouncils = async () => {
    try {
      const { data, error } = await supabase
        .from('councils')
        .select(`
          id,
          title,
          date,
          time,
          status,
          location,
          patient_id,
          patients (
            full_name,
            diagnosis
          )
        `)
        .order('date', { ascending: true })
        .order('time', { ascending: true });

      if (error) throw error;

      // Load participants count for each council
      const councilsWithCounts = await Promise.all(
        (data || []).map(async (council: any) => {
          const { count } = await supabase
            .from('council_participants')
            .select('*', { count: 'exact', head: true })
            .eq('council_id', council.id);

          return {
            ...council,
            participants_count: count || 0,
          };
        })
      );

      setCouncils(councilsWithCounts);
    } catch (error) {
      console.error('Error loading councils:', error);
      toast({
        title: "Ошибка",
        description: "Не удалось загрузить консилиумы",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const selectedDateCouncils = useMemo(() => {
    if (!selectedDate) return [];
    
    const dateStr = selectedDate.toISOString().split('T')[0];
    return councils.filter(council => council.date === dateStr);
  }, [councils, selectedDate]);

  const upcomingCouncils = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    return councils.filter(council => {
      const councilDate = new Date(council.date);
      return councilDate >= today && council.status !== 'cancelled';
    });
  }, [councils]);

  const stats = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().split('T')[0];

    const weekLater = new Date(today);
    weekLater.setDate(weekLater.getDate() + 7);
    const weekLaterStr = weekLater.toISOString().split('T')[0];

    return {
      today: councils.filter(c => c.date === todayStr && c.status !== 'cancelled').length,
      week: councils.filter(c => {
        return c.date >= todayStr && c.date <= weekLaterStr && c.status !== 'cancelled';
      }).length,
      upcoming: upcomingCouncils.length,
    };
  }, [councils, upcomingCouncils]);

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

  const handleCouncilClick = (council: Council) => {
    navigate(`/patients/${council.patient_id}/council`);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Загрузка календаря...</p>
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
              <h1 className="text-xl font-bold">Календарь консилиумов</h1>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6">
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Calendar Widget */}
          <div>
            <Card className="p-4">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={setSelectedDate}
                className="rounded-md border-0"
              />
            </Card>

            <Card className="mt-4 p-4">
              <h3 className="font-semibold mb-3">Статистика</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Консилиумов сегодня</span>
                  <Badge>{stats.today}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">На этой неделе</span>
                  <Badge variant="secondary">{stats.week}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Предстоящих</span>
                  <Badge variant="outline">{stats.upcoming}</Badge>
                </div>
              </div>
            </Card>
          </div>

          {/* Events List */}
          <div className="lg:col-span-2">
            <Card className="p-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">
                  {selectedDate ? formatDate(selectedDate.toISOString()) : 'События'}
                </h2>
                <Badge variant="secondary">
                  {selectedDateCouncils.length} консилиумов
                </Badge>
              </div>

              {selectedDateCouncils.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <CalendarIcon className="w-16 h-16 mx-auto mb-4 opacity-50" />
                  <p className="text-sm">
                    На эту дату консилиумов не запланировано
                  </p>
                </div>
              ) : (
                <ScrollArea className="h-[calc(100vh-300px)]">
                  <div className="space-y-4">
                    {selectedDateCouncils.map((council) => {
                      const statusBadge = getStatusBadge(council.status);
                      return (
                        <Card
                          key={council.id}
                          className="p-4 cursor-pointer hover:shadow-md transition-all"
                          onClick={() => handleCouncilClick(council)}
                        >
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex-1">
                              <h3 className="font-semibold mb-1">{council.title}</h3>
                              <p className="text-sm text-muted-foreground">
                                {council.patients.full_name} • {council.patients.diagnosis}
                              </p>
                            </div>
                            <Badge variant={statusBadge.variant}>
                              {statusBadge.label}
                            </Badge>
                          </div>

                          <div className="grid grid-cols-2 gap-3 text-sm">
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <Clock className="w-4 h-4" />
                              {council.time}
                            </div>
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <Users className="w-4 h-4" />
                              {council.participants_count} участников
                            </div>
                            {council.location && (
                              <div className="flex items-center gap-2 text-muted-foreground col-span-2">
                                <MapPin className="w-4 h-4" />
                                {council.location}
                              </div>
                            )}
                          </div>
                        </Card>
                      );
                    })}
                  </div>
                </ScrollArea>
              )}
            </Card>

            {/* Upcoming Events */}
            {upcomingCouncils.length > 0 && (
              <Card className="p-4 mt-6">
                <h3 className="font-semibold mb-4">Предстоящие консилиумы</h3>
                <ScrollArea className="h-[300px]">
                  <div className="space-y-3">
                    {upcomingCouncils.slice(0, 10).map((council) => {
                      const statusBadge = getStatusBadge(council.status);
                      return (
                        <div
                          key={council.id}
                          className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-accent transition-colors"
                          onClick={() => handleCouncilClick(council)}
                        >
                          <div className="w-12 h-12 bg-primary/10 rounded-lg flex flex-col items-center justify-center flex-shrink-0">
                            <span className="text-xs text-muted-foreground">
                              {new Date(council.date).toLocaleDateString('ru-RU', { month: 'short' })}
                            </span>
                            <span className="text-lg font-bold text-primary">
                              {new Date(council.date).getDate()}
                            </span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="font-medium text-sm truncate mb-1">
                              {council.title}
                            </h4>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <Clock className="w-3 h-3" />
                              {council.time}
                              <span>•</span>
                              <Users className="w-3 h-3" />
                              {council.participants_count}
                            </div>
                          </div>
                          <Badge variant={statusBadge.variant} className="text-xs">
                            {statusBadge.label}
                          </Badge>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CalendarPage;
