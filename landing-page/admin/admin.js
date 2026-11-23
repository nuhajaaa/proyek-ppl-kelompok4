const sections = [
  { id: "site", label: "Identitas & navigasi", icon: "⌂", description: "Atur nama brand, menu, dan pita kategori layanan." },
  { id: "hero", label: "Hero & statistik", icon: "✦", description: "Ubah headline, tombol, statistik, dan tile visual di bagian pembuka." },
  { id: "services", label: "Layanan & harga", icon: "▣", description: "Kelola daftar layanan, deskripsi, ikon, dan harga yang tampil." },
  { id: "portfolio", label: "Portofolio", icon: "▧", description: "Atur filter dan project yang ditampilkan pada galeri." },
  { id: "about", label: "Tentang & keunggulan", icon: "◉", description: "Perbarui profil studio, warna visual, dan poin keunggulan." },
  { id: "process", label: "Proses kerja", icon: "⇢", description: "Sesuaikan langkah-langkah proses kerja." },
  { id: "testimonials", label: "Testimoni", icon: "☆", description: "Kelola kutipan serta identitas klien." },
  { id: "contact", label: "Kontak & ajakan", icon: "✉", description: "Ubah teks ajakan dan tombol kontak." },
  { id: "footer", label: "Footer", icon: "▤", description: "Atur informasi kontak dan teks bagian bawah halaman." },
  { id: "theme", label: "Warna & layout", icon: "◐", description: "Atur palet warna, lebar halaman, jarak, dan bentuk kartu." }
];

const sectionContentKeys = {
  site: ["brand", "navigation", "serviceRibbon"],
  hero: ["hero"],
  services: ["servicesHeading", "services"],
  portfolio: ["portfolioHeading", "portfolioFilters", "projects"],
  about: ["about"],
  process: ["process"],
  testimonials: ["testimonials"],
  contact: ["contact"],
  footer: ["footer"],
  theme: ["theme", "layout"]
};

const fieldLabels = {
  about: "Tentang",
  addButton: "Tombol tambah layanan",
  brand: "Brand",
  cardRadius: "Radius sudut kartu (px)",
  category: "Kategori",
  checkoutLabel: "Tautan checkout",
  client: "Klien",
  companyTitle: "Judul tautan perusahaan",
  contact: "Kontak",
  contactTitle: "Judul tautan kontak",
  containerWidth: "Lebar konten maksimal (px)",
  copyright: "Teks hak cipta",
  description: "Deskripsi",
  email: "Alamat email",
  end: "Warna akhir",
  features: "Keunggulan",
  gallery: "Tile hero",
  galleryGap: "Jarak antar tile (%)",
  galleryRatio: "Rasio lebar/tinggi kolase",
  galleryStagger: "Offset tile kanan atas (%)",
  green: "Hijau tombol",
  hero: "Hero",
  icon: "Logo / inisial",
  imageColors: "Warna visual tentang",
  ink: "Cokelat gelap",
  inkSoft: "Cokelat tombol",
  instagramHandle: "Nama Instagram",
  instagramUrl: "Tautan Instagram",
  items: "Daftar",
  label: "Label",
  layout: "Layout",
  name: "Nama",
  navigation: "Navigasi utama",
  number: "Nomor telepon",
  orderButton: "Tombol pesan",
  paper: "Latar terang",
  portfolioFilters: "Filter portofolio",
  price: "Harga (Rupiah)",
  priceLabel: "Label harga",
  process: "Proses",
  projects: "Project",
  quote: "Kutipan",
  role: "Jabatan",
  sand: "Latar beige",
  sectionSpacing: "Jarak antar bagian (px)",
  services: "Layanan",
  servicesTitle: "Judul tautan layanan",
  serviceRibbon: "Kategori pita layanan",
  start: "Warna awal",
  stats: "Statistik",
  steps: "Langkah kerja",
  tagline: "Deskripsi singkat brand",
  tan: "Warna aksen",
  testimonials: "Testimoni",
  theme: "Palet warna",
  title: "Judul",
  value: "Nilai",
  viewAllButton: "Tombol semua karya",
  viewAllNote: "Catatan tombol karya",
  whatsappButton: "Tombol WhatsApp",
  whatsappDisplay: "Nomor WhatsApp (tampilan)",
  whatsappNumber: "Nomor WhatsApp (format internasional)",
  year: "Tahun"
};

