// ── app.js ────────────────────────────────────────────────────────────────────
// Food Delivery Frontend — talks to FastAPI at BASE_URL
// Change BASE_URL if your backend runs on a different port/host
// ─────────────────────────────────────────────────────────────────────────────

const BASE_URL = 'http://localhost:8000/api/v1';

// ── State ─────────────────────────────────────────────────────────────────────
const state = {
  token: null,
  refreshToken: null,
  user: null,
  menuData: [],
  cartItems: [],
  searchTimer: null,
  currentView: 'menu',
};

// ── Boot ──────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  lucide.createIcons();
  checkHealth();
  loadMenu();
  setInterval(checkHealth, 30000);
});

// ── Theme ─────────────────────────────────────────────────────────────────────
function initTheme() {
  const root = document.documentElement;
  if (!root.getAttribute('data-theme')) {
    root.setAttribute('data-theme', matchMedia('(prefers-color-scheme:dark)').matches ? 'dark' : 'light');
  }
  document.querySelectorAll('[data-theme-toggle]').forEach(btn => {
    btn.addEventListener('click', () => {
      const next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      root.setAttribute('data-theme', next);
      lucide.createIcons();
    });
  });
}

// ── Health ────────────────────────────────────────────────────────────────────
async function checkHealth() {
  const dot  = document.getElementById('status-dot');
  const text = document.getElementById('status-text');
  try {
    const r = await fetch(BASE_URL.replace('/api/v1', '') + '/health');
    if (r.ok) { dot.className = 'status-dot ok'; text.textContent = 'API Online'; }
    else throw new Error();
  } catch {
    dot.className = 'status-dot err';
    text.textContent = 'API Offline';
  }
}

// ── API helper ────────────────────────────────────────────────────────────────
async function api(path, opts = {}) {
  const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
  if (state.token) headers['Authorization'] = 'Bearer ' + state.token;

  let res = await fetch(BASE_URL + path, { ...opts, headers });

  if (res.status === 401 && state.refreshToken) {
    const rr = await fetch(BASE_URL + '/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: state.refreshToken }),
    });
    if (rr.ok) {
      const data = await rr.json();
      state.token = data.access_token;
      state.refreshToken = data.refresh_token;
      headers['Authorization'] = 'Bearer ' + state.token;
      res = await fetch(BASE_URL + path, { ...opts, headers });
    } else {
      logout();
      throw new Error('Session expired. Please log in again.');
    }
  }

  if (!res.ok) {
    let msg = 'Error ' + res.status;
    try { const e = await res.json(); msg = e.detail || msg; } catch {}
    throw new Error(msg);
  }
  return res.json();
}

// ── Navigation ────────────────────────────────────────────────────────────────
const VIEW_TITLES = {
  menu: 'Menu', recommendations: 'Recommendations',
  cart: 'Cart', profile: 'Profile', auth: 'Login', admin: 'Admin',
};

function switchView(name) {
  state.currentView = name;
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  const viewEl = document.getElementById('view-' + name);
  if (viewEl) viewEl.classList.add('active');
  document.querySelectorAll('.nav-item').forEach(i => {
    i.classList.toggle('active', i.dataset.view === name);
  });
  const title = VIEW_TITLES[name] || name;
  document.getElementById('page-title').textContent = title;
  document.getElementById('mobile-title').textContent = title;

  if (name === 'recommendations') loadRecommendations();
  if (name === 'cart') renderCart();
  if (name === 'profile') renderProfile();

  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebar-overlay').classList.remove('visible');
}

function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('sidebar-overlay').classList.toggle('visible');
}

// ── Toast ─────────────────────────────────────────────────────────────────────
function toast(msg, type, duration) {
  type = type || 'info';
  duration = duration || 3000;
  const area = document.getElementById('toast-area');
  const el = document.createElement('div');
  el.className = 'toast toast-' + type;
  el.textContent = msg;
  area.appendChild(el);
  setTimeout(() => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(8px)';
    el.style.transition = '250ms ease';
    setTimeout(() => el.remove(), 260);
  }, duration);
}

// ── Menu ──────────────────────────────────────────────────────────────────────
async function loadMenu() {
  try {
    const data = await api('/menu');
    state.menuData = data.categories.flatMap(c => c.products);
    renderMenuGrid(state.menuData);
    populateCategoryFilter(data.categories);
  } catch (e) {
    document.getElementById('menu-grid').innerHTML =
      '<p style="color:var(--color-error);font-size:var(--text-sm)">' + e.message + '</p>';
  }
}

