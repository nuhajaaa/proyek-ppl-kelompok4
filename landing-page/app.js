let content;
const cart = new Map();
const rupiah = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });
const serviceGrid = document.querySelector("#service-grid");
const projectGrid = document.querySelector("#project-grid");
const testimonialGrid = document.querySelector("#testimonial-grid");
const cartPanel = document.querySelector(".cart-panel");
const cartOverlay = document.querySelector(".cart-overlay");
const toast = document.querySelector(".toast-message");
let toastTimer;
let cartTrigger;

function makeElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function setText(selector, value) {
  const element = document.querySelector(selector);
  if (element) element.textContent = value;
}

function setMultiline(selector, value) {
  const element = document.querySelector(selector);
  if (!element) return;
  const lines = value.split("\n");
  element.replaceChildren();
  lines.forEach((line, index) => {
    if (index > 0) {
      const lineBreak = document.createElement("br");
      lineBreak.className = "desktop-break";
      element.append(lineBreak);
    }
    element.append(document.createTextNode(line));
  });
}

function setWhatsAppLink(element, label, phone, message) {
  const icon = makeElement("span", "", "◉");
  icon.setAttribute("aria-hidden", "true");
  element.replaceChildren(icon, document.createTextNode(` ${label}`));
  element.href = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}

function renderNavigation() {
  const navigation = document.querySelector("#primary-navigation");
  navigation.replaceChildren(...content.navigation.map((item) => {
    const link = makeElement("a", "", item.label);
    link.href = item.href;
    return link;
  }));
}

function renderServiceRibbon() {
  const ribbon = document.querySelector("#service-ribbon");
  ribbon.replaceChildren(...content.serviceRibbon.map((label) => {
    const link = makeElement("a", "", label);
    link.href = "#layanan";
    return link;
  }));
}

function renderHeroStats() {
  const stats = document.querySelector("#hero-stats");
  stats.replaceChildren(...content.hero.stats.map((item) => {
    const block = makeElement("div");
    block.append(makeElement("strong", "", item.value), makeElement("span", "", item.label));
    return block;
  }));
}

function renderHeroGallery() {
  const gallery = document.querySelector("#hero-gallery");
  [...gallery.children].forEach((tile, index) => {
    const item = content.hero.gallery[index];
    if (!item) {
      tile.hidden = true;
      return;
    }
    tile.hidden = false;
    tile.querySelector(".tile-label").textContent = item.label;
    tile.style.background = `linear-gradient(135deg, ${item.start}, ${item.end})`;
  });
}

function renderServices() {
  serviceGrid.replaceChildren(...content.services.map((service) => {
    const article = makeElement("article", "service-card");
    const icon = makeElement("span", "icon-bubble", service.icon);
    icon.setAttribute("aria-hidden", "true");
    const heading = makeElement("h3", "", service.name);
    const description = makeElement("p", "", service.description);
    const priceRow = makeElement("div", "service-price-row");
    const priceInfo = makeElement("div");
    priceInfo.append(
      makeElement("span", "price-label", content.servicesHeading.priceLabel),
      makeElement("span", "service-price", rupiah.format(service.price))
    );
    const addButton = makeElement("button", "add-button");
    addButton.type = "button";
    addButton.dataset.serviceId = service.id;
    addButton.setAttribute("aria-label", `${content.servicesHeading.addButton} ${service.name} ke keranjang`);
    const plus = makeElement("span", "", "+");
    plus.setAttribute("aria-hidden", "true");
    addButton.append(plus, document.createTextNode(` ${content.servicesHeading.addButton}`));
    priceRow.append(priceInfo, addButton);
    article.append(icon, heading, description, priceRow);
    return article;
  }));
}

function renderPortfolioFilters() {
  const filters = document.querySelector("#portfolio-filters");
  filters.replaceChildren(...content.portfolioFilters.map((filter, index) => {
    const button = makeElement("button", `filter-button${index === 0 ? " is-active" : ""}`, filter.label);
    button.type = "button";
    button.dataset.filter = filter.value;
    button.setAttribute("aria-pressed", String(index === 0));
    return button;
  }));
}

