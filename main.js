// ===== PUFF CLICKER SIMULATOR - MAIN JS =====
const API = 'https://backend-rnxv.onrender.com';
let token = localStorage.getItem('puff_token');
let gameData = null;
let autoSaveInterval = null;
let autoCollectInterval = null;
let currentQuestFilter = 'daily';
let currentUpgradeFilter = 'all';

// ===== API HELPERS =====
async function api(endpoint, method = 'GET', body = null) {
  const options = {
    method,
    headers: { 'Content-Type': 'application/json' }
  };
  if (token) options.headers['Authorization'] = `Bearer ${token}`;
  if (body) options.body = JSON.stringify(body);

  const res = await fetch(`${API}${endpoint}`, options);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Erreur serveur');
  return data;
}

// ===== FORMAT NUMBERS =====
function formatNumber(n) {
  if (n === undefined || n === null) return '0';
  if (n >= 1e15) return (n / 1e15).toFixed(2) + 'Q';
  if (n >= 1e12) return (n / 1e12).toFixed(2) + 'T';
  if (n >= 1e9) return (n / 1e9).toFixed(2) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return Math.floor(n).toLocaleString('fr-FR');
}

// ===== TOAST NOTIFICATIONS =====
function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

// ===== AUTH FUNCTIONS =====
function showLogin() {
  document.getElementById('login-form').classList.remove('hidden');
  document.getElementById('signup-form').classList.add('hidden');
}

function showSignup() {
  document.getElementById('login-form').classList.add('hidden');
  document.getElementById('signup-form').classList.remove('hidden');
}

async function login() {
  const username = document.getElementById('login-username').value.trim();
  const password = document.getElementById('login-password').value;
  const errorEl = document.getElementById('login-error');
  errorEl.textContent = '';

  if (!username || !password) {
    errorEl.textContent = 'Remplis tous les champs.';
    return;
  }

  try {
    const data = await api('/auth/login', 'POST', { username, password });
    token = data.token;
    localStorage.setItem('puff_token', token);
    showToast('Connexion réussie !', 'success');
    startGame();
  } catch (err) {
    errorEl.textContent = err.message;
  }
}

async function signup() {
  const username = document.getElementById('signup-username').value.trim();
  const password = document.getElementById('signup-password').value;
  const errorEl = document.getElementById('signup-error');
  errorEl.textContent = '';

  if (!username || !password) {
    errorEl.textContent = 'Remplis tous les champs.';
    return;
  }

  try {
    const data = await api('/auth/signup', 'POST', { username, password });
    token = data.token;
    localStorage.setItem('puff_token', token);
    showToast('Inscription réussie !', 'success');
    startGame();
  } catch (err) {
    errorEl.textContent = err.message;
  }
}

async function logout() {
  try {
    await api('/auth/logout', 'POST');
  } catch (e) {}
  token = null;
  localStorage.removeItem('puff_token');
  clearInterval(autoSaveInterval);
  clearInterval(autoCollectInterval);
  document.getElementById('game-screen').classList.remove('active');
  document.getElementById('auth-screen').classList.add('active');
  showToast('Déconnecté.', 'info');
}

// ===== ENTER KEY HANDLER =====
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('login-password').addEventListener('keypress', e => {
    if (e.key === 'Enter') login();
  });
  document.getElementById('signup-password').addEventListener('keypress', e => {
    if (e.key === 'Enter') signup();
  });

  // Auto-login if token exists
  if (token) {
    startGame();
  }
});

// ===== START GAME =====
async function startGame() {
  try {
    const data = await api('/game/getData');
    gameData = data;

    document.getElementById('auth-screen').classList.remove('active');
    document.getElementById('game-screen').classList.add('active');

    updateUI();
    renderUpgrades();
    renderShop();
    renderInventory();
    renderQuests();
    renderAnnouncements();
    renderEvents();

    // Auto-save every 30 seconds
    autoSaveInterval = setInterval(saveGame, 30000);

    // Auto-collect smoke every second
    autoCollectInterval = setInterval(collectAutoSmoke, 1000);
  } catch (err) {
    console.error('Start game error:', err);
    token = null;
    localStorage.removeItem('puff_token');
    showToast('Session expirée, reconnecte-toi.', 'error');
  }
}

