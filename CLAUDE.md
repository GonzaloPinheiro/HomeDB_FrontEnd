# CLAUDE.md — HomeDB Web

Lee este documento entero antes de tocar cualquier código en este proyecto. Es la fuente de verdad de convenciones. La sección 5 (contrato del backend) es una **foto fechada**, no una verdad eterna — lee la advertencia al principio de esa sección antes de fiarte de ninguna tabla.

## 1. Qué es este proyecto

Frontend web de **HomeDB**, una API personal (ASP.NET Core 8 + PostgreSQL) que gestiona archivos/carpetas, usuarios, permisos por módulo, logs y métricas de un servidor casero (Raspberry Pi). El backend lo mantiene el usuario directamente en la carpeta hermana **`HomeDB/`** (acceso de lectura, nunca de escritura — ver §2). Este proyecto vive en **`HomeDB_FrontEnd/`** y es nuevo desde cero, reemplaza por completo a un front anterior descartado que vive en **`HomeDB_Front/`** (nótese la diferencia de nombre) — esa carpeta no se toca ni se lee, ya está auditada y volcada en este documento.

**El móvil será una app nativa aparte, fuera de este repo**, a diseñar y construir en otro proyecto (planificado en otra conversación, no forma parte del alcance de `HomeDB_FrontEnd/`). Mientras tanto, esta web se sigue construyendo responsive y táctil desde el primer componente — sigue pensada para funcionar bien desde el navegador de un móvil, eso no cambia — pero **no se empaqueta en ningún WebView**; ver §10 para el porqué.

## 2. Cómo trabajamos (reglas fijas)

- **Límites de repositorio — aplican siempre, con o sin recordatorio explícito en el prompt.** Esta raíz contiene varios repositorios distintos en carpetas hermanas:
  - **SOLO puedes crear o modificar archivos dentro de `HomeDB_FrontEnd/`.** Es el único repositorio en el que trabajas, en cualquier tarea.
  - **Puedes LEER (nunca escribir ni modificar) `HomeDB/`** — es la API backend real. Consúltala siempre que necesites verificar un endpoint, DTO o comportamiento antes de darlo por bueno (ver regla siguiente).
  - **Nunca toques ni leas `HomeDB_Front/`** (con espacio final "Front", sin "End") — front antiguo descartado por completo, ya auditado y volcado en este documento. No es referencia útil, y confundirlo con `HomeDB_FrontEnd/` sería un error grave.
  - **Cualquier otra carpeta que veas en esta raíz no tiene relación con este proyecto** — no la leas ni la modifiques bajo ninguna circunstancia.
  - **Ante cualquier duda sobre si una ruta está dentro de tus límites, no la toques.** Pregunta en tu informe final en vez de asumir — nunca al revés.
- **Mantén este documento vivo, no solo el informe del chat.** Si durante una tarea descubres algo nuevo del contrato real del backend (§5), tomas una decisión de diseño no evidente, estableces una convención nueva, o algo que este documento asumía deja de ser cierto, actualiza la sección correspondiente de este mismo `CLAUDE.md` antes de terminar — no dejes que esa información viva solo en tu resumen de esa sesión, que se pierde en cuanto se cierra la conversación.
- **Verificación obligatoria.** Después de cualquier cambio, ejecuta `typecheck`, `lint` y `build`. No des una tarea por terminada si alguno falla. No hay CI todavía (el usuario lo montará más adelante como aprendizaje) — esto es la única red de seguridad, tómatelo en serio.
- **El contrato del backend no es estático — verifícalo.** Antes de implementar o modificar cualquier cosa que dependa de un endpoint, tipo o comportamiento del backend, relee el código fuente real del backend en vez de fiarte ciegamente de la §5 de este documento. Si hay discrepancia entre este documento y el código real, **gana el código real**. Si no encuentras la carpeta `HomeDB/` en este entorno, pregunta al usuario la ruta antes de asumir nada.
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
- **TanStack Query** para todo el estado de servidor (fetch, caché, loading, error, reintentos). El estado global "manual" son dos Context de React — la sesión de auth (§7.2) y la cola de subidas (§7.4, desde la Fase 8) — no hay Redux/Zustand. La cola de subidas es una excepción deliberada, no el patrón por defecto: existe porque una subida por chunks debe seguir corriendo aunque el componente que la inició se desmonte (cerrar el modal, cambiar de página), algo que una `mutation` de TanStack Query atada al ciclo de vida de un componente no da por sí sola.
- **Axios** como cliente HTTP, `withCredentials: true` siempre — la auth va por cookies, nunca por header manual (ver §5.2)
- **Zod** para validar respuestas de API y formularios
- **react-hook-form** + Zod para formularios
- **Tailwind CSS + shadcn/ui** (componentes copiados al repo, no una librería opaca) + **tailwindcss-animate** (transiciones de apertura/cierre de los componentes Radix que trae shadcn — dropdown, etc.) + **Framer Motion** para el resto de animaciones
- **dnd-kit** para drag & drop — basado en eventos de puntero, no en la API nativa de HTML5 Drag and Drop, porque esta última no funciona bien en pantallas táctiles
- **recharts** para los gráficos del Monitor del sistema (§6.13) — no gráficos SVG hechos a mano
- **sonner** para toasts, restyled con los tokens de color propios (no sus estilos por defecto)
- **lucide-react** para iconos
- **Vitest** para tests unitarios
- **pnpm** como gestor de paquetes
- Sin monorepo — el móvil vive en un proyecto nativo aparte, fuera de este repo (ver §10)

No añadas ninguna otra librería de estado, fetching, fechas o UI sin que esté justificado.

## 4. Estructura de carpetas

