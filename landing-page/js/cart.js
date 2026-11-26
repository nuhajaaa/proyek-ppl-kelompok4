/**
 * Anindita Creative - Cart Drawer & State Management
 * Exactly matches 03 Cart Drawer (Overlay).png
 */

(function (window) {
  'use strict';

  const STORAGE_KEY = 'anindita_cart_v1';

  // Seed default initial cart matching the Figma UI screenshot
  const DEFAULT_INITIAL_CART = [
    {
      serviceId: "edit-video",
      title: "Edit Video",
      package: "Paket Reels",
      estimate: "Estimasi 2-3 hari kerja",
      price: 300000,
      quantity: 2,
      gradient: "linear-gradient(135deg, #c59b6d 0%, #684227 60%, #3a2214 100%)"
    },
    {
      serviceId: "edit-feed",
      title: "Edit Feed Instagram",
      package: "Carousel 9 slide",
      estimate: "Estimasi 2-3 hari kerja",
      price: 250000,
      quantity: 1,
      gradient: "linear-gradient(135deg, #7c4c31 0%, #462617 100%)"
    },
    {
      serviceId: "3d-text",
      title: "3D Text Movement",
      package: "Intro 10 detik",
      estimate: "Estimasi 2-3 hari kerja",
      price: 350000,
      quantity: 1,
      gradient: "linear-gradient(135deg, #4d2d1d 0%, #a47650 50%, #442416 100%)"
    }
  ];

  class CartManager {
    constructor() {
      this.items = this.loadCart();
      this.listeners = [];
      this.initDom();
    }

    loadCart() {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        try {
          return JSON.parse(stored);
        } catch (e) {
          console.error('Failed to parse cart storage', e);
        }
      }
      return [];
    }

    saveCart() {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.items));
      this.notify();
    }

    notify() {
      this.updateBadges();
      this.renderDrawer();
      this.listeners.forEach(fn => fn(this.items, this.getTotal()));
    }

    subscribe(fn) {
      this.listeners.push(fn);
    }

    getItems() {
      return this.items;
    }

    getCount() {
      return this.items.reduce((sum, item) => sum + (item.quantity || 1), 0);
    }

    getTotal() {
      return this.items.reduce((sum, item) => sum + (item.price * (item.quantity || 1)), 0);
    }

    addItem(service) {
      const existing = this.items.find(i => i.serviceId === service.id || i.title === service.title);
      if (existing) {
        existing.quantity += 1;
        if (service.mediaUrl) existing.mediaUrl = service.mediaUrl;
      } else {
        this.items.push({
          serviceId: service.id || 'service-' + Date.now(),
          title: service.title,
          package: service.package || 'Paket Standar',
          estimate: service.estimate || 'Estimasi 2-3 hari kerja',
          price: service.price || 150000,
          quantity: 1,
          mediaUrl: service.mediaUrl || '',
          gradient: service.gradient || 'linear-gradient(135deg, #c59b6d 0%, #684227 60%, #3a2214 100%)'
        });
      }
      this.saveCart();
      this.openCart();
    }

    removeItem(index) {
      if (index >= 0 && index < this.items.length) {
        this.items.splice(index, 1);
        this.saveCart();
      }
    }

    updateQuantity(index, delta) {
      if (index >= 0 && index < this.items.length) {
        this.items[index].quantity += delta;
        if (this.items[index].quantity <= 0) {
          this.removeItem(index);
        } else {
          this.saveCart();
        }
      }
    }

    openCart() {
      const backdrop = document.getElementById('drawerBackdrop');
      const drawer = document.getElementById('cartDrawer');
      if (backdrop && drawer) {
        backdrop.classList.add('open');
        drawer.classList.add('open');
        document.body.style.overflow = 'hidden';
      }
    }

    closeCart() {
      const backdrop = document.getElementById('drawerBackdrop');
      const drawer = document.getElementById('cartDrawer');
      if (backdrop && drawer) {
        backdrop.classList.remove('open');
        drawer.classList.remove('open');
        document.body.style.overflow = '';
      }
    }

    initDom() {
      document.addEventListener('DOMContentLoaded', () => {
        // Wire open buttons
        document.querySelectorAll('[data-open-cart]').forEach(btn => {
          btn.addEventListener('click', (e) => {
            e.preventDefault();
            this.openCart();
          });
        });

        // Wire close buttons
        const closeBtn = document.getElementById('closeCartBtn');
        const backdrop = document.getElementById('drawerBackdrop');
        if (closeBtn) closeBtn.addEventListener('click', () => this.closeCart());
        if (backdrop) backdrop.addEventListener('click', () => this.closeCart());

        // Fast WhatsApp order button inside drawer
        const fastWaBtn = document.getElementById('drawerFastWaBtn');
        if (fastWaBtn) {
          fastWaBtn.addEventListener('click', async () => {
            const items = this.getItems();
            if (items.length === 0) {
              alert('Keranjang Anda masih kosong. Silakan pilih layanan terlebih dahulu.');
              return;
            }
            const total = this.getTotal();
            const content = await window.AninditaAPI.getContent();
            const brandWa = (content.brand && content.brand.whatsappNumber) || '6285733812033';
            const defaultMsg = window.AninditaAPI.generateWhatsAppMessage({}, items, total);
            const waUrl = window.AninditaAPI.buildWhatsAppUrl(brandWa, defaultMsg);
            window.open(waUrl, '_blank');
          });
        }

        this.notify();
      });
    }

    updateBadges() {
      const count = this.getCount();
      document.querySelectorAll('[data-cart-badge]').forEach(badge => {
        badge.textContent = count;
        badge.style.display = count > 0 ? 'flex' : 'none';
      });

      const drawerTitle = document.getElementById('drawerCartTitle');
      if (drawerTitle) {
        drawerTitle.textContent = `Keranjang (${count})`;
      }
    }

    renderDrawer() {
      const listEl = document.getElementById('drawerItemList');
      const subtotalEl = document.getElementById('drawerSubtotal');
      const emptyEl = document.getElementById('drawerEmpty');
      const footerEl = document.getElementById('drawerFooter');

      if (!listEl) return;

      const items = this.getItems();
      const total = this.getTotal();

      if (subtotalEl) {
        subtotalEl.textContent = window.AninditaAPI ? window.AninditaAPI.formatRupiah(total) : `Rp ${total}`;
      }

      if (items.length === 0) {
        listEl.innerHTML = '';
        if (emptyEl) emptyEl.style.display = 'block';
        if (footerEl) footerEl.style.display = 'none';
        return;
      }

      if (emptyEl) emptyEl.style.display = 'none';
      if (footerEl) footerEl.style.display = 'flex';

      listEl.innerHTML = items.map((item, index) => {
        const itemTotal = item.price * (item.quantity || 1);
        const formattedPrice = window.AninditaAPI ? window.AninditaAPI.formatRupiah(itemTotal) : `Rp ${itemTotal}`;
        const mediaSrc = window.AninditaAPI ? window.AninditaAPI.resolveMediaUrl(item.mediaUrl) : (item.mediaUrl || '');
        const hasImage = mediaSrc && !(window.AninditaAPI && window.AninditaAPI.isVideoUrl(mediaSrc));
        return `
          <div class="drawer-item-card">
            <div class="item-thumb-sm" style="background: ${item.gradient}; overflow:hidden;">
              ${hasImage ? `<img src="${mediaSrc}" alt="${item.title}" style="width:100%; height:100%; object-fit:cover;">` : ''}
            </div>
            <div class="drawer-item-details">
              <h4>${item.title}</h4>
              <p class="item-pkg">${item.package || ''}</p>
              <p class="item-price-line">
                <span class="qty-label">Qty ${item.quantity}</span> &bull; ${formattedPrice}
              </p>
            </div>
            <button type="button" class="btn-trash" data-remove-index="${index}" title="Hapus dari keranjang" aria-label="Hapus item">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                <line x1="10" y1="11" x2="10" y2="17"></line>
                <line x1="14" y1="11" x2="14" y2="17"></line>
              </svg>
            </button>
          </div>
        `;
      }).join('');

      // Wire trash buttons
      listEl.querySelectorAll('[data-remove-index]').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const idx = parseInt(btn.getAttribute('data-remove-index'), 10);
          this.removeItem(idx);
        });
      });
    }
  }

  window.cartManager = new CartManager();
})(window);

