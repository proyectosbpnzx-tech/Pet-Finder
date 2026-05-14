const http = require("http");
const fs = require("fs/promises");
const path = require("path");
const crypto = require("crypto");
const { DatabaseSync } = require("node:sqlite");
const { neon } = require("@neondatabase/serverless");
const { v2: cloudinary } = require("cloudinary");

const root = __dirname;
loadEnvFile(path.join(root, ".env"));

const dataDir = path.join(root, "data");
const uploadDir = path.join(root, "uploads");
const databaseFile = path.join(dataDir, "petsfounds.sqlite");
const port = Number(process.env.PORT || 3000);
const databaseUrl = process.env.DATABASE_URL;
const adminPassword = process.env.ADMIN_PASSWORD || "admin123";
const hasCloudinaryConfig = Boolean(
  process.env.CLOUDINARY_CLOUD_NAME &&
  process.env.CLOUDINARY_API_KEY &&
  process.env.CLOUDINARY_API_SECRET
);
let database;
let sql;

if (hasCloudinaryConfig) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
  });
}

function loadEnvFile(filePath) {
  try {
    const content = require("fs").readFileSync(filePath, "utf8");
    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) {
        continue;
      }
      const [key, ...valueParts] = trimmed.split("=");
      const value = valueParts.join("=").trim().replace(/^["']|["']$/g, "");
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  } catch {
    // Local .env is optional.
  }
}

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".svg": "image/svg+xml"
};

const samplePets = [
  {
    id: "sample-toby",
    status: "lost",
    name: "Toby",
    species: "Perro",
    area: "Caballito",
    crossStreet: "Parque Rivadavia",
    date: "2026-05-03",
    color: "Dorado",
    contact: "11 5555-0182",
    description: "Mediano, lleva collar azul y responde a su nombre. Se asusta con ruidos fuertes.",
    photo: "https://images.unsplash.com/photo-1552053831-71594a27632d?auto=format&fit=crop&w=900&q=80",
    createdAt: "2026-05-03T15:00:00.000Z"
  },
  {
    id: "sample-gato-villa-crespo",
    status: "found",
    name: "Sin identificar",
    species: "Gato",
    area: "Villa Crespo",
    crossStreet: "Malabia y Corrientes",
    date: "2026-05-04",
    color: "Gris",
    contact: "rescate@petsfounds.test",
    description: "Gato joven muy sociable encontrado cerca de una plaza. Tiene collar rojo sin chapita.",
    photo: "https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?auto=format&fit=crop&w=900&q=80",
    createdAt: "2026-05-04T12:00:00.000Z"
  },
  {
    id: "sample-mora",
    status: "lost",
    name: "Mora",
    species: "Gato",
    area: "Belgrano",
    crossStreet: "Barrancas",
    date: "2026-05-01",
    color: "Negro",
    contact: "mora.vuelve@example.com",
    description: "Tiene una mancha blanca pequena en el pecho. Es timida y suele esconderse.",
    photo: "https://images.unsplash.com/photo-1573865526739-10659fec78a5?auto=format&fit=crop&w=900&q=80",
    createdAt: "2026-05-01T18:00:00.000Z"
  }
];

