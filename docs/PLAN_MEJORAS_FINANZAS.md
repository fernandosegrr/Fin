# Plan de auditoría, reclasificación y mejora de Finanzas

Fecha: 5 de noviembre de 2026. Zona horaria: America/Mexico_City.

Objetivo: que la aplicación explique cuánto entra por trabajo, cuánto se consume, cuánto se conserva o invierte, dónde está el dinero y qué decisiones concretas pueden mejorar las finanzas. El alcance comprende todo el historial de la cuenta indicada por el usuario, el asistente y las funciones generales de la app.

Este documento reúne los hallazgos iniciales y el plan autorizado. El usuario instaló el esquema y la reclasificación se aplicó en producción el 5 de noviembre de 2026, después de ensayarla con una copia privada en PostgreSQL. Se incorporó también una aportación posterior del 10% mediante un lote separado. Las propuestas individuales y respaldos quedan fuera del repositorio. La publicación de la interfaz está en verificación.

## 1. Base comprobada

La lectura se limitó por `user_id` a la cuenta identificada por el usuario. No se consultaron movimientos de la otra cuenta registrada.

| Elemento | Resultado |
| --- | --- |
| Periodo del historial | 21 de julio al 5 de noviembre de 2026 |
| Transacciones | 290 |
| Traspasos | 9 |
| Categorías | 14 |
| Pagos recurrentes | 4 |
| Clientes/proyectos | 21 |
| Presupuestos | 0 |
| Metas de ahorro | 0 |
| Movimientos sin descripción | 46; 40 sí tienen un cliente asociado |
| Referencias a categorías inexistentes | 0 |
| Duplicados exactos al comparar también cliente y recurrente | 0; coincidencias de fecha e importe entre clientes distintos no prueban duplicación |

Se preparó una decisión para cada una de las 290 transacciones y se conservaron los nueve traspasos. Las aclaraciones del usuario se incorporaron al lote privado: 42 categorías específicas, 35 filas resultantes señaladas para revisión y un movimiento mixto dividido en tres partes. Se conservan todos los identificadores originales; el resultado contiene 292 transacciones y diez traspasos. Los conceptos inciertos conservan su importe, sentido y evidencia sin inventar detalles.

Datos adicionales proporcionados por el usuario: el 5 de noviembre depositó $1,046.40 en Ahorros/Rendimientos Diarios de Revolut; ese importe procede de sus egresos anteriores registrados como ahorro. Indicó una tasa anual del 15% y pagos diarios con retención. Aclaró que su dinero principal, registrado como `tarjeta`, también genera rendimientos y que los seis ingresos históricos de esa categoría corresponden a ese fondo. El ahorro reservado antes de hoy no generaba rendimientos.

### Hallazgos del historial

| Hallazgo | Evidencia | Tratamiento propuesto |
| --- | --- | --- |
| Ahorro contado como consumo | 5 egresos de $530, $100, $52, $294.40 y $70; suma $1,046.40 | Reclasificar como aportaciones/reservas y traspasos a ahorro; conciliar con Revolut sin crear dinero adicional |
| Categoría demasiado amplia | Servicios Personales: 48 movimientos, $9,385.21; mezcla gasolina, útiles, ropa, videojuegos, suscripciones y deudas | Distribuir por concepto; conservar los casos ambiguos en revisión |
| Contexto mezclado con concepto | Salidas en pareja: 77 movimientos, $18,128.06; incluye restaurantes, postres, Uber, estacionamiento, regalos y viajes | Categorías por concepto y etiqueta `En pareja` para conservar ese análisis |
| Rendimientos reales con descripción confusa | 6 ingresos, $19.60, descritos como `Ajuste a saldo real (...)`; el usuario confirmó que son ganancias de su dinero principal | Conservarlos como ingreso financiero del fondo principal, distinguiéndolos de los rendimientos nuevos del ahorro. No inventar retrospectivamente un desglose bruto/retención |
| Ajustes contaminan ingresos y gastos | Categorías Ajuste de saldo: $73 de entradas y $678 de salidas; algunas descripciones son `COBRO DOBLE` o `lavado` | Separar ajustes contables de ingresos operativos; revisar los movimientos con concepto concreto |
| Medio de recepción usado como categoría | Transferencias: 16 ingresos, $4,205.18; incluye `Proyecto sistemas`, `Vitto proyecto`, `papá prestamo`, gasolina y nombres personales | Identificar trabajo, reembolso, apoyo, deuda o traspaso propio; el texto `transferencia` por sí solo no determina la naturaleza |
| Deuda dentro de suscripciones | `Deuda Sonia`, $300 | Aclarar capital e intereses; no tratarlo como suscripción |
| Conceptos mezclados en una fila | `gasolina, proyecto, 500 papá`, $835.97; `Volcán y dinero perdido`, $100 | Solicitar desglose; las partes deben sumar exactamente el importe original |

