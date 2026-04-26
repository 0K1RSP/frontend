// ============================================================
// PUFF CLICKER SIMULATOR - main.js (aligne 100% sur le backend)
// ============================================================
const API = 'https://backend-rnxv.onrender.com';
let token = localStorage.getItem('puff_token');
let gameData = null;
let autoSaveInterval = null;
let autoCollectInterval = null;
let currentQuestFilter = 'daily';
let currentUpgradeFilter = 'all';

// ---------- API ----------
async function api(endpoint, method = 'GET', body = null) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (token) opts.headers.Authorization = 'Bearer ' + token;
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(API + endpoint, opts);
  const text = await res.text();
  let data;
  try { data = text ? JSON.parse(text) : {}; }
  catch (e) { throw new Error('Reponse serveur invalide (' + res.status + ')'); }
  if (!res.ok) throw new Error(data.error || ('Erreur ' + res.status));
  return data;
}

// ---------- FORMAT ----------
function formatNumber(n) {
  if (n === undefined || n === null || isNaN(n)) return '0';
  n = Number(n);
  if (n >= 1e15) return (n / 1e15).toFixed(2) + 'Q';
  if (n >= 1e12) return (n / 1e12).toFixed(2) + 'T';
  if (n >= 1e9)  return (n / 1e9).toFixed(2)  + 'B';
  if (n >= 1e6)  return (n / 1e6).toFixed(2)  + 'M';
  if (n >= 1e3)  return (n / 1e3).toFixed(1)  + 'K';
  return Math.floor(n).toLocaleString('fr-FR');
}

// ---------- TOAST ----------
function showToast(msg, type = 'info') {
  const el = document.createElement('div');
  el.className = 'toast toast-' + type;
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3000);
}

// ---------- AUTH ----------
function showLogin() {
  document.getElementById('login-form').classList.remove('hidden');
  document.getElementById('signup-form').classList.add('hidden');
}
function showSignup() {
  document.getElementById('login-form').classList.add('hidden');
  document.getElementById('signup-form').classList.remove('hidden');
}

async function login() {
  const u = document.getElementById('login-username').value.trim();
  const p = document.getElementById('login-password').value;
  const e = document.getElementById('login-error');
  e.textContent = '';
  if (!u || !p) { e.textContent = 'Remplis tous les champs.'; return; }
  try {
    const d = await api('/auth/login', 'POST', { username: u, password: p });
    token = d.token;
    localStorage.setItem('puff_token', token);
    showToast('Connexion reussie !', 'success');
    startGame();
  } catch (err) { e.textContent = err.message; }
}

async function signup() {
  const u = document.getElementById('signup-username').value.trim();
  const p = document.getElementById('signup-password').value;
  const e = document.getElementById('signup-error');
  e.textContent = '';
  if (!u || !p) { e.textContent = 'Remplis tous les champs.'; return; }
  try {
    const d = await api('/auth/signup', 'POST', { username: u, password: p });
    token = d.token;
    localStorage.setItem('puff_token', token);
    showToast('Inscription reussie !', 'success');
    startGame();
  } catch (err) { e.textContent = err.message; }
}

async function logout() {
  try { await api('/auth/logout', 'POST'); } catch (e) {}
  token = null;
  localStorage.removeItem('puff_token');
  if (autoSaveInterval) clearInterval(autoSaveInterval);
  if (autoCollectInterval) clearInterval(autoCollectInterval);
  document.getElementById('game-screen').classList.remove('active');
  document.getElementById('auth-screen').classList.add('active');
  showToast('Deconnecte.', 'info');
}

// Expose auth funcs (utilise par index.html inline fallback)
window.login = login;
window.signup = signup;
window.logout = logout;
window.showLogin = showLogin;
window.showSignup = showSignup;

// ---------- INIT ----------
document.addEventListener('DOMContentLoaded', () => {
  const lp = document.getElementById('login-password');
  if (lp) lp.addEventListener('keypress', e => { if (e.key === 'Enter') login(); });
  const sp = document.getElementById('signup-password');
  if (sp) sp.addEventListener('keypress', e => { if (e.key === 'Enter') signup(); });
  if (token) startGame();
});

