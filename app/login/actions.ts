"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export interface EstadoAuth {
  error: string | null;
  mensaje: string | null;
}

function mensajeErrorAuth(mensaje: string): string {
  const t = mensaje.toLowerCase();
  if (t.includes("invalid login credentials") || t.includes("invalid_credentials")) {
    return "Correo o contraseña incorrectos.";
  }
  if (t.includes("email not confirmed")) {
    return "Confirma tu correo antes de iniciar sesión.";
  }
  if (t.includes("user already registered") || t.includes("already been registered")) {
    return "Ya existe una cuenta con ese correo. Inicia sesión.";
  }
  if (t.includes("password should be at least") || t.includes("password is known to be weak")) {
    return "La contraseña es demasiado débil. Usa al menos 6 caracteres.";
  }
  if (t.includes("rate limit") || t.includes("too many") || t.includes("over_request")) {
    return "Demasiados intentos. Espera un momento e inténtalo de nuevo.";
  }
  if (t.includes("network") || t.includes("fetch")) {
    return "No se pudo conectar. Revisa tu internet e inténtalo de nuevo.";
  }
  return "No se pudo completar la acción. Inténtalo de nuevo.";
}

export async function signIn(
  _prevState: EstadoAuth,
  formData: FormData,
): Promise<EstadoAuth> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Ingresa tu correo y contraseña.", mensaje: null };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: mensajeErrorAuth(error.message), mensaje: null };
  }

  redirect("/dashboard");
}

export async function signUp(
  _prevState: EstadoAuth,
  formData: FormData,
): Promise<EstadoAuth> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Ingresa tu correo y contraseña.", mensaje: null };
  }
  if (password.length < 6) {
    return { error: "La contraseña debe tener al menos 6 caracteres.", mensaje: null };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({ email, password });

  if (error) {
    return { error: mensajeErrorAuth(error.message), mensaje: null };
  }

  if (!data.session) {
    return {
      error: null,
      mensaje: "Cuenta creada. Revisa tu correo para confirmarla antes de iniciar sesión.",
    };
  }

  redirect("/dashboard");
}