En noviembre, los egresos registrados suman $1,983.40; $1,046.40 corresponden al ahorro confirmado. Al separar únicamente ese ahorro quedan $937.00 de egresos, antes de resolver otros ajustes y clasificaciones. Esto demuestra por qué deben corregirse las métricas antes de emitir recomendaciones de gasto.

## 2. Modelo financiero que debe sostener la app

Separar cuatro dimensiones: naturaleza del movimiento, cuenta donde está el dinero, categoría del concepto y etiquetas de contexto. Mantener cliente/proyecto y vínculo recurrente como campos propios.

| Operación | Efecto en ingresos/gastos de consumo | Efecto en cuentas/patrimonio |
| --- | --- | --- |
| Cobro por un proyecto | Ingreso de trabajo | Aumenta la cuenta receptora |
| Compra de comida | Gasto en alimentación | Disminuye la cuenta pagadora |
| Aportación a ahorro | No es consumo ni un nuevo ingreso | Mueve saldo entre cuentas o subcuentas propias |
| Retiro del ahorro | No es ingreso de trabajo | Mueve saldo de ahorro a otra cuenta propia |
| Interés acreditado | Ingreso financiero, separado del trabajo | Aumenta el saldo de la cuenta remunerada |
| Retención sobre intereses | Impuesto retenido, separado del consumo | Reduce el efectivo recibido; se vincula al interés bruto |
| Préstamo recibido | Financiación, separado del ingreso ganado | Aumenta efectivo y deuda; requiere confirmar la operación |
| Pago de una deuda | Separar capital e intereses | El capital reduce efectivo y deuda; los intereses son costo financiero |
| Ajuste de conciliación | No presentarlo como salario, venta o consumo ordinario | Corrige la diferencia con motivo, fecha y trazabilidad |
| Reembolso | Vincularlo al gasto original cuando exista | Evitar inflar a la vez ingresos ganados y consumo |

Incorporar cuentas reales y subcuentas de ahorro. `Tarjeta` y `efectivo` actualmente se usan como si fueran cuentas; tarjeta debe describir cómo se paga, mientras la cuenta identifica de dónde sale el dinero. Una tarjeta de crédito, si se incorpora, debe distinguir deuda de saldo bancario.

Mostrar por separado disponible para gastar, ahorro/reservas, saldo remunerado, deuda cuando corresponda y patrimonio. El dinero ahorrado permanece dentro del patrimonio, aunque se excluya del disponible para gastar. Una meta mide fondos asignados a esa meta; no debe asumir que todo el saldo disponible está ahorrado.

### Taxonomía inicial basada en el historial

Categorías principales con subcategorías: Alimentación (restaurantes/comida preparada; café; postres y botanas; bebidas; despensa cuando haya evidencia), Transporte (gasolina; estacionamiento; peajes; Uber/traslados), Educación (útiles; gastos escolares por precisar), Compras personales (ropa; accesorios de celular; higiene), Salud y deporte (gimnasio; suplementos; equipamiento), Suscripciones (almacenamiento; herramientas IA; otras), Entretenimiento (cine; videojuegos; parques), Regalos, Viajes, y Trabajo (ingresos por proyectos; costos de proyectos cuando realmente sean de negocio).

Las subcategorías se crean cuando aportan una decisión o un análisis útil. Las aclaraciones confirmadas usan nombres discretos: Entretenimiento digital y Cuidado personal. Parco/Parci son estacionamientos; PlayStation Plus fue un único mes; los proyectos indicados fueron escolares. Fijo/variable y recurrente son atributos independientes de la categoría. Los alias privados permiten sugerir categoría sin exponer significados más explícitos.

