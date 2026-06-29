const cardsGrid = document.querySelector("#cardsGrid");
const detailView = document.querySelector("#detailView");
const emptyState = document.querySelector("#emptyState");
const searchInput = document.querySelector("#searchInput");
const speciesFilter = document.querySelector("#speciesFilter");
const areaFilter = document.querySelector("#areaFilter");
const avisosTabs = document.querySelector("#avisosTabs");
const sections = {
  hero: document.querySelector("#homeHero"),
  menu: document.querySelector("#homeMenu"),
  search: document.querySelector("#searchBand"),
  avisos: document.querySelector("#avisos"),
  publicar: document.querySelector("#publicar"),
  consejos: document.querySelector("#consejos")
};
const photoFile = document.querySelector("#photoFile");
const photoPreview = document.querySelector("#photoPreview");
const cancelEditButton = document.querySelector("#cancelEditButton");
const locationPickerMap = document.querySelector("#locationPickerMap");
const locationStatus = document.querySelector("#locationStatus");
const useAreaButton = document.querySelector("#useAreaButton");
const clearLocationButton = document.querySelector("#clearLocationButton");
const form = document.querySelector("#petForm");
const submitButton = form.querySelector("button[type='submit']");

const placeholder = "data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 800 600%27%3E%3Crect width=%27800%27 height=%27600%27 fill=%27%23c7ead9%27/%3E%3Cpath d=%27M194 389c29-75 92-122 164-122s136 47 164 122c11 29-10 60-41 60H235c-31 0-52-31-41-60Z%27 fill=%27%23147d7f%27/%3E%3Ccircle cx=%27286%27 cy=%27227%27 r=%2754%27 fill=%27%23e85d4f%27/%3E%3Ccircle cx=%27430%27 cy=%27205%27 r=%2766%27 fill=%27%23f2b84b%27/%3E%3Ccircle cx=%27529%27 cy=%27270%27 r=%2748%27 fill=%27%23356ac3%27/%3E%3Ccircle cx=%27213%27 cy=%27300%27 r=%2742%27 fill=%27%23ffffff%27/%3E%3C/svg%3E";

let pets = [];
let reunionTotal = 0;
let selectedPetId = "";
let selectedPhotoData = "";
let locationMap;
let locationMarker;
let detailMap;
const ownerCodesKey = "pet-finder-owner-codes";
let ownerCodes = JSON.parse(localStorage.getItem(ownerCodesKey) || "{}");
const defaultMapCenter = [-34.603722, -58.381592];
let userLocation = null;

let currentView = "home";
let activeTab = "all";
const viewByPath = {
  "/": "home",
  "/avisos": "avisos",
  "/adopcion": "adoption",
  "/reencuentros": "reunited",
  "/publicar": "publish"
};
const listMeta = {
  avisos: { eyebrow: "Perdidos y encontrados", title: "Avisos activos", empty: "No hay avisos activos que coincidan con la busqueda." },
  adoption: { eyebrow: "Dales un hogar", title: "En adopción", empty: "No hay mascotas en adopción por ahora." },
  reunited: { eyebrow: "Finales felices", title: "Reencuentros", empty: "Todavía no hay reencuentros registrados." }
};

function statusText(status) {
  if (status === "lost") return "Perdido";
  if (status === "adoption") return "En adopción";
  return "Encontrado";
}

function caseText(pet) {
  if ((pet.caseStatus || "active") !== "reunited") return "Activa";
  return pet.status === "adoption" ? "Adoptada" : "Reencontrada";
}

function reunionNotice(pet) {
  if (pet.caseStatus !== "reunited") return "";
  const isAdoption = pet.status === "adoption";
  return `
    <div class="reunion-notice">
      <strong>${isAdoption ? "Adopción concretada" : "Reencuentro confirmado"}</strong>
      <span>${isAdoption ? "Esta mascota ya encontro un hogar." : "Esta mascota ya encontro a su familia."}</span>
    </div>
  `;
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#039;"
  }[character]));
}

