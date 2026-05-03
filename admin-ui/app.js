/* ============================================================
 * Serena Bites — Admin SPA
 * Vanilla JS, hash router, fetch wrapper, no build step.
 * ============================================================ */

const root = document.getElementById('root');
const toastEl = document.getElementById('toast');

// ─── Helpers ───────────────────────────────────────────────────
const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));
const h = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content; };

const eur = (cents) => (cents / 100).toFixed(2).replace('.', ',') + ' €';
const fmtDate = (ts) => ts ? new Date(ts).toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' }) : '—';
const fmtDateShort = (ts) => ts ? new Date(ts).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }) : '—';
const escapeHtml = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));

let toastTimer;
function toast(msg, kind = 'ok') {
  toastEl.textContent = msg;
  toastEl.className = 'toast show' + (kind === 'err' ? ' err' : '');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2800);
}

async function api(path, { method = 'GET', body, query } = {}) {
  const url = '/api/admin' + path + (query ? '?' + new URLSearchParams(query) : '');
  const opts = {
    method, credentials: 'same-origin',
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  };
  const res = await fetch(url, opts);
  if (res.status === 401) { state.user = null; route(); throw new Error('Unauthorized'); }
  let data = null;
  try { data = await res.json(); } catch (_) {}
  if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
  return data;
}

// ─── State ─────────────────────────────────────────────────────
const state = {
  user: null,
  page: 'dashboard',
};