const longTextKeys = new Set(["description", "quote", "tagline", "title", "viewAllNote"]);
const fixedArrayPaths = new Set(["hero.gallery", "about.imageColors"]);
const loginPage = document.querySelector("#login-page");
const adminApp = document.querySelector("#admin-app");
const loginForm = document.querySelector("#login-form");
const loginMessage = document.querySelector("#login-message");
const editorMain = document.querySelector("#editor-main");
const sectionNav = document.querySelector("#section-nav");
const saveButton = document.querySelector("#save-button");
const saveStatus = document.querySelector("#save-status");
let content;
let currentSection = "site";
let isDirty = false;
let fieldCounter = 0;

function makeElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function setStatus(message, isError = false) {
  saveStatus.textContent = message;
  saveStatus.classList.toggle("is-dirty", isError || isDirty);
}

function setLoginMessage(message, isError = true) {
  loginMessage.textContent = message;
  loginMessage.style.color = isError ? "var(--admin-error)" : "var(--admin-green-dark)";
}

function cloneValue(value) {
  return JSON.parse(JSON.stringify(value));
}

async function readResponse(response) {
  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new Error("Respons server tidak dapat dibaca.");
  }
  if (!response.ok) throw new Error(payload.error || `Request gagal (${response.status}).`);
  return payload;
}

function showLogin(message = "") {
  adminApp.hidden = true;
  loginPage.hidden = false;
  setLoginMessage(message, Boolean(message));
  if (message) document.querySelector("#password").value = "";
}

function renderNavigation() {
  sectionNav.replaceChildren(...sections.map((section) => {
    const button = makeElement("button", `nav-item${section.id === currentSection ? " is-active" : ""}`);
    button.type = "button";
    button.dataset.section = section.id;
    button.setAttribute("aria-current", section.id === currentSection ? "page" : "false");
    const icon = makeElement("span", "nav-icon", section.icon);
    icon.setAttribute("aria-hidden", "true");
    button.append(icon, document.createTextNode(section.label));
    return button;
  }));
}

function fieldLabel(key) {
  return fieldLabels[key] || key.replace(/([A-Z])/g, " $1").replace(/^./, (letter) => letter.toUpperCase());
}

function renderTextField(key, value, valuePath) {
  const field = makeElement("label", "editor-field");
  const id = `admin-field-${fieldCounter++}`;
  const label = makeElement("span", "", fieldLabel(key));
  label.htmlFor = id;
  let input;
  if (typeof value === "number") {
    input = document.createElement("input");
    input.type = "number";
    input.step = Number.isInteger(value) ? "1" : "0.001";
    input.value = String(value);
  } else if (typeof value === "string" && /^#[\da-f]{6}$/i.test(value)) {
    const colorControl = makeElement("span", "color-field");
    input = document.createElement("input");
    input.type = "color";
    input.value = value;
    colorControl.append(input, makeElement("code", "color-value", value));
    field.append(label, colorControl);
    input.id = id;
    input.dataset.path = JSON.stringify(valuePath);
    input.setAttribute("aria-label", fieldLabel(key));
    return field;
  } else if (typeof value === "string" && (longTextKeys.has(key) || value.length > 90 || value.includes("\n"))) {
    input = document.createElement("textarea");
    input.value = value;
  } else {
    input = document.createElement("input");
    input.type = "text";
    input.value = value;
  }
  input.id = id;
  input.dataset.path = JSON.stringify(valuePath);
  if (input.tagName === "INPUT") input.autocomplete = "off";
  field.append(label, input);
  return field;
}

function createArrayItem(key, arrayPath, array) {
  const lastKey = arrayPath[arrayPath.length - 1];
  if (lastKey === "services") return { id: `service-${Date.now()}`, icon: "✦", name: "Layanan baru", description: "", price: 0 };
  if (lastKey === "projects") return { name: "Project baru", category: "Layanan", client: "", year: String(new Date().getFullYear()), colors: ["#593a28", "#d0a77c"] };
  if (lastKey === "features") return { icon: "✦", title: "Keunggulan baru", description: "" };
  if (lastKey === "steps") return { number: String(array.length + 1).padStart(2, "0"), title: "Langkah baru", description: "" };
  if (lastKey === "items") return { quote: "", name: "Nama klien", role: "" };
  if (lastKey === "stats") return { value: "0", label: "Statistik baru" };
  if (lastKey === "navigation") return { label: "Menu baru", href: "#beranda" };
  if (lastKey === "portfolioFilters") return { label: "Kategori baru", value: "Kategori baru" };
  if (lastKey === "gallery") return { label: "Tile baru", start: "#79553c", end: "#d1aa81" };
  if (lastKey === "serviceRibbon") return "Layanan baru";
  if (array.length > 0) return cloneValue(array[0]);
  return typeof key === "string" && key.toLowerCase().includes("color") ? "#cba47c" : "";
}