function contactHref(contact) {
  const normalized = String(contact).replace(/[^\d+]/g, "");
  if (String(contact).includes("@")) return `mailto:${contact}`;
  if (normalized.length >= 8) return `https://wa.me/${normalized.replace(/^\+/, "")}`;
  return "#publicar";
}

function generateShareMessage(pet) {
  const status = statusText(pet.status);
  const message = `🐾 *${escapeHtml(pet.name)}* - ${status}\n\n📍 ${escapeHtml(pet.area)}\n🗓️ ${new Date(pet.date + "T00:00:00").toLocaleDateString("es-AR")}\n🎨 ${escapeHtml(pet.color)}\n\n${escapeHtml(pet.description)}\n\n📱 Contacto: ${escapeHtml(pet.contact)}\n\n#Petsfounds #Mascotas`;
  return message;
}



function isOwnedPet(id) {
  return Boolean(ownerCodes[id]);
}

function rememberOwnerCode(id, code) {
  ownerCodes[id] = code;
  localStorage.setItem(ownerCodesKey, JSON.stringify(ownerCodes));
}

function forgetOwnerCode(id) {
  delete ownerCodes[id];
  localStorage.setItem(ownerCodesKey, JSON.stringify(ownerCodes));
}

function renderStats(list) {
  const active = list.filter((pet) => (pet.caseStatus || "active") === "active");
  const lost = active.filter((pet) => pet.status === "lost").length;
  const found = active.filter((pet) => pet.status === "found").length;
  const adoption = active.filter((pet) => pet.status === "adoption").length;
  const set = (id, value) => { const el = document.querySelector(id); if (el) el.textContent = value; };
  set("#totalCount", active.length);
  set("#lostCount", lost);
  set("#foundCount", found);
  set("#adoptionCount", adoption);
  set("#reunitedCount", reunionTotal);
  set("#menuActive", lost + found);
  set("#menuAdoption", adoption);
  set("#menuReunited", reunionTotal);
}

function renderAreaOptions() {
  const selected = areaFilter.value;
  const areas = [...new Set(pets.map((pet) => pet.area).filter(Boolean))].sort((a, b) => a.localeCompare(b, "es"));
  areaFilter.innerHTML = `<option value="all">Todas</option>${areas.map((area) => `<option value="${escapeHtml(area)}">${escapeHtml(area)}</option>`).join("")}`;
  areaFilter.value = areas.includes(selected) ? selected : "all";
}

function matchesView(pet) {
  const currentCase = pet.caseStatus || "active";
  if (currentView === "reunited") return currentCase === "reunited";
  if (currentView === "adoption") return currentCase !== "reunited" && pet.status === "adoption";
  // "avisos": activos perdidos + encontrados, con pestañas
  if (currentCase === "reunited") return false;
  if (pet.status === "adoption") return false;
  if (activeTab === "lost") return pet.status === "lost";
  if (activeTab === "found") return pet.status === "found";
  return pet.status === "lost" || pet.status === "found";
}

function filteredPets() {
  const term = searchInput.value.trim().toLowerCase();
  const species = speciesFilter.value;
  const area = areaFilter.value;
  return pets.filter((pet) => {
    const text = `${pet.name} ${pet.species} ${pet.area} ${pet.crossStreet || ""} ${pet.color} ${pet.description}`.toLowerCase();
    return matchesView(pet) &&
      (species === "all" || pet.species === species) &&
      (area === "all" || pet.area === area) &&
      text.includes(term);
  });
}

function coordinatesFor(pet) {
  const latitude = Number(pet.latitude);
  const longitude = Number(pet.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return [latitude, longitude];
}
function calculateDistance(lat1, lon1, lat2, lon2) {
  const toRad = (value) => value * Math.PI / 180;

  const R = 6371;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
    Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) *
    Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return (R * c).toFixed(1);
}

