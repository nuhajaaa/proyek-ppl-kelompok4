/**
 * Anindita Creative - Confirmation Page Handler
 * Exactly matches 06 Konfirmasi Kirim WhatsApp (Desktop).png
 */

document.addEventListener('DOMContentLoaded', async () => {
  const summaryItemsEl = document.getElementById('confirmSummaryItems');
  const totalAmountEl = document.getElementById('confirmTotalAmount');
  const confirmWaBtn = document.getElementById('confirmWaBtn');

  // Try to find current order
  const urlParams = new URLSearchParams(window.location.search);
  const orderId = urlParams.get('orderId') || sessionStorage.getItem('anindita_active_order_id');

  let orderData = null;
  if (orderId) {
    const orders = await window.AninditaAPI.getOrders();
    orderData = orders.find(o => o.id === orderId);
  }

  // Fallback to active cart or default design state if order not loaded
  let items = (orderData && orderData.items) || window.cartManager.getItems();
  let total = (orderData && orderData.total) || window.cartManager.getTotal();

  if (!items || items.length === 0) {
    items = [
      { title: 'Edit Video', quantity: 2, price: 300000 },
      { title: 'Edit Feed Instagram', quantity: 1, price: 250000 },
      { title: '3D Text Movement', quantity: 1, price: 350000 }
    ];
    total = 1200000;
  }

  if (summaryItemsEl) {
    summaryItemsEl.innerHTML = items.map(item => {
      const itemTotal = item.price * (item.quantity || 1);
      return `
        <div class="confirm-item-row">
          <span class="name">${item.title} x${item.quantity}</span>
          <span class="price">${window.AninditaAPI.formatRupiah(itemTotal)}</span>
        </div>
      `;
    }).join('');
  }

  if (totalAmountEl) {
    totalAmountEl.textContent = window.AninditaAPI.formatRupiah(total);
  }

  if (confirmWaBtn) {
    confirmWaBtn.addEventListener('click', () => {
      const formInfo = orderData ? {
        nama: orderData.customerName,
        brand: orderData.brandName,
        deadline: orderData.deadline,
        link: orderData.referenceLink,
        catatan: orderData.briefNotes
      } : {};

      const waMsg = window.AninditaAPI.generateWhatsAppMessage(formInfo, items, total);
      const waUrl = window.AninditaAPI.buildWhatsAppUrl('6285733812033', waMsg);
      window.open(waUrl, '_blank');
    });
  }
});