// ===== UPDATE UI =====
function updateUI() {
  if (!gameData) return;
  const u = gameData.user;

  document.getElementById('player-name').textContent = u.username;
  document.getElementById('player-level').textContent = `Niv. ${u.level}`;
  document.getElementById('login-streak').textContent = `🔥 ${u.loginStreak}`;
  document.getElementById('smoke-count').textContent = formatNumber(u.smoke);
  document.getElementById('gem-count').textContent = formatNumber(u.gems);
  document.getElementById('smoke-per-click').textContent = formatNumber(u.smokePerClick * u.clickMultiplier);
  document.getElementById('smoke-per-second').textContent = formatNumber(u.smokePerSecond);
  document.getElementById('click-multiplier').textContent = `x${u.clickMultiplier.toFixed(1)}`;
  document.getElementById('crit-chance').textContent = `${u.critChance}%`;
  document.getElementById('rebirth-count').textContent = u.rebirths;
  document.getElementById('ascension-count').textContent = u.ascensions;

  // Liquid multiplier
  const liquidMult = gameData.user.equippedLiquids.reduce((mult, liqId) => {
    const liquid = gameData.liquids.find(l => l.liquidId === liqId);
    return mult * (liquid ? liquid.multiplier : 1);
  }, 1);
  document.getElementById('liquid-mult-display').textContent = `x${liquidMult.toFixed(2)}`;

  // Update puff display
  const currentPuff = gameData.puffs.find(p => p.puffId === u.currentPuff);
  if (currentPuff) {
    document.getElementById('puff-emoji').textContent = currentPuff.emoji;
    document.getElementById('puff-name').textContent = currentPuff.name;
    document.getElementById('puff-level-display').textContent = `Niv. ${u.puffLevel}`;
    document.getElementById('puff-glow').style.background =
      `radial-gradient(circle, ${currentPuff.color}66 0%, transparent 70%)`;
    document.getElementById('puff-device').style.borderColor = currentPuff.color;
  }

  // Rebirth panel
  document.getElementById('rebirth-display').textContent = u.rebirths;
  document.getElementById('rebirth-mult-display').textContent = `x${u.rebirthMultiplier.toFixed(2)}`;
  document.getElementById('total-smoke-display').textContent = formatNumber(u.totalSmoke);
  const rebirthTokensPreview = Math.floor(Math.sqrt(u.totalSmoke / 1000000));
  document.getElementById('rebirth-tokens-preview').textContent = formatNumber(rebirthTokensPreview);
  document.getElementById('rebirth-btn').disabled = u.totalSmoke < 1000000;

  // Ascension panel
  document.getElementById('asc-display').textContent = u.ascensions;
  document.getElementById('asc-mult-display').textContent = `x${u.ascensionMultiplier.toFixed(2)}`;
  document.getElementById('all-time-smoke-display').textContent = formatNumber(u.allTimeSmoke);
  document.getElementById('asc-power-display').textContent = formatNumber(u.ascensionPower);
  document.getElementById('ascension-btn').disabled = u.rebirths < 5 || u.allTimeSmoke < 1000000000;

}

// ===== CLICK PUFF =====
async function clickPuff() {
  const device = document.getElementById('puff-device');
  device.classList.add('clicked');
  setTimeout(() => device.classList.remove('clicked'), 150);

  // Create smoke particles
  createSmokeParticles();

  try {
    const data = await api('/game/click', 'POST');
    gameData.user.smoke = data.smoke;
    gameData.user.totalSmoke = data.totalSmoke;
    gameData.user.clicks = data.clicks;
    gameData.user.level = data.level;
    gameData.user.experience = data.experience;

    // Show click feedback
    showClickFeedback(data.smokeGained);
    updateUI();
  } catch (err) {
    console.error('Click error:', err);
  }
}

