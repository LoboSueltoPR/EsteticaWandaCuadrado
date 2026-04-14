/* ============================================================
   Utilidades compartidas
   ============================================================ */

// ─── Mostrar/ocultar elementos ───
function show(el) {
  if (typeof el === 'string') el = document.getElementById(el);
  if (el) el.classList.remove('hidden');
}

function hide(el) {
  if (typeof el === 'string') el = document.getElementById(el);
  if (el) el.classList.add('hidden');
}

// ─── Alertas ───
function showAlert(containerId, message, type = 'error') {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = `<div class="alert alert-${type}">${message}</div>`;
  setTimeout(() => { container.innerHTML = ''; }, 5000);
}

function clearAlert(containerId) {
  const container = document.getElementById(containerId);
  if (container) container.innerHTML = '';
}

// ─── Formateo de fechas ───
function formatDate(dateStr) {
  const [year, month, day] = dateStr.split('-');
  return `${day}/${month}/${year}`;
}

function formatDateTime(timestamp) {
  if (!timestamp) return '';
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return date.toLocaleDateString('es-AR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

// ─── Fecha de hoy en formato YYYY-MM-DD ───
function getTodayStr() {
  const now = new Date();
  return now.toISOString().split('T')[0];
}

// ─── Proteger página: redirigir si no está logueado ───
function requireAuth(callback) {
  auth.onAuthStateChanged(async (user) => {
    if (!user) {
      window.location.href = 'login.html';
      return;
    }
    try {
      const userDoc = await db.collection('users').doc(user.uid).get();
      const userData = userDoc.exists ? userDoc.data() : null;
      callback(user, userData);
    } catch (err) {
      console.error('Error al obtener datos del usuario:', err);
      callback(user, null);
    }
  });
}

// ─── Proteger página de admin ───
function requireAdmin(callback) {
  requireAuth((user, userData) => {
    if (!userData || userData.rol !== 'admin') {
      window.location.href = 'mis-reservas.html';
      return;
    }
    callback(user, userData);
  });
}

// ─── Navbar: diferenciar admin vs cliente ───
function initNavbar() {
  const toggle = document.querySelector('.navbar-toggle');
  const links = document.querySelector('.navbar-links');

  if (toggle && links) {
    toggle.addEventListener('click', () => links.classList.toggle('open'));
    links.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => links.classList.remove('open'));
    });
  }

  auth.onAuthStateChanged(async (user) => {
    const guestLinks = document.querySelectorAll('.nav-guest');
    const authLinks  = document.querySelectorAll('.nav-auth');
    const adminLinks = document.querySelectorAll('.nav-admin');
    const clientLinks = document.querySelectorAll('.nav-client');

    // Elementos visibles para todos menos admin (ej: tratamientos, mis cremas)
    const noAdminLinks = document.querySelectorAll('.nav-no-admin');

    if (user) {
      guestLinks.forEach(el => el.style.display = 'none');
      authLinks.forEach(el => el.style.display = '');

      try {
        const userDoc = await db.collection('users').doc(user.uid).get();
        const isAdmin = userDoc.exists && userDoc.data().rol === 'admin';

        if (isAdmin) {
          // Admin: muestra panel admin, oculta links de cliente/tienda
          adminLinks.forEach(el => el.style.display = '');
          clientLinks.forEach(el => el.style.display = 'none');
          noAdminLinks.forEach(el => el.style.display = 'none');
        } else {
          // Cliente: muestra links propios, oculta admin
          adminLinks.forEach(el => el.style.display = 'none');
          clientLinks.forEach(el => el.style.display = '');
          noAdminLinks.forEach(el => el.style.display = '');
        }
      } catch {
        adminLinks.forEach(el => el.style.display = 'none');
        clientLinks.forEach(el => el.style.display = '');
        noAdminLinks.forEach(el => el.style.display = '');
      }
    } else {
      guestLinks.forEach(el => el.style.display = '');
      authLinks.forEach(el => el.style.display = 'none');
      adminLinks.forEach(el => el.style.display = 'none');
      clientLinks.forEach(el => el.style.display = 'none');
      noAdminLinks.forEach(el => el.style.display = '');
    }
  });
}

// ─── Cerrar sesión ───
function logout() {
  auth.signOut().then(() => {
    window.location.href = 'index.html';
  });
}

