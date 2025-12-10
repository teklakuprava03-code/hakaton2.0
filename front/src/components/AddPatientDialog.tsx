import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { UserPlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface AddPatientDialogProps {
  onPatientAdded?: () => void;
}

export function AddPatientDialog({ onPatientAdded }: AddPatientDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    full_name: "",
    date_of_birth: "",
    gender: "male",
    diagnosis: "",
    room: "",
    status: "stable",
    medical_history: "",
  });

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.full_name || !formData.date_of_birth || !formData.diagnosis) {
      toast({
        title: "Ошибка",
        description: "Заполните обязательные поля: ФИО, дата рождения, диагноз",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase
        .from('patients')
        .insert([formData]);

      if (error) throw error;

      toast({
        title: "Успех",
        description: "Пациент добавлен",
      });

      setOpen(false);
      onPatientAdded?.();
      
      // Reset form
      setFormData({
        full_name: "",
        date_of_birth: "",
        gender: "male",
        diagnosis: "",
        room: "",
        status: "stable",
        medical_history: "",
      });
    } catch (error: any) {
      console.error('Error adding patient:', error);
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось добавить пациента",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <UserPlus className="w-4 h-4 mr-2" />
          Добавить пациента
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Добавить нового пациента</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="full_name">ФИО *</Label>
              <Input
                id="full_name"
                value={formData.full_name}
                onChange={(e) => handleChange("full_name", e.target.value)}
                placeholder="Иванов Иван Иванович"
                required
              />
            </div>

            <div>
              <Label htmlFor="date_of_birth">Дата рождения *</Label>
              <Input
                id="date_of_birth"
                type="date"
                value={formData.date_of_birth}
                onChange={(e) => handleChange("date_of_birth", e.target.value)}
                required
              />
            </div>

            <div>
              <Label htmlFor="gender">Пол *</Label>
              <Select value={formData.gender} onValueChange={(v) => handleChange("gender", v)}>
                <SelectTrigger id="gender">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">Мужской</SelectItem>
                  <SelectItem value="female">Женский</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="room">Палата</Label>
              <Input
                id="room"
                value={formData.room}
                onChange={(e) => handleChange("room", e.target.value)}
                placeholder="101"
              />
            </div>

            <div>
              <Label htmlFor="status">Статус</Label>
              <Select value={formData.status} onValueChange={(v) => handleChange("status", v)}>
                <SelectTrigger id="status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="stable">Стабильно</SelectItem>
                  <SelectItem value="critical">Критическое</SelectItem>
                  <SelectItem value="observation">Наблюдение</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="diagnosis">Диагноз *</Label>
              <Input
                id="diagnosis"
                value={formData.diagnosis}
                onChange={(e) => handleChange("diagnosis", e.target.value)}
                placeholder="Например: Гипертония"
                required
              />
            </div>
          </div>

          <div>
            <Label htmlFor="medical_history">История болезни</Label>
            <Textarea
              id="medical_history"
              value={formData.medical_history}
              onChange={(e) => handleChange("medical_history", e.target.value)}
              placeholder="Опишите историю болезни пациента..."
              rows={4}
            />
          </div>

          <div className="flex gap-2 pt-4">
            <Button type="submit" disabled={loading} className="flex-1">
              {loading ? "Добавление..." : "Добавить пациента"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={loading}
            >
              Отмена
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
