const BASE_URL = 'http://localhost:8000/api/v1';

const state = {
  token: null,
  refreshToken: null,
  user: null,
  menuData: [],
  cartItems: [],
  searchTimer: null,
  currentView: 'menu',
};

document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  lucide.createIcons();
  checkHealth();
  loadMenu();
  setInterval(checkHealth, 30000);
});

function initTheme() {
  const root = document.documentElement;

  // Светлая тема по умолчанию
  root.setAttribute('data-theme', 'light');

  document.querySelectorAll('[data-theme-toggle]').forEach(btn => {
    btn.addEventListener('click', () => {
      const next =
        root.getAttribute('data-theme') === 'dark'
          ? 'light'
          : 'dark';

      root.setAttribute('data-theme', next);

      lucide.createIcons();
    });
  });
}

async function checkHealth() {
  const dot = document.getElementById('status-dot');
  const text = document.getElementById('status-text');
  try {
    const r = await fetch(BASE_URL.replace('/api/v1', '') + '/health');
    if (r.ok) {
      dot.className = 'status-dot ok';
      text.textContent = 'API онлайн';
    } else {
      throw new Error();
    }
  } catch {
    dot.className = 'status-dot err';
    text.textContent = 'API недоступен';
  }
}

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
      throw new Error('Сессия истекла. Войдите снова.');
    }
  }

  if (!res.ok) {
    let msg = 'Ошибка ' + res.status;
    try {
      const e = await res.json();
      msg = e.detail || msg;
    } catch { }
    throw new Error(msg);
  }

  return res.json();
}

const VIEW_TITLES = {
  menu: 'Меню',
  cart: 'Корзина',
  profile: 'Профиль',
  auth: 'Вход',
  admin: 'Админка',
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

  if (name === 'cart') renderCartWithRecommendations();
  if (name === 'profile') renderProfile();

  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebar-overlay').classList.remove('visible');
}

function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('sidebar-overlay').classList.toggle('visible');
}

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
    grid.innerHTML = '<div class="cart-empty"><p style="font-size:var(--text-sm)">Блюда не найдены</p></div>';
    return;
  }
  grid.innerHTML = products.map(function (p) { return productCard(p, null); }).join('');
  lucide.createIcons();
}

const categoryImages = {
  pizza: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=900&q=80',
  burger: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=900&q=80',
  burgers: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=900&q=80',
  sushi: 'https://images.unsplash.com/photo-1579871494447-9811cf80d66c?auto=format&fit=crop&w=900&q=80',
  salad: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=900&q=80',
  salads: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=900&q=80',
  dessert: 'https://images.unsplash.com/photo-1551024601-bec78aea704b?auto=format&fit=crop&w=900&q=80',
  desserts: 'https://images.unsplash.com/photo-1551024601-bec78aea704b?auto=format&fit=crop&w=900&q=80',
  drink: 'https://images.unsplash.com/photo-1544145945-f90425340c7e?auto=format&fit=crop&w=900&q=80',
  drinks: 'https://images.unsplash.com/photo-1544145945-f90425340c7e?auto=format&fit=crop&w=900&q=80',
  default: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=900&q=80'
};

function getCategoryImage(p) {
  const raw = String(p.category_slug || p.section_slug || p.category || '').toLowerCase();
  return categoryImages[raw] || categoryImages.default;
}

