'use client';

import { useEffect, useState } from 'react';
import { Bell, CheckCheck, X } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { notificationService, CancellationNotification } from '@/services/notificationService';
import { formatDate, formatTime } from '@/lib/agenda';

export default function NotificationBell() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<CancellationNotification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState('');

  const loadNotifications = async () => {
    try {
      const rows = await notificationService.getMyNotifications();
      setNotifications(rows);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar las notificaciones.');
    }
  };

  useEffect(() => {
    if (!user?.id) return;
    loadNotifications();
  }, [user?.id]);

  const unreadCount = notifications.filter((item) => !item.read_at).length;

  const openNotification = async (item: CancellationNotification) => {
    if (!item.read_at) {
      try {
        await notificationService.markAsRead(item.id);
        setNotifications((prev) => prev.map((row) => row.id === item.id ? { ...row, read_at: new Date().toISOString() } : row));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'No se pudo actualizar la notificación.');
      }
    }
  };

  const markAllRead = async () => {
    try {
      await notificationService.markAllAsRead();
      const now = new Date().toISOString();
      setNotifications((prev) => prev.map((item) => ({ ...item, read_at: item.read_at || now })));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron marcar como leídas.');
    }
  };

  if (!user) return null;

  return (
    <div className="relative">
      <button type="button" onClick={() => { setIsOpen((value) => !value); if (!isOpen) loadNotifications(); }} aria-label="Notificaciones" className="relative inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 hover:bg-slate-50">
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-bold text-white">{unreadCount > 9 ? '9+' : unreadCount}</span>}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-12 z-[120] w-[min(92vw,390px)] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Notificaciones</h3>
              <p className="text-[11px] text-slate-400">Avisos de cancelación de citas</p>
            </div>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && <button type="button" onClick={markAllRead} title="Marcar todas como leídas" className="rounded-lg p-2 text-[#025a4e] hover:bg-teal-50"><CheckCheck className="h-4 w-4" /></button>}
              <button type="button" onClick={() => setIsOpen(false)} aria-label="Cerrar" className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"><X className="h-4 w-4" /></button>
            </div>
          </div>
          {error && <p className="px-4 py-2 text-xs text-rose-600">{error}</p>}
          <div className="max-h-[420px] overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="px-4 py-8 text-center text-xs text-slate-400">No tienes notificaciones de cancelación.</p>
            ) : notifications.map((item) => (
              <button key={item.id} type="button" onClick={() => openNotification(item)} className={`block w-full border-b border-slate-100 px-4 py-3 text-left hover:bg-slate-50 ${item.read_at ? 'bg-white' : 'bg-teal-50/50'}`}>
                <div className="flex items-start justify-between gap-2">
                  <p className="text-xs font-bold text-slate-900">{item.cancelled_by === 'CLIENT' ? 'El cliente canceló una cita' : 'El proveedor canceló una cita'}</p>
                  {!item.read_at && <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[#025a4e]" />}
                </div>
                <p className="mt-1 text-xs text-slate-700">{item.business_name}</p>
                <p className="text-xs text-slate-500">{item.service_name} · {formatDate(item.appointment_date)} · {formatTime(item.appointment_time)}</p>
                <p className="mt-1 text-[11px] text-slate-500">Canceló: {item.cancelled_by === 'CLIENT' ? 'Cliente' : 'Proveedor'}</p>
                {item.cancellation_reason && <p className="mt-1 text-[11px] text-slate-500">Motivo: {item.cancellation_reason}</p>}
                <p className="mt-1 text-[10px] text-slate-400">{new Date(item.created_at).toLocaleString('es-CO')}</p>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
