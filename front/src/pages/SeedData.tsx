import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Hospital, Database, CheckCircle, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const SeedData = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const handleSeedData = async () => {
    setIsLoading(true);
    setResult(null);

    try {
      const { data, error } = await supabase.functions.invoke('seed-test-data');

      if (error) throw error;

      setResult(data);
      toast.success("Тестовые данные успешно созданы!");
    } catch (error: any) {
      console.error('Error:', error);
      toast.error(error.message || "Ошибка создания тестовых данных");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-medical-blue-light via-background to-medical-blue-light flex items-center justify-center p-4">
      <Card className="max-w-2xl w-full p-8">
        <div className="text-center space-y-6">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
            <Database className="w-8 h-8 text-primary" />
          </div>

          <div>
            <h1 className="text-3xl font-bold mb-2">Создание тестовых данных</h1>
            <p className="text-muted-foreground">
              Нажмите кнопку для создания 10 врачей и чатов по клиническим кейсам
            </p>
          </div>

          <div className="bg-muted/50 rounded-lg p-6 text-left space-y-3">
            <h3 className="font-semibold flex items-center gap-2">
              <Hospital className="w-5 h-5 text-primary" />
              Что будет создано:
            </h3>
            <ul className="space-y-2 text-sm">
              <li className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-success mt-0.5" />
                <span>10 врачей с разными ролями (логин: email, пароль: test123456)</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-success mt-0.5" />
                <span>Patient Chat для каждого из 3 пациентов (ХОБЛ, ОКС, Пневмония)</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-success mt-0.5" />
                <span>Тестовые сообщения в чатах пациентов</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-success mt-0.5" />
                <span>Несколько личных чатов между врачами</span>
              </li>
            </ul>
          </div>

          <Button 
            onClick={handleSeedData} 
            disabled={isLoading}
            size="lg"
            className="w-full"
          >
            {isLoading ? "Создание данных..." : "Создать тестовые данные"}
          </Button>

          {result && (
            <div className="bg-success/10 border border-success/20 rounded-lg p-6 text-left">
              <h3 className="font-semibold text-success mb-3 flex items-center gap-2">
                <CheckCircle className="w-5 h-5" />
                Данные успешно созданы!
              </h3>
              <div className="space-y-2 text-sm">
                <p>Создано пользователей: {result.createdUsers}</p>
                <div className="mt-4">
                  <p className="font-medium mb-2">Учетные данные для входа:</p>
                  <div className="bg-background rounded p-3 space-y-1 font-mono text-xs">
                    {result.doctors?.map((doc: any, idx: number) => (
                      <div key={idx} className="flex justify-between items-center">
                        <span className="text-muted-foreground">{doc.email}</span>
                        <span className="text-primary">test123456</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <Button 
                className="w-full mt-4"
                onClick={() => window.location.href = '/auth'}
              >
                Перейти к авторизации
              </Button>
            </div>
          )}

          {!result && (
            <div className="bg-warning/10 border border-warning/20 rounded-lg p-4 text-left">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-warning mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-warning mb-1">Внимание:</p>
                  <p className="text-muted-foreground">
                    Эта операция создаст тестовых пользователей в базе данных. 
                    Используйте только в тестовом окружении.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};

export default SeedData;
