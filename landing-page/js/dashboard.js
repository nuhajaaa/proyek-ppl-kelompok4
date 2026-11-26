/**
 * Anindita Creative - Admin Dashboard & Visual CMS Controller
 * Full-stack integration with Supabase Auth, Supabase Storage CDN, and PostgreSQL sync.
 * Zero silent error swallowing — every upload & save awaits confirmation from Supabase.
 */

document.addEventListener('DOMContentLoaded', async () => {
  'use strict';

  const api = window.AninditaAPI;
  const esc = (v) => api.escapeHtml(v);

  // Core view elements
  const loginGateView = document.getElementById('loginGateView');
  const adminWorkspaceView = document.getElementById('adminWorkspaceView');
  const loginForm = document.getElementById('adminLoginForm');
  const loginUsernameInput = document.getElementById('loginUsername');
  const loginPasswordInput = document.getElementById('loginPassword');
  const togglePasswordBtn = document.getElementById('togglePasswordBtn');
  const quickLoginSbBtn = document.getElementById('quickLoginSbBtn');
  const tabLoginBtn = document.getElementById('tabLoginBtn');
  const tabRegisterBtn = document.getElementById('tabRegisterBtn');
  const adminRegisterForm = document.getElementById('adminRegisterForm');
  const regEmailInput = document.getElementById('regEmail');
  const regFullNameInput = document.getElementById('regFullName');
  const regPasswordInput = document.getElementById('regPassword');
  const loginErrorBox = document.getElementById('loginErrorBox');
  const loginSuccessBox = document.getElementById('loginSuccessBox');
  const logoutBtn = document.getElementById('logoutBtn');
  const userBadgeName = document.getElementById('userBadgeName');
  const userRoleBadge = document.getElementById('userRoleBadge');
  const topbarTitle = document.getElementById('topbarTitle');

  // Master Save & Reset elements
  const btnSaveTop = document.getElementById('btnSaveMasterTop');
  const btnSaveBottom = document.getElementById('btnSaveMasterBottom');
  const btnResetPrompt = document.getElementById('btnResetDefaultPrompt');
  const resetConfirmModal = document.getElementById('resetConfirmModal');
  const cancelResetBtn = document.getElementById('cancelResetBtn');
  const confirmResetBtn = document.getElementById('confirmResetBtn');
  const cmsToast = document.getElementById('cmsToast');
  const cmsToastIcon = document.getElementById('cmsToastIcon');
  const cmsToastMsg = document.getElementById('cmsToastMsg');

  // Orders elements
  const ordersTbody = document.getElementById('ordersTableBody');
  const orderSearchInput = document.getElementById('orderSearchInput');
  const statTotal = document.getElementById('statTotalOrders');
  const statPending = document.getElementById('statPendingWa');
  const statProcessing = document.getElementById('statProcessing');
  const statRevenue = document.getElementById('statRevenue');
  const briefModal = document.getElementById('briefModalBackdrop');
  const closeModalBtn = document.getElementById('closeModalBtn');
  const modalOrderId = document.getElementById('modalOrderId');
  const modalBodyDetails = document.getElementById('modalBodyDetails');

  // State variables
  let cmsData = null;
  let allOrders = [];
  let isSavingCms = false;
  let isUploadingServiceMedia = false;
  let isUploadingPortfolioMedia = false;
  let toastTimer = null;

  // ==========================================================================
  // 1. AUTHENTICATION CONTROLLER
  // ==========================================================================

  async function checkAuthStatus() {
    const auth = await api.checkAuth();
    if (auth.authenticated) {
      await showDashboard(auth.user);
    } else {
      showLoginGate(auth.reason);
    }
  }

  function showLoginGate(noticeMessage = '') {
    loginGateView.style.display = 'flex';
    adminWorkspaceView.style.display = 'none';
    if (noticeMessage && loginErrorBox) {
      loginErrorBox.textContent = noticeMessage;
      loginErrorBox.style.display = 'block';
    }
  }

  function handleSessionExpired(message) {
    showToast(message || 'Sesi Supabase berakhir. Silakan login kembali.', 'error');
    showLoginGate(message || 'Sesi Supabase Anda telah berakhir. Silakan login ulang.');
  }

  async function showDashboard(user) {
    loginGateView.style.display = 'none';
    adminWorkspaceView.style.display = 'grid';

    const displayName = typeof user === 'object' ? (user.email || user.username || 'Administrator') : (user || 'Administrator');
    if (userBadgeName) userBadgeName.textContent = displayName;
    if (userRoleBadge) {
      const providerText = (typeof user === 'object' && user.provider === 'supabase') ? 'Supabase Auth' : 'Admin Lokal';
      userRoleBadge.textContent = `${providerText} • Aktif`;
    }

    const secUsername = document.getElementById('newUsernameInput');
    if (secUsername && typeof user === 'object' && user.username) {
      secUsername.value = user.username;
    }

    cmsData = await api.getContent();
    populateAllForms();
    await loadOrdersFromServer();
    await updateSupabaseStatusDisplay();
  }

  async function loadOrdersFromServer() {
    try {
      allOrders = await api.getOrders();
      renderOrders(allOrders);
      updateOrderStats();
    } catch (err) {
      if (err.authExpired) {
        handleSessionExpired(err.message);
        return;
      }
      allOrders = [];
      renderOrders([]);
      updateOrderStats();
      showToast('Gagal memuat daftar pesanan: ' + err.message, 'error');
    }
  }

  async function updateSupabaseStatusDisplay() {
    const badge = document.getElementById('supabaseStatusBadge');
    const dot = document.getElementById('supabaseStatusDot');
    const text = document.getElementById('supabaseStatusText');
    if (!badge || !text) return;

    const status = await api.getSupabaseStatus();
    if (status.configured) {
      badge.style.background = '#f0fdf4';
      badge.style.color = '#166534';
      badge.style.borderColor = '#bbf7d0';
      if (dot) dot.style.background = '#22c55e';
      text.textContent = 'Supabase DB, Auth & Media Storage Aktif';
      badge.title = 'Terhubung ke ' + (status.url || 'Supabase');
    } else {
      badge.style.background = '#fef3c7';
      badge.style.color = '#92400e';
      badge.style.borderColor = '#fde68a';
      if (dot) dot.style.background = '#f59e0b';
      text.textContent = 'Database: Mode JSON Lokal';
      badge.title = 'Isi SUPABASE_URL di .env.local untuk menghubungkan database live.';
    }
  }

  if (togglePasswordBtn && loginPasswordInput) {
    togglePasswordBtn.addEventListener('click', () => {
      const type = loginPasswordInput.getAttribute('type') === 'password' ? 'text' : 'password';
      loginPasswordInput.setAttribute('type', type);
    });
  }

  if (tabLoginBtn && tabRegisterBtn) {
    tabLoginBtn.addEventListener('click', () => {
      tabLoginBtn.style.background = '#fff';
      tabLoginBtn.style.color = '#26160e';
      tabLoginBtn.style.fontWeight = '700';

      tabRegisterBtn.style.background = 'transparent';
      tabRegisterBtn.style.color = '#d8b48f';
      tabRegisterBtn.style.fontWeight = '600';

      if (loginForm) loginForm.style.display = 'block';
      if (adminRegisterForm) adminRegisterForm.style.display = 'none';
      if (loginErrorBox) loginErrorBox.style.display = 'none';
      if (loginSuccessBox) loginSuccessBox.style.display = 'none';
    });

    tabRegisterBtn.addEventListener('click', () => {
      tabRegisterBtn.style.background = '#fff';
      tabRegisterBtn.style.color = '#26160e';
      tabRegisterBtn.style.fontWeight = '700';

      tabLoginBtn.style.background = 'transparent';
      tabLoginBtn.style.color = '#d8b48f';
      tabLoginBtn.style.fontWeight = '600';

      if (loginForm) loginForm.style.display = 'none';
      if (adminRegisterForm) adminRegisterForm.style.display = 'block';
      if (loginErrorBox) loginErrorBox.style.display = 'none';
      if (loginSuccessBox) loginSuccessBox.style.display = 'none';
    });
  }

  if (quickLoginSbBtn) {
    quickLoginSbBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      loginUsernameInput.value = 'aninditaspace05@gmail.com';
      loginPasswordInput.value = 'AdminPassword123!';
      await handleLoginSubmit();
    });
  }

  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      await handleLoginSubmit();
    });
  }

  async function handleLoginSubmit() {
    const u = loginUsernameInput.value.trim();
    const p = loginPasswordInput.value;
    if (!u || !p) return;

    if (loginErrorBox) loginErrorBox.style.display = 'none';
    if (loginSuccessBox) loginSuccessBox.style.display = 'none';

    const submitBtn = document.getElementById('loginSubmitBtn');
    if (submitBtn) submitBtn.disabled = true;

    showToast('Memverifikasi sesi Supabase Auth...');
    const res = await api.login(u, p);
    if (submitBtn) submitBtn.disabled = false;

    if (res.success) {
      await showDashboard(res.user || u);
      showToast(res.message || 'Selamat datang di Panel Admin Anindita!');
    } else if (loginErrorBox) {
      loginErrorBox.textContent = res.error || 'Email atau kata sandi salah.';
      loginErrorBox.style.display = 'block';
    }
  }

  if (adminRegisterForm) {
    adminRegisterForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = regEmailInput.value.trim();
      const fullName = regFullNameInput.value.trim();
      const password = regPasswordInput.value;

      if (!email || !password) return;
      if (password.length < 6) {
        showToast('Password minimal 6 karakter!', 'error');
        return;
      }

      showToast('Mendaftarkan akun ke Supabase Auth...');
      const res = await api.register(email, password, email.split('@')[0], fullName);
      if (res.success) {
        if (loginSuccessBox) {
          loginSuccessBox.textContent = res.message || 'Akun berhasil didaftarkan! Silakan masuk.';
          loginSuccessBox.style.display = 'block';
        }
        tabLoginBtn.click();
        loginUsernameInput.value = email;
        loginPasswordInput.value = password;
        showToast('Akun berhasil dibuat! Silakan klik Masuk.');
      } else if (loginErrorBox) {
        loginErrorBox.textContent = res.error || 'Gagal mendaftarkan akun.';
        loginErrorBox.style.display = 'block';
      }
    });
  }

  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      await api.logout();
      showLoginGate();
      showToast('Anda telah keluar dari sesi admin.');
    });
  }

  // ==========================================================================
  // 2. TAB NAVIGATION
  // ==========================================================================

  const tabTitles = {
    orders: 'Manajemen Pesanan & Brief Klien',
    brand: 'Identitas Brand & Kontak Studio',
    hero: 'Hero, Statistik & Showcase Video',
    services: 'Pengaturan Layanan & Tarif Harga',
    portfolio: 'Galeri Karya & Portofolio',
    about: 'Tentang Studio & Proses Kerja',
    testimonials: 'Ulasan & Testimoni Klien',
    cta: 'Banner Ajakan & Pengaturan Footer',
    security: 'Keamanan Akun & Ganti Password'
  };

  function switchTab(tabId) {
    document.querySelectorAll('[data-tab]').forEach((el) => {
      el.classList.toggle('active', el.getAttribute('data-tab') === tabId);
    });

    document.querySelectorAll('.cms-tab-pane').forEach((pane) => {
      pane.style.display = 'none';
    });

    const targetPane = document.getElementById(`pane-${tabId}`);
    if (targetPane) targetPane.style.display = 'block';

    if (topbarTitle && tabTitles[tabId]) {
      topbarTitle.textContent = tabTitles[tabId];
    }
  }

  document.querySelectorAll('[data-tab]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      switchTab(btn.getAttribute('data-tab'));
    });
  });

  // ==========================================================================
  // 3. FORM BINDING & CMS DATA INITIALIZATION
  // ==========================================================================

  function populateAllForms() {
    if (!cmsData) return;

    const b = cmsData.brand || {};
    setVal('brandName', b.name || 'anindita');
    setVal('brandFullName', b.fullName || 'Anindita Creative');
    setVal('brandTagline', b.tagline || 'CREATIVE AGENCY BERBASIS PROJECT');
    setVal('brandCopyright', b.copyright || '© 2026 Anindita Creative. Seluruh hak cipta dilindungi.');
    setVal('brandWaNum', b.whatsappNumber || '6285733812033');
    setVal('brandWaDisplay', b.whatsappDisplay || '0857-3381-2033');
    setVal('brandEmail', b.email || 'aninditaspace05@gmail.com');
    setVal('brandInstagram', b.instagram || '@anindita.creative');
    setVal('brandInstagramUrl', b.instagramUrl || 'https://instagram.com/anindita.creative');

    setVal('heroTitle', b.title || 'Kami mengubah ide<br>menjadi karya visual<br>yang bercerita.');
    setVal('heroDesc', b.description || '');

    const stats = cmsData.stats || [];
    setVal('statVal1', stats[0]?.value || '150+');
    setVal('statLbl1', stats[0]?.label || 'Project selesai');
    setVal('statVal2', stats[1]?.value || '60+');
    setVal('statLbl2', stats[1]?.label || 'Klien puas');
    setVal('statVal3', stats[2]?.value || '5');
    setVal('statLbl3', stats[2]?.label || 'Layanan kreatif');

    renderShowcaseCardsEditor();

    const ticker = cmsData.ticker || [];
    setVal('tickerInput', ticker.join(', '));

    renderServicesList();
    renderPortfolioList();

    const ab = cmsData.about || {};
    setVal('aboutTitle', ab.title || '');
    setVal('aboutDesc', ab.description || '');
    renderAboutFeatures(ab.features || []);

    const pr = cmsData.process || {};
    setVal('processTitle', pr.title || '');
    renderProcessSteps(pr.steps || []);

    renderTestimonialsList();

    const cta = cmsData.cta || {};
    setVal('ctaTitle', cta.title || '');
    setVal('ctaDesc', cta.description || '');
    setVal('ctaBtnWa', cta.whatsappText || 'Chat via WhatsApp');
    setVal('ctaBtnCart', cta.cartText || 'Buka Keranjang');
  }

  function setVal(id, val) {
    const el = document.getElementById(id);
    if (el) el.value = val;
  }

  function getVal(id) {
    const el = document.getElementById(id);
    return el ? el.value.trim() : '';
  }

  function renderMediaElement(url, altText, controls = false) {
    const resolved = api.resolveMediaUrl(url);
    if (!resolved) return '';
    if (api.isVideoUrl(resolved)) {
      return `<video src="${esc(resolved)}" ${controls ? 'controls' : 'muted'} style="width:100%; height:100%; object-fit:cover;"></video>`;
    }
    return `<img src="${esc(resolved)}" alt="${esc(altText || 'Preview')}" style="width:100%; height:100%; object-fit:cover;">`;
  }

  // ==========================================================================
  // 4. SHOWCASE CARDS EDITOR (4 Kartu Hero)
  // ==========================================================================

  function renderShowcaseCardsEditor() {
    const container = document.getElementById('heroShowcaseEditorGrid');
    if (!container) return;

    if (!Array.isArray(cmsData.showcase) || cmsData.showcase.length === 0) {
      cmsData.showcase = [
        { id: 'hero-1', title: 'Reels Skincare Lumi Beauty', category: 'Edit Video', badge: 'Edit Video', gradient: 'linear-gradient(135deg, #c59b6d 0%, #684227 60%, #3a2214 100%)', mediaUrl: '' },
        { id: 'hero-2', title: '3D Text Intro Toko Nusantara', category: '3D Text', badge: '3D Text', gradient: 'linear-gradient(135deg, #4d2d1d 0%, #a47650 50%, #442416 100%)', mediaUrl: '' },
        { id: 'hero-3', title: 'Instagram Feed Kopi Senja', category: 'Edit Feed', badge: 'Edit Feed', gradient: 'linear-gradient(135deg, #7c4c31 0%, #462617 100%)', mediaUrl: '' },
        { id: 'hero-4', title: 'Company Profile PT Maju Jaya', category: 'Videographer', badge: 'Videographer', gradient: 'linear-gradient(135deg, #d8b48f 0%, #7e5539 60%, #3a2013 100%)', mediaUrl: '' }
      ];
    }

    container.innerHTML = cmsData.showcase
      .map((card, idx) => {
        const resolved = api.resolveMediaUrl(card.mediaUrl);
        return `
          <div class="cms-item-card" data-showcase-index="${idx}">
            <div class="cms-item-header">
              <span class="cms-item-title">Kartu Showcase #${idx + 1}</span>
              <span class="cms-item-badge">${esc(card.badge || card.category)}</span>
            </div>

            <div class="cms-media-box" style="margin-bottom:12px;">
              <div class="cms-media-preview-area" id="showcasePreview_${idx}" style="${resolved ? '' : `background:${esc(card.gradient)}`}">
                ${resolved ? renderMediaElement(resolved, card.title, true) : '<span style="color:#fff; font-size:12px; font-weight:700;">Pratinjau Visual</span>'}
              </div>
              <div class="cms-upload-row">
                <label class="cms-file-label">
                  📁 Unggah Foto/Video
                  <input type="file" class="cms-file-input showcase-file-input" data-index="${idx}" accept="image/*,video/mp4,video/webm,video/quicktime">
                </label>
                ${resolved ? `<button type="button" class="btn btn-outline-dark btn-sm remove-showcase-media" data-index="${idx}">Hapus</button>` : ''}
              </div>
            </div>

            <div class="cms-form-group">
              <label class="cms-label" style="font-size:12px;">Judul Modal Pratinjau</label>
              <input type="text" class="cms-input showcase-title-input" data-index="${idx}" value="${esc(card.title || '')}" placeholder="Judul pratinjau">
            </div>

            <div class="cms-form-group">
              <label class="cms-label" style="font-size:12px;">Label Tag</label>
              <input type="text" class="cms-input showcase-badge-input" data-index="${idx}" value="${esc(card.badge || '')}" placeholder="Edit Video">
            </div>
          </div>
        `;
      })
      .join('');

    container.querySelectorAll('.showcase-file-input').forEach((input) => {
      input.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        const idx = parseInt(input.getAttribute('data-index'), 10);
        if (!file) return;

        try {
          showToast('Mengunggah media showcase ke Supabase Storage...');
          const uploaded = await api.uploadFile(file, 'showcase');
          cmsData.showcase[idx].mediaUrl = uploaded.url;
          renderShowcaseCardsEditor();
          await saveAllCmsChanges('Media showcase berhasil disimpan ke Supabase!');
        } catch (err) {
          input.value = '';
          if (err.authExpired) {
            handleSessionExpired(err.message);
            return;
          }
          showToast('Gagal mengunggah media: ' + err.message, 'error');
        }
      });
    });

    container.querySelectorAll('.remove-showcase-media').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const idx = parseInt(btn.getAttribute('data-index'), 10);
        cmsData.showcase[idx].mediaUrl = '';
        renderShowcaseCardsEditor();
        await saveAllCmsChanges('Media showcase dihapus dari database.');
      });
    });

    container.querySelectorAll('.showcase-title-input').forEach((input) => {
      input.addEventListener('input', (e) => {
        const idx = parseInt(input.getAttribute('data-index'), 10);
        cmsData.showcase[idx].title = e.target.value;
      });
    });

    container.querySelectorAll('.showcase-badge-input').forEach((input) => {
      input.addEventListener('input', (e) => {
        const idx = parseInt(input.getAttribute('data-index'), 10);
        cmsData.showcase[idx].badge = e.target.value;
      });
    });
  }

  // ==========================================================================
  // 5. SERVICES CRUD (Layanan & Tarif)
  // ==========================================================================

  const servicesGrid = document.getElementById('servicesCardsList');
  const serviceModal = document.getElementById('serviceModal');
  const serviceForm = document.getElementById('serviceForm');
  const btnAddNewService = document.getElementById('btnAddNewService');
  const closeServiceModalBtn = document.getElementById('closeServiceModalBtn');
  const cancelServiceModalBtn = document.getElementById('cancelServiceModalBtn');
  const saveServiceModalBtn = document.getElementById('saveServiceModalBtn');
  const servicePreviewArea = document.getElementById('servicePreviewArea');
  const serviceFileInput = document.getElementById('serviceFileInput');
  const btnRemoveServiceMedia = document.getElementById('btnRemoveServiceMedia');
  const serviceMediaUrlInput = document.getElementById('serviceMediaUrl');

  function renderServicesList() {
    if (!servicesGrid) return;
    const services = cmsData.services || [];

    if (services.length === 0) {
      servicesGrid.innerHTML = '<div style="grid-column:1/-1; padding:24px; text-align:center; color:#8c776a;">Belum ada layanan. Klik "+ Tambah Layanan Baru".</div>';
      return;
    }

    servicesGrid.innerHTML = services
      .map((s) => {
        const resolved = api.resolveMediaUrl(s.mediaUrl);
        return `
          <div class="cms-item-card" data-service-id="${esc(s.id)}">
            <div class="cms-item-thumb" style="${resolved ? '' : `background:${esc(s.gradient || 'linear-gradient(135deg, #c59b6d, #3a2214)')}`}">
              ${resolved ? renderMediaElement(resolved, s.title, false) : `<span style="color:#fff; font-weight:700;">${esc(s.title)}</span>`}
            </div>
            <div>
              <div class="cms-item-header">
                <span class="cms-item-title">${esc(s.title)}</span>
                <span class="cms-item-badge">${esc(s.package || 'Paket')}</span>
              </div>
              <div class="cms-item-desc">${esc(s.shortDesc || '-')}</div>
              <div class="cms-item-price">${api.formatRupiah(s.price || 0)}</div>
            </div>
            <div class="cms-item-actions">
              <button type="button" class="btn btn-outline-dark btn-sm edit-service-btn" data-id="${esc(s.id)}">✏️ Edit</button>
              <button type="button" class="btn btn-outline-dark btn-sm delete-service-btn" data-id="${esc(s.id)}" style="color:#dc2626; border-color:#fca5a5;">🗑️ Hapus</button>
            </div>
          </div>
        `;
      })
      .join('');

    servicesGrid.querySelectorAll('.edit-service-btn').forEach((btn) => {
      btn.addEventListener('click', () => openServiceModal(btn.getAttribute('data-id')));
    });

    servicesGrid.querySelectorAll('.delete-service-btn').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        if (!confirm('Apakah Anda yakin ingin menghapus layanan ini secara permanen dari database?')) return;
        const backup = [...cmsData.services];
        cmsData.services = cmsData.services.filter((s) => s.id !== id);
        renderServicesList();
        const ok = await saveAllCmsChanges('Layanan berhasil dihapus dari database!');
        if (!ok) {
          cmsData.services = backup;
          renderServicesList();
        }
      });
    });
  }

  function openServiceModal(serviceId) {
    if (!serviceModal) return;
    const isEdit = Boolean(serviceId);
    document.getElementById('serviceModalTitle').textContent = isEdit ? 'Edit Layanan' : 'Tambah Layanan Baru';
    document.getElementById('serviceFormId').value = serviceId || '';
    if (serviceFileInput) serviceFileInput.value = '';

    if (isEdit) {
      const s = cmsData.services.find((item) => item.id === serviceId);
      if (s) {
        document.getElementById('modalServiceTitle').value = s.title || '';
        document.getElementById('modalServicePrice').value = s.price || 0;
        document.getElementById('modalServicePackage').value = s.package || '';
        document.getElementById('modalServiceEstimate').value = s.estimate || '';
        document.getElementById('modalServiceIcon').value = s.icon || 'video';
        document.getElementById('modalServiceDesc').value = s.shortDesc || '';
        serviceMediaUrlInput.value = s.mediaUrl || '';
        updateServiceModalPreview(s.mediaUrl, s.gradient);
      }
    } else {
      serviceForm.reset();
      document.getElementById('serviceFormId').value = '';
      serviceMediaUrlInput.value = '';
      updateServiceModalPreview('', '');
    }

    serviceModal.classList.add('open');
  }

  function updateServiceModalPreview(url, gradient) {
    if (!servicePreviewArea) return;
    const resolved = api.resolveMediaUrl(url);
    if (resolved) {
      servicePreviewArea.innerHTML = renderMediaElement(resolved, 'Preview', true);
      servicePreviewArea.style.background = 'none';
    } else {
      servicePreviewArea.innerHTML = '<span class="empty-placeholder">Belum ada foto/video</span>';
      servicePreviewArea.style.background = gradient || '#e4d7cb';
    }
  }

  if (btnAddNewService) btnAddNewService.addEventListener('click', () => openServiceModal(null));
  if (closeServiceModalBtn) closeServiceModalBtn.addEventListener('click', () => serviceModal.classList.remove('open'));
  if (cancelServiceModalBtn) cancelServiceModalBtn.addEventListener('click', () => serviceModal.classList.remove('open'));

  if (serviceFileInput) {
    serviceFileInput.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      isUploadingServiceMedia = true;
      if (saveServiceModalBtn) {
        saveServiceModalBtn.disabled = true;
        saveServiceModalBtn.textContent = 'Mengunggah media...';
      }

      try {
        showToast('Mengunggah media layanan ke Supabase Storage...');
        const uploaded = await api.uploadFile(file, 'services');
        serviceMediaUrlInput.value = uploaded.url;
        updateServiceModalPreview(uploaded.url);
        showToast('Media terunggah! Klik "Simpan Layanan" untuk menerbitkan.');
      } catch (err) {
        serviceFileInput.value = '';
        if (err.authExpired) {
          serviceModal.classList.remove('open');
          handleSessionExpired(err.message);
          return;
        }
        showToast('Upload gagal: ' + err.message, 'error');
      } finally {
        isUploadingServiceMedia = false;
        if (saveServiceModalBtn) {
          saveServiceModalBtn.disabled = false;
          saveServiceModalBtn.textContent = 'Simpan Layanan';
        }
      }
    });
  }

  if (btnRemoveServiceMedia) {
    btnRemoveServiceMedia.addEventListener('click', () => {
      serviceMediaUrlInput.value = '';
      if (serviceFileInput) serviceFileInput.value = '';
      updateServiceModalPreview('', '');
    });
  }

  if (serviceForm) {
    serviceForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (isUploadingServiceMedia) {
        showToast('Tunggu proses unggah media selesai terlebih dahulu.', 'error');
        return;
      }

      const id = document.getElementById('serviceFormId').value;
      const title = document.getElementById('modalServiceTitle').value.trim();
      const price = Math.max(0, parseInt(document.getElementById('modalServicePrice').value, 10) || 0);
      const pkg = document.getElementById('modalServicePackage').value.trim();
      const estimate = document.getElementById('modalServiceEstimate').value.trim();
      const icon = document.getElementById('modalServiceIcon').value;
      const shortDesc = document.getElementById('modalServiceDesc').value.trim();
      const mediaUrl = serviceMediaUrlInput.value.trim();

      if (saveServiceModalBtn) {
        saveServiceModalBtn.disabled = true;
        saveServiceModalBtn.textContent = 'Menyimpan ke Supabase...';
      }

      const previousServices = JSON.parse(JSON.stringify(cmsData.services || []));
      if (id) {
        const item = cmsData.services.find((s) => s.id === id);
        if (item) {
          item.title = title;
          item.price = price;
          item.package = pkg;
          item.estimate = estimate;
          item.icon = icon;
          item.shortDesc = shortDesc;
          item.mediaUrl = mediaUrl;
        }
      } else {
        cmsData.services.push({
          id: 'srv-' + Date.now().toString(36),
          title,
          price,
          priceLabel: 'Mulai dari',
          package: pkg,
          estimate,
          icon,
          shortDesc,
          mediaUrl,
          gradient: 'linear-gradient(135deg, #c59b6d 0%, #684227 60%, #3a2214 100%)'
        });
      }

      const ok = await saveAllCmsChanges('Layanan berhasil disimpan ke database Supabase!');
      if (saveServiceModalBtn) {
        saveServiceModalBtn.disabled = false;
        saveServiceModalBtn.textContent = 'Simpan Layanan';
      }

      if (ok) {
        serviceModal.classList.remove('open');
        renderServicesList();
      } else {
        cmsData.services = previousServices;
      }
    });
  }

  // ==========================================================================
  // 6. PORTFOLIO CRUD (Portofolio & Galeri)
  // ==========================================================================

  const portfolioGrid = document.getElementById('portfolioCardsList');
  const portfolioModal = document.getElementById('portfolioModal');
  const portfolioForm = document.getElementById('portfolioForm');
  const btnAddNewPortfolio = document.getElementById('btnAddNewPortfolio');
  const closePortfolioModalBtn = document.getElementById('closePortfolioModalBtn');
  const cancelPortfolioModalBtn = document.getElementById('cancelPortfolioModalBtn');
  const savePortfolioModalBtn = document.getElementById('savePortfolioModalBtn');
  const portfolioPreviewArea = document.getElementById('portfolioPreviewArea');
  const portfolioFileInput = document.getElementById('portfolioFileInput');
  const btnRemovePortMedia = document.getElementById('btnRemovePortMedia');
  const portfolioMediaUrlInput = document.getElementById('portfolioMediaUrl');

  function renderPortfolioList() {
    if (!portfolioGrid) return;
    const portfolio = cmsData.portfolio || [];

    if (portfolio.length === 0) {
      portfolioGrid.innerHTML = '<div style="grid-column:1/-1; padding:24px; text-align:center; color:#8c776a;">Belum ada karya portofolio. Klik "+ Tambah Karya Baru".</div>';
      return;
    }

    portfolioGrid.innerHTML = portfolio
      .map((p) => {
        const resolved = api.resolveMediaUrl(p.mediaUrl);
        return `
          <div class="cms-item-card" data-portfolio-id="${esc(p.id)}">
            <div class="cms-item-thumb" style="${resolved ? '' : `background:${esc(p.gradient || 'linear-gradient(135deg, #442416, #8c5d3b)')}`}">
              ${resolved ? renderMediaElement(resolved, p.title, false) : `<span style="color:#fff; font-weight:700;">${esc(p.title)}</span>`}
            </div>
            <div>
              <div class="cms-item-header">
                <span class="cms-item-title">${esc(p.title)}</span>
                <span class="cms-item-badge">${esc(p.badge || p.category)}</span>
              </div>
              <div class="cms-item-desc">${esc(p.client || 'Klien')} &bull; ${esc(p.year || '2025')}</div>
            </div>
            <div class="cms-item-actions">
              <button type="button" class="btn btn-outline-dark btn-sm edit-port-btn" data-id="${esc(p.id)}">✏️ Edit</button>
              <button type="button" class="btn btn-outline-dark btn-sm delete-port-btn" data-id="${esc(p.id)}" style="color:#dc2626; border-color:#fca5a5;">🗑️ Hapus</button>
            </div>
          </div>
        `;
      })
      .join('');

    portfolioGrid.querySelectorAll('.edit-port-btn').forEach((btn) => {
      btn.addEventListener('click', () => openPortfolioModal(btn.getAttribute('data-id')));
    });

    portfolioGrid.querySelectorAll('.delete-port-btn').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        if (!confirm('Apakah Anda yakin ingin menghapus karya ini secara permanen dari database?')) return;
        const backup = [...cmsData.portfolio];
        cmsData.portfolio = cmsData.portfolio.filter((p) => p.id !== id);
        renderPortfolioList();
        const ok = await saveAllCmsChanges('Karya portofolio dihapus dari database!');
        if (!ok) {
          cmsData.portfolio = backup;
          renderPortfolioList();
        }
      });
    });
  }

  function openPortfolioModal(portId) {
    if (!portfolioModal) return;
    const isEdit = Boolean(portId);
    document.getElementById('portfolioModalTitle').textContent = isEdit ? 'Edit Karya Portofolio' : 'Tambah Karya Baru';
    document.getElementById('portfolioFormId').value = portId || '';
    if (portfolioFileInput) portfolioFileInput.value = '';

    if (isEdit) {
      const p = cmsData.portfolio.find((item) => item.id === portId);
      if (p) {
        document.getElementById('modalPortTitle').value = p.title || '';
        document.getElementById('modalPortCategory').value = p.category || 'video';
        document.getElementById('modalPortBadge').value = p.badge || '';
        document.getElementById('modalPortClient').value = p.client || '';
        document.getElementById('modalPortYear').value = p.year || '';
        portfolioMediaUrlInput.value = p.mediaUrl || '';
        updatePortfolioModalPreview(p.mediaUrl, p.gradient);
      }
    } else {
      portfolioForm.reset();
      document.getElementById('portfolioFormId').value = '';
      portfolioMediaUrlInput.value = '';
      updatePortfolioModalPreview('', '');
    }

    portfolioModal.classList.add('open');
  }

  function updatePortfolioModalPreview(url, gradient) {
    if (!portfolioPreviewArea) return;
    const resolved = api.resolveMediaUrl(url);
    if (resolved) {
      portfolioPreviewArea.innerHTML = renderMediaElement(resolved, 'Preview', true);
      portfolioPreviewArea.style.background = 'none';
    } else {
      portfolioPreviewArea.innerHTML = '<span class="empty-placeholder">Belum ada media terpasang</span>';
      portfolioPreviewArea.style.background = gradient || '#e4d7cb';
    }
  }

  if (btnAddNewPortfolio) btnAddNewPortfolio.addEventListener('click', () => openPortfolioModal(null));
  if (closePortfolioModalBtn) closePortfolioModalBtn.addEventListener('click', () => portfolioModal.classList.remove('open'));
  if (cancelPortfolioModalBtn) cancelPortfolioModalBtn.addEventListener('click', () => portfolioModal.classList.remove('open'));

  if (portfolioFileInput) {
    portfolioFileInput.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      isUploadingPortfolioMedia = true;
      if (savePortfolioModalBtn) {
        savePortfolioModalBtn.disabled = true;
        savePortfolioModalBtn.textContent = 'Mengunggah media...';
      }

      try {
        showToast('Mengunggah karya visual ke Supabase Storage...');
        const uploaded = await api.uploadFile(file, 'portfolio');
        portfolioMediaUrlInput.value = uploaded.url;
        updatePortfolioModalPreview(uploaded.url);
        showToast('Media terunggah! Klik "Simpan Karya" untuk menerbitkan.');
      } catch (err) {
        portfolioFileInput.value = '';
        if (err.authExpired) {
          portfolioModal.classList.remove('open');
          handleSessionExpired(err.message);
          return;
        }
        showToast('Upload gagal: ' + err.message, 'error');
      } finally {
        isUploadingPortfolioMedia = false;
        if (savePortfolioModalBtn) {
          savePortfolioModalBtn.disabled = false;
          savePortfolioModalBtn.textContent = 'Simpan Karya';
        }
      }
    });
  }

  if (btnRemovePortMedia) {
    btnRemovePortMedia.addEventListener('click', () => {
      portfolioMediaUrlInput.value = '';
      if (portfolioFileInput) portfolioFileInput.value = '';
      updatePortfolioModalPreview('', '');
    });
  }

  if (portfolioForm) {
    portfolioForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (isUploadingPortfolioMedia) {
        showToast('Tunggu proses unggah media selesai terlebih dahulu.', 'error');
        return;
      }

      const id = document.getElementById('portfolioFormId').value;
      const title = document.getElementById('modalPortTitle').value.trim();
      const category = document.getElementById('modalPortCategory').value;
      const badge = document.getElementById('modalPortBadge').value.trim() || category;
      const client = document.getElementById('modalPortClient').value.trim();
      const year = document.getElementById('modalPortYear').value.trim();
      const mediaUrl = portfolioMediaUrlInput.value.trim();

      if (savePortfolioModalBtn) {
        savePortfolioModalBtn.disabled = true;
        savePortfolioModalBtn.textContent = 'Menyimpan ke Supabase...';
      }

      const previousPortfolio = JSON.parse(JSON.stringify(cmsData.portfolio || []));
      if (id) {
        const p = cmsData.portfolio.find((item) => item.id === id);
        if (p) {
          p.title = title;
          p.category = category;
          p.badge = badge;
          p.client = client;
          p.year = year;
          p.mediaUrl = mediaUrl;
        }
      } else {
        cmsData.portfolio.push({
          id: 'port-' + Date.now().toString(36),
          title,
          category,
          badge,
          client,
          year,
          mediaUrl,
          gradient: 'linear-gradient(135deg, #c59b6d 0%, #875c39 50%, #432415 100%)'
        });
      }

      const ok = await saveAllCmsChanges('Karya portofolio berhasil disimpan ke database Supabase!');
      if (savePortfolioModalBtn) {
        savePortfolioModalBtn.disabled = false;
        savePortfolioModalBtn.textContent = 'Simpan Karya';
      }

      if (ok) {
        portfolioModal.classList.remove('open');
        renderPortfolioList();
      } else {
        cmsData.portfolio = previousPortfolio;
      }
    });
  }

  // ==========================================================================
  // 7. ABOUT & PROCESS SECTIONS
  // ==========================================================================

  function renderAboutFeatures(features) {
    const container = document.getElementById('aboutFeaturesContainer');
    if (!container) return;

    container.innerHTML = features
      .map(
        (feat, idx) => `
        <div class="cms-form-group" style="background:#faf6f1; padding:14px; border-radius:12px;">
          <label class="cms-label" style="font-size:12px;">Keunggulan #${idx + 1}</label>
          <input type="text" class="cms-input feat-title-input" data-index="${idx}" value="${esc(feat.title || '')}" placeholder="Judul keunggulan">
          <label class="cms-label" style="font-size:11px; margin-top:8px;">Deskripsi</label>
          <textarea class="cms-textarea feat-desc-input" data-index="${idx}" rows="2" style="font-size:12px;">${esc(feat.description || '')}</textarea>
        </div>
      `
      )
      .join('');

    container.querySelectorAll('.feat-title-input').forEach((input) => {
      input.addEventListener('input', (e) => {
        const idx = parseInt(input.getAttribute('data-index'), 10);
        if (cmsData.about.features[idx]) cmsData.about.features[idx].title = e.target.value;
      });
    });

    container.querySelectorAll('.feat-desc-input').forEach((input) => {
      input.addEventListener('input', (e) => {
        const idx = parseInt(input.getAttribute('data-index'), 10);
        if (cmsData.about.features[idx]) cmsData.about.features[idx].description = e.target.value;
      });
    });
  }

  function renderProcessSteps(steps) {
    const container = document.getElementById('processStepsContainer');
    if (!container) return;

    container.innerHTML = steps
      .map(
        (step, idx) => `
        <div class="cms-form-group" style="background:#faf6f1; padding:14px; border-radius:12px;">
          <label class="cms-label" style="font-size:12px;">Langkah ${esc(step.number || '0' + (idx + 1))}</label>
          <input type="text" class="cms-input step-title-input" data-index="${idx}" value="${esc(step.title || '')}" placeholder="Judul langkah">
          <label class="cms-label" style="font-size:11px; margin-top:8px;">Deskripsi</label>
          <textarea class="cms-textarea step-desc-input" data-index="${idx}" rows="2" style="font-size:12px;">${esc(step.description || '')}</textarea>
        </div>
      `
      )
      .join('');

    container.querySelectorAll('.step-title-input').forEach((input) => {
      input.addEventListener('input', (e) => {
        const idx = parseInt(input.getAttribute('data-index'), 10);
        if (cmsData.process.steps[idx]) cmsData.process.steps[idx].title = e.target.value;
      });
    });

    container.querySelectorAll('.step-desc-input').forEach((input) => {
      input.addEventListener('input', (e) => {
        const idx = parseInt(input.getAttribute('data-index'), 10);
        if (cmsData.process.steps[idx]) cmsData.process.steps[idx].description = e.target.value;
      });
    });
  }

  // ==========================================================================
  // 8. TESTIMONIALS CRUD
  // ==========================================================================

  const testimonialsGrid = document.getElementById('testimonialsCardsList');
  const testimonialModal = document.getElementById('testimonialModal');
  const testimonialForm = document.getElementById('testimonialForm');
  const btnAddNewTestimonial = document.getElementById('btnAddNewTestimonial');
  const closeTestimonialModalBtn = document.getElementById('closeTestimonialModalBtn');
  const cancelTestimonialModalBtn = document.getElementById('cancelTestimonialModalBtn');
  const saveTestimonialModalBtn = document.getElementById('saveTestimonialModalBtn');

  function renderTestimonialsList() {
    if (!testimonialsGrid) return;
    const testimonials = cmsData.testimonials || [];

    if (testimonials.length === 0) {
      testimonialsGrid.innerHTML = '<div style="grid-column:1/-1; padding:24px; text-align:center; color:#8c776a;">Belum ada testimoni. Klik "+ Tambah Testimoni Baru".</div>';
      return;
    }

    testimonialsGrid.innerHTML = testimonials
      .map(
        (t) => `
        <div class="cms-item-card" data-testimonial-id="${esc(t.id)}">
          <div>
            <div class="testimonial-stars" style="color:#d8b48f; font-size:14px; margin-bottom:8px;">
              ${'&#9733;'.repeat(Math.min(5, Math.max(1, Number(t.rating) || 5)))}
            </div>
            <div class="cms-item-desc" style="font-style:italic;">&ldquo;${esc(t.quote || '')}&rdquo;</div>
            <div class="cms-item-header" style="margin-top:10px;">
              <div>
                <div class="cms-item-title" style="font-size:13.5px;">${esc(t.name)}</div>
                <div style="font-size:11px; color:#8c776a;">${esc(t.role)}</div>
              </div>
            </div>
          </div>
          <div class="cms-item-actions">
            <button type="button" class="btn btn-outline-dark btn-sm edit-test-btn" data-id="${esc(t.id)}">✏️ Edit</button>
            <button type="button" class="btn btn-outline-dark btn-sm delete-test-btn" data-id="${esc(t.id)}" style="color:#dc2626; border-color:#fca5a5;">🗑️ Hapus</button>
          </div>
        </div>
      `
      )
      .join('');

    testimonialsGrid.querySelectorAll('.edit-test-btn').forEach((btn) => {
      btn.addEventListener('click', () => openTestimonialModal(btn.getAttribute('data-id')));
    });

    testimonialsGrid.querySelectorAll('.delete-test-btn').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        if (!confirm('Hapus testimoni ini secara permanen dari database?')) return;
        const backup = [...cmsData.testimonials];
        cmsData.testimonials = cmsData.testimonials.filter((t) => t.id !== id);
        renderTestimonialsList();
        const ok = await saveAllCmsChanges('Testimoni dihapus dari database!');
        if (!ok) {
          cmsData.testimonials = backup;
          renderTestimonialsList();
        }
      });
    });
  }

  function openTestimonialModal(testId) {
    if (!testimonialModal) return;
    const isEdit = Boolean(testId);
    document.getElementById('testimonialModalTitle').textContent = isEdit ? 'Edit Testimoni' : 'Tambah Testimoni Baru';
    document.getElementById('testimonialFormId').value = testId || '';

    if (isEdit) {
      const t = cmsData.testimonials.find((item) => item.id === testId);
      if (t) {
        document.getElementById('modalTestName').value = t.name || '';
        document.getElementById('modalTestRole').value = t.role || '';
        document.getElementById('modalTestRating').value = t.rating || 5;
        document.getElementById('modalTestQuote').value = t.quote || '';
      }
    } else {
      testimonialForm.reset();
      document.getElementById('testimonialFormId').value = '';
    }

    testimonialModal.classList.add('open');
  }

  if (btnAddNewTestimonial) btnAddNewTestimonial.addEventListener('click', () => openTestimonialModal(null));
  if (closeTestimonialModalBtn) closeTestimonialModalBtn.addEventListener('click', () => testimonialModal.classList.remove('open'));
  if (cancelTestimonialModalBtn) cancelTestimonialModalBtn.addEventListener('click', () => testimonialModal.classList.remove('open'));

  if (testimonialForm) {
    testimonialForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const id = document.getElementById('testimonialFormId').value;
      const name = document.getElementById('modalTestName').value.trim();
      const role = document.getElementById('modalTestRole').value.trim();
      const rating = Math.min(5, Math.max(1, parseInt(document.getElementById('modalTestRating').value, 10) || 5));
      const quote = document.getElementById('modalTestQuote').value.trim();

      if (saveTestimonialModalBtn) {
        saveTestimonialModalBtn.disabled = true;
        saveTestimonialModalBtn.textContent = 'Menyimpan...';
      }

      const previous = JSON.parse(JSON.stringify(cmsData.testimonials || []));
      if (id) {
        const t = cmsData.testimonials.find((item) => item.id === id);
        if (t) {
          t.name = name;
          t.role = role;
          t.rating = rating;
          t.quote = quote;
        }
      } else {
        cmsData.testimonials.push({
          id: 'test-' + Date.now().toString(36),
          name,
          role,
          rating,
          quote
        });
      }

      const ok = await saveAllCmsChanges('Testimoni berhasil disimpan ke database Supabase!');
      if (saveTestimonialModalBtn) {
        saveTestimonialModalBtn.disabled = false;
        saveTestimonialModalBtn.textContent = 'Simpan Testimoni';
      }

      if (ok) {
        testimonialModal.classList.remove('open');
        renderTestimonialsList();
      } else {
        cmsData.testimonials = previous;
      }
    });
  }

  // ==========================================================================
  // 9. MASTER SAVE HANDLER (STRICT SUPABASE PERSISTENCE)
  // ==========================================================================

  function setSaveButtonsBusy(busy) {
    [btnSaveTop, btnSaveBottom].forEach((btn) => {
      if (!btn) return;
      btn.disabled = busy;
      if (busy) {
        btn.dataset.origHtml = btn.dataset.origHtml || btn.innerHTML;
        btn.textContent = '⏳ Menyimpan...';
      } else if (btn.dataset.origHtml) {
        btn.innerHTML = btn.dataset.origHtml;
      }
    });
  }

  async function saveAllCmsChanges(customSuccessMessage = '') {
    if (!cmsData || isSavingCms) return false;

    isSavingCms = true;
    setSaveButtonsBusy(true);

    try {
      // Collect form fields into cmsData
      cmsData.brand = cmsData.brand || {};
      cmsData.brand.name = getVal('brandName') || 'anindita';
      cmsData.brand.fullName = getVal('brandFullName') || 'Anindita Creative';
      cmsData.brand.tagline = getVal('brandTagline') || 'CREATIVE AGENCY BERBASIS PROJECT';
      cmsData.brand.copyright = getVal('brandCopyright') || '© 2026 Anindita Creative. Seluruh hak cipta dilindungi.';
      cmsData.brand.whatsappNumber = getVal('brandWaNum') || '6285733812033';
      cmsData.brand.whatsappDisplay = getVal('brandWaDisplay') || '0857-3381-2033';
      cmsData.brand.email = getVal('brandEmail') || 'aninditaspace05@gmail.com';
      cmsData.brand.instagram = getVal('brandInstagram') || '@anindita.creative';
      cmsData.brand.instagramUrl = getVal('brandInstagramUrl') || 'https://instagram.com/anindita.creative';
      cmsData.brand.title = getVal('heroTitle') || 'Kami mengubah ide<br>menjadi karya visual<br>yang bercerita.';
      cmsData.brand.description = getVal('heroDesc') || '';

      cmsData.stats = [
        { value: getVal('statVal1') || '150+', label: getVal('statLbl1') || 'Project selesai' },
        { value: getVal('statVal2') || '60+', label: getVal('statLbl2') || 'Klien puas' },
        { value: getVal('statVal3') || '5', label: getVal('statLbl3') || 'Layanan kreatif' }
      ];

      const tickerRaw = getVal('tickerInput');
      if (tickerRaw) {
        cmsData.ticker = tickerRaw
          .split(',')
          .map((s) => s.trim().toUpperCase())
          .filter(Boolean);
      }

      cmsData.about = cmsData.about || {};
      cmsData.about.title = getVal('aboutTitle');
      cmsData.about.description = getVal('aboutDesc');

      cmsData.process = cmsData.process || {};
      cmsData.process.title = getVal('processTitle');

      cmsData.cta = cmsData.cta || {};
      cmsData.cta.title = getVal('ctaTitle');
      cmsData.cta.description = getVal('ctaDesc');
      cmsData.cta.whatsappText = getVal('ctaBtnWa') || 'Chat via WhatsApp';
      cmsData.cta.cartText = getVal('ctaBtnCart') || 'Buka Keranjang';

      const saveResult = await api.saveContent(cmsData);
      if (saveResult.success) {
        if (saveResult.content) {
          cmsData = saveResult.content;
        }
        showToast(customSuccessMessage || saveResult.message || 'Semua perubahan tersimpan ke Supabase!', 'success');
        return true;
      }

      if (saveResult.authExpired) {
        handleSessionExpired(saveResult.error);
        return false;
      }

      showToast('GAGAL MENYIMPAN: ' + (saveResult.error || 'Terjadi kesalahan database.'), 'error');
      return false;
    } finally {
      isSavingCms = false;
      setSaveButtonsBusy(false);
    }
  }

  if (btnSaveTop) btnSaveTop.addEventListener('click', () => saveAllCmsChanges());
  if (btnSaveBottom) btnSaveBottom.addEventListener('click', () => saveAllCmsChanges());

  // ==========================================================================
  // 10. RELOAD FROM DATABASE
  // ==========================================================================

  if (btnResetPrompt && resetConfirmModal) {
    btnResetPrompt.addEventListener('click', () => resetConfirmModal.classList.add('open'));
  }
  if (cancelResetBtn && resetConfirmModal) {
    cancelResetBtn.addEventListener('click', () => resetConfirmModal.classList.remove('open'));
  }
  if (confirmResetBtn) {
    confirmResetBtn.addEventListener('click', async () => {
      resetConfirmModal.classList.remove('open');
      cmsData = await api.resetContentToDefault();
      populateAllForms();
      showToast('Data dimuat ulang dari database Supabase!');
    });
  }

  // ==========================================================================
  // 11. SECURITY & CHANGE PASSWORD
  // ==========================================================================

  const changePasswordForm = document.getElementById('changePasswordForm');
  if (changePasswordForm) {
    changePasswordForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const newU = document.getElementById('newUsernameInput').value.trim();
      const newP = document.getElementById('newPasswordInput').value;
      const confP = document.getElementById('confirmPasswordInput').value;

      if (newP !== confP) {
        showToast('Kata sandi baru dan konfirmasi tidak cocok!', 'error');
        return;
      }

      const res = await api.changeCredentials(newU, newP);
      if (res.success) {
        showToast(res.message || 'Kata sandi berhasil diperbarui!');
        changePasswordForm.reset();
        document.getElementById('newUsernameInput').value = newU;
      } else if (res.authExpired) {
        handleSessionExpired(res.error);
      } else {
        showToast('Gagal: ' + (res.error || 'Terjadi kesalahan'), 'error');
      }
    });
  }

  // ==========================================================================
  // 12. ORDERS TABLE & BRIEF MODAL CONTROLLER
  // ==========================================================================

  function updateOrderStats() {
    const total = allOrders.length;
    const pending = allOrders.filter((o) => o.status === 'pending_wa').length;
    const processing = allOrders.filter((o) => o.status === 'processing').length;
    const rev = allOrders.reduce((acc, o) => acc + (Number(o.total) || 0), 0);

    if (statTotal) statTotal.textContent = total;
    if (statPending) statPending.textContent = pending;
    if (statProcessing) statProcessing.textContent = processing;
    if (statRevenue) statRevenue.textContent = api.formatRupiah(rev);
  }

  function renderOrders(ordersToRender) {
    if (!ordersTbody) return;

    if (ordersToRender.length === 0) {
      const emptyLabel = allOrders.length === 0
        ? 'Belum ada pesanan masuk dari pelanggan.'
        : 'Tidak ada pesanan yang sesuai pencarian.';
      ordersTbody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align:center; padding:32px; color:var(--text-dark-secondary);">
            ${emptyLabel}
          </td>
        </tr>
      `;
      return;
    }

    ordersTbody.innerHTML = ordersToRender
      .map((order) => {
        const servicesText = (order.items || []).map((i) => `${i.title} (x${i.quantity})`).join(', ');
        let badgeClass = 'pending';
        if (order.status === 'processing') badgeClass = 'processing';
        if (order.status === 'done') badgeClass = 'done';

        return `
          <tr>
            <td><strong>${esc(order.id)}</strong></td>
            <td>
              <div style="font-weight:700;">${esc(order.customerName)}</div>
              <div style="font-size:12px; color:var(--text-dark-secondary);">${esc(order.brandName || '-')}</div>
            </td>
            <td style="max-width:220px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${esc(servicesText)}</td>
            <td><strong>${api.formatRupiah(order.total || 0)}</strong></td>
            <td>${esc(order.deadline || '-')}</td>
            <td>
              <span class="badge-status ${badgeClass}">${esc(order.statusLabel || order.status)}</span>
            </td>
            <td>
              <div style="display:flex; gap:6px;">
                <button type="button" class="btn btn-outline-dark btn-sm" data-view-order="${esc(order.id)}">Detail</button>
                <a href="https://wa.me/${esc((order.customerPhone || '').replace(/[^0-9]/g, ''))}" target="_blank" rel="noopener" class="btn btn-wa btn-sm">WA</a>
              </div>
            </td>
          </tr>
        `;
      })
      .join('');

    ordersTbody.querySelectorAll('[data-view-order]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-view-order');
        const found = allOrders.find((o) => o.id === id);
        if (found) showOrderDetail(found);
      });
    });
  }

  function showOrderDetail(order) {
    if (!briefModal) return;
    modalOrderId.textContent = `Detail Pesanan — ${order.id}`;

    const itemsHtml = (order.items || [])
      .map(
        (i) => `
        <div style="display:flex; justify-content:space-between; font-size:13.5px; border-bottom:1px solid #f0e6dc; padding:6px 0;">
          <span>${esc(i.title)} x${i.quantity || 1}</span>
          <strong>${api.formatRupiah((i.price || 0) * (i.quantity || 1))}</strong>
        </div>
      `
      )
      .join('');

    modalBodyDetails.innerHTML = `
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
        <div>
          <span style="font-size:12px; color:var(--text-dark-muted);">Nama Klien</span>
          <div style="font-weight:700;">${esc(order.customerName)}</div>
        </div>
        <div>
          <span style="font-size:12px; color:var(--text-dark-muted);">Nomor WhatsApp</span>
          <div style="font-weight:700;">${esc(order.customerPhone)}</div>
        </div>
        <div>
          <span style="font-size:12px; color:var(--text-dark-muted);">Brand / Usaha</span>
          <div style="font-weight:700;">${esc(order.brandName || '-')}</div>
        </div>
        <div>
          <span style="font-size:12px; color:var(--text-dark-muted);">Target Deadline</span>
          <div style="font-weight:700;">${esc(order.deadline || '-')}</div>
        </div>
      </div>

      <div style="margin-top:8px;">
        <span style="font-size:12px; color:var(--text-dark-muted);">Link Referensi / Google Drive</span>
        <div>
          ${order.referenceLink ? `<a href="${esc(order.referenceLink)}" target="_blank" rel="noopener" style="color:#0284c7; text-decoration:underline; word-break:break-all;">${esc(order.referenceLink)}</a>` : '<span style="color:#8c7e75;">Tidak ada link dilampirkan</span>'}
        </div>
      </div>

      <div style="margin-top:8px;">
        <span style="font-size:12px; color:var(--text-dark-muted);">Catatan Brief</span>
        <div style="background:#faf6f1; border-radius:10px; padding:12px; font-size:13px; line-height:1.5;">
          ${esc(order.briefNotes || 'Tidak ada catatan khusus.')}
        </div>
      </div>

      <div style="margin-top:12px;">
        <span style="font-size:12px; color:var(--text-dark-muted);">Daftar Layanan</span>
        <div style="margin-top:4px;">${itemsHtml}</div>
        <div style="display:flex; justify-content:space-between; margin-top:8px; font-size:15px; font-weight:800;">
          <span>Total</span>
          <span>${api.formatRupiah(order.total || 0)}</span>
        </div>
      </div>

      <div style="margin-top:16px; display:flex; gap:10px; border-top:1px solid #eee; padding-top:16px;">
        <button type="button" class="btn btn-dark btn-sm" id="btnMarkProcessing">Tandai Diproses</button>
        <button type="button" class="btn btn-wa btn-sm" id="btnMarkDone">Tandai Selesai</button>
      </div>
    `;

    document.getElementById('btnMarkProcessing').addEventListener('click', async () => {
      try {
        await api.updateOrderStatus(order.id, 'processing');
        await loadOrdersFromServer();
        briefModal.classList.remove('open');
        showToast('Status pesanan diubah ke Sedang Dikerjakan.');
      } catch (err) {
        if (err.authExpired) handleSessionExpired(err.message);
        else showToast('Gagal update status: ' + err.message, 'error');
      }
    });

    document.getElementById('btnMarkDone').addEventListener('click', async () => {
      try {
        await api.updateOrderStatus(order.id, 'done');
        await loadOrdersFromServer();
        briefModal.classList.remove('open');
        showToast('Status pesanan diubah ke Selesai.');
      } catch (err) {
        if (err.authExpired) handleSessionExpired(err.message);
        else showToast('Gagal update status: ' + err.message, 'error');
      }
    });

    briefModal.classList.add('open');
  }

  if (closeModalBtn) closeModalBtn.addEventListener('click', () => briefModal.classList.remove('open'));
  if (briefModal) {
    briefModal.addEventListener('click', (e) => {
      if (e.target === briefModal) briefModal.classList.remove('open');
    });
  }

  if (orderSearchInput) {
    orderSearchInput.addEventListener('input', (e) => {
      const q = e.target.value.toLowerCase().trim();
      const filtered = allOrders.filter(
        (o) =>
          (o.customerName && o.customerName.toLowerCase().includes(q)) ||
          (o.brandName && o.brandName.toLowerCase().includes(q)) ||
          (o.id && o.id.toLowerCase().includes(q))
      );
      renderOrders(filtered);
    });
  }

  // Toast notification helper (supports 'success' and 'error')
  function showToast(msg, variant = 'success') {
    if (!cmsToast) return;
    if (cmsToastMsg) cmsToastMsg.textContent = msg;
    if (cmsToastIcon) cmsToastIcon.innerHTML = variant === 'error' ? '&#9888;' : '&#10003;';
    cmsToast.classList.toggle('toast-error', variant === 'error');
    cmsToast.classList.add('show');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      cmsToast.classList.remove('show');
    }, variant === 'error' ? 5000 : 3200);
  }

  await checkAuthStatus();
});
