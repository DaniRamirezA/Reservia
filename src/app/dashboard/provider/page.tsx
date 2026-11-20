'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import AuthGuard from '@/components/auth/AuthGuard';
import NotificationBell from '@/components/ui/NotificationBell';
import ConfirmModal from '@/components/ui/ConfirmModal';
import ServiceFormModal from '@/components/provider/ServiceFormModal';
import ScheduleEditor from '@/components/provider/ScheduleEditor';
import { appointmentService } from '@/services/appointmentService';
import { serviceService } from '@/services/serviceService';
import { reviewService, ServiceReview } from '@/services/reviewService';
import { supabase } from '@/lib/supabaseClient';
import ColombiaLocationFields, { inferDepartment } from '@/components/ui/ColombiaLocationFields';
import { scheduleService, DayConfig } from '@/services/scheduleService';
import { Appointment, AppointmentStatus } from '@/types/appointment';
import { Schedule } from '@/types/schedule';
import { Service, ServiceForm } from '@/types/service';
import { categoryLabel } from '@/lib/categories';
import { formatDate, formatTime, isPast, toISODate } from '@/lib/agenda';
import {
  CalendarDays,
  Clock,
  Plus,
  CheckCircle2,
  AlertCircle,
  X,
  Pencil,
  Mail,
  Phone,
  Globe,
  BarChart3,
  TrendingUp,
  Star,
  Settings,
  ListTodo,
} from 'lucide-react';

type ProviderTabType = 'agenda' | 'servicios' | 'horarios' | 'reportes' | 'opiniones' | 'perfil';

const STATUS_LABEL: Record<AppointmentStatus, string> = {
  CONFIRMED: 'Confirmada',
  PENDING: 'Pendiente',
  CANCELLED: 'Cancelada',
  COMPLETED: 'Completada',
};

const STATUS_STYLE: Record<AppointmentStatus, string> = {
  CONFIRMED: 'bg-[#eafaf5] text-[#025a4e]',
  PENDING: 'bg-[#fffbeb] text-[#b45309]',
  CANCELLED: 'bg-rose-50 text-rose-600',
  COMPLETED: 'bg-slate-100 text-slate-500',
};

const isActive = (a: Appointment) => a.status === 'CONFIRMED' || a.status === 'PENDING';

function effectiveStatus(a: Appointment): AppointmentStatus {
  if (isActive(a) && isPast(a.date, a.time, a.durationMinutes)) return 'COMPLETED';
  return a.status;
}

