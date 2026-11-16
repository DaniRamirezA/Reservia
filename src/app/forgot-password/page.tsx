'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { authService } from '@/services/authService';
import { ArrowLeft, CheckCircle2, Loader2, Mail } from 'lucide-react';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      await authService.requestPasswordReset(email);
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo enviar el correo. Inténtalo de nuevo.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-80px)] flex items-center justify-center bg-slate-50 px-4 py-12">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-7 shadow-sm sm:p-9">
        <Link href="/login" className="mb-7 inline-flex items-center gap-2 text-sm font-medium text-[#027a6a] hover:underline">
          <ArrowLeft className="h-4 w-4" /> Volver al inicio de sesión
        </Link>

        {sent ? (
          <div className="text-center">
            <CheckCircle2 className="mx-auto mb-4 h-12 w-12 text-emerald-600" />
            <h1 className="mb-2 font-serif text-2xl font-bold text-slate-900">Revisa tu correo</h1>
            <p className="mb-6 text-sm leading-6 text-slate-600">
              Si existe una cuenta asociada a <strong>{email}</strong>, recibirás un enlace para crear una nueva contraseña. Revisa también la carpeta de spam.
            </p>
            <button onClick={() => router.push('/login')} className="w-full rounded-xl bg-[#025a4e] px-4 py-3 text-sm font-semibold text-white hover:bg-[#03483e]">
              Volver a iniciar sesión
            </button>
          </div>
        ) : (
          <>
            <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-xl bg-teal-50 text-[#025a4e]">
              <Mail className="h-6 w-6" />
            </div>
            <h1 className="mb-2 font-serif text-2xl font-bold text-slate-900">¿Olvidaste tu contraseña?</h1>
            <p className="mb-6 text-sm leading-6 text-slate-600">
              Ingresa el correo electrónico de tu cuenta y te enviaremos un enlace para restablecerla.
            </p>

            {error && <div role="alert" className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</div>}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="email" className="mb-1.5 block text-sm font-semibold text-slate-700">Correo electrónico</label>
                <input
                  id="email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="tu@correo.com"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[#025a4e] focus:bg-white focus:ring-2 focus:ring-teal-100"
                />
              </div>
              <button type="submit" disabled={isSubmitting} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#025a4e] px-4 py-3.5 text-sm font-semibold text-white transition hover:bg-[#03483e] disabled:cursor-not-allowed disabled:opacity-70">
                {isSubmitting ? <><Loader2 className="h-4 w-4 animate-spin" /> Enviando...</> : 'Enviar enlace de recuperación'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
