import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Users, Hospital, Shield, MessageSquare, Calendar, Bell, Database } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

const Index = () => {
  const navigate = useNavigate();

  useEffect(() => {
    // Если пользователь залогинен, перенаправляем на Dashboard
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        navigate("/dashboard");
      }
    });
  }, [navigate]);

  const features = [
    {
      icon: MessageSquare,
      title: "Чаты в реальном времени",
      description: "Мгновенное общение между врачами, медсестрами и другим медперсоналом"
    },
    {
      icon: Users,
      title: "Patient Chat",
      description: "Групповые чаты врачей для обсуждения лечения конкретного пациента"
    },
    {
      icon: Calendar,
      title: "Консилиумы",
      description: "Организация и проведение медицинских консилиумов с ИИ-ассистентом"
    },
    {
      icon: Bell,
      title: "Уведомления",
      description: "Экстренные оповещения о критических состояниях пациентов"
    },
    {
      icon: Shield,
      title: "Безопасность",
      description: "Защита персональных данных в соответствии с ФЗ-152"
    },
    {
      icon: Hospital,
      title: "ИИ-ассистент",
      description: "Дифференциальная диагностика и рекомендации на базе GigaChat"
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-medical-blue-light via-background to-medical-blue-light">
      {/* Hero Section */}
      <section className="container mx-auto px-4 py-16 md:py-24">
        <div className="text-center space-y-8 max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 rounded-full">
            <Hospital className="w-5 h-5 text-primary" />
            <span className="text-sm font-medium text-primary">Медицинская коммуникационная платформа</span>
          </div>
          
          <h1 className="text-4xl md:text-6xl font-bold text-foreground leading-tight">
            MedAI Platform
          </h1>
          
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Эффективная и безопасная коммуникация для медицинского персонала с поддержкой искусственного интеллекта
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-4">
            <Card className="p-8 hover:shadow-lg transition-all cursor-pointer group w-full sm:w-64" 
                  onClick={() => navigate("/auth")}>
              <div className="text-center space-y-4">
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto group-hover:bg-primary group-hover:scale-110 transition-all">
                  <Users className="w-8 h-8 text-primary group-hover:text-primary-foreground" />
                </div>
                <h3 className="text-xl font-semibold">Медработник</h3>
                <p className="text-sm text-muted-foreground">
                  Врачи, медсестры, санитары
                </p>
                <Button className="w-full" variant="default">
                  Войти
                </Button>
              </div>
            </Card>

            <Card className="p-8 hover:shadow-lg transition-all cursor-pointer group w-full sm:w-64 opacity-60">
              <div className="text-center space-y-4">
                <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto">
                  <Hospital className="w-8 h-8 text-muted-foreground" />
                </div>
                <h3 className="text-xl font-semibold">Пациент</h3>
                <p className="text-sm text-muted-foreground">
                  Доступ для пациентов
                </p>
                <Button className="w-full" variant="outline" disabled>
                  Скоро
                </Button>
              </div>
            </Card>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="container mx-auto px-4 py-16 bg-background/50 backdrop-blur-sm">
        <div className="text-center space-y-4 mb-12">
          <h2 className="text-3xl font-bold text-foreground">Возможности платформы</h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Комплексное решение для эффективной работы медицинского персонала
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
          {features.map((feature, index) => (
            <Card key={index} className="p-6 hover:shadow-lg transition-all">
              <div className="space-y-4">
                <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                  <feature.icon className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-lg font-semibold">{feature.title}</h3>
                <p className="text-sm text-muted-foreground">
                  {feature.description}
                </p>
              </div>
            </Card>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="container mx-auto px-4 py-8 text-center text-sm text-muted-foreground space-y-3">
        <div className="flex items-center justify-center gap-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate("/seed-data")}
            className="gap-2"
          >
            <Database className="w-4 h-4" />
            Создать тестовые данные
          </Button>
        </div>
        <p>© 2025 MedAI Platform. Все права защищены.</p>
        <p className="mt-2">Соответствует требованиям ФЗ-152 о защите персональных данных</p>
      </footer>
    </div>
  );
};

export default Index;
