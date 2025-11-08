// UniOn Landing – basic interactions
(function(){
  // Current year in footer
  var y = document.getElementById('year');
  if (y) y.textContent = new Date().getFullYear();

  // Reveal on scroll
  var observer = ('IntersectionObserver' in window) ? new IntersectionObserver(function(entries){
    entries.forEach(function(e){ if(e.isIntersecting){ e.target.classList.add('is-visible'); observer.unobserve(e.target);} });
  }, {threshold: 0.12}) : null;

  document.querySelectorAll('.card, .gallery img, .hero__copy, .hero__media').forEach(function(el){
    el.classList.add('fade-in');
    if(observer) observer.observe(el); else el.classList.add('is-visible');
  });

  // Smooth anchor scroll
  document.querySelectorAll('a[href^="#"]').forEach(function(a){
    a.addEventListener('click', function(e){
      var id = this.getAttribute('href');
      if(id.length > 1){
        var target = document.querySelector(id);
        if(target){ e.preventDefault(); target.scrollIntoView({behavior:'smooth'}); }
      }
    });
  });

  // Language auto-switch for privacy pages
  try {
    var path = (location.pathname || '').toLowerCase();
    var isPrivacyEn = /\/privacy\.html$/.test(path);
    var isPrivacyIt = /\/privacy-it\.html$/.test(path);
    if (isPrivacyEn || isPrivacyIt) {
      var stored = localStorage.getItem('privacyLang');
      var navLang = (navigator.language || navigator.userLanguage || 'en').toLowerCase();
      var preferIt = stored ? stored === 'it' : navLang.startsWith('it');
      if (!stored) localStorage.setItem('privacyLang', preferIt ? 'it' : 'en');
      if (preferIt && isPrivacyEn) {
        location.replace('privacy-it.html');
        return;
      }
      if (!preferIt && isPrivacyIt) {
        location.replace('privacy.html');
        return;
      }
      var enBtn = document.getElementById('lang-en');
      var itBtn = document.getElementById('lang-it');
      if (enBtn) enBtn.addEventListener('click', function(e){ e.preventDefault(); localStorage.setItem('privacyLang','en'); if (!isPrivacyEn) location.href = 'privacy.html'; });
      if (itBtn) itBtn.addEventListener('click', function(e){ e.preventDefault(); localStorage.setItem('privacyLang','it'); if (!isPrivacyIt) location.href = 'privacy-it.html'; });
    }
  } catch(_) {}
})();
