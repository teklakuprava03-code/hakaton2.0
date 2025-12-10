import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useNotificationSettings } from "@/hooks/useNotificationSettings";
import { Skeleton } from "@/components/ui/skeleton";
import { Bell, MessageSquare, Calendar, AlertTriangle } from "lucide-react";

const Settings = () => {
  const { settings, loading, updateSettings } = useNotificationSettings();

  if (loading) {
    return (
      <div className="container mx-auto p-6 max-w-4xl">
        <h1 className="text-3xl font-bold mb-6">Настройки</h1>
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-48 mb-2" />
            <Skeleton className="h-4 w-64" />
          </CardHeader>
          <CardContent className="space-y-6">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="container mx-auto p-6 max-w-4xl">
        <h1 className="text-3xl font-bold mb-6">Настройки</h1>
        <Card>
          <CardContent className="p-6">
            <p className="text-muted-foreground">Не удалось загрузить настройки</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <h1 className="text-3xl font-bold mb-6">Настройки</h1>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="w-5 h-5" />
            Уведомления
          </CardTitle>
          <CardDescription>
            Управляйте настройками уведомлений и звуковыми сигналами
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Sound notifications */}
          <div className="flex items-center justify-between space-x-2 p-4 rounded-lg border bg-card">
            <div className="flex items-start gap-3 flex-1">
              <Bell className="w-5 h-5 mt-0.5 text-primary" />
              <div className="space-y-0.5">
                <Label htmlFor="sound-enabled" className="text-base font-medium cursor-pointer">
                  Звуковые уведомления
                </Label>
                <p className="text-sm text-muted-foreground">
                  Воспроизводить звуковые сигналы при получении уведомлений
                </p>
              </div>
            </div>
            <Switch
              id="sound-enabled"
              checked={settings.sound_enabled}
              onCheckedChange={(checked) => updateSettings({ sound_enabled: checked })}
            />
          </div>

          {/* Message notifications */}
          <div className="flex items-center justify-between space-x-2 p-4 rounded-lg border bg-card">
            <div className="flex items-start gap-3 flex-1">
              <MessageSquare className="w-5 h-5 mt-0.5 text-blue-500" />
              <div className="space-y-0.5">
                <Label htmlFor="notify-messages" className="text-base font-medium cursor-pointer">
                  Новые сообщения
                </Label>
                <p className="text-sm text-muted-foreground">
                  Получать уведомления о новых сообщениях в чатах
                </p>
              </div>
            </div>
            <Switch
              id="notify-messages"
              checked={settings.notify_messages}
              onCheckedChange={(checked) => updateSettings({ notify_messages: checked })}
            />
          </div>

          {/* Council notifications */}
          <div className="flex items-center justify-between space-x-2 p-4 rounded-lg border bg-card">
            <div className="flex items-start gap-3 flex-1">
              <Calendar className="w-5 h-5 mt-0.5 text-green-500" />
              <div className="space-y-0.5">
                <Label htmlFor="notify-councils" className="text-base font-medium cursor-pointer">
                  Консилиумы
                </Label>
                <p className="text-sm text-muted-foreground">
                  Получать уведомления о новых и изменяющихся консилиумах
                </p>
              </div>
            </div>
            <Switch
              id="notify-councils"
              checked={settings.notify_councils}
              onCheckedChange={(checked) => updateSettings({ notify_councils: checked })}
            />
          </div>

          {/* Critical notifications */}
          <div className="flex items-center justify-between space-x-2 p-4 rounded-lg border bg-card">
            <div className="flex items-start gap-3 flex-1">
              <AlertTriangle className="w-5 h-5 mt-0.5 text-red-500" />
              <div className="space-y-0.5">
                <Label htmlFor="notify-critical" className="text-base font-medium cursor-pointer">
                  Критические события
                </Label>
                <p className="text-sm text-muted-foreground">
                  Получать уведомления о критических изменениях состояния пациентов
                </p>
              </div>
            </div>
            <Switch
              id="notify-critical"
              checked={settings.notify_critical}
              onCheckedChange={(checked) => updateSettings({ notify_critical: checked })}
              disabled={true}
            />
          </div>

          <p className="text-xs text-muted-foreground pt-2">
            * Уведомления о критических событиях нельзя отключить в целях безопасности пациентов
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default Settings;