function productCard(p, score) {
  const price = p.price != null
    ? parseFloat(p.price).toFixed(2) + ' ₽'
    : '—';

  const stars = p.rating
    ? '★'.repeat(Math.round(p.rating)) +
    '☆'.repeat(5 - Math.round(p.rating))
    : '';

  const scoreBar = score != null
    ? '<div class="score-bar"><div class="score-bar-fill" style="width:' +
    Math.min(100, score * 100) + '%"></div></div>'
    : '';

  const dataP = escAttr(JSON.stringify(p));

  // ВАЖНО
  const img = p.image || getCategoryImage(p);

  return [
    '<div class="card product-card" onclick="openProduct(' + dataP + ')">',

    '<div class="card-image-wrap">',
    '<img class="card-image" ' +
    'src="' + escAttr(img) + '" ' +
    'alt="' + escAttr(p.name || 'Товар') + '" ' +
    'loading="lazy">',
    '</div>',

    '<div class="card-body">',

    '<div class="card-header">',
    '<span class="card-title">' + esc(p.name || 'Без названия') + '</span>',
    '<span class="card-price">' + price + '</span>',
    '</div>',

    p.category_slug
      ? '<span class="card-badge">' + esc(p.category_slug) + '</span>'
      : '',

    p.description
      ? '<p class="card-desc">' + esc(p.description) + '</p>'
      : '',

    stars
      ? '<div class="card-rating">' + stars +
      ' <span style="color:var(--color-text-faint)">' +
      (p.rating ? p.rating.toFixed(1) : '') +
      '</span></div>'
      : '',

    scoreBar,

    '<div class="card-actions">',
    '<button class="btn btn-primary btn-sm" onclick="event.stopPropagation();quickAdd(' + dataP + ')">',
    '<i data-lucide="plus" width="12" height="12"></i>',
    'Добавить',
    '</button>',
    '</div>',

    '</div>',
    '</div>',
  ].join('');
}
function debounceSearch(q) {
  clearTimeout(state.searchTimer);
  state.searchTimer = setTimeout(function () { searchMenu(q); }, 350);
}

async function searchMenu(q) {
  if (!q.trim()) {
    renderMenuGrid(state.menuData);
    return;
  }
  try {
    const results = await api('/menu/search?q=' + encodeURIComponent(q) + '&limit=40');
    renderMenuGrid(results);
  } catch {
    const lq = q.toLowerCase();
    renderMenuGrid(state.menuData.filter(p => (p.name || '').toLowerCase().includes(lq)));
  }
}

function filterByCategory(slug) {
  if (!slug) {
    renderMenuGrid(state.menuData);
    return;
  }
  renderMenuGrid(state.menuData.filter(p => p.category_slug === slug || p.section_slug === slug));
}

let selectedMod = null;

function openProduct(p) {
  selectedMod = null;
  const price = p.price != null ? parseFloat(p.price).toFixed(2) + ' ₽' : '—';

  let modsHTML = '';
  if (p.modifications && p.modifications.length) {
    modsHTML = '<div class="modifications"><h4>Варианты</h4>' +
      p.modifications.map(function (m, i) {
        const mdata = escAttr(JSON.stringify(p.modifications));
        return '<label class="mod-option" id="mod-opt-' + i + '">' +
          '<input type="radio" name="modification" value="' + i + '" onchange="selectMod(' + mdata + ',' + i + ')" />' +
          '<span style="flex:1">' + esc(m.name || m.modification_name || 'Вариант ' + (i + 1)) + '</span>' +
          (m.price ? '<span class="mod-price">' + parseFloat(m.price).toFixed(2) + ' ₽</span>' : '') +
          '</label>';
      }).join('') +
      '</div>';
  }

  let nutritionHTML = '';
  if (p.nutrition) {
    nutritionHTML = '<div class="modal-meta-grid">' +
      Object.entries(p.nutrition).map(function (kv) {
        return '<div class="modal-meta-item">' +
          '<span class="modal-meta-key">' + esc(kv[0]) + '</span>' +
          '<span class="modal-meta-val">' + esc(String(kv[1])) + '</span>' +
          '</div>';
      }).join('') +
      '</div>';
  }

  const dataP = escAttr(JSON.stringify(p));
  document.getElementById('modal-content').innerHTML = [
    '<h2>' + esc(p.name || 'Товар') + '</h2>',
    '<div class="modal-price">' + price + '</div>',
    p.description ? '<p class="modal-desc">' + esc(p.description) + '</p>' : '',
    p.weight ? '<p style="font-size:var(--text-xs);color:var(--color-text-muted);margin-bottom:var(--space-3)">' + p.weight + 'г</p>' : '',
    modsHTML,
    nutritionHTML,
    '<button class="btn btn-primary btn-full" onclick="addToCartFromModal(' + dataP + ')">',
    '<i data-lucide="shopping-cart" width="14" height="14"></i> Добавить в корзину',
    '</button>',
  ].join('');

  document.getElementById('modal-backdrop').style.display = 'flex';
  lucide.createIcons();
}