function showClickFeedback(amount) {
  const container = document.getElementById('click-feedback');
  const text = document.createElement('div');
  text.className = 'click-text';
  text.textContent = `+${formatNumber(amount)} 🌫️`;

  const device = document.getElementById('puff-device');
  const rect = device.getBoundingClientRect();
  const x = rect.left + rect.width / 2 + (Math.random() - 0.5) * 60;
  const y = rect.top - 10;

  text.style.left = `${x}px`;
  text.style.top = `${y}px`;
  container.appendChild(text);

  setTimeout(() => text.remove(), 1000);
}

function createSmokeParticles() {
  const container = document.getElementById('smoke-container');
  const device = document.getElementById('puff-device');
  const rect = device.getBoundingClientRect();
  const containerRect = container.getBoundingClientRect();

  for (let i = 0; i < 5; i++) {
    const particle = document.createElement('div');
    particle.className = 'smoke-particle';
    const size = 20 + Math.random() * 40;
    particle.style.width = `${size}px`;
    particle.style.height = `${size}px`;
    particle.style.left = `${rect.left - containerRect.left + rect.width / 2 - size / 2 + (Math.random() - 0.5) * 40}px`;
    particle.style.top = `${rect.top - containerRect.top + rect.height / 2}px`;
    particle.style.setProperty('--drift', `${(Math.random() - 0.5) * 100}px`);
    container.appendChild(particle);
    setTimeout(() => particle.remove(), 2000);
  }
}

// ===== AUTO SMOKE =====
async function collectAutoSmoke() {
  if (!gameData || gameData.user.smokePerSecond <= 0) return;

  try {
    const data = await api('/game/collectAuto', 'POST');
    gameData.user.smoke = data.smoke;
    gameData.user.totalSmoke = data.totalSmoke;
    updateUI();

    // Create subtle smoke for auto
    if (data.smokeGained > 0) {
      const container = document.getElementById('smoke-container');
      const particle = document.createElement('div');
      particle.className = 'smoke-particle';
      const size = 15 + Math.random() * 20;
      particle.style.width = `${size}px`;
      particle.style.height = `${size}px`;
      particle.style.left = `${50 + (Math.random() - 0.5) * 20}%`;
      particle.style.top = '60%';
      particle.style.setProperty('--drift', `${(Math.random() - 0.5) * 80}px`);
      particle.style.opacity = '0.3';
      container.appendChild(particle);
      setTimeout(() => particle.remove(), 2000);
    }
  } catch (err) {
    console.error('Auto smoke error:', err);
  }
}

function showTab(tab) {
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById(`panel-${tab}`).classList.add('active');
  document.getElementById(`tab-${tab}`).classList.add('active');

  // Render content for each tab
  if (tab === 'leaderboard') loadLeaderboard('totalSmoke');
  if (tab === 'quests') renderQuests();
  if (tab === 'shop') renderShop();
  if (tab === 'inventory') renderInventory();
  if (tab === 'upgrades') renderUpgrades();
  if (tab === 'boxes') renderBoxes();
  if (tab === 'liquids') renderLiquids();
  if (tab === 'achievements') renderAchievements();
}

// ===== UPGRADES =====
function filterUpgrades(category) {
  currentUpgradeFilter = category;
  document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
  event.target.classList.add('active');
  renderUpgrades();
}

