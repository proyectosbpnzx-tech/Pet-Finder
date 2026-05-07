const cardsGrid = document.querySelector("#cardsGrid");
const emptyState = document.querySelector("#emptyState");
const searchInput = document.querySelector("#searchInput");
const statusFilter = document.querySelector("#statusFilter");
const caseFilter = document.querySelector("#caseFilter");
const speciesFilter = document.querySelector("#speciesFilter");
const areaFilter = document.querySelector("#areaFilter");
const mapView = document.querySelector("#mapView");
const viewButtons = document.querySelectorAll(".view-button");
const photoFile = document.querySelector("#photoFile");
const photoPreview = document.querySelector("#photoPreview");
const useLocationButton = document.querySelector("#useLocationButton");
const searchLocationButton = document.querySelector("#searchLocationButton");
const locationSearchInput = document.querySelector("#locationSearchInput");
const locationPickerMap = document.querySelector("#locationPickerMap");
const cancelEditButton = document.querySelector("#cancelEditButton");
const form = document.querySelector("#petForm");
const submitButton = form.querySelector("button[type='submit']");

const placeholder = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 800 600'%3E%3Crect width='800' height='600' fill='%23c7ead9'/%3E%3Cpath d='M194 389c29-75 92-122 164-122s136 47 164 122c11 29-10 60-41 60H235c-31 0-52-31-41-60Z' fill='%23147d7f'/%3E%3Ccircle cx='286' cy='227' r='54' fill='%23e85d4f'/%3E%3Ccircle cx='430' cy='205' r='66' fill='%23f2b84b'/%3E%3Ccircle cx='529' cy='270' r='48' fill='%23356ac3'/%3E%3Ccircle cx='213' cy='300' r='42' fill='%23ffffff'/%3E%3C/svg%3E";

let pets = [];
let currentView = "list";
let selectedPhotoData = "";
let map;
let markerLayer;
let pickerMap;
let pickerMarker;
const ownerCodesKey = "pet-finder-owner-codes";
let ownerCodes = JSON.parse(localStorage.getItem(ownerCodesKey) || "{}");

function statusText(status) {
  return status === "lost" ? "Perdida" : "Encontrada";
}

function caseText(caseStatus) {
  return caseStatus === "reunited" ? "Reencontrada" : "Activa";
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

function hasCoordinates(pet) {
  return Number.isFinite(Number(pet.latitude)) && Number.isFinite(Number(pet.longitude));
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
  document.querySelector("#totalCount").textContent = active.length;
  document.querySelector("#lostCount").textContent = active.filter((pet) => pet.status === "lost").length;
  document.querySelector("#foundCount").textContent = active.filter((pet) => pet.status === "found").length;
  document.querySelector("#reunitedCount").textContent = list.filter((pet) => pet.caseStatus === "reunited").length;
}

function renderAreaOptions() {
  const selected = areaFilter.value;
  const areas = [...new Set(pets.map((pet) => pet.area).filter(Boolean))].sort((a, b) => a.localeCompare(b, "es"));
  areaFilter.innerHTML = `<option value="all">Todas</option>${areas.map((area) => `<option value="${escapeHtml(area)}">${escapeHtml(area)}</option>`).join("")}`;
  areaFilter.value = areas.includes(selected) ? selected : "all";
}

function filteredPets() {
  const term = searchInput.value.trim().toLowerCase();
  const status = statusFilter.value;
  const caseStatus = caseFilter.value;
  const species = speciesFilter.value;
  const area = areaFilter.value;
  return pets.filter((pet) => {
    const currentCase = pet.caseStatus || "active";
    const text = `${pet.name} ${pet.species} ${pet.area} ${pet.crossStreet || ""} ${pet.color} ${pet.description}`.toLowerCase();
    return (status === "all" || pet.status === status) &&
      (caseStatus === "all" || currentCase === caseStatus) &&
      (species === "all" || pet.species === species) &&
      (area === "all" || pet.area === area) &&
      text.includes(term);
  });
}

function ensureMap() {
  if (map || !window.L) return;
  map = L.map(mapView, { scrollWheelZoom: false }).setView([-34.603722, -58.381592], 11);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "&copy; OpenStreetMap"
  }).addTo(map);
  markerLayer = L.layerGroup().addTo(map);
}