function renderProjects(filter = "Semua") {
  const visibleProjects = filter === "Semua"
    ? content.projects
    : content.projects.filter((project) => project.category === filter);
  projectGrid.replaceChildren(...visibleProjects.map((project) => {
    const article = makeElement("article", "project-card");
    const image = makeElement("div", "project-image");
    image.style.background = `linear-gradient(135deg, ${project.colors[0]}, ${project.colors[1]})`;
    const tag = makeElement("span", "project-tag", project.category);
    const play = makeElement("span", "play-icon", "▶");
    play.setAttribute("aria-hidden", "true");
    image.append(tag, play);
    article.append(image, makeElement("h3", "", project.name), makeElement("p", "", `${project.client} · ${project.year}`));
    return article;
  }));
}

function renderFeatures() {
  const grid = document.querySelector("#feature-grid");
  grid.replaceChildren(...content.about.features.map((feature) => {
    const article = makeElement("article", "feature-card");
    const icon = makeElement("span", "icon-bubble", feature.icon);
    icon.setAttribute("aria-hidden", "true");
    article.append(icon, makeElement("h3", "", feature.title), makeElement("p", "", feature.description));
    return article;
  }));
}

function renderProcess() {
  const grid = document.querySelector("#process-grid");
  grid.replaceChildren(...content.process.steps.map((step) => {
    const article = makeElement("article", "process-card");
    article.append(
      makeElement("span", "", step.number),
      makeElement("h3", "", step.title),
      makeElement("p", "", step.description)
    );
    return article;
  }));
}

function renderTestimonials() {
  testimonialGrid.replaceChildren(...content.testimonials.items.map((testimonial) => {
    const article = makeElement("article", "testimonial-card");
    const stars = makeElement("div", "testimonial-stars", "★★★★★");
    stars.setAttribute("aria-label", "5 dari 5 bintang");
    const quote = makeElement("blockquote", "", testimonial.quote);
    const author = makeElement("div", "testimonial-author");
    const avatar = makeElement("span", "avatar");
    avatar.setAttribute("aria-hidden", "true");
    const authorInfo = makeElement("div");
    authorInfo.append(makeElement("strong", "", testimonial.name), makeElement("span", "", testimonial.role));
    author.append(avatar, authorInfo);
    article.append(stars, quote, author);
    return article;
  }));
}

function renderFooterLinks() {
  const services = document.querySelector("#footer-services");
  services.replaceChildren(...content.services.map((service) => {
    const link = makeElement("a", "", service.name);
    link.href = "#layanan";
    return link;
  }));

  const companyLinks = content.navigation.filter((item) => !["#beranda", "#layanan", "#kontak"].includes(item.href));
  const company = document.querySelector("#footer-company");
  const links = companyLinks.map((item) => {
    const link = makeElement("a", "", item.label === "Proses" ? "Proses Kerja" : item.label);
    link.href = item.href;
    return link;
  });
  const checkout = makeElement("a", "", content.footer.checkoutLabel);
  checkout.href = "#layanan";
  company.replaceChildren(...links, checkout);

  const contact = document.querySelector("#footer-contact");
  const whatsapp = makeElement("a", "", `WhatsApp: ${content.footer.whatsappDisplay}`);
  whatsapp.href = `https://wa.me/${content.footer.whatsappNumber}`;
  whatsapp.target = "_blank";
  whatsapp.rel = "noreferrer";
  const email = makeElement("a", "", content.footer.email);
  email.href = `mailto:${content.footer.email}`;
  const instagram = makeElement("a", "", content.footer.instagramHandle);
  instagram.href = content.footer.instagramUrl;
  instagram.target = "_blank";
  instagram.rel = "noreferrer";
  contact.replaceChildren(whatsapp, email, instagram);
}

function applyTheme() {
  const root = document.documentElement;
  for (const [key, value] of Object.entries(content.theme)) {
    root.style.setProperty(`--${key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`, value);
  }
  root.style.setProperty("--container", `${content.layout.containerWidth}px`);
  root.style.setProperty("--section-space", `${content.layout.sectionSpacing}px`);
  root.style.setProperty("--card-radius", `${content.layout.cardRadius}px`);
  root.style.setProperty("--gallery-ratio", String(content.layout.galleryRatio));
  root.style.setProperty("--gallery-gap", `${content.layout.galleryGap}%`);
  root.style.setProperty("--gallery-stagger", `${content.layout.galleryStagger}%`);
  const [start, middle, end] = content.about.imageColors;
  document.querySelector(".about-image").style.background = `linear-gradient(135deg, ${start} 0%, ${middle} 48%, ${end} 100%)`;
}

