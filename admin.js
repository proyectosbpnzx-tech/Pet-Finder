const loginForm = document.querySelector("#adminLogin");
const passwordInput = document.querySelector("#adminPassword");
const panel = document.querySelector("#adminPanel");
const list = document.querySelector("#adminList");
const empty = document.querySelector("#adminEmpty");
const filter = document.querySelector("#adminFilter");
const refreshButton = document.querySelector("#refreshAdmin");
const placeholder = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 800 600'%3E%3Crect width='800' height='600' fill='%23c7ead9'/%3E%3Cpath d='M194 389c29-75 92-122 164-122s136 47 164 122c11 29-10 60-41 60H235c-31 0-52-31-41-60Z' fill='%23147d7f'/%3E%3Ccircle cx='286' cy='227' r='54' fill='%23e85d4f'/%3E%3Ccircle cx='430' cy='205' r='66' fill='%23f2b84b'/%3E%3Ccircle cx='529' cy='270' r='48' fill='%23356ac3'/%3E%3Ccircle cx='213' cy='300' r='42' fill='%23ffffff'/%3E%3C/svg%3E";

let adminToken = sessionStorage.getItem("pet-finder-admin-token") || "";
let pets = [];

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#039;"
  }[character]));
}

function statusText(status) {
  return status === "lost" ? "Perdida" : "Encontrada";
}

function isHidden(pet) {
  return pet.isHidden === true || pet.isHidden === 1;
}

async function adminFetch(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${adminToken}`,
      ...(options.headers || {})
    }
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || "No se pudo completar la accion.");
  return payload;
}

function filteredPets() {
  if (filter.value === "reported") return pets.filter((pet) => Number(pet.reportCount || 0) > 0);
  if (filter.value === "hidden") return pets.filter(isHidden);
  return pets;
}

function render() {
  const visible = filteredPets();
  list.innerHTML = visible.map((pet) => `
    <article class="admin-card">
      <img src="${escapeHtml(pet.photo || placeholder)}" alt="Foto de ${escapeHtml(pet.name)}" onerror="this.src='${placeholder.replace(/'/g, "\\'")}'">
      <div class="admin-content">
        <div>
          <h2>${escapeHtml(pet.name)}</h2>
          <div class="admin-meta">
            <span>${escapeHtml(statusText(pet.status))}</span>
            <span>${escapeHtml(pet.species)}</span>
            <span>${escapeHtml(pet.area)}</span>
            <span>${escapeHtml(pet.caseStatus || "active")}</span>
            <span>${Number(pet.reportCount || 0)} denuncias</span>
            <span>${isHidden(pet) ? "Oculta" : "Visible"}</span>
          </div>
        </div>
        <p>${escapeHtml(pet.description)}</p>
        <p>${escapeHtml(pet.contact)} - ${escapeHtml(pet.crossStreet || "Sin referencia")}</p>
        <div class="admin-actions">
          <button class="small-button" type="button" data-action="${isHidden(pet) ? "restore" : "hide"}" data-id="${escapeHtml(pet.id)}">${isHidden(pet) ? "Restaurar" : "Ocultar"}</button>
          <button class="small-button danger" type="button" data-action="delete" data-id="${escapeHtml(pet.id)}">Borrar</button>
        </div>
      </div>
    </article>
  `).join("");
  empty.hidden = visible.length !== 0;
}

async function loadPets() {
  pets = await adminFetch("/api/admin/pets");
  render();
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  adminToken = passwordInput.value.trim();
  sessionStorage.setItem("pet-finder-admin-token", adminToken);
  try {
    await loadPets();
    loginForm.hidden = true;
    panel.hidden = false;
  } catch (error) {
    alert(error.message);
  }
});

list.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-action]");
  if (!button) return;
  const { action, id } = button.dataset;
  if (action === "delete" && !confirm("Seguro que quieres borrar esta publicacion?")) return;
  await adminFetch(`/api/admin/pets/${encodeURIComponent(id)}/${action}`, { method: "POST", body: "{}" });
  await loadPets();
});

filter.addEventListener("input", render);
refreshButton.addEventListener("click", loadPets);

if (adminToken) {
  passwordInput.value = adminToken;
}