function distanceMarkup(pet) {
  if (!userLocation) return "";

  const coordinates = coordinatesFor(pet);

  if (!coordinates) return "";

  const distance = calculateDistance(
    userLocation.latitude,
    userLocation.longitude,
    coordinates[0],
    coordinates[1]
  );

  return `
    <span class="distance-badge">
      📍 A ${distance} km
    </span>
  `;
}
let leafletPromise = null;
function loadLeaflet() {
  if (window.L) return Promise.resolve();
  if (leafletPromise) return leafletPromise;
  leafletPromise = new Promise((resolve, reject) => {
    const css = document.createElement("link");
    css.rel = "stylesheet";
    css.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
    document.head.appendChild(css);
    const script = document.createElement("script");
    script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    script.onload = () => resolve();
    script.onerror = () => { leafletPromise = null; reject(new Error("No se pudo cargar el mapa.")); };
    document.head.appendChild(script);
  });
  return leafletPromise;
}

function createTileLayer() {
  return L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "&copy; OpenStreetMap"
  });
}

function detailMapMarkup(pet) {
  const coordinates = coordinatesFor(pet);
  if (!coordinates) {
    return `
      <div class="pet-map-empty">
        <strong>Sin mapa cargado</strong>
        <span>La publicacion solo indica ${escapeHtml(pet.area)}${pet.crossStreet ? `, ${escapeHtml(pet.crossStreet)}` : ""}.</span>
      </div>
    `;
  }
  return `
    <div class="pet-map-wrap">
      <div
        class="detail-map"
        id="detailMap"
        data-latitude="${escapeHtml(coordinates[0])}"
        data-longitude="${escapeHtml(coordinates[1])}"
        aria-label="Mapa aproximado de ${escapeHtml(pet.name)}"
      ></div>
    </div>
  `;
}

async function renderDetailMap(pet) {
  if (detailMap) {
    detailMap.remove();
    detailMap = null;
  }
  const coordinates = coordinatesFor(pet);
  const element = document.querySelector("#detailMap");
  if (!coordinates || !element) return;
  await loadLeaflet();
  if (!document.body.contains(element)) return;
  detailMap = L.map(element, { scrollWheelZoom: false }).setView(coordinates, 15);
  createTileLayer().addTo(detailMap);
  L.marker(coordinates).addTo(detailMap);
  setTimeout(() => detailMap.invalidateSize(), 0);
}

function currentPath() {
  return window.location.pathname.replace(/\/+$/, "") || "/";
}

function setActiveNav(path) {
  document.querySelectorAll(".site-links a[data-route]").forEach((link) => {
    link.classList.toggle("active", link.dataset.route === path);
  });
}

function showOnly(keys) {
  Object.entries(sections).forEach(([key, el]) => {
    if (el) el.hidden = !keys.includes(key);
  });
}

function navigate(path) {
  if (path !== currentPath()) {
    window.history.pushState({}, "", path);
  }
  renderRoute();
}

function renderRoute() {
  const path = currentPath();
  const petMatch = path.match(/^\/pet\/(.+)$/);

  if (petMatch) {
    selectedPetId = decodeURIComponent(petMatch[1]);
    showOnly(["avisos"]);
    avisosTabs.hidden = true;
    setActiveNav(null);
    renderPets();
    setTimeout(() => { if (detailMap) detailMap.invalidateSize(); }, 80);
    return;
  }

  selectedPetId = "";
  if (detailMap) { detailMap.remove(); detailMap = null; }
  const view = viewByPath[path] || "home";
  currentView = view;
  setActiveNav(view === "home" ? null : path);

  if (view === "home") {
    showOnly(["hero", "menu", "consejos"]);
    renderStats(pets);
    return;
  }
  if (view === "publish") {
    showOnly(["publicar"]);
    ensureLocationPicker();
    setTimeout(() => { if (locationMap) locationMap.invalidateSize(); }, 80);
    return;
  }

  // Vistas de listado (avisos / adopcion / reencuentros)
  showOnly(["search", "avisos"]);
  avisosTabs.hidden = view !== "avisos";
  const meta = listMeta[view];
  document.querySelector("#avisos-eyebrow").textContent = meta.eyebrow;
  document.querySelector("#avisos-title").textContent = meta.title;
  emptyState.textContent = meta.empty;
  renderPets();
}