function ProviderDashboardContent() {
  const { user, updateUser } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();

  const tabParam = searchParams.get('tab') as ProviderTabType;
  const activeTab: ProviderTabType = ['agenda', 'servicios', 'horarios', 'reportes', 'opiniones', 'perfil'].includes(tabParam)
    ? tabParam
    : 'agenda';

  const handleTabChange = (tab: ProviderTabType) => {
    router.replace(`/dashboard/provider?tab=${tab}`, { scroll: false });
  };

  const [feedbackMessage, setFeedbackMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reportMonthValue, setReportMonthValue] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [isLoadingAppointments, setIsLoadingAppointments] = useState(true);
  const [appointmentToCancel, setAppointmentToCancel] = useState<Appointment | null>(null);
  const [detailAppointment, setDetailAppointment] = useState<Appointment | null>(null);
  const [cancellationReason, setCancellationReason] = useState('');

  const [services, setServices] = useState<Service[]>([]);
  const [isLoadingServices, setIsLoadingServices] = useState(true);
  const [isServiceModalOpen, setIsServiceModalOpen] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [serviceToDeactivate, setServiceToDeactivate] = useState<Service | null>(null);

  const [schedule, setSchedule] = useState<Schedule[]>([]);
  const [isLoadingSchedule, setIsLoadingSchedule] = useState(true);
  const [providerReviews, setProviderReviews] = useState<ServiceReview[]>([]);
  const [isLoadingReviews, setIsLoadingReviews] = useState(true);

  const userId = user?.id;

  useEffect(() => {
    if (!userId) return;

    const showError = (err: Error) => setLoadError(err.message);

    appointmentService
      .getProviderAppointments(userId)
      .then(setAppointments)
      .catch(showError)
      .finally(() => setIsLoadingAppointments(false));

    serviceService
      .getServicesByProvider(userId)
      .then(setServices)
      .catch(showError)
      .finally(() => setIsLoadingServices(false));

    scheduleService
      .getSchedule(userId)
      .then(setSchedule)
      .catch(showError)
      .finally(() => setIsLoadingSchedule(false));
  }, [userId]);

  useEffect(() => {
    if (!userId || isLoadingServices) return;
    reviewService.getProviderReviews(services.map((service) => service.id))
      .then(setProviderReviews)
      .catch((err: Error) => setLoadError(err.message))
      .finally(() => setIsLoadingReviews(false));
  }, [userId, isLoadingServices, services]);

  const [businessProfile, setBusinessProfile] = useState({
    businessName: user?.businessName || '',
    category: user?.businessCategory || 'SALUD',
    city: user?.city || '',
    department: user?.department || inferDepartment(user?.city),
    description: user?.description || '',
    address: user?.address || '',
    email: user?.email || '',
    phone: user?.phone || '',
    website: user?.website || '',
    cancellationPolicy: user?.cancellationPolicy || '24 horas de anticipación',
  });

  const openCreateService = () => {
    setEditingService(null);
    setIsServiceModalOpen(true);
  };

  const openEditService = (service: Service) => {
    setEditingService(service);
    setIsServiceModalOpen(true);
  };

  const handleSaveService = async (form: ServiceForm) => {
    if (!user) return;

    if (editingService) {
      const updated = await serviceService.updateService(editingService.id, form);
      setServices((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
      setFeedbackMessage({ type: 'success', text: `Servicio "${updated.name}" actualizado correctamente.` });
    } else {
      const created = await serviceService.createService(form, user);
      setServices((prev) => [created, ...prev]);
      setFeedbackMessage({ type: 'success', text: `Servicio "${created.name}" publicado en el catálogo.` });
    }
  };

  const handleToggleService = async (service: Service) => {
    if (service.isActive) {
      setServiceToDeactivate(service);
      return;
    }

    try {
      const updated = await serviceService.setServiceActive(service.id, true);
      setServices((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
      setFeedbackMessage({ type: 'success', text: `Servicio "${updated.name}" activado de nuevo.` });
    } catch (err) {
      setFeedbackMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'No se pudo activar el servicio.',
      });
    }
  };

  const handleDeactivateService = async () => {
    if (!serviceToDeactivate) return;
    const updated = await serviceService.setServiceActive(serviceToDeactivate.id, false);
    setServices((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
    setFeedbackMessage({
      type: 'success',
      text: `Servicio "${updated.name}" desactivado. Ya no recibe nuevas reservas.`,
    });
  };

  const handleCancelAppointment = async () => {
    if (!appointmentToCancel) return;
    const updated = await appointmentService.cancelAppointment(appointmentToCancel, 'PROVIDER', cancellationReason);
    setAppointments((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
    setFeedbackMessage({
      type: 'success',
      text: `La cita de ${updated.clientName} fue cancelada y el horario quedó libre.`,
    });
  };

  const handleSaveSchedule = async (days: DayConfig[]) => {
    if (!userId) return;
    const saved = await scheduleService.saveSchedule(userId, days);
    setSchedule(saved);
    setFeedbackMessage({
      type: 'success',
      text: 'Horarios guardados. Los clientes ya pueden reservar en esos bloques.',
    });
  };

  const handleBusinessImageUpload = async (file?: File) => {
    if (!file || !user) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      setFeedbackMessage({ type: 'error', text: 'La imagen debe estar en formato PNG, JPG o WEBP.' });
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setFeedbackMessage({ type: 'error', text: 'La imagen no puede superar los 2 MB.' });
      return;
    }
    try {
      const extension = file.name.split('.').pop()?.toLowerCase() || 'jpg';
      const path = `${user.id}/business-${Date.now()}.${extension}`;
      const { error: uploadError } = await supabase.storage.from('profile-images').upload(path, file, { upsert: true, contentType: file.type });
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from('profile-images').getPublicUrl(path);
      await updateUser({ avatarUrl: data.publicUrl });
      setFeedbackMessage({ type: 'success', text: 'Imagen del negocio actualizada correctamente.' });
    } catch (err) {
      setFeedbackMessage({ type: 'error', text: err instanceof Error ? err.message : 'No se pudo subir la imagen.' });
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (businessProfile.businessName.trim().length < 2) {
      setFeedbackMessage({ type: 'error', text: 'No se guardaron los cambios: escribe el nombre del negocio (mínimo 2 caracteres).' });
      return;
    }
    if (!businessProfile.department.trim() || !businessProfile.city.trim()) {
      setFeedbackMessage({ type: 'error', text: 'No se guardaron los cambios: completa la ciudad del negocio.' });
      return;
    }
    if (!businessProfile.address.trim()) {
      setFeedbackMessage({ type: 'error', text: 'No se guardaron los cambios: la dirección es obligatoria. Completa este campo e inténtalo de nuevo.' });
      return;
    }
    const normalizedPhone = businessProfile.phone.trim().replace(/[\s()-]/g, '');
    if (normalizedPhone && !/^(?:\+57)?3\d{9}$/.test(normalizedPhone)) {
      setFeedbackMessage({ type: 'error', text: 'Ingresa un celular colombiano válido de 10 dígitos que comience por 3. También puedes incluir el prefijo +57.' });
      return;
    }
    if (businessProfile.website.trim() && !/^https?:\/\/.+\..+/.test(businessProfile.website.trim())) {
      setFeedbackMessage({ type: 'error', text: 'El sitio web debe iniciar con http:// o https:// y tener un dominio válido.' });
      return;
    }
    try {
      await updateUser({
        businessName: businessProfile.businessName,
        businessCategory: businessProfile.category,
        city: businessProfile.city,
        department: businessProfile.department,
        description: businessProfile.description,
        address: businessProfile.address,
        phone: normalizedPhone,
        website: businessProfile.website,
        cancellationPolicy: businessProfile.cancellationPolicy,
      });
      setFeedbackMessage({
        type: 'success',
        text: '¡Cambios del perfil guardados con éxito! Ya se reflejan en el catálogo.',
      });
    } catch (err) {
      setFeedbackMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'No se pudieron guardar los cambios.',
      });
    }
  };

  const activeServicesCount = services.filter((s) => s.isActive).length;

  const today = toISODate(new Date());
  const endOfWeek = new Date();
  endOfWeek.setHours(23, 59, 59, 999);
  endOfWeek.setDate(endOfWeek.getDate() + (6 - endOfWeek.getDay()));
  const endOfWeekStr = toISODate(endOfWeek);

  const activeAppointments = appointments.filter(isActive);
  const upcomingList = activeAppointments.filter((a) => !isPast(a.date, a.time, a.durationMinutes));
  const historyList = appointments.filter((a) => !upcomingList.includes(a)).reverse();

  const todayAppointments = activeAppointments.filter((a) => a.date === today);
  const weekAppointments = activeAppointments.filter((a) => a.date >= today && a.date <= endOfWeekStr && !isPast(a.date, a.time, a.durationMinutes));
  const estimatedRevenueToday = todayAppointments
    .filter((a) => a.status === 'CONFIRMED')
    .reduce((sum, a) => sum + a.price, 0);

  const [reportYear, reportMonthNumber] = reportMonthValue.split('-').map(Number);
  const reportMonthStart = new Date(reportYear, reportMonthNumber - 1, 1);
  const reportMonthEnd = new Date(reportYear, reportMonthNumber, 0);
  const reportMonthCancelled = appointments.filter((apt) => {
    const date = new Date(`${apt.date}T12:00:00`);
    return date >= reportMonthStart && date <= reportMonthEnd && apt.status === 'CANCELLED';
  });
  const reportMonthAppointments = appointments.filter((apt) => {
    const date = new Date(`${apt.date}T12:00:00`);
    return date >= reportMonthStart && date <= reportMonthEnd && apt.status !== 'CANCELLED';
  });
  const reportCompleted = reportMonthAppointments.filter((apt) => effectiveStatus(apt) === 'COMPLETED');
  const reportPendingAttention = reportMonthAppointments.filter((apt) => effectiveStatus(apt) !== 'COMPLETED');
  const reportRevenue = reportCompleted.reduce((total, apt) => total + apt.price, 0);
  const reportBookedMinutes = reportMonthAppointments.reduce((total, apt) => total + apt.durationMinutes, 0);
  const reportAvailableMinutes = Array.from({ length: reportMonthEnd.getDate() }, (_, index) => {
    const dayOfWeek = new Date(reportMonthStart.getFullYear(), reportMonthStart.getMonth(), index + 1).getDay();
    return schedule.filter((block) => block.dayOfWeek === dayOfWeek).reduce((sum, block) => {
      const [startHour, startMinute] = block.startTime.split(':').map(Number);
      const [endHour, endMinute] = block.endTime.split(':').map(Number);
      return sum + Math.max(0, (endHour * 60 + endMinute) - (startHour * 60 + startMinute));
    }, 0);
  }).reduce((sum, minutes) => sum + minutes, 0);
  const reportOccupancy = reportAvailableMinutes > 0
    ? Math.min(100, Math.round((reportBookedMinutes / reportAvailableMinutes) * 100))
    : 0;
  const reportDemand = Object.values(reportMonthAppointments.reduce<Record<string, { name: string; count: number }>>((groups, apt) => {
    groups[apt.serviceName] = groups[apt.serviceName] || { name: apt.serviceName, count: 0 };
    groups[apt.serviceName].count += 1;
    return groups;
  }, {})).sort((a, b) => b.count - a.count);
  const reportTotalDemand = reportDemand.reduce((total, item) => total + item.count, 0);
  const reportMonthLabel = reportMonthStart.toLocaleDateString('es-CO', { month: 'long', year: 'numeric' });

  const businessInitials = (user?.businessName || user?.name || '')
    .split(' ')
    .filter(Boolean)
    .map((word) => word[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const todayLabel = new Date().toLocaleDateString('es-CO', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const renderAppointment = (apt: Appointment, canCancel: boolean) => {
    const initials = apt.clientName
      .split(' ')
      .map((n) => n[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
    const status = effectiveStatus(apt);

    return (
      <div
        key={apt.id}
        className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/50 transition-colors"
      >
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-full bg-[#eafaf5] text-[#025a4e] font-bold text-xs flex items-center justify-center flex-shrink-0">
            {initials}
          </div>
          <div>
            <h3 className="text-xs font-bold text-slate-900 leading-snug">{apt.clientName}</h3>
            <p className="text-[11px] text-slate-400 font-normal">{apt.serviceName}</p>
            {apt.clientPhone && <p className="text-[11px] text-slate-400 font-normal">{apt.clientPhone}</p>}
            {apt.notes && <p className="text-[11px] text-slate-500 italic mt-0.5">&ldquo;{apt.notes}&rdquo;</p>}
          </div>
        </div>

        <div className="flex items-center gap-4 sm:text-right">
          <div>
            <p className="text-xs font-bold text-slate-900 leading-snug">{formatDate(apt.date)}</p>
            <p className="text-[11px] text-slate-400 font-normal">{formatTime(apt.time)}</p>
          </div>

          <span
            className={`inline-flex items-center px-3 py-1 rounded-full text-[11px] font-semibold ${STATUS_STYLE[status]}`}
          >
            {STATUS_LABEL[status]}
          </span>

          {canCancel ? (
            <button
              onClick={() => { setCancellationReason(''); setAppointmentToCancel(apt); }}
              className="text-xs font-normal text-rose-500 hover:text-rose-600 border border-rose-200 hover:bg-rose-50/50 rounded-lg px-3 py-1 transition-colors"
            >
              Cancelar
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setDetailAppointment(apt)}
              className="text-xs font-semibold text-[#025a4e] border border-slate-200 hover:bg-teal-50 rounded-lg px-3 py-1 transition-colors"
            >
              Ver detalle
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#fafafa] py-10 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        {feedbackMessage && (
          <div
            role={feedbackMessage.type === 'success' ? 'status' : 'alert'}
            aria-live="polite"
            className={`fixed bottom-5 right-5 z-[100] flex w-[calc(100%-2.5rem)] max-w-md items-center justify-between gap-4 p-4 rounded-xl text-xs font-semibold shadow-xl transition-all ${
              feedbackMessage.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                : 'bg-rose-50 text-rose-800 border border-rose-200'
            }`}
          >
            <div className="flex items-center gap-2">
              {feedbackMessage.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600" />
              )}
              <span>{feedbackMessage.text}</span>
            </div>
            <button
              onClick={() => setFeedbackMessage(null)}
              className="text-slate-400 hover:text-slate-600"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {loadError && (
          <div className="mb-6 flex items-center gap-2 rounded-xl bg-rose-50 p-3.5 text-xs text-rose-700 border border-rose-200">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
            <span>No se pudieron cargar tus datos: {loadError}</span>
          </div>
        )}

        <div className="mb-8">
          <div className="flex items-center gap-2 mb-2">
            <span className="inline-flex items-center justify-center bg-[#025a4e] text-white text-[11px] font-bold px-2 py-0.5 rounded-md">
              {businessInitials}
            </span>
            <span className="text-xs text-slate-400 font-medium">Panel de proveedor</span>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2">
            <div>
              <h1 className="font-serif text-3xl sm:text-4xl font-bold text-slate-900 tracking-tight">
                {user?.businessName || businessProfile.businessName}
              </h1>
              <p className="text-xs text-slate-400 font-normal mt-1">
                {todayLabel}
              </p>
            </div>

            <div className="flex items-center gap-3 self-start sm:self-auto">
              <NotificationBell />
              <Link
                href="/services"
                className="text-xs text-slate-400 hover:text-[#025a4e] transition-colors font-medium"
              >
                Ver como cliente →
              </Link>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <button
            onClick={() => handleTabChange('agenda')}
            className={`bg-white border rounded-2xl p-5 text-left shadow-[0_1px_3px_rgba(0,0,0,0.03)] transition-all ${
              activeTab === 'agenda' ? 'border-[#025a4e]/40 ring-2 ring-[#025a4e]/10' : 'border-slate-100 hover:border-slate-200'
            }`}
          >
            <span className="inline-block text-[10px] uppercase font-bold tracking-wider text-teal-700 bg-teal-50 px-2 py-0.5 rounded-md mb-2">
              Citas hoy
            </span>
            <p className="font-serif text-3xl sm:text-4xl font-bold text-slate-900 leading-tight">
              {todayAppointments.length}
            </p>
            <p className="text-[11px] text-emerald-600 font-medium mt-1">citas programadas</p>
          </button>

          <button
            onClick={() => handleTabChange('agenda')}
            className={`bg-white border rounded-2xl p-5 text-left shadow-[0_1px_3px_rgba(0,0,0,0.03)] transition-all ${
              activeTab === 'agenda' ? 'border-[#025a4e]/40 ring-2 ring-[#025a4e]/10' : 'border-slate-100 hover:border-slate-200'
            }`}
          >
            <span className="inline-block text-[10px] uppercase font-bold tracking-wider text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md mb-2">
              Esta semana
            </span>
            <p className="font-serif text-3xl sm:text-4xl font-bold text-slate-900 leading-tight">
              {weekAppointments.length}
            </p>
            <p className="text-[11px] text-emerald-600 font-medium mt-1">
              citas programadas
            </p>
          </button>

          <button
            onClick={() => handleTabChange('reportes')}
            className={`bg-white border rounded-2xl p-5 text-left shadow-[0_1px_3px_rgba(0,0,0,0.03)] transition-all ${
              activeTab === 'reportes' ? 'border-[#025a4e]/40 ring-2 ring-[#025a4e]/10' : 'border-slate-100 hover:border-slate-200'
            }`}
          >
            <span className="inline-block text-[10px] uppercase font-bold tracking-wider text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md mb-2">
              Ingresos est.
            </span>
            <p className="font-serif text-3xl sm:text-4xl font-bold text-slate-900 leading-tight">
              ${estimatedRevenueToday.toLocaleString('es-CO')}
            </p>
            <p className="text-[11px] text-slate-400 mt-1">
              Citas confirmadas hoy
            </p>
          </button>

          <button
            onClick={() => handleTabChange('servicios')}
            className={`bg-white border rounded-2xl p-5 text-left shadow-[0_1px_3px_rgba(0,0,0,0.03)] transition-all ${
              activeTab === 'servicios' ? 'border-[#025a4e]/40 ring-2 ring-[#025a4e]/10' : 'border-slate-100 hover:border-slate-200'
            }`}
          >
            <span className="inline-block text-[10px] uppercase font-bold tracking-wider text-purple-700 bg-purple-50 px-2 py-0.5 rounded-md mb-2">
              Servicios activos
            </span>
            <p className="font-serif text-3xl sm:text-4xl font-bold text-slate-900 leading-tight">
              {activeServicesCount}/{services.length}
            </p>
            <p className="text-[11px] text-slate-400 mt-1">
              en catálogo
            </p>
          </button>
        </div>

        <div className="flex items-center gap-2 mb-6 border-b border-slate-200/80 pb-3 overflow-x-auto">
          <button
            onClick={() => handleTabChange('agenda')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
              activeTab === 'agenda'
                ? 'bg-[#025a4e] text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <ListTodo className="w-3.5 h-3.5" />
            <span>Agenda ({upcomingList.length})</span>
          </button>

          <button
            onClick={() => handleTabChange('servicios')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
              activeTab === 'servicios'
                ? 'bg-[#025a4e] text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Servicios ({services.length})</span>
          </button>

          <button
            onClick={() => handleTabChange('horarios')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
              activeTab === 'horarios'
                ? 'bg-[#025a4e] text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Horarios</span>
          </button>

          <button
            onClick={() => handleTabChange('reportes')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
              activeTab === 'reportes'
                ? 'bg-[#025a4e] text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>Reportes</span>
          </button>

          <button
            onClick={() => handleTabChange('opiniones')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
              activeTab === 'opiniones'
                ? 'bg-[#025a4e] text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Star className="w-3.5 h-3.5" />
            <span>Opiniones ({providerReviews.length})</span>
          </button>

          <button
            onClick={() => handleTabChange('perfil')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
              activeTab === 'perfil'
                ? 'bg-[#025a4e] text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Settings className="w-3.5 h-3.5" />
            <span>Mi perfil</span>
          </button>
        </div>

        {activeTab === 'agenda' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <div className="flex items-center justify-between">
              <h2 className="font-serif text-base font-bold text-slate-900">Próximas citas</h2>
              <span className="text-xs text-slate-400">{upcomingList.length} agendadas</span>
            </div>

            <div className="bg-white border border-slate-100 rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.03)] overflow-hidden divide-y divide-slate-50">
              {isLoadingAppointments ? (
                <div className="p-8 text-center text-xs text-slate-400">Cargando citas...</div>
              ) : upcomingList.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400">
                  No tienes citas próximas. Cuando un cliente reserve, aparecerá aquí.
                </div>
              ) : (
                upcomingList.map((apt) => renderAppointment(apt, true))
              )}
            </div>

            {historyList.length > 0 && (
              <>
                <h2 className="font-serif text-base font-bold text-slate-900 pt-4">Historial</h2>
                <div className="bg-white border border-slate-100 rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.03)] overflow-hidden divide-y divide-slate-50">
                  {historyList.map((apt) => renderAppointment(apt, false))}
                </div>
              </>
            )}
          </div>
        )}

        {activeTab === 'servicios' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <div className="flex items-center justify-between">
              <h2 className="font-serif text-base font-bold text-slate-900">Catálogo de servicios</h2>
              <button
                onClick={openCreateService}
                className="inline-flex items-center gap-1.5 bg-[#025a4e] hover:bg-[#03483e] text-white text-xs font-semibold px-4 py-2 rounded-xl shadow-sm transition-all"
              >
                <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>Agregar servicio</span>
              </button>
            </div>

            {!isLoadingSchedule && schedule.length === 0 && (
              <div className="rounded-xl bg-amber-50 border border-amber-100 p-3.5 text-xs text-amber-700">
                Todavía no configuras tus horarios, por eso los clientes no pueden reservar.{' '}
                <button
                  type="button"
                  onClick={() => handleTabChange('horarios')}
                  className="font-semibold underline"
                >
                  Configurar horarios
                </button>
              </div>
            )}

            <div className="bg-white border border-slate-100 rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.03)] overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                      <th scope="col" className="py-4 px-6">
                        Servicio
                      </th>
                      <th scope="col" className="py-4 px-6">
                        Duración
                      </th>
                      <th scope="col" className="py-4 px-6">
                        Costo ref.
                      </th>
                      <th scope="col" className="py-4 px-6">
                        Reservas
                      </th>
                      <th scope="col" className="py-4 px-6 text-center">
                        Activo
                      </th>
                      <th scope="col" className="py-4 px-6 text-right">
                        Acciones
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 text-xs">
                    {isLoadingServices ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-slate-400">
                          Cargando servicios...
                        </td>
                      </tr>
                    ) : services.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-slate-400">
                          Todavía no tienes servicios en tu catálogo.
                        </td>
                      </tr>
                    ) : (
                      services.map((srv) => (
                        <tr
                          key={srv.id}
                          className={`hover:bg-slate-50/60 transition-colors ${srv.isActive ? '' : 'bg-slate-50/50'}`}
                        >
                          <td className="py-4 px-6">
                            <p className={`font-bold ${srv.isActive ? 'text-slate-900' : 'text-slate-400'}`}>
                              {srv.name}
                            </p>
                            <p className="text-[11px] text-slate-400 mt-0.5">
                              {categoryLabel(srv.category)}
                              {!srv.isActive && ' · Inactivo'}
                            </p>
                          </td>

                          <td className="py-4 px-6 text-slate-400 font-normal">{srv.durationMinutes} min</td>

                          <td className="py-4 px-6 font-bold text-[#025a4e]">
                            ${srv.price.toLocaleString('es-CO')}
                          </td>

                          <td className="py-4 px-6 text-slate-400 font-normal">
                            {appointments.filter((a) => a.serviceId === srv.id && a.status !== 'CANCELLED').length}{' '}
                            reservas
                          </td>

                          <td className="py-4 px-6 text-center">
                            <button
                              type="button"
                              title={srv.isActive ? 'Desactivar servicio' : 'Activar servicio'}
                              onClick={() => handleToggleService(srv)}
                              className={`w-10 h-5 inline-flex items-center rounded-full p-0.5 transition-colors duration-200 ease-in-out ${
                                srv.isActive ? 'bg-[#025a4e]' : 'bg-slate-200'
                              }`}
                            >
                              <div
                                className={`bg-white w-4 h-4 rounded-full shadow-sm transform transition-transform duration-200 ease-in-out ${
                                  srv.isActive ? 'translate-x-5' : 'translate-x-0'
                                }`}
                              />
                            </button>
                          </td>

                          <td className="py-4 px-6 text-right">
                            <button
                              onClick={() => openEditService(srv)}
                              title="Editar servicio"
                              className="text-slate-300 hover:text-[#025a4e] transition-colors p-1 rounded-lg"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'horarios' &&
          (isLoadingSchedule ? (
            <p className="text-xs text-slate-400">Cargando horarios...</p>
          ) : (
            <ScheduleEditor schedule={schedule} onSave={handleSaveSchedule} />
          ))}

        {activeTab === 'reportes' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-serif text-base font-bold text-slate-900">Reportes y métricas del negocio</h2>
                <p className="text-xs text-slate-400 mt-0.5">Indicadores calculados con las reservas del mes seleccionado</p>
              </div>
              <label className="flex items-center gap-2 rounded-xl border border-teal-200 bg-teal-50 px-3 py-1.5 text-xs font-semibold text-[#025a4e]">
                <CalendarDays className="h-4 w-4" />
                <span className="capitalize">{reportMonthLabel}</span>
                <input
                  type="month"
                  value={reportMonthValue}
                  onChange={(event) => setReportMonthValue(event.target.value)}
                  aria-label="Seleccionar mes de los reportes"
                  className="max-w-[28px] cursor-pointer bg-transparent text-transparent outline-none [color-scheme:light]"
                />
              </label>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
              <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
                <p className="text-xs font-semibold uppercase text-slate-400">Ingresos de citas completadas</p>
                <p className="mt-2 font-serif text-3xl font-bold text-slate-900">${reportRevenue.toLocaleString('es-CO')}</p>
              </div>
              <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
                <p className="text-xs font-semibold uppercase text-slate-400">Servicios completados</p>
                <p className="mt-2 font-serif text-3xl font-bold text-slate-900">{reportCompleted.length}</p>
              </div>
              <div className="rounded-2xl border border-amber-100 bg-white p-5 shadow-sm">
                <p className="text-xs font-semibold uppercase text-slate-400">Pendientes de atención</p>
                <p className="mt-2 font-serif text-3xl font-bold text-amber-600">{reportPendingAttention.length}</p>
              </div>
              <div className="rounded-2xl border border-rose-100 bg-white p-5 shadow-sm">
                <p className="text-xs font-semibold uppercase text-slate-400">Citas canceladas</p>
                <p className="mt-2 font-serif text-3xl font-bold text-rose-600">{reportMonthCancelled.length}</p>
              </div>
<div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
                <p className="text-xs font-semibold uppercase text-slate-400">Ocupación estimada de agenda</p>
                <p className="mt-2 font-serif text-3xl font-bold text-slate-900">{reportOccupancy}%</p>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
              <h3 className="mb-1 font-serif text-sm font-bold text-slate-900">Servicios más demandados</h3>
              <p className="mb-5 text-xs text-slate-400">Distribución de reservas no canceladas por servicio durante el mes</p>
              {reportDemand.length === 0 ? (
                <p className="rounded-xl bg-slate-50 p-5 text-center text-xs text-slate-500">Todavía no hay reservas registradas para este mes.</p>
              ) : (
                <div className="space-y-5">
                  {reportDemand.map((item) => (
                    <div key={item.name}>
                      <div className="mb-1.5 flex items-center justify-between gap-3 text-xs">
                        <span className="font-semibold text-slate-800">{item.name}</span>
                        <span className="shrink-0 font-semibold text-[#025a4e]">{item.count} {item.count === 1 ? 'reserva' : 'reservas'} · {Math.round((item.count / reportTotalDemand) * 100)}%</span>
                      </div>
                      <div className="h-3 w-full overflow-hidden rounded-full bg-slate-100">
                        <div className="h-full rounded-full bg-[#025a4e]" style={{ width: `${Math.round((item.count / reportTotalDemand) * 100)}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <p className="text-[11px] text-slate-400">Los reportes se recalculan al cargar las reservas del proveedor. La ocupación se estima usando los horarios semanales configurados y las duraciones de las reservas; no representa disponibilidad en tiempo real del servidor.</p>
          </div>
        )}

        {activeTab === 'opiniones' && (
          <div className="space-y-5 animate-in fade-in duration-200">
            <div>
              <h2 className="font-serif text-base font-bold text-slate-900">Opiniones de clientes</h2>
              <p className="mt-0.5 text-xs text-slate-400">Calificaciones y comentarios recibidos en tus servicios</p>
            </div>
            {isLoadingReviews ? (
              <div className="rounded-2xl border border-slate-100 bg-white p-8 text-center text-xs text-slate-400">Cargando opiniones...</div>
            ) : providerReviews.length === 0 ? (
              <div className="rounded-2xl border border-slate-100 bg-white p-8 text-center text-xs text-slate-500">Todavía no has recibido opiniones de tus clientes.</div>
            ) : (
              <>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
                    <p className="text-[11px] font-semibold uppercase text-slate-400">Calificación promedio</p>
                    <div className="mt-2 flex items-center gap-2">
                      <Star className="h-5 w-5 fill-amber-400 text-amber-400" />
                      <span className="font-serif text-2xl font-bold text-slate-900">{(providerReviews.reduce((sum, review) => sum + review.rating, 0) / providerReviews.length).toFixed(1)}</span>
                      <span className="text-xs text-slate-400">de 5</span>
                    </div>
                  </div>
                  <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
                    <p className="text-[11px] font-semibold uppercase text-slate-400">Opiniones recibidas</p>
                    <p className="mt-2 font-serif text-2xl font-bold text-slate-900">{providerReviews.length}</p>
                  </div>
                </div>
                <div className="space-y-3">
                  {providerReviews.map((review) => (
                    <article key={review.id} className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-xs font-bold text-slate-900">{review.clientName}</p>
                          <p className="mt-0.5 text-[11px] text-slate-400">{services.find((service) => service.id === review.serviceId)?.name || 'Servicio'}</p>
                        </div>
                        <div className="flex items-center gap-0.5" aria-label={`${review.rating} de 5 estrellas`}>
                          {[1, 2, 3, 4, 5].map((value) => <Star key={value} className={`h-3.5 w-3.5 ${value <= review.rating ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}`} />)}
                        </div>
                      </div>
                      <p className="mt-3 text-xs leading-relaxed text-slate-600">{review.comment}</p>
                      <p className="mt-2 text-[10px] text-slate-400">{new Date(review.createdAt).toLocaleDateString('es-CO')}</p>
                    </article>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {activeTab === 'perfil' && (
          <form onSubmit={handleSaveProfile} className="space-y-6 animate-in fade-in duration-200">
            <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
              <h3 className="font-serif text-sm font-bold text-slate-900">
                Logo o foto del negocio
              </h3>
              <p className="text-xs text-slate-400 font-normal mt-0.5 mb-4">
                Aparece como avatar en tu perfil y en las confirmaciones de cita. Recomendado: 400×400 px.
              </p>

              <div className="flex items-center gap-4">
                <div className="relative">
                  {user?.avatarUrl ? <img src={user.avatarUrl} alt="Logo o foto del negocio" className="h-16 w-16 rounded-2xl object-cover shadow-sm" /> : <div className="w-16 h-16 rounded-2xl bg-[#eafaf5] text-[#025a4e] font-bold text-xl flex items-center justify-center shadow-sm">{businessInitials}</div>}
                  <label htmlFor="provider-business-image" title="Editar logo" className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-[#025a4e] text-white flex items-center justify-center shadow-sm cursor-pointer"><Pencil className="w-2.5 h-2.5" /></label>
                  <input id="provider-business-image" type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => { void handleBusinessImageUpload(e.target.files?.[0]); e.currentTarget.value = ''; }} />
                </div>

                <div>
                  <button type="button" onClick={() => document.getElementById('provider-business-image')?.click()} className="text-xs font-bold text-[#025a4e] hover:underline">Subir imagen</button>
                  <p className="text-[11px] text-slate-400 mt-0.5">PNG, JPG o WEBP · máx. 2 MB</p>
                </div>
              </div>
            </div>

            <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
              <h3 className="font-serif text-sm font-bold text-slate-900 mb-4">
                Datos del negocio
              </h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                    Nombre del negocio <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={businessProfile.businessName}
                    onChange={(e) =>
                      setBusinessProfile({ ...businessProfile, businessName: e.target.value })
                    }
                    required
                    aria-label="Nombre del negocio, campo obligatorio"
                    className="w-full bg-[#fafafa] border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#025a4e]"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                      Categoría
                    </label>
                    <select
                      value={businessProfile.category}
                      onChange={(e) =>
                        setBusinessProfile({ ...businessProfile, category: e.target.value })
                      }
                      className="w-full bg-[#fafafa] border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#025a4e]"
                    >
                      <option value="SALUD">🏥 Salud</option>
                      <option value="BELLEZA">✂️ Belleza</option>
                      <option value="DEPORTES">🏋️ Deportes</option>
                      <option value="BIENESTAR">🧘 Bienestar</option>
                      <option value="ODONTOLOGIA">🦷 Odontología</option>
                      <option value="FISIOTERAPIA">🤕 Fisioterapia</option>
                      <option value="OTRO">📋 Otro</option>
                    </select>
                  </div>

                  <ColombiaLocationFields
                    department={businessProfile.department}
                    city={businessProfile.city}
                    required
                    compact
                    onDepartmentChange={(department) => setBusinessProfile((current) => ({ ...current, department, city: '' }))}
                    onCityChange={(city) => setBusinessProfile((current) => ({ ...current, city }))}
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                    Descripción del negocio
                  </label>
                  <textarea
                    rows={3}
                    value={businessProfile.description}
                    onChange={(e) =>
                      setBusinessProfile({ ...businessProfile, description: e.target.value })
                    }
                    className="w-full bg-[#fafafa] border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#025a4e]"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                    Dirección <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={businessProfile.address}
                    onChange={(e) =>
                      setBusinessProfile({ ...businessProfile, address: e.target.value })
                    }
                    required
                    aria-label="Dirección del negocio, campo obligatorio"
                    className="w-full bg-[#fafafa] border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#025a4e]"
                  />
                  <p className="mt-1.5 text-[10px] text-slate-400">Campo obligatorio para guardar los cambios del perfil.</p>
                </div>
              </div>
            </div>

            <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
              <h3 className="font-serif text-sm font-bold text-slate-900">
                Datos de contacto
              </h3>
              <p className="text-xs text-slate-400 font-normal mt-0.5 mb-4">
                Visibles para clientes que tengan citas confirmadas.
              </p>

              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                      Correo electrónico
                    </label>
                    <div className="relative">
                      <Mail className="w-3.5 h-3.5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="email"
                        value={businessProfile.email}
                        readOnly
                        className="w-full bg-slate-100 border border-slate-200 rounded-xl pl-9 pr-3.5 py-2.5 text-xs text-slate-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                      Teléfono / WhatsApp
                    </label>
                    <div className="relative">
                      <Phone className="w-3.5 h-3.5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="tel"
                        inputMode="tel"
                        maxLength={16}
                        placeholder="Ej. 3001234567 o +573001234567"
                        value={businessProfile.phone}
                        onChange={(e) =>
                          setBusinessProfile({ ...businessProfile, phone: e.target.value })
                        }
                        className="w-full bg-[#fafafa] border border-slate-200 rounded-xl pl-9 pr-3.5 py-2.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#025a4e]"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                    Sitio Web
                  </label>
                  <div className="relative">
                    <Globe className="w-3.5 h-3.5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      value={businessProfile.website}
                      onChange={(e) =>
                        setBusinessProfile({ ...businessProfile, website: e.target.value })
                      }
                      className="w-full bg-[#fafafa] border border-slate-200 rounded-xl pl-9 pr-3.5 py-2.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#025a4e]"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
              <h3 className="font-serif text-sm font-bold text-slate-900">
                Política de cancelación
              </h3>
              <p className="text-xs text-slate-400 font-normal mt-0.5 mb-3">
                Los clientes podrán cancelar sin cargo hasta este tiempo antes de la cita.
              </p>

              <select
                value={businessProfile.cancellationPolicy}
                onChange={(e) =>
                  setBusinessProfile({ ...businessProfile, cancellationPolicy: e.target.value })
                }
                className="w-full sm:w-72 bg-[#fafafa] border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#025a4e]"
              >
                <option value="12 horas de anticipación">12 horas de anticipación</option>
                <option value="24 horas de anticipación">24 horas de anticipación</option>
                <option value="48 horas de anticipación">48 horas de anticipación</option>
              </select>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
              <span className="text-xs text-slate-400">
                Los cambios en el perfil se reflejan en el catálogo en minutos.
              </span>
              <button
                type="submit"
                className="bg-[#025a4e] hover:bg-[#03483e] text-white text-xs font-semibold px-6 py-2.5 rounded-xl shadow-sm transition-all self-end sm:self-auto"
              >
                Guardar cambios
              </button>
            </div>
          </form>
        )}
      </div>

      {isServiceModalOpen && (
        <ServiceFormModal
          service={editingService}
          defaultCategory={user?.businessCategory || 'SALUD'}
          onSave={handleSaveService}
          onClose={() => setIsServiceModalOpen(false)}
        />
      )}

      {serviceToDeactivate && (
        <ConfirmModal
          title="¿Desactivar este servicio?"
          message={
            <>
              <strong className="text-slate-800 font-semibold">{serviceToDeactivate.name}</strong> dejará de
              aparecer en el catálogo y los clientes no podrán hacer nuevas reservas. Las citas que ya existen no
              se cancelan, y puedes activarlo otra vez cuando quieras.
            </>
          }
          confirmLabel="Sí, desactivar"
          onConfirm={handleDeactivateService}
          onClose={() => setServiceToDeactivate(null)}
        />
      )}

      {detailAppointment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-100 bg-white p-6 shadow-xl">
            <div className="mb-5 flex items-center justify-between">
              <h3 className="font-serif text-lg font-bold text-slate-900">Detalle de la reserva</h3>
              <button type="button" onClick={() => setDetailAppointment(null)} className="text-slate-400 hover:text-slate-600" aria-label="Cerrar detalle">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4 text-sm">
              <div><p className="text-xs text-slate-400">Cliente</p><p className="font-semibold text-slate-900">{detailAppointment.clientName}</p></div>
              <div><p className="text-xs text-slate-400">Servicio</p><p className="font-semibold text-slate-900">{detailAppointment.serviceName}</p></div>
              <div className="grid grid-cols-2 gap-4">
                <div><p className="text-xs text-slate-400">Fecha de la cita</p><p className="font-medium text-slate-800">{formatDate(detailAppointment.date)} · {formatTime(detailAppointment.time)}</p></div>
                <div><p className="text-xs text-slate-400">Estado</p><p className="font-medium text-slate-800">{STATUS_LABEL[effectiveStatus(detailAppointment)]}</p></div>
                <div><p className="text-xs text-slate-400">Duración</p><p className="font-medium text-slate-800">{detailAppointment.durationMinutes} minutos</p></div>
              </div>
              {detailAppointment.status === 'CANCELLED' && (
                <div className="grid grid-cols-2 gap-4 rounded-xl bg-rose-50/70 p-3">
                  <div>
                    <p className="text-xs text-slate-500">Cancelada por</p>
                    <p className="font-semibold text-slate-900">{detailAppointment.cancelledBy === 'CLIENT' ? 'Cliente' : detailAppointment.cancelledBy === 'PROVIDER' ? 'Proveedor' : 'No disponible'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Fecha de cancelación</p>
                    <p className="font-medium text-slate-800">{detailAppointment.cancelledAt ? new Date(detailAppointment.cancelledAt).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' }) : 'No disponible'}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-xs text-slate-500">Motivo de cancelación</p>
                    <p className="whitespace-pre-wrap text-slate-800">{detailAppointment.cancellationReason?.trim() || 'No se indicó un motivo de cancelación.'}</p>
                  </div>
                </div>
              )}
              {detailAppointment.notes && <div><p className="text-xs text-slate-400">Información adicional</p><p className="whitespace-pre-wrap text-slate-700">{detailAppointment.notes}</p></div>}
            </div>
            <div className="mt-6 flex justify-end">
              <button type="button" onClick={() => setDetailAppointment(null)} className="rounded-xl bg-[#025a4e] px-5 py-2.5 text-xs font-semibold text-white hover:bg-[#03483e]">Cerrar</button>
            </div>
          </div>
        </div>
      )}

      {appointmentToCancel && (
        <ConfirmModal
          title="¿Cancelar esta cita?"
          message={
            <>
              Vas a cancelar la cita de{' '}
              <strong className="text-slate-800 font-semibold">{appointmentToCancel.clientName}</strong> para{' '}
              <strong className="text-slate-800 font-semibold">{appointmentToCancel.serviceName}</strong> el{' '}
              {formatDate(appointmentToCancel.date)} a las {formatTime(appointmentToCancel.time)}. El horario
              quedará libre para nuevas reservas.
            </>
          }
          extraContent={
            <label className="mt-3 block">
              <span className="mb-1.5 block text-xs font-semibold text-slate-700">Motivo de cancelación (opcional)</span>
              <textarea
                value={cancellationReason}
                onChange={(e) => setCancellationReason(e.target.value)}
                rows={3}
                maxLength={500}
                placeholder="Indica el motivo de la cancelación..."
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-700 outline-none focus:border-[#025a4e]"
              />
            </label>
          }
          confirmLabel="Sí, cancelar cita"
          onConfirm={handleCancelAppointment}
          onClose={() => { setAppointmentToCancel(null); setCancellationReason(''); }}
        />
      )}
    </div>
  );
}

export default function ProviderDashboardPage() {
  return (
    <AuthGuard allowedRoles={['PROVIDER']}>
      <React.Suspense
        fallback={
          <div className="min-h-screen bg-[#fafafa] flex items-center justify-center p-8">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#025a4e] border-t-transparent" />
          </div>
        }
      >
        <ProviderDashboardContent />
      </React.Suspense>
    </AuthGuard>
  );
}