function populateCategoryFilter(categories) {
  const sel = document.getElementById('category-filter');
  categories.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.slug;
    opt.textContent = c.name;
    sel.appendChild(opt);
  });
}

function renderMenuGrid(products) {
  const grid = document.getElementById('menu-grid');
  if (!products.length) {
    grid.innerHTML = '<div class="cart-empty"><p style="font-size:var(--text-sm)">No dishes found</p></div>';
    return;
  }
  grid.innerHTML = products.map(function(p) { return productCard(p, null); }).join('');
  lucide.createIcons();
}

function productCard(p, score) {
  const price = p.price != null ? parseFloat(p.price).toFixed(2) + ' \u20BD' : '\u2014';
  const stars = p.rating
    ? '\u2605'.repeat(Math.round(p.rating)) + '\u2606'.repeat(5 - Math.round(p.rating))
    : '';
  const scoreBar = score != null
    ? '<div class="score-bar"><div class="score-bar-fill" style="width:' +
      Math.min(100, score * 100) + '%"></div></div>'
    : '';
  const dataP = escAttr(JSON.stringify(p));
  return [
    '<div class="card" onclick="openProduct(' + dataP + ')">',
      '<div class="card-header">',
        '<span class="card-title">' + esc(p.name || 'Unnamed') + '</span>',
        '<span class="card-price">' + price + '</span>',
      '</div>',
      p.category_slug ? '<span class="card-badge">' + esc(p.category_slug) + '</span>' : '',
      p.description   ? '<p class="card-desc">' + esc(p.description) + '</p>' : '',
      stars ? '<div class="card-rating">' + stars + ' <span style="color:var(--color-text-faint)">' +
        (p.rating ? p.rating.toFixed(1) : '') + '</span></div>' : '',
      scoreBar,
      '<div class="card-actions">',
        '<button class="btn btn-primary btn-sm" onclick="event.stopPropagation();quickAdd(' + dataP + ')">',
          '<i data-lucide="plus" width="12" height="12"></i> Add',
        '</button>',
      '</div>',
    '</div>',
  ].join('');
}

function debounceSearch(q) {
  clearTimeout(state.searchTimer);
  state.searchTimer = setTimeout(function() { searchMenu(q); }, 350);
}

async function searchMenu(q) {
  if (!q.trim()) { renderMenuGrid(state.menuData); return; }
  try {
    const results = await api('/menu/search?q=' + encodeURIComponent(q) + '&limit=40');
    renderMenuGrid(results);
  } catch {
    const lq = q.toLowerCase();
    renderMenuGrid(state.menuData.filter(p => (p.name || '').toLowerCase().includes(lq)));
  }
}

function filterByCategory(slug) {
  if (!slug) { renderMenuGrid(state.menuData); return; }
  renderMenuGrid(state.menuData.filter(p => p.category_slug === slug || p.section_slug === slug));
}

// ── Product Modal ─────────────────────────────────────────────────────────────
let selectedMod = null;

function openProduct(p) {
  selectedMod = null;
  const price = p.price != null ? parseFloat(p.price).toFixed(2) + ' \u20BD' : '\u2014';

  let modsHTML = '';
  if (p.modifications && p.modifications.length) {
    modsHTML = '<div class="modifications"><h4>Modifications</h4>' +
      p.modifications.map(function(m, i) {
        const mdata = escAttr(JSON.stringify(p.modifications));
        return '<label class="mod-option" id="mod-opt-' + i + '">' +
          '<input type="radio" name="modification" value="' + i + '" onchange="selectMod(' + mdata + ',' + i + ')" />' +
          '<span style="flex:1">' + esc(m.name || m.modification_name || 'Option ' + (i + 1)) + '</span>' +
          (m.price ? '<span class="mod-price">' + parseFloat(m.price).toFixed(2) + ' \u20BD</span>' : '') +
          '</label>';
      }).join('') +
      '</div>';
  }

  let nutritionHTML = '';
  if (p.nutrition) {
    nutritionHTML = '<div class="modal-meta-grid">' +
      Object.entries(p.nutrition).map(function(kv) {
        return '<div class="modal-meta-item">' +
          '<span class="modal-meta-key">' + esc(kv[0]) + '</span>' +
          '<span class="modal-meta-val">' + esc(String(kv[1])) + '</span>' +
          '</div>';
      }).join('') +
      '</div>';
  }

  const dataP = escAttr(JSON.stringify(p));
  document.getElementById('modal-content').innerHTML = [
    '<h2>' + esc(p.name || 'Product') + '</h2>',
    '<div class="modal-price">' + price + '</div>',
    p.description ? '<p class="modal-desc">' + esc(p.description) + '</p>' : '',
    p.weight ? '<p style="font-size:var(--text-xs);color:var(--color-text-muted);margin-bottom:var(--space-3)">' + p.weight + '\u0433</p>' : '',
    modsHTML,
    nutritionHTML,
    '<button class="btn btn-primary btn-full" onclick="addToCartFromModal(' + dataP + ')">',
      '<i data-lucide="shopping-cart" width="14" height="14"></i> Add to Cart',
    '</button>',
  ].join('');

  document.getElementById('modal-backdrop').style.display = 'flex';
  lucide.createIcons();
}