function openDetail(id) {
  selectedPetId = id;
  window.history.pushState({}, "", `/pet/${encodeURIComponent(id)}`);
  renderRoute();
  setTimeout(() => {
    if (sections.avisos) sections.avisos.scrollIntoView({ behavior: "smooth", block: "start" });
    if (detailMap) detailMap.invalidateSize();
  }, 100);
}

function closeDetail() {
  const pet = pets.find((item) => item.id === selectedPetId);
  let target = "/avisos";
  if (pet) {
    if ((pet.caseStatus || "active") === "reunited") target = "/reencuentros";
    else if (pet.status === "adoption") target = "/adopcion";
  }
  navigate(target);
  window.scrollTo({ top: 0 });
}

function renderDetail(pet) {
  detailView.innerHTML = `
    <article class="pet-detail ${pet.caseStatus === "reunited" ? "is-reunited" : ""}">
      <button class="small-button detail-back" type="button" data-action="back-to-list">
        Volver al listado
      </button>

      <div class="detail-layout">
        <img
          class="detail-photo"
          src="${escapeHtml(pet.photo || placeholder)}"
          alt="Foto de ${escapeHtml(pet.name)}"
          onerror="this.src='${placeholder}'" 
        >

        <div class="detail-content">
          <div class="pet-top">
            <h3>${escapeHtml(pet.name)}</h3>
            <span class="badge ${escapeHtml(pet.status)}">
              ${escapeHtml(statusText(pet.status))}
            </span>
          </div>

          <div class="meta">
            <span>${escapeHtml(caseText(pet))}</span>
            <span>${escapeHtml(pet.species)}</span>
            <span>${escapeHtml(pet.area)}</span>
            <span>${escapeHtml(pet.crossStreet || "Sin referencia")}</span>
            <span>${escapeHtml(new Date(pet.date + "T00:00:00").toLocaleDateString("es-AR"))}</span>
            <span>${escapeHtml(pet.color)}</span>
          </div>

          ${reunionNotice(pet)}

          <p>${escapeHtml(pet.description)}</p>

          ${distanceMarkup(pet)}

          ${detailMapMarkup(pet)}

          <a
            class="contact"
            href="${escapeHtml(contactHref(pet.contact))}"
            target="_blank"
            rel="noreferrer"
          >
            ${escapeHtml(pet.contact)}
          </a>

          ${cardActions(pet)}
        </div>
      </div>
    </article>
  `;

  renderDetailMap(pet);
}


function updateLocationFields(latitude, longitude) {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    form.elements.latitude.value = "";
    form.elements.longitude.value = "";
    locationStatus.textContent = "Toca el mapa para marcar la zona donde se perdio o encontro.";
    if (locationMarker) {
      locationMarker.remove();
      locationMarker = null;
    }
    return;
  }

  form.elements.latitude.value = latitude.toFixed(6);
  form.elements.longitude.value = longitude.toFixed(6);
  locationStatus.textContent = `Ubicacion aproximada marcada (${latitude.toFixed(4)}, ${longitude.toFixed(4)}).`;

  if (!locationMap || !window.L) return;
  if (!locationMarker) {
    locationMarker = L.marker([latitude, longitude], { draggable: true }).addTo(locationMap);
    locationMarker.on("dragend", () => {
      const position = locationMarker.getLatLng();
      updateLocationFields(position.lat, position.lng);
    });
  } else {
    locationMarker.setLatLng([latitude, longitude]);
  }
}

async function ensureLocationPicker() {
  if (locationMap || !locationPickerMap) return;
  await loadLeaflet();
  if (locationMap) return;
  locationMap = L.map(locationPickerMap, { scrollWheelZoom: false }).setView(defaultMapCenter, 12);
  createTileLayer().addTo(locationMap);
  locationMap.on("click", (event) => {
    updateLocationFields(event.latlng.lat, event.latlng.lng);
  });
  setTimeout(() => locationMap.invalidateSize(), 0);
}

