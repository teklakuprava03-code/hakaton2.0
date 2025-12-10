import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  Search, Calendar, MessageSquare, Users, 
  AlertCircle, TrendingUp, Filter, Phone, Video, Menu, LogOut, Settings as SettingsIcon, Bot, User
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { NotificationBell } from "@/components/NotificationBell";
import { HealthGauge } from "@/components/HealthGauge";

const Dashboard = () => {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [sortBy, setSortBy] = useState("urgency");
  const [patients, setPatients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [userProfile, setUserProfile] = useState<any>(null);

  useEffect(() => {
    loadPatients();
    loadUserProfile();
  }, [sortBy]);

  const loadUserProfile = async () => {
    if (!user) return;
    
    try {
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
      
      if (profileError) throw profileError;

      // Load user role
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .maybeSingle();

      setUserProfile({
        ...profileData,
        role: roleData?.role || null
      });
    } catch (error) {
      console.error('Error loading profile:', error);
    }
  };

  const loadPatients = async () => {
    try {
      setLoading(true);
      let query = supabase.from("patients").select("*");

      if (sortBy === "urgency") {
        // По неотложности состояния (critical > observation > stable)
        query = query.order("status", { ascending: false });
      } else if (sortBy === "priority") {
        // По приоритетности задачи (сначала критические, потом по дате поступления)
        query = query.order("status", { ascending: false }).order("admission_date", { ascending: false });
      } else if (sortBy === "time_required") {
        // По необходимому времени (сначала недавно поступившие)
        query = query.order("updated_at", { ascending: false });
      } else if (sortBy === "alphabet") {
        // По алфавиту
        query = query.order("full_name", { ascending: true });
      } else if (sortBy === "admission_time") {
        // По времени поступления
        query = query.order("admission_date", { ascending: false });
      } else if (sortBy === "room") {
        query = query.order("room", { ascending: true });
      }

      const { data, error } = await query;
      if (error) throw error;
      setPatients(data || []);
    } catch (error: any) {
      console.error("Error loading patients:", error);
      toast.error("Ошибка загрузки списка пациентов");
    } finally {
      setLoading(false);
    }
  };

  const getSeverityColor = (status: string) => {
    switch (status) {
      case "critical": return "destructive";
      case "observation": return "default";
      case "stable": return "secondary";
      default: return "default";
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "critical": return { label: "Критическое", variant: "destructive" as const };
      case "stable": return { label: "Стабильно", variant: "default" as const };
      case "observation": return { label: "Наблюдение", variant: "secondary" as const };
      default: return { label: status, variant: "default" as const };
    }
  };

  const calculateAge = (dateOfBirth: string) => {
    const today = new Date();
    const birthDate = new Date(dateOfBirth);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const NavigationMenu = () => (
    <div className="space-y-2">
      <Button variant="ghost" className="w-full justify-start" onClick={() => navigate("/dashboard")}>
        <TrendingUp className="w-4 h-4 mr-2" />
        Dashboard
      </Button>
      <Button variant="ghost" className="w-full justify-start" onClick={() => navigate("/patients")}>
        <Users className="w-4 h-4 mr-2" />
        Пациенты
      </Button>
      <Button variant="ghost" className="w-full justify-start" onClick={() => navigate("/chats")}>
        <MessageSquare className="w-4 h-4 mr-2" />
        Чаты
      </Button>
      <Button variant="ghost" className="w-full justify-start" onClick={() => navigate("/ai-assistant")}>
        <Bot className="w-4 h-4 mr-2" />
        AI Ассистент
      </Button>
      <Button variant="ghost" className="w-full justify-start" onClick={() => navigate("/calendar")}>
        <Calendar className="w-4 h-4 mr-2" />
        Календарь
      </Button>
      <Button variant="ghost" className="w-full justify-start" onClick={() => navigate("/settings")}>
        <SettingsIcon className="w-4 h-4 mr-2" />
        Настройки
      </Button>
      <Button variant="ghost" className="w-full justify-start" onClick={() => navigate("/profile")}>
        <Users className="w-4 h-4 mr-2" />
        Профиль
      </Button>
      <Button variant="ghost" className="w-full justify-start text-destructive hover:text-destructive" onClick={signOut}>
        <LogOut className="w-4 h-4 mr-2" />
        Выход
      </Button>
    </div>
  );

  const criticalCount = patients.filter(p => p.status === "critical").length;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" className="md:hidden">
                    <Menu className="w-5 h-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left">
                  <div className="mt-8"><NavigationMenu /></div>
                </SheetContent>
              </Sheet>
              <div>
                <h1 className="text-xl font-bold flex items-center gap-2">
                  MedAI Dashboard
                  {userProfile && (
                    <span className="text-base font-normal text-muted-foreground">
                      — {userProfile.full_name}
                      {userProfile.role && (
                        <span className="text-sm ml-1">
                          ({userProfile.role === 'doctor' && 'Врач'}
                          {userProfile.role === 'nurse' && 'Медсестра'}
                          {userProfile.role === 'chief_doctor' && 'Главный врач'}
                          {userProfile.role === 'orderly' && 'Санитар'}
                          {userProfile.role === 'admin' && 'Администратор'}
                          {userProfile.role === 'department_head' && 'Заведующий отделением'})
                        </span>
                      )}
                    </span>
                  )}
                </h1>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon"><Phone className="w-5 h-5" /></Button>
              <Button variant="ghost" size="icon"><Video className="w-5 h-5" /></Button>
              <NotificationBell />
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6">
        <div className="grid md:grid-cols-4 gap-6">
          <div className="hidden md:block">
            <Card className="p-4"><NavigationMenu /></Card>
          </div>

          <div className="md:col-span-3 space-y-6">
            <Card className="p-4">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                  <Input placeholder="Поиск пациентов..." className="pl-10" />
                </div>
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="w-full sm:w-[200px]">
                    <Filter className="w-4 h-4 mr-2" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-white dark:bg-gray-800 z-50">
                    <SelectItem value="urgency">По неотложности состояния</SelectItem>
                    <SelectItem value="priority">По приоритетности задачи</SelectItem>
                    <SelectItem value="time_required">По необходимому времени</SelectItem>
                    <SelectItem value="alphabet">По алфавиту</SelectItem>
                    <SelectItem value="admission_time">По времени поступления</SelectItem>
                    <SelectItem value="room">По палате</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </Card>

            <div className="grid sm:grid-cols-3 gap-4">
              <Card className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Всего пациентов</p>
                    <p className="text-2xl font-bold">{patients.length}</p>
                  </div>
                  <Users className="w-8 h-8 text-primary opacity-20" />
                </div>
              </Card>
              <Card className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Критических</p>
                    <p className="text-2xl font-bold text-destructive">{criticalCount}</p>
                  </div>
                  <AlertCircle className="w-8 h-8 text-destructive opacity-20" />
                </div>
              </Card>
              <Card className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Консилиумов сегодня</p>
                    <p className="text-2xl font-bold">0</p>
                  </div>
                  <Calendar className="w-8 h-8 text-primary opacity-20" />
                </div>
              </Card>
            </div>

            <div className="space-y-4">
              <h2 className="text-lg font-semibold">Активные пациенты</h2>
              {loading ? (
                <div className="text-center py-8">
                  <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                  <p className="text-muted-foreground">Загрузка...</p>
                </div>
              ) : patients.length === 0 ? (
                <Card className="p-8 text-center">
                  <p className="text-muted-foreground">Нет пациентов. Создайте тестовые данные.</p>
                </Card>
              ) : (
                patients.map((patient) => {
                  const statusBadge = getStatusBadge(patient.status);
                  return (
                    <Card key={patient.id} className="p-4 hover:shadow-md transition-all cursor-pointer" onClick={() => navigate(`/patients/${patient.id}`)}>
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h3 className="font-semibold">{patient.full_name}</h3>
                            <Badge variant={statusBadge.variant}>{statusBadge.label}</Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">{patient.diagnosis}</p>
                          <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                            <span>Возраст: {calculateAge(patient.date_of_birth)}</span>
                            <span>Палата: {patient.room}</span>
                          </div>
                        </div>
                      </div>
                    </Card>
                  );
                })
              )}
            </div>

            <HealthGauge mentalScore={75} physicalScore={85} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