```
src/
├── app/
│   ├── App.tsx                 # providers (QueryClient, AuthProvider, Router) + layout raíz
│   ├── router.tsx               # definición de rutas, lazy loading
│   └── layout/                  # AppShell, TopHeader, Sidebar (navegación por módulos),
│                                 # UploadTray (bandeja persistente de subidas, §6.16)
├── features/
│   ├── auth/                    # solo login + restauración de sesión (NO registro, ver §5.2)
│   ├── files/                   # explorador de archivos + carpetas (lista unificada, ver §6.3)
│   │   └── uploadQueue/          # Context de la cola de subidas por chunks (§6.5/§7.4):
│   │                             # types.ts, pipeline.ts (lógica pura + llamadas a la API,
│   │                             # testeada en pipeline.test.ts), concurrency.ts (semáforo
│   │                             # global + pool de workers de chunks, concurrency.test.ts),
│   │                             # speed.ts (velocidad/ETA), allowedExtensions.ts (lista blanca
│   │                             # del backend, §5.4) y UploadQueueContext.tsx (Provider + hook
│   │                             # useUploadQueue, montado en AppShell)
│   ├── home/                    # pantalla de Inicio, primera tras el login (§6.18)
│   ├── account/                 # /me: perfil, cambiar contraseña, ajustes, ver mis permisos
│   ├── admin-users/              # listar/ver/crear/borrar usuarios, editar límites de storage
│   ├── admin-permissions/        # editar permisos por módulo de un usuario (reglas de auth distintas
│   │                             # de admin-users, ver §5.3 — por eso va separada)
│   ├── admin-roles/              # listar roles, editar descripción — EN PAUSA de diseño (§6.6b), no
│   │                             # construir todavía ni añadir su entrada al sidebar (§6.2)
│   ├── admin-audit-logs/         # tabla de auditoría, detalle inline
│   ├── admin-system-logs/        # logs de sistema, salud, resumen de errores, operaciones lentas
│   └── system-monitor/           # dashboard de métricas (CPU/mem/disco/temp/ventilador)
│                                 # + backups/: panel de backups diarios del cuadro lateral de Disco (§5.4, §6.13)
├── shared/
│   ├── api/
│   │   ├── client.ts             # instancia axios, interceptores, manejo del envelope ApiObjResponse<T>
│   │   └── errors.ts              # mapa completo de ApiErrorCodes -> mensaje (ver §5.1)
│   ├── components/                # Button, Input, Table, Pagination, Modal, EmptyState, Skeleton,
│   │                               # PageHeader, FloatCard (tarjeta flotante de Inicio y Monitor, §6.18),
│   │                               # DropOverlay (aviso al arrastrar archivos, §6.3)... (shadcn + a medida)
│   ├── hooks/                     # useAuth, usePermissions, useFileDropZone (soltar/pegar archivos, §6.3),
│   │                               # usePreventBrowserFileOpen (§11), useDebounce, etc.
│   ├── lib/                       # formatBytes, formatDate, fileDrop (extraer archivos de un DataTransfer), cn(), etc.
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
| UploadSessionNotFound | 1018 | 404 | Sesión de subida no existe o no es tuya |
| UploadIncomplete | 1019 | 400 | Faltan chunks por recibir al llamar a `complete` |
| UploadSessionNotActive | 1020 | 409 | La sesión ya está cancelada (no se puede recibir más chunks) |
| InvalidChunkSize | 1021 | 400 | El chunk escrito en disco no coincide con el tamaño recibido |
| InvalidChunkNumber | 1022 | 400 | `chunkNumber` fuera de `[1, totalChunks]` |
| AssembledFileSizeMismatch | 1023 | 500 | El archivo ensamblado no coincide con `totalSizeBytes` declarado en `init` |
| InvalidUploadRequest | 1024 | 400 | `totalChunks`/`totalSizeBytes` inválidos en `init` |
| BackupAlreadyRunning | 1025 | 409 | Ya hay un backup en curso para ese nivel |
| BackupLevelNotSupported | 1026 | 400 | Nivel de backup no implementado todavía (hoy solo `Daily`) |
| InternalError | 9999 | 500/400 | Error no controlado |

`ApiError` (`shared/api/client.ts`) lleva además `httpStatus` y `retryAfterMs` (ambos `null` si no hubo respuesta / cabecera legible) y `isRateLimitError()` para reconocer un 429 por código 1009 o por estado HTTP — ver §7.4 para el único consumidor hoy (la cola de subidas).

**Reintentos de queries**: el `QueryClient` (`app/App.tsx`) usa `shouldRetryQuery` (`client.ts`) — un 4xx (403, 404, 429…) no se reintenta, solo red caída y 5xx (máx. 3). Reintentar un 429 gastaría más cupo del rate limiter global.

Patrón: cada mutation/query captura el error, lo pasa por `getErrorMessage(errorCode)` de `shared/api/errors.ts`, y se muestra con un toast de sonner (ver §6.8). Los toasts de error usan siempre este mensaje mapeado cuando el código es conocido, nunca un genérico si hay uno específico disponible.

### 5.2 Autenticación y sesión — el front web usa cookies, no headers manuales

- Login (`POST /api/auth/login`, público) y refresh (`POST /api/auth/refreshToken`, público) devuelven `TokenResponseDto { AccessToken, AccessTokenExpiresAt, RefreshToken, RefreshTokenExpiresAt }` **y además** ponen cookies HttpOnly (`AccessToken` con `Path=/`, `RefreshToken` con `Path=/api/auth`).
- **El front web solo usa la cookie para autenticar.** Todas las requests van con `withCredentials: true`; el navegador envía las cookies solo. **Nunca se añade manualmente el header `Authorization`.**
- El `AccessToken` del body **se decodifica solo para leer claims** (`userId`, `username`, rol) y pintar la UI (ej. mostrar el menú de Admin) — nunca se usa para autenticar peticiones, ni se persiste en `localStorage`, solo vive en memoria (contexto de React).
- El `RefreshToken` del body **se ignora para almacenamiento** — la cookie httpOnly es la única fuente de verdad, el front nunca la lee ni la guarda.
- El backend también acepta el header `Authorization: Bearer` (para Postman o una futura app nativa fuera de este proyecto) — **el front web no usa esa vía**, funciona siempre con cookies.
- Interceptor de axios: en un 401 que no venga de login/refresh, intenta refrescar una vez (la cookie viaja sola), reintenta la request original; si el refresh falla, limpia el estado local de React y navega a `/login` **usando el router, no `window.location.href`**. **El refresh es de una sola vuelta** (`refreshSession`, `client.ts`): varias requests con 401 a la vez comparten la misma promesa, porque el refresh token rota y un segundo refresh con la cookie ya rotada fallaría, expulsando al usuario sin motivo. Si el refresh va bien pero la request reintentada falla por otra causa (403, 500…), eso es un error normal de esa request y **no** expira la sesión.
- **Cerrar o expirar la sesión vacía la caché de TanStack Query** (`queryClient.clear()` en `clearSession`, `useAuth`): la caché es por pestaña, no por usuario, y sin vaciarla el siguiente login vería permisos y datos del anterior.
- Access token expira en **30 minutos**. Refresh token en **7 días**, con rotación.
- `PUT /api/auth/changePassword` revoca todos los refresh tokens del usuario. Tras un cambio de contraseña con éxito, forzar logout y redirigir a login con un mensaje explicativo.
- `POST /api/auth/logout` responde 200 aunque el token ya estuviera revocado o no existiera — no lo trates como error, simplemente limpia el estado local y navega a login.
- **✅ Bug del doble hash del refresh token — ARREGLADO en el backend (confirmado de nuevo en julio 2026: `AuthService.cs` líneas 108-134 y 140-174 ya devuelven `refreshTokenPlain`, no el hash, tanto en `LoginAsync` como en `RefreshAsync`).** Esta sección seguía describiendo el bug como activo con fecha "julio 2026" sin más precisión — quedó desactualizada tras el fix, ya commiteado en `HomeDB/` (ver memoria de sesión `homedb-refresh-token-bug`, commit `c05aad9`, 21-jul-2026). El front ya implementa el contrato correcto (§7.2) y no necesita cambios. **Pendiente de re-confirmar con una prueba real login→refresh contra el despliegue detrás del túnel de Cloudflare** (esta verificación solo comprobó el código fuente de este checkout, no el binario desplegado en producción) — si alguna sesión futura ve el fallo de nuevo en producción, puede ser que el contenedor desplegado no incluya aún este commit.
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

**Upload por chunks** (módulo `Files`) — **verificado por lectura directa del backend en la Fase 8 (`UploadController`, `UploadService`, julio 2026).** `POST /files` (multipart único, arriba) **sigue existiendo en el backend, sin retirar**, pero el front ya no lo usa — todas las subidas pasan por este pipeline (§6.5/§7.4), incluidas las de un solo chunk.
- `POST /files/upload/init` — `{ fileName, totalSizeBytes, totalChunks, folderId? }` → `{ sessionId: Guid }` (201 vía envelope estándar, no 201 HTTP real — el controller devuelve `Ok`). Aquí ya se valida `MaxFileSizeBytes` efectivo y la cuota de storage — errores esperables: `FileTooLarge` (1004), `StorageLimitExceeded` (1016), `FolderNotFound` (1002, si `folderId` no existe o no es tuyo — lanza `ParentFolderNotFoundException`, mapeada a este código), `InvalidUploadRequest` (1024, `totalChunks`/`totalSizeBytes` inválidos).
- `POST /files/upload/chunk` — `multipart/form-data: sessionId, chunkNumber (1-based), chunk` — límite servidor 35MB por request (`[RequestSizeLimit(35_000_000)]`, es decimal, 35 MB y no 35 MiB; el comentario del backend habla de "margen sobre chunks de 20-30MB" — el front usa 32 MiB fijo, `CHUNK_SIZE_BYTES` en `pipeline.ts`, ver §7.4). **La recepción NO exige orden y soporta chunks concurrentes** (verificado para la subida paralela: lock por `(sessionId, chunkNumber)` en `UploadChunkLockProvider`, contador `ReceivedSizeBytes` actualizado de forma atómica con `ExecuteUpdateAsync`, `DbContext` por request) — el backend solo comprueba `1 <= chunkNumber <= totalChunks` y trackea recibidos por número (`UploadChunkRepository`); el ensamblado en `complete` sí es secuencial. Reenviar el mismo `chunkNumber` es idempotente (sobrescribe el chunk en disco, no duplica el registro). Errores: `UploadSessionNotFound` (1018), `UploadSessionNotActive` (1020, sesión cancelada), `InvalidChunkNumber` (1022), `InvalidChunkSize` (1021, tamaño escrito ≠ tamaño recibido), `FileTooLarge` (1004, si la suma de chunks recibidos supera `MaxFileSizeBytes` — cancela la sesión server-side).
- `GET /files/upload/{sessionId}/status` → `{ sessionId, totalChunks, receivedChunks: number[] }`. El front lo usa **solo para reanudar tras un error** (`retryEntry`, §7.4) — nunca en el camino feliz, donde ya sabe qué ha subido con éxito porque esperó cada chunk secuencialmente.
- `POST /files/upload/{sessionId}/complete` → ensambla los chunks en orden, valida tamaño total, extensión (whitelist) y los primeros bytes contra el tipo real declarado, crea el `FileItem` y borra la carpeta temporal de la sesión. **Devuelve una forma distinta si la sesión ya estaba completada** (llamada duplicada): `ApiObjResponse<string>` con un mensaje informativo en vez de `UploadFileResponseDto` — el front lo contempla con `uploadCompleteResponseSchema` (`z.union`). Errores: `UploadIncomplete` (1019, faltan chunks), `UploadSessionNotActive` (1020), `AssembledFileSizeMismatch` (1023), `InvalidFileExtensionException` (mapea a un código de validación de archivo ya existente — mismo que la subida clásica). **⚠️ La extensión (lista blanca `AllowedExtensions`: imágenes jpg/jpeg/png/gif/webp, vídeo mp4/mov, audio mp3/wav/flac, documentos pdf/docx/xlsx/txt/md/csv, comprimidos zip/7z/rar, datos json/xml/yaml/yml) y los magic bytes solo se validan AQUÍ, al final**: un archivo de decenas de GB con extensión no admitida se subiría entero para ser rechazado (y la sesión se cancela y se borran los chunks). Por eso el front rechaza al encolar con `uploadQueue/allowedExtensions.ts`, una copia de esa lista (§7.4) — si el backend la amplía, actualizarla también aquí.
- **Sesiones huérfanas**: `UploadService.CleanupFinishedSessionsAsync` existe y hay opciones de configuración (`UploadCleanupOptions.RunAtHourUtc`, 3 UTC por defecto), pero **no encontré ningún `BackgroundService` que la invoque** en la Fase 8 — puede ser un hueco real o estar pendiente de terminar en el backend. No bloquea al front (una sesión cancelada/abandonada simplemente no se limpia automáticamente todavía), pero si en algún momento se ve que las sesiones huérfanas se acumulan sin límite, este es el punto a preguntar al usuario.
- **No hay endpoint de cancelación explícita de una sesión.** Cancelar desde el front (§7.4) solo deja de mandar chunks — la sesión queda huérfana en el servidor hasta que exista ese endpoint o se enganche la limpieza de arriba. `// PENDIENTE (CLAUDE.md §5.4): cuando exista DELETE /files/upload/{sessionId}, llamarlo desde cancelEntry en vez de solo abortar client-side.`

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

