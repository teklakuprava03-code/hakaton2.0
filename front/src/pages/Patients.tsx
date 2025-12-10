import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Search, ArrowLeft, FileText, MessageSquare, Users
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { AddPatientDialog } from "@/components/AddPatientDialog";

const Patients = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [patients, setPatients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [diagnosisFilter, setDiagnosisFilter] = useState("all");

  useEffect(() => {
    fetchPatients();
  }, []);

  const fetchPatients = async () => {
    try {
      const { data, error } = await supabase
        .from('patients')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPatients(data || []);
    } catch (error) {
      console.error('Error fetching patients:', error);
      toast({
        title: "Ошибка",
        description: "Не удалось загрузить список пациентов",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const calculateAge = (dateOfBirth: string) => {
    const birthDate = new Date(dateOfBirth);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ru-RU');
  };

  const uniqueDiagnoses = useMemo(() => {
    const diagnoses = new Set(patients.map(p => p.diagnosis));
    return Array.from(diagnoses);
  }, [patients]);

  const filteredPatients = useMemo(() => {
    return patients.filter(patient => {
      const matchesSearch = searchQuery === "" || 
        patient.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        patient.diagnosis.toLowerCase().includes(searchQuery.toLowerCase()) ||
        patient.room?.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesStatus = statusFilter === "all" || patient.status === statusFilter;
      const matchesDiagnosis = diagnosisFilter === "all" || patient.diagnosis === diagnosisFilter;

      return matchesSearch && matchesStatus && matchesDiagnosis;
    });
  }, [patients, searchQuery, statusFilter, diagnosisFilter]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "critical": return { label: "Критическое", variant: "destructive" as const };
      case "stable": return { label: "Стабильно", variant: "default" as const };
      case "observation": return { label: "Наблюдение", variant: "secondary" as const };
      default: return { label: status, variant: "default" as const };
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Загрузка пациентов...</p>
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
              <h1 className="text-xl font-bold">Пациенты</h1>
              <Badge variant="secondary">{filteredPatients.length}</Badge>
            </div>
            <AddPatientDialog onPatientAdded={fetchPatients} />
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6">
        {/* Search and Filters */}
        <Card className="p-4 mb-6">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="relative md:col-span-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="Поиск по ФИО, диагнозу..."
                className="pl-10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Статус" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все статусы</SelectItem>
                <SelectItem value="stable">Стабильно</SelectItem>
                <SelectItem value="critical">Критическое</SelectItem>
                <SelectItem value="observation">Наблюдение</SelectItem>
              </SelectContent>
            </Select>
            <Select value={diagnosisFilter} onValueChange={setDiagnosisFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Диагноз" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все диагнозы</SelectItem>
                {uniqueDiagnoses.map(diagnosis => (
                  <SelectItem key={diagnosis} value={diagnosis}>
                    {diagnosis}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </Card>

        {/* Patients List */}
        {filteredPatients.length === 0 ? (
          <Card className="p-8 text-center">
            <p className="text-muted-foreground">Пациенты не найдены</p>
          </Card>
        ) : (
          <div className="grid gap-4">
            {filteredPatients.map((patient) => {
              const statusBadge = getStatusBadge(patient.status);
              const age = calculateAge(patient.date_of_birth);
              
              return (
                <Card
                  key={patient.id}
                  className="p-6 hover:shadow-lg transition-all"
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                          <span className="text-lg font-semibold text-primary">
                            {patient.full_name.split(' ').map((n: string) => n[0]).join('')}
                          </span>
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-lg">{patient.full_name}</h3>
                            <Badge variant={statusBadge.variant}>{statusBadge.label}</Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {age} лет, {patient.gender === "male" ? "Мужчина" : "Женщина"}
                          </p>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm">
                          <span className="font-medium">Диагноз:</span>
                          <span className="text-muted-foreground">{patient.diagnosis}</span>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span>Палата: {patient.room || "Не указана"}</span>
                          <span>Поступление: {formatDate(patient.admission_date)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex md:flex-col gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate(`/patients/${patient.id}/chat`)}
                      >
                        <MessageSquare className="w-4 h-4 mr-2" />
                        Чат врачей
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate(`/patients/${patient.id}/council`)}
                      >
                        <Users className="w-4 h-4 mr-2" />
                        Консилиум
                      </Button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default Patients;