function cardActions(pet) {
  
  if (!isOwnedPet(pet.id)) {
    return `
      <div class="card-actions single">
        <button class="small-button" type="button" data-action="report" data-id="${escapeHtml(pet.id)}">Denunciar</button>
      </div>
      <div class="card-share">
        <button class="share-button native" type="button" data-action="share-native" data-id="${escapeHtml(pet.id)}" title="Compartir" aria-label="Compartir publicacion">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 10.7 15.4 6.3M8.6 13.3l6.8 4.4"/></svg>
          <span>Compartir</span>
        </button>
      </div>
    `;
  }

  const isReunited = pet.caseStatus === "reunited";
  const markLabel = pet.status === "adoption" ? "Marcar adoptada" : "Marcar reencuentro";
  return `
    <div class="card-actions">
      <button class="small-button" type="button" data-action="edit" data-id="${escapeHtml(pet.id)}">Editar</button>
      <button class="small-button success" type="button" data-action="toggle-reunited" data-id="${escapeHtml(pet.id)}">${isReunited ? "Reactivar aviso" : markLabel}</button>
      <button class="small-button danger" type="button" data-action="delete" data-id="${escapeHtml(pet.id)}">Borrar</button>
    </div>
    <div class="card-share">
      <button class="share-button native" type="button" data-action="share-native" data-id="${escapeHtml(pet.id)}" title="Compartir" aria-label="Compartir publicacion">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 10.7 15.4 6.3M8.6 13.3l6.8 4.4"/></svg>
        <span>Compartir</span>
      </button>
    </div>
  `;
}

function petCardMarkup(pet) {
  return `
    <article class="pet-card ${pet.caseStatus === "reunited" ? "is-reunited" : ""}">
      <img src="${escapeHtml(pet.photo || placeholder)}" alt="Foto de ${escapeHtml(pet.name)}" onerror="this.src='${placeholder}'">
      <div class="pet-body">
        <div class="pet-top">
          <h3>${escapeHtml(pet.name)}</h3>
          <span class="badge ${escapeHtml(pet.status)}">${escapeHtml(statusText(pet.status))}</span>
        </div>
        <div class="meta">
          <span>${escapeHtml(caseText(pet))}</span>
          <span>${escapeHtml(pet.species)}</span>
          <span>${escapeHtml(pet.area)}</span>
          <span>${escapeHtml(pet.crossStreet || "Sin referencia")}</span>
          <span>${escapeHtml(new Date(pet.date + "T00:00:00").toLocaleDateString("es-AR"))}</span>
          <span>${escapeHtml(pet.color)}</span>
        </div>
        ${reunionNotice(pet)}
        <p>${escapeHtml(pet.description)}</p>
        ${distanceMarkup(pet)}
        <a class="contact" href="${escapeHtml(contactHref(pet.contact))}" target="_blank" rel="noreferrer">${escapeHtml(pet.contact)}</a>
        <button class="button ghost full" type="button" data-action="open-detail" data-id="${escapeHtml(pet.id)}">Ver detalle</button>
        ${cardActions(pet)}
      </div>
    </article>
  `;
}

function reunitedCardMarkup(pet) {
  const label = pet.status === "adoption" ? "Adoptado" : "Reencontrado";
  return `
    <article class="pet-card reunited-card">
      <img src="${escapeHtml(pet.photo || placeholder)}" alt="Foto de ${escapeHtml(pet.name)}" onerror="this.src='${placeholder}'">
      <div class="pet-body">
        <div class="pet-top">
          <h3>${escapeHtml(pet.name)}</h3>
          <span class="badge reunited">${label} 🎉</span>
        </div>
      </div>
    </article>
  `;
}