**Backups** (rol Admin **+** módulo `SystemMonitor` — `BackupController`, verificado por lectura directa del backend en septiembre 2026) — `[Authorize(Roles = Admin)]` + `[RequireModule(SystemMonitor)]`: un `User` con el módulo ve el Monitor pero recibe 403 aquí (§5.3, "módulo activado no implica rol Admin"), así que el front ni siquiera dispara estas peticiones para quien no es Admin.
- `GET /backup/history?level=&page=&pageSize=` — `level` opcional (enum por nombre, `Daily`), `page`≥1, `pageSize` 1-200 (por defecto 50) → `{ items: BackupAuditEntry[], totalCount, page, pageSize, totalPages }`. Orden `startedAt` descendente. **Incluye los registros ya rotados** (`deletedAt` != null): son auditoría, su copia física ya no existe.
- `POST /backup/{level}/trigger` — `level` en la ruta, por nombre (`Daily`) o número. **Es síncrono**: no responde hasta que rsync y `pg_dump` terminan (minutos con muchos archivos) y devuelve la `BackupAuditEntry` resultante. **Responde 200 aunque el backup termine en `Failed`** — el fallo va en `status`/`errorMessage` de la entrada, no en el envelope. Errores: `BackupAlreadyRunning` (1025, 409), `BackupLevelNotSupported` (1026, 400 — hoy `Monthly` no está implementado).
- `BackupAuditEntry` (entidad devuelta tal cual, sin DTO propio): `id, level, startedAt, completedAt?, status, filesBackedUpSizeBytes, databaseDumpSizeBytes, errorMessage?, backupPath?, deletedAt?`. **`level` (`Daily=1`, `Monthly=2`) y `status` (`Running=1`, `Success=2`, `Failed=3`) llegan como NÚMERO** — el backend no registra `JsonStringEnumConverter`. El schema de Zod (`features/system-monitor/backups/types.ts`) los normaliza a literales (`'running' | 'success' | 'failed'`) y tolera también el nombre como string por si el backend añade el converter.
- **Rotación**: solo se conservan **dos copias físicas** (`backup_actual` y `backup_anterior`). `RunDailyBackupAsync` descarta la más antigua ANTES de empezar — un backup forzado, o uno que falle a medias, consume una de las dos copias existentes. Por eso forzar un backup pasa por un modal de confirmación que lo explica (§11).
- **Riesgo conocido del backend (no arreglable desde el front)**: `TriggerBackupAsync` recibe el `CancellationToken` de la request HTTP, así que cerrar/recargar la pestaña — o un proxy intermedio que corte la conexión, p. ej. el límite de ~100s de Cloudflare en el túnel de producción — puede cancelar rsync/`pg_dump` a medias y dejar la entrada en `Failed`. El front mitiga lo que puede: desactiva el timeout de axios en este POST, avisa con `beforeunload` mientras está en vuelo, y ante una respuesta que nunca llega (sin `errorCode`) no anuncia fallo sino que refresca el historial. Si se quiere fiabilidad real, el backend debería lanzar el backup en segundo plano y responder 202 (y exponer el estado por `history`, que ya lo hace vía `status = Running`).
- El backup diario programado lo dispara `BackupBackgroundService` (hora `Backup:Daily:RunAtHourUtc`, intervalo `IntervalHours`) — esos ajustes **no se exponen** por ninguna API, así que el front no muestra "próxima ejecución" (no se inventa).

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
- **Migración a subida por chunks completada (Fase 8).** La previsión de este documento se cumplió: gracias a que la subida vivía detrás de un único punto (antes `useUploadFile`, ahora `useUploadQueue`, §6.5/§7.4), migrar de un `POST` multipart único al pipeline por chunks no obligó a tocar ningún componente de UI salvo el propio modal de subida (que además cambió por una razón aparte: pasó a leer de un Context global en vez de estado local, para sobrevivir a cerrarse — ver §7.4). `POST /files` (multipart clásico) sigue vivo en el backend sin retirar, pero el front ya no lo usa para nada.
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
| `--row-hover` | `text-primary` al 7% (translúcido) | Sombreado de una fila de lista al pasar el ratón (§6.3, §6.6) |
| `--header-bg` | `#33302A` | Cabecera superior — oscura en AMBOS temas (§6.2) |
| `--header-surface` | `#3E3A33` | Controles dentro de la cabecera (buscador, botón de sidebar) |
| `--header-border` | `#4A453C` | Bordes dentro de la cabecera |
| `--header-text` | `#F0EAE0` | Texto principal sobre la cabecera |
| `--header-muted` | `#A79C8C` | Texto secundario/placeholder sobre la cabecera |

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
| `--row-hover` | `text-primary` al 9% (translúcido) | Sombreado de una fila de lista al pasar el ratón (§6.3, §6.6) |
| `--header-bg` | `#1D1A18` | Cabecera superior — más oscura que `--bg` para que siga leyéndose como barra oscura |
| `--header-surface` | `#272320` | Controles dentro de la cabecera |
| `--header-border` | `#35302B` | Bordes dentro de la cabecera |
| `--header-text` | `#F0EAE0` | Texto principal sobre la cabecera |
| `--header-muted` | `#A79C8C` | Texto secundario/placeholder sobre la cabecera |

**Semántico (excepción deliberada a "un único acento", ver §6.7) — mismo valor en ambos temas:**
| Estado | Fondo | Texto |
|---|---|---|
| Warning | `#FBEFD7` | `#8B6115` |
| Critical/Error | `#F5DCD7` | `#96322A` |
| Info | `--surface` / `--border-light` | `--text-secondary` (neutro, sin tinte propio) |
| Positive | `#DCEBD7` | `#3F6B34` |

`Positive` (verde apagado, a juego con el resto de la paleta) se añadió en la Fase 6 para el punto de estado del ventilador "en marcha" en Monitor (§6.13) — único uso hasta ahora, mismo criterio de "color con propósito" que Warning/Critical (§6.7) Segundo uso: la insignia "Correcto" de los backups (§6.13), con Critical para "Fallido" y un tono neutro para "En curso".

**Hover de listas — `--row-hover` (clase `bg-row-hover`).** El sombreado de fila al pasar el ratón es un token translúcido, no `bg-surface-alt`: el lienzo hundido de `AppShell` (§6.18) es un degradado que termina en `--surface-alt` (claro) y en oscuro `--card` vale lo mismo que `--surface-alt`, así que ese color era invisible sobre el fondo de las listas. Un tinte semitransparente de `--text-primary` se distingue sobre cualquier fondo en ambos temas. Lo usan `TableRow` (Usuarios, Registros, Auditoría) y `FileRow` (Archivos); no uses `hover:bg-surface-alt` para filas de lista.

Reglas generales: radio grande y consistente (`rounded-xl`/`2xl` en cards y modales, `rounded-lg` en botones/inputs), sombras casi imperceptibles (nunca duras ni gradientes), tipografía Inter con jerarquía por peso, espaciado generoso, animaciones Framer Motion cortas (150-250ms, `ease-out`, solo fade/slide/scale sutil — nunca rebote).

### 6.2 Distribución general

