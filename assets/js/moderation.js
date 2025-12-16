(function(){
  'use strict';

  var section = document.getElementById('moderation');
  if (!section) return;

  var form = document.getElementById('moderator-login-form');
  var statusEl = document.getElementById('moderation-status');
  var refreshBtn = document.getElementById('moderation-refresh');
  var statsRoots = {
    bans: document.querySelector('[data-stat="bans"]'),
    reports: document.querySelector('[data-stat="reports"]'),
    universities: document.querySelector('[data-stat="universities"]')
  };

  if (!form || !statusEl || !refreshBtn) return;

  var MAX_FAILED_ATTEMPTS = 5;
  var LOCKOUT_DURATION_MS = 60 * 1000;
  var FAILED_ATTEMPTS_KEY = 'moderatorFailedAttempts';
  var LOCKOUT_KEY = 'moderatorLockoutUntil';
  var failedAttempts = Number(localStorage.getItem(FAILED_ATTEMPTS_KEY) || 0);
  var lockoutUntil = Number(localStorage.getItem(LOCKOUT_KEY) || 0);
  var lockoutTimer = null;
  var isLockedOut = false;

  var config = window.UNION_MODERATOR_CONFIG || {};
  var supabaseUrl = section.dataset.supabaseUrl || config.supabaseUrl || '';
  var supabaseAnonKey = section.dataset.supabaseKey || config.supabaseAnonKey || '';
  var createClient = window.supabase && typeof window.supabase.createClient === 'function' ? window.supabase.createClient : null;
  var submitBtn = form.querySelector('button[type="submit"]');
  var emailInput = form.querySelector('#moderator-email');
  var passwordInput = form.querySelector('#moderator-password');

  if (!emailInput || !passwordInput) return;
  if (!supabaseUrl || !supabaseAnonKey) {
    updateStatus('Configura supabaseUrl e supabaseAnonKey nelle variabili sopra per abilitare il login.', true);
    if (submitBtn) submitBtn.setAttribute('disabled', 'true');
    return;
  }

  if (!createClient) {
    updateStatus('La libreria Supabase non è stata caricata. Inserisci la CDN prima di questo script.', true);
    return;
  }

  var supabaseClient = createClient(supabaseUrl, supabaseAnonKey);
  var currentSession = null;
  var isWorking = false;

  form.addEventListener('submit', function(event){
    event.preventDefault();
    loginModerator();
  });

  refreshBtn.addEventListener('click', function(){
    fetchSummary();
  });

  checkLockout();

  function updateStatus(message, isError){
    statusEl.textContent = message;
    statusEl.classList.toggle('is-error', !!isError);
  }

  function clearLockoutTimer(){
    if (lockoutTimer){
      clearTimeout(lockoutTimer);
      lockoutTimer = null;
    }
  }

  function refreshFormState(){
    var disabled = isWorking || isLockedOut;
    [emailInput, passwordInput, submitBtn].forEach(function(el){
      if (el) el.disabled = disabled;
    });
  }

  function setWorking(value){
    isWorking = value;
    refreshFormState();
  }

  function checkLockout(){
    clearLockoutTimer();
    var now = Date.now();
    if (lockoutUntil && now < lockoutUntil){
      isLockedOut = true;
      refreshFormState();
      var remaining = Math.ceil((lockoutUntil - now) / 1000);
      updateStatus('Troppi tentativi. Riprova tra ' + remaining + 's.', true);
      lockoutTimer = setTimeout(checkLockout, 1000);
      return;
    }
    var wasLocked = isLockedOut;
    isLockedOut = false;
    refreshFormState();
    if (lockoutUntil){
      lockoutUntil = 0;
      localStorage.removeItem(LOCKOUT_KEY);
    }
    if (wasLocked){
      failedAttempts = 0;
      localStorage.removeItem(FAILED_ATTEMPTS_KEY);
      updateStatus('Puoi riprovare ad accedere.', false);
    }
  }

  function recordFailedAttempt(){
    failedAttempts += 1;
    localStorage.setItem(FAILED_ATTEMPTS_KEY, '' + failedAttempts);
    if (failedAttempts >= MAX_FAILED_ATTEMPTS){
      lockoutUntil = Date.now() + LOCKOUT_DURATION_MS;
      localStorage.setItem(LOCKOUT_KEY, '' + lockoutUntil);
      checkLockout();
    }
  }

  function resetFailedAttempts(){
    failedAttempts = 0;
    localStorage.removeItem(FAILED_ATTEMPTS_KEY);
    lockoutUntil = 0;
    localStorage.removeItem(LOCKOUT_KEY);
    clearLockoutTimer();
    isLockedOut = false;
    refreshFormState();
  }

  async function loginModerator(){
    if (isWorking) return;
    if (isLockedOut){
      checkLockout();
      return;
    }
    var email = (emailInput.value || '').trim();
    var password = passwordInput.value || '';

    if (!email || !password){
      updateStatus('Completa email e password per accedere.', true);
      return;
    }

    setWorking(true);
    updateStatus('Verifica delle credenziali in corso…');
    try {
      var response = await supabaseClient.auth.signInWithPassword({ email: email, password: password });
      if (response.error) throw response.error;
      var user = response.data?.user;
      if (!user) throw new Error('Nessun utente trovato.');

      var profile = await supabaseClient.from('erasmus_users').select('is_admin,admin_role').eq('id', user.id).maybeSingle();
      if (profile.error) throw profile.error;
      if (!profile.data || !profile.data.is_admin){
        throw new Error('Accesso riservato ai moderatori autenticati.');
      }

      resetFailedAttempts();
      currentSession = response.data.session;
      updateStatus('Accesso autorizzato. Puoi aggiornare i conteggi.');
      refreshBtn.disabled = false;
      fetchSummary();
    } catch (error) {
      var message = error?.message || 'Impossibile completare l\'accesso.';
      updateStatus(message, true);
      recordFailedAttempt();
    } finally {
      setWorking(false);
    }
  }

  async function fetchSummary(){
    if (!currentSession){
      updateStatus('Accedi prima di eseguire le query.', true);
      return;
    }

    refreshBtn.disabled = true;
    updateStatus('Aggiorno i conteggi dai tavoli moderazione…');

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
      updateStatus('Conteggi aggiornati.');
    } catch (error) {
      updateStatus(error?.message || 'Errore durante l’aggiornamento dei dati.', true);
    } finally {
      refreshBtn.disabled = false;
    }
  }

  function handleCount(key, result){
    if (!result) return;
    if (result.error) throw result.error;
    var parsed = Number(result.count);
    var countValue = Number.isFinite(parsed) ? parsed : 0;
    var target = statsRoots[key];
    if (target) target.textContent = '' + countValue;
  }
})();
