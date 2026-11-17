import { Appointment } from '@/types/appointment';
import { User } from '@/types/auth';
import { supabase } from '@/lib/supabaseClient';

interface ReviewRow {
  id: string;
  appointment_id: string;
  service_id: string;
  client_id: string;
  client_name: string;
  rating: number;
  comment: string;
  created_at: string;
}

export interface ServiceReview {
  id: string;
  appointmentId: string;
  clientName: string;
  rating: number;
  comment: string;
  createdAt: string;
}

function fromRow(row: ReviewRow): ServiceReview {
  return {
    id: row.id,
    appointmentId: row.appointment_id,
    clientName: row.client_name,
    rating: row.rating,
    comment: row.comment,
    createdAt: row.created_at,
  };
}

class ReviewService {
  async getReviewedAppointmentIds(clientId: string): Promise<string[]> {
    const { data, error } = await supabase
      .from('reviews')
      .select('appointment_id')
      .eq('client_id', clientId);
    if (error) throw new Error(error.message);
    return (data || []).map((row) => row.appointment_id as string);
  }

  async getServiceReviews(serviceId: string): Promise<ServiceReview[]> {
    const { data, error } = await supabase
      .from('reviews')
      .select('*')
      .eq('service_id', serviceId)
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return (data || []).map((row) => fromRow(row as ReviewRow));
  }

  async createReview(appointment: Appointment, client: User, rating: number, comment: string): Promise<void> {
    if (appointment.status === 'CANCELLED') throw new Error('No puedes opinar sobre una reserva cancelada.');
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) throw new Error('Selecciona una calificación entre 1 y 5 estrellas.');
    if (comment.trim().length < 5) throw new Error('El comentario debe tener al menos 5 caracteres.');

    const { error } = await supabase.from('reviews').insert({
      appointment_id: appointment.id,
      service_id: appointment.serviceId,
      client_id: client.id,
      client_name: client.name,
      rating,
      comment: comment.trim(),
    });
    if (error) {
      if (error.code === '23505') throw new Error('Ya publicaste una opinión para esta reserva.');
      throw new Error(error.message);
    }
  }
}

export const reviewService = new ReviewService();