async function ensureStorage() {
  await fs.mkdir(dataDir, { recursive: true });
  await fs.mkdir(uploadDir, { recursive: true });

  if (databaseUrl) {
    sql = neon(databaseUrl);
    await sql`
      CREATE TABLE IF NOT EXISTS pets (
        id TEXT PRIMARY KEY,
        status TEXT NOT NULL CHECK (status IN ('lost', 'found')),
        name TEXT NOT NULL,
        species TEXT NOT NULL CHECK (species IN ('Perro', 'Gato', 'Otro')),
        area TEXT NOT NULL,
        cross_street TEXT,
        date TEXT NOT NULL,
        color TEXT NOT NULL,
        contact TEXT NOT NULL,
        description TEXT NOT NULL,
        photo TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `;
    await sql`CREATE INDEX IF NOT EXISTS idx_pets_status ON pets(status)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_pets_species ON pets(species)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_pets_area ON pets(area)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_pets_created_at ON pets(created_at)`;
    await sql`ALTER TABLE pets ADD COLUMN IF NOT EXISTS case_status TEXT NOT NULL DEFAULT 'active'`;
    await sql`ALTER TABLE pets ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION`;
    await sql`ALTER TABLE pets ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION`;
    await sql`ALTER TABLE pets ADD COLUMN IF NOT EXISTS owner_token_hash TEXT`;
    await sql`ALTER TABLE pets ADD COLUMN IF NOT EXISTS report_count INTEGER NOT NULL DEFAULT 0`;
    await sql`ALTER TABLE pets ADD COLUMN IF NOT EXISTS is_hidden BOOLEAN NOT NULL DEFAULT false`;
    await sql`CREATE INDEX IF NOT EXISTS idx_pets_case_status ON pets(case_status)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_pets_is_hidden ON pets(is_hidden)`;

    const [{ total }] = await sql`SELECT COUNT(*)::int AS total FROM pets`;
    if (total === 0) {
      await seedPostgres();
    }
    return;
  }

  database = new DatabaseSync(databaseFile);
  database.exec(`
    CREATE TABLE IF NOT EXISTS pets (
      id TEXT PRIMARY KEY,
      status TEXT NOT NULL CHECK (status IN ('lost', 'found')),
      name TEXT NOT NULL,
      species TEXT NOT NULL CHECK (species IN ('Perro', 'Gato', 'Otro')),
      area TEXT NOT NULL,
      crossStreet TEXT,
      date TEXT NOT NULL,
      color TEXT NOT NULL,
      contact TEXT NOT NULL,
      description TEXT NOT NULL,
      photo TEXT,
      createdAt TEXT NOT NULL,
      caseStatus TEXT NOT NULL DEFAULT 'active',
      latitude REAL,
      longitude REAL,
      ownerTokenHash TEXT,
      reportCount INTEGER NOT NULL DEFAULT 0,
      isHidden INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_pets_status ON pets(status);
    CREATE INDEX IF NOT EXISTS idx_pets_species ON pets(species);
    CREATE INDEX IF NOT EXISTS idx_pets_area ON pets(area);
    CREATE INDEX IF NOT EXISTS idx_pets_created_at ON pets(createdAt);
  `);
  addSqliteColumn("pets", "caseStatus", "TEXT NOT NULL DEFAULT 'active'");
  addSqliteColumn("pets", "latitude", "REAL");
  addSqliteColumn("pets", "longitude", "REAL");
  addSqliteColumn("pets", "ownerTokenHash", "TEXT");
  addSqliteColumn("pets", "reportCount", "INTEGER NOT NULL DEFAULT 0");
  addSqliteColumn("pets", "isHidden", "INTEGER NOT NULL DEFAULT 0");
  database.exec("CREATE INDEX IF NOT EXISTS idx_pets_case_status ON pets(caseStatus);");
  database.exec("CREATE INDEX IF NOT EXISTS idx_pets_is_hidden ON pets(isHidden);");

  const count = database.prepare("SELECT COUNT(*) AS total FROM pets").get().total;
  if (count === 0) {
    seedSqlite();
  }
}