function selectMod(mods, idx) {
  selectedMod = mods[idx];
  document.querySelectorAll('.mod-option').forEach(function(el, i) {
    el.classList.toggle('selected', i === idx);
  });
}

function closeModal() {
  document.getElementById('modal-backdrop').style.display = 'none';
}

function addToCartFromModal(p) {
  addToLocalCart(p, selectedMod);
  closeModal();
}

function quickAdd(p) { addToLocalCart(p, null); }

// ── Cart ──────────────────────────────────────────────────────────────────────
function addToLocalCart(p, mod) {
  const pid = String(p.id);
  const modId = (mod && mod.id) ? mod.id : null;
  const existing = state.cartItems.find(function(i) {
    return i.product_id === pid && i.modification_id === modId;
  });
  if (existing) {
    existing.quantity += 1;
  } else {
    state.cartItems.push({
      product_id: pid,
      name: p.name || 'Product',
      price: parseFloat(p.price || 0),
      quantity: 1,
      modification_id: modId,
      modification_name: mod ? (mod.name || mod.modification_name || null) : null,
    });
  }
  updateCartBadge();
  toast((p.name || 'Item') + ' added to cart', 'success');

  if (state.token) {
    api('/users/me/cart', {
      method: 'POST',
      body: JSON.stringify({
        product_id: pid,
        name: p.name || 'Product',
        price: parseFloat(p.price || 0),
        quantity: 1,
        modification_id: modId,
        modification_name: mod ? (mod.name || mod.modification_name || null) : null,
      }),
    }).catch(function() {});
  }
}

function updateCartBadge() {
  const total = state.cartItems.reduce(function(s, i) { return s + i.quantity; }, 0);
  const badge = document.getElementById('cart-badge');
  badge.style.display = total > 0 ? 'inline-flex' : 'none';
  badge.textContent = String(total);
}

async function renderCart() {
  const el = document.getElementById('cart-content');
  if (state.token) {
    try {
      const data = await api('/users/me/cart');
      state.cartItems = data.items;
      updateCartBadge();
    } catch {}
  }

  if (!state.cartItems.length) {
    el.innerHTML = [
      '<div class="cart-empty">',
        '<svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="margin:0 auto var(--space-4);opacity:.25">',
          '<path d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2 9m5-9v9m4-9v9m5-9-2 9"/>',
        '</svg>',
        '<p style="font-size:var(--text-sm)">Your cart is empty</p>',
        '<button class="btn btn-primary" style="margin-top:var(--space-4)" onclick="switchView(\'menu\')">Browse Menu</button>',
      '</div>',
    ].join('');
    return;
  }

  const total = state.cartItems.reduce(function(s, i) { return s + i.price * i.quantity; }, 0);
  el.innerHTML = [
    '<div style="max-width:600px">',
    state.cartItems.map(function(item, idx) {
      return [
        '<div class="cart-item">',
          '<div style="flex:1">',
            '<div class="cart-item-name">' + esc(item.name) + '</div>',
            item.modification_name
              ? '<div class="cart-item-mod">' + esc(item.modification_name) + '</div>'
              : '',
          '</div>',
          '<div class="cart-item-qty">',
            '<button class="qty-btn" onclick="changeQty(' + idx + ',-1)">\u2212</button>',
            '<span class="qty-num">' + item.quantity + '</span>',
            '<button class="qty-btn" onclick="changeQty(' + idx + ',1)">+</button>',
          '</div>',
          '<div class="cart-item-price">' + (item.price * item.quantity).toFixed(2) + ' \u20BD</div>',
        '</div>',
      ].join('');
    }).join(''),
    '<div class="cart-footer">',
      '<span class="cart-total">' + total.toFixed(2) + ' \u20BD</span>',
      '<div style="display:flex;gap:var(--space-2)">',
        '<button class="btn btn-secondary btn-sm" onclick="clearCart()">Clear</button>',
        '<button class="btn btn-primary" onclick="toast(\'Order placed! (demo)\',\'success\')">',
          '<i data-lucide="check" width="14" height="14"></i> Place Order',
        '</button>',
      '</div>',
    '</div>',
    '</div>',
  ].join('');
  lucide.createIcons();
}