function applyContent() {
  applyTheme();
  document.querySelectorAll(".wordmark").forEach((wordmark) => {
    wordmark.textContent = content.brand.name;
    wordmark.setAttribute("aria-label", `${content.brand.name}, ke beranda`);
  });
  document.title = `${content.brand.name} — Ceritakan Brand Anda`;
  document.querySelector('meta[name="description"]').content = content.brand.tagline;
  renderNavigation();
  document.querySelector(".header-order").textContent = content.brand.orderButton;

  setText("#hero-eyebrow", content.hero.eyebrow);
  setMultiline(".hero-title", content.hero.title);
  setText(".hero-description", content.hero.description);
  setText(".hero-primary", content.hero.primaryButton);
  setWhatsAppLink(
    document.querySelector(".hero-whatsapp"),
    content.hero.whatsappButton,
    content.footer.whatsappNumber,
    `Halo ${content.brand.name}, saya ingin konsultasi project.`
  );
  renderHeroStats();
  renderHeroGallery();
  renderServiceRibbon();

  setText("#services-eyebrow", content.servicesHeading.eyebrow);
  setMultiline("#services-title", content.servicesHeading.title);
  setText("#services-description", content.servicesHeading.description);
  renderServices();

  setText("#portfolio-eyebrow", content.portfolioHeading.eyebrow);
  setMultiline("#portfolio-title", content.portfolioHeading.title);
  setText("#portfolio-view-all", content.portfolioHeading.viewAllButton);
  setText("#portfolio-view-all-note", content.portfolioHeading.viewAllNote);
  renderPortfolioFilters();
  renderProjects();

  setText("#about-eyebrow", content.about.eyebrow);
  setMultiline("#about-title", content.about.title);
  setText("#about-description", content.about.description);
  renderFeatures();

  setText("#process-eyebrow", content.process.eyebrow);
  setText("#process-title", content.process.title);
  renderProcess();

  setText("#testimonials-eyebrow", content.testimonials.eyebrow);
  setText("#testimonials-title", content.testimonials.title);
  renderTestimonials();

  setMultiline("#contact-title", content.contact.title);
  setText("#contact-description", content.contact.description);
  setWhatsAppLink(
    document.querySelector(".contact-whatsapp"),
    content.contact.whatsappButton,
    content.footer.whatsappNumber,
    `Halo ${content.brand.name}, saya ingin membicarakan project.`
  );
  setText("#contact-cart-button", content.contact.cartButton);

  setText("#footer-description", content.footer.description);
  setText("#footer-services-title", content.footer.servicesTitle);
  setText("#footer-company-title", content.footer.companyTitle);
  setText("#footer-contact-title", content.footer.contactTitle);
  setText("#footer-copyright", content.footer.copyright);
  renderFooterLinks();
  renderCart();
}

function setCartOpen(isOpen) {
  cartPanel.classList.toggle("is-open", isOpen);
  cartPanel.setAttribute("aria-hidden", String(!isOpen));
  cartPanel.setAttribute("aria-modal", String(isOpen));
  cartPanel.inert = !isOpen;
  cartOverlay.hidden = !isOpen;
  document.querySelector(".cart-button").setAttribute("aria-expanded", String(isOpen));
  document.body.classList.toggle("cart-is-open", isOpen);
  if (isOpen) {
    cartTrigger = document.activeElement;
    document.querySelector(".cart-close").focus();
  } else if (cartTrigger instanceof HTMLElement) {
    cartTrigger.focus();
  }
}