function addSqliteColumn(table, column, definition) {
  const columns = database.prepare(`PRAGMA table_info(${table})`).all().map((item) => item.name);
  if (!columns.includes(column)) {
    database.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

async function seedPostgres() {
  for (const pet of samplePets) {
    await sql`
      INSERT INTO pets (
        id, status, name, species, area, cross_street, date, color, contact, description, photo, created_at
      ) VALUES (
        ${pet.id}, ${pet.status}, ${pet.name}, ${pet.species}, ${pet.area}, ${pet.crossStreet || ""},
        ${pet.date}, ${pet.color}, ${pet.contact}, ${pet.description}, ${pet.photo || ""}, ${pet.createdAt}
      )
    `;
  }
}

function seedSqlite() {
  const insert = database.prepare(`
    INSERT INTO pets (
      id, status, name, species, area, crossStreet, date, color, contact, description, photo, createdAt
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
    )
  `);
  database.exec("BEGIN");
  try {
    for (const pet of samplePets) {
      insert.run(
        pet.id,
        pet.status,
        pet.name,
        pet.species,
        pet.area,
        pet.crossStreet || "",
        pet.date,
        pet.color,
        pet.contact,
        pet.description,
        pet.photo || "",
        pet.createdAt
      );
    }
    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}

async function readPets() {
  if (sql) {
    const rows = await sql`
      SELECT
        id,
        status,
        name,
        species,
        area,
        cross_street AS "crossStreet",
        date,
        color,
        contact,
        description,
      photo,
        created_at AS "createdAt",
        case_status AS "caseStatus",
        latitude,
        longitude,
        report_count AS "reportCount"
      FROM pets
      WHERE is_hidden = false
      ORDER BY created_at DESC
    `;
    return rows;
  }

  return database.prepare(`
    SELECT id, status, name, species, area, crossStreet, date, color, contact, description, photo, createdAt, caseStatus, latitude, longitude, reportCount
    FROM pets
    WHERE isHidden = 0
    ORDER BY datetime(createdAt) DESC
  `).all();
}

async function readAdminPets() {
  if (sql) {
    return sql`
      SELECT
        id,
        status,
        name,
        species,
        area,
        cross_street AS "crossStreet",
        date,
        color,
        contact,
        description,
        photo,
        created_at AS "createdAt",
        case_status AS "caseStatus",
        latitude,
        longitude,
        report_count AS "reportCount",
        is_hidden AS "isHidden"
      FROM pets
      ORDER BY is_hidden DESC, report_count DESC, created_at DESC
    `;
  }

  return database.prepare(`
    SELECT id, status, name, species, area, crossStreet, date, color, contact, description, photo, createdAt, caseStatus, latitude, longitude, reportCount, isHidden
    FROM pets
    ORDER BY isHidden DESC, reportCount DESC, datetime(createdAt) DESC
  `).all();
}

async function insertPet(pet) {
  if (sql) {
    await sql`
      INSERT INTO pets (
        id, status, name, species, area, cross_street, date, color, contact, description, photo, created_at, case_status, latitude, longitude, owner_token_hash
      ) VALUES (
        ${pet.id}, ${pet.status}, ${pet.name}, ${pet.species}, ${pet.area}, ${pet.crossStreet || ""},
        ${pet.date}, ${pet.color}, ${pet.contact}, ${pet.description}, ${pet.photo || ""}, ${pet.createdAt},
        ${pet.caseStatus}, ${pet.latitude}, ${pet.longitude}, ${pet.ownerTokenHash}
      )
    `;
    return;
  }

  database.prepare(`
    INSERT INTO pets (
      id, status, name, species, area, crossStreet, date, color, contact, description, photo, createdAt, caseStatus, latitude, longitude, ownerTokenHash
    ) VALUES (
      @id, @status, @name, @species, @area, @crossStreet, @date, @color, @contact, @description, @photo, @createdAt, @caseStatus, @latitude, @longitude, @ownerTokenHash
    )
  `).run(pet);
}

async function readOwnerTokenHash(id) {
  if (sql) {
    const rows = await sql`SELECT owner_token_hash AS "ownerTokenHash" FROM pets WHERE id = ${id}`;
    return rows[0]?.ownerTokenHash || "";
  }
  return database.prepare("SELECT ownerTokenHash FROM pets WHERE id = ?").get(id)?.ownerTokenHash || "";
}

async function assertOwner(id, managementCode) {
  const tokenHash = await readOwnerTokenHash(id);
  if (!tokenHash) {
    throw new Error("Esta publicacion no tiene codigo de gestion. Crea una nueva publicacion para usar edicion segura.");
  }
  if (hashToken(managementCode) !== tokenHash) {
    throw new Error("El codigo de gestion no coincide con esta publicacion.");
  }
}

async function updatePet(id, pet) {
  if (sql) {
    await sql`
      UPDATE pets
      SET status = ${pet.status},
          name = ${pet.name},
          species = ${pet.species},
          area = ${pet.area},
          cross_street = ${pet.crossStreet || ""},
          date = ${pet.date},
          color = ${pet.color},
          contact = ${pet.contact},
          description = ${pet.description},
          photo = ${pet.photo || ""},
          case_status = ${pet.caseStatus},
          latitude = ${pet.latitude},
          longitude = ${pet.longitude}
      WHERE id = ${id}
    `;
    return;
  }

  database.prepare(`
    UPDATE pets
    SET status = @status,
        name = @name,
        species = @species,
        area = @area,
        crossStreet = @crossStreet,
        date = @date,
        color = @color,
        contact = @contact,
        description = @description,
        photo = @photo,
        caseStatus = @caseStatus,
        latitude = @latitude,
        longitude = @longitude
    WHERE id = @id
  `).run({ ...pet, id });
}

async function deletePet(id) {
  if (sql) {
    await sql`DELETE FROM pets WHERE id = ${id}`;
    return;
  }
  database.prepare("DELETE FROM pets WHERE id = ?").run(id);
}

async function reportPet(id) {
  if (sql) {
    await sql`
      UPDATE pets
      SET report_count = report_count + 1,
          is_hidden = CASE WHEN report_count + 1 >= 3 THEN true ELSE is_hidden END
      WHERE id = ${id}
    `;
    return;
  }
  database.prepare(`
    UPDATE pets
    SET reportCount = reportCount + 1,
        isHidden = CASE WHEN reportCount + 1 >= 3 THEN 1 ELSE isHidden END
    WHERE id = ?
  `).run(id);
}

async function setPetHidden(id, hidden) {
  if (sql) {
    await sql`UPDATE pets SET is_hidden = ${hidden} WHERE id = ${id}`;
    return;
  }
  database.prepare("UPDATE pets SET isHidden = ? WHERE id = ?").run(hidden ? 1 : 0, id);
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(payload));
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > 8_000_000) {
        reject(new Error("El aviso supera el limite permitido."));
        request.destroy();
      }
    });
    request.on("end", () => resolve(body));
    request.on("error", reject);
  });
}