function renderUpgrades() {
  if (!gameData) return;
  const list = document.getElementById('upgrades-list');
  list.innerHTML = '';

  let upgrades = gameData.upgrades;
  if (currentUpgradeFilter !== 'all') {
    upgrades = upgrades.filter(u => u.category === currentUpgradeFilter);
  }

  // Filter by level
  upgrades = upgrades.filter(u => gameData.user.level >= u.unlockLevel);

  if (upgrades.length === 0) {
    list.innerHTML = '<p style="color:var(--text-secondary);text-align:center;padding:20px;">Aucune amélioration disponible.</p>';
    return;
  }

  for (const upgrade of upgrades) {
    const owned = gameData.user.upgrades.find(u => u.upgradeId === upgrade.upgradeId);
    const currentLevel = owned ? owned.level : 0;
    const price = Math.floor(upgrade.basePrice * Math.pow(upgrade.priceMultiplier, currentLevel));
    const maxed = currentLevel >= upgrade.maxLevel;
    const currencyIcon = upgrade.currency === 'smoke' ? '🌫️' : '💎';
    const canAfford = upgrade.currency === 'smoke'
      ? gameData.user.smoke >= price
      : gameData.user.gems >= price;

    const card = document.createElement('div');
    card.className = 'item-card';
    card.innerHTML = `
      <div class="item-info">
        <div class="item-name">${upgrade.name}</div>
        <div class="item-desc">${upgrade.description}</div>
        <div class="item-level">Niveau ${currentLevel}/${upgrade.maxLevel}</div>
      </div>
      <div class="item-action">
        ${maxed
          ? '<button class="btn-buy" disabled>MAX</button>'
          : `<button class="btn-buy ${upgrade.currency === 'gems' ? 'btn-gems' : ''}"
              ${canAfford ? '' : 'disabled'}
              onclick="buyUpgrade('${upgrade.upgradeId}')">
              ${currencyIcon} ${formatNumber(price)}
            </button>`
        }
      </div>
    `;
    list.appendChild(card);
  }
}