- **Cabecera superior fija**, persistente en toda la app y **oscura en ambos temas** (tokens `--header-*`, §6.1): a la izquierda, icono de colapsar/expandir sidebar + logo + nombre + buscador global (solo maqueta por ahora, §6.18); a la derecha, avatar circular con chevron que despliega un menú (nombre + rol, luego Ajustes, Mis permisos, separador, Cerrar sesión — lista pensada para crecer con opciones futuras sin rediseñar).
- **Sidebar debajo de la cabecera**, nunca se oculta del todo: expandida (~190px, iconos + etiquetas) o contraída a un rail de solo iconos (~56px, icono activo con fondo tintado). El icono de la cabecera alterna entre ambos estados.
- Navegación filtrada por `usePermissions().hasModule()` — nunca una lista fija. Sección "Administración" (etiqueta muted, mayúsculas pequeñas) agrupa los módulos de admin, separada de los módulos personales (Inicio, Archivos, Monitor). **Inicio** (§6.18) es la única entrada que no depende de ningún módulo. **Por ahora, Administración muestra Usuarios, Registros y Auditoría** — Roles queda deliberadamente fuera del sidebar mientras esa página está en pausa de diseño (no construir su nav todavía). Cada entrada, sin excepción, solo aparece si `hasModule()` lo confirma para ese usuario (ver matiz de Admin en §7.3) — nunca una lista estática con todo visible.
- Lo específico de cada pantalla (breadcrumb, buscador, botón de acción tipo "Subir") vive en la cabecera del propio panel de contenido, no en la cabecera global — no todas las pantallas lo necesitan.
- **Estadísticas de almacenamiento en la parte inferior del sidebar** (barra de progreso + "X GB de Y GB"), visible solo cuando el sidebar está expandido — se oculta al contraer a rail de iconos, igual que las etiquetas de texto de la navegación. Ver §6.12 para el detalle de datos.

### 6.3 Explorador de archivos

- **Lista única**, carpetas y archivos mezclados, diferenciados por icono — no tarjetas de carpeta separadas de una lista de archivos. Decisión tomada por mantenibilidad: una sola colección ordenable, un solo componente.
- **Carpetas siempre primero**, sin importar el criterio de orden activo. Dentro de las carpetas, orden fijo por nombre (no tienen tamaño en bytes en el contrato actual, así que "Tamaño" no las reordena).
- **Cabeceras de columna ordenables**: Nombre, Tamaño, Fecha — clic para ordenar, clic de nuevo para invertir, con flecha indicando dirección en la columna activa. Nombre y Fecha ordenan todo; Tamaño solo reordena archivos. No hay columna de orden por "Tipo" — el tipo se transmite solo con el icono. Orden hecho en cliente sobre lo ya cargado, sin parámetros de orden en el backend.
- **Toda la fila de una carpeta es clicable para entrar** — sin flecha/chevron de afordancia adicional. Todas las filas (carpetas **y** archivos) se sombrean al pasar el ratón con `--row-hover` (§6.1); solo las carpetas llevan `cursor-pointer`, porque un archivo no se abre al hacer clic (se arrastra o usa su menú).
- **Drag & drop estilo Explorador de Windows**: arrastrar un archivo sobre una fila de carpeta lo mueve dentro (usa `PATCH /files/{id}`, §5.4). Arrastrar un archivo sobre un segmento de la ruta (breadcrumb) lo mueve a esa carpeta ancestro; si se mantiene encima sin soltar (~800ms), navega automáticamente ahí. Implementado con `dnd-kit` (sensores de puntero, no HTML5 DnD nativo) para que funcione bien también en pantallas táctiles. Toda la mecánica visual (hover, resaltado, navegación al mantener encima) se construye igual independientemente de si el endpoint ya existe — ver el interruptor `FILE_MOVE_ENABLED` en §7.5.
- **Soltar o pegar archivos del sistema sube a la carpeta actual** (`useFileDropZone`, `scope: 'window'`, en `FileExplorerPage`): arrastrar archivos desde el explorador del sistema operativo a **cualquier parte de la pantalla** muestra un aviso a pantalla completa (`DropOverlay`, "Suelta para subir a …") y al soltar encola los archivos en esa carpeta sin abrir el panel de subidas (la bandeja, §6.16, y un toast dan el feedback); **Ctrl/Cmd+V** con archivos o una captura en el portapapeles hace lo mismo (las imágenes pegadas con nombre genérico `image.png` se renombran a `Captura AAAA-MM-DD HH.mm.ss.png`; pegar dentro de un campo de texto no sube nada). Es HTML5 DnD nativo y no dnd-kit — dnd-kit solo mueve elementos de la propia página, soltar desde el SO solo existe como eventos `drag*` — y no choca con el arrastre interno de arriba: dnd-kit no emite ningún `dragenter` y el hook ignora todo arrastre que no lleve `Files`. **Las carpetas no se pueden subir todavía** (no hay subida recursiva): se detectan con `webkitGetAsEntry`, se avisa con un toast y se suben el resto de archivos soltados. La misma mecánica (`scope: 'element'`) alimenta la zona de arrastre del modal de Subidas (§6.4), que además de resaltar solo su zona no deja pasar el evento hacia arriba para no duplicar la subida con la zona de pantalla completa.
- **Breadcrumb**: a partir de ~4 niveles de profundidad, colapsa los intermedios en "…", dejando siempre visible el primero y los dos últimos. Los nombres se resuelven con `useFolderPath` (subiendo por `ParentFolderId` vía `GET /folders/{folderId}`, §5.4) cuando la carpeta actual no está ya en el trail de navegación normal (ej. tras un refresco de página o un enlace directo) — con un marcador genérico como fallback solo si esa resolución fallara, nunca como comportamiento normal.
- **Buscador con alcance limitado a la carpeta actual, en cliente, por ahora.** `GET /files/search` ya existe en el backend (§5.4) pero no está integrado todavía — el filtro actual solo opera sobre lo ya cargado de la carpeta actual, con debounce (§11). Verificar la forma real del endpoint antes de sustituir este filtro local, no diseñarlo de memoria.
- **Sin selección múltiple en esta primera versión.** Cada acción (eliminar, descargar, mover) opera sobre un archivo o carpeta a la vez — nada de checkboxes ni Ctrl/Shift-clic todavía. Es una simplificación deliberada; se puede añadir más adelante sin rediseñar la lista.

### 6.4 Modales de esta pantalla

Todos comparten el componente `Modal` (overlay oscuro, tarjeta centrada, radio 16px, cabecera con título + cerrar, pie con botón secundario con borde + botón primario relleno de acento), en su variante **pequeña** (§6.14) — ninguno de estos necesita el tamaño grande:
- **Crear carpeta / renombrar**: input de texto simple + Cancelar/Guardar.
- **Eliminar**: mensaje de confirmación + Cancelar/Eliminar.
- **Subidas**: muestra la carpeta destino arriba ("Subiendo a" + icono + nombre) solo cuando se abre con un destino activo (desde el botón "Subir" de Archivos — ver §6.16 para cuando se abre sin destino), zona de arrastre que admite varios archivos a la vez o selección por clic, cada archivo en su propia fila con nombre/tamaño, carpeta destino y su propio estado (barra de progreso con %, "En cola", check de completado, error o cancelada). Pie con resumen ("X de Y completado"). **Cambio respecto al diseño original de esta sección (Fase 8)**: ya no hay un botón de confirmar el lote ("Subir 3 archivos") — un archivo entra directamente en la cola persistente al soltarlo/elegirlo y arranca en cuanto hay hueco (§7.4); la ventana de "quitarlo antes de subir" que daba ese botón la cubre de sobra poder cancelar cualquier entrada en cualquier momento (en cola o ya subiendo), algo que el diseño anterior no permitía una vez confirmado el lote. Cada fila subiendo muestra bajo la barra "768 MB de 3 GB · 154 MB/s · quedan 15 s" (velocidad media de los últimos 10 s y tiempo restante a ese ritmo, §7.4; solo los bytes mientras aún no hay velocidad medible). Cada fila con más de un chunk (archivos por encima de 32 MiB) tiene un chevron que expande una tira de fragmentos coloreados por estado (pendiente/subiendo/hecho/error) — más detalle que el `%` agregado para archivos grandes. Filas en error o canceladas llevan un botón "Reintentar" (reanuda desde el último chunk confirmado, §7.4) y una `x` para quitarlas de la lista. **Con al menos una fila en error** aparece sobre la lista una línea "N archivos con error" con el botón **"Reintentar todos"** (`retryAllFailed`, §7.4) — solo cuenta las filas en `error`, nunca las `cancelled`: esas las canceló el usuario a propósito, no "fallaron". Mientras la cola está en pausa por rate limit (§7.4) se muestra además un aviso de tono Warning con cuenta atrás.

### 6.5 Subida de archivos — abstracción obligatoria

Toda la lógica de subida vive detrás de un único punto: `useUploadQueue` (`features/files/uploadQueue/`, ver §7.4). Es un pipeline por chunks (§5.4) desde la Fase 8 — antes era un `POST /files` multipart único (`useUploadFile`); la migración no tocó ningún componente de UI salvo el propio modal (§6.4), que cambió por un motivo aparte (pasó a leer de un Context global, no de estado local, para sobrevivir a cerrarse). Si el transporte vuelve a cambiar en el futuro, la regla se mantiene: **solo cambia la implementación interna de `uploadQueue/`**, ningún componente que lo consume debe enterarse.

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

