import { supabase } from '@/lib/supabaseClient';

export interface CancellationNotification {
  id: string;
  appointment_id: string;
  business_name: string;
  service_name: string;
  appointment_date: string;
  appointment_time: string;
  cancelled_by: 'CLIENT' | 'PROVIDER';
  cancellation_reason: string | null;
  created_at: string;
  read_at: string | null;
}

class NotificationService {
  async getMyNotifications(): Promise<CancellationNotification[]> {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(30);
    if (error) throw new Error(error.message);
    return (data || []) as CancellationNotification[];
  }

  async markAsRead(id: string): Promise<void> {
    const { error } = await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', id)
      .is('read_at', null);
    if (error) throw new Error(error.message);
  }

  async markAllAsRead(): Promise<void> {
    const { error } = await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .is('read_at', null);
    if (error) throw new Error(error.message);
  }
}

export const notificationService = new NotificationService();