function renderPets() {
  renderAreaOptions();
  const filtered = filteredPets();
  const selectedPet = selectedPetId ? pets.find((pet) => pet.id === selectedPetId) : null;

  avisosTabs.querySelectorAll(".tab").forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.tab === activeTab);
  });

  const markup = currentView === "reunited" ? reunitedCardMarkup : petCardMarkup;
  cardsGrid.innerHTML = filtered.map(markup).join("");

  cardsGrid.hidden = Boolean(selectedPet);
  detailView.hidden = !selectedPet;
  if (selectedPet) renderDetail(selectedPet);
  emptyState.hidden = filtered.length !== 0 || Boolean(selectedPet);
  renderStats(pets);
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || "No se pudo procesar la solicitud.");
  return payload;
}

async function loadStats() {
  try {
    const stats = await requestJson("/api/stats");
    reunionTotal = stats.reunions || 0;
  } catch {
    reunionTotal = 0;
  }
}

async function loadPets() {
  pets = await requestJson("/api/pets");
  await loadStats();
  renderRoute();
}

function petFromForm() {
  const data = new FormData(form);
  return {
    status: data.get("status"),
    name: data.get("name").trim(),
    species: data.get("species"),
    area: data.get("area").trim(),
    crossStreet: data.get("crossStreet").trim(),
    date: data.get("date"),
    color: data.get("color").trim(),
    contact: data.get("contact").trim(),
    description: data.get("description").trim(),
    caseStatus: data.get("caseStatus") || "active",
    latitude: data.get("latitude") ? Number(data.get("latitude")) : null,
    longitude: data.get("longitude") ? Number(data.get("longitude")) : null,
    photo: selectedPhotoData || data.get("photo").trim(),
    managementCode: form.elements.id.value ? ownerCodes[form.elements.id.value] : ""
  };
}

function resetPhotoPreview() {
  selectedPhotoData = "";
  photoPreview.hidden = true;
  photoPreview.removeAttribute("src");
}

function resetForm() {
  form.reset();
  form.elements.id.value = "";
  form.elements.caseStatus.value = "active";
  form.querySelector('input[value="lost"]').checked = true;
  form.elements.date.valueAsDate = new Date();
  updateLocationFields(null, null);
  if (locationMap) {
    locationMap.setView(defaultMapCenter, 12);
    setTimeout(() => locationMap.invalidateSize(), 0);
  }
  submitButton.textContent = "Publicar aviso";
  cancelEditButton.hidden = true;
  resetPhotoPreview();
}

function editPet(id) {
  const pet = pets.find((item) => item.id === id);
  if (!pet) return;
  navigate("/publicar");
  window.scrollTo({ top: 0 });
  form.elements.id.value = pet.id;
  form.elements.status.value = pet.status;
  form.elements.name.value = pet.name;
  form.elements.species.value = pet.species;
  form.elements.area.value = pet.area;
  form.elements.crossStreet.value = pet.crossStreet || "";
  form.elements.date.value = pet.date;
  form.elements.color.value = pet.color;
  form.elements.contact.value = pet.contact;
  form.elements.description.value = pet.description;
  form.elements.caseStatus.value = pet.caseStatus || "active";
  const coordinates = coordinatesFor(pet);
  if (coordinates) {
    updateLocationFields(coordinates[0], coordinates[1]);
    if (locationMap) locationMap.setView(coordinates, 15);
  } else {
    updateLocationFields(null, null);
  }
  form.elements.photo.value = pet.photo && !pet.photo.startsWith("data:image/") ? pet.photo : "";
  if (pet.photo) {
    photoPreview.src = pet.photo;
    photoPreview.hidden = false;
  }
  selectedPhotoData = "";
  submitButton.textContent = "Guardar cambios";
  cancelEditButton.hidden = false;
}

