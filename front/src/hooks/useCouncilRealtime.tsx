import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

interface CouncilRealtimeUpdate {
  id: string;
  title: string;
  status: string;
  patient_id: string;
}

export const useCouncilRealtime = (onUpdate?: () => void) => {
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('councils-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'councils'
        },
        (payload) => {
          const council = payload.new as CouncilRealtimeUpdate;
          console.log('New council created:', council);
          
          toast({
            title: "Новый консилиум",
            description: `Создан консилиум: ${council.title}`,
          });

          if (onUpdate) onUpdate();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'councils'
        },
        (payload) => {
          const council = payload.new as CouncilRealtimeUpdate;
          const oldCouncil = payload.old as CouncilRealtimeUpdate;
          
          console.log('Council updated:', council);

          // Notify about status changes
          if (oldCouncil.status !== council.status) {
            toast({
              title: "Статус консилиума изменен",
              description: `${council.title} - новый статус: ${council.status}`,
            });
          }

          if (onUpdate) onUpdate();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, toast, onUpdate]);
};