// ---------- START ----------
async function startGame() {
  try {
    const d = await api('/game/getData');
    gameData = d;
    document.getElementById('auth-screen').classList.remove('active');
    document.getElementById('game-screen').classList.add('active');
    updateUI();
    renderUpgrades();
    renderShop();
    renderInventory();
    renderQuests();
    renderAnnouncements();
    renderEvents();
    renderActiveBuffs();
    if (autoSaveInterval) clearInterval(autoSaveInterval);
    if (autoCollectInterval) clearInterval(autoCollectInterval);
    autoSaveInterval = setInterval(saveGame, 30000);
    autoCollectInterval = setInterval(collectAutoSmoke, 1000);
  } catch (err) {
    console.error('Start game error:', err);
    token = null;
    localStorage.removeItem('puff_token');
    showToast('Session expiree.', 'error');
  }
}

// ---------- UPDATE UI ----------
function updateUI() {
  if (!gameData) return;
  const u = gameData.user;

  document.getElementById('player-name').textContent = u.username;
  document.getElementById('player-level').textContent = 'Niv. ' + u.level;
  document.getElementById('login-streak').textContent = '🔥 ' + (u.loginStreak || 0);
  document.getElementById('smoke-count').textContent = formatNumber(u.smoke);
  document.getElementById('gem-count').textContent = formatNumber(u.gems);
  document.getElementById('smoke-per-click').textContent = formatNumber(u.smokePerClick * u.clickMultiplier);
  document.getElementById('smoke-per-second').textContent = formatNumber(u.smokePerSecond);
  document.getElementById('click-multiplier').textContent = 'x' + u.clickMultiplier.toFixed(1);
  document.getElementById('crit-chance').textContent = (u.critChance * 100).toFixed(1) + '%';
  document.getElementById('rebirth-count').textContent = u.rebirthCount;
  document.getElementById('ascension-count').textContent = u.ascensionCount;

  const lm = document.getElementById('liquid-mult-display');
  if (lm) lm.textContent = 'x' + Number(u.liquidMultiplier || 1).toFixed(2);

  const cp = gameData.puffs.find(p => p.puffId === u.currentPuff);
  if (cp) {
    document.getElementById('puff-emoji').textContent = cp.emoji;
    document.getElementById('puff-name').textContent = cp.name;
    const lvl = (u.puffLevels && u.puffLevels[u.currentPuff]) || 1;
    document.getElementById('puff-level-display').textContent = 'Niv. ' + lvl;
    const glow = document.getElementById('puff-glow');
    if (glow) glow.style.background = 'radial-gradient(circle, ' + (cp.color || '#7c4dff') + '66 0%, transparent 70%)';
    document.getElementById('puff-device').style.borderColor = cp.color || '#7c4dff';
  }

  // Rebirth panel
  document.getElementById('rebirth-display').textContent = u.rebirthCount;
  document.getElementById('rebirth-mult-display').textContent = 'x' + u.rebirthMultiplier.toFixed(2);
  document.getElementById('total-smoke-display').textContent = formatNumber(u.totalSmoke);
  document.getElementById('rebirth-tokens-preview').textContent = formatNumber(Math.floor(Math.sqrt(u.totalSmoke / 1000)));
  document.getElementById('rebirth-btn').disabled = u.totalSmoke < 1e6;

  // Ascension panel
  document.getElementById('asc-display').textContent = u.ascensionCount;
  document.getElementById('asc-mult-display').textContent = 'x' + u.ascensionMultiplier.toFixed(2);
  document.getElementById('all-time-smoke-display').textContent = formatNumber(u.allTimeSmoke);
  document.getElementById('asc-power-display').textContent = formatNumber(u.ascensionPower);
  document.getElementById('ascension-btn').disabled = u.rebirthCount < 5 || u.allTimeSmoke < 1e9;
}

// ---------- CLICK ----------
async function clickPuff(ev) {
  const dev = document.getElementById('puff-device');
  dev.classList.add('clicked');
  setTimeout(() => dev.classList.remove('clicked'), 150);
  createSmokeParticles();
  try {
    const d = await api('/game/click', 'POST');
    gameData.user.smoke = d.smoke;
    gameData.user.totalSmoke = d.totalSmoke;
    gameData.user.allTimeSmoke = d.allTimeSmoke;
    gameData.user.clicks = d.clicks;
    gameData.user.level = d.level;
    gameData.user.experience = d.experience;
    showClickFeedback(d.smokeGained, d.isCrit);
    updateUI();
    const up = document.getElementById('panel-upgrades');
    if (up && up.classList.contains('active')) renderUpgrades();
    if (d.newAchievements && d.newAchievements.length) {
      d.newAchievements.forEach(a => showToast('🏅 ' + a.name, 'success'));
    }
  } catch (err) {
    console.error('Click:', err);
    if (err.message && err.message.toLowerCase().includes('banni')) {
      showToast('Compte banni.', 'error'); logout();
    }
  }
}

