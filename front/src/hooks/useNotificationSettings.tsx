import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from '@/hooks/use-toast';

export interface NotificationSettings {
  id: string;
  user_id: string;
  sound_enabled: boolean;
  notify_messages: boolean;
  notify_councils: boolean;
  notify_critical: boolean;
  created_at: string;
  updated_at: string;
}

export const useNotificationSettings = () => {
  const { user } = useAuth();
  const [settings, setSettings] = useState<NotificationSettings | null>(null);
  const [loading, setLoading] = useState(true);

  const loadSettings = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('notification_settings')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error) {
        // If no settings exist, create default ones
        if (error.code === 'PGRST116') {
          const { data: newSettings, error: insertError } = await supabase
            .from('notification_settings')
            .insert({
              user_id: user.id,
              sound_enabled: true,
              notify_messages: true,
              notify_councils: true,
              notify_critical: true,
            })
            .select()
            .single();

          if (insertError) throw insertError;
          setSettings(newSettings as NotificationSettings);
        } else {
          throw error;
        }
      } else {
        setSettings(data as NotificationSettings);
      }
    } catch (error) {
      console.error('Error loading notification settings:', error);
      toast({
        title: "Ошибка",
        description: "Не удалось загрузить настройки уведомлений",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const updateSettings = async (updates: Partial<Omit<NotificationSettings, 'id' | 'user_id' | 'created_at' | 'updated_at'>>) => {
    if (!user || !settings) return;

    try {
      const { data, error } = await supabase
        .from('notification_settings')
        .update(updates)
        .eq('user_id', user.id)
        .select()
        .single();

      if (error) throw error;

      setSettings(data as NotificationSettings);
      toast({
        title: "Настройки сохранены",
        description: "Настройки уведомлений успешно обновлены",
      });
    } catch (error) {
      console.error('Error updating notification settings:', error);
      toast({
        title: "Ошибка",
        description: "Не удалось обновить настройки",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    if (user) {
      loadSettings();
    }
  }, [user]);

  return {
    settings,
    loading,
    updateSettings,
  };
};