## 3. Conciliación del ahorro y Revolut

Mantener dos fondos o subcuentas remuneradas: `Dinero principal / tarjeta`, que ya generaba intereses, y `Ahorro Revolut`, que comienza con el depósito de hoy. Cada uno tiene saldo elegible, configuración de tasa, fecha de inicio y pagos propios. El registro como tarjeta es una agregación antigua; no significa que una tarjeta en sí pague intereses.

1. Conservar los cinco registros originales, sus identificadores y fechas. Su suma ya concilia exactamente con los $1,046.40 indicados por el usuario.
2. Representar el ahorro previo al 5 de noviembre como reserva/subcuenta histórica, sin atribuirle retrospectivamente una ubicación bancaria no confirmada.
3. Registrar el paso del fondo ya existente a Revolut el 5 de noviembre. El traslado y el saldo inicial describen el mismo dinero: no se suman $1,046.40 otra vez ni se crea un ingreso ficticio. Verificar el saldo de la cuenta de origen para evitar duplicación.
4. Empezar la estimación de la cuenta de ahorro desde el depósito de hoy, utilizando el saldo elegible al cierre. Mantener los seis rendimientos históricos del dinero principal y permitir seguir registrando/estimando sus intereses sobre el saldo realmente depositado, descontando compras y retiros conforme ocurran.
5. Para cada acreditación guardar fecha, cuenta, interés bruto, retención real, neto, fuente y referencia. Si el extracto muestra solo el neto, conservarlo como tal y no inventar sus componentes.
6. Diferenciar estimación devengada de dinero efectivamente acreditado. Las proyecciones no modifican el saldo confirmado. Los pagos se incorporan por captura o importación conciliable; no se presupone que existe una integración bancaria.
7. Usar identificadores de origen para impedir que una importación, una captura manual o un reintento dupliquen el mismo pago. Al reemplazar una estimación por un pago real, conciliar en vez de sumar ambos.
8. Para los apartados personales de Revolut, calcular primero la tasa a partir del saldo conjunto: sus límites de tasa son compartidos. Después calcular los intereses de cada apartado por separado. Confirmar la tasa efectiva mostrada en `Información` y su vigencia; abrir un apartado adicional no debe crear otro tramo de $25,000 en la app.