function renderCart() {
  const cartItems = [...cart.values()];
  const itemsContainer = document.querySelector(".cart-items");
  const count = cartItems.reduce((sum, item) => sum + item.quantity, 0);
  const total = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  document.querySelector(".cart-count").textContent = String(count);
  const totalLabel = makeElement("span", "", "Total");
  const totalAmount = makeElement("span", "", rupiah.format(total));
  document.querySelector(".cart-total").replaceChildren(totalLabel, totalAmount);
  const checkout = document.querySelector(".cart-checkout");
  checkout.setAttribute("aria-disabled", String(cartItems.length === 0));
  if (cartItems.length === 0) {
    itemsContainer.replaceChildren(makeElement("p", "cart-empty", "Keranjang Anda masih kosong. Pilih layanan untuk mulai."));
    return;
  }
  itemsContainer.replaceChildren(...cartItems.map((item) => {
    const row = makeElement("div", "cart-item");
    const info = makeElement("div");
    info.append(makeElement("h3", "", item.name), makeElement("p", "", `${rupiah.format(item.price)} / item`));
    const controls = makeElement("div", "cart-item-controls");
    const decrease = makeElement("button", "quantity-button", "−");
    decrease.type = "button";
    decrease.dataset.cartAction = "decrease";
    decrease.dataset.serviceId = item.id;
    decrease.setAttribute("aria-label", `Kurangi ${item.name}`);
    const increase = makeElement("button", "quantity-button", "+");
    increase.type = "button";
    increase.dataset.cartAction = "increase";
    increase.dataset.serviceId = item.id;
    increase.setAttribute("aria-label", `Tambah ${item.name}`);
    controls.append(decrease, makeElement("span", "", item.quantity), increase);
    row.append(info, controls);
    return row;
  }));
  const message = cartItems.map((item) => `${item.name} (${item.quantity}x)`).join(", ");
  checkout.href = `https://wa.me/${content.footer.whatsappNumber}?text=${encodeURIComponent(`Halo ${content.brand.name}, saya ingin memesan: ${message}. Total: ${rupiah.format(total)}.`)}`;
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("is-visible");
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toast.classList.remove("is-visible"), 3200);
}

document.querySelector(".menu-toggle").addEventListener("click", (event) => {
  const button = event.currentTarget;
  const isOpen = button.getAttribute("aria-expanded") !== "true";
  button.setAttribute("aria-expanded", String(isOpen));
  button.setAttribute("aria-label", isOpen ? "Tutup navigasi" : "Buka navigasi");
  document.querySelector(".primary-navigation").classList.toggle("is-open", isOpen);
});

document.querySelector(".primary-navigation").addEventListener("click", (event) => {
  if (event.target.closest("a")) {
    document.querySelector(".primary-navigation").classList.remove("is-open");
    document.querySelector(".menu-toggle").setAttribute("aria-expanded", "false");
    document.querySelector(".menu-toggle").setAttribute("aria-label", "Buka navigasi");
  }
});

document.querySelector("#portfolio-filters").addEventListener("click", (event) => {
  const button = event.target.closest("[data-filter]");
  if (!button || !content) return;
  document.querySelectorAll(".filter-button").forEach((filterButton) => {
    const isActive = filterButton === button;
    filterButton.classList.toggle("is-active", isActive);
    filterButton.setAttribute("aria-pressed", String(isActive));
  });
  renderProjects(button.dataset.filter);
});

serviceGrid.addEventListener("click", (event) => {
  const button = event.target.closest("[data-service-id]");
  if (!button || !content) return;
  const service = content.services.find((item) => item.id === button.dataset.serviceId);
  if (!service) return;
  const current = cart.get(service.id);
  cart.set(service.id, { ...service, quantity: current ? current.quantity + 1 : 1 });
  renderCart();
  showToast(`${service.name} ditambahkan ke keranjang`);
});

document.querySelector(".cart-items").addEventListener("click", (event) => {
  const button = event.target.closest("[data-cart-action]");
  if (!button) return;
  const item = cart.get(button.dataset.serviceId);
  if (!item) return;
  if (button.dataset.cartAction === "increase") item.quantity += 1;
  else if (item.quantity > 1) item.quantity -= 1;
  else cart.delete(item.id);
  renderCart();
});

document.querySelector(".cart-button").addEventListener("click", () => setCartOpen(true));
document.querySelector(".open-cart").addEventListener("click", () => setCartOpen(true));
document.querySelector(".cart-close").addEventListener("click", () => setCartOpen(false));
cartOverlay.addEventListener("click", () => setCartOpen(false));
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") setCartOpen(false);
});

renderCart();
fetch("/api/content", { cache: "no-store" })
  .then((response) => {
    if (!response.ok) throw new Error(`Gagal memuat konten (${response.status}).`);
    return response.json();
  })
  .then((payload) => {
    content = payload.content;
    applyContent();
  })
  .catch((error) => {
    console.error("Konten landing page gagal dimuat:", error);
    showToast("Konten tidak dapat dimuat. Pastikan server Node.js berjalan.");
  });
