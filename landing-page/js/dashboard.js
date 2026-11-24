/**
 * Anindita Creative - Admin Dashboard Manager
 * Manages orders, stats, service pricing, and backend communication
 */

document.addEventListener('DOMContentLoaded', async () => {
  let allOrders = await window.AninditaAPI.getOrders();
  const services = await window.AninditaAPI.getServices();

  const ordersTbody = document.getElementById('ordersTableBody');
  const servicesTbody = document.getElementById('servicesTableBody');
  const statTotal = document.getElementById('statTotalOrders');
  const statPending = document.getElementById('statPendingWa');
  const statProcessing = document.getElementById('statProcessing');
  const statRevenue = document.getElementById('statRevenue');
  const searchInput = document.getElementById('orderSearchInput');

  // Modal elements
  const modal = document.getElementById('briefModalBackdrop');
  const modalClose = document.getElementById('closeModalBtn');
  const modalTitle = document.getElementById('modalOrderId');
  const modalBody = document.getElementById('modalBodyDetails');

  function updateStats() {
    const total = allOrders.length;
    const pending = allOrders.filter(o => o.status === 'pending_wa').length;
    const processing = allOrders.filter(o => o.status === 'processing').length;
    const rev = allOrders.reduce((acc, o) => acc + (o.total || 0), 0);

    if (statTotal) statTotal.textContent = total;
    if (statPending) statPending.textContent = pending;
    if (statProcessing) statProcessing.textContent = processing;
    if (statRevenue) statRevenue.textContent = window.AninditaAPI.formatRupiah(rev);
  }

  function renderOrders(ordersToRender) {
    if (!ordersTbody) return;

    if (ordersToRender.length === 0) {
      ordersTbody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align:center; padding:32px; color:var(--text-dark-secondary);">
            Tidak ada pesanan yang sesuai pencarian.
          </td>
        </tr>
      `;
      return;
    }

    ordersTbody.innerHTML = ordersToRender.map(order => {
      const servicesText = (order.items || []).map(i => `${i.title} (x${i.quantity})`).join(', ');
      let badgeClass = 'pending';
      if (order.status === 'processing') badgeClass = 'processing';
      if (order.status === 'done') badgeClass = 'done';

      return `
        <tr>
          <td><strong>${order.id}</strong></td>
          <td>
            <div style="font-weight:700;">${order.customerName}</div>
            <div style="font-size:12px; color:var(--text-dark-secondary);">${order.brandName || '-'}</div>
          </td>
          <td style="max-width:220px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${servicesText}</td>
          <td><strong>${window.AninditaAPI.formatRupiah(order.total || 0)}</strong></td>
          <td>${order.deadline || '-'}</td>
          <td>
            <span class="badge-status ${badgeClass}">${order.statusLabel || order.status}</span>
          </td>
          <td>
            <div style="display:flex; gap:6px;">
              <button type="button" class="btn btn-outline-dark btn-sm" data-view-order="${order.id}">Detail</button>
              <a href="https://wa.me/${(order.customerPhone || '').replace(/[^0-9]/g, '')}" target="_blank" class="btn btn-wa btn-sm">WA</a>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    // Wire view details
    ordersTbody.querySelectorAll('[data-view-order]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-view-order');
        const found = allOrders.find(o => o.id === id);
        if (found) showOrderDetail(found);
      });
    });
  }

  function showOrderDetail(order) {
    if (!modal) return;
    modalTitle.textContent = `Detail Pesanan — ${order.id}`;

    const itemsHtml = (order.items || []).map(i => `
      <div style="display:flex; justify-content:space-between; font-size:13.5px; border-bottom:1px solid #f0e6dc; padding:6px 0;">
        <span>${i.title} x${i.quantity}</span>
        <strong>${window.AninditaAPI.formatRupiah((i.price || 0) * (i.quantity || 1))}</strong>
      </div>
    `).join('');

    modalBody.innerHTML = `
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
        <div>
          <span style="font-size:12px; color:var(--text-dark-muted);">Nama Klien</span>
          <div style="font-weight:700;">${order.customerName}</div>
        </div>
        <div>
          <span style="font-size:12px; color:var(--text-dark-muted);">Nomor WhatsApp</span>
          <div style="font-weight:700;">${order.customerPhone}</div>
        </div>
        <div>
          <span style="font-size:12px; color:var(--text-dark-muted);">Brand / Usaha</span>
          <div style="font-weight:700;">${order.brandName || '-'}</div>
        </div>
        <div>
          <span style="font-size:12px; color:var(--text-dark-muted);">Target Deadline</span>
          <div style="font-weight:700;">${order.deadline || '-'}</div>
        </div>
      </div>

      <div style="margin-top:8px;">
        <span style="font-size:12px; color:var(--text-dark-muted);">Link Referensi / Google Drive</span>
        <div>
          ${order.referenceLink ? `<a href="${order.referenceLink}" target="_blank" style="color:#0284c7; text-decoration:underline; word-break:break-all;">${order.referenceLink}</a>` : '<span style="color:#8c7e75;">Tidak ada link dilampirkan</span>'}
        </div>
      </div>

      <div style="margin-top:8px;">
        <span style="font-size:12px; color:var(--text-dark-muted);">Catatan Brief</span>
        <div style="background:#faf6f0; border-radius:10px; padding:12px; font-size:13px; line-height:1.5;">
          ${order.briefNotes || 'Tidak ada catatan khusus.'}
        </div>
      </div>

      <div style="margin-top:12px;">
        <span style="font-size:12px; color:var(--text-dark-muted);">Daftar Layanan</span>
        <div style="margin-top:4px;">${itemsHtml}</div>
        <div style="display:flex; justify-content:space-between; margin-top:8px; font-size:15px; font-weight:800;">
          <span>Total</span>
          <span>${window.AninditaAPI.formatRupiah(order.total || 0)}</span>
        </div>
      </div>

      <div style="margin-top:16px; display:flex; gap:10px; border-top:1px solid #eee; padding-top:16px;">
        <button type="button" class="btn btn-dark btn-sm" id="btnMarkProcessing">Tandai Diproses</button>
        <button type="button" class="btn btn-wa btn-sm" id="btnMarkDone">Tandai Selesai</button>
      </div>
    `;

    document.getElementById('btnMarkProcessing').addEventListener('click', async () => {
      await window.AninditaAPI.updateOrderStatus(order.id, 'processing');
      allOrders = await window.AninditaAPI.getOrders();
      updateStats();
      renderOrders(allOrders);
      modal.classList.remove('open');
    });

    document.getElementById('btnMarkDone').addEventListener('click', async () => {
      await window.AninditaAPI.updateOrderStatus(order.id, 'done');
      allOrders = await window.AninditaAPI.getOrders();
      updateStats();
      renderOrders(allOrders);
      modal.classList.remove('open');
    });

    modal.classList.add('open');
  }

  if (modalClose) {
    modalClose.addEventListener('click', () => modal.classList.remove('open'));
  }
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.classList.remove('open');
    });
  }

  // Render Services table
  if (servicesTbody) {
    servicesTbody.innerHTML = services.map(s => `
      <tr>
        <td><code>${s.id}</code></td>
        <td><strong>${s.title}</strong></td>
        <td>${s.package || '-'}</td>
        <td><strong>${window.AninditaAPI.formatRupiah(s.price)}</strong></td>
        <td>${s.estimate || '-'}</td>
      </tr>
    `).join('');
  }

  // Search filter
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      const q = e.target.value.toLowerCase().trim();
      const filtered = allOrders.filter(o => 
        o.customerName.toLowerCase().includes(q) || 
        (o.brandName && o.brandName.toLowerCase().includes(q)) ||
        o.id.toLowerCase().includes(q)
      );
      renderOrders(filtered);
    });
  }

  // Tab navigation
  document.querySelectorAll('[data-tab]').forEach(tab => {
    tab.addEventListener('click', (e) => {
      e.preventDefault();
      document.querySelectorAll('[data-tab]').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      const target = tab.getAttribute('data-tab');
      if (target === 'orders') {
        document.getElementById('tabOrders').style.display = 'block';
        document.getElementById('tabServices').style.display = 'none';
      } else {
        document.getElementById('tabOrders').style.display = 'none';
        document.getElementById('tabServices').style.display = 'block';
      }
    });
  });

  updateStats();
  renderOrders(allOrders);
});

