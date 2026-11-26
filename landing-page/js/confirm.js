/**
 * Anindita Creative - Confirmation Page Handler
 * Reads active customer order from sessionStorage (never calls admin-only /api/orders)
 * and loads studio WhatsApp destination dynamically from Supabase.
 */

document.addEventListener('DOMContentLoaded', async () => {
  'use strict';

  const summaryItemsEl = document.getElementById('confirmSummaryItems');
  const totalAmountEl = document.getElementById('confirmTotalAmount');
  const confirmWaBtn = document.getElementById('confirmWaBtn');

  const api = window.AninditaAPI;
  const content = await api.getContent();
  const brandWaNumber = (content.brand && content.brand.whatsappNumber) || '6285733812033';

  let orderData = null;
  const storedOrderRaw = sessionStorage.getItem('anindita_active_order');
  if (storedOrderRaw) {
    try {
      orderData = JSON.parse(storedOrderRaw);
    } catch (_) {
      orderData = null;
    }
  }

  const items = (orderData && Array.isArray(orderData.items) && orderData.items) ||
    (window.cartManager && window.cartManager.getItems()) || [];
  const total = (orderData && typeof orderData.total === 'number' ? orderData.total : null) ??
    (window.cartManager && window.cartManager.getTotal()) ?? 0;

  if (items.length === 0) {
    if (summaryItemsEl) {
      summaryItemsEl.innerHTML = `
        <div style="text-align:center; padding:18px 0; color:var(--text-dark-secondary); font-size:13.5px;">
          Belum ada pesanan aktif. Silakan pilih layanan terlebih dahulu.
        </div>
      `;
    }
    if (totalAmountEl) totalAmountEl.textContent = 'Rp 0';
    if (confirmWaBtn) {
      confirmWaBtn.disabled = true;
      confirmWaBtn.style.opacity = '0.6';
      confirmWaBtn.style.cursor = 'not-allowed';
    }
    return;
  }

  if (summaryItemsEl) {
    summaryItemsEl.innerHTML = items
      .map((item) => {
        const itemTotal = (item.price || 0) * (item.quantity || 1);
        return `
          <div class="confirm-item-row">
            <span class="name">${api.escapeHtml(item.title)} x${item.quantity || 1}</span>
            <span class="price">${api.formatRupiah(itemTotal)}</span>
          </div>
        `;
      })
      .join('');
  }

  if (totalAmountEl) {
    totalAmountEl.textContent = api.formatRupiah(total);
  }

  if (confirmWaBtn) {
    confirmWaBtn.addEventListener('click', () => {
      const formInfo = orderData
        ? {
            nama: orderData.customerName,
            brand: orderData.brandName,
            deadline: orderData.deadline,
            link: orderData.referenceLink,
            catatan: orderData.briefNotes
          }
        : {
            nama: sessionStorage.getItem('anindita_order_name') || '',
            brand: sessionStorage.getItem('anindita_order_brand') || '',
            deadline: sessionStorage.getItem('anindita_order_deadline') || '',
            link: sessionStorage.getItem('anindita_order_link') || '',
            catatan: sessionStorage.getItem('anindita_order_notes') || ''
          };

      const waMsg = api.generateWhatsAppMessage(formInfo, items, total);
      const waUrl = api.buildWhatsAppUrl(brandWaNumber, waMsg);
      window.open(waUrl, '_blank');
    });
  }
});
