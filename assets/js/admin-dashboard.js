(function(){
  'use strict';

  var section = document.getElementById('admin-dashboard');
  if (!section) return;

  var statusEl = document.getElementById('admin-dashboard-status');
  var refreshBtn = document.getElementById('admin-dashboard-refresh');
  var logoutBtn = document.getElementById('admin-dashboard-logout');
  var statsRoots = {
    bans: document.querySelector('[data-stat="bans"]'),
    reports: document.querySelector('[data-stat="reports"]'),
    universities: document.querySelector('[data-stat="universities"]')
  };
  var config = window.UNION_MODERATOR_CONFIG || {};
  var supabaseUrl = section.dataset.supabaseUrl || config.supabaseUrl || '';
  var supabaseAnonKey = section.dataset.supabaseKey || config.supabaseAnonKey || '';
  var createClient = window.supabase && typeof window.supabase.createClient === 'function' ? window.supabase.createClient : null;

  if (!supabaseUrl || !supabaseAnonKey) {
    setStatus('Configura supabaseUrl e supabaseAnonKey per attivare la dashboard.', true);
    return;
  }
  if (!createClient) {
    setStatus('La libreria Supabase non è stata caricata. Inserisci la CDN prima di questo script.', true);
    return;
  }

  var supabaseClient = createClient(supabaseUrl, supabaseAnonKey);
  var isWorking = false;

  refreshBtn.addEventListener('click', function(){
    fetchSummary();
  });
  logoutBtn.addEventListener('click', function(){
    supabaseClient.auth.signOut().finally(function(){
      location.href = 'admin.html';
    });
  });

  function setStatus(message, isError){
    statusEl.textContent = message;
    statusEl.classList.toggle('is-error', !!isError);
  }

  function setWorking(value){
    isWorking = value;
    if (refreshBtn) refreshBtn.disabled = value;
  }

  function redirectToLogin(){
    setStatus('Sessione non valida. Ritorno alla pagina di login...', true);
    supabaseClient.auth.signOut().finally(function(){
      setTimeout(function(){ location.href = 'admin.html'; }, 600);
    });
  }

  async function init(){
    setStatus('Verifico sessione...');
    var { data: sessionData, error: sessionError } = await supabaseClient.auth.getSession();
    if (sessionError || !sessionData?.session){
      return redirectToLogin();
    }
    var { data: userData, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !userData?.user){
      return redirectToLogin();
    }

    var profile = await supabaseClient
      .from('erasmus_users')
      .select('is_admin')
      .eq('id', userData.user.id)
      .maybeSingle();
    if (profile.error || !profile.data || !profile.data.is_admin){
      return redirectToLogin();
    }

    setStatus('Accesso confermato. Aggiorno i conteggi...');
    fetchSummary();
  }

  async function fetchSummary(){
    setWorking(true);
    setStatus('Sto recuperando i conteggi...');
    try {
      var requests = await Promise.all([
        supabaseClient
          .from('moderation_actions')
          .select('id', { head: true, count: 'exact' })
          .eq('is_active', true),
        supabaseClient
          .from('user_reports')
          .select('id', { head: true, count: 'exact' })
          .in('status', ['pending', 'under_review']),
        supabaseClient
          .from('university_requests')
          .select('id', { head: true, count: 'exact' })
          .eq('status', 'pending')
      ]);

      handleCount('bans', requests[0]);
      handleCount('reports', requests[1]);
      handleCount('universities', requests[2]);
      setStatus('Conteggi aggiornati.');
    } catch (error) {
      setStatus(error?.message || 'Errore durante il recupero dei conteggi.', true);
    } finally {
      setWorking(false);
    }
  }

  function handleCount(key, result){
    if (!result) return;
    if (result.error) throw result.error;
    var parsed = Number(result.count);
    var countValue = Number.isFinite(parsed) ? parsed : 0;
    var target = statsRoots[key];
    if (target) target.textContent = String(countValue);
  }

  init();
})();