async function buyUpgrade(upgradeId) {
  try {
    const data = await api('/game/buyUpgrade', 'POST', { upgradeId });
    gameData.user.smoke = data.smoke;
    gameData.user.gems = data.gems;
    gameData.user.smokePerClick = data.smokePerClick;
    gameData.user.smokePerSecond = data.smokePerSecond;
    gameData.user.clickMultiplier = data.clickMultiplier;
    gameData.user.upgrades = data.upgrades;
    updateUI();
    renderUpgrades();
    showToast('Amélioration achetée !', 'success');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ===== SHOP =====
function renderShop() {
  if (!gameData) return;
  const grid = document.getElementById('shop-list');
  grid.innerHTML = '';

  const puffs = gameData.puffs.filter(p => !gameData.user.inventory.includes(p.puffId));

  if (puffs.length === 0) {
    grid.innerHTML = '<p style="color:var(--text-secondary);text-align:center;padding:20px;grid-column:1/-1;">Tu possèdes toutes les puffs ! 🎉</p>';
    return;
  }

  for (const puff of puffs) {
    const canAffordSmoke = gameData.user.smoke >= puff.priceSmoke;
    const canAffordGems = gameData.user.gems >= puff.priceGems;
    const canAfford = canAffordSmoke && canAffordGems;
    const levelOk = gameData.user.level >= puff.unlockLevel;

    const card = document.createElement('div');
    card.className = `puff-card rarity-${puff.rarity}`;
    card.innerHTML = `
      <span class="puff-card-emoji">${puff.emoji}</span>
      <div class="puff-card-name">${puff.name}</div>
      <div class="puff-card-rarity rarity-${puff.rarity}">${puff.rarity}</div>
      <div class="puff-card-stats">
        <span>x${puff.multiplier} multi</span>
        <span>+${puff.autoSmoke}/sec</span>
      </div>
      <div class="puff-card-price">
        ${puff.priceSmoke > 0 ? `🌫️ ${formatNumber(puff.priceSmoke)}` : ''}
        ${puff.priceGems > 0 ? ` 💎 ${formatNumber(puff.priceGems)}` : ''}
      </div>
      ${!levelOk
        ? `<button class="btn-buy" disabled>🔒 Niv. ${puff.unlockLevel}</button>`
        : `<button class="btn-buy ${puff.priceGems > 0 ? 'btn-gems' : ''}"
            ${canAfford ? '' : 'disabled'}
            onclick="buyPuff('${puff.puffId}')">Acheter</button>`
      }
    `;
    grid.appendChild(card);
  }
}

async function buyPuff(puffId) {
  try {
    const data = await api('/game/buyPuff', 'POST', { puffId });
    gameData.user.smoke = data.smoke;
    gameData.user.gems = data.gems;
    gameData.user.inventory = data.inventory;
    updateUI();
    renderShop();
    renderInventory();
    showToast('Nouvelle puff achetée !', 'success');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ===== INVENTORY =====
function renderInventory() {
  if (!gameData) return;
  const grid = document.getElementById('inventory-list');
  grid.innerHTML = '';

  for (const puffId of gameData.user.inventory) {
    const puff = gameData.puffs.find(p => p.puffId === puffId);
    if (!puff) continue;

    const isEquipped = gameData.user.currentPuff === puffId;

    const card = document.createElement('div');
    card.className = `puff-card owned ${isEquipped ? 'equipped' : ''} rarity-${puff.rarity}`;
    card.innerHTML = `
      <span class="puff-card-emoji">${puff.emoji}</span>
      <div class="puff-card-name">${puff.name}</div>
      <div class="puff-card-rarity rarity-${puff.rarity}">${puff.rarity}</div>
      <div class="puff-card-stats">
        <span>x${puff.multiplier} multi</span>
        <span>+${puff.autoSmoke}/sec</span>
      </div>
      ${isEquipped
        ? '<button class="btn-buy btn-equipped" disabled>✅ Équipée</button>'
        : `<button class="btn-buy btn-equip" onclick="equipPuff('${puffId}')">Équiper</button>`
      }
    `;
    grid.appendChild(card);
  }
}

async function equipPuff(puffId) {
  try {
    const data = await api('/game/equipPuff', 'POST', { puffId });
    gameData.user.currentPuff = data.currentPuff;
    updateUI();
    renderInventory();
    showToast('Puff équipée !', 'success');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ===== QUESTS =====
function filterQuests(type) {
  currentQuestFilter = type;
  document.querySelectorAll('.quest-tab').forEach(t => t.classList.remove('active'));
  event.target.classList.add('active');
  renderQuests();
}

function renderQuests() {
  if (!gameData) return;
  const list = document.getElementById('quests-list');
  list.innerHTML = '';

  const quests = gameData.user.quests.filter(q => q.type === currentQuestFilter);

  if (quests.length === 0) {
    list.innerHTML = '<p style="color:var(--text-secondary);text-align:center;padding:20px;">Aucune quête disponible.</p>';
    return;
  }

  for (const quest of quests) {
    const progress = Math.min(quest.current / quest.target * 100, 100);
    const rewardIcon = quest.rewardType === 'gems' ? '💎' : '🌫️';

    const card = document.createElement('div');
    card.className = 'quest-card';
    card.innerHTML = `
      <div class="quest-header">
        <span class="quest-desc">${quest.description}</span>
        <span class="quest-reward">${rewardIcon} ${quest.reward}</span>
      </div>
      <div class="quest-progress-bar">
        <div class="quest-progress-fill ${quest.completed ? 'completed' : ''}" style="width: ${progress}%"></div>
      </div>
      <div class="quest-progress-text">
        <span>${formatNumber(quest.current)} / ${formatNumber(quest.target)}</span>
        ${quest.completed && !quest.claimed
          ? `<button class="btn-buy btn-claim" onclick="claimQuest('${quest.questId}')">Réclamer</button>`
          : quest.claimed
            ? '<span style="color:var(--success)">✅ Réclamé</span>'
            : ''
        }
      </div>
    `;
    list.appendChild(card);
  }
}

async function claimQuest(questId) {
  try {
    const data = await api('/game/claimQuest', 'POST', { questId });
    gameData.user.gems = data.gems;
    gameData.user.smoke = data.smoke;

    const quest = gameData.user.quests.find(q => q.questId === questId);
    if (quest) quest.claimed = true;

    updateUI();
    renderQuests();
    const icon = data.rewardType === 'gems' ? '💎' : '🌫️';
    showToast(`${icon} +${data.reward} ${data.rewardType} !`, 'success');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ===== LEADERBOARD =====
async function loadLeaderboard(type) {
  document.querySelectorAll('.lb-tab').forEach(t => t.classList.remove('active'));
  event?.target?.classList?.add('active');

  const list = document.getElementById('leaderboard-list');
  list.innerHTML = '<p style="color:var(--text-secondary);text-align:center;padding:20px;">Chargement...</p>';

  try {
    const data = await api(`/leaderboard?type=${type}&limit=20`);
    list.innerHTML = '';

    if (data.leaderboard.length === 0) {
      list.innerHTML = '<p style="color:var(--text-secondary);text-align:center;padding:20px;">Aucun joueur.</p>';
      return;
    }

    const labels = {
      totalSmoke: '🌫️ Fumée totale',
      totalGems: '💎 Gems totaux',
      level: '⭐ Niveau',
      clicks: '👆 Clics'
    };

    for (const entry of data.leaderboard) {
      const rankClass = entry.rank === 1 ? 'gold' : entry.rank === 2 ? 'silver' : entry.rank === 3 ? 'bronze' : '';

      const div = document.createElement('div');
      div.className = 'lb-entry';
      div.innerHTML = `
        <div class="lb-rank ${rankClass}">${entry.rank <= 3 ? ['🥇', '🥈', '🥉'][entry.rank - 1] : '#' + entry.rank}</div>
        <div class="lb-info">
          <div class="lb-name">${entry.username}</div>
          <div class="lb-detail">Niv. ${entry.level} • Prestige ${entry.prestigeLevel}</div>
        </div>
        <div class="lb-value">${formatNumber(entry[type])}</div>
      `;
      list.appendChild(div);
    }
  } catch (err) {
    list.innerHTML = '<p style="color:var(--danger);text-align:center;padding:20px;">Erreur de chargement.</p>';
  }
}

// ===== PRESTIGE =====
async function doPrestige() {
  if (!gameData || gameData.user.totalSmoke < 1000000) {
    showToast('Il faut au moins 1,000,000 fumée totale !', 'error');
    return;
  }

  if (!confirm('⚠️ Le prestige va réinitialiser ta fumée, tes améliorations et ton inventaire. Tu gagneras des gems et un multiplicateur permanent. Continuer ?')) {
    return;
  }

  try {
    const data = await api('/game/prestige', 'POST');
    showToast(`⭐ Prestige ${data.prestigeLevel} ! +${data.gemsEarned} gems !`, 'success');

    // Reload game data
    const freshData = await api('/game/getData');
    gameData = freshData;
    updateUI();
    renderUpgrades();
    renderShop();
    renderInventory();
    renderQuests();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function renderBoxes() {
  if (!gameData) return;
  const list = document.getElementById('boxes-list');
  list.innerHTML = '';

  const boxes = gameData.user.boxes;
  if (boxes.length === 0) {
    list.innerHTML = '<p style="color:var(--text-secondary);text-align:center;padding:40px;">Aucune boîte. Gagne-les via quêtes/événements ! 📦</p>';
    return;
  }

  for (const box of boxes) {
    const boxData = gameData.boxTypes.find(b => b.boxId === box.boxId);
    if (!boxData) continue;

    const card = document.createElement('div');
    card.className = 'item-card';
    card.innerHTML = `
      <div class="item-info">
        <div class="item-name">${boxData.emoji} ${boxData.name}</div>
        <div class="item-desc">${boxData.description}</div>
        <div class="item-level">x${boxData.rewardMultiplier.toFixed(1)} récompenses</div>
      </div>
      <div class="item-action">
        <button class="btn-buy btn-primary" onclick="openBox('${box.boxId}')">Ouvrir</button>
      </div>
    `;
    list.appendChild(card);
  }
}

async function openBox(boxId) {
  try {
    const data = await api('/game/openBox', 'POST', { boxId });
    
    // Animate box opening with GSAP
    const overlay = document.getElementById('box-open-overlay');
    const emojiEl = document.getElementById('box-open-emoji');
    const resultEl = document.getElementById('box-open-result');
    
    const boxType = gameData.boxTypes.find(b => b.boxId === boxId);
    emojiEl.textContent = boxType.emoji;
    
    let resultHtml = '';
    data.rewards.forEach(reward => {
      const icon = reward.type === 'gems' ? '💎' : reward.type === 'liquids' ? '🧪' : '🌫️';
      resultHtml += `<div style="font-size:18px;margin:5px 0;">${icon} +${formatNumber(reward.amount)} ${reward.name || reward.type}</div>`;
    });
    
    resultEl.innerHTML = resultHtml;
    overlay.classList.remove('hidden');
    
    // GSAP shake + explode animation
    gsap.fromTo(overlay, 
      { scale: 0.8, rotation: -5 },
      { scale: 1, rotation: 0, duration: 0.3, ease: "back.out(1.7)" }
    );
    
    showToast(`📦 Boîte ouverte ! ${data.rewards.length} récompenses !`, 'success');
    
    // Update game data
    gameData.user.gems = data.gems;
    gameData.user.smoke = data.smoke;
    gameData.user.boxes = data.boxes;
    gameData.liquids = data.liquids || gameData.liquids;
    updateUI();
    renderBoxes();
    renderLiquids();
    
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function closeBoxOverlay() {
  const overlay = document.getElementById('box-open-overlay');
  gsap.to(overlay, {
    scale: 0.8, 
    opacity: 0, 
    duration: 0.2, 
    onComplete: () => overlay.classList.add('hidden')
  });
}

function renderLiquids() {
  if (!gameData) return;
  const list = document.getElementById('liquids-list');
  list.innerHTML = '';

  const ownedLiquids = gameData.user.liquids;
  if (ownedLiquids.length === 0) {
    list.innerHTML = '<p style="color:var(--text-secondary);text-align:center;padding:40px;">Aucun liquide. Gagne-les via boîtes/événements ! 🧪</p>';
    return;
  }

  for (const liquid of ownedLiquids) {
    const liquidData = gameData.liquids.find(l => l.liquidId === liquid.liquidId);
    if (!liquidData) continue;
    
    const isEquipped = gameData.user.equippedLiquids.includes(liquid.liquidId);
    const slotCount = gameData.user.equippedLiquids.length;

    const card = document.createElement('div');
    card.className = 'item-card';
    card.innerHTML = `
      <div class="item-info">
        <div class="item-name">${liquidData.emoji} ${liquidData.name}</div>
        <div class="item-desc">x${liquidData.multiplier.toFixed(2)} multi • ${liquidData.rarity}</div>
        <div class="item-level">Quantité: ${liquid.quantity}</div>
      </div>
      <div class="item-action">
        ${isEquipped 
          ? `<button class="btn-buy btn-equipped" onclick="unequipLiquid('${liquid.liquidId}')">✅ Équipé</button>`
          : slotCount < 5 
            ? `<button class="btn-buy btn-equip" onclick="equipLiquid('${liquid.liquidId}')">Équiper</button>`
            : `<button class="btn-buy" disabled>Slots pleins (5/5)</button>`
        }
        <br><button class="btn-buy btn-small" style="background:var(--danger);margin-top:5px;" onclick="sellLiquid('${liquid.liquidId}', ${liquidData.sellPrice})">💰 Vendre</button>
      </div>
    `;
    list.appendChild(card);
  }
}

async function equipLiquid(liquidId) {
  try {
    const data = await api('/game/equipLiquid', 'POST', { liquidId });
    gameData.user.equippedLiquids = data.equippedLiquids;
    updateUI();
    renderLiquids();
    showToast('Liquide équipé ! Multiplicateur mis à jour.', 'success');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function unequipLiquid(liquidId) {
  try {
    const data = await api('/game/unequipLiquid', 'POST', { liquidId });
    gameData.user.equippedLiquids = data.equippedLiquids;
    updateUI();
    renderLiquids();
    showToast('Liquide déséquipé.', 'info');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function sellLiquid(liquidId, price) {
  if (!confirm(`Vendre 1 unité pour 💎 ${formatNumber(price)} ?`)) return;
  
  try {
    const data = await api('/game/sellLiquid', 'POST', { liquidId });
    gameData.user.gems = data.gems;
    gameData.user.liquids = data.liquids;
    updateUI();
    renderLiquids();
    showToast(`💎 +${formatNumber(price)} !`, 'success');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ===== ACHIEVEMENTS =====
function renderAchievements() {
  if (!gameData) return;
  const list = document.getElementById('achievements-list');
  list.innerHTML = '';

  const achievements = gameData.achievements;
  if (!achievements || achievements.length === 0) {
    list.innerHTML = '<p style="color:var(--text-secondary);text-align:center;padding:40px;">Aucun succès débloqué. Continue de jouer ! 🏅</p>';
    return;
  }

  for (const ach of achievements) {
    const card = document.createElement('div');
    card.className = 'item-card';
    card.style.borderLeft = `4px solid ${ach.color}`;
    card.innerHTML = `
      <div class="item-info">
        <div class="item-name" style="color:${ach.color}">${ach.emoji} ${ach.name}</div>
        <div class="item-desc">${ach.description}</div>
        <div class="item-level" style="color:${ach.color}">Débloqué: ${new Date(ach.unlockedAt).toLocaleDateString('fr-FR')}</div>
      </div>
    `;
    list.appendChild(card);
  }
}

// ===== BUFF SYSTEM =====
async function buyBuff(buffType) {
  try {
    const data = await api('/game/buyBuff', 'POST', { buffType });
    gameData.user.gems = data.gems;
    gameData.activeBuffs = data.activeBuffs;
    updateUI();
    
    // Show active buffs
    const buffsEl = document.getElementById('active-buffs');
    if (data.activeBuffs && data.activeBuffs.length > 0) {
      buffsEl.innerHTML = data.activeBuffs.map(b => 
        `<div class="event-badge">${b.name} (${Math.ceil((b.expiresAt - Date.now()) / 1000 / 60)}min)</div>`
      ).join('');
      buffsEl.classList.remove('hidden');
    } else {
      buffsEl.classList.add('hidden');
    }
    
    showToast(`${buffType.replace('_', ' ').toUpperCase()} activé !`, 'success');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ===== ASCENSION =====
async function doAscension() {
  if (!gameData || gameData.user.rebirths < 5 || gameData.user.allTimeSmoke < 1000000000) {
    showToast('Requis: 5 rebirths + 1B fumée all-time !', 'error');
    return;
  }

  if (!confirm('🌌 ASCENSION TOTALE ! Reset TOUT (rebirths inclus). Multiplicateur cosmique permanent. Continuer ?')) {
    return;
  }

  try {
    const data = await api('/game/ascend', 'POST');
    showToast(`✨ Ascension ${data.ascensionLevel} ! Pouvoir: ${formatNumber(data.ascensionPower)}`, 'success');
    
    const freshData = await api('/game/getData');
    gameData = freshData;
    updateUI();
    renderUpgrades();
    renderShop();
    renderInventory();
    renderQuests();
    renderBoxes();
    renderLiquids();
    renderAchievements();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ===== SAVE =====
async function saveGame() {
  try {
    await api('/game/save', 'POST');
  } catch (err) {
    console.error('Save error:', err);
  }
}

// ===== ANNOUNCEMENTS =====
function renderAnnouncements() {
  if (!gameData) return;
  const el = document.getElementById('announcements');
  const announcements = gameData.announcements;

  if (!announcements || announcements.length === 0) {
    el.classList.add('hidden');
    return;
  }

  el.classList.remove('hidden');
  el.innerHTML = announcements.map(a => `<div>📢 ${a.message}</div>`).join('');
}

// ===== EVENTS =====
function renderEvents() {
  if (!gameData) return;
  const el = document.getElementById('active-events');
  const events = gameData.events;

  if (!events || events.length === 0) {
    el.classList.add('hidden');
    return;
  }

  el.classList.remove('hidden');
  el.innerHTML = events.map(e =>
    `<div class="event-badge">🎉 ${e.name} (x${e.bonusMultiplier})</div>`
  ).join('');
}
