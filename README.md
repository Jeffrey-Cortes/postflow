# Postflow

Backend para recibir material desde Telegram, crear borradores de publicaciones, validarlos, obtener aprobación humana y registrar su publicación.

## Desarrollo local

1. Copia `.env.example` como `.env` y ajusta sus valores si es necesario.
2. Inicia PostgreSQL: `docker compose up -d postgres`.
3. Instala dependencias: `pnpm install`.
4. Aplica las migraciones: `pnpm prisma:migrate`.
5. Ejecuta la API: `pnpm start:dev`.

`GET /health` devuelve el estado básico del servicio. La conexión a PostgreSQL no se abre hasta que un módulo de dominio la necesite.

## Webhook de Telegram

La Fase 2 expone `POST /webhooks/telegram`. Guarda texto, captions, imágenes y documentos; deduplica por `update_id` y agrupa álbumes por `chat_id` + `media_group_id`. Solo acepta remitentes activos registrados en la tabla `User`. Los archivos se limitan por `MAX_TELEGRAM_FILE_SIZE_BYTES` (10 MiB por defecto).

En producción configura `TELEGRAM_WEBHOOK_SECRET` y registra el mismo valor al crear el webhook de Telegram. Las actualizaciones no reconocidas se confirman sin persistirse para evitar reintentos innecesarios.

## Referencias históricas y generación mock

`HistoryService` importa publicaciones normalizadas por organización y plataforma. Durante el MVP recupera hasta tres ejemplos mediante similitud léxica determinista; no copia su texto ni usa embeddings todavía. `DraftGenerationService` usa esas referencias para crear y validar borradores Facebook/X mediante un generador mock o OpenAI cuando se configura la clave.

El importador admite CSV con las columnas obligatorias `platform,text` y las opcionales `externalId,publishedAt,imageUrls`. `imageUrls` acepta varias URLs separadas por `|`; se aceptan `FACEBOOK`, `X` y `TWITTER` como plataforma. Exporta desde Excel como **CSV UTF-8** para conservar emojis; también se acepta la marca UTF-8 que Excel agrega al inicio del archivo.

## Revisión humana

Las acciones de Telegram usan callbacks compactos vinculados a un borrador específico. Cada acción se verifica contra un borrador propuesto que pertenezca al usuario solicitante; las acciones obsoletas o repetidas no modifican el flujo. Aprobar ejecuta únicamente el publicador simulado para Facebook/X. Editar abre una sesión de 15 minutos para guardar una nueva versión; regenerar crea una nueva versión solo para la plataforma elegida.

Los borradores de X pueden ser un post único o un hilo de hasta cinco partes. Cada parte se guarda con su posición y conteo de caracteres, y se presenta en orden para revisión. Al editar un hilo por Telegram, separa cada parte con una línea que contenga únicamente `---`.

## Configuración

Las variables de entorno se validan al iniciar. Para desarrollo, el almacenamiento es local. `STORAGE_DRIVER=s3` exige `S3_BUCKET`; las credenciales AWS no se guardan ni se versionan. En producción, Telegram exige `TELEGRAM_BOT_TOKEN` y `TELEGRAM_WEBHOOK_SECRET`.

## MVP: videos y publicacion manual

El MVP admite texto, imagenes y videos desde Telegram. Con solo imagenes, la IA puede seleccionar el material propuesto. Si hay algun video, el bot entrega los textos pero exige seleccion humana del material; no analiza fotogramas de video.

`PUBLISHING_MODE=manual` es el valor predeterminado: al aprobar, el bot entrega el paquete para copiar, pegar y adjuntar manualmente. `PUBLISHING_MODE=mock` existe solo para probar el workflow y nunca publica contenido real.

## Calidad

```bash
pnpm prisma:generate
pnpm test -- --runInBand
pnpm test:e2e -- --runInBand
pnpm build
pnpm lint
```