// ─── Generar todos los horarios del día ───
function generateTimeSlots(startHour = 9, endHour = 20, intervalMin = 60) {
  const slots = [];
  for (let h = startHour; h < endHour; h++) {
    for (let m = 0; m < 60; m += intervalMin) {
      slots.push(`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`);
    }
  }
  return slots;
}

// ─── Horarios ocupados para una fecha (reservas + bloqueos) ───
async function getOccupiedSlots(fecha, excludeReservationId = null) {
  const occupied = new Set();

  // 1. Verificar bloqueos de Firestore
  try {
    const bloqueosDoc = await db.collection('config').doc('bloqueos').get();
    if (bloqueosDoc.exists) {
      const bloqueos = bloqueosDoc.data();

      // Día completo bloqueado → devolver todos los horarios
      if (bloqueos.diasBloqueados && bloqueos.diasBloqueados.includes(fecha)) {
        return generateTimeSlots(9, 20, 60); // todo bloqueado
      }

      // Horarios específicos bloqueados ese día
      if (bloqueos.horariosBloqueados && bloqueos.horariosBloqueados[fecha]) {
        bloqueos.horariosBloqueados[fecha].forEach(h => occupied.add(h));
      }
    }
  } catch (err) {
    console.warn('No se pudieron cargar bloqueos:', err.message);
  }

  // 2. Reservas confirmadas/pendientes ese día
  try {
    const now = new Date();
    const snapshot = await db.collection('reservations')
      .where('fecha', '==', fecha)
      .where('estado', 'in', ['pendiente_pago', 'pendiente', 'confirmada'])
      .get();

    snapshot.forEach(doc => {
      if (doc.id === excludeReservationId) return;
      const data = doc.data();
      // Ignorar pendiente_pago vencidas (no bloquean el slot)
      if (data.estado === 'pendiente_pago' && data.expiraAt) {
        const expira = data.expiraAt.toDate ? data.expiraAt.toDate() : new Date(data.expiraAt);
        if (expira <= now) return;
      }
      occupied.add(data.hora);
    });
  } catch (err) {
    console.error('Error al consultar reservas:', err);
  }

  return Array.from(occupied);
}

// ─── Navbar HTML (cliente vs admin diferenciados) ───
function getNavbarHTML() {
  return `
  <nav class="navbar">
    <div class="navbar-inner">
      <a href="index.html" class="navbar-brand">Wanda Cuadrado</a>
      <button class="navbar-toggle" aria-label="Menú">
        <span></span><span></span><span></span>
      </button>
      <ul class="navbar-links">
        <li><a href="index.html">Inicio</a></li>
        <li class="nav-no-admin"><a href="tratamientos.html">Tratamientos</a></li>
        <li class="nav-no-admin"><a href="mis-cremas.html">Cremas</a></li>

        <!-- Solo clientes -->
        <li class="nav-auth nav-client" style="display:none"><a href="mis-reservas.html">Mis Reservas</a></li>
        <li class="nav-auth nav-client" style="display:none"><a href="nueva-reserva.html">Reservar turno</a></li>
        <li class="nav-auth nav-client" style="display:none"><a href="mi-perfil.html">Mi Perfil</a></li>

        <!-- Solo admin -->
        <li class="nav-admin" style="display:none"><a href="admin.html">Panel Admin</a></li>

        <!-- Ambos -->
        <li class="nav-guest"><a href="login.html">Ingresar</a></li>
        <li class="nav-guest"><a href="register.html">Registrarse</a></li>
        <li class="nav-auth" style="display:none"><a href="#" onclick="logout(); return false;">Salir</a></li>
      </ul>
    </div>
  </nav>`;
}

// ─── Limpiar reservas pendiente_pago vencidas del usuario actual ───
async function cleanupMyExpiredReservations(userId) {
  try {
    const now  = new Date();
    const snap = await db.collection('reservations')
      .where('userId', '==', userId)
      .where('estado', '==', 'pendiente_pago')
      .get();

    if (snap.empty) return;

    const batch = db.batch();
    let count = 0;
    snap.forEach(doc => {
      const exp = doc.data().expiraAt;
      if (!exp) return;
      const expDate = exp.toDate ? exp.toDate() : new Date(exp);
      if (expDate <= now) {
        batch.delete(doc.ref);
        count++;
      }
    });
    if (count > 0) await batch.commit();
  } catch (err) {
    console.warn('Cleanup:', err.message);
  }
}

