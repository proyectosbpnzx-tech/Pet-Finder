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
const cancelEditButton = document.querySelector("#cancelEditButton");
const form = document.querySelector("#petForm");
const submitButton = form.querySelector("button[type='submit']");

const placeholder = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 800 600'%3E%3Crect width='800' height='600' fill='%23c7ead9'/%3E%3Cpath d='M194 389c29-75 92-122 164-122s136 47 164 122c11 29-10 60-41 60H235c-31 0-52-31-41-60Z' fill='%23147d7f'/%3E%3Ccircle cx='286' cy='227' r='54' fill='%23e85d4f'/%3E%3Ccircle cx='430' cy='205' r='66' fill='%23f2b84b'/%3E%3Ccircle cx='529' cy='270' r='48' fill='%23356ac3'/%3E%3Ccircle cx='213' cy='300' r='42' fill='%23ffffff'/%3E%3C/svg%3E";

let pets = [];
let currentView = "list";
let selectedPhotoData = "";
let map;
let markerLayer;
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

function generateShareMessage(pet) {
  const status = statusText(pet.status);
  const message = `🐾 *${escapeHtml(pet.name)}* - ${status}\n\n📍 ${escapeHtml(pet.area)}\n🗓️ ${new Date(pet.date + "T00:00:00").toLocaleDateString("es-AR")}\n🎨 ${escapeHtml(pet.color)}\n\n${escapeHtml(pet.description)}\n\n📱 Contacto: ${escapeHtml(pet.contact)}\n\n#PetFinder #Mascotas`;
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

function renderMap(list) {
  ensureMap();
  if (!map) {
    mapView.innerHTML = '<p class="empty-state">No se pudo cargar el mapa.</p>';
    return;
  }

  markerLayer.clearLayers();
  map.setView([-34.603722, -58.381592], 11);
  setTimeout(() => map.invalidateSize(), 0);
}

function cardActions(pet) {
  const shareMessage = generateShareMessage(pet);
  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(shareMessage)}`;
  const facebookUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(window.location.href)}&quote=${encodeURIComponent(`Ayuda a encontrar a ${pet.name}`)}`;
  const instagramText = `Check out Pet Finder - Help find ${pet.name}!`;
  
  if (!isOwnedPet(pet.id)) {
    return `
      <div class="card-actions single">
        <button class="small-button" type="button" data-action="report" data-id="${escapeHtml(pet.id)}">Denunciar</button>
      </div>
      <div class="card-share">
        <a href="${whatsappUrl}" target="_blank" rel="noreferrer" title="Compartir en WhatsApp" class="share-button whatsapp">
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.67-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.076 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421-7.403h-.004a9.87 9.87 0 00-9.746 9.798c0 2.734.732 5.369 2.124 7.698L2.457 24l8.332-2.196c2.304 1.312 4.882 2.021 7.57 2.021 9.762 0 17.692-7.931 17.692-17.692 0-4.728-1.921-9.179-5.408-12.514-3.487-3.334-8.073-5.178-12.888-5.178"/></svg>
          WhatsApp
        </a>
        <a href="${facebookUrl}" target="_blank" rel="noreferrer" title="Compartir en Facebook" class="share-button facebook">
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
          Facebook
        </a>
        <button class="small-button share-button instagram" type="button" data-action="share-instagram" data-id="${escapeHtml(pet.id)}" title="Compartir en Instagram">
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0m0 2.192c2.713 0 3.029.01 4.099.059 1.044.049 1.61.228 1.986.379.499.194.856.426 1.231.8.375.375.606.732.8 1.231.151.376.33.942.379 1.986.049 1.07.059 1.386.059 4.099s-.01 3.029-.059 4.099c-.049 1.044-.228 1.61-.379 1.986-.194.499-.426.856-.8 1.231-.375.375-.732.606-1.231.8-.376.151-.942.33-1.986.379-1.07.049-1.386.059-4.099.059s-3.029-.01-4.099-.059c-1.044-.049-1.61-.228-1.986-.379-.499-.194-.856-.426-1.231-.8-.375-.375-.606-.732-.8-1.231-.151-.376-.33-.942-.379-1.986-.049-1.07-.059-1.386-.059-4.099s.01-3.029.059-4.099c.049-1.044.228-1.61.379-1.986.194-.499.426-.856.8-1.231.375-.375.732-.606 1.231-.8.376-.151.942-.33 1.986-.379 1.07-.049 1.386-.059 4.099-.059zm-1.268.403c-.268 0-.573.013-.899.04-1.018.092-1.532.281-1.89.469-.475.196-.814.428-1.17.784-.356.356-.588.695-.784 1.17-.188.358-.377.872-.469 1.89-.027.326-.04.631-.04.899v2.531c0 .268.013.573.04.899.092 1.018.281 1.532.469 1.89.196.475.428.814.784 1.17.356.356.695.588 1.17.784.358.188.872.377 1.89.469.326.027.631.04.899.04h2.536c.268 0 .573-.013.899-.04 1.018-.092 1.532-.281 1.89-.469.475-.196.814-.428 1.17-.784.356-.356.588-.695.784-1.17.188-.358.377-.872.469-1.89.027-.326.04-.631.04-.899v-2.531c0-.268-.013-.573-.04-.899-.092-1.018-.281-1.532-.469-1.89-.196-.475-.428-.814-.784-1.17-.356-.356-.695-.588-1.17-.784-.358-.188-.872-.377-1.89-.469-.326-.027-.631-.04-.899-.04h-2.536zm5.887 1.341a1.321 1.321 0 100 2.643 1.321 1.321 0 000-2.643zm-4.619 1.204a3.137 3.137 0 110 6.274 3.137 3.137 0 010-6.274zm0 1.539a1.598 1.598 0 100 3.196 1.598 1.598 0 000-3.196z"/></svg>
          Instagram
        </button>
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
    <div class="card-share">
      <a href="${whatsappUrl}" target="_blank" rel="noreferrer" title="Compartir en WhatsApp" class="share-button whatsapp">
        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.67-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.076 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421-7.403h-.004a9.87 9.87 0 00-9.746 9.798c0 2.734.732 5.369 2.124 7.698L2.457 24l8.332-2.196c2.304 1.312 4.882 2.021 7.57 2.021 9.762 0 17.692-7.931 17.692-17.692 0-4.728-1.921-9.179-5.408-12.514-3.487-3.334-8.073-5.178-12.888-5.178"/></svg>
        WhatsApp
      </a>
      <a href="${facebookUrl}" target="_blank" rel="noreferrer" title="Compartir en Facebook" class="share-button facebook">
        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
        Facebook
      </a>
      <button class="small-button share-button instagram" type="button" data-action="share-instagram" data-id="${escapeHtml(pet.id)}" title="Compartir en Instagram">
        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0m0 2.192c2.713 0 3.029.01 4.099.059 1.044.049 1.61.228 1.986.379.499.194.856.426 1.231.8.375.375.606.732.8 1.231.151.376.33.942.379 1.986.049 1.07.059 1.386.059 4.099s-.01 3.029-.059 4.099c-.049 1.044-.228 1.61-.379 1.986-.194.499-.426.856-.8 1.231-.375.375-.732.606-1.231.8-.376.151-.942.33-1.986.379-1.07.049-1.386.059-4.099.059s-3.029-.01-4.099-.059c-1.044-.049-1.61-.228-1.986-.379-.499-.194-.856-.426-1.231-.8-.375-.375-.606-.732-.8-1.231-.151-.376-.33-.942-.379-1.986-.049-1.07-.059-1.386-.059-4.099s.01-3.029.059-4.099c.049-1.044.228-1.61.379-1.986.194-.499.426-.856.8-1.231.375-.375.732-.606 1.231-.8.376-.151.942-.33 1.986-.379 1.07-.049 1.386-.059 4.099-.059zm-1.268.403c-.268 0-.573.013-.899.04-1.018.092-1.532.281-1.89.469-.475.196-.814.428-1.17.784-.356.356-.588.695-.784 1.17-.188.358-.377.872-.469 1.89-.027.326-.04.631-.04.899v2.531c0 .268.013.573.04.899.092 1.018.281 1.532.469 1.89.196.475.428.814.784 1.17.356.356.695.588 1.17.784.358.188.872.377 1.89.469.326.027.631.04.899.04h2.536c.268 0 .573-.013.899-.04 1.018-.092 1.532-.281 1.89-.469.475-.196.814-.428 1.17-.784.356-.356.588-.695.784-1.17.188-.358.377-.872.469-1.89.027-.326.04-.631.04-.899v-2.531c0-.268-.013-.573-.04-.899-.092-1.018-.281-1.532-.469-1.89-.196-.475-.428-.814-.784-1.17-.356-.356-.695-.588-1.17-.784-.358-.188-.872-.377-1.89-.469-.326-.027-.631-.04-.899-.04h-2.536zm5.887 1.341a1.321 1.321 0 100 2.643 1.321 1.321 0 000-2.643zm-4.619 1.204a3.137 3.137 0 110 6.274 3.137 3.137 0 010-6.274zm0 1.539a1.598 1.598 0 100 3.196 1.598 1.598 0 000-3.196z"/></svg>
        Instagram
      </button>
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

cardsGrid.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-action]");
  if (!button) return;
  const { action, id } = button.dataset;
  try {
    if (action === "edit") editPet(id);
    if (action === "toggle-reunited") await toggleReunited(id);
    if (action === "delete") await removePet(id);
    if (action === "report") await reportPet(id);
    if (action === "share-instagram") {
      const pet = pets.find((item) => item.id === id);
      if (pet) {
        const message = generateShareMessage(pet);
        navigator.clipboard.writeText(message).then(() => {
          alert("Mensaje copiado al portapapeles. Puedes pegarlo en Instagram.");
          window.open("https://www.instagram.com/", "_blank");
        });
      }
    }
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
loadPets().catch((error) => {
  emptyState.hidden = false;
  emptyState.textContent = error.message;
});
