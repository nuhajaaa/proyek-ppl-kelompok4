/**
 * Anindita Creative - Checkout Logic & Live WhatsApp Preview
 * Exactly matches 02 Checkout (Desktop 1440).png
 */

document.addEventListener('DOMContentLoaded', () => {
  const cartListEl = document.getElementById('checkoutCartList');
  const summaryListEl = document.getElementById('checkoutSummaryList');
  const subtotalEl = document.getElementById('checkoutSubtotal');
  const discountEl = document.getElementById('checkoutDiscount');
  const totalEl = document.getElementById('checkoutTotal');
  const itemCountEl = document.getElementById('checkoutItemCount');
  const waPreviewBubble = document.getElementById('waPreviewBubble');
  const sendWaBtn = document.getElementById('sendWaBtn');
  const promoInput = document.getElementById('promoInput');
  const promoApplyBtn = document.getElementById('promoApplyBtn');
  const form = document.getElementById('projectBriefForm');

  let discountAmount = 0;
  let activePromoCode = '';

  // Form field references
  const namaInput = document.getElementById('inputNama');
  const hpInput = document.getElementById('inputHp');
  const brandInput = document.getElementById('inputBrand');
  const deadlineInput = document.getElementById('inputDeadline');
  const linkInput = document.getElementById('inputLink');
  const catatanInput = document.getElementById('inputCatatan');
  const agreeCheck = document.getElementById('checkAgree');

  function getFormValues() {
    return {
      nama: (namaInput && namaInput.value.trim()) || '',
      hp: (hpInput && hpInput.value.trim()) || '',
      brand: (brandInput && brandInput.value.trim()) || '',
      deadline: (deadlineInput && deadlineInput.value) || '',
      deadlineFormatted: formatDeadline(deadlineInput && deadlineInput.value),
      link: (linkInput && linkInput.value.trim()) || '',
      catatan: (catatanInput && catatanInput.value.trim()) || ''
    };
  }

  function formatDeadline(dateStr) {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
      return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
    } catch (e) {
      return dateStr;
    }
  }

  function updateLivePreview() {
    const items = window.cartManager.getItems();
    const subtotal = window.cartManager.getTotal();
    const finalTotal = Math.max(0, subtotal - discountAmount);
    const formVals = getFormValues();

    if (waPreviewBubble) {
      if (items.length === 0 && !formVals.nama) {
        waPreviewBubble.textContent = '(Pilih layanan dan isi formulir di samping untuk melihat pratinjau pesan WhatsApp secara langsung)';
      } else {
        const msg = window.AninditaAPI.generateWhatsAppMessage(formVals, items, finalTotal);
        waPreviewBubble.textContent = msg;
      }
    }
  }

  function renderCheckoutCart() {
    const items = window.cartManager.getItems();
    const subtotal = window.cartManager.getTotal();
    const finalTotal = Math.max(0, subtotal - discountAmount);

    if (itemCountEl) {
      itemCountEl.textContent = `${items.length} layanan`;
    }

    // Render items list
    if (cartListEl) {
      if (items.length === 0) {
        cartListEl.innerHTML = `
          <div style="background:#fff; border:1px solid var(--color-border); border-radius:16px; padding:32px; text-align:center;">
            <p style="color:var(--text-dark-secondary); margin-bottom:14px;">Keranjang belanja Anda masih kosong.</p>
            <a href="index.html#layanan" class="btn btn-dark btn-sm">Pilih Layanan Sekarang</a>
          </div>
        `;
      } else {
        cartListEl.innerHTML = items.map((item, index) => {
          const itemTotal = item.price * (item.quantity || 1);
          const mediaSrc = window.AninditaAPI ? window.AninditaAPI.resolveMediaUrl(item.mediaUrl) : (item.mediaUrl || '');
          const hasImage = mediaSrc && !(window.AninditaAPI && window.AninditaAPI.isVideoUrl(mediaSrc));
          return `
            <div class="checkout-item-card">
              <div class="checkout-item-left">
                <div class="item-thumb-md" style="background: ${item.gradient}; overflow:hidden;">
                  ${hasImage ? `<img src="${mediaSrc}" alt="${item.title}" style="width:100%; height:100%; object-fit:cover;">` : ''}
                </div>
                <div class="checkout-item-info">
                  <h4>${item.title}</h4>
                  <p class="item-pkg">${item.package || ''}</p>
                  <p class="item-est">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <circle cx="12" cy="12" r="10"></circle>
                      <polyline points="12 6 12 12 16 14"></polyline>
                    </svg>
                    ${item.estimate || 'Estimasi 2-3 hari kerja'}
                  </p>
                </div>
              </div>
              <div class="checkout-item-controls">
                <div class="qty-stepper">
                  <button type="button" class="qty-btn" data-step-idx="${index}" data-delta="-1">&minus;</button>
                  <span class="qty-num">${item.quantity}</span>
                  <button type="button" class="qty-btn" data-step-idx="${index}" data-delta="1">&plus;</button>
                </div>
                <div class="checkout-item-price">
                  ${window.AninditaAPI.formatRupiah(itemTotal)}
                </div>
                <button type="button" class="btn-trash" data-delete-idx="${index}" title="Hapus item">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="3 6 5 6 21 6"></polyline>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    <line x1="10" y1="11" x2="10" y2="17"></line>
                    <line x1="14" y1="11" x2="14" y2="17"></line>
                  </svg>
                </button>
              </div>
            </div>
          `;
        }).join('');

        // Wire stepper buttons
        cartListEl.querySelectorAll('.qty-btn').forEach(btn => {
          btn.addEventListener('click', () => {
            const idx = parseInt(btn.getAttribute('data-step-idx'), 10);
            const delta = parseInt(btn.getAttribute('data-delta'), 10);
            window.cartManager.updateQuantity(idx, delta);
          });
        });

        // Wire trash buttons
        cartListEl.querySelectorAll('[data-delete-idx]').forEach(btn => {
          btn.addEventListener('click', () => {
            const idx = parseInt(btn.getAttribute('data-delete-idx'), 10);
            window.cartManager.removeItem(idx);
          });
        });
      }
    }

    // Render summary list
    if (summaryListEl) {
      summaryListEl.innerHTML = items.map(item => {
        const itemTotal = item.price * (item.quantity || 1);
        return `
          <div class="summary-item-row">
            <span class="name">${item.title} x${item.quantity}</span>
            <span class="val">${window.AninditaAPI.formatRupiah(itemTotal)}</span>
          </div>
        `;
      }).join('');
    }

    if (subtotalEl) subtotalEl.textContent = window.AninditaAPI.formatRupiah(subtotal);
    if (discountEl) discountEl.textContent = `- ${window.AninditaAPI.formatRupiah(discountAmount)}`;
    if (totalEl) totalEl.textContent = window.AninditaAPI.formatRupiah(finalTotal);

    updateLivePreview();
  }

  // Subscribe cart changes
  window.cartManager.subscribe(() => {
    renderCheckoutCart();
  });

  // Real-time input listeners to update live preview
  [namaInput, hpInput, brandInput, deadlineInput, linkInput, catatanInput].forEach(inp => {
    if (inp) {
      inp.addEventListener('input', updateLivePreview);
      inp.addEventListener('change', updateLivePreview);
    }
  });

  // Promo code
  if (promoApplyBtn && promoInput) {
    promoApplyBtn.addEventListener('click', (e) => {
      e.preventDefault();
      const code = promoInput.value.trim().toUpperCase();
      const subtotal = window.cartManager.getTotal();

      if (code === 'DISKON10' || code === 'ANINDITA10') {
        discountAmount = Math.round(subtotal * 0.1);
        activePromoCode = code;
        alert(`Kode promo ${code} berhasil digunakan! Diskon 10% diterapkan.`);
      } else if (code === 'KREATIF') {
        discountAmount = 50000;
        activePromoCode = code;
        alert(`Kode promo ${code} berhasil digunakan! Diskon Rp 50.000 diterapkan.`);
      } else {
        discountAmount = 0;
        alert('Kode promo tidak valid atau sudah kedaluwarsa.');
      }
      renderCheckoutCart();
    });
  }

  // Submit / Send WA
  if (sendWaBtn) {
    sendWaBtn.addEventListener('click', async (e) => {
      e.preventDefault();

      const items = window.cartManager.getItems();
      if (items.length === 0) {
        alert('Keranjang belanja Anda masih kosong! Silakan pilih layanan terlebih dahulu.');
        return;
      }

      if (agreeCheck && !agreeCheck.checked) {
        alert('Harap setujui ketentuan revisi dan jadwal pengerjaan.');
        agreeCheck.focus();
        return;
      }

      const formVals = getFormValues();
      if (!formVals.nama || !formVals.hp) {
        alert('Nama lengkap dan nomor WhatsApp wajib diisi sebelum mengirim pesanan.');
        if (!formVals.nama && namaInput) namaInput.focus();
        else if (!formVals.hp && hpInput) hpInput.focus();
        return;
      }

      const subtotal = window.cartManager.getTotal();
      const finalTotal = Math.max(0, subtotal - discountAmount);

      let newOrder;
      try {
        sendWaBtn.disabled = true;
        newOrder = await window.AninditaAPI.createOrder({
          customerName: formVals.nama,
          customerPhone: formVals.hp,
          brandName: formVals.brand,
          deadline: formVals.deadline,
          referenceLink: formVals.link,
          briefNotes: formVals.catatan,
          items: items,
          subtotal: subtotal,
          discount: discountAmount,
          total: finalTotal
        });
      } catch (err) {
        sendWaBtn.disabled = false;
        alert('Gagal menyimpan pesanan: ' + err.message);
        return;
      }

      // Store created order cleanly in sessionStorage for public confirmation page
      sessionStorage.setItem('anindita_active_order', JSON.stringify(newOrder));
      sessionStorage.setItem('anindita_active_order_id', newOrder.id);
      sessionStorage.setItem('anindita_order_name', formVals.nama);
      sessionStorage.setItem('anindita_order_brand', formVals.brand);
      sessionStorage.setItem('anindita_order_deadline', formVals.deadlineFormatted || formVals.deadline);
      sessionStorage.setItem('anindita_order_link', formVals.link);
      sessionStorage.setItem('anindita_order_notes', formVals.catatan);

      // Open WhatsApp directly using dynamic studio WhatsApp number
      const content = await window.AninditaAPI.getContent();
      const brandWaNumber = (content.brand && content.brand.whatsappNumber) || '6285733812033';
      const waMsg = window.AninditaAPI.generateWhatsAppMessage(formVals, items, finalTotal);
      const waUrl = window.AninditaAPI.buildWhatsAppUrl(brandWaNumber, waMsg);

      // Open WhatsApp in new tab and redirect current tab to confirmation page
      window.open(waUrl, '_blank');
      window.location.href = `konfirmasi.html?orderId=${newOrder.id}`;
    });
  }

  // Initial render
  renderCheckoutCart();
});

