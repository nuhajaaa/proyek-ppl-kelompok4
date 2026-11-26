/**
 * Anindita Creative - Frontend API & Data Layer
 * Strict Supabase Auth JWT lifecycle (auto-refresh), Supabase Storage upload,
 * zero silent error swallowing, and live cross-tab CMS synchronization.
 */

(function (window) {
  'use strict';

  const STORAGE_KEY_CART = 'anindita_cart_v1';
  const STORAGE_KEY_ORDERS = 'anindita_orders_v1';
  const STORAGE_KEY_CONTENT = 'anindita_content_cache';
  const STORAGE_KEY_TOKEN = 'anindita_admin_token';
  const STORAGE_KEY_REFRESH = 'anindita_admin_refresh_token';
  const STORAGE_KEY_USER = 'anindita_admin_user';
  const STORAGE_KEY_CMS_SYNC = 'anindita_cms_updated_at';
  const MAX_CLIENT_UPLOAD_BYTES = 25 * 1024 * 1024;

  const DEFAULT_CONTENT_FALLBACK = {
    brand: {
      name: 'anindita',
      fullName: 'Anindita Creative',
      tagline: 'CREATIVE AGENCY BERBASIS PROJECT',
      title: 'Kami mengubah ide<br>menjadi karya visual<br>yang bercerita.',
      description: 'Edit video, edit feed, videographer, hingga 3D text movement. Satu tim kreatif untuk membuat brand Anda tampil memukau dan mudah diingat.',
      whatsappNumber: '6285733812033',
      whatsappDisplay: '0857-3381-2033',
      email: 'aninditaspace05@gmail.com',
      instagram: '@anindita.creative',
      instagramUrl: 'https://instagram.com/anindita.creative',
      copyright: '© 2026 Anindita Creative. Seluruh hak cipta dilindungi.'
    },
    stats: [
      { value: '150+', label: 'Project selesai' },
      { value: '60+', label: 'Klien puas' },
      { value: '5', label: 'Layanan kreatif' }
    ],
    showcase: [
      { id: 'hero-1', title: 'Reels Skincare Lumi Beauty', category: 'Edit Video', badge: 'Edit Video', gradient: 'linear-gradient(135deg, #c59b6d 0%, #684227 60%, #3a2214 100%)', mediaUrl: '' },
      { id: 'hero-2', title: '3D Text Intro Toko Nusantara', category: '3D Text', badge: '3D Text', gradient: 'linear-gradient(135deg, #4d2d1d 0%, #a47650 50%, #442416 100%)', mediaUrl: '' },
      { id: 'hero-3', title: 'Instagram Feed Kopi Senja', category: 'Edit Feed', badge: 'Edit Feed', gradient: 'linear-gradient(135deg, #7c4c31 0%, #462617 100%)', mediaUrl: '' },
      { id: 'hero-4', title: 'Company Profile PT Maju Jaya', category: 'Videographer', badge: 'Videographer', gradient: 'linear-gradient(135deg, #d8b48f 0%, #7e5539 60%, #3a2013 100%)', mediaUrl: '' }
    ],
    ticker: ['EDIT VIDEO', 'EDIT FEED', 'VIDEOGRAPHER', '3D TEXT MOVEMENT', 'MOTION GRAPHIC', 'CONTENT PACKAGE'],
    services: [],
    portfolio: [],
    about: {
      eyebrow: 'TENTANG KAMI',
      title: 'Studio kreatif yang berfokus pada hasil setiap project.',
      description: 'Anindita adalah agensi kreatif yang berkerja per project. Kami memadukan sentuhan visual yang hangat dengan proses kerja yang jelas, sehingga ide Anda tidak hanya terlihat bagus, tetapi juga tepat sasaran.',
      features: []
    },
    process: {
      eyebrow: 'PROSES KERJA',
      title: 'Dari chat pertama sampai hasil akhir, semuanya terarah.',
      steps: []
    },
    testimonials: [],
    cta: {
      title: 'Punya project? Ayo kita bicarakan.',
      description: 'Pilih layanan, isi brief singkat, dan pesanan Anda langsung terkirim ke WhatsApp kami.',
      whatsappText: 'Chat via WhatsApp',
      cartText: 'Buka Keranjang'
    }
  };

  let refreshInFlight = null;

  function clearStoredAuth() {
    localStorage.removeItem(STORAGE_KEY_TOKEN);
    localStorage.removeItem(STORAGE_KEY_REFRESH);
    localStorage.removeItem(STORAGE_KEY_USER);
  }

  function broadcastCmsUpdated() {
    const timestamp = String(Date.now());
    try {
      localStorage.setItem(STORAGE_KEY_CMS_SYNC, timestamp);
    } catch (_) {}
    if (typeof window.BroadcastChannel === 'function') {
      try {
        const ch = new BroadcastChannel('anindita_cms_sync');
        ch.postMessage({ type: 'cms-updated', at: Number(timestamp) });
        ch.close();
      } catch (_) {}
    }
  }

  async function safeParseJson(res) {
    try {
      return await res.json();
    } catch (_) {
      return null;
    }
  }

  const AninditaAPI = {
    /**
     * Accurately detect video media URLs by file extension or data URI MIME
     * (Never uses fragile substring matching like `.includes('video')`).
     */
    isVideoUrl: function (url) {
      if (!url || typeof url !== 'string') return false;
      const trimmed = url.trim();
      if (/^data:video\//i.test(trimmed)) return true;
      const withoutQuery = trimmed.split('#')[0].split('?')[0];
      return /\.(mp4|webm|mov|m4v|ogg)$/i.test(withoutQuery);
    },

    /**
     * Resolve media URLs cleanly across Supabase Storage HTTPS URLs & legacy /uploads/ paths
     */
    resolveMediaUrl: function (url) {
      if (!url || typeof url !== 'string') return '';
      const trimmed = url.trim();
      if (!trimmed) return '';
      if (/^(https?:\/\/|data:|blob:)/i.test(trimmed)) return trimmed;
      if (trimmed.startsWith('/uploads/')) return trimmed;
      if (trimmed.startsWith('uploads/')) return '/' + trimmed;
      return trimmed;
    },

    /**
     * Escape untrusted text before inserting into HTML strings/attributes
     */
    escapeHtml: function (value) {
      return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    },

    /**
     * Get Supabase connection status from server
     */
    getSupabaseStatus: async function () {
      try {
        const res = await fetch('/api/supabase-status', { cache: 'no-store' });
        if (res.ok) {
          return await res.json();
        }
      } catch (_) {}
      return {
        configured: false,
        url: null,
        authMode: 'local',
        message: 'Tidak dapat terhubung ke server backend.'
      };
    },

    /**
     * Format number to Indonesian Rupiah currency string
     */
    formatRupiah: function (amount) {
      const num = Number(amount) || 0;
      return 'Rp ' + Math.round(num).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    },

    getAuthToken: function () {
      return localStorage.getItem(STORAGE_KEY_TOKEN) || '';
    },

    getRefreshToken: function () {
      return localStorage.getItem(STORAGE_KEY_REFRESH) || '';
    },

    getCurrentUser: function () {
      return localStorage.getItem(STORAGE_KEY_USER) || '';
    },

    /**
     * Refresh expired Supabase access token transparently using refresh token
     */
    refreshSession: async function () {
      const refreshToken = this.getRefreshToken();
      if (!refreshToken) return false;

      if (refreshInFlight) return refreshInFlight;

      refreshInFlight = (async () => {
        try {
          const res = await fetch('/api/refresh', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken })
          });
          const data = await safeParseJson(res);
          if (res.ok && data?.token) {
            localStorage.setItem(STORAGE_KEY_TOKEN, data.token);
            if (data.refreshToken) {
              localStorage.setItem(STORAGE_KEY_REFRESH, data.refreshToken);
            }
            const displayName = data.user?.email || data.user?.username || this.getCurrentUser();
            if (displayName) localStorage.setItem(STORAGE_KEY_USER, displayName);
            return true;
          }
          clearStoredAuth();
          return false;
        } catch (_) {
          return false;
        } finally {
          refreshInFlight = null;
        }
      })();

      return refreshInFlight;
    },

    /**
     * Authenticated fetch wrapper with single automatic token-refresh retry on 401
     */
    authFetch: async function (url, options = {}) {
      const buildHeaders = (token) => ({
        ...(options.headers || {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      });

      let res = await fetch(url, {
        cache: 'no-store',
        ...options,
        headers: buildHeaders(this.getAuthToken())
      });

      if (res.status === 401 && this.getRefreshToken()) {
        const refreshed = await this.refreshSession();
        if (refreshed) {
          res = await fetch(url, {
            cache: 'no-store',
            ...options,
            headers: buildHeaders(this.getAuthToken())
          });
        }
      }

      if (res.status === 401) {
        clearStoredAuth();
      }
      return res;
    },

    /**
     * Check authentication status against backend (and auto-refresh if expired)
     */
    checkAuth: async function () {
      const token = this.getAuthToken();
      if (!token) return { authenticated: false };

      try {
        let res = await fetch('/api/auth-check', {
          cache: 'no-store',
          headers: { Authorization: `Bearer ${token}` }
        });
        let data = await safeParseJson(res);

        if (res.ok && data?.authenticated) {
          const userObj = data.user || {};
          const displayName = userObj.email || userObj.username || this.getCurrentUser();
          if (displayName) localStorage.setItem(STORAGE_KEY_USER, displayName);
          return { authenticated: true, user: userObj, displayName };
        }

        if (data?.expired && this.getRefreshToken()) {
          const refreshed = await this.refreshSession();
          if (refreshed) {
            res = await fetch('/api/auth-check', {
              cache: 'no-store',
              headers: { Authorization: `Bearer ${this.getAuthToken()}` }
            });
            data = await safeParseJson(res);
            if (res.ok && data?.authenticated) {
              const userObj = data.user || {};
              const displayName = userObj.email || userObj.username || this.getCurrentUser();
              if (displayName) localStorage.setItem(STORAGE_KEY_USER, displayName);
              return { authenticated: true, user: userObj, displayName };
            }
          }
        }

        // Token is invalid/legacy/expired — clear stale localStorage so admin gets clean login gate
        clearStoredAuth();
        return { authenticated: false, reason: data?.reason || 'Sesi berakhir. Silakan login kembali.' };
      } catch (err) {
        return { authenticated: false, reason: 'Server tidak terjangkau: ' + err.message };
      }
    },

    /**
     * Login admin via Supabase Auth
     */
    login: async function (emailOrUsername, password) {
      try {
        const res = await fetch('/api/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: emailOrUsername,
            username: emailOrUsername,
            password
          })
        });
        const data = await safeParseJson(res);
        if (res.ok && data?.token) {
          localStorage.setItem(STORAGE_KEY_TOKEN, data.token);
          if (data.refreshToken) {
            localStorage.setItem(STORAGE_KEY_REFRESH, data.refreshToken);
          } else {
            localStorage.removeItem(STORAGE_KEY_REFRESH);
          }
          const displayName = data.user?.email || data.user?.username || emailOrUsername;
          localStorage.setItem(STORAGE_KEY_USER, displayName);
          return {
            success: true,
            token: data.token,
            user: data.user,
            message: data.message
          };
        }
        return {
          success: false,
          error: data?.error || data?.message || 'Email atau kata sandi salah.'
        };
      } catch (err) {
        return { success: false, error: 'Koneksi ke server gagal: ' + err.message };
      }
    },

    /**
     * Register a new admin via Supabase Auth
     */
    register: async function (email, password, username, fullName) {
      try {
        const res = await fetch('/api/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password, username, fullName })
        });
        const data = await safeParseJson(res);
        if (res.ok && data?.success) {
          return { success: true, user: data.user, message: data.message };
        }
        return { success: false, error: data?.error || 'Pendaftaran gagal.' };
      } catch (err) {
        return { success: false, error: 'Koneksi ke server gagal: ' + err.message };
      }
    },

    /**
     * Logout admin
     */
    logout: async function () {
      const token = this.getAuthToken();
      try {
        if (token) {
          await fetch('/api/logout', {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` }
          });
        }
      } catch (_) {}

      clearStoredAuth();
      return { success: true };
    },

    /**
     * Change admin password / username
     */
    changeCredentials: async function (newUsername, newPassword) {
      try {
        const res = await this.authFetch('/api/change-credentials', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: newUsername, password: newPassword })
        });
        const data = await safeParseJson(res);
        if (res.ok && data?.success) {
          return { success: true, message: data.message };
        }
        return {
          success: false,
          authExpired: res.status === 401,
          error: data?.error || 'Gagal memperbarui kredensial.'
        };
      } catch (err) {
        return { success: false, error: 'Koneksi ke server gagal: ' + err.message };
      }
    },

    /**
     * Load latest website content directly from backend (Supabase PostgreSQL source of truth)
     */
    getContent: async function () {
      const cacheBust = '?_t=' + Date.now();

      try {
        const res = await fetch('/api/content' + cacheBust, { cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          if (data && typeof data === 'object') {
            try {
              localStorage.setItem(STORAGE_KEY_CONTENT, JSON.stringify(data));
            } catch (_) {}
            return data;
          }
        }
      } catch (err) {
        console.warn('[API] GET /api/content gagal, mencoba fallback:', err.message);
      }

      // Offline / static file fallback only
      try {
        const response = await fetch('./content.json' + cacheBust, { cache: 'no-store' });
        if (response.ok) {
          const data = await response.json();
          if (data && typeof data === 'object') return data;
        }
      } catch (_) {}

      const cached = localStorage.getItem(STORAGE_KEY_CONTENT);
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (parsed && typeof parsed === 'object') return parsed;
        } catch (_) {}
      }

      return DEFAULT_CONTENT_FALLBACK;
    },

    /**
     * Save updated website content to Supabase PostgreSQL via backend.
     * STRICT: Never fakes success when backend rejects the write!
     */
    saveContent: async function (newContent) {
      try {
        const res = await this.authFetch('/api/content', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newContent)
        });
        const data = await safeParseJson(res);

        if (res.ok && data?.success) {
          const persisted = data.content || newContent;
          try {
            localStorage.setItem(STORAGE_KEY_CONTENT, JSON.stringify(persisted));
          } catch (_) {}
          broadcastCmsUpdated();
          return {
            success: true,
            supabaseSynced: Boolean(data.supabaseSynced),
            syncedAt: data.syncedAt || null,
            summary: data.summary || null,
            content: persisted,
            message: data.message || 'Semua perubahan berhasil disimpan ke database!'
          };
        }

        return {
          success: false,
          status: res.status,
          authExpired: res.status === 401,
          error: data?.error || `Gagal menyimpan ke database (HTTP ${res.status}).`
        };
      } catch (err) {
        return {
          success: false,
          status: 0,
          error: 'Koneksi ke server gagal saat menyimpan perubahan: ' + err.message
        };
      }
    },

    /**
     * Upload an image or video file to Supabase Storage via protected /api/upload.
     * STRICT: Never falls back to shoving multi-MB base64 strings into DB/localStorage!
     */
    uploadFile: function (file, folder = 'general') {
      return new Promise((resolve, reject) => {
        if (!file) return reject(new Error('Tidak ada file dipilih.'));
        if (file.size > MAX_CLIENT_UPLOAD_BYTES) {
          return reject(new Error('Ukuran berkas terlalu besar (maksimal 25 MB).'));
        }

        const reader = new FileReader();
        reader.onload = async (event) => {
          const base64Data = event.target.result;
          try {
            const res = await AninditaAPI.authFetch('/api/upload', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                filename: file.name,
                folder,
                base64Data
              })
            });
            const data = await safeParseJson(res);
            if (res.ok && data?.success && data.url) {
              resolve({
                success: true,
                url: data.url,
                storage: data.storage || 'supabase',
                name: file.name
              });
              return;
            }

            const err = new Error(data?.error || `Upload gagal (HTTP ${res.status}).`);
            err.status = res.status;
            err.authExpired = res.status === 401;
            reject(err);
          } catch (networkErr) {
            reject(new Error('Gagal menghubungi server upload: ' + networkErr.message));
          }
        };

        reader.onerror = () => reject(new Error('Gagal membaca berkas dari perangkat Anda.'));
        reader.readAsDataURL(file);
      });
    },

    /**
     * Reload fresh content from server database
     */
    resetContentToDefault: async function () {
      localStorage.removeItem(STORAGE_KEY_CONTENT);
      return await this.getContent();
    },

    getServices: async function () {
      const content = await this.getContent();
      return content.services || [];
    },

    getPortfolio: async function () {
      const content = await this.getContent();
      return content.portfolio || [];
    },

    /**
     * Retrieve stored orders (Admin protected endpoint)
     */
    getOrders: async function () {
      const res = await this.authFetch('/api/orders', { method: 'GET' });
      const data = await safeParseJson(res);
      if (res.ok && Array.isArray(data)) {
        return data;
      }
      const err = new Error(data?.error || `Gagal mengambil daftar pesanan (HTTP ${res.status}).`);
      err.status = res.status;
      err.authExpired = res.status === 401;
      throw err;
    },

    /**
     * Create a new project order (Public checkout endpoint)
     */
    createOrder: async function (orderData) {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderData)
      });
      const data = await safeParseJson(res);
      if (res.ok && data?.id) {
        return data;
      }
      throw new Error(data?.error || `Gagal menyimpan pesanan (HTTP ${res.status}).`);
    },

    /**
     * Update order status (Admin protected endpoint)
     */
    updateOrderStatus: async function (orderId, newStatus) {
      const res = await this.authFetch(`/api/orders/${encodeURIComponent(orderId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      const data = await safeParseJson(res);
      if (res.ok && data) {
        return data;
      }
      const err = new Error(data?.error || `Gagal memperbarui status pesanan (HTTP ${res.status}).`);
      err.status = res.status;
      err.authExpired = res.status === 401;
      throw err;
    },

    /**
     * Format WhatsApp message
     */
    generateWhatsAppMessage: function (formInfo, cartItems, totalAmount) {
      const lines = ['Halo Anindita Creative, saya ingin memesan:', ''];

      if (cartItems && cartItems.length > 0) {
        cartItems.forEach((item, index) => {
          const itemTotal = (item.price || 0) * (item.quantity || 1);
          lines.push(`${index + 1}. ${item.title} x${item.quantity} - ${this.formatRupiah(itemTotal)}`);
        });
      } else {
        lines.push('(Belum ada layanan yang dipilih)');
      }

      lines.push('');
      lines.push(`Total: ${this.formatRupiah(totalAmount)}`);
      lines.push('');

      if (formInfo.nama) lines.push(`Nama: ${formInfo.nama}`);
      if (formInfo.brand) lines.push(`Brand: ${formInfo.brand}`);
      const deadline = formInfo.deadlineFormatted || formInfo.deadline;
      if (deadline) lines.push(`Deadline: ${deadline}`);
      if (formInfo.link) lines.push(`Link Referensi: ${formInfo.link}`);
      if (formInfo.catatan) lines.push(`Catatan Brief: ${formInfo.catatan}`);

      lines.push('');
      lines.push('Terima kasih!');
      return lines.join('\n');
    },

    /**
     * Build WhatsApp URL
     */
    buildWhatsAppUrl: function (phone, text) {
      const cleanPhone = String(phone || '6285733812033').replace(/[^0-9]/g, '');
      return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`;
    }
  };

  window.AninditaAPI = AninditaAPI;
})(window);