async function changeQty(idx, delta) {
  const item = state.cartItems[idx];
  if (!item) return;
  const newQty = item.quantity + delta;
  if (newQty <= 0) {
    state.cartItems.splice(idx, 1);
  } else {
    item.quantity = newQty;
  }
  updateCartBadge();
  renderCart();
  if (state.token) {
    try {
      await api('/users/me/cart', {
        method: 'PUT',
        body: JSON.stringify({
          product_id: item.product_id,
          modification_id: item.modification_id || null,
          quantity: Math.max(0, newQty),
        }),
      });
    } catch {}
  }
}

async function clearCart() {
  state.cartItems = [];
  updateCartBadge();
  renderCart();
  if (state.token) {
    try { await api('/users/me/cart', { method: 'DELETE' }); } catch {}
  }
}

// ── Recommendations ───────────────────────────────────────────────────────────
async function loadRecommendations() {
  const warn     = document.getElementById('rec-auth-warn');
  const controls = document.getElementById('rec-controls');
  const grid     = document.getElementById('rec-grid');

  if (!state.token) {
    warn.style.display = 'flex';
    controls.style.display = 'none';
    grid.innerHTML = '';
    return;
  }
  warn.style.display = 'none';
  controls.style.display = 'flex';

  const topNEl = document.getElementById('top-n-input');
  const topN = parseInt(topNEl ? topNEl.value : '10', 10) || 10;
  const skels = [];
  for (let i = 0; i < topN; i++) skels.push('<div class="skeleton skeleton-card"></div>');
  grid.innerHTML = '<div class="skeleton-grid">' + skels.join('') + '</div>';

  try {
    const data = await api('/recommendations/me?top_n=' + topN);
    const coldBadge = document.getElementById('cold-start-badge');
    coldBadge.style.display = data.is_cold_start ? 'inline-flex' : 'none';

    if (!data.recommendations.length) {
      grid.innerHTML = '<p style="color:var(--color-text-muted);font-size:var(--text-sm)">No recommendations yet. Place some orders first!</p>';
      return;
    }

    const scores = data.recommendations.map(function(r) { return r.score; });
    const maxScore = Math.max.apply(null, scores.concat([1]));
    grid.innerHTML = data.recommendations.map(function(r) {
      const p = {
        id: r.product_id, name: r.name,
        price: r.price, category_slug: r.category_slug,
      };
      return productCard(p, r.score / maxScore);
    }).join('');
    lucide.createIcons();
  } catch (e) {
    grid.innerHTML = '<p style="color:var(--color-error);font-size:var(--text-sm)">' + e.message + '</p>';
  }
}

