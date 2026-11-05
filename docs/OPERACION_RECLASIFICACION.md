# Aplicación de la auditoría financiera

La app necesita primero la migración aditiva `20261105010000_cuentas_y_clasificacion`. El archivo [SUPABASE_AUDITORIA.sql](SUPABASE_AUDITORIA.sql) contiene esa migración exacta, con transacción, comprobaciones del esquema existente y protección para volver a pegarla sin duplicar. Se puede ejecutar desde el SQL Editor de Supabase. No publicar la nueva interfaz antes de comprobar el esquema. No se utiliza la clave secreta de Supabase en el navegador ni en las consultas normales: el runtime conserva cookies de sesión y RLS.

## Preparación y ensayo

Los respaldos, decisiones y resultados contienen datos privados; deben permanecer fuera del repositorio. El script recibe tres rutas explícitas:

```powershell
npx tsx scripts/financial-plan.ts --original <respaldo-original.json> --config <configuracion-privada.json> --output <carpeta-privada> --rehearse
```

`--rehearse` crea PostgreSQL en memoria, instala todas las migraciones, carga el respaldo antes de la ampliación y ensaya la misma RPC autenticada que se usará en producción. Comprueba cobertura, conservación del disponible, traspasos, idempotencia, búsqueda completa y reversión. No usa la red ni las credenciales de producción.

Antes de aplicar se debe revisar el informe de diferencias. Las decisiones cubren cada ID original y no inventan partidas para movimientos sin detalle. Un desglose conserva la suma, fecha y cuenta; mantiene el ID original en la primera parte y relaciona las adicionales.

## Migración de esquema

1. Con acceso de administración al proyecto, comprobar tablas, columnas, funciones, políticas y el historial de migraciones existente. Crear un respaldo de esquema/datos según la operación disponible.
2. Si se dispone de conexión PostgreSQL y de historial Prisma establecido, ejecutar `npx prisma migrate deploy`. No ejecutar `migrate dev` ni `db push` en producción.
3. Si el esquema anterior se aplicó manualmente y no hay historial Prisma, verificar primero que coincide con las migraciones antiguas, marcarlas como aplicadas con `prisma migrate resolve --applied <nombre>` y ejecutar sólo la nueva. No volver a ejecutar el baseline sobre tablas existentes.
4. Si se usa el complemento Supabase, aplicar el SQL de la nueva migración con su herramienta de migraciones y registrar ese hecho. Antes de volver a usar Prisma CLI será necesario resolver esa migración como ya aplicada. No ejecutar el mismo SQL dos veces.
5. Verificar cuentas predeterminadas por usuario, RLS, permisos, RPC de historial/lotes/presupuestos y recarga de caché de PostgREST. La ampliación estructural crea cuentas vacías para usuarios existentes sin reclasificar sus datos particulares.

## Lote de datos

Sin `--apply`, el script sólo lee producción y escribe un respaldo y un plan privados:

```powershell
npx tsx scripts/financial-plan.ts --original <respaldo-original.json> --config <configuracion-privada.json> --output <carpeta-privada>
```

Para aplicar el plan revisado, agregar `--apply`. El script verifica cambios concurrentes contra el respaldo. Genera una sesión temporal del propietario con `generateLink` y `verifyOtp`; no envía correo, no imprime tokens y cierra únicamente esa sesión local. La escritura usa `aplicar_plan_financiero` con RLS, un lote estable y una transacción única. Un reintento del mismo lote no duplica registros.

Conservar los respaldos antes/después y el resultado del lote. Verificar saldos, ingresos históricos, ahorro, rendimientos originales y pendientes con una lectura posterior. El historial de cambios permite deshacer el lote si sus registros no tienen ediciones posteriores; si las hay, toda la reversión falla sin restaurar parcialmente.

## Publicación y comprobaciones

El repositorio ya tiene compilaciones de Cloudflare Workers confirmadas tanto para `main` como para la rama de trabajo anterior. Después de verificar el esquema, publicar el código probado, esperar la compilación de Workers del mismo commit y comprobar que la versión activa en la dirección habitual corresponde a esa entrega. No asumir que compilar equivale a recibir tráfico. Aplicar y verificar el lote personal con la nueva estructura.

Validar acceso, captura/edición/archivo/restauración, traspaso a ahorro, rendimiento bruto/neto, filtros, Excel, presupuestos, permisos entre usuarios y consultas del asesor. En móvil comprobar teclado abierto, escritura larga, respuesta nueva y lectura de mensajes anteriores; la caja de entrada debe permanecer visible y sólo se desplaza la lista del chat.

El cálculo de Revolut es una estimación con las tasas configuradas; los pagos reales se capturan por cuenta. No existe una conexión bancaria que importe automáticamente los pagos. Nunca convertir un interés estimado en un abono confirmado.