async function savePet(event) {
  event.preventDefault();
  const id = form.elements.id.value;
  const pet = petFromForm();
  submitButton.disabled = true;
  submitButton.textContent = id ? "Guardando..." : "Publicando...";
  try {
    const savedPet = await requestJson(id ? `/api/pets/${encodeURIComponent(id)}` : "/api/pets", {
      method: id ? "PATCH" : "POST",
      body: JSON.stringify(pet)
    });
    if (id) {
      pets = pets.map((item) => item.id === id ? { ...item, ...savedPet } : item);
    } else {
      rememberOwnerCode(savedPet.id, savedPet.managementCode);
      alert(`Guarda este codigo para gestionar tu publicacion: ${savedPet.managementCode}`);
      delete savedPet.managementCode;
      pets = [savedPet, ...pets];
    }
    resetForm();
    const target = pet.status === "adoption" ? "/adopcion" : "/avisos";
    navigate(target);
    window.scrollTo({ top: 0 });
  } catch (error) {
    alert(error.message);
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = form.elements.id.value ? "Guardar cambios" : "Publicar aviso";
  }
}

function celebrateReunion(message) {
  return new Promise((resolve) => {
    const colors = ["#e85d4f", "#147d7f", "#f2b84b", "#7a5ccc", "#356ac3", "#ffffff"];
    let confetti = "";
    for (let i = 0; i < 120; i += 1) {
      const left = Math.random() * 100;
      const delay = Math.random() * 0.8;
      const duration = 2 + Math.random() * 1.6;
      const color = colors[Math.floor(Math.random() * colors.length)];
      const width = 6 + Math.random() * 9;
      confetti += `<span class="confetti-piece" style="left:${left}%;background:${color};width:${width}px;height:${width * 0.42}px;animation-delay:${delay}s;animation-duration:${duration}s;"></span>`;
    }

    const overlay = document.createElement("div");
    overlay.className = "celebration-overlay";
    overlay.innerHTML = `
      <div class="confetti">${confetti}</div>
      <div class="celebration-stage">
        <img class="celebration-logo" src="/images/logo-hero-opt.png" alt="Petsfounds">
        <p class="celebration-text">${escapeHtml(message)}</p>
      </div>
    `;

    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add("is-visible"));

    setTimeout(() => {
      overlay.classList.remove("is-visible");
      setTimeout(() => {
        overlay.remove();
        resolve();
      }, 400);
    }, 2600);
  });
}

