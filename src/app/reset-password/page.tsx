'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import { authService } from '@/services/authService';
import { ArrowLeft, CheckCircle2, KeyRound, Loader2 } from 'lucide-react';

const RECOVERY_FLAG = 'reservia-password-recovery';

export default function ResetPasswordPage() {
  const [recoveryReady, setRecoveryReady] = useState(false);
  const [checking, setChecking] = useState(true);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        window.sessionStorage.setItem(RECOVERY_FLAG, 'true');
        setRecoveryReady(true);
      }
    });

    if (window.sessionStorage.getItem(RECOVERY_FLAG) === 'true') {
      setRecoveryReady(true);
    }
    setChecking(false);

    return () => listener.subscription.unsubscribe();
  }, []);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError('La contraseña debe tener mínimo 8 caracteres.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden.');
      return;
    }

    setIsSubmitting(true);
    try {
      await authService.updateRecoveredPassword(password);
      window.sessionStorage.removeItem(RECOVERY_FLAG);
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo actualizar la contraseña. Solicita un nuevo enlace.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (checking) {
    return <div className="flex min-h-[50vh] items-center justify-center text-sm text-slate-600">Verificando el enlace...</div>;
  }

  return (
    <div className="min-h-[calc(100vh-80px)] flex items-center justify-center bg-slate-50 px-4 py-12">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-7 shadow-sm sm:p-9">
        <Link href="/login" className="mb-7 inline-flex items-center gap-2 text-sm font-medium text-[#027a6a] hover:underline">
          <ArrowLeft className="h-4 w-4" /> Volver al inicio de sesión
        </Link>

        {success ? (
          <div className="text-center">
            <CheckCircle2 className="mx-auto mb-4 h-12 w-12 text-emerald-600" />
            <h1 className="mb-2 font-serif text-2xl font-bold text-slate-900">Contraseña actualizada</h1>
            <p className="mb-6 text-sm leading-6 text-slate-600">Tu contraseña se cambió correctamente. Ya puedes ingresar a Reservia con tu nueva contraseña.</p>
            <Link href="/login" className="block w-full rounded-xl bg-[#025a4e] px-4 py-3 text-center text-sm font-semibold text-white hover:bg-[#03483e]">
              Iniciar sesión
            </Link>
          </div>
        ) : recoveryReady ? (
          <>
            <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-xl bg-teal-50 text-[#025a4e]">
              <KeyRound className="h-6 w-6" />
            </div>
            <h1 className="mb-2 font-serif text-2xl font-bold text-slate-900">Crea una nueva contraseña</h1>
            <p className="mb-6 text-sm leading-6 text-slate-600">Usa una contraseña de al menos 8 caracteres.</p>

            {error && <div role="alert" className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</div>}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="password" className="mb-1.5 block text-sm font-semibold text-slate-700">Nueva contraseña</label>
                <input id="password" type="password" required minLength={8} autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none focus:border-[#025a4e] focus:bg-white focus:ring-2 focus:ring-teal-100" />
              </div>
              <div>
                <label htmlFor="confirmPassword" className="mb-1.5 block text-sm font-semibold text-slate-700">Confirmar nueva contraseña</label>
                <input id="confirmPassword" type="password" required minLength={8} autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none focus:border-[#025a4e] focus:bg-white focus:ring-2 focus:ring-teal-100" />
              </div>
              <button type="submit" disabled={isSubmitting} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#025a4e] px-4 py-3.5 text-sm font-semibold text-white transition hover:bg-[#03483e] disabled:cursor-not-allowed disabled:opacity-70">
                {isSubmitting ? <><Loader2 className="h-4 w-4 animate-spin" /> Guardando...</> : 'Guardar nueva contraseña'}
              </button>
            </form>
          </>
        ) : (
          <div>
            <h1 className="mb-2 font-serif text-2xl font-bold text-slate-900">Enlace no válido o vencido</h1>
            <p className="mb-6 text-sm leading-6 text-slate-600">Solicita un nuevo enlace de recuperación e inténtalo otra vez.</p>
            <Link href="/forgot-password" className="block w-full rounded-xl bg-[#025a4e] px-4 py-3 text-center text-sm font-semibold text-white hover:bg-[#03483e]">
              Solicitar nuevo enlace
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