// ── Profile ───────────────────────────────────────────────────────────────────
async function renderProfile() {
  const el = document.getElementById('profile-content');
  if (!state.token || !state.user) {
    el.innerHTML = [
      '<div class="info-box">',
        '<i data-lucide="user" width="16" height="16"></i>',
        ' You are not logged in. ',
        '<button class="btn btn-sm" onclick="switchView(\'auth\')">Login</button>',
      '</div>',
    ].join('');
    lucide.createIcons();
    return;
  }

  try {
    const u = await api('/users/me');
    state.user = u;

    const addrHTML = u.addresses.length
      ? u.addresses.map(function(a, i) {
          return [
            '<div class="address-item">',
              '<div>',
                '<div class="address-text">' + esc(a.street) + ', ' + esc(a.city) +
                  (a.zip_code ? ', ' + esc(a.zip_code) : '') + '</div>',
                a.notes ? '<div class="address-notes">' + esc(a.notes) + '</div>' : '',
              '</div>',
              '<button class="btn btn-danger btn-sm" onclick="deleteAddress(' + i + ')">',
                '<i data-lucide="trash-2" width="12" height="12"></i>',
              '</button>',
            '</div>',
          ].join('');
        }).join('')
      : '<p style="font-size:var(--text-xs);color:var(--color-text-faint)">No addresses saved.</p>';

    const personaSel = function(v) {
      return [
        '<select class="input select-input" id="upd-persona">',
          '<option value="">— none —</option>',
          ['pizzalover:🍕 Pizza Lover', 'sushilover:🍣 Sushi Lover',
           'balanced:🥗 Balanced', 'partymaker:🎉 Party Maker'].map(function(s) {
            const parts = s.split(':');
            const sel = u.persona === parts[0] ? ' selected' : '';
            return '<option value="' + parts[0] + '"' + sel + '>' + parts[1] + '</option>';
          }).join(''),
        '</select>',
      ].join('');
    };

    el.innerHTML = [
      '<div class="profile-grid">',

        // Account card
        '<div class="profile-card">',
          '<h3>Account</h3>',
          pRow('Username', u.username),
          pRow('Email', u.email),
          pRow('Full Name', u.full_name || '\u2014'),
          pRow('Phone', u.phone || '\u2014'),
          pRow('Role', u.is_admin ? '\uD83D\uDC51 Admin' : 'User'),
          u.persona
            ? '<div class="profile-field"><span class="profile-key">Persona</span>' +
              '<span class="persona-chip">' + esc(u.persona) + '</span></div>'
            : '',
        '</div>',

        // Addresses card
        '<div class="profile-card">',
          '<h3>Addresses ',
            '<button class="btn btn-ghost btn-sm" onclick="toggleAddressForm()" style="float:right">',
              '<i data-lucide="plus" width="12" height="12"></i> Add',
            '</button>',
          '</h3>',
          '<div class="address-list" id="address-list">' + addrHTML + '</div>',
          '<div class="add-address-form" id="add-address-form">',
            '<div class="form-row">',
              '<div class="field"><label class="label">Street</label><input class="input" id="addr-street" /></div>',
              '<div class="field"><label class="label">City</label><input class="input" id="addr-city" /></div>',
            '</div>',
            '<div class="form-row">',
              '<div class="field"><label class="label">ZIP</label><input class="input" id="addr-zip" /></div>',
              '<div class="field"><label class="label">Notes</label><input class="input" id="addr-notes" /></div>',
            '</div>',
            '<button class="btn btn-primary btn-sm" onclick="addAddress()">Save Address</button>',
          '</div>',
        '</div>',

        // Update profile card
        '<div class="profile-card" style="grid-column:1/-1">',
          '<h3>Update Profile</h3>',
          '<div class="form-row">',
            '<div class="field"><label class="label">Full Name</label>',
              '<input class="input" id="upd-fullname" value="' + escAttr(u.full_name || '') + '" /></div>',
            '<div class="field"><label class="label">Phone</label>',
              '<input class="input" id="upd-phone" value="' + escAttr(u.phone || '') + '" /></div>',
          '</div>',
          '<div class="field"><label class="label">Persona</label>' + personaSel() + '</div>',
          '<div style="display:flex;gap:var(--space-2)">',
            '<button class="btn btn-primary btn-sm" onclick="updateProfile()">Save Changes</button>',
            '<button class="btn btn-danger btn-sm" onclick="logout()" style="margin-left:auto">',
              '<i data-lucide="log-out" width="12" height="12"></i> Logout',
            '</button>',
          '</div>',
        '</div>',

      '</div>',
    ].join('');
    lucide.createIcons();
  } catch (e) {
    el.innerHTML = '<p style="color:var(--color-error)">' + e.message + '</p>';
  }
}

function pRow(key, val) {
  return '<div class="profile-field"><span class="profile-key">' + esc(key) +
    '</span><span class="profile-val">' + esc(String(val)) + '</span></div>';
}

function toggleAddressForm() {
  document.getElementById('add-address-form').classList.toggle('open');
}

async function addAddress() {
  const street = (document.getElementById('addr-street').value || '').trim();
  const city   = (document.getElementById('addr-city').value || '').trim();
  if (!street || !city) { toast('Street and city are required', 'error'); return; }
  try {
    await api('/users/me/addresses', {
      method: 'POST',
      body: JSON.stringify({
        street: street,
        city: city,
        zip_code: document.getElementById('addr-zip').value || null,
        notes:    document.getElementById('addr-notes').value || null,
      }),
    });
    toast('Address added', 'success');
    renderProfile();
  } catch (e) { toast(e.message, 'error'); }
}

async function deleteAddress(idx) {
  try {
    await api('/users/me/addresses/' + idx, { method: 'DELETE' });
    toast('Address removed', 'success');
    renderProfile();
  } catch (e) { toast(e.message, 'error'); }
}