// ─── Limpiar pedidos pendiente_pago vencidos del usuario actual ───
async function cleanupMyExpiredOrders(userId) {
  try {
    const now  = new Date();
    const snap = await db.collection('orders')
      .where('userId', '==', userId)
      .where('estado', '==', 'pendiente_pago')
      .get();
    if (snap.empty) return;
    const batch = db.batch();
    let count = 0;
    snap.forEach(doc => {
      const exp = doc.data().expiraAt;
      if (!exp) return;
      const expDate = exp.toDate ? exp.toDate() : new Date(exp);
      if (expDate <= now) { batch.delete(doc.ref); count++; }
    });
    if (count > 0) await batch.commit();
  } catch (err) { console.warn('Cleanup orders expired:', err.message); }
}

// ─── Limpiar reservas canceladas del usuario actual ───
async function cleanupMyCancelledReservations(userId) {
  try {
    const snap = await db.collection('reservations')
      .where('userId', '==', userId)
      .where('estado', '==', 'cancelada')
      .get();
    if (snap.empty) return;
    const batch = db.batch();
    snap.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
  } catch (err) {
    console.warn('Cleanup canceladas:', err.message);
  }
}

// ─── Limpiar pedidos cancelados del usuario actual ───
async function cleanupMyCancelledOrders(userId) {
  try {
    const snap = await db.collection('orders')
      .where('userId', '==', userId)
      .where('estado', '==', 'cancelada')
      .get();
    if (snap.empty) return;
    const batch = db.batch();
    snap.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
  } catch (err) {
    console.warn('Cleanup pedidos cancelados:', err.message);
  }
}

// ─── Formatear teléfono para WhatsApp (Argentina) ───
function formatWAPhone(tel) {
  if (!tel) return '';
  let digits = tel.replace(/\D/g, '');
  if (digits.startsWith('549')) return digits;
  if (digits.startsWith('54'))  return digits;
  if (digits.startsWith('0'))   digits = digits.slice(1);
  return '549' + digits;
}

// ─── WhatsApp del negocio (Wanda) ───
const BUSINESS_WA_PHONE = '5492914362710';
const BUSINESS_NAME     = 'Wanda';

// ─── Construir link de WhatsApp con mensaje pre-llenado ───
function buildWAUrl(phone, text) {
  if (!phone) return '';
  return 'https://wa.me/' + phone + '?text=' + encodeURIComponent(text || '');
}

// ─── Mensaje: confirmación de reserva (cliente → negocio) ───
function buildReservaConfirmMessage(reserva) {
  const saldo = (reserva.precioTotal || 0) - (reserva.senia || 0);
  const lineas = [
    'Hola ' + BUSINESS_NAME + '! Acabo de reservar un turno 💆‍♀️',
    '',
    '*Servicio:* ' + (reserva.servicioNombre || '—'),
    '*Fecha:* ' + formatDate(reserva.fecha || ''),
    '*Horario:* ' + (reserva.hora || '—') + ' hs',
    '*Seña pagada:* $' + (reserva.senia || 0).toLocaleString('es-AR')
  ];
  if (saldo > 0) lineas.push('*Saldo a abonar el día del turno:* $' + saldo.toLocaleString('es-AR'));
  lineas.push('', 'Quedo atenta, ¡gracias!');
  return lineas.join('\n');
}

// ─── Mensaje: recordatorio de turno (negocio → cliente) ───
function buildReservaReminderMessage(reserva) {
  const saldo = (reserva.precioTotal || 0) - (reserva.senia || 0);
  const nombre = (reserva.nombreUsuario || 'clienta').split(' ')[0];
  const lineas = [
    '¡Hola ' + nombre + '! 💆‍♀️ Te escribo de parte de ' + BUSINESS_NAME + '.',
    '',
    'Te recuerdo tu turno:',
    '*Servicio:* ' + (reserva.servicioNombre || '—'),
    '*Fecha:* ' + formatDate(reserva.fecha || ''),
    '*Horario:* ' + (reserva.hora || '—') + ' hs'
  ];
  if (saldo > 0) lineas.push('*Saldo a abonar:* $' + saldo.toLocaleString('es-AR'));
  lineas.push('', '¡Te espero! Cualquier cosa, avisame.');
  return lineas.join('\n');
}

