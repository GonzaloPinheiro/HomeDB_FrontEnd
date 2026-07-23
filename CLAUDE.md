# CLAUDE.md — HomeDB Web

Lee este documento entero antes de tocar cualquier código en este proyecto. Es la fuente de verdad de convenciones. La sección 5 (contrato del backend) es una **foto fechada**, no una verdad eterna — lee la advertencia al principio de esa sección antes de fiarte de ninguna tabla.

## 1. Qué es este proyecto

Frontend web de **HomeDB**, una API personal (ASP.NET Core 8 + PostgreSQL) que gestiona archivos/carpetas, usuarios, permisos por módulo, logs y métricas de un servidor casero (Raspberry Pi). El backend lo mantiene el usuario directamente en la carpeta hermana **`HomeDB/`** (acceso de lectura, nunca de escritura — ver §2). Este proyecto vive en **`HomeDB_FrontEnd/`** y es nuevo desde cero, reemplaza por completo a un front anterior descartado que vive en **`HomeDB_Front/`** (nótese la diferencia de nombre) — esa carpeta no se toca ni se lee, ya está auditada y volcada en este documento.

**El plan de móvil no es a largo plazo:** en cuanto la web esté razonablemente terminada, se empaqueta con Capacitor para probarla en Android. Por eso todo se diseña responsive y táctil desde el primer componente, no se deja para el final.

## 2. Cómo trabajamos (reglas fijas)

- **Verificación obligatoria.** Después de cualquier cambio, ejecuta `typecheck`, `lint` y `build`. No des una tarea por terminada si alguno falla. No hay CI todavía (el usuario lo montará más adelante como aprendizaje) — esto es la única red de seguridad, tómatelo en serio.
- **El contrato del backend no es estático — verifícalo.** Antes de implementar o modificar cualquier cosa que dependa de un endpoint, tipo o comportamiento del backend, relee el código fuente real del backend en vez de fiarte ciegamente de la §5 de este documento. **El repositorio del backend está en la carpeta hermana `HomeDB/`** (puedes leerlo, nunca modificarlo). Si hay discrepancia entre este documento y el código real, **gana el código real**. Si no encuentras esa carpeta en este entorno, pregunta al usuario la ruta antes de asumir nada.
- **Nunca toques ni leas `HomeDB_Front/`** (con espacio final "Front", sin "End") — es un front antiguo descartado por completo, ya auditado y volcado en este documento. No es referencia útil, y confundirlo con `HomeDB_FrontEnd/` (este proyecto) sería un error grave. Cualquier otra carpeta hermana que no sea `HomeDB/` tampoco tiene relación con este proyecto.
- **Un archivo, una responsabilidad — como guía, no como regla numérica.** No hay un límite de líneas que dispare trocear un archivo automáticamente. Separa un archivo cuando mezcla cosas conceptualmente distintas (ej. lógica de árbol de carpetas + tabla + 5 modales en un mismo componente). Como referencia orientativa, a partir de ~400-500 líneas vale la pena pararse a revisar si hay algo que separar, pero es una señal para pensar, no una acción automática.
- **Revisa `shared/` antes de crear algo nuevo.** Si necesitas una tabla, un modal, un estado vacío, un skeleton, un hook de fetching — probablemente ya existe una pieza genérica en `shared/`. No la reimplementes dentro de una feature.
- **Explica en el código, no solo aquí.** Cuando una pieza de código representa una decisión no evidente de este documento (una regla de negocio como "las carpetas siempre van primero", una limitación temporal, un porqué que no se ve a simple vista), añade un comentario breve en el propio código que lo explique y referencie la sección correspondiente, ej. `// CLAUDE.md §6.3: carpetas siempre primero, el orden activo solo afecta a los archivos`. Así la razón viaja con el código y no hace falta releer todo este documento cada sesión. Para algo pendiente de backend o un placeholder deliberado, usa el prefijo `// PENDIENTE (CLAUDE.md §X):` explicando qué falta y cuándo retomarlo (ver ejemplo real en §7.5 y §5.4).
- **No hay generación automática de tipos desde el backend.** Los tipos y schemas de Zod se escriben a mano en cada feature, a partir del contrato de §5. Es intencional: evita acoplar el build del front a que el backend esté arriba y accesible. Zod es la red de seguridad ante cambios del backend, no un generador.
- **Nunca commitear secretos.** `.env` en `.gitignore`, `.env.example` versionado con las claves vacías/de ejemplo.
- **No hay tests end-to-end ni de UI por ahora.** Solo tests unitarios de lo que no es visual (ver §9).
- **Commits en `HomeDB_FrontEnd/`**: al final de cada fase, haz commit de tus propios cambios con un mensaje descriptivo, salvo que el prompt de esa fase diga explícitamente lo contrario. Esta regla es solo para este repositorio — en `HomeDB/` (el backend) los commits los hace siempre el usuario manualmente, nunca Claude Code, salvo que un prompt puntual lo autorice de forma explícita.

## 3. Stack

- **React 19 + TypeScript + Vite**
- **React Router** (rutas anidadas, lazy loading de páginas con `React.lazy`)
- **TanStack Query** para todo el estado de servidor (fetch, caché, loading, error, reintentos). El único estado global "manual" es la sesión de auth (ver §7.2) — no hay Redux/Zustand.
- **Axios** como cliente HTTP, `withCredentials: true` siempre — la auth va por cookies, nunca por header manual (ver §5.2)
- **Zod** para validar respuestas de API y formularios
- **react-hook-form** + Zod para formularios
- **Tailwind CSS + shadcn/ui** (componentes copiados al repo, no una librería opaca) + **tailwindcss-animate** (transiciones de apertura/cierre de los componentes Radix que trae shadcn — dropdown, etc.) + **Framer Motion** para el resto de animaciones
- **dnd-kit** para drag & drop — basado en eventos de puntero, no en la API nativa de HTML5 Drag and Drop, porque esta última no funciona en pantallas táctiles y el proyecto se empaqueta en Capacitor pronto
- **recharts** para los gráficos del Monitor del sistema (§6.13) — no gráficos SVG hechos a mano
- **sonner** para toasts, restyled con los tokens de color propios (no sus estilos por defecto)
- **lucide-react** para iconos
- **Vitest** para tests unitarios
- **pnpm** como gestor de paquetes
- Sin monorepo por ahora (ver §10 sobre Capacitor/mobile)

No añadas ninguna otra librería de estado, fetching, fechas o UI sin que esté justificado.

## 4. Estructura de carpetas

```
src/
├── app/
│   ├── App.tsx                 # providers (QueryClient, AuthProvider, Router) + layout raíz
│   ├── router.tsx               # definición de rutas, lazy loading
│   └── layout/                  # AppShell, TopHeader, Sidebar (navegación por módulos)
├── features/
│   ├── auth/                    # solo login + restauración de sesión (NO registro, ver §5.2)
│   ├── files/                   # explorador de archivos + carpetas (lista unificada, ver §6.3)
│   ├── account/                 # /me: perfil, cambiar contraseña, ajustes, ver mis permisos
│   ├── admin-users/              # listar/ver/crear/borrar usuarios, editar límites de storage
│   ├── admin-permissions/        # editar permisos por módulo de un usuario (reglas de auth distintas
│   │                             # de admin-users, ver §5.3 — por eso va separada)
│   ├── admin-roles/              # listar roles, editar descripción — EN PAUSA de diseño (§6.6b), no
│   │                             # construir todavía ni añadir su entrada al sidebar (§6.2)
│   ├── admin-audit-logs/         # tabla de auditoría, detalle inline
│   ├── admin-system-logs/        # logs de sistema, salud, resumen de errores, operaciones lentas
│   └── system-monitor/           # dashboard de métricas (CPU/mem/disco/temp/ventilador)
├── shared/
│   ├── api/
│   │   ├── client.ts             # instancia axios, interceptores, manejo del envelope ApiObjResponse<T>
│   │   └── errors.ts              # mapa completo de ApiErrorCodes -> mensaje (ver §5.1)
│   ├── components/                # Button, Input, Table, Pagination, Modal, EmptyState, Skeleton,
│   │                               # PageHeader... (shadcn + a medida)
│   ├── hooks/                     # useAuth, usePermissions, useUploadFile, useDebounce, etc.
│   ├── lib/                       # formatBytes, formatDate, cn(), etc.
│   ├── types/                     # ApiObjResponse<T>, AppModule, tipos cross-feature
│   └── env.ts                     # validación de variables de entorno con Zod al arrancar
└── styles/
    └── globals.css                # tokens de Tailwind, claro y oscuro (ver §6.1)
```