Revolut México publica capitalización y pago diario con una base de 360 días sobre el saldo final diario, así como consulta del impuesto retenido en el detalle del pago. El dinero debe estar dentro de Rendimientos Diarios para devengar: estar solamente en la cuenta principal o asociado a una tarjeta no basta. [Fuente oficial: cálculo y pago de intereses](https://help.revolut.com/es-MX/help/app-features/savings-vaults/mx-earning-interest-with-savings/).

La cláusula 3.5.7 del contrato indica truncamiento a dos decimales antes de descontar impuestos. El motor necesita precisión decimal y acumuladores de fracciones; no basta redondear cada cálculo aislado. [Fuente oficial: contrato vigente, página 22](https://cdn.revolut.com/terms_and_conditions/pdf/cuenta_revolut_ec7d400f_4.1.0_1793307397_es.pdf#page=22).

Para un día completo con $1,046.40 al 15%, el bruto devengado ilustrativo es `$1,046.40 × 0.15 / 360 = $0.436`: sin fracciones previas, el pago bruto truncado sería $0.43 y quedaría una fracción acumulada. Revolut muestra también ejemplos donde los residuos diarios de interés y retención pasan al siguiente día. [Fuente oficial: ejemplo de cálculo](https://help.revolut.com/es-MX/help/app-features/savings-vaults/interest-and-tax-calculation-example/).

La oferta del 15% aplica al primer tramo conjunto de $25,000. El excedente hasta $1,000,000 tiene tasas de 7% a 7.8%, según plan; para importes mayores, 4.5% a 5.3%. Los términos vigentes consultados son los modificados el 5 de octubre de 2026. Guardar reglas con vigencia y límites. [Fuente oficial: promoción vigente](https://cdn.revolut.com/terms_and_conditions/pdf/t_rminos_y_condiciones_de_promociones_en_rendimientos_diarios_72a96081_4.0.0_1791222089_es.pdf).

La ayuda confirma que se suman todos los apartados para determinar una tasa ponderada; crear varios no multiplica el límite preferente. El modelo agrupará los apartados del mismo producto/banco y calculará esa tasa conjunta antes de distribuir intereses por saldo. [Fuente oficial: tasa ponderada](https://help.revolut.com/es-MX/help/app-features/savings-vaults/mx-savings-weighted-rate-calculation/). Los pagos, en cambio, se acreditan individualmente por apartado, lo que permite separar principal y ahorro. [Fuente oficial: varios apartados](https://help.revolut.com/es-MX/help/app-features/savings-vaults/mx-interest-on-savings-pockets/).

El usuario confirmó plan Plus. La configuración inicial usa 15% hasta $25,000 conjuntos, 7% en el siguiente tramo hasta $1,000,000 y 4.5% por encima. No se exige la condición de compras del plan Estándar. Las tasas se pueden actualizar desde Cuentas y se sincronizan entre apartados del mismo producto. Las proyecciones suponen que las tasas configuradas se mantienen. [Fuente oficial: requisitos de tasa mejorada](https://help.revolut.com/es-MX/help/app-features/savings-vaults/question-how-do-savings-conditions-work/).

Revolut publica para clientes nacionales una retención anual del 0.90% y base diaria de 365 días, con acumulación de fracciones de centavo; para extranjeros publica otra tasa. Estos parámetros deben tener vigencia y perfil aplicable. [Fuente oficial: impuestos sobre apartados](https://help.revolut.com/es-MX/help/app-features/savings-vaults/mx-tax-on-savings-pockets/). El ejemplo numérico del banco aplica `saldo × tasa anual de retención / 365`, mientras el interés usa 360. [Fuente oficial: ejemplo de cálculo](https://help.revolut.com/es-MX/help/app-features/savings-vaults/interest-and-tax-calculation-example/).

El ejemplo aportado de $1.00 bruto menos $0.06 retenidos produce $0.94 netos para ese pago. No determina una retención universal del 6%. Con $1,046.40 y la tasa publicada del 0.90%, la retención devengada ilustrativa sería aproximadamente $0.0258 diarios; sin residuos previos se retendrían $0.02 y el neto ilustrativo sería $0.41. Esto es una simulación de un día completo bajo esos parámetros, no un pago ya acreditado. Guardar siempre los importes reales del banco y conciliar los residuos, la fecha de corte y la tasa efectiva.

Los retiros desde Rendimientos Diarios hacia la cuenta Revolut son gratuitos e inmediatos según la ayuda oficial. Se representan como movimientos internos; gastar después el dinero crea el gasto correspondiente, evitando contar el retiro y la compra como dos gastos. [Fuente oficial: retiros](https://help.revolut.com/es-MX/help/app-features/savings-vaults/mx-withdraw-from-your-savings-vault/).

## 4. Asistente útil y cómodo

### Interfaz

La causa visual aún requiere reproducción con sesión y teclado móvil. El código combina `scrollIntoView` al recibir mensajes/cambiar el estado de envío, un listado con `max-height: 60dvh`, textarea que crece hasta 128 px, encabezados externos y navegación inferior fija. Es una hipótesis sustentada en código, no una reproducción confirmada del salto mientras se escribe.

Construir un espacio de chat ajustado al alto visible, con el campo de escritura siempre visible y una sola región principal de desplazamiento para mensajes. En móvil considerar el teclado, `visualViewport` cuando haga falta, áreas seguras y orientación. Simplificar el encabezado y el selector de periodo dentro de esa vista.

El desplazamiento automático debe mover únicamente el listado y ocurrir cuando el usuario ya está al final o acaba de enviar. Leer mensajes anteriores no debe provocar saltos. Incorporar `Ir al último mensaje`, conservar borrador y posición, permitir leer mientras responde y recuperar el texto tras un fallo.

### Funciones y exactitud

Priorizar respuestas accionables: cuánto puedo gastar esta semana, qué gastos aumentaron, cuánto es consumo frente a ahorro, qué pagos vienen, cuánto produjo Revolut neto, qué movimientos necesitan revisión y qué límite es realista según el historial.

Los importes, promedios, comparaciones y proyecciones deben salir de consultas/cálculos deterministas. El asistente explica los resultados y enlaza los movimientos que los sustentan. Debe indicar periodo, fecha de actualización, cobertura completa o parcial y calidad de datos.

Problemas concretos del código actual:

- El prompt calcula número de compras, ticket promedio y top 5 usando la lista mensual limitada a 200 filas, aunque otros totales sí usan todas las filas. Corregir esos indicadores para meses grandes.
- `consultar_movimientos` devuelve hasta 50 filas y suma solo esa muestra; su descripción de herramienta promete una suma total. Añadir agregados completos y paginación, y diferenciar siempre muestra de total.
- No hay herramientas para administrar cuentas de inversión, registrar sus retenciones, gestionar la nueva taxonomía, aplicar reglas masivas ni ajustar presupuestos de forma conversacional. Incorporarlas conforme esté listo el modelo financiero.
- Si una herramienta cambia datos y después falla la llamada al modelo, se devuelve error sin comunicar las modificaciones parciales en esa respuesta. Registrar el resultado de cada acción y mostrar qué sí ocurrió antes de ofrecer reintentos.
- El flujo actual espera la respuesta completa y vuelve a cargar el contexto financiero en cada mensaje. Medir tiempos, hacer visibles consulta/acción/respuesta, reducir lecturas redundantes y ofrecer respuesta progresiva cuando sea útil.
- Las acciones deben tener identificadores para que reintentar no registre dos veces un gasto. Los cambios de varios movimientos necesitan un resumen concreto del lote, historial y opción de deshacer. Preguntar únicamente por datos ambiguos que impidan decidir.

Evaluar con un conjunto fijo de casos reales: preguntas históricas con más de 50 filas, meses con más de 200 movimientos, cambios de periodo, ahorro, rendimientos con retención, reembolsos, deudas, conceptos ambiguos y fallos después de una escritura. Medir exactitud de cifras, éxito de la tarea, duplicaciones, latencia y número de aclaraciones necesarias. Cambiar de modelo será una decisión posterior a esas mediciones.

## 5. Auditoría general y visibilidad

| Área | Estado observado | Mejora a implementar |
| --- | --- | --- |
| Categorías | Crear/eliminar; no existe flujo de renombrar, fusionar, archivar o reclasificar por lote | Gestor accesible, jerarquía, alias, conteos e impacto de cada cambio |
| Captura | Puede dejar elegida la primera categoría por defecto | Sugerencia por descripción y reglas conocidas; evitar confirmar silenciosamente una categoría sin relación |
| Historial mensual | Lista de 200; búsqueda local sobre esa lista, con advertencia de recorte | Búsqueda/paginación sobre todo el periodo y acceso al detalle desde cada métrica |
| Historial global | Búsqueda y paginación existentes; sin rango explícito de fechas en la acción | Filtros por fecha, cuenta, categoría, etiqueta, cliente, naturaleza y revisión pendiente |
| Estadísticas | Reparto por categoría y comparaciones básicas; solo se muestran 8 clientes en un desglose | Tendencias históricas, ver todos, profundizar hasta movimientos y eliminar repeticiones sin función adicional |
| Metas | Una meta comparada con todo el saldo disponible; actualmente ninguna configurada | Asignación explícita de fondos y progreso que separe aportaciones de rendimientos |
| Presupuestos | Funcionalidad existente; actualmente ninguno configurado | Propuesta a partir de consumo corregido e ingresos variables; excluir traspasos y ahorro del gasto consumido |
| Recurrentes | 4 configurados; protección por mes contra cobros duplicados | Revisar Google One/iCloud/Diri/Gym y su categoría, monto y frecuencia; distinguir programado, vencido y pagado |
| Exportación | Mes completo y traspasos en Excel ya existen | Conservarlos; añadir periodos, cuentas, naturaleza, etiquetas, rendimientos y marcas de conciliación |
| Ajustes | `ajustarSaldo` crea ingresos/egresos ordinarios | Flujo separado de conciliación con diferencia, motivo y evidencia |
| Acceso | Hay 2 usuarios; el formulario y acción de registro son públicos | Si el producto es personal, restringir altas también en servidor/proveedor. Verificar aislamiento de datos con dos cuentas y pertenencia de relaciones; no deducir una intrusión solo por existir otra cuenta |
| Experiencia general | Navegación, estados vacíos, errores y sincronización ya existen | Auditar móvil/escritorio, accesibilidad, foco en modales, guardado fallido, desconexión y descubrimiento de funciones |

La otra cuenta no se elimina como parte de esta auditoría. Su existencia se informó al usuario; cualquier administración de esa cuenta es una acción distinta de reclasificar las finanzas de la cuenta indicada.

## 6. Orden de ejecución y entregables

| Fase | Prioridad | Trabajo y resultado verificable |
| --- | --- | --- |
| 0. Base de auditoría | P0; preparada | Instantánea privada por usuario; totales mensuales; propuesta para las 290 transacciones y los 9 traspasos; cola de dudas sin inferencias presentadas como hechos. Actualizar la instantánea si hay movimientos nuevos antes de aplicar |
| 1. Modelo financiero | P0 | Cuentas/subcuentas, naturaleza independiente de categoría, categorías/subcategorías, etiquetas, conciliación y pagos financieros. Traspasos atómicos y cálculos compartidos para UI, exportación y asistente |
| 2. Reclasificación completa | P0; depende de 1 | Aplicar las reglas claras a todo el historial; resolver o conservar señalados los casos ambiguos; migrar vínculos de clientes, recurrentes y presupuestos; conciliar los $1,046.40 de ahorro |
| 3. Fondos remunerados | P0; depende de 1–2 | Dinero principal con sus rendimientos históricos y ahorro Revolut desde el 5 de noviembre; capital/interés/retención por fondo; proyecciones separadas y conciliación sin duplicados |
| 4. Comodidad del chat | P0; puede avanzar junto con 1 | Reproducir y corregir el desplazamiento, teclado móvil y entrada visible; historial estable, borrador y recuperación de errores |
| 5. Utilidad del asistente | P1; usa el modelo corregido | Consultas completas, respuestas sustentadas, herramientas financieras, reglas de clasificación, presupuestos y resultados de acciones recuperables |
| 6. App y decisiones | P1 | Mejorar navegación y reportes; configurar presupuestos/meta con datos corregidos; revisar registro, aislamiento, accesibilidad y exportación |
| 7. Validación y salida | P0 para cada entrega | Comprobar diferencias antes/después, saldos por cuenta, integridad del historial, reversión del lote y flujos con sesión en móvil/escritorio |

La corrección de interfaz puede adelantarse porque no depende de reclasificar datos. Las recomendaciones financieras y el asistente analítico deben apoyarse en el historial corregido.

### Condiciones de aceptación

- Los 299 registros originales tienen destino propuesto o motivo explícito de revisión. No se descartan filas sin descripción.
- Los cinco ahorros dejan de inflar el consumo y concilian con $1,046.40 de capital; el traslado a Revolut no agrega ese capital dos veces.
- Reclasificar conceptos conserva importes, fechas, clientes y evidencia. Cambiar la naturaleza de un movimiento muestra por separado el efecto esperado en consumo, disponible, deuda y patrimonio.
- Un traspaso entre cuentas propias tiene efecto combinado cero en el patrimonio. Los dos lados se guardan de manera atómica.
- El saldo de Revolut equivale a capital más acreditaciones netas reales menos retiros. El interés bruto menos retención coincide con el neto cuando esos tres datos están disponibles.
- Se conservan los seis rendimientos históricos del fondo principal por $19.60. Las compras disminuyen su base remunerada y un traspaso al ahorro no genera intereses simultáneamente sobre el mismo capital en ambos fondos.
- Dos apartados personales que suman más de $25,000 comparten el cálculo por tramos; la tasa conjunta se pondera antes del pago individual. Con saldo igual y residuos distintos, dos pagos diarios pueden diferir un centavo sin ser un error.
- Las diferencias con el banco quedan como conciliación pendiente; no se crean ganancias ni gastos ficticios para ocultarlas.
- Un lote de reclasificación conserva el estado anterior, identifica su regla y puede revertirse. Repetirlo no duplica ni altera otra vez lo ya migrado; una edición posterior del usuario provoca revisión, no sobreescritura silenciosa.
- Totales de dashboard, historial, exportación y asistente coinciden para el mismo usuario, periodo y filtros.
- Cifras históricas completas funcionan por encima de 50 y 200 movimientos. Ninguna muestra limitada se presenta como el universo completo.
- Escribir, abrir el teclado o recibir respuesta no desplaza el documento ni oculta el campo; se conserva la posición cuando se lee historial anterior.
- El asistente distingue acción solicitada, acción ejecutada, fallo y resultado parcial. Un reintento no duplica registros.
- Las pruebas con dos sesiones no permiten leer o relacionar datos de otro usuario. El registro de cuentas sigue la política elegida para la app.

## 7. Validación ya ejecutada y límites

Pasaron TypeScript, ESLint, la compilación de producción y las pruebas del libro, rendimientos, consultas, solicitudes del asistente y base de datos. Se incorporó una comprobación contra la API real del modelo con datos ficticios: seleccionó la herramienta de resumen canónico sin ejecutar escrituras. La auditoría de dependencias quedó en cero vulnerabilidades reportadas. El SQL listo para pegar se probó ejecutándolo dos veces; la segunda ejecución no repite la migración.

El ensayo privado verificó aplicación atómica, reintento sin duplicados, cobertura de los identificadores originales, saldos por cuenta, búsqueda completa, traslado del ahorro, copia del presupuesto al mes siguiente y reversión completa. Se probaron aislamiento por usuario, rechazo de referencias ajenas, protección del registro de auditoría, fusión y restauración de categorías/presupuestos, y conflicto frente a cambios posteriores.

El usuario ejecutó el SQL desde su celular. Se comprobó la versión del esquema por API y se aplicó el lote personal mediante una sesión temporal del propietario, con RLS y respaldo antes/después. Se verificaron los 290 identificadores originales, 292 transacciones resultantes y diez traspasos. El usuario registró después dos ingresos de $500 y una aportación de $100: se conservaron ambos ingresos y se reclasificó únicamente la aportación como traspaso al ahorro. La prueba visual de teclado móvil sigue pendiente; el control anterior de Chrome no pudo determinar con certeza la URL y se detuvo.

## 8. Resultado financiero del ensayo

| Concepto histórico | Importe MXN |
| --- | ---: |
| Todas las entradas registradas | $44,074.77 |
| Ingresos por trabajo | $40,698.99 |
| Apoyos familiares recibidos | $1,528.00 |
| Rendimientos netos reales | $19.60 |
| Total de ingresos separado de préstamos/reembolsos/ajustes | $42,246.59 |
| Reembolsos | $900.00 |
| Préstamo recibido, liquidado por compensación | $500.00 |
| Entradas por identificar | $355.18 |
| Ajustes de entrada | $73.00 |
| Disponible según registros, sin ahorro | $6,590.02 |
| Ahorro Revolut | $1,046.40 |
| Patrimonio según registros | $7,636.42 |

Después de los dos ingresos nuevos por $1,000 y su aportación del 10% ($100), los ingresos históricos ascienden a $43,246.59, el disponible registrado a $7,490.02, el ahorro a $1,146.40 y el patrimonio a $8,636.42. Los importes de la tabla conservan el corte original de la auditoría para distinguir ambos lotes.

Los $750 recibidos del proyecto escolar son aportaciones/reembolsos. El cargo duplicado de Diri conserva su salida real y una etiqueta del cupón; no se crea un reembolso en efectivo. La salida de $500 al familiar es independiente del préstamo recibido. Los $259 aproximados del proyecto y el resto de $76.97 del movimiento mixto quedan señalados para revisión.

El lote prepara límites iniciales para el mes actual a partir de los tres meses completos anteriores y los compromisos recurrentes, reservando margen respecto al ingreso por trabajo. Se copian automáticamente al nuevo mes sin sobrescribir límites existentes ni restaurar límites que el usuario quitó. La meta sugerida de ahorro es editable y no se presenta como una decisión original del usuario. El acceso público y el aislamiento entre cuentas se conservan.

Las estimaciones de interés se recalculan diariamente desde el último abono real o conciliación por cuenta, considerando los movimientos de cada día. Se muestran por separado del saldo registrado. El bruto y la retención de los seis pagos históricos siguen desconocidos; sólo se conserva su neto, sin atribuirles impuesto cero.

Véase [operación del lote y despliegue](OPERACION_RECLASIFICACION.md) para los pasos de administración pendientes.