function selectMod(mods, idx) {
  selectedMod = mods[idx];
  document.querySelectorAll('.mod-option').forEach(function (el, i) {
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

function quickAdd(p) {
  addToLocalCart(p, null);
}

function addToLocalCart(p, mod) {
  const pid = String(p.id);
  const modId = (mod && mod.id) ? mod.id : null;
  const existing = state.cartItems.find(function (i) {
    return i.product_id === pid && i.modification_id === modId;
  });

  if (existing) {
    existing.quantity += 1;
  } else {
    state.cartItems.push({
      product_id: pid,
      name: p.name || 'Товар',
      price: parseFloat(p.price || 0),
      quantity: 1,
      modification_id: modId,
      modification_name: mod ? (mod.name || mod.modification_name || null) : null,
    });
  }

  updateCartBadge();
  toast((p.name || 'Товар') + ' добавлен в корзину', 'success');

  if (state.token) {
    api('/users/me/cart', {
      method: 'POST',
      body: JSON.stringify({
        product_id: pid,
        name: p.name || 'Товар',
        price: parseFloat(p.price || 0),
        quantity: 1,
        modification_id: modId,
        modification_name: mod ? (mod.name || mod.modification_name || null) : null,
      }),
    }).catch(function () { });
  }
}

function updateCartBadge() {
  const total = state.cartItems.reduce(function (s, i) { return s + i.quantity; }, 0);
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
    } catch { }
  }

  if (!state.cartItems.length) {
    el.innerHTML = [
      '<div class="cart-empty">',
      '<svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="margin:0 auto var(--space-4);opacity:.25">',
      '<path d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2 9m5-9v9m4-9v9m5-9-2 9"/>',
      '</svg>',
      '<p style="font-size:var(--text-sm)">Корзина пуста</p>',
      '<button class="btn btn-primary" style="margin-top:var(--space-4)" onclick="switchView(\'menu\')">Перейти в меню</button>',
      '</div>',
    ].join('');
    return;
  }

  const total = state.cartItems.reduce(function (s, i) { return s + i.price * i.quantity; }, 0);
  el.innerHTML = [
    '<div style="max-width:600px">',
    state.cartItems.map(function (item, idx) {
      return [
        '<div class="cart-item">',
        '<div style="flex:1">',
        '<div class="cart-item-name">' + esc(item.name) + '</div>',
        item.modification_name
          ? '<div class="cart-item-mod">' + esc(item.modification_name) + '</div>'
          : '',
        '</div>',
        '<div class="cart-item-qty">',
        '<button class="qty-btn" onclick="changeQty(' + idx + ',-1)">−</button>',
        '<span class="qty-num">' + item.quantity + '</span>',
        '<button class="qty-btn" onclick="changeQty(' + idx + ',1)">+</button>',
        '</div>',
        '<div class="cart-item-price">' + (item.price * item.quantity).toFixed(2) + ' ₽</div>',
        '</div>',
      ].join('');
    }).join(''),
    '<div class="cart-footer">',
    '<span class="cart-total">' + total.toFixed(2) + ' ₽</span>',
    '<div style="display:flex;gap:var(--space-2)">',
    '<button class="btn btn-secondary btn-sm" onclick="clearCart()">Очистить</button>',
    '<button class="btn btn-primary" onclick="toast(\'Заказ оформлен! (демо)\',\'success\')">',
    '<i data-lucide="check" width="14" height="14"></i> Оформить заказ',
    '</button>',
    '</div>',
    '</div>',
    '</div>',
  ].join('');
  lucide.createIcons();
}

async function renderCartWithRecommendations() {
  await renderCart();
  await loadCartRecommendations();
}

async function loadCartRecommendations() {
  const box = document.getElementById('cart-recommendations');
  const grid = document.getElementById('cart-rec-grid');
  if (!box || !grid) return;

  if (!state.token) {
    box.style.display = 'none';
    grid.innerHTML = '';
    return;
  }

  box.style.display = 'block';
  grid.innerHTML = '<div class="skeleton-grid"><div class="skeleton skeleton-card"></div><div class="skeleton skeleton-card"></div></div>';

  try {
    const topN = 10;
    const data = await api('/recommendations/me?top_n=' + topN);

    if (!data.recommendations || !data.recommendations.length) {
      grid.innerHTML = '<p style="color:var(--color-text-muted);font-size:var(--text-sm)">Пока нет рекомендаций. Добавьте несколько заказов.</p>';
      return;
    }

    const scores = data.recommendations.map(r => r.score || 0);
    const maxScore = Math.max(...scores, 1);

    grid.innerHTML = data.recommendations.map(r => {
      const fullProduct = state.menuData.find(x => String(x.id) === String(r.product_id));

      const p = {
        id: r.product_id,
        name: r.name,
        price: r.price,
        category_slug: r.category_slug,
        description: r.description || '',
        rating: r.rating || null,
        image: fullProduct?.image, // 👈 берём из БД меню
      };
      return productCard(p, (r.score || 0) / maxScore);
    }).join('');

    lucide.createIcons();
  } catch (e) {
    grid.innerHTML = '<p style="color:var(--color-error);font-size:var(--text-sm)">' + e.message + '</p>';
  }
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
  await renderCartWithRecommendations();

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
    } catch { }
  }
}