Cada feature es autocontenida: sus propios `components/`, `api.ts` (queries + mutations de TanStack Query), `schemas.ts` (Zod), `types.ts`. Si dos features necesitan compartir algo, ese algo se sube a `shared/`, no se copia.

## 5. Contrato del backend (foto de julio 2026 — verificar antes de usar)

> Todo lo que sigue viene de una auditoría por lectura directa del código del backend en julio 2026. El backend sigue vivo y cambiando. **No trates esta sección como definitiva** — antes de construir o tocar algo que dependa de ella, relee el código fuente real (ver regla en §2). Si algo no cuadra con lo que devuelve la API real, confía en la API real y avisa al usuario del desajuste.

### 5.1 Formato de respuesta y errores

Todas las respuestas van envueltas así, **excepto** descarga de archivo (binario), `/healthCheck` y `/health`:

```ts
type ApiObjResponse<T> = {
  result: boolean
  data: T | null
  errorCode: number | null
  errorMessage: string | null
}
```

`errorCode` llega siempre como número. Tabla completa — mantenla en `shared/api/errors.ts` como único punto de verdad, no la reimplementes por feature:

**Casing real en el wire: camelCase.** Aunque las tablas de este documento nombran los campos en PascalCase (como están en el C# del backend), ASP.NET Core los serializa en camelCase por defecto (no hay `AddJsonOptions` que lo cambie) — confirmado en julio 2026 contra el envelope, `TokenResponseDto` y los 9 flags de permisos. Los schemas de Zod usan siempre camelCase (`accessToken`, no `AccessToken`).

| Código | Valor | HTTP | Significado |
|---|---|---|---|
| FileNotFound | 1001 | 404 | Archivo no existe o no es tuyo |
| FolderNotFound | 1002 | 404 | Carpeta no existe o no es tuya |
| Unauthorized | 1003 | 403 | Sin acceso al recurso o al módulo |
| FileTooLarge | 1004 | 413 | Supera el tamaño máximo permitido |
| FolderNotEmpty | 1005 | 400 | No se puede borrar, tiene contenido |
| InvalidCredentials | 1006 | 401 | Login inválido o refresh token inválido |
| UserAlreadyExists | 1007 | 409 | Username en uso |
| UserNotFound | 1008 | 404 | — |
| RateLimitExceeded | 1009 | 429 | Demasiadas peticiones |
| MetricNotFound | 1010 | 404 | — |
| EmailAlreadyExists | 1011 | 409 | Email en uso |
| RoleNotFound | 1012 | 404 | — |
| FolderCyclicReference | 1013 | 400 | Mover carpeta dentro de sí misma o un descendiente |
| PermissionsNotFound | 1014 | 404 | — |
| UserSettingsNotFound | 1015 | 404 | Se reutiliza para UserSettings y UserAdminSettings |
| StorageLimitExceeded | 1016 | 413 | Cuota de almacenamiento superada |
| UserHasAssociatedData | 1017 | 409 | No se puede borrar usuario con archivos/carpetas |
| InternalError | 9999 | 500/400 | Error no controlado |

Patrón: cada mutation/query captura el error, lo pasa por `getErrorMessage(errorCode)` de `shared/api/errors.ts`, y se muestra con un toast de sonner (ver §6.8). Los toasts de error usan siempre este mensaje mapeado cuando el código es conocido, nunca un genérico si hay uno específico disponible.

### 5.2 Autenticación y sesión — el front web usa cookies, no headers manuales

- Login (`POST /api/auth/login`, público) y refresh (`POST /api/auth/refreshToken`, público) devuelven `TokenResponseDto { AccessToken, AccessTokenExpiresAt, RefreshToken, RefreshTokenExpiresAt }` **y además** ponen cookies HttpOnly (`AccessToken` con `Path=/`, `RefreshToken` con `Path=/api/auth`).
- **El front web solo usa la cookie para autenticar.** Todas las requests van con `withCredentials: true`; el navegador envía las cookies solo. **Nunca se añade manualmente el header `Authorization`.**
- El `AccessToken` del body **se decodifica solo para leer claims** (`userId`, `username`, rol) y pintar la UI (ej. mostrar el menú de Admin) — nunca se usa para autenticar peticiones, ni se persiste en `localStorage`, solo vive en memoria (contexto de React).
- El `RefreshToken` del body **se ignora para almacenamiento** — la cookie httpOnly es la única fuente de verdad, el front nunca la lee ni la guarda.
- El backend también acepta el header `Authorization: Bearer` (para Postman o una futura app nativa fuera de este proyecto) — **el front web no usa esa vía, ni tampoco la versión empaquetada con Capacitor**, que es la misma web corriendo en un WebView y por tanto también funciona con cookies sin cambios.
- Interceptor de axios: en un 401 que no venga de login/refresh, intenta refrescar una vez (la cookie viaja sola), reintenta la request original; si el refresh falla, limpia el estado local de React y navega a `/login` **usando el router, no `window.location.href`**.
- Access token expira en **30 minutos**. Refresh token en **7 días**, con rotación.
- `PUT /api/auth/changePassword` revoca todos los refresh tokens del usuario. Tras un cambio de contraseña con éxito, forzar logout y redirigir a login con un mensaje explicativo.
- `POST /api/auth/logout` responde 200 aunque el token ya estuviera revocado o no existiera — no lo trates como error, simplemente limpia el estado local y navega a login.
- **🐛 Bug confirmado (julio 2026, verificado por código y por prueba real login→refresh): `POST /api/auth/refreshToken` falla siempre con `InvalidCredentials` (1006).** En `AuthService.cs`, el login guarda `Hash(token)` en BD pero también envía ese mismo hash al cliente en vez del token en claro; al refrescar, el backend vuelve a hashear lo recibido (`Hash(Hash(token))`), que nunca coincide con lo guardado. Efecto: ninguna sesión sobrevive a un refresco de página hasta que se arregle en `HomeDB` (fuera del alcance del front — no se puede arreglar desde aquí). El front ya implementa el contrato correcto (§7.2) y funcionará sin cambios en cuanto el backend devuelva el token en claro al cliente. Mientras tanto, el fallo se maneja con gracia (sin toast, simplemente no autenticado) — es el comportamiento esperado, no un bug del front.
- **No hay registro público.** `POST /api/auth/register` exige rol Admin. La creación de usuarios vive en `admin-users` (botón "Nuevo usuario"), no en la pantalla de login. `features/auth` solo tiene login.

### 5.3 Roles y permisos por módulo

Dos roles: `Admin` y `User`. Todo usuario nuevo se crea como `User`. **No existe ningún endpoint para cambiar el rol de alguien** — se hace directo en BD por el usuario (dueño del sistema), el front no debe ofrecer esa acción en ningún sitio.

Nueve módulos, todos empiezan en `false` para un usuario nuevo (incluido Files):

```ts
type AppModule =
  | 'Files' | 'Expenses' | 'Investments' | 'SystemMonitor'
  | 'UserManagement' | 'RoleManagement' | 'SystemLogs'
  | 'AuditLogs' | 'RemoteScripts'
```

Si el rol es `Admin`, pasa siempre sin mirar flags (superusuario). Si no, se exige el flag del módulo concreto.

**Regla de oro: módulo activado no implica rol Admin.** Un `User` con `UserManagementEnabled` puede listar/ver cualquier usuario y editar sus límites de storage, pero **no** puede ver ni editar permisos de otros usuarios ni borrarlos — esas acciones exigen módulo **y** rol Admin explícitamente. Comprueba ambas cosas por separado en cada acción con dos guards independientes: `<RequireModule module="X">` y `<RequireAdmin>`.

**Módulos fantasma:** `Expenses`, `Investments` y `RemoteScripts` son solo flags — no hay controller, servicio ni pantalla detrás todavía. Se muestran sus toggles en `admin-permissions`, pero **no** aparecen como enlaces de navegación en el sidebar hasta que exista funcionalidad real.

Estado vacío importante: un usuario recién creado no tiene ningún módulo activo. La navegación debe reflejar solo lo que tiene activado; si no tiene nada, mostrar el estado vacío informativo correspondiente (ver §6.9), sin botón de acción porque no hay nada que el propio usuario pueda hacer al respecto. **Confirmado en julio 2026**: `POST /auth/register` crea las tres filas (`UserSettings`, `UserAdminSettings`, `UserModulePermissions`) para todo usuario nuevo — los 404 de permisos/límites sin fila (§7.3, §5.4) solo afectan a usuarios insertados a mano directamente en BD, no a los creados por la vía normal.

### 5.4 Endpoints por dominio

Base: todas bajo `/api`, autenticadas salvo que se diga lo contrario.

**Auth**
- `POST /auth/login` — público — `{ Username, Password }` → `TokenResponseDto`
- `POST /auth/refreshToken` — público (cookie) → `TokenResponseDto`
- `POST /auth/logout` — auth (cookie) → `null`
- `PUT /auth/changePassword` — auth — `{ OldPassword, NewPassword }` → `null`
- `POST /auth/register` — **rol Admin** — `{ Username, Password }` → `UserDto` (201). Sin email en el registro.

**Files** (módulo `Files`)
- `GET /files?folderId=` → `GetFileItemDto[]` — `folderId` omitido = raíz
- `POST /files` — `multipart/form-data: file, folderId?` → `UploadFileResponseDto` (201)
- `GET /files/{id}` → binario directo (`PhysicalFile`), no envuelto
- `DELETE /files/{id}` → `DeleteFileResponseDto`
- `PATCH /files/{id}` — **✅ existe (confirmado julio 2026), pero con un bug crítico activo, ver aviso abajo** — `{ NewFolderId?: int | null, NewFileName?: string }` (nombres reales, distintos de lo que se asumía originalmente; `NewFolderId: null` = mover a raíz) → `GetFileItemDto`. Errores esperables: `FileNotFound` (1001), `FolderNotFound` (1002) — ambos confirmados en prueba real. `FILE_MOVE_ENABLED = true` desde julio 2026.
  - **⚠️ Trampa real del contrato**: `NewFolderId` se asigna siempre a la entidad sin comprobar si vino en el body — **omitirlo en una llamada de solo-renombrar movería el archivo a la raíz sin querer**. El front SIEMPRE envía el `NewFolderId` actual del archivo junto con `NewFileName` al renombrar (nunca solo el nombre) — no simplificar esto en el futuro sin recordar esta trampa.
- **Búsqueda — `GET /files/search` ya existe (julio 2026), sin integrar todavía.** Verifica su forma real (parámetros, si acota por carpeta o recorre todo el árbol, paginación) contra el código antes de sustituir el filtro local actual (§6.3) — no lo diseñes de memoria, ya no es un endpoint hipotético. Márcalo en el código (`// PENDIENTE (CLAUDE.md §5.4): sustituir el filtro local por GET /files/search, verificar su forma real primero`).

**Folders** (módulo `Files`)
- `POST /folders` — `{ Name, ParentFolderId? }` → `CreateFolderResponseDto` (201)
- `GET /folders/{folderId}` — **✅ existe (confirmado julio 2026)** — una única carpeta suelta (`id, name, parentFolderId, ownerId, createdAt`) → `GetFolderResponseDto`, 404 `FolderNotFound` si no existe. Resuelve la reconstrucción del breadcrumb en refrescos/enlaces profundos (§6.3, §5.5) — ya no es una limitación conocida.
- `GET /folders/subfolders` (raíz) y `GET /folders/{folderId}/subfolders` (hijos de una carpeta) — **⚠️ cambio de ruta confirmado julio 2026**: sustituye al antiguo `GET /folders?folderId=` (query param) — ahora va por segmento de ruta. Devuelve `GetFolderResponseDto[]`.
- `PATCH /folders/{folderId}` — `{ NewFolderName?, NewParentFolderId? }` → `GetFolderResponseDto`. **`NewParentFolderId = 0` es el centinela de "mover a raíz"**, no un id real.
- `DELETE /folders/{folderId}` → `DeleteFolderResponseDto` (falla con `FolderNotEmpty` si tiene contenido)

**Statistics** (módulo `Files`)
- `GET /statistics/storage` → `{ totalFiles, totalFolders, totalSizeBytes, totalSizeMb }`

**System Metrics** (módulo `SystemMonitor`) — **verificado por lectura directa del backend en la Fase 6 (julio 2026):**
- `GET /system-metrics/last-metric` → `SystemMetricsResponseDto`. **Si no hay ninguna muestra todavía en BD (instalación recién hecha), no devuelve `data: null` — responde 404 con `errorCode: MetricNotFound` (1010)**, lanzado por `SystemMetricsService.GetLastMetricAsync`. El front debe tratar ese 1010 concreto como "sin datos todavía" (estado vacío, §6.9), no como un error genérico. En la práctica esta ventana es corta porque el background service captura una muestra al arrancar el backend, pero puede darse en una instalación nueva o justo tras un reinicio.
- `GET /system-metrics/history?from=&to=` → `SystemMetricsResponseDto[]`. El backend **sigue sin limitar el rango** (confirmado — hay un `//TODO` literal en `SystemMetricsController.cs` reconociéndolo pendiente) — limita tú desde el front vía los chips de rango (§6.13, máximo 30 días de una vez, que coincide con `RetentionDays`). Con 0 filas en el rango devuelve 200 con `data: []`, nunca error.
- `SystemMetricsResponseDto`: `Timestamp` (`DateTimeOffset`, el único campo **no nullable**), y doce campos más, **todos nullable**: `CpuUsagePercent, MemoryTotalBytes, MemoryUsedBytes, MemoryUsagePercent, DiskTotalBytes, DiskUsedBytes, DiskUsagePercent, TemperatureCelsius, FanIsRunning, FanRpmSpeed, FanPwmDutyCycle, FanControlMode`. Memoria y disco llegan con **las dos representaciones a la vez** (bytes en crudo + porcentaje ya calculado), independientemente nullable cada una — no hay que calcular el porcentaje a mano a partir de los bytes.
- **`FanControlMode` es un `string?` normal, no un enum tipado en el backend** — no hay ninguna constante compartida entre el lector real y el falso que fuerce casing consistente, por eso divergen. Valores reales verificados por lectura del código de cada lector:
  - **Linux real** (`LinuxSystemMetricsReader`, activo solo en `RuntimeInformation.IsOSPlatform(OSPlatform.Linux)`): `"off"`, `"manual"`, `"automatic"` (no `"auto"`), o `"unknown"` como fallback si el valor de `pwmEnable` no es ninguno de los tres esperados.
  - **Falso/mock** (`FakeSystemMetricsReader`, activo en Windows — **el que corre en este entorno de desarrollo**, confirmado en vivo: `fanControlMode` devuelto es `"Manual"`): solo `"Auto"` o `"Manual"` (PascalCase, 50/50 aleatorio en cada muestra) — nunca produce `"off"` ni `"unknown"`, así que esos dos estados no se pueden probar visualmente en este entorno hasta correr contra el Raspberry Pi real. El front normaliza siempre a minúsculas antes de comparar (`fanControlMode.toLowerCase()`), tolerante a cualquiera de los dos casings.
  - **Decisión del front (Fase 6, no impuesta por el backend): además de pasar a minúsculas, se hace alias `"auto"` → `"automatic"`** antes de comparar (`normalizeFanControlMode`, `features/system-monitor/fanControlMode.ts`) — unifica el valor corto que produce el lector falso con la palabra completa que produce el lector real de Linux. Sin este alias, la mitad de las muestras del entorno de desarrollo (lector falso, 50/50 aleatorio) se mostrarían como modo desconocido sin motivo real. Los estados `"off"` y `"unknown"` (ambos exclusivos del lector real de Linux) siguen sin poder probarse visualmente en este entorno hasta correr contra el Raspberry Pi real — confirmarlo la primera vez que el front corra contra el hardware real.
- **`SystemMetrics:SampleIntervalMinutes` de producción (`appsettings.json` base, sin sufijo de entorno) sigue siendo `1` minuto — confirmado, sin cambios respecto a lo que ya asumía este documento.** El `refetchInterval` del front (`useLastMetric`/`useMetricsHistory`, §7.9) apunta a este valor de producción (`60_000` ms), porque es el entorno real donde corre el Raspberry Pi — el front se construye para ese despliegue, no para el desarrollo local. **Dato aparte, solo informativo para quien pruebe en local**: `appsettings.Development.json` sobreescribe esto a `5` minutos en este repo (confirmado en vivo: dos muestras consecutivas de `/history` con timestamps `16:43:58` y `16:48:58`, 5 minutos exactos de diferencia) — con el front apuntando a un backend local en modo Development, el auto-refresco de 60s seguirá disparándose cada minuto pero a veces no traerá dato nuevo (el backend solo muestrea cada 5 min ahí), lo cual es inofensivo, no un bug.

**Admin — System Logs** (módulo `SystemLogs`) — **verificado por lectura directa del backend en la Fase 5 (julio 2026), con hallazgos nuevos respecto a lo que asumía esta sección antes de esa auditoría:**
- `GET /admin/logs` — query `{ Level?, Operation?, From?, To?, CorrelationId?, Page, PageSize }` → `GetLogsResponseDto { Items: LogEntryDto[], TotalCount, Page, PageSize, TotalPages }`. El array se llama literalmente `Items` (wire `items`).
  - `LogEntryDto`: `Id, TimeStamp, Level, Source, Operation, Message, Exception, UserId, CorrelationId, DurationMs`. **`TimeStamp` (S mayúscula) → wire `timeStamp`**, no `timestamp`. `UserId` es **string** aquí (claim, puede venir vacío), a diferencia de `AuditLogEntry.UserId` que es `int` (ver más abajo) — no confundir los dos tipos entre features.
  - **`Level` real: solo `"Information"`, `"Warning"`, `"Critical"`** — verificado leyendo los puntos de escritura reales (`OperationLogScope.cs` y `ExceptionHandlerMiddleware.cs`). El comentario del propio `LogEntry.cs` en el backend dice "Info, Warning, Error, Critical", pero **ningún código escribe realmente `"Info"` ni `"Error"`** — es un comentario desactualizado, no una fuente fiable. El front usa la lista real como opciones del select de filtro (`LOG_LEVELS` en `features/admin-system-logs/types.ts`) y trata cualquier otro valor como "neutro" en el badge por tolerancia futura.
- `GET /admin/logs/health` → `{ ErrorsLastHour, ErrorsLast24h, WarningsLast24h }`. **⚠️ Bug confirmado en el backend real**: `ErrorsLastHour` y `ErrorsLast24h` cuentan entradas con `Level == "Error"` (`LogsService.GetHealthAsync`, `LogEntryRepository.GetHealthAsync`), un valor que ningún código escribe (ver punto anterior) — **estos dos contadores siempre devuelven 0**, con independencia de cuántos errores reales haya. Solo `WarningsLast24h` es significativo. El front no "arregla" esto por su cuenta (fuera de su alcance, igual que el bug de refresh token de §5.2) — se muestra tal cual devuelve la API.
- `GET /admin/logs/error-summary?hours=24` → `{ Operation, Count }[]`. Filtra por `Level == "Critical"` en el backend (no por "Error") — el nombre del endpoint es engañoso respecto a lo que realmente agrupa, pero el dato en sí es correcto (excepciones no controladas). **No integrado en el front todavía** (Fase 5 lo dejó fuera deliberadamente, ver informe de esa fase) — sin sitio claro en el diseño actual de la pantalla sin recargarla.
- `GET /admin/logs/slow-operations?thresholdMs=2000` → `{ Operation, DurationMs, TimeStamp }[]`. **`TimeStamp`, no `Timestamp`** (mismo matiz que arriba) → wire `timeStamp`. **No integrado en el front todavía**, mismo motivo que error-summary.

**Admin — Audit Logs** (módulo `AuditLogs`) — **verificado por lectura directa del backend en la Fase 5 (julio 2026):**
- `GET /admin/audit-logs` — query `{ UserId?, userName?, Action?, ResourceType?, From?, To?, Page, PageSize }` (la propiedad `userName` es real en minúscula en el C#, no un typo de este documento) → `GetAuditLogsResponseDto { Items: AuditLogEntry[], TotalCount, Page, PageSize, TotalPages }`. `Items` devuelve la entidad `AuditLogEntry` directamente, no un DTO propio — campos reales: `Id, TimeStamp (DateTime, wire "timeStamp"), UserId (int), Username, IpAddress, Action, ResourceType, ResourceId, ResourceName`.
- **`Action` es un conjunto cerrado real** — clase `AuditLogActions` (`HomeDB.Domain/Common/AuditLogActions.cs`), 13 constantes: `LOGIN, REGISTER, LOGOUT, CHANGE_PASSWORD, UPLOAD_FILE, DOWNLOAD_FILE, DELETE_FILE, CREATE_FOLDER, CHANGE_FOLDER_NAME, CHANGE_PARENT_FOLDER, DELETE_FOLDER, DELETE_USER, UPDATE_PROFILE`. Usado como opciones fijas del select de filtro (`AUDIT_ACTIONS` en `features/admin-audit-logs/types.ts`).
- **`ResourceType` NO es un enum ni una lista cerrada** — es un `string?` libre en el backend, filtrado con `.Contains()` (substring, no comparación exacta) en `AuditLogEntryRepository`. En la práctica, cada punto de escritura lo rellena con `nameof(FileItem)`, `nameof(FolderItem)`, `nameof(User)`, o `null` (p. ej. `ChangePassword`) — son los únicos 3 valores no nulos que produce el código hoy. El front los ofrece como opciones de un select por conveniencia (`AUDIT_RESOURCE_TYPES`), pero es una inferencia de los call sites reales, no una garantía de contrato — si el backend añade un tipo de recurso nuevo, esta lista queda desactualizada hasta revisarla a mano.

**🐛 Bug confirmado (Fase 5, julio 2026, verificado por código y por prueba real): `From`/`To` en `GET /admin/logs` y `GET /admin/audit-logs` fallan con 500 (`InternalError`, 9999) si se envían como fecha "pelada"** (`"2026-07-01"`, el valor literal de un `<input type="date">`, sin hora ni offset). ASP.NET interpreta esa fecha pelada como `DateTimeOffset` usando el offset **local del servidor** (`+02:00`), y tanto `LogEntryRepository.GetLogsAsync` como `AuditLogEntryRepository.GetAuditLogsAsync` pasan ese `DateTimeOffset` directamente a la comparación EF/Npgsql **sin normalizar a UTC** — Npgsql rechaza escribir un `DateTimeOffset` con offset no-UTC contra una columna `timestamptz`, y responde `"Cannot write DateTimeOffset with Offset=02:00:00 to PostgreSQL type 'timestamp with time zone', only offset 0 (UTC) is supported."`. **`GET /admin/users?from=` (Fase 4a) NO tiene este problema** pese a que `GetUsersRequestDto.From` es del mismo tipo `DateTimeOffset?` — `UserRepository` filtra con `.CreatedAt >= from.Value.UtcDateTime` (normaliza a UTC antes de comparar), mientras que los otros dos repositorios no llaman a `.UtcDateTime` en ningún punto — parece un descuido, no una decisión deliberada, ya que no hay ningún comentario que lo explique. A diferencia del bug de refresh token (§5.2) o el de persistencia de mover archivo (§7.5), aquí el front SÍ puede evitar el fallo por su cuenta sin esperar un fix del backend: `features/admin-system-logs/api.ts` y `features/admin-audit-logs/api.ts` anclan `From`/`To` explícitamente a UTC (`shared/lib/dateRangeQuery.ts`: `T00:00:00Z`/`T23:59:59Z`) antes de enviarlos, en vez de reenviar la fecha pelada del input tal cual. `admin-users/api.ts` (Fase 4a) sigue enviando la fecha pelada sin cambios — no hace falta tocarla porque no dispara el bug, pero si el backend llega a arreglarse (normalizando `DateTimeOffset` a UTC de forma consistente en las tres rutas, o cambiando estos DTOs a `DateTime`), valdría la pena revisar si conviene unificar el criterio entre las tres features.

**Admin — Roles** (módulo `RoleManagement`)
- `GET /admin/roles` → `RoleResponseDto[]`
- `GET /admin/roles/{roleId}` → `RoleResponseDto`
- `PATCH /admin/roles/{roleId}/description?newDescription=` → `RoleResponseDto`. Solo edita la descripción — no hay asignación de roles aquí.

**Admin — Users** (módulo `UserManagement`, salvo donde se indica)
- `GET /admin/users` — query `{ userId?, UserName?, Email?, From?, To?, roleId?, RoleName?, Page, PageSize }` → paginado
- `GET /admin/users/{userId}` → `UserSummaryDto | null`
- `DELETE /admin/users/{userId}` — **rol Admin + módulo** → `DeleteUserResponseDto`. Falla con `UserHasAssociatedData` (409) si tiene archivos **o** carpetas — no hay borrado en cascada. **Regla adicional confirmada en julio 2026**: un Admin no puede eliminar a otro Admin (solo a sí mismo o a un `User`) — lanza `Unauthorized` (1003). El front no necesita lógica especial para esto, el toast mapeado genérico ya lo cubre, pero merece quedar documentado para no sorprenderse al verlo.
- `GET /users/me` — **✅ existe (confirmado julio 2026)** — cualquier usuario autenticado → `UserSummaryDto` (mismo DTO que `GET /admin/users/{id}`: `id, username, email, createdAt, roles`). El formulario de perfil ya puede precargarse con el valor real en vez de tratar un campo vacío como "no cambiar".
- `PATCH /users/me` — cualquier usuario autenticado — `{ Username?, Email? }` → `UpdateProfileResponseDto`. **Matiz confirmado en julio 2026**: la comprobación de unicidad de `Username`/`Email` no excluye al propio usuario — reenviar tu username actual sin cambios da `UserAlreadyExists` (1007). El front sigue enviando solo los campos realmente modificados (comparando ahora contra `GET /users/me`, no contra el claim del JWT), así que no se llega a disparar en uso normal.

**Admin — Permisos por módulo** (módulo `UserManagement` **+ rol Admin** para ver/editar los de otros)
- `GET /users/me/permissions` — cualquier usuario → `UserModulePermissionsResponseDto` (9 flags)
- `GET /admin/users/{id}/permissions` — Admin + módulo → ídem
- `PATCH /admin/users/{id}/permissions` — Admin + módulo — 9 flags opcionales → ídem

**Admin — Ajustes y límites de usuario** (módulo `UserManagement`, **sin exigir rol Admin**)
- `GET/PATCH /users/me/settings` — cualquier usuario — `{ Language?, Timezone? }` → defaults `"es"`, `"UTC"`
- `GET /users/me/settings-overview` — cualquier usuario → `{ Settings, Limits }`
- `GET/PATCH /admin/users/{id}/settings` — solo módulo → `{ StorageLimitBytes?, MaxFileSizeBytes? }`. Un override por usuario **solo puede bajar** el límite global, nunca subirlo — si el usuario pide subirlo en la UI, avisa de que no tendrá efecto real. **Corregido en julio 2026 (Fase 4b)**: si el usuario objetivo no tiene fila de `UserAdminSettings`, esto da **404 (`UserSettingsNotFound`, 1015)**, no valores `null` de relleno — el caso `null` de §5.5 es una fila que **sí existe** pero con columnas sin override, no una fila ausente; no hay upsert, así que el `PATCH` también falla con 1015 si la fila no existe. Además, `UpdateAdminSettingsAsync` **sobreescribe siempre ambos campos** a la vez (no respeta `.HasValue` por separado) — el front debe enviar siempre los dos valores juntos, nunca uno solo. Tampoco existe ningún endpoint que exponga el límite global cuando un Admin edita a **otro** usuario (solo `/users/me/settings-overview` resuelve el propio) — el aviso de "no tendrá efecto real" es texto estático, no una comparación numérica en vivo.

**Health** (público, sin envolver)
- `GET /healthCheck` → `{ status: "ok" }`
- `GET /health` → middleware nativo (Postgres + disco)

### 5.5 Particularidades a recordar

- No hay endpoint de creación de usuario fuera de `/auth/register` (Admin-only) — no inventes uno.
- No hay jerarquía de roles más allá de Admin/User — no construyas UI para "roles personalizados".
- CORS del backend hoy solo permite `http://localhost:5173`. Cuando el proyecto nuevo tenga su propio puerto/dominio, pide al usuario que añada ese origen en `Cors:AllowedOrigins` del backend — el front no puede arreglar esto por su cuenta.
- Fechas mezcladas entre `DateTime` (UTC) y `DateTimeOffset`, pero ambas serializan con sufijo `Z`. Trátalas siempre como string ISO con un único helper (`shared/lib/formatDate.ts`).
- La subida de archivos hoy es un único `POST` multipart. El usuario planea migrar a un sistema de subida por paquetes más adelante — por eso la subida vive detrás de `useUploadFile` (ver §6.5), para que ese cambio no obligue a tocar componentes de UI.
- **`GET /users/me/settings-overview` devuelve el límite de storage sin resolver — matizado en julio 2026.** `Limits.StorageLimitBytes` puede llegar `null` si el usuario no tiene un override propio. **Verificado en la Fase 2a**: un usuario creado correctamente vía `/auth/register` sí obtuvo valores resueltos (10 GB / 500 MB) — el caso `null` parece darse solo con usuarios mal aprovisionados (insertados a mano en BD sin las filas de settings que crea el flujo normal de registro), no como comportamiento general del endpoint. Aun así, **el front sigue sin asumir nunca un valor global hardcodeado** si llega `null` — mostrar solo el uso, sin comparar contra un límite (ver §6.12). Barato de mantener como red de seguridad aunque el caso sea raro.

## 6. Diseño visual

### 6.1 Paleta y tokens

Definir como CSS variables en `styles/globals.css`, consumidas por Tailwind — nunca valores sueltos hardcodeados en componentes. Dos temas, cambio por clase (`darkMode: 'class'` en Tailwind), aplicados sobre `<html>`. Se detecta `prefers-color-scheme` por defecto, con override manual guardado solo en el dispositivo (`localStorage`) — no existe campo de preferencia de tema en el backend todavía (podría añadirse como `ThemePreference` en `UserSettings` si algún día se quiere sincronizar entre dispositivos, pero no es necesario para empezar).

Cada tabla cubre **todos** los tokens usados en el resto del documento para ambos temas — si en algún componente hace falta un token que no está aquí, añádelo a esta tabla primero (con su valor en claro y en oscuro) en vez de inventarlo solo en el CSS.

**Claro:**
| Token | Valor | Uso |
|---|---|---|
| `--bg` | `#FAF9F5` | Fondo de página |
| `--surface` | `#F3EFE4` | Sidebar, inputs, cabeceras de tabla |
| `--surface-alt` | `#EDE9DC` | Paneles anidados dentro de una superficie (ej. detalle expandido de una fila) |
| `--card` | `#FFFDFA` | Modales, tarjetas |
| `--border` | `#E5E0D3` | Borde por defecto |
| `--border-light` | `#EDE9DC` | Separadores internos |
| `--text-primary` | `#33302A` | Texto principal (nunca negro puro) |
| `--text-secondary` | `#6B675D` | Texto secundario |
| `--text-muted` | `#8A867A` | Texto terciario/hints |
| `--text-muted-2` | `#A6A192` | Segundo tono de muted, ligeramente más claro (metadatos, fechas en tablas) |
| `--text-faint` | `#C9C4B4` | Iconos decorativos, chevrons |
| `--accent` | `#C1592F` | Terracota — único acento fuera de Admin |
| `--accent-tint-bg` | `#F3DDCC` | Fondo de estado activo/badge |
| `--accent-tint-text` | `#8A3A1E` | Texto sobre `accent-tint-bg` |
| `--text-on-accent` | `#FFF8F2` | Texto sobre botones rellenos de `--accent` (crema casi blanco) |

**Oscuro:**
| Token | Valor | Uso |
|---|---|---|
| `--bg` | `#262220` | Fondo de página |
| `--surface` | `#2E2925` | Sidebar, inputs, cabeceras de tabla |
| `--surface-alt` | `#332D28` | Paneles anidados dentro de una superficie |
| `--card` | `#332D28` | Modales, tarjetas (mismo valor que `--surface-alt` en oscuro) |
| `--border` | `#3D372F` | Borde por defecto |
| `--border-light` | `#332D28` | Separadores internos |
| `--text-primary` | `#F0EAE0` | Texto principal (nunca blanco puro) |
| `--text-secondary` | `#A79C8C` | Texto secundario |
| `--text-muted` | `#8A8074` | Texto terciario/hints |
| `--text-muted-2` | `#786F60` | Segundo tono de muted, más apagado |
| `--text-faint` | `#5A5348` | Iconos decorativos, chevrons |
| `--accent` | `#E0834F` | Terracota aclarado para contraste sobre fondo oscuro |
| `--accent-tint-bg` | `#4A3327` | Fondo de estado activo/badge |
| `--accent-tint-text` | `#F0B594` | Texto sobre `accent-tint-bg` |
| `--text-on-accent` | `#2A1B10` | Texto oscuro sobre botones con `--accent` (que en dark mode es un tono claro) |

**Semántico (excepción deliberada a "un único acento", ver §6.7) — mismo valor en ambos temas:**
| Estado | Fondo | Texto |
|---|---|---|
| Warning | `#FBEFD7` | `#8B6115` |
| Critical/Error | `#F5DCD7` | `#96322A` |
| Info | `--surface` / `--border-light` | `--text-secondary` (neutro, sin tinte propio) |
| Positive | `#DCEBD7` | `#3F6B34` |

`Positive` (verde apagado, a juego con el resto de la paleta) se añadió en la Fase 6 para el punto de estado del ventilador "en marcha" en Monitor (§6.13) — único uso hasta ahora, mismo criterio de "color con propósito" que Warning/Critical (§6.7).

Reglas generales: radio grande y consistente (`rounded-xl`/`2xl` en cards y modales, `rounded-lg` en botones/inputs), sombras casi imperceptibles (nunca duras ni gradientes), tipografía Inter con jerarquía por peso, espaciado generoso, animaciones Framer Motion cortas (150-250ms, `ease-out`, solo fade/slide/scale sutil — nunca rebote).

### 6.2 Distribución general

- **Cabecera superior fija**, persistente en toda la app: a la izquierda, icono de colapsar/expandir sidebar + logo + nombre; a la derecha, avatar circular con chevron que despliega un menú (nombre + rol, luego Ajustes, Mis permisos, separador, Cerrar sesión — lista pensada para crecer con opciones futuras sin rediseñar).
- **Sidebar debajo de la cabecera**, nunca se oculta del todo: expandida (~190px, iconos + etiquetas) o contraída a un rail de solo iconos (~56px, icono activo con fondo tintado). El icono de la cabecera alterna entre ambos estados.
- Navegación filtrada por `usePermissions().hasModule()` — nunca una lista fija. Sección "Administración" (etiqueta muted, mayúsculas pequeñas) agrupa los módulos de admin, separada de los módulos personales (Archivos, Monitor). **Por ahora, Administración muestra Usuarios, Registros y Auditoría** — Roles queda deliberadamente fuera del sidebar mientras esa página está en pausa de diseño (no construir su nav todavía). Cada entrada, sin excepción, solo aparece si `hasModule()` lo confirma para ese usuario (ver matiz de Admin en §7.3) — nunca una lista estática con todo visible.
- Lo específico de cada pantalla (breadcrumb, buscador, botón de acción tipo "Subir") vive en la cabecera del propio panel de contenido, no en la cabecera global — no todas las pantallas lo necesitan.
- **Estadísticas de almacenamiento en la parte inferior del sidebar** (barra de progreso + "X GB de Y GB"), visible solo cuando el sidebar está expandido — se oculta al contraer a rail de iconos, igual que las etiquetas de texto de la navegación. Ver §6.12 para el detalle de datos.

### 6.3 Explorador de archivos

- **Lista única**, carpetas y archivos mezclados, diferenciados por icono — no tarjetas de carpeta separadas de una lista de archivos. Decisión tomada por mantenibilidad: una sola colección ordenable, un solo componente.
- **Carpetas siempre primero**, sin importar el criterio de orden activo. Dentro de las carpetas, orden fijo por nombre (no tienen tamaño en bytes en el contrato actual, así que "Tamaño" no las reordena).
- **Cabeceras de columna ordenables**: Nombre, Tamaño, Fecha — clic para ordenar, clic de nuevo para invertir, con flecha indicando dirección en la columna activa. Nombre y Fecha ordenan todo; Tamaño solo reordena archivos. No hay columna de orden por "Tipo" — el tipo se transmite solo con el icono. Orden hecho en cliente sobre lo ya cargado, sin parámetros de orden en el backend.
- **Toda la fila de una carpeta es clicable para entrar** — sin flecha/chevron de afordancia adicional.
- **Drag & drop estilo Explorador de Windows**: arrastrar un archivo sobre una fila de carpeta lo mueve dentro (usa `PATCH /files/{id}`, §5.4). Arrastrar un archivo sobre un segmento de la ruta (breadcrumb) lo mueve a esa carpeta ancestro; si se mantiene encima sin soltar (~800ms), navega automáticamente ahí. Implementado con `dnd-kit` (sensores de puntero, no HTML5 DnD nativo) para que funcione también en Capacitor/táctil. Toda la mecánica visual (hover, resaltado, navegación al mantener encima) se construye igual independientemente de si el endpoint ya existe — ver el interruptor `FILE_MOVE_ENABLED` en §7.5.
- **Breadcrumb**: a partir de ~4 niveles de profundidad, colapsa los intermedios en "…", dejando siempre visible el primero y los dos últimos. Los nombres se resuelven con `useFolderPath` (subiendo por `ParentFolderId` vía `GET /folders/{folderId}`, §5.4) cuando la carpeta actual no está ya en el trail de navegación normal (ej. tras un refresco de página o un enlace directo) — con un marcador genérico como fallback solo si esa resolución fallara, nunca como comportamiento normal.
- **Buscador con alcance limitado a la carpeta actual, en cliente, por ahora.** `GET /files/search` ya existe en el backend (§5.4) pero no está integrado todavía — el filtro actual solo opera sobre lo ya cargado de la carpeta actual, con debounce (§11). Verificar la forma real del endpoint antes de sustituir este filtro local, no diseñarlo de memoria.
- **Sin selección múltiple en esta primera versión.** Cada acción (eliminar, descargar, mover) opera sobre un archivo o carpeta a la vez — nada de checkboxes ni Ctrl/Shift-clic todavía. Es una simplificación deliberada; se puede añadir más adelante sin rediseñar la lista.

### 6.4 Modales de esta pantalla

Todos comparten el componente `Modal` (overlay oscuro, tarjeta centrada, radio 16px, cabecera con título + cerrar, pie con botón secundario con borde + botón primario relleno de acento), en su variante **pequeña** (§6.14) — ninguno de estos necesita el tamaño grande:
- **Crear carpeta / renombrar**: input de texto simple + Cancelar/Guardar.
- **Eliminar**: mensaje de confirmación + Cancelar/Eliminar.
- **Subir archivo(s)**: muestra la carpeta destino arriba ("Subiendo a" + icono + nombre), zona de arrastre que admite varios archivos a la vez o selección por clic, cada archivo en su propia fila con nombre/tamaño y su propio estado (barra de progreso con %, "En cola", o check de completado) más una `x` para quitarlo antes de subir. Pie con resumen ("X de Y completado") y botón de acción con recuento ("Subir 3 archivos").

### 6.5 Subida de archivos — abstracción obligatoria

Toda la lógica de subida vive detrás de un único hook, `useUploadFile` (en `shared/hooks/` o dentro de `features/files/`, pero un único punto). Hoy hace un `POST /files` multipart; cuando el backend pase a subida por paquetes, **solo cambia la implementación interna de ese hook** — ningún componente que lo consume debe enterarse del cambio de transporte.

### 6.6 Tablas de Admin (usuarios, logs, auditoría)

- Componentes compartidos `Table` + `Pagination`, reutilizados en las tres pantallas (Roles queda fuera por ahora, en pausa de diseño).
- **Más densas que la lista de archivos** (menos padding vertical por fila) — son pantallas con más datos, se prioriza ver más de un vistazo.
- **Patrón de filtros — `FilterBar` compartido**: 1-2 filtros de uso frecuente siempre visibles (búsqueda, un select), y el resto dentro de un botón "Filtros" con contador de filtros activos, que despliega un panel. Evita saturar la cabecera con muchos inputs sueltos cuando un endpoint admite bastantes parámetros de consulta.
  - **Usuarios**: búsqueda combinada siempre visible (si el texto contiene "@" se manda como `Email`, si no como `UserName`) + select de rol; dentro de "Filtros", rango de fechas (`From`/`To`).
  - **Logs de sistema**: select de nivel + búsqueda de "Operación" siempre visibles; dentro de "Filtros", rango de fechas y `CorrelationId` (campo técnico, poco frecuente).
  - **Auditoría**: búsqueda de usuario siempre visible; dentro de "Filtros", rango de fechas, `Action` y `ResourceType`. **Antes de convertir `Action`/`ResourceType` en selects con opciones fijas, confirma los valores reales contra las constantes `AuditLogActions` del backend** (§2) — no inventes la lista de opciones.
  - Texto estándar en toda la app: **"Limpiar filtros"** (no "Quitar filtros" ni variantes) — mismo texto también en el botón del estado vacío de "sin resultados" (§6.9).
  - Filtros y página activa se sincronizan con los query params de la URL (`useSearchParams` de React Router) — una vista filtrada sobrevive a un refresco y se puede compartir por enlace.
- Mismas cabeceras ordenables que en Archivos (flecha, clic para invertir).

### 6.6b Roles — en pausa

El diseño de esta pantalla queda pendiente de retomar. No construir su navegación en el sidebar ni su tabla/tarjetas todavía (ver §6.2).

### 6.7 Excepción del "único acento" en Admin

Fuera de Admin, el terracota es el único acento (ver §6.1). **Dentro de las pantallas de Admin, el usuario ha aprobado explícitamente romper esta regla cuando aporte significado funcional** — el caso principal son las insignias de nivel de log (Warning/Critical/Info, tokens en §6.1). No es una licencia para colorear todo Admin libremente sin motivo; sigue siendo "color con propósito", solo que aquí el propósito puede justificar más de un tono.

### 6.8 Patrón de detalle de fila — regla a mantener siempre

- **Si hay algo que editar → Modal** (variante **grande**, §6.14). Ejemplo: Usuarios — modal con pestañas Perfil (**solo lectura** — username, email, rol, fecha de creación; no existe endpoint para que un Admin edite el perfil de otro usuario, solo `PATCH /users/me` para editar el propio, §5.4 — si se quiere esa capacidad, hay que añadir el endpoint al backend primero), Permisos (grid de 9 switches, coloreados en acento cuando están activos), Límites (storage y tamaño máximo, con el aviso del §5.4 si se intenta subir por encima del global).
- **Si es solo para consultar (sin edición) → despliegue inline dentro de la fila.** Ejemplo: Logs de sistema y Auditoría — sin modal. El objetivo explícito es poder inspeccionar un log sin entrar a la base de datos, así que el despliegue muestra **todos los campos del DTO real, sin resumir ni omitir nada** (Id, Origen, fecha completa, UserId, CorrelationId, Duración, Mensaje y, si lo hay, la Excepción completa). La excepción/stack trace va en un bloque monoespaciado con altura máxima fija y scroll propio (`overflow-y: auto`, `white-space: pre-wrap`) más un botón de copiar — nunca truncada ni dejando que la fila crezca sin límite.

### 6.9 Estados vacíos

Un único componente compartido: icono dentro de un círculo suave, título, descripción corta, y botón de acción **solo si hay algo que el usuario pueda hacer**. Ejemplos: carpeta vacía → botón "Subir archivo"; sin resultados de búsqueda → botón secundario "Limpiar filtros" (mismo texto estándar que en las tablas de Admin, §6.6); usuario sin módulos activados → sin botón, es puramente informativo (el usuario no puede activarse módulos a sí mismo).

### 6.10 Estados de carga

Skeletons con la misma forma que el contenido real (filas de tabla, no un spinner genérico centrado), animación de pulso sutil — para que la pantalla no salte cuando llegan los datos.

### 6.11 Toasts

`sonner`, restyled con los tokens propios (no su estilo por defecto), posición abajo a la derecha, cierre automático y manual. Icono dentro de un círculo tintado (check en tono acento para éxito, alert-triangle en tono semántico de error para fallo). Copy conciso y concreto: sin prefijo "Error:", sin relleno tipo "correctamente"/"con éxito". Los toasts de error muestran el mensaje real mapeado del diccionario de errores (§5.1) siempre que el código sea conocido.

**Excepción — operaciones por lote:** cuando una acción dispara varias operaciones independientes a la vez (ej. subir varios archivos en el mismo modal, §6.4), un error puntual de una de ellas se muestra **en la fila/ítem correspondiente dentro del propio modal**, no como un toast — evita que subir 5 archivos con 1 fallido dispare un toast de más en medio de los demás. Los toasts siguen siendo la vía por defecto para cualquier acción única (crear, renombrar, eliminar, etc.).

### 6.12 Widget de almacenamiento del sidebar

Barra de progreso + texto ("2.4 GB de 10 GB"), en la parte inferior del sidebar expandido (§6.2). Datos de dos queries independientes:
- **Uso**: `GET /statistics/storage`.
- **Límite**: `GET /users/me/settings-overview` — puede llegar sin resolver (ver hueco de contrato en §5.5); si `StorageLimitBytes` es `null`, mostrar solo el total usado, sin la comparación "de X".

Cualquier mutation que cambie el espacio ocupado (subir archivo, borrar archivo, borrar carpeta) invalida **solo la query de uso**, nunca la de límite — el límite casi nunca cambia y no hace falta repreguntarlo en cada acción (ver §7.8).

### 6.13 Monitor del sistema

- **Cuatro tarjetas superiores actúan como selector**, no solo como resumen: CPU, Memoria, Disco y Temperatura. La tarjeta activa se resalta (borde/fondo en acento); al hacer clic en otra, cambia el gráfico y el cuadro lateral de abajo.
- **El ventilador vive dentro de la tarjeta de Temperatura**, no aparte: un punto de estado (verde en marcha / rojo si no) + rpm, en línea con el valor de temperatura. Al seleccionar esa tarjeta, el cuadro lateral junto al gráfico muestra el detalle completo del ventilador (estado, rpm, modo, PWM).
- **Para CPU/Memoria/Disco, ese mismo cuadro lateral queda reservado** con un texto tipo "En desarrollo" — espacio preparado para cuando la API exponga más datos (modelo de CPU, tipo de memoria, etc.), no un hueco vacío sin explicación.
- **Chips de rango**: 1h / 24h / 7d / 30d — nunca un selector de fechas libre, para no chocar con que el backend no limita `/system-metrics/history` por su cuenta (§5.4).
- **Actualización cada 60s** (coincide con `SystemMetrics:SampleIntervalMinutes` del backend) vía `refetchInterval` de TanStack Query, **más un botón manual de refrescar** — las dos cosas a la vez, no una u otra.
- **Color por umbral, no permanente.** Las tarjetas y sus barras se quedan en el acento único mientras el valor es normal; solo cambian a un tono semántico de aviso (§6.1) al superar un umbral crítico (ej. >85% de uso, temperatura alta). Es una excepción de color puntual y funcional, igual de justificada que las insignias de log aunque Monitor no esté dentro de "Administración".
- **`recharts`** para los gráficos, no SVG a mano — con línea de referencia discontinua marcando el umbral cuando aplique (ej. "Umbral 75°C").

### 6.14 Tamaños de modal — dos variantes estándar, no una talla única

- **Pequeño** (~380px de ancho): confirmaciones y edición de un solo campo — crear carpeta, renombrar, eliminar, editar descripción de un rol.
- **Grande** (~560px de ancho, ~460px de alto mínimo): contenido con secciones o pestañas que va a crecer con el tiempo — el modal de detalle de Usuario (§6.8, pestañas Perfil/Permisos/Límites) es el caso de referencia. **No dimensionar al mínimo necesario hoy** — reservar el tamaño grande desde ahora para que quepan las funcionalidades que se añadan más adelante sin tener que rediseñar el modal cada vez. Cualquier modal futuro con varias secciones (no solo Usuarios) usa esta misma variante grande, para que no haya un tamaño distinto por pantalla.

### 6.15 Error boundaries — convención añadida en Fase 7

No estaba escrito en este documento hasta la auditoría de calidad de la Fase 7, pero ya es convención fija del proyecto: **`shared/components/ErrorBoundary.tsx`** (componente de clase — React no tiene equivalente en hooks) envuelve dos niveles:
- **Uno de app entera**, en `app/App.tsx` alrededor de `<RouterProvider>` — última red de seguridad si algo revienta fuera de cualquier sección (ej. el propio `AuthProvider`).
- **Uno por página de nivel superior**, en `app/router.tsx`, envolviendo el componente de cada ruta con un `sectionLabel` descriptivo (`"el explorador de archivos"`, `"el Monitor del sistema"`, `"Usuarios"`, `"Registros"`, `"Auditoría"`, `"Ajustes de cuenta"`, `"Mis permisos"`) — así un fallo de render en una pantalla no tira las demás; `AppShell` (cabecera + sidebar) sigue intacto y navegable alrededor del fallback, el usuario no queda atrapado.

El botón "Reintentar" del fallback fuerza un remontaje real del subárbol (vía una `key` que se incrementa), no solo oculta el mensaje de error — si el problema era de estado local roto, un remontaje limpio tiene más opciones de arreglarlo que simplemente volver a renderizar el mismo estado. Sin servicio de reporting de errores todavía (§2: no hay CI/monitoring montado) — de momento el error se registra solo con `console.error`, sería el siguiente paso natural si el proyecto añade telemetría más adelante.

## 7. Patrones de código

### 7.1 Data fetching
Todo lo que sea estado de servidor pasa por TanStack Query. Un hook por recurso dentro de la feature correspondiente (ej. `features/files/api.ts` exporta `useFiles(folderId)`, `useMoveFile()`, etc.), nunca `fetch`/`axios` suelto dentro de un componente.

### 7.2 Sesión (`shared/hooks/useAuth`)
Contexto de React: access token en memoria (solo para decodificar claims, ver §5.2), claims decodificados (`userId`, `username`, rol), funciones `login`/`logout`. Toda request va con `withCredentials: true`; nunca se adjunta un header `Authorization` manual.

### 7.3 Permisos (`shared/hooks/usePermissions`)
Envuelve `GET /users/me/permissions` con TanStack Query. Expone `hasModule(module: AppModule)` e `isAdmin` (derivado del claim de rol). Toda comprobación de acceso —guards de ruta y botones de acción individuales— pasa por aquí, nunca se reimplementa la lógica de "¿puedo ver esto?" en una página suelta. **`hasModule()` debe devolver `true` automáticamente si `isAdmin` es `true`, sin mirar los flags reales** — replica el comportamiento del backend (§5.3: el rol Admin pasa siempre, sin comprobar módulo). Si no se replica esto, un Admin podría ver un sidebar incompleto por un dato de permisos que en su caso ni siquiera debería consultarse. **Validado en julio 2026**: cualquier usuario sin fila de permisos en BD (no solo Admins, aunque solo se ha observado en Admins porque son los únicos insertados a mano) da 404/`PermissionsNotFound` en `GET /users/me/permissions` — sin upsert, tampoco el `PATCH` crea la fila si no existe. Por eso la query debe ir con `enabled: !isAdmin` (nunca dispararse para un Admin), no solo ignorar el resultado si llega.

### 7.4 Subida de archivos (`shared/hooks/useUploadFile`)
Ver §6.5 — es la única vía para subir archivos en todo el proyecto.

### 7.5 Drag & drop y mover/renombrar archivos — endpoint real desde julio 2026, con bug de persistencia activo
`dnd-kit`, sensores de puntero. Ver §6.3 para el comportamiento exacto (mover a carpeta, mover a breadcrumb con navegación al mantener encima).

Las mutations `useMoveFile()` y `useRenameFile()` (en `features/files/api.ts`) llaman a `PATCH /files/{id}` (§5.4 — nombres reales `NewFolderId`/`NewFileName`, no los originalmente asumidos). Su ejecución está controlada por una constante declarada al principio de ese archivo:

```ts
// features/files/api.ts
export const FILE_MOVE_ENABLED: boolean = true // confirmado contra FilesController.UpdateFileAsync en la fase de integración
```

- Con `false` (ya no es el caso actual, mantenido por si hay que revertir): no llama a la API, muestra un toast informativo distinto para mover/renombrar y no muta nada.
- Con `true` (estado actual): llamada real. **`useRenameFile` envía siempre el `NewFolderId` actual del archivo junto con `NewFileName`, nunca solo el nombre** — omitirlo movería el archivo a la raíz sin querer (trampa real del contrato, §5.4).
- **⚠️ El endpoint responde 200 con un DTO que aparenta éxito, pero por un bug de `asNoTracking` en el backend (§5.4) el cambio no se persiste en BD todavía.** El front no puede detectar ni mitigar esto por su cuenta — es un fallo de persistencia del servidor, pendiente de arreglar en `HomeDB`. No "arregles" esto añadiendo lógica de verificación en el front; espera al fix del backend.

### 7.6 Formularios
`react-hook-form` + `zodResolver`. El schema de Zod vive junto al formulario en la misma feature (`schemas.ts`).

### 7.7 Variables de entorno (`shared/env.ts`)
Un único `VITE_API_URL`, validado con Zod al arrancar la app — si falta o es inválido, la app falla de forma clara al inicio, en vez de fallar de forma rara en la primera request. **El valor correcto (puerto/host real del backend en desarrollo) se confirma revisando `HomeDB/`** (`appsettings.Development.json`, `docker-compose.yml`, o similar) — no lo asumas ni copies un puerto de ejemplo sin verificarlo.

### 7.8 Estadísticas de almacenamiento (dos queries independientes)
Ver §6.12. `useStorageUsage()` (→ `/statistics/storage`) y `useStorageLimit()` (→ `/users/me/settings-overview`) son queries separadas de TanStack Query con claves distintas. Las mutations de `features/files` (subir, borrar archivo, borrar carpeta) invalidan solo la clave de `useStorageUsage`, nunca la de `useStorageLimit`.

### 7.9 Monitor — auto-refresco
`useLastMetric()` y `useMetricsHistory(range)` usan `refetchInterval: 60_000` (ver §6.13). El botón de refrescar manual simplemente llama a `refetch()` de ambas queries activas, sin lógica adicional.

### 7.10 Filtros de tablas de Admin (`shared/components/FilterBar`)
Componente compartido usado por Usuarios, Logs y Auditoría (§6.6): filtros frecuentes siempre visibles + botón "Filtros" con contador que abre un panel para el resto. El estado de los filtros y de la página activa vive en los query params de la URL vía `useSearchParams`, no en estado de componente aislado — así sobrevive a un refresco y es compartible por enlace.

## 8. Cómo añadir un módulo nuevo

Cuando el backend implemente Expenses/Investments/RemoteScripts (o cualquier módulo futuro):
1. Crear `features/<nombre>/` con `api.ts`, `schemas.ts`, `types.ts`, `components/`
2. Añadir la ruta en `app/router.tsx`, envuelta en `<RequireModule module="X">`
3. Añadir la entrada al sidebar en `app/layout/`, condicionada por `usePermissions().hasModule('X')`
4. Si necesita acciones solo-Admin, añadir `<RequireAdmin>` en esas acciones concretas, no en la página entera
5. Actualizar §5.4 de este documento con los endpoints reales — y antes de eso, verificarlos contra el código del backend (§2)

## 9. Testing

Vitest para lo que no es visual: `shared/api/client.ts` (parseo del envelope y mapeo de errores), hooks de datos de cada feature, la lógica de ordenación de la lista de archivos (carpetas primero, criterio activo), schemas de Zod. No hay tests de componentes visuales ni end-to-end por ahora.

## 10. Preparación para Capacitor (móvil, pronto — no a largo plazo)

- Todo responsive de verdad, probado a un ancho estrecho (~375px) desde el primer componente
- Nada de comportamiento exclusivo de ratón/teclado como única vía (hover-only, atajos sin alternativa táctil)
- El drag & drop ya se construye con `dnd-kit` por esta razón (§6.3, §7.5) — HTML5 DnD nativo no sirve aquí
- Cuando llegue el momento: `npx cap init`, `npx cap add android`, build de Vite + sync — un encargo pequeño sobre el proyecto ya terminado, no una reescritura
- La auth por cookies (§5.2) funciona igual dentro del WebView de Capacitor sin cambios, porque es la misma web

## 11. Detalles de experiencia de usuario (calidad de vida)

Cosas que un front bien cuidado no debería omitir, aunque no se mencionen explícitamente para cada pantalla nueva que se construya:

- **Confirmación antes de cualquier acción destructiva o irreversible** (borrar archivo, carpeta, usuario). Ya cubierto por el modal de confirmación de §6.4, pero es una regla general: cualquier acción irreversible que se añada en el futuro pasa por el mismo patrón, nunca se ejecuta con un solo clic sin confirmar.
- **Mostrar/ocultar contraseña** (icono de ojo) en todos los campos de contraseña: login, cambiar contraseña, crear usuario en `admin-users`.
- **Evitar doble envío.** El botón de acción de cualquier formulario/mutation se deshabilita y muestra estado de carga (spinner o texto tipo "Subiendo…") mientras la petición está en curso — nunca se puede disparar la misma mutation dos veces por un doble clic.
- **Aviso de cambios sin guardar.** Si un modal de edición (perfil, permisos, límites) tiene cambios sin guardar (dirty-checking) y el usuario intenta cerrarlo, confirma antes de descartar.
- **Gestión de foco en modales.** Al abrir, foco automático en el primer campo; el foco queda atrapado dentro del modal mientras está abierto; al cerrar, vuelve al elemento que lo abrió. Es accesibilidad de teclado, no solo estética.
- **Alternativa sin arrastrar para mover archivos.** Además del drag & drop (§6.3), cada fila tiene una acción "Mover a…" en su menú contextual/kebab que abre un selector de carpeta. Necesaria para quien navega por teclado y para pantallas táctiles pequeñas donde arrastrar es menos cómodo.
- **Renombrar preselecciona el nombre sin la extensión** en el input (como Explorer/Finder), para no arriesgarse a machacar la extensión sin querer.
- **Evitar que el navegador abra un archivo si se suelta fuera de la zona de subida.** `preventDefault` en `dragover`/`drop` a nivel de documento, para que arrastrar un archivo por error sobre la ventana no navegue fuera de la app.
- **Feedback de "Copiado"** (micro-toast o tooltip) al usar el botón de copiar del detalle de logs (§6.8).
- **Buscador con debounce** (`shared/hooks/useDebounce`) en el filtro local de Archivos y en los buscadores de las tablas de Admin, para no refiltrar en cada tecla.