- **Estilo: el de Inicio (§6.18).** Mismo padding de página, hueco de 22px entre bloques, cabecera con línea secundaria + título grande, y tarjetas `FloatCard` (`shared/components/FloatCard.tsx`, radio 14px + `shadow-float`) para las métricas, el gráfico y el cuadro lateral; las métricas usan la tipografía de las `StatCards` de Inicio (etiqueta `text-xs`, cifra de 26px en negrita, barra de 5px). La tarjeta seleccionada conserva borde y fondo de acento; el hover de las no seleccionadas oscurece el borde (no `bg-surface-alt`, invisible en oscuro, §6.1).
- **Cuatro tarjetas superiores actúan como selector**, no solo como resumen: CPU, Memoria, Disco y Temperatura. La tarjeta activa se resalta (borde/fondo en acento); al hacer clic en otra, cambia el gráfico y el cuadro lateral de abajo.
- **El ventilador vive dentro de la tarjeta de Temperatura**, no aparte: un punto de estado (verde en marcha / rojo si no) + rpm, en línea con el valor de temperatura. Al seleccionar esa tarjeta, el cuadro lateral junto al gráfico muestra el detalle completo del ventilador (estado, rpm, modo, PWM).
- **Para CPU/Memoria, ese mismo cuadro lateral queda reservado** con un texto tipo "En desarrollo" — espacio preparado para cuando la API exponga más datos (modelo de CPU, tipo de memoria, etc.), no un hueco vacío sin explicación.
- **Para Disco, el cuadro lateral es el panel de Backups diarios** (`features/system-monitor/backups/`, ver §5.4): insignia del estado del último registro, fecha y tamaño del último backup correcto, botón **"Forzar backup"** y un historial desplazable con estado, fecha, tamaño/duración y — si falló — el error crudo acotado a 2 líneas (completo en el tooltip). En escritorio tiene altura fija de 292px (la del skeleton del Monitor) con el scroll dentro de la lista, para que el gráfico de al lado no se estire con el número de entradas. **Solo se monta para Admin** (el backend exige rol Admin además del módulo, §5.3); un `User` con el módulo ve un aviso informativo y no se dispara ninguna petición. Mientras hay un backup en curso (visto en el historial, o una ejecución manual en vuelo) el panel sondea cada 5s en vez de cada 60s. El botón **Refrescar** de la cabecera también invalida el historial de backups.
- **Chips de rango**: 1h / 24h / 7d / 30d — nunca un selector de fechas libre, para no chocar con que el backend no limita `/system-metrics/history` por su cuenta (§5.4).
- **Actualización cada 60s** (coincide con `SystemMetrics:SampleIntervalMinutes` del backend) vía `refetchInterval` de TanStack Query, **más un botón manual de refrescar** — las dos cosas a la vez, no una u otra. El historial usa el mismo intervalo de 60s en todos los rangos (decisión del usuario: que la ventana esté "viva"), aunque a 30d el backend devuelva ~43.000 filas sin agregar; por eso el gráfico se diezma en cliente (abajo).
- **El gráfico se diezma en cliente** (`downsample.ts`, máx. 500 puntos, conservando el pico de cada tramo y los huecos `null`): recharts no debe recibir decenas de miles de puntos, sobre todo en móvil.
- **Color por umbral, no permanente.** Las tarjetas y sus barras se quedan en el acento único mientras el valor es normal; solo cambian a un tono semántico de aviso (§6.1) al superar un umbral crítico (ej. >85% de uso, temperatura alta). Es una excepción de color puntual y funcional, igual de justificada que las insignias de log aunque Monitor no esté dentro de "Administración".
- **`recharts`** para los gráficos, no SVG a mano — con línea de referencia discontinua marcando el umbral cuando aplique (ej. "Umbral 75°C").

### 6.14 Tamaños de modal — dos variantes estándar, no una talla única

- **Pequeño** (~380px de ancho): confirmaciones y edición de un solo campo — crear carpeta, renombrar, eliminar, editar descripción de un rol.
- **Grande** (~560px de ancho, ~460px de alto mínimo): contenido con secciones o pestañas que va a crecer con el tiempo — el modal de detalle de Usuario (§6.8, pestañas Perfil/Permisos/Límites) es el caso de referencia. **No dimensionar al mínimo necesario hoy** — reservar el tamaño grande desde ahora para que quepan las funcionalidades que se añadan más adelante sin tener que rediseñar el modal cada vez. Cualquier modal futuro con varias secciones (no solo Usuarios) usa esta misma variante grande, para que no haya un tamaño distinto por pantalla.

### 6.15 Error boundaries — convención añadida en Fase 7

No estaba escrito en este documento hasta la auditoría de calidad de la Fase 7, pero ya es convención fija del proyecto: **`shared/components/ErrorBoundary.tsx`** (componente de clase — React no tiene equivalente en hooks) envuelve dos niveles:
- **Uno de app entera**, en `app/App.tsx` alrededor de `<RouterProvider>` — última red de seguridad si algo revienta fuera de cualquier sección (ej. el propio `AuthProvider`).
- **Uno por página de nivel superior**, en `app/router.tsx`, envolviendo el componente de cada ruta con un `sectionLabel` descriptivo (`"el Inicio"`, `"el explorador de archivos"`, `"el Monitor del sistema"`, `"Usuarios"`, `"Registros"`, `"Auditoría"`, `"Ajustes de cuenta"`, `"Mis permisos"`) — así un fallo de render en una pantalla no tira las demás; `AppShell` (cabecera + sidebar) sigue intacto y navegable alrededor del fallback, el usuario no queda atrapado.

El botón "Reintentar" del fallback fuerza un remontaje real del subárbol (vía una `key` que se incrementa), no solo oculta el mensaje de error — si el problema era de estado local roto, un remontaje limpio tiene más opciones de arreglarlo que simplemente volver a renderizar el mismo estado. Sin servicio de reporting de errores todavía (§2: no hay CI/monitoring montado) — de momento el error se registra solo con `console.error`, sería el siguiente paso natural si el proyecto añade telemetría más adelante.

### 6.16 Bandeja de subidas — convención añadida en Fase 8

`UploadTray` (`app/layout/UploadTray.tsx`), montada en `AppShell` junto al modal de Subidas (§6.4) y al `UploadQueueProvider` (§7.4) que da estado a ambos. Es la pieza que hace visible que una subida sigue corriendo aunque se haya cerrado el panel de detalle: una píldora flotante fija abajo a la derecha, visible en **cualquier pantalla** (no solo en Archivos) mientras haya entradas en la cola y el panel esté cerrado — clic para reabrirlo.

- **Contenido según estado**: spinner + "Subiendo N archivos · X% · 12 MB/s" mientras haya algo activo (en cola o subiendo; la velocidad es la suma de la de cada archivo que se está enviando y se omite si aún no se puede medir); si no hay nada activo pero hay errores, icono de alerta + "N archivos con error al subir"; si todo terminó bien, "N archivos subidos".
- **Se oculta** si no hay ninguna entrada en la cola, o si el panel de detalle ya está abierto (evita duplicar el mismo aviso dos veces en pantalla).
- **Exige el módulo `Files`** igual que `StorageWidget` (§6.12) — mismo patrón de guardia explícita con `usePermissions().hasModule()`, aunque en la práctica la cola nunca tiene entradas sin ese módulo (solo se puede añadir un archivo desde una pantalla que ya lo exige).
- **Abrir el panel desde aquí, en vez de desde "Subir" en Archivos, lo abre sin carpeta de destino activa** (`openPanel()` sin argumento) — el panel entra en modo "solo consulta": no admite soltar archivos nuevos (§6.4), solo mostrar/cancelar/reintentar lo que ya hay en curso. Tiene sentido: si el usuario está en Monitor cuando reabre el panel, no hay ninguna carpeta "actual" a la que asignar un archivo nuevo.

### 6.17 Pantalla de login — diseño "2b, archivo apilado" (añadido tras el rediseño)

`features/auth/components/LoginPage.tsx` (formulario, columna derecha) + `LoginShowcase.tsx` (panel izquierdo decorativo). Dos columnas desde `xl` (≥1280px): a la izquierda el eslogan y cuatro tarjetas de datos en abanico con **sombra dura** (desplazada, sin difuminado); a la derecha el formulario. Por debajo de `xl` el panel izquierdo se oculta y el logo pasa encima del formulario (§10).

