# Petsfounds

App comunitaria para publicar, buscar y moderar mascotas perdidas o encontradas.

## Stack

- Node.js
- Neon PostgreSQL
- Cloudinary
- Leaflet + OpenStreetMap

## Variables de entorno

Configura estas variables en local o en tu hosting:

```env
DATABASE_URL=postgresql://...
PORT=3000
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
ADMIN_PASSWORD=...
```

## Desarrollo local

```powershell
npm install
npm start
```

La app quedara disponible en `http://localhost:3000`.

## Deploy en Render

1. Sube este proyecto a GitHub.
2. En Render elige `New +` -> `Blueprint`.
3. Selecciona el repositorio.
4. Render detectara `render.yaml` y creara el servicio web.
5. Carga estas variables:

```text
DATABASE_URL
CLOUDINARY_CLOUD_NAME
CLOUDINARY_API_KEY
CLOUDINARY_API_SECRET
ADMIN_PASSWORD
```

6. Ejecuta el deploy.

## Panel admin

El panel de moderacion vive en:

```text
/admin.html
```

Usa la clave definida en `ADMIN_PASSWORD`.