// ─── Router ────────────────────────────────────────────────────
const ROUTES = ['dashboard', 'orders', 'products', 'customers', 'users', 'stats', 'settings'];
function navigate(page) {
  state.page = page;
  location.hash = '#/' + page;
  render();
}
function readHash() {
  const m = (location.hash || '').match(/^#\/(\w+)/);
  return m ? m[1] : 'dashboard';
}
window.addEventListener('hashchange', () => { state.page = readHash(); render(); });

// ─── Boot ──────────────────────────────────────────────────────
async function boot() {
  state.page = readHash();
  try {
    const me = await api('/auth/me');
    state.user = me.user;
  } catch (_) { state.user = null; }
  render();
}

function route() { render(); }

function render() {
  if (!state.user) return renderLogin();
  if (!ROUTES.includes(state.page)) state.page = 'dashboard';
  if ((state.page === 'users' || state.page === 'stats') && state.user.role !== 'admin') state.page = 'dashboard';
  renderShell();
}

// ─── LOGIN ─────────────────────────────────────────────────────
function renderLogin() {
  root.innerHTML = `
    <div class="login">
      <div class="login-box">
        <div class="login-mark">sb</div>
        <h1>Acceso al <em>back-office</em></h1>
        <div class="login-sub">Identifícate para continuar.</div>
        <form id="loginForm">
          <div class="field">
            <label class="label" for="loginEmail">Email</label>
            <input class="input" type="email" id="loginEmail" autocomplete="username" required autofocus>
          </div>
          <div class="field">
            <label class="label" for="loginPwd">Contraseña</label>
            <input class="input" type="password" id="loginPwd" autocomplete="current-password" required>
          </div>
          <div class="err" id="loginErr"></div>
          <button class="btn" type="submit" id="loginBtn">Entrar</button>
        </form>
      </div>
    </div>
  `;
  const form = $('#loginForm');
  const err = $('#loginErr');
  form.addEventListener('submit', async e => {
    e.preventDefault();
    err.classList.remove('show');
    const btn = $('#loginBtn');
    btn.disabled = true;
    try {
      const r = await api('/auth/login', { method: 'POST', body: {
        email: $('#loginEmail').value.trim(),
        password: $('#loginPwd').value,
      }});
      state.user = r.user;
      navigate('dashboard');
    } catch (e2) {
      err.textContent = e2.message;
      err.classList.add('show');
    } finally {
      btn.disabled = false;
    }
  });
}

// ─── APP SHELL ─────────────────────────────────────────────────
function renderShell() {
  const isAdmin = state.user.role === 'admin';
  const navItem = (p, label, icon) => `
    <button class="sb-link${state.page === p ? ' active' : ''}" data-go="${p}">
      ${icon}<span>${label}</span>
    </button>`;

  root.innerHTML = `
    <div class="app">
      <aside class="sidebar">
        <div class="sb-brand">
          <div class="sb-mark">sb</div>
          <div class="sb-name">Serena<br><em>Bites.</em></div>
        </div>
        <nav class="sb-nav">
          <div class="sb-section">Operaciones</div>
          ${navItem('dashboard', 'Dashboard', svg('M3 13h8V3H3v10zm10 8h8V11h-8v10zM3 21h8v-6H3v6zm10-18v6h8V3h-8z'))}
          ${navItem('orders', 'Pedidos', svg('M3 7h18l-2 12H5L3 7zm5 0V5a4 4 0 018 0v2'))}
          ${navItem('products', 'Productos', svg('M21 9l-4-7H7L3 9l9 13 9-13zM3 9h18'))}
          ${navItem('customers', 'Clientes', svg('M16 14a4 4 0 100-8 4 4 0 000 8zm-8 7a8 8 0 0116 0H8z'))}
          <div class="sb-section">Finanzas</div>
          ${navItem('settings', 'Cuenta', svg('M12 12a3 3 0 100-6 3 3 0 000 6zm0 9c-3.5 0-6.7-1.7-8.7-4.3.1-2.6 5.8-4 8.7-4s8.6 1.4 8.7 4C18.7 19.3 15.5 21 12 21z'))}
          ${isAdmin ? `
            <div class="sb-section">Solo administrador</div>
            ${navItem('stats', 'Estadísticas', svg('M3 21h18M5 17V9m4 8V5m4 12v-7m4 7V8'))}
            ${navItem('users', 'Usuarios', svg('M9 11a4 4 0 100-8 4 4 0 000 8zm-7 9a7 7 0 0114 0H2zm14-9a3 3 0 100-6m6 15a5 5 0 00-5-5'))}
          ` : ''}
        </nav>
        <div class="sb-foot">
          <div class="sb-user">
            <strong>${escapeHtml(state.user.name)}</strong>
            ${escapeHtml(state.user.email)} · ${state.user.role}
          </div>
          <button class="sb-link" id="logoutBtn">${svg('M16 17l5-5-5-5M21 12H9M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4')}<span>Cerrar sesión</span></button>
        </div>
      </aside>
      <main class="main" id="main"></main>
    </div>
    <div class="detail-overlay" id="detailOverlay"></div>
    <aside class="detail" id="detail"></aside>
  `;

  $$('[data-go]').forEach(el => el.addEventListener('click', () => navigate(el.dataset.go)));
  $('#logoutBtn').addEventListener('click', async () => {
    try { await api('/auth/logout', { method: 'POST' }); } catch (_) {}
    state.user = null; navigate('dashboard');
  });
  $('#detailOverlay').addEventListener('click', closeDetail);

  const main = $('#main');
  switch (state.page) {
    case 'dashboard': return pageDashboard(main);
    case 'orders':    return pageOrders(main);
    case 'products':  return pageProducts(main);
    case 'customers': return pageCustomers(main);
    case 'users':     return pageUsers(main);
    case 'stats':     return pageStats(main);
    case 'settings':  return pageSettings(main);
  }
}

function svg(d) {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="${d}"/></svg>`;
}

// ─── DETAIL PANEL ─────────────────────────────────────────────
function openDetail(html) {
  $('#detail').innerHTML = html;
  $('#detail').classList.add('open');
  $('#detailOverlay').classList.add('open');
  document.body.style.overflow = 'hidden';
  $('#detail .detail-close')?.addEventListener('click', closeDetail);
}
function closeDetail() {
  $('#detail').classList.remove('open');
  $('#detailOverlay').classList.remove('open');
  document.body.style.overflow = '';
}

// ─── PAGE: DASHBOARD ──────────────────────────────────────────
async function pageDashboard(main) {
  main.innerHTML = `
    <div class="page-head">
      <div>
        <div class="page-eyebrow">Resumen</div>
        <h1>Hola, <em>${escapeHtml(state.user.name)}</em>.</h1>
      </div>
    </div>
    <div id="dashContent"><div class="loader"></div></div>
  `;
  try {
    const ordersList = await api('/orders', { query: { status: 'paid', limit: 10 } });
    const preparing  = await api('/orders', { query: { status: 'preparing', limit: 10 } });
    const ready      = await api('/orders', { query: { status: 'ready', limit: 10 } });

    const queue = [...ordersList.orders, ...preparing.orders, ...ready.orders];
    queue.sort((a, b) => a.paid_at - b.paid_at);

    $('#dashContent').innerHTML = `
      <div class="card">
        <div class="page-head" style="margin-bottom:1rem;padding-bottom:0.6rem;">
          <h2 style="font-size:1.4rem;">Pedidos en cola <span class="tag" style="margin-left:0.5rem;">${queue.length}</span></h2>
          <button class="btn ghost sm" data-go="orders">Ver todos →</button>
        </div>
        ${queue.length === 0 ? `
          <div class="empty"><p>No hay pedidos pendientes ahora mismo.</p></div>
        ` : ordersTable(queue)}
      </div>
    `;
    $$('#dashContent [data-go]').forEach(el => el.addEventListener('click', () => navigate(el.dataset.go)));
    bindOrdersTable($('#dashContent'));
  } catch (e) {
    $('#dashContent').innerHTML = `<div class="empty"><p>${escapeHtml(e.message)}</p></div>`;
  }
}

// ─── PAGE: ORDERS ─────────────────────────────────────────────
const STATUSES = [
  { id: '',                 label: 'Todos' },
  { id: 'paid',             label: 'Recibidos' },
  { id: 'preparing',        label: 'Preparando' },
  { id: 'ready',            label: 'Listos' },
  { id: 'out_for_delivery', label: 'En reparto' },
  { id: 'delivered',        label: 'Entregados' },
  { id: 'cancelled',        label: 'Cancelados' },
];

async function pageOrders(main) {
  main.innerHTML = `
    <div class="page-head">
      <div>
        <div class="page-eyebrow">Operaciones</div>
        <h1><em>Pedidos</em></h1>
      </div>
    </div>
    <div class="toolbar">
      <select class="select" id="filterStatus">
        ${STATUSES.map(s => `<option value="${s.id}">${s.label}</option>`).join('')}
      </select>
      <select class="select" id="filterMode">
        <option value="">Todos los modos</option>
        <option value="delivery">A domicilio</option>
        <option value="pickup">Recogida</option>
      </select>
      <input class="input" id="filterQ" type="search" placeholder="Buscar por nombre, teléfono o ID…">
    </div>
    <div id="ordersList"><div class="loader"></div></div>
  `;
  const reload = async () => {
    const query = {};
    if ($('#filterStatus').value) query.status = $('#filterStatus').value;
    if ($('#filterMode').value)   query.mode   = $('#filterMode').value;
    if ($('#filterQ').value.trim()) query.q    = $('#filterQ').value.trim();
    try {
      const data = await api('/orders', { query });
      $('#ordersList').innerHTML = data.orders.length
        ? ordersTable(data.orders)
        : `<div class="empty"><p>Sin pedidos para estos filtros.</p></div>`;
      bindOrdersTable($('#ordersList'));
    } catch (e) {
      $('#ordersList').innerHTML = `<div class="empty"><p>${escapeHtml(e.message)}</p></div>`;
    }
  };
  $('#filterStatus').addEventListener('change', reload);
  $('#filterMode').addEventListener('change', reload);
  let dq;
  $('#filterQ').addEventListener('input', () => { clearTimeout(dq); dq = setTimeout(reload, 250); });
  reload();
}

function ordersTable(orders) {
  return `
    <table class="table">
      <thead><tr>
        <th>#</th><th>Fecha</th><th>Cliente</th><th>Modo</th>
        <th class="num">Total</th><th>Estado</th>
      </tr></thead>
      <tbody>
        ${orders.map(o => `
          <tr class="row-link" data-order="${o.id}">
            <td class="num">#${o.id}</td>
            <td>${fmtDateShort(o.paid_at)} · ${new Date(o.paid_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</td>
            <td>${escapeHtml(o.customer_name)}<br><small style="color:var(--ink-mute);">${escapeHtml(o.customer_phone)}</small></td>
            <td>${o.delivery_mode === 'delivery' ? 'A domicilio' : 'Recogida'}</td>
            <td class="num">${eur(o.total_cents)}</td>
            <td><span class="tag ${o.status}">${statusLabel(o.status)}</span></td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

function statusLabel(s) {
  return ({ paid:'Recibido', preparing:'Preparando', ready:'Listo', out_for_delivery:'En reparto', delivered:'Entregado', cancelled:'Cancelado' })[s] || s;
}

function bindOrdersTable(scope) {
  $$('[data-order]', scope).forEach(tr => tr.addEventListener('click', () => openOrder(parseInt(tr.dataset.order, 10))));
}

const NEXT_STATUS = {
  paid: 'preparing',
  preparing: 'ready',
  ready: { delivery: 'out_for_delivery', pickup: 'delivered' },
  out_for_delivery: 'delivered',
};
const NEXT_LABEL = {
  paid: 'Empezar a preparar',
  preparing: 'Marcar listo',
  ready: 'Salir a reparto / Entregar',
  out_for_delivery: 'Marcar entregado',
};

async function openOrder(id) {
  openDetail(`<div class="detail-head"><h2>Cargando…</h2></div><div class="detail-body"><div class="loader"></div></div>`);
  try {
    const { order, items } = await api('/orders/' + id);
    renderOrderDetail(order, items);
  } catch (e) {
    openDetail(`<div class="detail-head"><h2>Error</h2><button class="detail-close">✕</button></div><div class="detail-body"><p>${escapeHtml(e.message)}</p></div>`);
  }
}

function renderOrderDetail(order, items) {
  const nextRaw = NEXT_STATUS[order.status];
  const next = typeof nextRaw === 'string' ? nextRaw : nextRaw?.[order.delivery_mode];
  const canCancel = order.status !== 'cancelled' && order.status !== 'delivered';

  openDetail(`
    <div class="detail-head">
      <div>
        <div style="font-family:var(--mono);font-size:0.7rem;text-transform:uppercase;letter-spacing:0.14em;color:var(--ink-soft);margin-bottom:0.2rem;">Pedido</div>
        <h2>#${order.id} <span class="tag ${order.status}" style="margin-left:0.4rem;font-size:0.7rem;">${statusLabel(order.status)}</span></h2>
      </div>
      <button class="detail-close">✕</button>
    </div>
    <div class="detail-body">
      <dl class="dl">
        <dt>Cliente</dt><dd>${escapeHtml(order.customer_name)}</dd>
        <dt>Teléfono</dt><dd><a href="tel:${escapeHtml(order.customer_phone)}">${escapeHtml(order.customer_phone)}</a></dd>
        ${order.customer_email ? `<dt>Email</dt><dd><a href="mailto:${escapeHtml(order.customer_email)}">${escapeHtml(order.customer_email)}</a></dd>` : ''}
        <dt>Modo</dt><dd>${order.delivery_mode === 'delivery' ? 'A domicilio' : 'Recogida en barra'}</dd>
        ${order.delivery_mode === 'delivery' ? `
          <dt>Dirección</dt><dd>${escapeHtml(order.delivery_address || '')}<br>${escapeHtml(order.delivery_postcode || '')} ${escapeHtml(order.delivery_city || '')}</dd>
        ` : ''}
        <dt>Pagado</dt><dd>${fmtDate(order.paid_at)}</dd>
        ${order.notes ? `<dt>Notas</dt><dd style="white-space:pre-line;">${escapeHtml(order.notes)}</dd>` : ''}
      </dl>

      <h3 style="font-size:1.1rem;margin-bottom:0.6rem;">Pedido</h3>
      <table class="table" style="font-size:0.88rem;">
        <tbody>
          ${items.map(it => `
            <tr>
              <td>${escapeHtml(it.product_name)}</td>
              <td class="num" style="text-align:center;">×${it.quantity}</td>
              <td class="num" style="text-align:right;">${eur(it.total_cents)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      <div class="totals-box">
        <div class="row"><span>Subtotal</span><span class="num">${eur(order.subtotal_cents)}</span></div>
        ${order.delivery_fee_cents ? `<div class="row"><span>Envío</span><span class="num">${eur(order.delivery_fee_cents)}</span></div>` : ''}
        <div class="row total"><span>Total</span><span class="num">${eur(order.total_cents)}</span></div>
      </div>

      <div class="section-actions">
        ${next ? `<button class="btn" data-status="${next}">${NEXT_LABEL[order.status]}</button>` : ''}
        ${canCancel ? `<button class="btn terra" data-status="cancelled">Cancelar pedido</button>` : ''}
      </div>

      ${order.stripe_session_id ? `<p style="font-size:0.8rem;color:var(--ink-mute);">Stripe: ${escapeHtml(order.stripe_session_id)}</p>` : ''}
    </div>
  `);

  $$('[data-status]').forEach(b => b.addEventListener('click', async () => {
    const status = b.dataset.status;
    if (status === 'cancelled' && !confirm('¿Cancelar este pedido?')) return;
    try {
      await api('/orders/' + order.id, { method: 'PATCH', body: { status } });
      toast('Pedido actualizado');
      closeDetail();
      if (state.page === 'dashboard') pageDashboard($('#main'));
      else if (state.page === 'orders') $('#filterStatus').dispatchEvent(new Event('change'));
    } catch (e) {
      toast(e.message, 'err');
    }
  }));
}

// ─── PAGE: PRODUCTS ───────────────────────────────────────────
const CATEGORIES = [
  { id: 'bowls',  label: 'Pokés & Bowls' },
  { id: 'wraps',  label: 'Wraps & Pitas' },
  { id: 'brunch', label: 'Brunch & Tostadas' },
  { id: 'dulces', label: 'Yogur & Açaí' },
];

async function pageProducts(main) {
  main.innerHTML = `
    <div class="page-head">
      <div>
        <div class="page-eyebrow">Carta</div>
        <h1><em>Productos</em></h1>
      </div>
      <button class="btn" id="btnNewProduct">+ Nuevo producto</button>
    </div>
    <div id="productsList"><div class="loader"></div></div>
  `;
  $('#btnNewProduct').addEventListener('click', () => productForm(null));

  try {
    const { products } = await api('/products');
    if (products.length === 0) {
      $('#productsList').innerHTML = `<div class="empty"><p>Aún no hay productos.</p></div>`;
      return;
    }
    $('#productsList').innerHTML = `
      <table class="table">
        <thead><tr>
          <th>Producto</th><th>Categoría</th><th class="num">Precio</th><th>Estado</th>
        </tr></thead>
        <tbody>
          ${products.map(p => `
            <tr class="row-link" data-product="${escapeHtml(p.id)}">
              <td>
                <strong>${escapeHtml(p.name)}</strong>
                ${p.is_signature ? '<span class="tag signature" style="margin-left:0.4rem;">Signature</span>' : ''}
                ${p.is_veg ? '<span class="tag veg" style="margin-left:0.4rem;">Veg</span>' : ''}
                <br><small style="color:var(--ink-mute);">${escapeHtml(p.id)}</small>
              </td>
              <td>${CATEGORIES.find(c => c.id === p.category)?.label || p.category}</td>
              <td class="num">${eur(p.price_cents)}</td>
              <td>${p.is_active ? '<span class="tag paid">Activo</span>' : '<span class="tag inactive">Inactivo</span>'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
    $$('[data-product]').forEach(tr => tr.addEventListener('click', () => productForm(tr.dataset.product)));
  } catch (e) {
    $('#productsList').innerHTML = `<div class="empty"><p>${escapeHtml(e.message)}</p></div>`;
  }
}

async function productForm(id) {
  let p = { id: '', name: '', category: 'bowls', price_cents: 1000, description: '', image_url: '', is_active: 1, is_signature: 0, is_veg: 0, sort_order: 999 };
  if (id) {
    try { p = (await api('/products/' + id)).product; }
    catch (e) { return toast(e.message, 'err'); }
  }
  openDetail(`
    <div class="detail-head">
      <h2>${id ? 'Editar producto' : 'Nuevo producto'}</h2>
      <button class="detail-close">✕</button>
    </div>
    <div class="detail-body">
      <form id="prodForm">
        <div class="field"><label class="label">Nombre</label>
          <input class="input" name="name" value="${escapeHtml(p.name)}" required></div>
        <div class="fields-grid">
          <div class="field"><label class="label">Categoría</label>
            <select class="select" name="category">
              ${CATEGORIES.map(c => `<option value="${c.id}"${c.id === p.category ? ' selected' : ''}>${c.label}</option>`).join('')}
            </select>
          </div>
          <div class="field"><label class="label">Precio (€)</label>
            <input class="input" name="price" type="number" step="0.01" min="1" value="${(p.price_cents / 100).toFixed(2)}" required></div>
        </div>
        <div class="field"><label class="label">Descripción</label>
          <textarea class="textarea" name="description" rows="3">${escapeHtml(p.description || '')}</textarea></div>
        <div class="field"><label class="label">URL de imagen</label>
          <input class="input" name="image_url" type="url" value="${escapeHtml(p.image_url || '')}"></div>
        <div class="fields-grid">
          <div class="field"><label class="label">Orden</label>
            <input class="input" name="sort_order" type="number" value="${p.sort_order}"></div>
          <div class="field" style="display:flex;flex-direction:column;gap:0.4rem;justify-content:end;">
            <label><input type="checkbox" name="is_active" ${p.is_active ? 'checked' : ''}> Activo (visible y pedido)</label>
            <label><input type="checkbox" name="is_signature" ${p.is_signature ? 'checked' : ''}> Signature</label>
            <label><input type="checkbox" name="is_veg" ${p.is_veg ? 'checked' : ''}> Vegetariano / vegano</label>
          </div>
        </div>
        <div class="section-actions">
          <button class="btn" type="submit">${id ? 'Guardar cambios' : 'Crear producto'}</button>
          ${id ? `<button class="btn terra" type="button" id="btnDeleteProd">Desactivar</button>` : ''}
        </div>
      </form>
    </div>
  `);
  $('#prodForm').addEventListener('submit', async e => {
    e.preventDefault();
    const f = e.target;
    const body = {
      name: f.name.value,
      category: f.category.value,
      price_cents: Math.round(parseFloat(f.price.value) * 100),
      description: f.description.value,
      image_url: f.image_url.value,
      sort_order: parseInt(f.sort_order.value, 10) || 999,
      is_active: f.is_active.checked,
      is_signature: f.is_signature.checked,
      is_veg: f.is_veg.checked,
    };
    try {
      if (id) await api('/products/' + id, { method: 'PATCH', body });
      else    await api('/products',        { method: 'POST',  body });
      toast(id ? 'Producto actualizado' : 'Producto creado');
      closeDetail();
      pageProducts($('#main'));
    } catch (e2) { toast(e2.message, 'err'); }
  });
  $('#btnDeleteProd')?.addEventListener('click', async () => {
    if (!confirm('¿Desactivar este producto? No será pedible y desaparecerá de la web.')) return;
    try {
      await api('/products/' + id, { method: 'DELETE' });
      toast('Producto desactivado');
      closeDetail();
      pageProducts($('#main'));
    } catch (e) { toast(e.message, 'err'); }
  });
}

// ─── PAGE: CUSTOMERS ──────────────────────────────────────────
async function pageCustomers(main) {
  main.innerHTML = `
    <div class="page-head">
      <div>
        <div class="page-eyebrow">CRM</div>
        <h1><em>Clientes</em></h1>
      </div>
    </div>
    <div class="toolbar">
      <input class="input" id="custQ" type="search" placeholder="Buscar por nombre, teléfono o email…">
    </div>
    <div id="custList"><div class="loader"></div></div>
  `;
  const reload = async () => {
    const query = {};
    if ($('#custQ').value.trim()) query.q = $('#custQ').value.trim();
    try {
      const { customers } = await api('/customers', { query });
      if (customers.length === 0) {
        $('#custList').innerHTML = `<div class="empty"><p>Sin clientes todavía.</p></div>`;
        return;
      }
      $('#custList').innerHTML = `
        <table class="table">
          <thead><tr>
            <th>Cliente</th><th>Teléfono</th><th class="num">Pedidos</th><th class="num">Gasto</th><th>Último pedido</th>
          </tr></thead>
          <tbody>
            ${customers.map(c => `
              <tr class="row-link" data-customer="${c.id}">
                <td><strong>${escapeHtml(c.name)}</strong>${c.email ? `<br><small style="color:var(--ink-mute);">${escapeHtml(c.email)}</small>` : ''}</td>
                <td>${escapeHtml(c.phone)}</td>
                <td class="num">${c.total_orders}</td>
                <td class="num">${eur(c.total_spent_cents)}</td>
                <td>${fmtDateShort(c.last_order_at)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
      $$('[data-customer]').forEach(tr => tr.addEventListener('click', () => openCustomer(parseInt(tr.dataset.customer, 10))));
    } catch (e) {
      $('#custList').innerHTML = `<div class="empty"><p>${escapeHtml(e.message)}</p></div>`;
    }
  };
  let dq;
  $('#custQ').addEventListener('input', () => { clearTimeout(dq); dq = setTimeout(reload, 250); });
  reload();
}

async function openCustomer(id) {
  openDetail(`<div class="detail-head"><h2>Cargando…</h2></div><div class="detail-body"><div class="loader"></div></div>`);
  try {
    const { customer, orders } = await api('/customers/' + id);
    openDetail(`
      <div class="detail-head">
        <h2>${escapeHtml(customer.name)}</h2>
        <button class="detail-close">✕</button>
      </div>
      <div class="detail-body">
        <dl class="dl">
          <dt>Teléfono</dt><dd><a href="tel:${escapeHtml(customer.phone)}">${escapeHtml(customer.phone)}</a></dd>
          ${customer.email ? `<dt>Email</dt><dd><a href="mailto:${escapeHtml(customer.email)}">${escapeHtml(customer.email)}</a></dd>` : ''}
          <dt>Pedidos</dt><dd>${customer.total_orders}</dd>
          <dt>Gasto total</dt><dd>${eur(customer.total_spent_cents)}</dd>
          <dt>Primer pedido</dt><dd>${fmtDate(customer.first_order_at)}</dd>
          <dt>Último pedido</dt><dd>${fmtDate(customer.last_order_at)}</dd>
          ${customer.last_address ? `<dt>Última dirección</dt><dd>${escapeHtml(customer.last_address)}<br>${escapeHtml(customer.last_postcode || '')} ${escapeHtml(customer.last_city || '')}</dd>` : ''}
        </dl>

        <div class="field">
          <label class="label">Notas internas</label>
          <textarea class="textarea" id="custNotes" rows="3">${escapeHtml(customer.notes || '')}</textarea>
        </div>
        <button class="btn sm" id="btnSaveNotes">Guardar notas</button>

        <h3 style="font-size:1.1rem;margin:1.5rem 0 0.6rem;">Historial de pedidos</h3>
        ${orders.length === 0 ? '<p style="color:var(--ink-mute);">Sin pedidos.</p>' : `
          <table class="table" style="font-size:0.88rem;">
            <tbody>
              ${orders.map(o => `
                <tr class="row-link" data-order="${o.id}">
                  <td>#${o.id}<br><small style="color:var(--ink-mute);">${fmtDateShort(o.paid_at)}</small></td>
                  <td>${o.delivery_mode === 'delivery' ? 'A domicilio' : 'Recogida'}</td>
                  <td><span class="tag ${o.status}">${statusLabel(o.status)}</span></td>
                  <td class="num" style="text-align:right;">${eur(o.total_cents)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        `}
      </div>
    `);
    $('#btnSaveNotes').addEventListener('click', async () => {
      try {
        await api('/customers/' + id, { method: 'PATCH', body: { notes: $('#custNotes').value } });
        toast('Notas guardadas');
      } catch (e) { toast(e.message, 'err'); }
    });
    $$('[data-order]').forEach(tr => tr.addEventListener('click', () => openOrder(parseInt(tr.dataset.order, 10))));
  } catch (e) {
    toast(e.message, 'err');
    closeDetail();
  }
}

// ─── PAGE: USERS (admin only) ─────────────────────────────────
async function pageUsers(main) {
  main.innerHTML = `
    <div class="page-head">
      <div>
        <div class="page-eyebrow">Solo administrador</div>
        <h1><em>Usuarios</em> del back-office</h1>
      </div>
      <button class="btn" id="btnNewUser">+ Nuevo usuario</button>
    </div>
    <div id="usersList"><div class="loader"></div></div>
  `;
  $('#btnNewUser').addEventListener('click', () => userForm(null));
  try {
    const { users } = await api('/users');
    $('#usersList').innerHTML = `
      <table class="table">
        <thead><tr><th>Usuario</th><th>Rol</th><th>Estado</th><th>Último acceso</th></tr></thead>
        <tbody>
          ${users.map(u => `
            <tr class="row-link" data-user="${u.id}">
              <td><strong>${escapeHtml(u.name)}</strong><br><small style="color:var(--ink-mute);">${escapeHtml(u.email)}</small></td>
              <td><span class="tag role-${u.role}">${u.role}</span></td>
              <td>${u.is_active ? '<span class="tag paid">Activo</span>' : '<span class="tag inactive">Desactivado</span>'}</td>
              <td>${fmtDate(u.last_login_at)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
    $$('[data-user]').forEach(tr => tr.addEventListener('click', () => userForm(parseInt(tr.dataset.user, 10))));
  } catch (e) {
    $('#usersList').innerHTML = `<div class="empty"><p>${escapeHtml(e.message)}</p></div>`;
  }
}

async function userForm(id) {
  let u = { name: '', email: '', role: 'staff', is_active: 1 };
  if (id) {
    try {
      const { users } = await api('/users');
      u = users.find(x => x.id === id) || u;
    } catch (e) { return toast(e.message, 'err'); }
  }
  openDetail(`
    <div class="detail-head">
      <h2>${id ? 'Editar usuario' : 'Nuevo usuario'}</h2>
      <button class="detail-close">✕</button>
    </div>
    <div class="detail-body">
      <form id="userForm">
        <div class="field"><label class="label">Nombre</label>
          <input class="input" name="name" value="${escapeHtml(u.name)}" required></div>
        <div class="field"><label class="label">Email</label>
          <input class="input" name="email" type="email" value="${escapeHtml(u.email)}" ${id ? 'disabled' : 'required'}></div>
        <div class="fields-grid">
          <div class="field"><label class="label">Rol</label>
            <select class="select" name="role">
              <option value="staff" ${u.role === 'staff' ? 'selected' : ''}>Staff</option>
              <option value="admin" ${u.role === 'admin' ? 'selected' : ''}>Admin</option>
            </select></div>
          <div class="field" style="display:flex;align-items:end;"><label><input type="checkbox" name="is_active" ${u.is_active ? 'checked' : ''}> Activo</label></div>
        </div>
        <div class="field"><label class="label">${id ? 'Nueva contraseña (opcional)' : 'Contraseña'}</label>
          <input class="input" name="password" type="password" ${id ? '' : 'required minlength="8"'} placeholder="${id ? 'Dejar en blanco para no cambiar' : 'Mínimo 8 caracteres'}"></div>

        <div class="section-actions">
          <button class="btn" type="submit">${id ? 'Guardar' : 'Crear'}</button>
          ${id && id !== state.user.id ? `<button class="btn terra" type="button" id="btnDelUser">Borrar</button>` : ''}
        </div>
      </form>
    </div>
  `);
  $('#userForm').addEventListener('submit', async e => {
    e.preventDefault();
    const f = e.target;
    const body = { name: f.name.value, role: f.role.value, is_active: f.is_active.checked };
    if (f.password.value) body.password = f.password.value;
    if (!id) body.email = f.email.value;
    try {
      if (id) await api('/users/' + id, { method: 'PATCH', body });
      else    await api('/users',         { method: 'POST',  body });
      toast(id ? 'Usuario actualizado' : 'Usuario creado');
      closeDetail();
      pageUsers($('#main'));
    } catch (e2) { toast(e2.message, 'err'); }
  });
  $('#btnDelUser')?.addEventListener('click', async () => {
    if (!confirm('¿Borrar este usuario? Acción irreversible.')) return;
    try {
      await api('/users/' + id, { method: 'DELETE' });
      toast('Usuario borrado');
      closeDetail();
      pageUsers($('#main'));
    } catch (e) { toast(e.message, 'err'); }
  });
}

// ─── PAGE: STATS (admin only) ─────────────────────────────────
async function pageStats(main) {
  main.innerHTML = `
    <div class="page-head">
      <div>
        <div class="page-eyebrow">Solo administrador</div>
        <h1><em>Estadísticas</em> del negocio</h1>
      </div>
    </div>
    <div id="statsContent"><div class="loader"></div></div>
  `;
  try {
    const s = await api('/stats');
    const delta = (cur, prev) => {
      if (prev === 0) return cur > 0 ? '+∞' : '—';
      const pct = ((cur - prev) / prev) * 100;
      return (pct >= 0 ? '↑ ' : '↓ ') + Math.abs(pct).toFixed(0) + '%';
    };
    const dCls = (cur, prev) => cur >= prev ? 'up' : 'down';

    $('#statsContent').innerHTML = `
      <div class="kpis">
        <div class="kpi">
          <div class="kpi-eyebrow">Hoy · Ingresos</div>
          <div class="kpi-value">${eur(s.today.revenue_cents)}</div>
          <div class="kpi-delta ${dCls(s.today.revenue_cents, s.yesterday.revenue_cents)}">${delta(s.today.revenue_cents, s.yesterday.revenue_cents)} vs ayer</div>
        </div>
        <div class="kpi">
          <div class="kpi-eyebrow">Hoy · Pedidos</div>
          <div class="kpi-value">${s.today.orders}</div>
          <div class="kpi-delta ${dCls(s.today.orders, s.yesterday.orders)}">${delta(s.today.orders, s.yesterday.orders)} vs ayer</div>
        </div>
        <div class="kpi">
          <div class="kpi-eyebrow">Ticket medio (7d)</div>
          <div class="kpi-value">${eur(s.week.avg_ticket_cents || 0)}</div>
          <div class="kpi-delta">${s.week.orders} pedidos esta semana</div>
        </div>
        <div class="kpi">
          <div class="kpi-eyebrow">Ingresos (7d)</div>
          <div class="kpi-value">${eur(s.week.revenue_cents)}</div>
          <div class="kpi-delta ${dCls(s.week.revenue_cents, s.weekPrev.revenue_cents)}">${delta(s.week.revenue_cents, s.weekPrev.revenue_cents)} vs sem. ant.</div>
        </div>
      </div>

      <div class="chart">
        <div class="chart-head">
          <h3>Ingresos · <em>últimos 14 días</em></h3>
          <div style="font-family:var(--mono);font-size:0.75rem;color:var(--ink-soft);">${eur(s.month.revenue_cents)} en 30d</div>
        </div>
        ${chartSVG(s.series)}
      </div>

      <div class="two-col">
        <div class="card">
          <h3 style="font-size:1.2rem;margin-bottom:1rem;">Top productos · <em>30d</em></h3>
          ${s.topProducts.length ? `
            <table class="table" style="font-size:0.88rem;">
              <tbody>
                ${s.topProducts.map((p, i) => `
                  <tr>
                    <td style="width:30px;color:var(--ink-mute);font-family:var(--mono);">${(i+1).toString().padStart(2,'0')}</td>
                    <td>${escapeHtml(p.product_name)}</td>
                    <td class="num" style="text-align:right;">${p.units} ud · ${eur(p.revenue_cents)}</td>
                  </tr>`).join('')}
              </tbody>
            </table>
          ` : '<p style="color:var(--ink-mute);">Sin datos todavía.</p>'}
        </div>
        <div class="card">
          <h3 style="font-size:1.2rem;margin-bottom:1rem;">Mix · <em>30d</em></h3>
          ${s.mix.length ? `
            <table class="table" style="font-size:0.88rem;">
              <tbody>
                ${s.mix.map(m => `
                  <tr>
                    <td>${m.delivery_mode === 'delivery' ? 'A domicilio' : 'Recogida'}</td>
                    <td class="num" style="text-align:right;">${m.n} pedidos · ${eur(m.revenue_cents)}</td>
                  </tr>`).join('')}
              </tbody>
            </table>
          ` : '<p style="color:var(--ink-mute);">Sin datos todavía.</p>'}
        </div>
      </div>

      <div class="card" style="margin-top:1rem;">
        <h3 style="font-size:1.2rem;margin-bottom:1rem;">Top clientes · <em>90d</em></h3>
        ${s.topCustomers.length ? `
          <table class="table" style="font-size:0.88rem;">
            <tbody>
              ${s.topCustomers.map((c, i) => `
                <tr class="row-link" data-customer="${c.id}">
                  <td style="width:30px;color:var(--ink-mute);font-family:var(--mono);">${(i+1).toString().padStart(2,'0')}</td>
                  <td><strong>${escapeHtml(c.name)}</strong> · ${escapeHtml(c.phone)}</td>
                  <td class="num" style="text-align:right;">${c.total_orders} pedidos · ${eur(c.total_spent_cents)}</td>
                </tr>`).join('')}
            </tbody>
          </table>
        ` : '<p style="color:var(--ink-mute);">Sin clientes con compras recientes.</p>'}
      </div>
    `;
    $$('[data-customer]').forEach(tr => tr.addEventListener('click', () => openCustomer(parseInt(tr.dataset.customer, 10))));
  } catch (e) {
    $('#statsContent').innerHTML = `<div class="empty"><p>${escapeHtml(e.message)}</p></div>`;
  }
}

function chartSVG(series) {
  const W = 800, H = 220, P = 28;
  const max = Math.max(1, ...series.map(d => d.revenue_cents));
  const bw = (W - P * 2) / series.length;
  const bars = series.map((d, i) => {
    const bh = (d.revenue_cents / max) * (H - P * 2);
    const x = P + i * bw + 4;
    const y = H - P - bh;
    return `<rect class="chart-bar" x="${x}" y="${y}" width="${bw - 8}" height="${bh}" rx="3">
              <title>${fmtDateShort(d.day)} — ${eur(d.revenue_cents)} (${d.orders} pedidos)</title>
            </rect>`;
  }).join('');
  const labels = series.map((d, i) => i % 2 === 0 ? `<text class="chart-axis" x="${P + i * bw + bw/2}" y="${H - 8}" text-anchor="middle">${fmtDateShort(d.day)}</text>` : '').join('');
  return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">${bars}${labels}</svg>`;
}

// ─── PAGE: SETTINGS ───────────────────────────────────────────
function pageSettings(main) {
  main.innerHTML = `
    <div class="page-head">
      <div>
        <div class="page-eyebrow">Cuenta</div>
        <h1>Tu <em>cuenta</em></h1>
      </div>
    </div>
    <div class="card" style="max-width:520px;">
      <dl class="dl">
        <dt>Nombre</dt><dd>${escapeHtml(state.user.name)}</dd>
        <dt>Email</dt><dd>${escapeHtml(state.user.email)}</dd>
        <dt>Rol</dt><dd><span class="tag role-${state.user.role}">${state.user.role}</span></dd>
      </dl>
      <h3 style="font-size:1.1rem;margin-top:1rem;margin-bottom:0.6rem;">Cambiar contraseña</h3>
      <form id="pwForm">
        <div class="field"><label class="label">Contraseña actual</label>
          <input class="input" type="password" name="current" required></div>
        <div class="field"><label class="label">Nueva contraseña (mín. 8)</label>
          <input class="input" type="password" name="next" required minlength="8"></div>
        <button class="btn" type="submit">Actualizar</button>
      </form>
    </div>
  `;
  $('#pwForm').addEventListener('submit', async e => {
    e.preventDefault();
    const f = e.target;
    try {
      await api('/auth/change-password', { method: 'POST', body: {
        current: f.current.value, next: f.next.value,
      }});
      f.reset();
      toast('Contraseña actualizada');
    } catch (e2) { toast(e2.message, 'err'); }
  });
}

// ─── KICKOFF ───────────────────────────────────────────────────
boot();