- **Colores solo con los tokens de §6.1**, nunca los hex del diseño original — así el login funciona igual en claro y en oscuro. Equivalencias: fondo del panel → `--surface-alt`, columna del formulario → `--bg`, tarjetas → `--bg`/`--card`, tinta del botón "Entrar" → `--text-primary` con texto `--bg` (se invierte solo en oscuro), sombra dura del botón → `--accent`, barras/progreso → `--border` y `--accent` (el ámbar del diseño se sustituyó por el acento a media intensidad para mantener el "único acento" de §6.1). Las variantes semitransparentes usan `color-mix(in srgb, var(--token) N%, transparent)`, porque el modificador de opacidad de Tailwind (`/30`) no funciona con colores definidos como `var()`.
- **Excepciones locales al resto de la app** (decididas por el diseño aprobado): campos y botones con `rounded` (4px) en vez de `rounded-lg`, y campos con borde inferior de 2px que pasa a acento al enfocar. Tipografía: se mantiene Inter y la monoespaciada del sistema (`font-mono`) — no se añadió la Public Sans/JetBrains Mono del mockup para no sumar fuentes.
- **El panel izquierdo es ilustración, no datos**: las cifras (2 481 documentos, 48 210 €, gastos, backup) son inventadas a propósito, por eso va `aria-hidden`. Gastos/Inversiones siguen siendo módulos fantasma (§5.3).
- **"Usuario", no "Usuario o correo"**: el mockup decía "Usuario o correo", pero `LoginDto` solo tiene `Username` (verificado en `HomeDB`, `AuthService.LoginAsync`) — la etiqueta no promete lo que el backend no hace.
- **Píldora del servidor**: muestra el host de `VITE_API_URL`. El punto verde es decorativo: no hay comprobación de salud real todavía (`GET /healthCheck` existiría para hacerla).
- **PENDIENTE (backend)** — son solo maqueta, sin lógica; al pulsarlos muestran el toast "Todavía no disponible" (la casilla Recordarme solo se marca/desmarca): **¿La has olvidado?** (no hay recuperación de contraseña), **Recordarme · 30 días** (el refresh token dura 7 días y no hay sesión "persistente" opcional, §5.2 — el texto "30 días" es del diseño, no un comportamiento real), **Entrar con clave de acceso** (passkeys) y **Otro servidor** (el front apunta a un único `VITE_API_URL`). Cuando el backend los soporte, retomar en `LoginPage.tsx` (los comentarios `PENDIENTE (CLAUDE.md §6.17)` marcan cada punto).
- Sin cambios en la lógica: sigue siendo `loginSchema` + react-hook-form, mutation con botón deshabilitado y "Entrando…" (§11), error de credenciales como texto del formulario (no toast, §6.11), mostrar/ocultar contraseña con el icono de ojo compartido (§11 — el mockup mostraba el texto "Mostrar", se mantuvo el icono por coherencia con el resto de la app).

### 6.18 Pantalla de Inicio — diseño "1c, lienzo hundido" (añadido tras el rediseño)

`features/home/HomePage.tsx`, ruta `/` — **es la primera pantalla tras el login** (sustituye al antiguo `HomeRedirect`, que saltaba al primer módulo con acceso). No exige ningún módulo: cada tarjeta resuelve por su cuenta si el usuario puede ver sus datos y, si no, lo dice ("Módulo no activado") sin disparar peticiones que darían 403 (guard de módulo en el componente externo, hook en el interno). Un usuario sin ningún módulo con pantalla real sigue viendo el estado vacío informativo de §6.9. La raíz del explorador de archivos pasó de llamarse "Inicio" a "Archivos" en el breadcrumb, para no chocar con esta pantalla.

- **Shell compartido con la pantalla** (afecta a toda la app, no solo a Inicio): cabecera superior **oscura en ambos temas** con tokens propios `--header-*` (§6.1), degradado radial "lienzo hundido" detrás del sidebar y del contenido (`AppShell`, hecho con `--card`/`--surface`/`--surface-alt`), sidebar transparente con la entrada activa **rellena de acento**, y al pie del sidebar el widget de almacenamiento (ahora como tarjeta) y un bloque de usuario con acceso a Ajustes. Las tarjetas "flotantes" usan `FloatCard` + `shadow-float` (`tailwind.config.ts`, sombra de dos capas derivada de `--text-primary`).
- **Datos reales, hoy**: saludo y fecha (hora local del navegador, `greeting.ts`/`formatLongDate`), **Archivos** (`GET /statistics/storage`: nº de archivos, carpetas y tamaño total) y **Estado del servidor** (`GET /system-metrics/last-metric`: CPU, memoria y temperatura, con el mismo color por umbral que el Monitor, §6.13; solo con el módulo `SystemMonitor`; `MetricNotFound` = "Todavía no hay métricas"). **Atajos** reales: "Subir archivo" (abre el panel de subidas con destino = raíz) y "Explorar archivos".
- **Sin datos falsos — lo que el diseño mostraba y NO existe en el backend**: las altas "esta semana" de Archivos (no hay histórico), las tarjetas de **Gastos** y **Cartera** (módulos fantasma, §5.3: se deja la tarjeta como base del layout con "—" y "Próximamente"), la **Actividad reciente** (no hay endpoint de actividad propia: el log de auditoría es solo para el módulo `AuditLogs` y global; se deja el hueco con un aviso y sin enlace "Ver todo"), los **días sin reiniciar** del servidor (el backend no expone uptime; en su lugar, enlace "Ver monitor"), el **⌘K** del buscador (no hay atajo ni búsqueda global) y "Nueva carpeta en Documentos" (crear carpetas vive dentro del explorador; en su lugar "Explorar archivos").
- **PENDIENTE (backend/otros módulos)** — maqueta sin lógica, con toast "Todavía no disponible": buscador global de la cabecera (`GET /files/search` existe pero no está integrado, §5.4), "Nuevo gasto" y "Ver cartera". Cada punto lleva un comentario `PENDIENTE (CLAUDE.md §6.18)`.
- Mismas excepciones de colores y tipografía que el login (§6.17): solo tokens de §6.1, Inter y `font-mono` del sistema en lugar de Public Sans/JetBrains Mono.

## 7. Patrones de código

### 7.1 Data fetching
**Estado de error vs. dato disponible**: en TanStack Query v5 un refetch fallido deja `status: 'error'` con el último `data` aún presente. Las pantallas con sondeo o refetch al volver a la ventana (Monitor, tarjetas de Inicio, widget de almacenamiento, explorador de archivos, panel de backups) deciden el estado de error con `query.data === undefined`, **no** con `query.isError`, para que un fallo puntual no sustituya contenido válido por un estado vacío.

Todo lo que sea estado de servidor pasa por TanStack Query. Un hook por recurso dentro de la feature correspondiente (ej. `features/files/api.ts` exporta `useFiles(folderId)`, `useMoveFile()`, etc.), nunca `fetch`/`axios` suelto dentro de un componente.

### 7.2 Sesión (`shared/hooks/useAuth`)
Contexto de React: access token en memoria (solo para decodificar claims, ver §5.2), claims decodificados (`userId`, `username`, rol), funciones `login`/`logout`. Toda request va con `withCredentials: true`; nunca se adjunta un header `Authorization` manual.

### 7.3 Permisos (`shared/hooks/usePermissions`)
Envuelve `GET /users/me/permissions` con TanStack Query. Expone `hasModule(module: AppModule)` e `isAdmin` (derivado del claim de rol). Toda comprobación de acceso —guards de ruta y botones de acción individuales— pasa por aquí, nunca se reimplementa la lógica de "¿puedo ver esto?" en una página suelta. **`hasModule()` debe devolver `true` automáticamente si `isAdmin` es `true`, sin mirar los flags reales** — replica el comportamiento del backend (§5.3: el rol Admin pasa siempre, sin comprobar módulo). Si no se replica esto, un Admin podría ver un sidebar incompleto por un dato de permisos que en su caso ni siquiera debería consultarse. **Validado en julio 2026**: cualquier usuario sin fila de permisos en BD (no solo Admins, aunque solo se ha observado en Admins porque son los únicos insertados a mano) da 404/`PermissionsNotFound` en `GET /users/me/permissions` — sin upsert, tampoco el `PATCH` crea la fila si no existe. Por eso la query debe ir con `enabled: !isAdmin` (nunca dispararse para un Admin), no solo ignorar el resultado si llega.

### 7.4 Subida de archivos (`features/files/uploadQueue/`) — pipeline por chunks, Fase 8

Ver §6.5 — es la única vía para subir archivos en todo el proyecto. Tres piezas, cada una con su responsabilidad:

