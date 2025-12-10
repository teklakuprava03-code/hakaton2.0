import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Hospital, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const Auth = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [selectedRole, setSelectedRole] = useState<string>("doctor");

  useEffect(() => {
    // Проверяем, не залогинен ли уже пользователь
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        navigate("/dashboard");
      }
    });

    // Подписываемся на изменения аутентификации
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        navigate("/dashboard");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);

    const formData = new FormData(e.currentTarget);
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      if (data.user) {
        // Проверяем наличие профиля
        const { data: profile } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", data.user.id)
          .maybeSingle();

        if (!profile) {
          toast.error("Профиль не найден. Обратитесь к администратору.");
          await supabase.auth.signOut();
          return;
        }

        toast.success("Вход выполнен успешно");
        navigate("/dashboard");
      }
    } catch (error: any) {
      console.error("Login error:", error);
      toast.error(error.message || "Ошибка входа");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);

    const formData = new FormData(e.currentTarget);
    const fullName = formData.get("fullName") as string;
    const email = formData.get("regEmail") as string;
    const password = formData.get("regPassword") as string;

    try {
      // Регистрация пользователя
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
          },
          emailRedirectTo: `${window.location.origin}/dashboard`
        }
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error("Пользователь не создан");

      // Создание профиля
      const { error: profileError } = await supabase
        .from("profiles")
        .insert({
          id: authData.user.id,
          full_name: fullName,
          email: email,
        });

      if (profileError) {
        console.error("Profile creation error:", profileError);
        throw new Error("Ошибка создания профиля");
      }

      // Присвоение роли
      const { error: roleError } = await supabase
        .from("user_roles")
        .insert({
          user_id: authData.user.id,
          role: selectedRole,
        } as any);

      if (roleError) {
        console.error("Role assignment error:", roleError);
      }

      toast.success("Регистрация успешна! Входим в систему...");
      
      // Автоматический вход после регистрации
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        toast.info("Пожалуйста, войдите в систему");
      } else {
        navigate("/dashboard");
      }
    } catch (error: any) {
      console.error("Registration error:", error);
      toast.error(error.message || "Ошибка регистрации");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-medical-blue-light via-background to-medical-blue-light flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Button
          variant="ghost"
          onClick={() => navigate("/")}
          className="mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          На главную
        </Button>

        <Card className="p-8">
          <div className="flex items-center justify-center mb-6">
            <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
              <Hospital className="w-6 h-6 text-primary" />
            </div>
          </div>

          <h1 className="text-2xl font-bold text-center mb-6">MedAI Platform</h1>

          <Tabs defaultValue="login" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">Вход</TabsTrigger>
              <TabsTrigger value="register">Регистрация</TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="doctor@clinic.ru"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Пароль</Label>
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    placeholder="••••••••"
                    required
                  />
                </div>

                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? "Вход..." : "Войти"}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="register">
              <form onSubmit={handleRegister} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="fullName">ФИО</Label>
                  <Input
                    id="fullName"
                    name="fullName"
                    type="text"
                    placeholder="Иванов Иван Иванович"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="role">Должность</Label>
                  <Select required value={selectedRole} onValueChange={setSelectedRole}>
                    <SelectTrigger>
                      <SelectValue placeholder="Выберите должность" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="doctor">Врач</SelectItem>
                      <SelectItem value="nurse">Медсестра</SelectItem>
                      <SelectItem value="orderly">Санитар</SelectItem>
                      <SelectItem value="chief_doctor">Главный врач</SelectItem>
                      <SelectItem value="department_head">Заведующий отделением</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="regEmail">Email</Label>
                  <Input
                    id="regEmail"
                    name="regEmail"
                    type="email"
                    placeholder="doctor@clinic.ru"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="regPassword">Пароль</Label>
                  <Input
                    id="regPassword"
                    name="regPassword"
                    type="password"
                    placeholder="••••••••"
                    required
                    minLength={6}
                  />
                </div>

                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? "Регистрация..." : "Зарегистрироваться"}
                </Button>

                <p className="text-xs text-muted-foreground text-center">
                  Регистрация доступна только медицинскому персоналу клиники
                </p>
              </form>
            </TabsContent>
          </Tabs>
        </Card>
      </div>
    </div>
  );
};

export default Auth;
