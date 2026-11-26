/**
 * Anindita Creative - Main Storefront / Profil Interactions
 * 100% Dynamic hydration from Supabase via AninditaAPI.getContent()
 * Supports live cross-tab synchronization when Admin updates photos or copy.
 */

document.addEventListener('DOMContentLoaded', async () => {
  'use strict';

  const api = window.AninditaAPI;
  const esc = (v) => api.escapeHtml(v);
  let activePortfolioFilter = 'all';

  async function refreshStorefront() {
    const content = await api.getContent();
    hydrateStorefront(content);
    applyPortfolioFilter(activePortfolioFilter);
  }

  // 1. Initial load from Supabase PostgreSQL
  await refreshStorefront();

  // 2. Live cross-tab sync when Admin saves changes
  if (typeof window.BroadcastChannel === 'function') {
    try {
      const channel = new BroadcastChannel('anindita_cms_sync');
      channel.addEventListener('message', (event) => {
        if (event.data?.type === 'cms-updated') {
          refreshStorefront();
        }
      });
    } catch (_) {}
  }

  window.addEventListener('storage', (event) => {
    if (event.key === 'anindita_cms_updated_at') {
      refreshStorefront();
    }
  });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      refreshStorefront();
    }
  });

  // 3. Mobile menu drawer toggle
  const mobileMenuBtn = document.getElementById('mobileMenuBtn');
  const navLinks = document.getElementById('mainNavLinks');
  if (mobileMenuBtn && navLinks) {
    mobileMenuBtn.addEventListener('click', () => {
      navLinks.classList.toggle('mobile-open');
    });

    navLinks.querySelectorAll('a').forEach((link) => {
      link.addEventListener('click', () => {
        navLinks.classList.remove('mobile-open');
      });
    });
  }

  // 4. Portfolio filtering & Video preview modal (delegated, works across re-hydrations)
  setupPortfolioFilters();
  setupVideoPreviewModal();

  // ==========================================================================
  // HYDRATION LOGIC
  // ==========================================================================
  function hydrateStorefront(data) {
    if (!data) return;

    const brand = data.brand || {};
    const stats = Array.isArray(data.stats) ? data.stats : [];
    const ticker = Array.isArray(data.ticker) ? data.ticker : [];
    const showcaseCards = Array.isArray(data.showcase) ? data.showcase : [];
    const services = Array.isArray(data.services) ? data.services : [];
    const portfolio = Array.isArray(data.portfolio) ? data.portfolio : [];
    const about = data.about || {};
    const process = data.process || {};
    const testimonials = Array.isArray(data.testimonials) ? data.testimonials : [];
    const cta = data.cta || {};

    // A. Brand & Wordmarks
    document.querySelectorAll('.wordmark').forEach((el) => {
      if (brand.name) el.textContent = brand.name;
    });

    // B. Hero Section
    const eyebrowPill = document.querySelector('.hero-content .eyebrow-pill');
    if (eyebrowPill && brand.tagline) eyebrowPill.textContent = brand.tagline;

    const heroTitle = document.querySelector('.hero-content h1');
    if (heroTitle && brand.title) heroTitle.innerHTML = brand.title;

    const heroDesc = document.querySelector('.hero-content .hero-desc');
    if (heroDesc && brand.description) heroDesc.textContent = brand.description;

    const heroWaBtn = document.querySelector('.hero-buttons .btn-wa');
    if (heroWaBtn && brand.whatsappNumber) {
      heroWaBtn.href = api.buildWhatsAppUrl(
        brand.whatsappNumber,
        'Halo Anindita Creative, saya tertarik untuk konsultasi project.'
      );
    }

    // Hero Stats
    const statItems = document.querySelectorAll('.hero-stats .stat-item');
    if (statItems.length >= 3 && stats.length >= 3) {
      statItems.forEach((item, idx) => {
        const valEl = item.querySelector('.stat-value');
        const lblEl = item.querySelector('.stat-label');
        if (valEl && stats[idx]?.value) valEl.textContent = stats[idx].value;
        if (lblEl && stats[idx]?.label) lblEl.textContent = stats[idx].label;
      });
    }

    // Hero Showcase Tiles (4 cards)
    const tiles = document.querySelectorAll('.hero-showcase .showcase-tile');
    if (tiles.length > 0 && showcaseCards.length > 0) {
      tiles.forEach((tile, idx) => {
        const card = showcaseCards[idx];
        if (!card) return;

        const mediaSrc = api.resolveMediaUrl(card.mediaUrl);
        const badgeText = esc(card.badge || card.category || 'Karya');
        const safeTitle = esc(card.title || 'Pratinjau Karya');
        const isVideo = api.isVideoUrl(mediaSrc);

        tile.setAttribute('data-preview-title', card.title || 'Pratinjau Karya');
        tile.setAttribute('data-preview-cat', card.badge || card.category || 'Karya Terpilih');
        tile.setAttribute('data-preview-media', mediaSrc || '');

        if (mediaSrc) {
          tile.classList.add('has-media');
          tile.style.background = '#1b0f09';
          tile.innerHTML = `
            ${isVideo
              ? `<video class="tile-media-bg" src="${esc(mediaSrc)}" muted loop autoplay playsinline></video>`
              : `<img class="tile-media-bg" src="${esc(mediaSrc)}" alt="${safeTitle}" loading="eager">`}
            <div class="tile-media-scrim" aria-hidden="true"></div>
            <div class="showcase-play-center" aria-hidden="true">&#9658;</div>
            <span class="showcase-badge">${badgeText}</span>
          `;
        } else {
          tile.classList.remove('has-media');
          if (card.gradient) tile.style.background = card.gradient;
          tile.innerHTML = `
            <div class="showcase-play-center" aria-hidden="true">&#9658;</div>
            <span class="showcase-badge">${badgeText}</span>
          `;
        }
      });
    }

    // C. Ticker Marquee Strip
    const tickerContainers = document.querySelectorAll('.ticker-content');
    if (tickerContainers.length > 0 && ticker.length > 0) {
      const tickerHtml = ticker.map((t) => `<span>${esc(t)}</span>`).join('');
      tickerContainers.forEach((container) => {
        container.innerHTML = tickerHtml;
      });
    }

    // D. Services Grid
    const servicesGrid = document.querySelector('.services-grid');
    if (servicesGrid) {
      if (services.length === 0) {
        servicesGrid.innerHTML = `
          <div style="grid-column: 1 / -1; text-align:center; padding:40px 20px; color:var(--text-dark-secondary);">
            Belum ada layanan yang tersedia saat ini.
          </div>
        `;
      } else {
        servicesGrid.innerHTML = services
          .map((s) => {
            const iconSvg = getServiceIconSvg(s.icon);
            const formattedPrice = api.formatRupiah(s.price || 0);
            const mediaSrc = api.resolveMediaUrl(s.mediaUrl);
            const hasMedia = Boolean(mediaSrc);
            const isVideo = hasMedia && api.isVideoUrl(mediaSrc);

            return `
              <div class="service-card" data-service-card-id="${esc(s.id)}">
                <div>
                  ${hasMedia
                    ? `<div class="service-thumb-media">
                        ${isVideo
                          ? `<video src="${esc(mediaSrc)}" muted autoplay loop playsinline></video>`
                          : `<img src="${esc(mediaSrc)}" alt="${esc(s.title)}" loading="lazy">`}
                      </div>`
                    : `<div class="service-icon-box" aria-hidden="true">${iconSvg}</div>`}
                  <h3>${esc(s.title)}</h3>
                  <p class="service-desc">${esc(s.shortDesc || '')}</p>
                </div>
                <div class="service-footer">
                  <div class="service-price-block">
                    <span class="service-price-label">${esc(s.priceLabel || 'Mulai dari')}</span>
                    <span class="service-price-amount">${formattedPrice}</span>
                  </div>
                  <button type="button" class="btn-add-service"
                    data-service-id="${esc(s.id)}"
                    data-service-title="${esc(s.title)}"
                    data-service-price="${Number(s.price) || 0}"
                    data-service-pkg="${esc(s.package || '')}"
                    data-service-estimate="${esc(s.estimate || 'Estimasi 2-3 hari kerja')}"
                    data-service-media="${esc(mediaSrc || '')}"
                    data-service-gradient="${esc(s.gradient || '')}">
                    &plus; Tambah
                  </button>
                </div>
              </div>
            `;
          })
          .join('');

        setupAddServiceButtons();
      }
    }

    // E. Portfolio Grid
    const portfolioGrid = document.querySelector('.portfolio-grid');
    if (portfolioGrid) {
      if (portfolio.length === 0) {
        portfolioGrid.innerHTML = `
          <div style="grid-column: 1 / -1; text-align:center; padding:40px 20px; color:var(--text-dark-secondary);">
            Belum ada karya portofolio yang ditampilkan.
          </div>
        `;
      } else {
        portfolioGrid.innerHTML = portfolio
          .map((p) => {
            const metaLine = `${esc(p.client || 'Klien')} &bull; ${esc(p.year || '2025')}`;
            const mediaSrc = api.resolveMediaUrl(p.mediaUrl);
            const hasMedia = Boolean(mediaSrc);
            const isVideo = hasMedia && api.isVideoUrl(mediaSrc);

            let thumbContent = '';
            if (isVideo) {
              thumbContent = `
                <video class="tile-media-bg" src="${esc(mediaSrc)}" muted loop autoplay playsinline></video>
                <div class="tile-media-scrim" aria-hidden="true"></div>
                <span class="portfolio-badge">${esc(p.badge || p.category)}</span>
                <div class="portfolio-play-center" aria-hidden="true">&#9658;</div>
              `;
            } else if (hasMedia) {
              thumbContent = `
                <img class="tile-media-bg" src="${esc(mediaSrc)}" alt="${esc(p.title)}" loading="lazy">
                <div class="tile-media-scrim" aria-hidden="true"></div>
                <span class="portfolio-badge">${esc(p.badge || p.category)}</span>
                <div class="portfolio-play-center" aria-hidden="true">&#9658;</div>
              `;
            } else {
              thumbContent = `
                <span class="portfolio-badge">${esc(p.badge || p.category)}</span>
                <div class="portfolio-play-center" aria-hidden="true">&#9658;</div>
              `;
            }

            return `
              <div class="portfolio-card"
                data-category="${esc(p.category || 'all')}"
                data-preview-title="${esc(p.title)}"
                data-preview-cat="${esc(`${p.badge || p.category} • ${p.client || ''}`)}"
                data-preview-media="${esc(mediaSrc || '')}">
                <div class="portfolio-thumb ${hasMedia ? 'has-media' : ''}" style="${!hasMedia ? `background: ${esc(p.gradient || 'linear-gradient(135deg, #c59b6d, #432415)')};` : 'background:#1b0f09;'}">
                  ${thumbContent}
                </div>
                <div class="portfolio-meta">
                  <h3>${esc(p.title)}</h3>
                  <p>${metaLine}</p>
                </div>
              </div>
            `;
          })
          .join('');
      }
    }

    // F. About Section
    const aboutHead = document.querySelector('#tentang .section-head');
    if (aboutHead) {
      if (about.title) {
        const titleEl = aboutHead.querySelector('.section-title');
        if (titleEl) titleEl.textContent = about.title;
      }
      if (about.description) {
        const descEl = aboutHead.querySelector('.section-subtitle');
        if (descEl) descEl.textContent = about.description;
      }
    }

    const aboutFeaturesGrid = document.querySelector('.about-features-grid');
    if (aboutFeaturesGrid && Array.isArray(about.features) && about.features.length > 0) {
      aboutFeaturesGrid.innerHTML = about.features
        .map(
          (f) => `
          <div class="feature-card">
            <div class="feature-icon-box" aria-hidden="true">${getFeatureIconSvg(f.icon)}</div>
            <h3>${esc(f.title)}</h3>
            <p>${esc(f.description)}</p>
          </div>
        `
        )
        .join('');
    }

    // G. Process Section
    const processHead = document.querySelector('#proses .section-head');
    if (processHead && process.title) {
      const pTitleEl = processHead.querySelector('.section-title');
      if (pTitleEl) pTitleEl.textContent = process.title;
    }

    const processGrid = document.querySelector('.process-grid');
    if (processGrid && Array.isArray(process.steps) && process.steps.length > 0) {
      processGrid.innerHTML = process.steps
        .map(
          (step) => `
          <div class="process-card">
            <span class="process-step-num">${esc(step.number)}</span>
            <h3>${esc(step.title)}</h3>
            <p>${esc(step.description)}</p>
          </div>
        `
        )
        .join('');
    }

    // H. Testimonials Section
    const testimonialsGrid = document.querySelector('.testimonials-grid');
    if (testimonialsGrid) {
      if (testimonials.length === 0) {
        testimonialsGrid.innerHTML = `
          <div style="grid-column: 1 / -1; text-align:center; padding:32px 20px; color:var(--text-dark-secondary);">
            Belum ada testimoni klien.
          </div>
        `;
      } else {
        testimonialsGrid.innerHTML = testimonials
          .map((t) => {
            const rating = Math.min(5, Math.max(1, Number(t.rating) || 5));
            const stars = '&#9733;'.repeat(rating);
            const initial = esc((t.name || 'K').charAt(0).toUpperCase());
            return `
              <div class="testimonial-card">
                <div>
                  <div class="testimonial-stars" aria-label="${rating} bintang">${stars}</div>
                  <p class="testimonial-quote">&ldquo;${esc(t.quote)}&rdquo;</p>
                </div>
                <div class="testimonial-author">
                  <div class="author-avatar">${initial}</div>
                  <div class="author-info">
                    <h4>${esc(t.name)}</h4>
                    <p>${esc(t.role || 'Klien')}</p>
                  </div>
                </div>
              </div>
            `;
          })
          .join('');
      }
    }

    // I. CTA Section
    const ctaCard = document.querySelector('.cta-banner-card');
    if (ctaCard) {
      const ctaTitle = ctaCard.querySelector('.cta-banner-text h2');
      if (ctaTitle && cta.title) ctaTitle.innerHTML = esc(cta.title).replace(/\n/g, '<br>');

      const ctaDesc = ctaCard.querySelector('.cta-banner-text p');
      if (ctaDesc && cta.description) ctaDesc.textContent = cta.description;

      const ctaCartBtn = ctaCard.querySelector('.cta-banner-actions [data-open-cart]');
      if (ctaCartBtn && cta.cartText) ctaCartBtn.textContent = cta.cartText;

      const ctaWaBtn = ctaCard.querySelector('.cta-banner-actions .btn-wa');
      if (ctaWaBtn && brand.whatsappNumber) {
        ctaWaBtn.href = api.buildWhatsAppUrl(
          brand.whatsappNumber,
          'Halo Anindita Creative, saya punya project yang ingin dibicarakan.'
        );
        if (cta.whatsappText) {
          ctaWaBtn.innerHTML = `
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12.031 2C6.496 2 2 6.496 2 12.031c0 1.8.477 3.553 1.385 5.105L2 22l4.984-1.332a9.975 9.975 0 0 0 5.047 1.363h.004c5.535 0 10.031-4.496 10.031-10.031 0-2.68-1.043-5.199-2.937-7.094A9.971 9.971 0 0 0 12.031 2zm5.82 14.184c-.246.688-1.422 1.316-1.957 1.398-.492.078-1.137.11-3.668-.934-2.73-1.129-4.508-3.902-4.645-4.086-.137-.184-1.109-1.477-1.109-2.812 0-1.336.703-1.996.953-2.266.246-.27.535-.336.715-.336.18 0 .36.004.516.012.164.008.383-.062.598.453.227.543.77 1.883.836 2.02.066.137.11.297.02.477-.09.18-.137.293-.27.453-.137.16-.289.36-.41.48-.137.137-.281.285-.121.562.16.273.711 1.172 1.527 1.898 1.051.934 1.938 1.223 2.215 1.36.277.137.441.117.605-.07.164-.188.703-.816.891-1.098.188-.281.375-.234.629-.141.254.094 1.617.762 1.895.902.277.141.465.211.535.328.07.117.07.68-.176 1.368z"/>
            </svg>
            ${esc(cta.whatsappText)}
          `;
        }
      }
    }

    // J. Footer Links & Copyright
    const footerDesc = document.querySelector('.footer-desc');
    if (footerDesc && brand.description) footerDesc.textContent = brand.description;

    const footerLinks = document.querySelectorAll('.footer-col:nth-child(4) .footer-link');
    if (footerLinks.length >= 3) {
      if (brand.whatsappDisplay) footerLinks[0].textContent = `WhatsApp: ${brand.whatsappDisplay}`;
      if (brand.email) {
        footerLinks[1].textContent = brand.email;
        footerLinks[1].href = `mailto:${brand.email}`;
      }
      if (brand.instagram) {
        footerLinks[2].textContent = brand.instagram;
        footerLinks[2].href = brand.instagramUrl || `https://instagram.com/${brand.instagram.replace('@', '')}`;
      }
    }

    const footerBottom = document.querySelector('.footer-bottom p');
    if (footerBottom && brand.copyright) footerBottom.textContent = brand.copyright;
  }

  function getServiceIconSvg(iconName) {
    if (iconName === 'grid') {
      return '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>';
    }
    if (iconName === 'camera') {
      return '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 7l-7 5 7 5V7z"></path><rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect></svg>';
    }
    if (iconName === 'cube') {
      return '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>';
    }
    if (iconName === 'sparkle') {
      return '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>';
    }
    if (iconName === 'stack') {
      return '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 2 7 12 12 22 7 12 2"></polygon><polyline points="2 17 12 22 22 17"></polyline><polyline points="2 12 12 17 22 12"></polyline></svg>';
    }
    return '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"></rect><line x1="7" y1="2" x2="7" y2="22"></line><line x1="17" y1="2" x2="17" y2="22"></line><line x1="2" y1="12" x2="22" y2="12"></line><line x1="2" y1="7" x2="7" y2="7"></line><line x1="2" y1="17" x2="7" y2="17"></line><line x1="17" y1="17" x2="22" y2="17"></line><line x1="17" y1="7" x2="22" y2="7"></line></svg>';
  }

  function getFeatureIconSvg(iconName) {
    if (iconName === 'clock') {
      return '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>';
    }
    if (iconName === 'shield-check') {
      return '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path><polyline points="9 12 11 14 15 10"></polyline></svg>';
    }
    if (iconName === 'layers') {
      return '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path></svg>';
    }
    return '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"></polygon></svg>';
  }

  function setupAddServiceButtons() {
    document.querySelectorAll('.btn-add-service').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const serviceId = btn.getAttribute('data-service-id');
        const title = btn.getAttribute('data-service-title');
        const price = parseInt(btn.getAttribute('data-service-price'), 10) || 0;
        const pkg = btn.getAttribute('data-service-pkg');
        const estimate = btn.getAttribute('data-service-estimate');
        const mediaUrl = btn.getAttribute('data-service-media');
        const gradient = btn.getAttribute('data-service-gradient');

        if (window.cartManager) {
          window.cartManager.addItem({
            id: serviceId,
            title,
            price,
            package: pkg,
            estimate,
            mediaUrl,
            gradient
          });
        }

        const originalText = btn.innerHTML;
        btn.innerHTML = '&#10003; Ditambah';
        btn.classList.add('added');
        setTimeout(() => {
          btn.innerHTML = originalText;
          btn.classList.remove('added');
        }, 1400);

        showToast(`Layanan "${title}" telah ditambahkan ke keranjang.`);
      });
    });
  }

  function applyPortfolioFilter(cat) {
    activePortfolioFilter = cat || 'all';
    document.querySelectorAll('.portfolio-card').forEach((card) => {
      const cardCat = card.getAttribute('data-category');
      card.style.display = activePortfolioFilter === 'all' || cardCat === activePortfolioFilter ? 'flex' : 'none';
    });
  }

  function setupPortfolioFilters() {
    const filterBtns = document.querySelectorAll('.filter-btn');
    filterBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        filterBtns.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        applyPortfolioFilter(btn.getAttribute('data-filter'));
      });
    });
  }

  // Event-delegated Preview Modal (safe across dynamic re-hydration)
  function setupVideoPreviewModal() {
    const videoModal = document.getElementById('videoPreviewModal');
    const closeVideoModalBtn = document.getElementById('closeVideoModalBtn');
    const videoModalDismissBtn = document.getElementById('videoModalDismissBtn');
    const videoModalTitle = document.getElementById('videoModalTitle');
    const videoModalCategory = document.getElementById('videoModalCategory');
    const modalScreen = videoModal ? videoModal.querySelector('.modal-content div[style*="aspect-ratio"]') : null;

    function openVideoModal(title, category, mediaUrl) {
      if (!videoModal) return;
      if (videoModalTitle) videoModalTitle.textContent = title || 'Pratinjau Karya Visual';
      if (videoModalCategory) videoModalCategory.textContent = (category || 'Karya Terpilih').toUpperCase();

      if (modalScreen) {
        if (mediaUrl) {
          if (api.isVideoUrl(mediaUrl)) {
            modalScreen.innerHTML = `<video src="${esc(mediaUrl)}" controls autoplay playsinline style="width:100%; height:100%; object-fit:cover; display:block;"></video>`;
          } else {
            modalScreen.innerHTML = `<img src="${esc(mediaUrl)}" alt="${esc(title || '')}" style="width:100%; height:100%; object-fit:cover; display:block;">`;
          }
        } else {
          modalScreen.innerHTML = `
            <div style="width:64px; height:64px; border-radius:50%; background:rgba(255,255,255,0.95); display:flex; align-items:center; justify-content:center; color:#23150d; font-size:24px; box-shadow:0 4px 16px rgba(0,0,0,0.25);">
              &#9658;
            </div>
          `;
        }
      }

      videoModal.classList.add('open');
      document.body.style.overflow = 'hidden';
    }

    function closeVideoModal() {
      if (!videoModal) return;
      if (modalScreen) {
        const vid = modalScreen.querySelector('video');
        if (vid) {
          try {
            vid.pause();
          } catch (_) {}
        }
      }
      videoModal.classList.remove('open');
      document.body.style.overflow = '';
    }

    if (closeVideoModalBtn) closeVideoModalBtn.addEventListener('click', closeVideoModal);
    if (videoModalDismissBtn) videoModalDismissBtn.addEventListener('click', closeVideoModal);
    if (videoModal) {
      videoModal.addEventListener('click', (e) => {
        if (e.target === videoModal) closeVideoModal();
      });
    }

    document.addEventListener('click', (e) => {
      const card = e.target.closest('.showcase-tile, .portfolio-card');
      if (!card) return;
      if (e.target.closest('button') || e.target.closest('a')) return;
      const title = card.getAttribute('data-preview-title') || card.querySelector('h3')?.textContent;
      const cat = card.getAttribute('data-preview-cat') || card.querySelector('.portfolio-badge, .showcase-badge')?.textContent;
      const media = card.getAttribute('data-preview-media') || '';
      openVideoModal(title, cat, media);
    });
  }

  function showToast(message) {
    let toast = document.getElementById('toastNotice');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'toastNotice';
      toast.className = 'toast-notice';
      document.body.appendChild(toast);
    }
    toast.innerHTML = `<span>&#10003;</span> <span>${esc(message)}</span>`;
    toast.classList.add('show');
    setTimeout(() => {
      toast.classList.remove('show');
    }, 2800);
  }

  window.showToast = showToast;
});