- **`pipeline.ts`** — funciones puras y testeadas (`pipeline.test.ts`, §9) más las llamadas HTTP a los 4 endpoints de §5.4: `computeChunkPlan` (cuántos chunks y de qué tamaño exacto cada uno), `aggregateProgress` (% sobre el tamaño TOTAL del archivo, no del chunk en curso — evita saltos bruscos en la barra), `backoffDelayMs`, y `initUploadSession`/`uploadChunkWithRetry`/`getUploadStatus`/`completeUploadSession`.
  - **`CHUNK_SIZE_BYTES = 32 MiB`** — fijo. Es el mayor potencia de 2 bajo el techo duro del backend: `[RequestSizeLimit(35_000_000)]` en `UploadController.ReceiveChunkAsync` son 35 MB **decimales** (33,4 MiB) por petición, y sobre ese cuerpo cuenta también el sobre multipart. 32 MiB = 33.554.432 B deja ~1,4 MB de margen; 33 MiB ya solo ~0,4 MB. Antes eran 24 MiB; subir a 32 reduce un tercio el nº de peticiones (menos cupo de rate limit y menos viajes), pero más allá el beneficio es marginal y cada fallo repite más datos. `pipeline.test.ts` comprueba el invariante `CHUNK_SIZE_BYTES + 1 MiB <= BACKEND_CHUNK_REQUEST_LIMIT_BYTES`, para que nadie lo suba por encima y provoque un 413 en toda subida multichunk. Si el backend cambia ese límite, actualizar `BACKEND_CHUNK_REQUEST_LIMIT_BYTES` y revisar este valor.
  - **`MAX_PARALLEL_CHUNK_UPLOADS = 4` — EL ÚNICO MANDO del paralelismo.** Tope de chunks en vuelo a la vez en **toda la cola** (suma de todos los archivos); un archivo grande puede usarlos todos. Subirlo o bajarlo es tocar solo esa constante en `pipeline.ts`; con `1` se vuelve al comportamiento secuencial anterior. No es configurable por el usuario a propósito: es una decisión de despliegue (Raspberry Pi detrás de un túnel de Cloudflare), no una preferencia. Valores altos solo ayudan si el enlace NO está ya saturado con un chunk; cargan más el disco del servidor (cada chunk se escribe a un temporal y luego se mueve) y, en HTTP/1.1, el navegador solo abre 6 conexiones por host — mantenerlo por debajo de ~6 deja hueco al resto de peticiones de la app. Implementación (`concurrency.ts`, probada en `concurrency.test.ts`): `AsyncSemaphore` (cola FIFO; los `acquire` se abortan al cancelar) compartido por todas las subidas + `runWithConcurrency`, un pool de hasta N workers por archivo que toman el siguiente chunk pendiente en orden. **Semántica de fallo**: al primer fallo definitivo de un chunk (tras sus reintentos) no se arranca ninguno más y se aborta el `signal` de los que van en vuelo; el pool espera a que todos terminen (sin peticiones huérfanas) y propaga ese primer error real, no los `AbortError` colaterales. El chunk que falló queda `error`; los abortados de rebote vuelven a `pending`; los ya confirmados siguen `done` y se reanudan con `GET /status` (`retryEntry`). **El progreso** (`aggregateProgress`) se calcula desde un array de bytes enviados por chunk, no desde "los N primeros": con paralelismo y al reanudar, los chunks terminados no son un prefijo. `complete` solo se llama cuando el pool ha terminado todos los chunks.
  - **`MAX_CONCURRENT_UPLOADS = 2`** — cuántos archivos tienen sesión activa a la vez. Es independiente del paralelismo de chunks: el tope de chunks en vuelo es global, así que más archivos simultáneos no multiplican las peticiones, solo se reparten los mismos huecos. Protege el rate limit global del backend (`RateLimiterExtensions.cs`, compartido con el resto de la app): con muchos archivos pequeños (3 peticiones cada uno) el cupo se agota igualmente, de ahí la pausa global de abajo.
  - **Reintentos por chunk** (`uploadChunkWithRetry`): hasta 3 intentos con backoff exponencial (500ms/1s/2s) antes de propagar el error — un chunk suelto puede fallar por un corte de red momentáneo sin perder el archivo entero. **Un 429 no cuenta como intento ni se reintenta aquí** (ver "Pausa global por rate limit" abajo): el backoff de 0,5-2s no sirve contra un cupo que tarda ~60s en reponerse. Un error de `init` (`FileTooLarge`, `StorageLimitExceeded`, etc.) no se reintenta — es una respuesta determinista del backend, no algo transitorio.
  - **Pausa global por rate limit** (`uploadQueue/rateLimit.ts`, probada en `rateLimit.test.ts`): todas las peticiones de la cola (`init`, chunk, `status`, `complete`) cuelgan del mismo `RateLimitGate`, un semáforo compartido. Cuando UNA recibe un 429 (`isRateLimitError`: código 1009 **o** estado HTTP 429, por si lo genera un proxy sin envelope), el gate pausa TODAS las demás durante `Retry-After` (por defecto 60s) y la petición se repite sola al terminar la pausa, sin dar el archivo por fallido; `withRateLimitRetry` se rinde y propaga el 429 tras 5 pausas seguidas (~5 min). **Por qué existe**: el backend tiene un token bucket global de 500 req/min por IP (`RateLimiting:Global` de `appsettings.json`; este documento decía 100, desactualizado) (`RateLimiterExtensions.cs`, repuesto de golpe cada 60s, compartido con TODA la app y con `UploadController` entero bajo la política `Global`); un archivo pequeño cuesta 3 peticiones (`init`+chunk+`complete`), así que un lote grande lo agota sin remedio. Antes de este gate, cada archivo fallaba por su cuenta tras ~1,5s de reintentos y, como cada fallo liberaba un hueco de `MAX_CONCURRENT_UPLOADS`, arrancaba el siguiente archivo en cola, cuyo `init` también recibía 429 y fallaba al instante: la cola entera se quemaba en segundos con todos en `error`. El Provider expone `rateLimitedUntil` para que el modal muestre el aviso con cuenta atrás. **`Retry-After` no es legible desde el navegador hoy**: el backend lo envía (`60`) pero `CorsExtensions.cs` no lo lista en `WithExposedHeaders`, así que cross-origin `retryAfterMs` llega `null` y se usa el valor por defecto de 60s, que coincide con el `ReplenishmentPeriod` configurado. Si algún día se expone la cabecera, el front ya la lee (`parseRetryAfterMs` en `client.ts`).
  - **Reintentar todos** (`retryAllFailed`): pasa a `queued` todas las entradas en `error` en una sola actualización de estado, conservando `sessionId` igual que `retryEntry` (reanudan con `GET /status`); el planificador las va arrancando de `MAX_CONCURRENT_UPLOADS` en `MAX_CONCURRENT_UPLOADS`. No incluye las `cancelled`.
  - **Detección de conexión colgada por stall, no por duración total** (Fase 8b): `shared/api/client.ts` pone un `timeout: 30_000` por defecto en la instancia de axios, para que un corte de red "silencioso" en una petición JSON normal (login, listar, mutations) falle rápido en vez de quedarse colgado sin fallar nunca. Un chunk de 32 MiB puede tardar legítimamente más de 30s en una conexión lenta sin que eso sea un fallo, así que `sendChunk` desactiva ese timeout (`timeout: 0`) y en su lugar usa `STALL_TIMEOUT_MS = 20_000`: un temporizador que se reinicia en cada evento `onUploadProgress` real y aborta la petición solo si pasan 20s sin que avance ni un byte — eso sí distingue "lento pero avanzando" de "realmente colgado". `downloadFile` (`features/files/api.ts`) desactiva el mismo timeout de 30s por el mismo motivo (una descarga grande también puede tardar más).
  - **`complete` va sin timeout y una sesión muerta se descarta** (revisión tras subir 25GB): `completeUploadSession` usa `timeout: 0` — el backend solo responde cuando ha concatenado los chunks y copiado el archivo final (minutos con decenas de GB) y, como usa el `CancellationToken` de la request, si el front cortaba a los 30s por defecto el servidor cancelaba la sesión y borraba todos los chunks. Si aun así una entrada falla con `UploadSessionNotActive` (1020) o `UploadSessionNotFound` (1018), `runPipeline` descarta su `sessionId` para que "Reintentar" empiece una subida nueva en vez de reanudar con `GET /status` una sesión que ya no sirve. **Riesgo no arreglable desde el front**: detrás del túnel de Cloudflare (~100s por request) un `complete` largo puede cortarse igualmente (524) y cancelar la sesión; la solución real es que el backend ensamble en segundo plano y devuelva 202 (igual que el riesgo de los backups, §5.4).
  - **Extensiones: pre-validación al encolar** (`allowedExtensions.ts`, probada en `allowedExtensions.test.ts`): `addFiles` rechaza con un toast los archivos cuya extensión no está en la lista blanca del backend (§5.4), que solo la valida al final, en `complete`. Misma regla que `Path.GetExtension` de .NET y comparación sin distinguir mayúsculas. Es una copia de la lista del backend (el backend sigue siendo la fuente de verdad): si se amplía allí, ampliarla aquí. No pre-valida los magic bytes ni el tamaño máximo (`init` ya valida este último al principio).
  - **`addFiles(files, target?)` devuelve cuántos encoló**: con `target` (soltar/pegar en Archivos, §6.3) sube a esa carpeta sin necesitar el panel abierto; sin él usa el destino activo del panel (`activeTarget`). Sin ninguno no hace nada (devuelve 0).
  - **Velocidad y tiempo restante** (`speed.ts`, probada en `speed.test.ts`): `SpeedTracker` mide bytes/s sobre una ventana deslizante de 10 s y `estimateRemainingMs` da el tiempo a ese ritmo. Cuenta bytes **transmitidos** (acumulado monótono), no confirmados: cuando un chunk se reintenta el total "subido" retrocede, pero esos bytes sí viajaron, y con el total directo la velocidad se hundiría a 0 en cada reintento. Se mide hasta "ahora", no hasta la última muestra, para que la velocidad caiga sola si la subida se atasca (pausa por rate limit, red caída) en vez de congelarse. `runPipeline` la refresca con un `setInterval` de 1 s (no por evento de progreso: si no llegan eventos el valor se quedaría congelado) y lo limpia en el `finally`; `UploadQueueEntry` lleva `uploadedBytes` y `speedBytesPerSec` (`null` = aún no medible).
  - **Reintento automático al recuperar conexión** (Fase 8b): un listener de `window.addEventListener('online', ...)` en el propio Provider reintenta automáticamente cualquier entrada en `error` cuyo `errorCode` sea `null` — es decir, cuya última falla nunca llegó a recibir una respuesta real del backend (corte de red, el stall de arriba, o un timeout), capturado en el `catch` de `runPipeline` vía `toApiError(error).errorCode`. Un error con un código real (`FileTooLarge`, `StorageLimitExceeded`...) es un rechazo explícito del servidor — no se reintenta solo porque volver a intentarlo sin que el usuario cambie nada seguiría fallando igual; esas entradas se quedan esperando el botón "Reintentar" manual (§6.4).
