"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export interface EstadoAuth {
  error: string | null;
  mensaje: string | null;
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
    return { error: error.message, mensaje: null };
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
    return { error: error.message, mensaje: null };
  }

  if (!data.session) {
    return {
      error: null,
      mensaje: "Cuenta creada. Revisa tu correo para confirmarla antes de iniciar sesión.",
    };
  }

  redirect("/dashboard");
}