async function clearCart() {
  state.cartItems = [];
  updateCartBadge();
  await renderCartWithRecommendations();
  if (state.token) {
    try {
      await api('/users/me/cart', { method: 'DELETE' });
    } catch { }
  }
}

async function renderProfile() {
  const el = document.getElementById('profile-content');
  if (!state.token || !state.user) {
    el.innerHTML = [
      '<div class="info-box">',
      '<i data-lucide="user" width="16" height="16"></i>',
      ' Вы не вошли в систему. ',
      '<button class="btn btn-sm" onclick="switchView(\'auth\')">Войти</button>',
      '</div>',
    ].join('');
    lucide.createIcons();
    return;
  }

  try {
    const u = await api('/users/me');
    state.user = u;

    const addrHTML = u.addresses.length
      ? u.addresses.map(function (a, i) {
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
      : '<p style="font-size:var(--text-xs);color:var(--color-text-faint)">Адресов пока нет.</p>';

    const personaSel = function () {
      return [
        '<select class="input select-input" id="upd-persona">',
        '<option value="">— нет —</option>',
        ['pizzalover:🍕 Любитель пиццы', 'sushilover:🍣 Любитель суши',
          'balanced:🥗 Сбалансированный', 'partymaker:🎉 Любитель вечеринок'].map(function (s) {
            const parts = s.split(':');
            const sel = u.persona === parts[0] ? ' selected' : '';
            return '<option value="' + parts[0] + '"' + sel + '>' + parts[1] + '</option>';
          }).join(''),
        '</select>',
      ].join('');
    };

    el.innerHTML = [
      '<div class="profile-grid">',

      '<div class="profile-card">',
      '<h3>Аккаунт</h3>',
      pRow('Логин', u.username),
      pRow('Email', u.email),
      pRow('Имя', u.full_name || '—'),
      pRow('Телефон', u.phone || '—'),
      pRow('Роль', u.is_admin ? '👑 Админ' : 'Пользователь'),
      u.persona
        ? '<div class="profile-field"><span class="profile-key">Персона</span>' +
        '<span class="persona-chip">' + esc(u.persona) + '</span></div>'
        : '',
      '</div>',

      '<div class="profile-card">',
      '<h3>Адреса ' +
      '<button class="btn btn-ghost btn-sm" onclick="toggleAddressForm()" style="float:right">' +
      '<i data-lucide="plus" width="12" height="12"></i> Добавить' +
      '</button>' +
      '</h3>',
      '<div class="address-list" id="address-list">' + addrHTML + '</div>',
      '<div class="add-address-form" id="add-address-form">',
      '<div class="form-row">',
      '<div class="field"><label class="label">Улица</label><input class="input" id="addr-street" /></div>',
      '<div class="field"><label class="label">Город</label><input class="input" id="addr-city" /></div>',
      '</div>',
      '<div class="form-row">',
      '<div class="field"><label class="label">Индекс</label><input class="input" id="addr-zip" /></div>',
      '<div class="field"><label class="label">Примечание</label><input class="input" id="addr-notes" /></div>',
      '</div>',
      '<button class="btn btn-primary btn-sm" onclick="addAddress()">Сохранить адрес</button>',
      '</div>',
      '</div>',

      '<div class="profile-card" style="grid-column:1/-1">',
      '<h3>Обновить профиль</h3>',
      '<div class="form-row">',
      '<div class="field"><label class="label">Имя</label>',
      '<input class="input" id="upd-fullname" value="' + escAttr(u.full_name || '') + '" /></div>',
      '<div class="field"><label class="label">Телефон</label>',
      '<input class="input" id="upd-phone" value="' + escAttr(u.phone || '') + '" /></div>',
      '</div>',
      '<div class="field"><label class="label">Персона</label>' + personaSel() + '</div>',
      '<div style="display:flex;gap:var(--space-2)">',
      '<button class="btn btn-primary btn-sm" onclick="updateProfile()">Сохранить изменения</button>',
      '<button class="btn btn-danger btn-sm" onclick="logout()" style="margin-left:auto">',
      '<i data-lucide="log-out" width="12" height="12"></i> Выйти',
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
  const city = (document.getElementById('addr-city').value || '').trim();
  if (!street || !city) {
    toast('Улица и город обязательны', 'error');
    return;
  }
  try {
    await api('/users/me/addresses', {
      method: 'POST',
      body: JSON.stringify({
        street: street,
        city: city,
        zip_code: document.getElementById('addr-zip').value || null,
        notes: document.getElementById('addr-notes').value || null,
      }),
    });
    toast('Адрес добавлен', 'success');
    renderProfile();
  } catch (e) {
    toast(e.message, 'error');
  }
}

async function deleteAddress(idx) {
  try {
    await api('/users/me/addresses/' + idx, { method: 'DELETE' });
    toast('Адрес удалён', 'success');
    renderProfile();
  } catch (e) {
    toast(e.message, 'error');
  }
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
    toast('Профиль обновлён', 'success');
    renderProfile();
  } catch (e) {
    toast(e.message, 'error');
  }
}

function showAuthTab(tab) {
  document.getElementById('form-login').style.display = tab === 'login' ? 'block' : 'none';
  document.getElementById('form-register').style.display = tab === 'register' ? 'block' : 'none';
  document.getElementById('tab-login').classList.toggle('active', tab === 'login');
  document.getElementById('tab-register').classList.toggle('active', tab === 'register');
}

async function handleLogin(e) {
  e.preventDefault();
  const btn = document.getElementById('btn-login');
  const err = document.getElementById('login-error');
  btn.disabled = true;
  btn.textContent = 'Вход…';
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
    btn.innerHTML = '<i data-lucide="log-in" width="14" height="14"></i> Войти';
    lucide.createIcons();
  }
}

async function handleRegister(e) {
  e.preventDefault();
  const btn = document.getElementById('btn-register');
  const err = document.getElementById('register-error');
  btn.disabled = true;
  btn.textContent = 'Создание аккаунта…';
  err.textContent = '';
  try {
    const data = await api('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        username: document.getElementById('reg-username').value,
        email: document.getElementById('reg-email').value,
        password: document.getElementById('reg-password').value,
        full_name: document.getElementById('reg-fullname').value || null,
        phone: document.getElementById('reg-phone').value || null,
      }),
    });
    onLogin(data);
    toast('Аккаунт создан!', 'success');
  } catch (ex) {
    err.textContent = ex.message;
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i data-lucide="user-plus" width="14" height="14"></i> Создать аккаунт';
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

  toast('Добро пожаловать, ' + payload.user.username + '!', 'success');
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
  toast('Вы вышли из аккаунта', 'info');
  switchView('menu');
}

async function trainModel() {
  const statusEl = document.getElementById('train-status');
  statusEl.innerHTML = '<span style="color:var(--color-text-muted);font-size:var(--text-xs)">Запуск обучения…</span>';
  try {
    const res = await api('/recommendations/train', { method: 'POST' });
    statusEl.innerHTML = '<span style="color:var(--color-success);font-size:var(--text-xs)">✓ ' + res.message + '</span>';
    toast('Обучение модели запущено', 'success');
  } catch (e) {
    statusEl.innerHTML = '<span style="color:var(--color-error);font-size:var(--text-xs)">' + e.message + '</span>';
    toast(e.message, 'error');
  }
}

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