- **`UploadQueueContext.tsx`** — el `UploadQueueProvider` (Context de React) y el hook `useUploadQueue`. Se monta **una única vez en `AppShell`** (§6.2), nunca dentro del propio modal — es la segunda excepción documentada a "el único estado global manual es auth" (§3), justificada porque una subida de un archivo grande debe seguir corriendo aunque el usuario cierre el panel de detalle (§6.4) o navegue a otra pantalla; una `mutation` de TanStack Query atada al ciclo de vida de un componente no da eso por sí sola. Gestiona: la lista de entradas (`entries`), qué carpeta es el destino activo para archivos nuevos (`activeTarget`, ver §6.16 para cuándo es `null`), el estado abierto/cerrado del panel, y una cola interna que promueve entradas de `queued` a `uploading` respetando `MAX_CONCURRENT_UPLOADS` cada vez que la lista cambia.
  - **Reanudación tras error** (`retryEntry`): si la entrada ya tenía `sessionId` (llegó a hacer `init` con éxito antes de fallar), reintentar llama primero a `GET /status` (§5.4) para saber qué chunks confirmó el servidor y solo reenvía los que faltan — no repite un archivo de 500MB entero por un fallo en el chunk 19 de 20.
  - **Cancelar** (`cancelEntry`): aborta la petición en curso vía `AbortController` y no programa más chunks para esa entrada. Sin endpoint de cancelación en el backend todavía (§5.4) — la sesión queda huérfana server-side hasta que exista ese endpoint o se enganche la limpieza automática.
  - **Aviso de `beforeunload`** mientras haya algo `queued`/`uploading`: cerrar el **panel** nunca pierde nada (el Provider sigue vivo en AppShell), pero cerrar o recargar la **pestaña del navegador** sí — de ahí el aviso nativo. Reanudar una subida entre recargas de página (persistiendo `sessionId` y retomando con `GET /status` igual que en un reintento) queda fuera de alcance por ahora — es la mejora natural si hiciera falta más adelante, ya que la pieza que la habilitaría (`GET /status`) ya existe y ya se usa para el caso más acotado de reintento dentro de la misma sesión del navegador.
- **`types.ts`** — `UploadQueueEntry`, `ChunkStatus`, `UploadTarget`.

Invalidación de caché: al completar una entrada, invalida `filesKeys.contents(entry.folderId)` y `filesKeys.storageUsage` (§7.8) — igual que hacía la `useUploadFile` original, solo que ahora vive dentro del propio `UploadQueueProvider` en vez de en una `mutation` de `features/files/api.ts`.

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

**Entorno de tests**: `vite.config.ts` fija `test.env.VITE_API_URL`, porque `shared/env.ts` valida esa variable al importarse y casi todos los módulos de red lo importan — los tests no dependen de que exista un `.env` local. `client.test.ts` cubre además el interceptor de 401 (refresh compartido, sin expulsión por errores ajenos) con un adaptador de axios falso.

**`features/files/uploadQueue/pipeline.test.ts`** (Fase 8) es el caso de referencia de "lógica no visual" dentro de una pieza que por lo demás está muy pegada a red/estado: `computeChunkPlan`, `aggregateProgress` y `backoffDelayMs` (§7.4) son funciones puras, sin `api` ni React de por medio, así que se testean directo sin mockear axios ni renderizar nada — `rateLimit.test.ts` cubre `RateLimitGate`/`withRateLimitRetry` con fake timers (pausa compartida, reanudación, cancelación mientras espera, tope de pausas); el resto del pipeline (las llamadas HTTP y el propio `UploadQueueContext`) no tiene test todavía, igual que el resto de componentes visuales de la app. `concurrency.test.ts` cubre `AsyncSemaphore` y `runWithConcurrency` (límite por lote y global, orden FIFO, aborto de esperas, semántica de primer fallo, sin tareas huérfanas) con tareas simuladas, y `pipeline.test.ts` incluye el invariante del tamaño de chunk contra el límite del backend (§7.4). `useFileDropZone.test.tsx` cubre el hook de soltar/pegar disparando eventos nativos sobre `document` (contador de entradas/salidas, filtro por `Files`, carpetas, pegar, zona de elemento sin duplicar con la de ventana), `fileDrop.test.ts` sus utilidades puras, `speed.test.ts` la velocidad/ETA y `allowedExtensions.test.ts` la lista blanca. El orquestador `UploadQueueContext` en sí se verificó con una prueba de integración desechable contra un servidor simulado (800 chunks, fallo y reanudación, cancelación, dos archivos a la vez) y no se versionó, por la regla de no tener tests de componentes (arriba).

## 10. Móvil — app nativa aparte, no Capacitor

El móvil será una **app nativa en un proyecto propio, fuera de este repo** — no forma parte del alcance de `HomeDB_FrontEnd/`, se planificará y construirá en otra conversación. Por eso esta web se sigue diseñando responsive y táctil desde el primer componente (§1, §3): todo probado a un ancho estrecho (~375px), nada de comportamiento exclusivo de ratón/teclado como única vía, drag & drop con `dnd-kit` por eventos de puntero (§6.3, §7.5) — sigue siendo la vía correcta para que la web funcione bien desde el navegador de un móvil, con o sin empaquetado nativo.

**Nota histórica:** en julio 2026 se probó empaquetar esta misma web con Capacitor para Android. Se encontraron problemas reales de CORS y `SameSite=Strict` específicos del origen del WebView (`https://localhost`, distinto del dominio real de la API) que bloqueaban la persistencia de la sesión. Se decidió revertir ese empaquetado a favor de una app nativa aparte, que evita ese problema de raíz al no depender de políticas de origen de navegador.

## 11. Detalles de experiencia de usuario (calidad de vida)

Cosas que un front bien cuidado no debería omitir, aunque no se mencionen explícitamente para cada pantalla nueva que se construya:

- **Confirmación antes de cualquier acción destructiva o irreversible** (borrar archivo, carpeta, usuario; también forzar un backup, porque descarta la copia más antigua antes de empezar, §5.4). Ya cubierto por el modal de confirmación de §6.4, pero es una regla general: cualquier acción irreversible que se añada en el futuro pasa por el mismo patrón, nunca se ejecuta con un solo clic sin confirmar.
- **Mostrar/ocultar contraseña** (icono de ojo) en todos los campos de contraseña: login, cambiar contraseña, crear usuario en `admin-users`.
- **Evitar doble envío.** El botón de acción de cualquier formulario/mutation se deshabilita y muestra estado de carga (spinner o texto tipo "Subiendo…") mientras la petición está en curso — nunca se puede disparar la misma mutation dos veces por un doble clic.
- **Aviso de cambios sin guardar.** Si un modal de edición (perfil, permisos, límites) tiene cambios sin guardar (dirty-checking) y el usuario intenta cerrarlo, confirma antes de descartar.
- **Gestión de foco en modales.** Al abrir, foco automático en el primer campo; el foco queda atrapado dentro del modal mientras está abierto; al cerrar, vuelve al elemento que lo abrió. Es accesibilidad de teclado, no solo estética.
- **Alternativa sin arrastrar para mover archivos.** Además del drag & drop (§6.3), cada fila tiene una acción "Mover a…" en su menú contextual/kebab que abre un selector de carpeta. Necesaria para quien navega por teclado y para pantallas táctiles pequeñas donde arrastrar es menos cómodo.
- **Renombrar preselecciona el nombre sin la extensión** en el input (como Explorer/Finder), para no arriesgarse a machacar la extensión sin querer.
- **Evitar que el navegador abra un archivo si se suelta fuera de la zona de subida.** `usePreventBrowserFileOpen` (montado en `AppShell`, así que vale en toda la app y no solo en Archivos) hace `preventDefault` en `dragover`/`drop` a nivel de documento, para que arrastrar un archivo por error sobre la ventana no navegue fuera de la app. Solo actúa sobre arrastres que llevan `Files`: texto y enlaces siguen soltándose con normalidad en los campos de formulario.
- **Feedback de "Copiado"** (micro-toast o tooltip) al usar el botón de copiar del detalle de logs (§6.8).
- **Buscador con debounce** (`shared/hooks/useDebounce`) en el filtro local de Archivos y en los buscadores de las tablas de Admin, para no refiltrar en cada tecla.
