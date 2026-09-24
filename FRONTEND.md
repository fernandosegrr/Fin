# Frontend

El dashboard separa carga de datos, operaciones y presentación:

- `components/dashboard-container.tsx` coordina navegación, sesión visual y avisos.
- `components/dashboard/use-dashboard-data.ts` mantiene el mes solicitado y el último mes cargado, e ignora respuestas antiguas.
- `components/dashboard/use-dashboard-realtime.ts` escucha cambios y solicita recargas.
- `components/dashboard/dashboard-content.tsx` presenta las secciones con los datos del mes cargado.
- Las carpetas de `components/` agrupan la lógica de cada función: `transactions`, `recurring`, `balance`, `budgets`, `categories`, `goals`, `history` y `advisor`. Los archivos `.tsx` de la raíz presentan la interfaz; los hooks `use-*.ts` gestionan formularios, operaciones y estados de carga.

Las mutaciones del cliente llaman a las acciones públicas de `app/dashboard/actions.ts` y `app/dashboard/asesor-actions.ts`. Las respuestas del servidor vuelven a sincronizar el dashboard; las listas optimistas muestran el cambio mientras se resuelve la petición. Si falla, el estado optimista se revierte y se muestra el error.

Al agregar una función, mantén los cálculos puros fuera de los componentes y conserva la fecha del mes que el usuario tiene abierto. Las fechas de cobros recurrentes y los filtros de movimientos están en módulos puros con pruebas.

Verificación: `npm run typecheck`, `npm run lint`, `npm test` y `npm run build`. Las rutas autenticadas requieren una sesión de prueba para verificar operaciones de punta a punta.
