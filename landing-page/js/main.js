/**
 * Anindita Creative - Main Storefront / Profil Interactions
 * Exactly matches Profil (Desktop 1440).png
 */

document.addEventListener('DOMContentLoaded', async () => {
  // Mobile menu drawer toggle
  const mobileMenuBtn = document.getElementById('mobileMenuBtn');
  const navLinks = document.getElementById('mainNavLinks');
  if (mobileMenuBtn && navLinks) {
    mobileMenuBtn.addEventListener('click', () => {
      navLinks.classList.toggle('mobile-open');
    });

    // Close menu when clicking nav link
    navLinks.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        navLinks.classList.remove('mobile-open');
      });
    });
  }

  // Portfolio filtering
  const filterBtns = document.querySelectorAll('.filter-btn');
  const portfolioCards = document.querySelectorAll('.portfolio-card');

  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const cat = btn.getAttribute('data-filter');
      portfolioCards.forEach(card => {
        const cardCat = card.getAttribute('data-category');
        if (cat === 'all' || cardCat === cat) {
          card.style.display = 'flex';
        } else {
          card.style.display = 'none';
        }
      });
    });
  });

  // Service "+ Tambah" buttons
  document.querySelectorAll('.btn-add-service').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const serviceId = btn.getAttribute('data-service-id');
      const title = btn.getAttribute('data-service-title');
      const price = parseInt(btn.getAttribute('data-service-price'), 10);
      const pkg = btn.getAttribute('data-service-pkg');
      const gradient = btn.getAttribute('data-service-gradient');

      window.cartManager.addItem({
        id: serviceId,
        title: title,
        price: price,
        package: pkg,
        gradient: gradient
      });

      // Visual feedback
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

  // Video preview modal wiring
  const videoModal = document.getElementById('videoPreviewModal');
  const closeVideoModalBtn = document.getElementById('closeVideoModalBtn');
  const videoModalDismissBtn = document.getElementById('videoModalDismissBtn');
  const videoModalTitle = document.getElementById('videoModalTitle');
  const videoModalCategory = document.getElementById('videoModalCategory');

  function openVideoModal(title, category) {
    if (!videoModal) return;
    if (videoModalTitle) videoModalTitle.textContent = title || 'Pratinjau Karya Visual';
    if (videoModalCategory) videoModalCategory.textContent = (category || 'Karya Terpilih').toUpperCase();
    videoModal.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function closeVideoModal() {
    if (!videoModal) return;
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

  // Open modal on showcase tiles and portfolio cards
  document.querySelectorAll('.showcase-tile, .portfolio-card').forEach(el => {
    el.addEventListener('click', (e) => {
      // If clicking button inside, let button handle
      if (e.target.closest('button') || e.target.closest('a')) return;
      const title = el.getAttribute('data-preview-title') || el.querySelector('h3')?.textContent;
      const cat = el.getAttribute('data-preview-cat') || el.querySelector('.portfolio-badge, .showcase-badge')?.textContent;
      openVideoModal(title, cat);
    });
  });

  // Toast notification helper
  function showToast(message) {
    let toast = document.getElementById('toastNotice');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'toastNotice';
      toast.className = 'toast-notice';
      document.body.appendChild(toast);
    }
    toast.innerHTML = `<span>&#10003;</span> <span>${message}</span>`;
    toast.classList.add('show');
    setTimeout(() => {
      toast.classList.remove('show');
    }, 2800);
  }

  window.showToast = showToast;
});