async function toggleReunited(id) {
  const pet = pets.find((item) => item.id === id);
  if (!pet) return;
  const isAdoption = pet.status === "adoption";

  // Publicaciones marcadas como reencuentro (datos previos) solo se reactivan.
  if (pet.caseStatus === "reunited") {
    if (!confirm("Quieres reactivar esta publicacion como aviso activo?")) return;
    const savedPet = await requestJson(`/api/pets/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify({ ...pet, caseStatus: "active", managementCode: ownerCodes[id] })
    });
    pets = pets.map((item) => item.id === id ? { ...item, ...savedPet } : item);
    if (selectedPetId === id) selectedPetId = savedPet.id;
    renderPets();
    return;
  }

  const question = isAdoption
    ? "Confirmas que esta mascota ya fue adoptada? Festejamos y se cierra la publicacion."
    : "Confirmas que la mascota ya se reencontro con su familia? Festejamos y se cierra la publicacion.";
  if (!confirm(question)) return;

  await celebrateReunion(isAdoption ? "¡Adopción concretada! 🎉" : "¡Reencuentro logrado! 🎉");

  const result = await requestJson(`/api/pets/${encodeURIComponent(id)}/reunite`, {
    method: "POST",
    body: JSON.stringify({ managementCode: ownerCodes[id] })
  });
  reunionTotal = result.reunions ?? reunionTotal + 1;
  pets = pets.map((item) => item.id === id ? { ...item, caseStatus: "reunited" } : item);
  selectedPetId = "";
  navigate("/reencuentros");
  window.scrollTo({ top: 0 });
}

async function removePet(id) {
  if (!confirm("Seguro que quieres borrar esta publicacion? Esta accion no se puede deshacer.")) return;
  await requestJson(`/api/pets/${encodeURIComponent(id)}`, {
    method: "DELETE",
    body: JSON.stringify({ managementCode: ownerCodes[id] })
  });
  pets = pets.filter((pet) => pet.id !== id);
  forgetOwnerCode(id);
  if (selectedPetId === id) selectedPetId = "";
  renderPets();
}

async function reportPet(id) {
  if (!confirm("Quieres denunciar esta publicacion para revision?")) return;
  await requestJson(`/api/pets/${encodeURIComponent(id)}/report`, { method: "POST", body: "{}" });
  alert("Gracias. La denuncia fue registrada.");
}

async function sharePet(id) {
  const pet = pets.find((item) => item.id === id);
  if (!pet) return;
  const text = generateShareMessage(pet);
  const petUrl = new URL(`/pet/${encodeURIComponent(pet.id)}`, window.location.origin).href;
  const shareData = {
    title: `${pet.name} - ${statusText(pet.status)}`,
    text,
    url: petUrl
  };
  if (navigator.share) {
    await navigator.share(shareData);
    return;
  }
  await navigator.clipboard.writeText(`${text}\n\n${petUrl}`);
  alert("Mensaje copiado al portapapeles.");
}

photoFile.addEventListener("change", () => {
  const file = photoFile.files[0];
  if (!file) {
    resetPhotoPreview();
    return;
  }
  const reader = new FileReader();
  reader.addEventListener("load", () => {
    selectedPhotoData = reader.result;
    photoPreview.src = selectedPhotoData;
    photoPreview.hidden = false;
  });
  reader.readAsDataURL(file);
});

async function handlePetAction(event) {
  const button = event.target.closest("[data-action]");
  if (!button) return;
  const { action, id } = button.dataset;
  try {
    if (action === "open-detail") openDetail(id);
    if (action === "back-to-list") closeDetail();
    if (action === "edit") editPet(id);
    if (action === "toggle-reunited") await toggleReunited(id);
    if (action === "delete") await removePet(id);
    if (action === "report") await reportPet(id);
    if (action === "share-native") await sharePet(id);
  } catch (error) {
    alert(error.message);
  }
}

cardsGrid.addEventListener("click", handlePetAction);
detailView.addEventListener("click", handlePetAction);

form.addEventListener("submit", savePet);
cancelEditButton.addEventListener("click", resetForm);
[searchInput, speciesFilter, areaFilter].forEach((control) => control.addEventListener("input", renderPets));
useAreaButton.addEventListener("click", async () => {
  const locationParts = [form.elements.area.value, form.elements.crossStreet.value].filter((value) => value.trim());
  if (!locationParts.length) {
    alert("Primero escribe una zona o referencia cercana.");
    return;
  }
  const query = [...locationParts, "Argentina"].join(", ");
  try {
    if (navigator.geolocation) {
  navigator.geolocation.getCurrentPosition((position) => {
    userLocation = {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude
    };

    renderPets();
  });
} 
    await ensureLocationPicker();
    useAreaButton.disabled = true;
    useAreaButton.textContent = "Buscando...";
    const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`, {
      headers: { "Accept": "application/json" }
    });
    const results = await response.json();
    if (!results.length) throw new Error("No encontramos esa zona. Puedes marcarla manualmente en el mapa.");
    const latitude = Number(results[0].lat);
    const longitude = Number(results[0].lon);
    updateLocationFields(latitude, longitude);
    if (locationMap) locationMap.setView([latitude, longitude], 15);
  } catch (error) {
    alert(error.message);
  } finally {
    useAreaButton.disabled = false;
    useAreaButton.textContent = "Buscar por zona";
  }
});
clearLocationButton.addEventListener("click", () => updateLocationFields(null, null));

avisosTabs.addEventListener("click", (event) => {
  const tab = event.target.closest(".tab");
  if (!tab) return;
  activeTab = tab.dataset.tab;
  renderPets();
});

document.addEventListener("click", (event) => {
  const link = event.target.closest("a[data-link]");
  if (!link) return;
  const url = new URL(link.href);
  if (url.origin !== window.location.origin) return;
  event.preventDefault();
  navigate(url.pathname);
  window.scrollTo({ top: 0 });
});

window.addEventListener("popstate", renderRoute);

resetForm();
loadPets().catch((error) => {
  emptyState.hidden = false;
  emptyState.textContent = error.message;
});