function renderArray(key, value, valuePath) {
  const wrapper = makeElement("section", "repeater");
  const heading = makeElement("div", "repeater-heading");
  heading.append(makeElement("h3", "", fieldLabel(key)));
  const isFixed = fixedArrayPaths.has(valuePath.join(".")) || valuePath[valuePath.length - 1] === "colors";
  if (!isFixed) {
    const addButton = makeElement("button", "text-button", "+ Tambah");
    addButton.type = "button";
    addButton.dataset.action = "add";
    addButton.dataset.path = JSON.stringify(valuePath);
    heading.append(addButton);
  }
  const items = makeElement("div", "repeater-items");
  value.forEach((item, index) => {
    const card = makeElement("article", "repeater-card");
    const cardHeading = makeElement("div", "repeater-card-heading");
    cardHeading.append(makeElement("strong", "", `Item ${index + 1}`));
    if (!isFixed) {
      const removeButton = makeElement("button", "text-button danger", "Hapus");
      removeButton.type = "button";
      removeButton.dataset.action = "remove";
      removeButton.dataset.path = JSON.stringify(valuePath);
      removeButton.dataset.index = String(index);
      cardHeading.append(removeButton);
    }
    card.append(cardHeading);
    if (item !== null && typeof item === "object" && !Array.isArray(item)) {
      const fields = makeElement("div", "editor-fields");
      for (const [childKey, childValue] of Object.entries(item)) {
        fields.append(renderValue(childKey, childValue, [...valuePath, index, childKey]));
      }
      card.append(fields);
    } else {
      card.append(renderTextField(key, item, [...valuePath, index]));
    }
    items.append(card);
  });
  if (value.length === 0) items.append(makeElement("p", "editor-hint", "Belum ada data. Pilih “Tambah” untuk menambahkan item."));
  wrapper.append(heading, items);
  return wrapper;
}

function renderValue(key, value, valuePath) {
  if (Array.isArray(value)) return renderArray(key, value, valuePath);
  if (value !== null && typeof value === "object") {
    const group = document.createElement("fieldset");
    group.className = "editor-group";
    const legend = document.createElement("legend");
    legend.textContent = fieldLabel(key);
    group.append(legend);
    const fields = makeElement("div", "editor-fields");
    for (const [childKey, childValue] of Object.entries(value)) {
      fields.append(renderValue(childKey, childValue, [...valuePath, childKey]));
    }
    group.append(fields);
    return group;
  }
  return renderTextField(key, value, valuePath);
}

function setValueAtPath(object, path, value) {
  let target = object;
  for (const key of path.slice(0, -1)) target = target[key];
  target[path[path.length - 1]] = value;
}

function getValueAtPath(object, path) {
  return path.reduce((target, key) => target[key], object);
}

function renderEditor() {
  const section = sections.find((item) => item.id === currentSection);
  document.querySelector("#current-section-title").textContent = section.label;
  renderNavigation();
  const intro = makeElement("header", "section-intro");
  intro.append(makeElement("h2", "", section.label), makeElement("p", "", section.description));
  const titleHelp = section.id === "theme" || section.id === "layout"
    ? "Gunakan pemilih warna atau nilai angka. Nilai layout memiliki batas aman."
    : "Perubahan baru tampil di landing page setelah disimpan.";
  intro.append(makeElement("p", "editor-hint", titleHelp));
  const card = document.createElement("fieldset");
  card.className = "editor-card";
  const legend = document.createElement("legend");
  legend.textContent = section.label;
  card.append(legend);
  const fields = makeElement("div", "editor-fields");
  for (const key of sectionContentKeys[currentSection]) {
    fields.append(renderValue(key, content[key], [key]));
  }
  card.append(fields);
  editorMain.replaceChildren(intro, card);
}

function markDirty() {
  isDirty = true;
  saveButton.disabled = false;
  setStatus("Ada perubahan belum disimpan", true);
}