async function updateProfile() {
  const payload = {};
  const fn = (document.getElementById('upd-fullname') || {}).value;
  const ph = (document.getElementById('upd-phone') || {}).value;
  const ps = (document.getElementById('upd-persona') || {}).value;
  if (fn && fn.trim()) payload.full_name = fn.trim();
  if (ph && ph.trim()) payload.phone = ph.trim();
  if (ps !== undefined) payload.persona = ps || null;
  try {
    state.user = await api('/users/me', { method: 'PATCH', body: JSON.stringify(payload) });
    toast('Profile updated', 'success');
    renderProfile();
  } catch (e) { toast(e.message, 'error'); }
}

// ── Auth ──────────────────────────────────────────────────────────────────────
function showAuthTab(tab) {
  document.getElementById('form-login').style.display    = tab === 'login'    ? 'block' : 'none';
  document.getElementById('form-register').style.display = tab === 'register' ? 'block' : 'none';
  document.getElementById('tab-login').classList.toggle('active', tab === 'login');
  document.getElementById('tab-register').classList.toggle('active', tab === 'register');
}

async function handleLogin(e) {
  e.preventDefault();
  const btn = document.getElementById('btn-login');
  const err = document.getElementById('login-error');
  btn.disabled = true;
  btn.textContent = 'Logging in\u2026';
  err.textContent = '';
  try {
    const data = await api('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        username: document.getElementById('login-username').value,
        password: document.getElementById('login-password').value,
      }),
    });
    onLogin(data);
  } catch (ex) {
    err.textContent = ex.message;
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i data-lucide="log-in" width="14" height="14"></i> Login';
    lucide.createIcons();
  }
}

async function handleRegister(e) {
  e.preventDefault();
  const btn = document.getElementById('btn-register');
  const err = document.getElementById('register-error');
  btn.disabled = true;
  btn.textContent = 'Creating account\u2026';
  err.textContent = '';
  try {
    const data = await api('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        username:  document.getElementById('reg-username').value,
        email:     document.getElementById('reg-email').value,
        password:  document.getElementById('reg-password').value,
        full_name: document.getElementById('reg-fullname').value || null,
        phone:     document.getElementById('reg-phone').value || null,
      }),
    });
    onLogin(data);
    toast('Account created!', 'success');
  } catch (ex) {
    err.textContent = ex.message;
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i data-lucide="user-plus" width="14" height="14"></i> Create Account';
    lucide.createIcons();
  }
}

function onLogin(payload) {
  state.token = payload.tokens.access_token;
  state.refreshToken = payload.tokens.refresh_token;
  state.user = payload.user;

  document.getElementById('nav-auth').style.display = 'none';
  document.getElementById('nav-profile').style.display = 'flex';
  if (payload.user.is_admin) {
    document.getElementById('nav-admin-section').style.display = 'block';
  }
  const chip = document.getElementById('user-chip');
  chip.style.display = 'flex';
  document.getElementById('user-chip-name').textContent = payload.user.username;
  lucide.createIcons();

  toast('Welcome, ' + payload.user.username + '!', 'success');
  switchView('menu');
}

function logout() {
  state.token = null;
  state.refreshToken = null;
  state.user = null;
  state.cartItems = [];
  updateCartBadge();
  document.getElementById('nav-auth').style.display = 'flex';
  document.getElementById('nav-profile').style.display = 'flex';
  document.getElementById('nav-admin-section').style.display = 'none';
  document.getElementById('user-chip').style.display = 'none';
  toast('Logged out', 'info');
  switchView('menu');
}

// ── Admin ─────────────────────────────────────────────────────────────────────
async function trainModel() {
  const statusEl = document.getElementById('train-status');
  statusEl.innerHTML = '<span style="color:var(--color-text-muted);font-size:var(--text-xs)">Starting training\u2026</span>';
  try {
    const res = await api('/recommendations/train', { method: 'POST' });
    statusEl.innerHTML = '<span style="color:var(--color-success);font-size:var(--text-xs)">\u2713 ' + res.message + '</span>';
    toast('Model training started in background', 'success');
  } catch (e) {
    statusEl.innerHTML = '<span style="color:var(--color-error);font-size:var(--text-xs)">' + e.message + '</span>';
    toast(e.message, 'error');
  }
}

// ── Utils ─────────────────────────────────────────────────────────────────────
function esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escAttr(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