function cleanText(value, maxLength) {
  return String(value || "").trim().slice(0, maxLength);
}

function generateManagementCode() {
  return crypto.randomBytes(4).toString("hex").toUpperCase();
}

function hashToken(token) {
  return crypto.createHash("sha256").update(String(token || "").trim()).digest("hex");
}

function isAuthorizedAdmin(request) {
  const header = request.headers.authorization || "";
  if (!header.startsWith("Bearer ")) {
    return false;
  }
  return header.slice(7) === adminPassword;
}

function requireAdmin(request) {
  if (!isAuthorizedAdmin(request)) {
    const error = new Error("No autorizado.");
    error.statusCode = 401;
    throw error;
  }
}

function cleanCoordinate(value, min, max) {
  if (value === "" || value === null || value === undefined) {
    return null;
  }
  const number = Number(value);
  if (!Number.isFinite(number) || number < min || number > max) {
    return null;
  }
  return number;
}

async function savePhoto(photoData) {
  if (!photoData || !photoData.startsWith("data:image/")) {
    return cleanText(photoData, 1000);
  }

  const match = photoData.match(/^data:(image\/(?:png|jpeg|jpg|webp|gif));base64,(.+)$/);
  if (!match) {
    return "";
  }

  const extension = match[1].split("/")[1].replace("jpeg", "jpg");
  const buffer = Buffer.from(match[2], "base64");
  if (buffer.length > 5_000_000) {
    throw new Error("La foto no puede superar 5 MB.");
  }

  if (hasCloudinaryConfig) {
    const result = await cloudinary.uploader.upload(photoData, {
      folder: "pet-finder/notices",
      resource_type: "image",
      transformation: [
        { width: 1200, height: 900, crop: "limit" },
        { quality: "auto", fetch_format: "auto" }
      ]
    });
    return result.secure_url;
  }

  const fileName = `${crypto.randomUUID()}.${extension}`;
  await fs.writeFile(path.join(uploadDir, fileName), buffer);
  return `/uploads/${fileName}`;
}

function validatePet(input) {
  const pet = {
    status: cleanText(input.status, 10),
    name: cleanText(input.name, 80),
    species: cleanText(input.species, 30),
    area: cleanText(input.area, 80),
    crossStreet: cleanText(input.crossStreet, 100),
    date: cleanText(input.date, 20),
    color: cleanText(input.color, 60),
    contact: cleanText(input.contact, 120),
    description: cleanText(input.description, 700),
    caseStatus: cleanText(input.caseStatus || "active", 20),
    latitude: cleanCoordinate(input.latitude, -90, 90),
    longitude: cleanCoordinate(input.longitude, -180, 180)
  };

  const required = ["status", "name", "species", "area", "date", "color", "contact", "description"];
  const missing = required.filter((field) => !pet[field]);
  if (missing.length) {
    throw new Error("Faltan campos obligatorios.");
  }
  if (!["lost", "found"].includes(pet.status)) {
    throw new Error("El tipo de aviso no es valido.");
  }
  if (!["Perro", "Gato", "Otro"].includes(pet.species)) {
    throw new Error("La especie no es valida.");
  }
  if (!["active", "reunited"].includes(pet.caseStatus)) {
    throw new Error("El estado de la publicacion no es valido.");
  }
  return pet;
}

