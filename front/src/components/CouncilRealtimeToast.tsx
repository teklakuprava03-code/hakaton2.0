import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Calendar, CheckCircle, Clock, AlertCircle } from "lucide-react";
import { playUrgentSound, playCriticalSound } from "@/lib/soundNotification";
import type { NotificationSettings } from "@/hooks/useNotificationSettings";

interface CouncilUpdate {
  id: string;
  title: string;
  status: string;
  date: string;
  time: string;
  has_ai_summary: boolean;
}

export const CouncilRealtimeToast = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings | null>(null);

  useEffect(() => {
    if (!user) return;

    // Load notification settings
    const loadSettings = async () => {
      const { data } = await supabase
        .from('notification_settings')
        .select('*')
        .eq('user_id', user.id)
        .single();
      
      if (data) {
        setNotificationSettings(data as NotificationSettings);
      }
    };

    loadSettings();

    const channel = supabase
      .channel('council-updates-toast')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'councils'
        },
        async (payload) => {
          const newCouncil = payload.new as CouncilUpdate;
          const oldCouncil = payload.old as CouncilUpdate;

          // Check if council notifications are enabled
          if (notificationSettings && !notificationSettings.notify_councils) {
            return;
          }

          // Status change notification
          if (oldCouncil.status !== newCouncil.status) {
            let icon = <Calendar className="w-5 h-5" />;
            let statusText = newCouncil.status;
            let shouldPlaySound = false;

            switch (newCouncil.status) {
              case 'scheduled':
                icon = <Clock className="w-5 h-5 text-blue-500" />;
                statusText = 'Запланирован';
                break;
              case 'in_progress':
                icon = <AlertCircle className="w-5 h-5 text-yellow-500" />;
                statusText = 'В процессе';
                shouldPlaySound = true;
                break;
              case 'completed':
                icon = <CheckCircle className="w-5 h-5 text-green-500" />;
                statusText = 'Завершен';
                break;
              case 'cancelled':
                icon = <AlertCircle className="w-5 h-5 text-red-500" />;
                statusText = 'Отменен';
                break;
            }

            // Play urgent sound when council starts if sound is enabled
            if (shouldPlaySound && (!notificationSettings || notificationSettings.sound_enabled)) {
              playUrgentSound();
            }

            toast({
              title: "Статус консилиума обновлен",
              description: (
                <div className="flex items-center gap-2 mt-2">
                  {icon}
                  <div>
                    <p className="font-medium">{newCouncil.title}</p>
                    <p className="text-sm text-muted-foreground">Статус: {statusText}</p>
                  </div>
                </div>
              ),
            });
          }

          // AI summary completion notification
          if (!oldCouncil.has_ai_summary && newCouncil.has_ai_summary) {
            toast({
              title: "AI резюме готово",
              description: `Резюме для консилиума "${newCouncil.title}" создано`,
            });
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'councils'
        },
        (payload) => {
          const council = payload.new as CouncilUpdate;
          
          // Check if council notifications are enabled
          if (notificationSettings && !notificationSettings.notify_councils) {
            return;
          }

          // Play urgent sound for new councils if sound is enabled
          if (!notificationSettings || notificationSettings.sound_enabled) {
            playUrgentSound();
          }
          
          toast({
            title: "Новый консилиум",
            description: (
              <div className="flex items-center gap-2 mt-2">
                <Calendar className="w-5 h-5 text-primary" />
                <div>
                  <p className="font-medium">{council.title}</p>
                  <p className="text-sm text-muted-foreground">
                    {council.date} в {council.time}
                  </p>
                </div>
              </div>
            ),
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, toast]);

  return null;
};
