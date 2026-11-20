import { Service, ServiceForm } from '@/types/service';
import { User } from '@/types/auth';
import { supabase } from '@/lib/supabaseClient';

interface ServiceRow {
  id: string;
  provider_id: string;
  provider_name: string;
  name: string;
  description: string;
  category: string;
  price: number;
  duration_minutes: number;
  rating: number;
  review_count: number;
  image_url: string | null;
  location: string | null;
  provider_address: string | null;
  provider_phone: string | null;
  provider_website: string | null;
  provider_avatar_url: string | null;
  tags: string[] | null;
  is_active: boolean;
  created_at: string;
  reviews?: { rating: number }[];
}

function fromServiceRow(row: ServiceRow): Service {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    durationMinutes: row.duration_minutes,
    price: Number(row.price),
    category: row.category,
    providerId: row.provider_id,
    providerName: row.provider_name,
    providerLocation: row.location ?? undefined,
    providerAddress: row.provider_address ?? undefined,
    providerPhone: row.provider_phone ?? undefined,
    providerWebsite: row.provider_website ?? undefined,
    providerAvatarUrl: row.provider_avatar_url ?? undefined,
    imageUrl: row.image_url ?? undefined,
    rating: row.reviews ? (row.reviews.length ? row.reviews.reduce((sum, review) => sum + Number(review.rating), 0) / row.reviews.length : 0) : Number(row.rating),
    reviewsCount: row.reviews ? row.reviews.length : row.review_count,
    tags: row.tags ?? undefined,
    isActive: row.is_active,
    createdAt: row.created_at,
  };
}

function validateForm(form: ServiceForm) {
  if (!form.name.trim()) throw new Error('El nombre del servicio es obligatorio.');
  if (!form.category) throw new Error('Selecciona una categoría.');
  if (!Number.isInteger(form.durationMinutes) || form.durationMinutes <= 0) {
    throw new Error('La duración debe ser un número de minutos mayor a 0.');
  }
  if (!(form.price >= 0)) throw new Error('El costo referencial no puede ser negativo.');
}

class ServiceService {
  async getAllServices(): Promise<Service[]> {
    const { data, error } = await supabase
      .from('services')
      .select('*, reviews(rating)')
      .eq('is_active', true)
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return (data || []).map((row) => fromServiceRow(row as ServiceRow));
  }

  async getServicesByProvider(providerId: string): Promise<Service[]> {
    const { data, error } = await supabase
      .from('services')
      .select('*')
      .eq('provider_id', providerId)
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return (data || []).map((row) => fromServiceRow(row as ServiceRow));
  }

  async getServiceById(serviceId: string): Promise<Service | undefined> {
    const { data, error } = await supabase
      .from('services')
      .select('*')
      .eq('id', serviceId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ? fromServiceRow(data as ServiceRow) : undefined;
  }

  async createService(form: ServiceForm, provider: User): Promise<Service> {
    validateForm(form);

    const { data, error } = await supabase
      .from('services')
      .insert({
        provider_id: provider.id,
        provider_name: provider.businessName || provider.name,
        name: form.name.trim(),
        description: form.description.trim() || 'Servicio profesional certificado.',
        category: form.category,
        price: form.price,
        duration_minutes: form.durationMinutes,
        location: provider.city && provider.department ? `${provider.city}, ${provider.department}` : provider.city ?? null,
        provider_address: provider.address ?? null,
        provider_phone: provider.phone ?? null,
        provider_website: provider.website ?? null,
        provider_avatar_url: provider.avatarUrl ?? null,
        is_active: true,
      })
      .select()
      .single();
    if (error || !data) throw new Error(error?.message || 'No se pudo crear el servicio.');
    return fromServiceRow(data as ServiceRow);
  }

  async updateService(serviceId: string, form: ServiceForm): Promise<Service> {
    validateForm(form);

    const { data, error } = await supabase
      .from('services')
      .update({
        name: form.name.trim(),
        description: form.description.trim() || 'Servicio profesional certificado.',
        category: form.category,
        price: form.price,
        duration_minutes: form.durationMinutes,
      })
      .eq('id', serviceId)
      .select()
      .single();
    if (error || !data) throw new Error(error?.message || 'No se pudo actualizar el servicio.');
    return fromServiceRow(data as ServiceRow);
  }

  async setServiceActive(serviceId: string, isActive: boolean): Promise<Service> {
    const { data, error } = await supabase
      .from('services')
      .update({ is_active: isActive })
      .eq('id', serviceId)
      .select()
      .single();
    if (error || !data) throw new Error(error?.message || 'No se pudo cambiar el estado del servicio.');
    return fromServiceRow(data as ServiceRow);
  }
}

export const serviceService = new ServiceService();