async function loadAdminContent() {
  const response = await fetch("/api/content", { cache: "no-store" });
  const payload = await readResponse(response);
  content = payload.content;
  currentSection = "site";
  isDirty = false;
  adminApp.hidden = false;
  loginPage.hidden = true;
  saveButton.disabled = true;
  setStatus("Semua perubahan tersimpan");
  renderEditor();
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const submitButton = loginForm.querySelector("button[type=submit]");
  const username = document.querySelector("#username").value.trim();
  const passwordInput = document.querySelector("#password");
  const password = passwordInput.value;
  submitButton.disabled = true;
  submitButton.textContent = "Memeriksa akses...";
  setLoginMessage("");
  try {
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password })
    });
    await readResponse(response);
    passwordInput.value = "";
    await loadAdminContent();
  } catch (error) {
    console.error("Login admin gagal:", error);
    setLoginMessage(error.message === "Failed to fetch"
      ? "Server tidak dapat dihubungi. Pastikan server Node.js sedang berjalan."
      : error.message);
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "Masuk sebagai admin";
  }
});

sectionNav.addEventListener("click", (event) => {
  const button = event.target.closest("[data-section]");
  if (!button) return;
  currentSection = button.dataset.section;
  renderEditor();
  document.querySelector("#admin-sidebar").classList.remove("is-open");
  document.querySelector("#sidebar-scrim").hidden = true;
});

editorMain.addEventListener("input", (event) => {
  const input = event.target.closest("[data-path]");
  if (!input || input.dataset.action) return;
  const path = JSON.parse(input.dataset.path);
  const oldValue = getValueAtPath(content, path);
  let nextValue = input.type === "number" ? Number(input.value) : input.value;
  if (input.type === "number" && input.value === "") nextValue = "";
  setValueAtPath(content, path, nextValue);
  if (input.type === "color") {
    input.closest(".color-field").querySelector(".color-value").textContent = nextValue;
  }
  if (oldValue !== nextValue) markDirty();
});

editorMain.addEventListener("click", (event) => {
  const button = event.target.closest("[data-action]");
  if (!button) return;
  const path = JSON.parse(button.dataset.path);
  const array = getValueAtPath(content, path);
  if (button.dataset.action === "add") {
    array.push(createArrayItem(path[path.length - 1], path, array));
  } else if (button.dataset.action === "remove") {
    array.splice(Number(button.dataset.index), 1);
  } else {
    return;
  }
  markDirty();
  renderEditor();
});

saveButton.addEventListener("click", async () => {
  if (!isDirty) return;
  saveButton.disabled = true;
  saveButton.textContent = "Menyimpan...";
  setStatus("Menyimpan perubahan...");
  try {
    const response = await fetch("/api/content", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(content)
    });
    const payload = await readResponse(response);
    content = payload.content;
    isDirty = false;
    setStatus("Perubahan tersimpan");
    renderEditor();
  } catch (error) {
    console.error("Perubahan konten gagal disimpan:", error);
    setStatus(error.message, true);
    if (error.message.includes("Sesi admin")) showLogin("Sesi admin berakhir. Silakan masuk kembali.");
  } finally {
    saveButton.textContent = "Simpan perubahan";
    saveButton.disabled = !isDirty;
  }
});

document.querySelector("#logout-button").addEventListener("click", async () => {
  try {
    const response = await fetch("/api/auth/logout", { method: "POST" });
    await readResponse(response);
    content = undefined;
    showLogin("Anda sudah keluar dari panel admin.", false);
  } catch (error) {
    console.error("Logout admin gagal:", error);
    setStatus(error.message, true);
  }
});

document.querySelector("#sidebar-toggle").addEventListener("click", () => {
  document.querySelector("#admin-sidebar").classList.add("is-open");
  document.querySelector("#sidebar-scrim").hidden = false;
});

document.querySelector("#sidebar-scrim").addEventListener("click", () => {
  document.querySelector("#admin-sidebar").classList.remove("is-open");
  document.querySelector("#sidebar-scrim").hidden = true;
});

window.addEventListener("beforeunload", (event) => {
  if (!isDirty) return;
  event.preventDefault();
  event.returnValue = "";
});

fetch("/api/auth/session", { cache: "no-store" })
  .then(readResponse)
  .then((session) => session.authenticated ? loadAdminContent() : showLogin())
  .catch((error) => {
    console.error("Status sesi admin gagal diperiksa:", error);
    showLogin("Server tidak dapat dihubungi. Jalankan server Node.js terlebih dahulu.");
  });