function showClickFeedback(amount, isCrit) {
  const c = document.getElementById('click-feedback');
  const t = document.createElement('div');
  t.className = 'click-text' + (isCrit ? ' crit' : '');
  t.textContent = (isCrit ? '💥 ' : '+') + formatNumber(amount) + ' 🌫️';
  if (isCrit) { t.style.color = '#ffd600'; t.style.fontWeight = '900'; t.style.fontSize = '24px'; }
  const d = document.getElementById('puff-device');
  const r = d.getBoundingClientRect();
  t.style.left = (r.left + r.width / 2 + (Math.random() - 0.5) * 60) + 'px';
  t.style.top = (r.top - 10) + 'px';
  c.appendChild(t);
  setTimeout(() => t.remove(), 1000);
}

function createSmokeParticles() {
  const c = document.getElementById('smoke-container');
  if (!c) return;
  const d = document.getElementById('puff-device');
  const r = d.getBoundingClientRect();
  const cr = c.getBoundingClientRect();
  for (let i = 0; i < 5; i++) {
    const p = document.createElement('div');
    p.className = 'smoke-particle';
    const s = 20 + Math.random() * 40;
    p.style.width = s + 'px';
    p.style.height = s + 'px';
    p.style.left = (r.left - cr.left + r.width / 2 - s / 2 + (Math.random() - 0.5) * 40) + 'px';
    p.style.top = (r.top - cr.top + r.height / 2) + 'px';
    p.style.setProperty('--drift', ((Math.random() - 0.5) * 100) + 'px');
    c.appendChild(p);
    setTimeout(() => p.remove(), 2000);
  }
}

// ---------- AUTO COLLECT ----------
async function collectAutoSmoke() {
  if (!gameData) return;
  const u = gameData.user;
  const cp = gameData.puffs.find(p => p.puffId === u.currentPuff);
  const pa = cp ? cp.autoSmoke : 0;
  if (u.smokePerSecond <= 0 && pa <= 0) return;
  try {
    const d = await api('/game/collectAuto', 'POST');
    gameData.user.smoke = d.smoke;
    gameData.user.totalSmoke = d.totalSmoke;
    updateUI();
  } catch (e) { /* silent */ }
}

// ---------- TABS ----------
function showTab(tab) {
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('panel-' + tab).classList.add('active');
  document.getElementById('tab-' + tab).classList.add('active');
  if (tab === 'leaderboard') loadLeaderboard('totalSmoke');
  if (tab === 'quests') renderQuests();
  if (tab === 'shop') renderShop();
  if (tab === 'inventory') renderInventory();
  if (tab === 'upgrades') renderUpgrades();
  if (tab === 'boxes') renderBoxes();
  if (tab === 'liquids') renderLiquids();
  if (tab === 'achievements') renderAchievements();
}

// ---------- UPGRADES ----------
function upgradeMatchesCategory(u, cat) {
  if (cat === 'all') return true;
  if (cat === 'click') return u.effect === 'click_power';
  if (cat === 'auto') return u.effect === 'auto_smoke';
  if (cat === 'multiplier') return u.effect === 'multiplier';
  if (cat === 'critical') return u.effect === 'crit_chance' || u.effect === 'crit_mult';
  if (cat === 'special') return u.effect === 'rebirth_bonus' || u.effect === 'ascension_bonus';
  return true;
}

function filterUpgrades(category, btn) {
  currentUpgradeFilter = category;
  document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  renderUpgrades();
}

