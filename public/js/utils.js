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
  // Auto-ocultar después de 5 segundos
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

// ─── Obtener fecha mínima (hoy) en formato YYYY-MM-DD ───
function getTodayStr() {
  const now = new Date();
  return now.toISOString().split('T')[0];
}

// ─── Proteger página: redirigir si no está logueado ───
function requireAuth(callback) {
  auth.onAuthStateChanged(async (user) => {
    if (!user) {
      window.location.href = '/login.html';
      return;
    }
    // Obtener datos del usuario de Firestore
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
      window.location.href = '/dashboard.html';
      return;
    }
    callback(user, userData);
  });
}

// ─── Actualizar navbar según estado de auth ───
function initNavbar() {
  const toggle = document.querySelector('.navbar-toggle');
  const links = document.querySelector('.navbar-links');

  if (toggle && links) {
    toggle.addEventListener('click', () => {
      links.classList.toggle('open');
    });
    // Cerrar menu al hacer click en un link
    links.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => links.classList.remove('open'));
    });
  }

  auth.onAuthStateChanged(async (user) => {
    const guestLinks = document.querySelectorAll('.nav-guest');
    const authLinks = document.querySelectorAll('.nav-auth');
    const adminLinks = document.querySelectorAll('.nav-admin');

    if (user) {
      guestLinks.forEach(el => el.style.display = 'none');
      authLinks.forEach(el => el.style.display = '');

      // Verificar si es admin
      try {
        const userDoc = await db.collection('users').doc(user.uid).get();
        if (userDoc.exists && userDoc.data().rol === 'admin') {
          adminLinks.forEach(el => el.style.display = '');
        } else {
          adminLinks.forEach(el => el.style.display = 'none');
        }
      } catch {
        adminLinks.forEach(el => el.style.display = 'none');
      }
    } else {
      guestLinks.forEach(el => el.style.display = '');
      authLinks.forEach(el => el.style.display = 'none');
      adminLinks.forEach(el => el.style.display = 'none');
    }
  });
}

// ─── Cerrar sesión ───
function logout() {
  auth.signOut().then(() => {
    window.location.href = '/index.html';
  });
}

// ─── Generar horarios disponibles para un día ───
function generateTimeSlots(startHour = 9, endHour = 20, intervalMin = 60) {
  const slots = [];
  for (let h = startHour; h < endHour; h++) {
    for (let m = 0; m < 60; m += intervalMin) {
      const hour = String(h).padStart(2, '0');
      const min = String(m).padStart(2, '0');
      slots.push(`${hour}:${min}`);
    }
  }
  return slots;
}

// ─── Obtener horarios ocupados para una fecha ───
async function getOccupiedSlots(fecha, excludeReservationId = null) {
  let query = db.collection('reservations')
    .where('fecha', '==', fecha)
    .where('estado', 'in', ['pendiente', 'confirmada']);

  const snapshot = await query.get();
  const occupied = [];
  snapshot.forEach(doc => {
    if (doc.id !== excludeReservationId) {
      occupied.push(doc.data().hora);
    }
  });
  return occupied;
}

// ─── Crear el HTML del navbar (componente reutilizable) ───
function getNavbarHTML() {
  return `
  <nav class="navbar">
    <div class="navbar-inner">
      <a href="/index.html" class="navbar-brand">Estética Agus</a>
      <button class="navbar-toggle" aria-label="Menú">
        <span></span><span></span><span></span>
      </button>
      <ul class="navbar-links">
        <li><a href="/index.html">Inicio</a></li>
        <li><a href="/tratamientos.html">Tratamientos</a></li>
        <li class="nav-auth" style="display:none"><a href="/dashboard.html">Mi Panel</a></li>
        <li class="nav-auth" style="display:none"><a href="/mis-reservas.html">Mis Reservas</a></li>
        <li class="nav-auth" style="display:none"><a href="/nueva-reserva.html">Reservar</a></li>
        <li class="nav-admin" style="display:none"><a href="/admin.html">Admin</a></li>
        <li class="nav-guest"><a href="/login.html">Ingresar</a></li>
        <li class="nav-guest"><a href="/register.html">Registrarse</a></li>
        <li class="nav-auth" style="display:none"><a href="#" onclick="logout(); return false;">Salir</a></li>
      </ul>
    </div>
  </nav>`;
}

// ─── Footer reutilizable ───
function getFooterHTML() {
  const year = new Date().getFullYear();
  return `
  <footer class="footer">
    <p>Estética Agus &copy; ${year} — Todos los derechos reservados</p>
  </footer>`;
}
