import { redirect } from "next/navigation";

// El middleware ya garantiza que solo un usuario autenticado llega aquí
// (si no, lo redirige a /login antes de que esta página se renderice).
export default function Home() {
  redirect("/dashboard");
}
