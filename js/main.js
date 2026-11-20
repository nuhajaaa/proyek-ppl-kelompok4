/* ==========================================================
   Anindita Creative - keranjang + checkout WhatsApp
   GANTI nomor di bawah (format internasional, tanpa + / spasi)
   ========================================================== */
const WA_NUMBER = '6281200000000';
const STORE_KEY = 'anindita_cart_v1';

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const rupiah = n => 'Rp ' + new Intl.NumberFormat('id-ID').format(n);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ---------- State keranjang (disimpan di browser) ---------- */
let cart = (() => { try { return JSON.parse(localStorage.getItem(STORE_KEY)) || {}; } catch { return {}; } })();
const save = () => { try { localStorage.setItem(STORE_KEY, JSON.stringify(cart)); } catch {} render(); };
const items = () => Object.entries(cart).map(([id, v]) => ({ id, ...v }));
const count = () => items().reduce((a, i) => a + i.qty, 0);
const total = () => items().reduce((a, i) => a + i.qty * i.price, 0);

function addItem(id, name, price) {
  cart[id] = cart[id] ? { ...cart[id], qty: cart[id].qty + 1 } : { name, price, qty: 1 };
  save(); toast('Ditambahkan ke keranjang');
}
function changeQty(id, d) {
  if (!cart[id]) return;
  cart[id].qty += d;
  if (cart[id].qty < 1) delete cart[id];
  save();
}
const removeItem = id => { delete cart[id]; save(); };

/* ---------- Render ---------- */
function itemRow(i, withRemove) {
  return `<div class="item">
    <div class="th" aria-hidden="true"></div>
    <div>
      <h3>${esc(i.name)}</h3>
      <div class="qty" role="group" aria-label="Jumlah ${esc(i.name)}">
        <button type="button" data-qty="-1" data-id="${i.id}" aria-label="Kurangi">&minus;</button>
        <b>${i.qty}</b>
        <button type="button" data-qty="1" data-id="${i.id}" aria-label="Tambah">+</button>
      </div>
      ${withRemove ? `<br><button type="button" class="rm" data-rm="${i.id}">Hapus</button>` : ''}
    </div>
    <div class="price">${rupiah(i.qty * i.price)}</div>
  </div>`;
}

function render() {
  $$('[data-badge]').forEach(el => el.textContent = count());
  $$('[data-total]').forEach(el => el.textContent = rupiah(total()));
  const list = items();
  const empty = '<p class="empty">Keranjang masih kosong. Pilih layanan di halaman beranda.</p>';

  const drawer = $('#drawerList');
  if (drawer) drawer.innerHTML = list.length ? list.map(i => itemRow(i, true)).join('') : empty;

  const cartList = $('#cartList');
  if (cartList) cartList.innerHTML = list.length ? list.map(i => itemRow(i, true)).join('') : empty;

  const sum = $('#sumList');
  if (sum) sum.innerHTML = list.map(i => `<div><span>${esc(i.name)} x${i.qty}</span><b>${rupiah(i.qty * i.price)}</b></div>`).join('') || '<p class="empty">Belum ada layanan.</p>';

  const prev = $('#preview');
  if (prev) prev.textContent = buildMessage(readForm());
}

/* ---------- Pesan WhatsApp ---------- */
function readForm() {
  const f = $('#orderForm');
  const v = n => (f && f.elements[n] ? f.elements[n].value.trim() : '');
  return { nama: v('nama'), hp: v('hp'), brand: v('brand'), deadline: v('deadline'), link: v('link'), catatan: v('catatan') };
}
function buildMessage(d) {
  const lines = items().map((i, n) => `${n + 1}. ${i.name} x${i.qty} - ${rupiah(i.qty * i.price)}`);
  let m = 'Halo Anindita Creative, saya ingin memesan:\n\n' + (lines.join('\n') || '(belum ada layanan)') + `\n\nTotal: ${rupiah(total())}\n`;
  m += `\nNama: ${d.nama || '-'}\nWhatsApp: ${d.hp || '-'}\nBrand: ${d.brand || '-'}`;
  if (d.deadline) m += `\nDeadline: ${d.deadline}`;
  if (d.link) m += `\nReferensi: ${d.link}`;
  if (d.catatan) m += `\nCatatan: ${d.catatan}`;
  return m + '\n\nTerima kasih!';
}
const waLink = text => `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(text)}`;

/* ---------- UI kecil ---------- */
let toastTimer;
function toast(msg) {
  const t = $('#toast'); if (!t) return;
  t.textContent = msg; t.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
}
function openCart() {
  const d = $('#drawer'); if (!d) return (location.href = 'checkout.html');
  d.classList.add('open'); d.setAttribute('aria-hidden', 'false'); $('#overlay').hidden = false;
  $('[data-close-cart]', d).focus();
}
function closeCart() {
  const d = $('#drawer'); if (!d) return;
  d.classList.remove('open'); d.setAttribute('aria-hidden', 'true'); $('#overlay').hidden = true;
}

/* ---------- Event ---------- */
document.addEventListener('click', e => {
  const t = e.target.closest('button, a'); if (!t) return;
  if (t.matches('[data-add]')) { const c = t.closest('.card'); addItem(c.dataset.id, c.dataset.name, Number(c.dataset.price)); }
  else if (t.dataset.qty) changeQty(t.dataset.id, Number(t.dataset.qty));
  else if (t.dataset.rm) removeItem(t.dataset.rm);
  else if (t.matches('[data-open-cart]')) openCart();
  else if (t.matches('[data-close-cart]')) closeCart();
  else if (t.dataset.filter) filterWorks(t);
  else if (t.id === 'burger') {
    const m = $('#menu'), open = m.classList.toggle('open');
    t.setAttribute('aria-expanded', open);
  } else if (t.closest('#menu')) { $('#menu').classList.remove('open'); $('#burger').setAttribute('aria-expanded', 'false'); }
});
$('#overlay') && $('#overlay').addEventListener('click', closeCart);
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeCart(); });

/* Tombol chat WhatsApp umum */
$$('[data-wa-chat]').forEach(a => a.href = waLink('Halo Anindita Creative, saya ingin berkonsultasi mengenai project.'));

/* Filter portofolio */
function filterWorks(btn) {
  $$('.chip-btn').forEach(b => b.classList.toggle('is-on', b === btn));
  $$('.work').forEach(w => w.hidden = btn.dataset.filter !== 'all' && w.dataset.cat !== btn.dataset.filter);
}

/* Checkout */
const form = $('#orderForm');
if (form) {
  form.addEventListener('input', () => { $$('.bad', form).forEach(i => i.classList.remove('bad')); render(); });
  $('#sendWa').addEventListener('click', () => {
    const d = readForm(), err = $('#formErr');
    const problems = [];
    if (!items().length) problems.push('Keranjang masih kosong. Tambahkan layanan terlebih dahulu.');
    if (!d.nama) { problems.push('Isi nama lengkap Anda.'); form.elements.nama.classList.add('bad'); }
    if (d.hp.replace(/\D/g, '').length < 9) { problems.push('Isi nomor WhatsApp yang benar.'); form.elements.hp.classList.add('bad'); }
    err.hidden = !problems.length; err.textContent = problems.join(' ');
    if (problems.length) { err.scrollIntoView({ behavior: 'smooth', block: 'center' }); return; }
    window.open(waLink(buildMessage(d)), '_blank', 'noopener');
    toast('Membuka WhatsApp...');
  });
}

render();