function renderUpgrades() {
  if (!gameData) return;
  const list = document.getElementById('upgrades-list');
  list.innerHTML = '';
  let upgrades = gameData.upgrades.filter(u => upgradeMatchesCategory(u, currentUpgradeFilter));
  upgrades = upgrades.filter(u => (u.requiresRebirth || 0) <= gameData.user.rebirthCount);
  if (upgrades.length === 0) {
    list.innerHTML = '<p style="color:var(--text-secondary);text-align:center;padding:20px;">Aucune amelioration disponible.</p>';
    return;
  }
  for (const upg of upgrades) {
    const owned = gameData.user.upgrades.find(u => u.upgradeId === upg.upgradeId);
    const lvl = owned ? owned.level : 0;
    const price = Math.floor(upg.basePrice * Math.pow(upg.priceMultiplier || 1.5, lvl));
    const maxed = lvl >= upg.maxLevel;
    const icon = upg.currency === 'smoke' ? '🌫️' : '💎';
    const afford = upg.currency === 'smoke' ? gameData.user.smoke >= price : gameData.user.gems >= price;
    const card = document.createElement('div');
    card.className = 'item-card';
    const btn = maxed
      ? '<button class="btn-buy" disabled>MAX</button>'
      : '<button class="btn-buy ' + (upg.currency === 'gems' ? 'btn-gems' : '') + '" ' +
        (afford ? '' : 'disabled') + ' data-upgrade="' + upg.upgradeId + '">' +
        icon + ' ' + formatNumber(price) + '</button>';
    card.innerHTML =
      '<div class="item-info">' +
        '<div class="item-name">' + upg.name + '</div>' +
        '<div class="item-desc">' + upg.description + '</div>' +
        '<div class="item-level">Niveau ' + lvl + '/' + upg.maxLevel + '</div>' +
      '</div>' +
      '<div class="item-action">' + btn + '</div>';
    const buyBtn = card.querySelector('button[data-upgrade]');
    if (buyBtn) buyBtn.addEventListener('click', () => buyUpgrade(upg.upgradeId));
    list.appendChild(card);
  }
}

async function buyUpgrade(upgradeId) {
  try {
    const d = await api('/game/buyUpgrade', 'POST', { upgradeId });
    Object.assign(gameData.user, d);
    updateUI();
    renderUpgrades();
    showToast('Amelioration achetee !', 'success');
  } catch (err) { showToast(err.message, 'error'); }
}

// ---------- SHOP (acheter puffs) ----------
function renderShop() {
  if (!gameData) return;
  const grid = document.getElementById('shop-list');
  grid.innerHTML = '';
  const puffs = gameData.puffs.filter(p => !gameData.user.inventory.includes(p.puffId));
  if (puffs.length === 0) {
    grid.innerHTML = '<p style="color:var(--text-secondary);text-align:center;padding:20px;grid-column:1/-1;">Tu possedes toutes les puffs !</p>';
    return;
  }
  for (const p of puffs) {
    const afford = gameData.user.smoke >= (p.priceSmoke || 0) && gameData.user.gems >= (p.priceGems || 0);
    const ascOk = !p.requiresAscension || gameData.user.ascensionCount >= 1;
    const card = document.createElement('div');
    card.className = 'puff-card rarity-' + p.rarity;
    card.innerHTML =
      '<span class="puff-card-emoji">' + p.emoji + '</span>' +
      '<div class="puff-card-name">' + p.name + '</div>' +
      '<div class="puff-card-rarity rarity-' + p.rarity + '">' + p.rarity + '</div>' +
      '<div class="puff-card-stats"><span>x' + p.multiplier + ' multi</span><span>+' + p.autoSmoke + '/sec</span></div>' +
      '<div class="puff-card-price">' +
        (p.priceSmoke > 0 ? '🌫️ ' + formatNumber(p.priceSmoke) : '') +
        (p.priceGems > 0 ? ' 💎 ' + formatNumber(p.priceGems) : '') +
      '</div>' +
      (!ascOk
        ? '<button class="btn-buy" disabled>🔒 Ascension requise</button>'
        : '<button class="btn-buy ' + (p.priceGems > 0 ? 'btn-gems' : '') + '" ' +
          (afford ? '' : 'disabled') + ' data-puff="' + p.puffId + '">Acheter</button>'
      );
    const b = card.querySelector('button[data-puff]');
    if (b) b.addEventListener('click', () => buyPuff(p.puffId));
    grid.appendChild(card);
  }
}

async function buyPuff(puffId) {
  try {
    const d = await api('/game/buyPuff', 'POST', { puffId });
    gameData.user.smoke = d.smoke;
    gameData.user.gems = d.gems;
    gameData.user.inventory = d.inventory;
    updateUI();
    renderShop();
    renderInventory();
    showToast('Nouvelle puff achetee !', 'success');
  } catch (err) { showToast(err.message, 'error'); }
}

// ---------- INVENTORY ----------
function renderInventory() {
  if (!g