function ensurePickerMap() {
  if (pickerMap || !window.L) return;
  pickerMap = L.map(locationPickerMap, { scrollWheelZoom: false }).setView([-34.603722, -58.381592], 11);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "&copy; OpenStreetMap"
  }).addTo(pickerMap);
  pickerMap.on("click", (event) => {
    setFormCoordinates(event.latlng.lat, event.latlng.lng, true);
  });
  setTimeout(() => pickerMap.invalidateSize(), 0);
}

function setFormCoordinates(latitude, longitude, moveMap = false) {
  const lat = Number(latitude);
  const lng = Number(longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
  form.elements.latitude.value = lat.toFixed(6);
  form.elements.longitude.value = lng.toFixed(6);
  ensurePickerMap();
  const position = [lat, lng];
  if (!pickerMarker) {
    pickerMarker = L.marker(position, { draggable: true }).addTo(pickerMap);
    pickerMarker.on("dragend", () => {
      const current = pickerMarker.getLatLng();
      setFormCoordinates(current.lat, current.lng);
    });
  } else {
    pickerMarker.setLatLng(position);
  }
  if (moveMap) pickerMap.setView(position, 15);
}

async function searchLocation() {
  const query = locationSearchInput.value.trim() || [form.elements.crossStreet.value, form.elements.area.value].filter(Boolean).join(", ");
  if (!query) {
    alert("Escribe una direccion, plaza, barrio o referencia.");
    return;
  }
  searchLocationButton.disabled = true;
  searchLocationButton.textContent = "Buscando...";
  try {
    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.set("format", "json");
    url.searchParams.set("limit", "1");
    url.searchParams.set("addressdetails", "1");
    url.searchParams.set("q", query);
    const response = await fetch(url.toString(), { headers: { "Accept": "application/json" } });
    const results = await response.json();
    if (!results.length) {
      alert("No encontre esa ubicacion. Prueba con barrio, ciudad y provincia.");
      return;
    }
    const result = results[0];
    setFormCoordinates(result.lat, result.lon, true);
    const address = result.address || {};
    const area = address.suburb || address.neighbourhood || address.city_district || address.city || address.town || address.village;
    if (area && !form.elements.area.value.trim()) form.elements.area.value = area;
    if (!form.elements.crossStreet.value.trim()) form.elements.crossStreet.value = result.display_name.split(",").slice(0, 2).join(", ");
  } catch {
    alert("No se pudo buscar la ubicacion en este momento.");
  } finally {
    searchLocationButton.disabled = false;
    searchLocationButton.textContent = "Buscar en mapa";
  }
}

function renderMap(list) {
  ensureMap();
  if (!map) {
    mapView.innerHTML = '<p class="empty-state">No se pudo cargar el mapa.</p>';
    return;
  }

  markerLayer.clearLayers();
  const locatedPets = list.filter(hasCoordinates);
  locatedPets.forEach((pet) => {
    const marker = L.marker([Number(pet.latitude), Number(pet.longitude)]);
    marker.bindPopup(`
      <strong>${escapeHtml(pet.name)}</strong><br>
      ${escapeHtml(statusText(pet.status))} - ${escapeHtml(caseText(pet.caseStatus || "active"))}<br>
      ${escapeHtml(pet.area)}<br>
      ${escapeHtml(pet.crossStreet || "Referencia no indicada")}
    `);
    markerLayer.addLayer(marker);
  });

  if (locatedPets.length) {
    const bounds = L.latLngBounds(locatedPets.map((pet) => [Number(pet.latitude), Number(pet.longitude)]));
    map.fitBounds(bounds, { padding: [35, 35], maxZoom: 15 });
  } else {
    map.setView([-34.603722, -58.381592], 11);
  }
  setTimeout(() => map.invalidateSize(), 0);
}

function cardActions(pet) {
  if (!isOwnedPet(pet.id)) {
    return `
      <div class="card-actions single">
        <button class="small-button" type="button" data-action="report" data-id="${escapeHtml(pet.id)}">Denunciar</button>
      </div>
    `;
  }

  const isReunited = pet.caseStatus === "reunited";
  return `
    <div class="card-actions">
      <button class="small-button" type="button" data-action="edit" data-id="${escapeHtml(pet.id)}">Editar</button>
      <button class="small-button" type="button" data-action="toggle-reunited" data-id="${escapeHtml(pet.id)}">${isReunited ? "Reactivar" : "Reencontrada"}</button>
      <button class="small-button danger" type="button" data-action="delete" data-id="${escapeHtml(pet.id)}">Borrar</button>
    </div>
  `;
}

function renderPets() {
  renderAreaOptions();
  const filtered = filteredPets();

  cardsGrid.innerHTML = filtered.map((pet) => `
    <article class="pet-card ${pet.caseStatus === "reunited" ? "is-reunited" : ""}">
      <img src="${escapeHtml(pet.photo || placeholder)}" alt="Foto de ${escapeHtml(pet.name)}" onerror="this.src='${placeholder}'">
      <div class="pet-body">
        <div class="pet-top">
          <h3>${escapeHtml(pet.name)}</h3>
          <span class="badge ${escapeHtml(pet.status)}">${escapeHtml(statusText(pet.status))}</span>
        </div>
        <div class="meta">
          <span>${escapeHtml(caseText(pet.caseStatus || "active"))}</span>
          <span>${escapeHtml(pet.species)}</span>
          <span>${escapeHtml(pet.area)}</span>
          <span>${escapeHtml(pet.crossStreet || "Sin referencia")}</span>
          <span>${escapeHtml(new Date(pet.date + "T00:00:00").toLocaleDateString("es-AR"))}</span>
          <span>${escapeHtml(pet.color)}</span>
          ${hasCoordinates(pet) ? "<span>Con ubicacion</span>" : "<span>Sin coordenadas</span>"}
        </div>
        <p>${escapeHtml(pet.description)}</p>
        <a class="contact" href="${escapeHtml(contactHref(pet.contact))}" target="_blank" rel="noreferrer">${escapeHtml(pet.contact)}</a>
        ${cardActions(pet)}
      </div>
    </article>
  `).join("");

  cardsGrid.hidden = currentView !== "list";
  mapView.hidden = currentView !== "map";
  if (currentView === "map") renderMap(filtered);
  emptyState.hidden = filtered.length !== 0;
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

async function loadPets() {
  pets = await requestJson("/api/pets");
  renderPets();
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
    latitude: data.get("latitude"),
    longitude: data.get("longitude"),
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
  submitButton.textContent = "Publicar aviso";
  cancelEditButton.hidden = true;
  resetPhotoPreview();
  setTimeout(() => {
    ensurePickerMap();
    if (pickerMarker) {
      pickerMap.removeLayer(pickerMarker);
      pickerMarker = null;
    }
    pickerMap.setView([-34.603722, -58.381592], 11);
  }, 0);
}

function editPet(id) {
  const pet = pets.find((item) => item.id === id);
  if (!pet) return;
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
  form.elements.latitude.value = pet.latitude ?? "";
  form.elements.longitude.value = pet.longitude ?? "";
  if (hasCoordinates(pet)) {
    setFormCoordinates(pet.latitude, pet.longitude, true);
  }
  form.elements.photo.value = pet.photo && !pet.photo.startsWith("data:image/") ? pet.photo : "";
  if (pet.photo) {
    photoPreview.src = pet.photo;
    photoPreview.hidden = false;
  }
  selectedPhotoData = "";
  submitButton.textContent = "Guardar cambios";
  cancelEditButton.hidden = false;
  document.querySelector("#publicar").scrollIntoView({ behavior: "smooth" });
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
    renderPets();
    document.querySelector("#avisos").scrollIntoView({ behavior: "smooth" });
  } catch (error) {
    alert(error.message);
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = form.elements.id.value ? "Guardar cambios" : "Publicar aviso";
  }
}

async function toggleReunited(id) {
  const pet = pets.find((item) => item.id === id);
  if (!pet) return;
  const updated = { ...pet, caseStatus: pet.caseStatus === "reunited" ? "active" : "reunited" };
  const savedPet = await requestJson(`/api/pets/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify({ ...updated, managementCode: ownerCodes[id] })
  });
  pets = pets.map((item) => item.id === id ? { ...item, ...savedPet } : item);
  renderPets();
}

async function removePet(id) {
  if (!confirm("Seguro que quieres borrar esta publicacion? Esta accion no se puede deshacer.")) return;
  await requestJson(`/api/pets/${encodeURIComponent(id)}`, {
    method: "DELETE",
    body: JSON.stringify({ managementCode: ownerCodes[id] })
  });
  pets = pets.filter((pet) => pet.id !== id);
  forgetOwnerCode(id);
  renderPets();
}

async function reportPet(id) {
  if (!confirm("Quieres denunciar esta publicacion para revision?")) return;
  await requestJson(`/api/pets/${encodeURIComponent(id)}/report`, { method: "POST", body: "{}" });
  alert("Gracias. La denuncia fue registrada.");
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

useLocationButton.addEventListener("click", () => {
  if (!navigator.geolocation) {
    alert("Tu navegador no permite obtener ubicacion.");
    return;
  }
  useLocationButton.disabled = true;
  useLocationButton.textContent = "Obteniendo ubicacion...";
  navigator.geolocation.getCurrentPosition((position) => {
    setFormCoordinates(position.coords.latitude, position.coords.longitude, true);
    useLocationButton.disabled = false;
    useLocationButton.textContent = "Usar mi ubicacion aproximada";
  }, () => {
    alert("No se pudo obtener la ubicacion. Puedes cargar latitud y longitud manualmente.");
    useLocationButton.disabled = false;
    useLocationButton.textContent = "Usar mi ubicacion aproximada";
}, { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 });
});

searchLocationButton.addEventListener("click", searchLocation);
locationSearchInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    searchLocation();
  }
});
["latitude", "longitude"].forEach((name) => {
  form.elements[name].addEventListener("change", () => {
    if (form.elements.latitude.value && form.elements.longitude.value) {
      setFormCoordinates(form.elements.latitude.value, form.elements.longitude.value, true);
    }
  });
});

cardsGrid.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-action]");
  if (!button) return;
  const { action, id } = button.dataset;
  try {
    if (action === "edit") editPet(id);
    if (action === "toggle-reunited") await toggleReunited(id);
    if (action === "delete") await removePet(id);
    if (action === "report") await reportPet(id);
  } catch (error) {
    alert(error.message);
  }
});

form.addEventListener("submit", savePet);
cancelEditButton.addEventListener("click", resetForm);
[searchInput, statusFilter, caseFilter, speciesFilter, areaFilter].forEach((control) => control.addEventListener("input", renderPets));
viewButtons.forEach((button) => {
  button.addEventListener("click", () => {
    currentView = button.dataset.view;
    viewButtons.forEach((item) => item.classList.toggle("active", item === button));
    renderPets();
  });
});

resetForm();
ensurePickerMap();
loadPets().catch((error) => {
  emptyState.hidden = false;
  emptyState.textContent = error.message;
});