// ─── Mensaje: confirmación de pedido de crema (cliente → negocio) ───
function buildPedidoConfirmMessage(pedido) {
  const saldo = (pedido.precio || 0) - (pedido.senia || 0);
  const lineas = [
    'Hola ' + BUSINESS_NAME + '! Hice un pedido de crema 🧴',
    '',
    '*Producto:* ' + (pedido.productoNombre || '—'),
    '*Seña pagada:* $' + (pedido.senia || 0).toLocaleString('es-AR'),
    '*Saldo al retirar:* $' + saldo.toLocaleString('es-AR'),
    '',
    '¿Me avisás cuando esté listo para coordinar el retiro? ¡Gracias!'
  ];
  return lineas.join('\n');
}

// ─── Mensaje: pedido listo para retirar (negocio → cliente) ───
function buildPedidoReadyMessage(pedido) {
  const saldo = (pedido.precio || 0) - (pedido.senia || 0);
  const nombre = (pedido.nombreUsuario || 'clienta').split(' ')[0];
  const lineas = [
    '¡Hola ' + nombre + '! 🧴 Te escribo de parte de ' + BUSINESS_NAME + '.',
    '',
    'Tu pedido de *' + (pedido.productoNombre || '—') + '* está listo para retirar.',
    '*Saldo a abonar:* $' + saldo.toLocaleString('es-AR'),
    '',
    'Avisame cuándo podés pasar y coordinamos. ¡Gracias!'
  ];
  return lineas.join('\n');
}

// ═══════════════════════════════════════════════════════════════════════════
// Cache en localStorage con TTL (reduce lecturas a Firestore)
// ═══════════════════════════════════════════════════════════════════════════
//
// Uso:
//   const productos = await cachedFetch('products:activos', 15*60*1000, async () => {
//     const snap = await db.collection('products').where('activo','==',true).get();
//     return snap.docs.map(d => ({ id: d.id, ...d.data() }));
//   });
//
// Invalidación (después de escribir):
//   invalidateCache('products:activos');
//   invalidateCachePrefix('products:');
// ═══════════════════════════════════════════════════════════════════════════

const CACHE_PREFIX = 'ewc:cache:';

async function cachedFetch(key, ttlMs, fetcher) {
  const fullKey = CACHE_PREFIX + key;

  // Intentar leer de cache
  try {
    const raw = localStorage.getItem(fullKey);
    if (raw) {
      const { data, exp } = JSON.parse(raw);
      if (exp && Date.now() < exp) {
        return data;
      }
      // Expirado: limpiar
      localStorage.removeItem(fullKey);
    }
  } catch (err) {
    // localStorage deshabilitado o JSON corrupto: seguir sin cache
    console.warn('[cache] lectura falló:', err.message);
  }

  // Miss o expirado: ir a la fuente
  const data = await fetcher();

  try {
    localStorage.setItem(fullKey, JSON.stringify({
      data,
      exp:  Date.now() + ttlMs,
      ts:   Date.now()
    }));
  } catch (err) {
    // Quota exceeded o privado: no bloquear
    console.warn('[cache] escritura falló:', err.message);
  }

  return data;
}

function invalidateCache(key) {
  try { localStorage.removeItem(CACHE_PREFIX + key); } catch {}
}

function invalidateCachePrefix(prefix) {
  try {
    const full = CACHE_PREFIX + prefix;
    const toDelete = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(full)) toDelete.push(k);
    }
    toDelete.forEach(k => localStorage.removeItem(k));
  } catch {}
}

// TTLs estándar (milisegundos)
const CACHE_TTL = {
  PRODUCTS: 15 * 60 * 1000, //  15 minutos
  SERVICES: 15 * 60 * 1000, //  15 minutos
  CONFIG:   30 * 60 * 1000  //  30 minutos
};

// ─── Footer ───
function getFooterHTML() {
  const year = new Date().getFullYear();
  return `
  <footer class="footer">
    <p>Wanda Cuadrado &copy; ${year} — Estética y Bienestar</p>
  </footer>`;
}
