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
})();

