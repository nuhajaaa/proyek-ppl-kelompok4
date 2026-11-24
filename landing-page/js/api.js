/**
 * Anindita Creative - API & Data Layer
 * Ready for Backend Integration (REST API + LocalStorage Fallback)
 */

(function (window) {
  'use strict';

  const STORAGE_KEY_CART = 'anindita_cart_v1';
  const STORAGE_KEY_ORDERS = 'anindita_orders_v1';
  const STORAGE_KEY_CONTENT = 'anindita_content_cache';

  const DEFAULT_CONTENT_FALLBACK = {
    brand: {
      name: "anindita",
      fullName: "Anindita Creative",
      tagline: "CREATIVE AGENCY BERBASIS PROJECT",
      whatsappNumber: "6285733812033",
      whatsappDisplay: "0857-3381-2033",
      email: "hello@anindita.id",
      instagram: "@anindita.creative"
    },
    services: [
      {
        id: "edit-video",
        title: "Edit Video",
        shortDesc: "Reels, TikTok, YouTube: cutting rapi, color grading, subtitle, dan sound design.",
        price: 150000,
        package: "Paket Reels - maks. 60 detik",
        estimate: "Estimasi 2-3 hari kerja",
        gradient: "linear-gradient(135deg, #c59b6d 0%, #684227 60%, #3a2214 100%)"
      },
      {
        id: "edit-feed",
        title: "Edit Feed",
        shortDesc: "Tata letak feed Instagram yang konsisten: carousel, retouch, dan palet warna brand.",
        price: 250000,
        package: "Carousel 9 slide + retouch",
        estimate: "Estimasi 2-3 hari kerja",
        gradient: "linear-gradient(135deg, #7c4c31 0%, #462617 100%)"
      },
      {
        id: "videographer",
        title: "Videographer",
        shortDesc: "Shooting profesional untuk produk, event, dan company profile lengkap dengan crew.",
        price: 1500000,
        package: "Shooting Half Day + Crew",
        estimate: "Estimasi 3-5 hari kerja",
        gradient: "linear-gradient(135deg, #d8b48f 0%, #7e5539 60%, #3a2013 100%)"
      },
      {
        id: "3d-text",
        title: "3D Text Movement",
        shortDesc: "Teks 3D bergerak yang mencuri perhatian untuk intro, judul, dan iklan.",
        price: 350000,
        package: "Intro teks 3D - 10 detik",
        estimate: "Estimasi 2-3 hari kerja",
        gradient: "linear-gradient(135deg, #4d2d1d 0%, #a47650 50%, #442416 100%)"
      },
      {
        id: "motion-graphic",
        title: "Motion Graphic",
        shortDesc: "Animasi logo, infografis, dan elemen motion untuk memperkuat cerita brand.",
        price: 400000,
        package: "Animasi logo & aset visual",
        estimate: "Estimasi 2-4 hari kerja",
        gradient: "linear-gradient(135deg, #b98961 0%, #593725 100%)"
      },
      {
        id: "paket-bulanan",
        title: "Paket Konten Bulanan",
        shortDesc: "Paket hemat: video, feed, dan konsultasi konten dalam satu kontrak bulanan.",
        price: 2500000,
        package: "8 Reels + 12 Feed + Brief Konten",
        estimate: "Estimasi kontrak 1 bulan",
        gradient: "linear-gradient(135deg, #8b6545 0%, #381f12 100%)"
      }
    ]
  };

  const AninditaAPI = {
    /**
     * Format number to Indonesian Rupiah currency string
     * e.g. 1200000 -> "Rp 1.200.000"
     */
    formatRupiah: function (amount) {
      if (typeof amount !== 'number') amount = Number(amount) || 0;
      return 'Rp ' + amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    },

    /**
     * Load application content from content.json or API
     */
    getContent: async function () {
      try {
        const response = await fetch('./content.json');
        if (response.ok) {
          const data = await response.json();
          localStorage.setItem(STORAGE_KEY_CONTENT, JSON.stringify(data));
          return data;
        }
      } catch (err) {
        console.warn('Backend/File fetch failed, falling back to cache or defaults:', err);
      }

      const cached = localStorage.getItem(STORAGE_KEY_CONTENT);
      if (cached) {
        try { return JSON.parse(cached); } catch (e) {}
      }

      return DEFAULT_CONTENT_FALLBACK;
    },

    /**
     * Get list of services
     */
    getServices: async function () {
      const content = await this.getContent();
      return content.services || DEFAULT_CONTENT_FALLBACK.services;
    },

    /**
     * Get portfolio list
     */
    getPortfolio: async function () {
      const content = await this.getContent();
      return content.portfolio || [];
    },

    /**
     * Retrieve stored orders (Local + Backend sync)
     */
    getOrders: async function () {
      try {
        const res = await fetch('/api/orders');
        if (res.ok) {
          const data = await res.json();
          return data;
        }
      } catch (e) {
        // Fallback to local storage
      }

      const stored = localStorage.getItem(STORAGE_KEY_ORDERS);
      if (stored) {
        try {
          return JSON.parse(stored);
        } catch (e) {}
      }

      // Default sample orders
      const content = await this.getContent();
      return content.sampleOrders || [];
    },

    /**
     * Create a new project order
     */
    createOrder: async function (orderData) {
      const order = {
        id: 'ORD-' + Date.now().toString().slice(-6),
        createdAt: new Date().toISOString(),
        status: 'pending_wa',
        statusLabel: 'Menunggu WhatsApp',
        ...orderData
      };

      // Try server POST first
      try {
        const res = await fetch('/api/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(order)
        });
        if (res.ok) {
          const saved = await res.json();
          return saved;
        }
      } catch (e) {
        // Continue to local save
      }

      // Local storage persistence
      const orders = await this.getOrders();
      orders.unshift(order);
      localStorage.setItem(STORAGE_KEY_ORDERS, JSON.stringify(orders));
      return order;
    },

    /**
     * Update order status
     */
    updateOrderStatus: async function (orderId, newStatus) {
      try {
        await fetch(`/api/orders/${orderId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: newStatus })
        });
      } catch (e) {}

      const orders = await this.getOrders();
      const target = orders.find(o => o.id === orderId);
      if (target) {
        target.status = newStatus;
        if (newStatus === 'done') target.statusLabel = 'Selesai';
        else if (newStatus === 'processing') target.statusLabel = 'Sedang Dikerjakan';
        else target.statusLabel = 'Menunggu WhatsApp';
        localStorage.setItem(STORAGE_KEY_ORDERS, JSON.stringify(orders));
      }
      return target;
    },

    /**
     * Formats WhatsApp message exactly as specified in the design preview
     */
    generateWhatsAppMessage: function (formInfo, cartItems, totalAmount) {
      let lines = [];
      lines.push('Halo Anindita Creative, saya ingin memesan:');
      lines.push('');

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

      const nama = formInfo.nama || 'Budi Santoso';
      const brand = formInfo.brand || 'Kopi Senja';
      const deadline = formInfo.deadlineFormatted || formInfo.deadline || '30 Nov 2026';

      lines.push(`Nama: ${nama}`);
      lines.push(`Brand: ${brand}`);
      lines.push(`Deadline: ${deadline}`);

      if (formInfo.link) {
        lines.push(`Link Referensi: ${formInfo.link}`);
      }
      if (formInfo.catatan) {
        lines.push(`Catatan Brief: ${formInfo.catatan}`);
      }

      lines.push('');
      lines.push('Terima kasih!');

      return lines.join('\n');
    },

    /**
     * Build WhatsApp URL
     */
    buildWhatsAppUrl: function (phone, text) {
      const cleanPhone = phone.replace(/[^0-9]/g, '');
      return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`;
    }
  };

  window.AninditaAPI = AninditaAPI;
})(window);