async function handleApi(request, response) {
  const requestUrl = new URL(request.url, `http://${request.headers.host}`);
  const petMatch = requestUrl.pathname.match(/^\/api\/pets\/([^/]+)$/);
  const adminActionMatch = requestUrl.pathname.match(/^\/api\/admin\/pets\/([^/]+)\/(hide|restore|delete)$/);

  if (requestUrl.pathname === "/api/admin/pets" && request.method === "GET") {
    requireAdmin(request);
    sendJson(response, 200, await readAdminPets());
    return true;
  }

  if (adminActionMatch && request.method === "POST") {
    requireAdmin(request);
    const id = decodeURIComponent(adminActionMatch[1]);
    const action = adminActionMatch[2];
    if (action === "hide") await setPetHidden(id, true);
    if (action === "restore") await setPetHidden(id, false);
    if (action === "delete") await deletePet(id);
    sendJson(response, 200, { ok: true });
    return true;
  }

  if (requestUrl.pathname === "/api/pets" && request.method === "GET") {
    const pets = await readPets();
    sendJson(response, 200, pets);
    return true;
  }

  if (requestUrl.pathname === "/api/pets" && request.method === "POST") {
    const body = await readBody(request);
    const input = JSON.parse(body || "{}");
    const pet = validatePet(input);
    const managementCode = generateManagementCode();
    pet.id = crypto.randomUUID();
    pet.photo = await savePhoto(input.photo);
    pet.createdAt = new Date().toISOString();
    pet.ownerTokenHash = hashToken(managementCode);

    await insertPet(pet);
    const { ownerTokenHash, ...publicPet } = pet;
    sendJson(response, 201, { ...publicPet, managementCode });
    return true;
  }

  if (petMatch && request.method === "PATCH") {
    const id = decodeURIComponent(petMatch[1]);
    const body = await readBody(request);
    const input = JSON.parse(body || "{}");
    await assertOwner(id, input.managementCode);
    const pet = validatePet(input);
    pet.photo = await savePhoto(input.photo);
    await updatePet(id, pet);
    sendJson(response, 200, { ...pet, id });
    return true;
  }

  if (petMatch && request.method === "DELETE") {
    const id = decodeURIComponent(petMatch[1]);
    const body = await readBody(request);
    const input = body ? JSON.parse(body) : {};
    await assertOwner(id, input.managementCode);
    await deletePet(id);
    sendJson(response, 200, { ok: true });
    return true;
  }

  if (requestUrl.pathname.match(/^\/api\/pets\/([^/]+)\/report$/) && request.method === "POST") {
    const id = decodeURIComponent(requestUrl.pathname.match(/^\/api\/pets\/([^/]+)\/report$/)[1]);
    await reportPet(id);
    sendJson(response, 200, { ok: true });
    return true;
  }

  return false;
}

async function serveStatic(request, response) {
  const requestUrl = new URL(request.url, `http://${request.headers.host}`);
  const isPetRoute = requestUrl.pathname.startsWith("/pet/");

  let requestedPath;

  if (
    requestUrl.pathname === "/" ||
    (
      isPetRoute &&
      !requestUrl.pathname.includes(".")
    )
  ) {
    requestedPath = "/index.html";
  } else {
    requestedPath = decodeURIComponent(requestUrl.pathname);
  }

  const filePath = path.normalize(path.join(root, requestedPath));

  if (!filePath.startsWith(root)) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  try {
    const content = await fs.readFile(filePath);
    response.writeHead(200, { "Content-Type": mimeTypes[path.extname(filePath).toLowerCase()] || "application/octet-stream" });
    response.end(content);
  } catch {
    response.writeHead(404);
    response.end("Not found");
  }
}

const server = http.createServer(async (request, response) => {
  try {
    if (request.url.startsWith("/api/") && await handleApi(request, response)) {
      return;
    }
    await serveStatic(request, response);
  } catch (error) {
    sendJson(response, error.statusCode || 400, { error: error.message || "No se pudo procesar la solicitud." });
  }
});

ensureStorage().then(() => {
  server.listen(port, () => {
    const databaseName = databaseUrl ? "Neon PostgreSQL" : "SQLite local";
    const photoStorage = hasCloudinaryConfig ? "Cloudinary" : "uploads locales";
    console.log(`Petsfounds disponible en http://localhost:${port} usando ${databaseName} y ${photoStorage}`);
  });
});
