/* ============================================================
   Panel de Administración
   ============================================================ */

// ─── Tabs ───
function initAdminTabs() {
  const tabs = document.querySelectorAll('.tab-btn');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById(tab.dataset.tab).classList.add('active');
    });
  });
}

// ─── RESERVAS: Cargar todas ───
async function loadAllReservations(filtroEstado = 'todos') {
  const container = document.getElementById('admin-reservations');
  container.innerHTML = '<div class="loading-overlay"><div class="spinner"></div> Cargando...</div>';

  try {
    let query = db.collection('reservations').orderBy('fecha', 'desc').orderBy('hora', 'desc');
    const snapshot = await query.get();

    if (snapshot.empty) {
      container.innerHTML = '<div class="empty-state"><p>No hay reservas.</p></div>';
      return;
    }

    let html = `
    <div class="table-responsive">
      <table>
        <thead>
          <tr>
            <th>Cliente</th>
            <th>Email</th>
            <th>Servicio</th>
            <th>Fecha</th>
            <th>Hora</th>
            <th>Estado</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>`;

    snapshot.forEach(doc => {
      const r = doc.data();
      if (filtroEstado !== 'todos' && r.estado !== filtroEstado) return;

      html += `
          <tr>
            <td>${r.nombreUsuario || 'Sin nombre'}</td>
            <td>${r.emailUsuario || ''}</td>
            <td>${r.servicioNombre}</td>
            <td>${formatDate(r.fecha)}</td>
            <td>${r.hora}</td>
            <td><span class="badge badge-${r.estado}">${r.estado}</span></td>
            <td>
              <div class="btn-group">
                <button class="btn btn-sm btn-success" onclick="updateReservationStatus('${doc.id}', 'confirmada')" title="Confirmar">Confirmar</button>
                <button class="btn btn-sm btn-danger" onclick="updateReservationStatus('${doc.id}', 'cancelada')" title="Cancelar">Cancelar</button>
                <button class="btn btn-sm btn-secondary" onclick="updateReservationStatus('${doc.id}', 'pendiente')" title="Pendiente">Pendiente</button>
              </div>
            </td>
          </tr>`;
    });

    html += '</tbody></table></div>';
    container.innerHTML = html;
  } catch (err) {
    console.error('Error al cargar reservas:', err);
    container.innerHTML = '<div class="alert alert-error">Error al cargar reservas. Verificá los índices de Firestore.</div>';
  }
}

// ─── RESERVAS: Cambiar estado ───
async function updateReservationStatus(id, nuevoEstado) {
  try {
    await db.collection('reservations').doc(id).update({
      estado: nuevoEstado,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    // Recargar con filtro actual
    const filtro = document.getElementById('filtro-estado');
    loadAllReservations(filtro ? filtro.value : 'todos');
  } catch (err) {
    console.error('Error al actualizar estado:', err);
    alert('Error al actualizar el estado.');
  }
}

// ─── SERVICIOS: Cargar todos ───
async function loadAllServices() {
  const container = document.getElementById('admin-services-list');
  container.innerHTML = '<div class="loading-overlay"><div class="spinner"></div> Cargando...</div>';

  try {
    const snapshot = await db.collection('services')
      .orderBy('categoria')
      .orderBy('nombre')
      .get();

    if (snapshot.empty) {
      container.innerHTML = '<div class="empty-state"><p>No hay servicios. Creá el primero o cargá los datos iniciales.</p></div>';
      return;
    }

    let html = `
    <div class="table-responsive">
      <table>
        <thead>
          <tr>
            <th>Nombre</th>
            <th>Categoría</th>
            <th>Duración</th>
            <th>Activo</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>`;

    snapshot.forEach(doc => {
      const s = doc.data();
      html += `
          <tr>
            <td>${s.nombre}</td>
            <td style="text-transform: capitalize;">${s.categoria}</td>
            <td>${s.duracionMin} min</td>
            <td><span class="badge ${s.activo ? 'badge-confirmada' : 'badge-cancelada'}">${s.activo ? 'Sí' : 'No'}</span></td>
            <td>
              <div class="btn-group">
                <button class="btn btn-sm btn-secondary" onclick="editServiceModal('${doc.id}')">Editar</button>
                <button class="btn btn-sm ${s.activo ? 'btn-danger' : 'btn-success'}" onclick="toggleServiceActive('${doc.id}', ${!s.activo})">${s.activo ? 'Desactivar' : 'Activar'}</button>
              </div>
            </td>
          </tr>`;
    });

    html += '</tbody></table></div>';
    container.innerHTML = html;
  } catch (err) {
    console.error('Error al cargar servicios:', err);
    container.innerHTML = '<div class="alert alert-error">Error al cargar servicios.</div>';
  }
}

// ─── SERVICIOS: Activar/desactivar ───
async function toggleServiceActive(id, nuevoEstado) {
  try {
    await db.collection('services').doc(id).update({ activo: nuevoEstado });
    loadAllServices();
  } catch (err) {
    console.error('Error al cambiar estado del servicio:', err);
  }
}

// ─── SERVICIOS: Modal crear/editar ───
function showServiceModal(data = null, docId = null) {
  // Eliminar modal previo si existe
  const prev = document.getElementById('service-modal');
  if (prev) prev.remove();

  const isEdit = !!docId;

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'service-modal';
  overlay.innerHTML = `
    <div class="modal">
      <h2>${isEdit ? 'Editar' : 'Nuevo'} Servicio</h2>
      <div id="service-modal-alert"></div>
      <form id="service-form">
        <div class="form-group">
          <label>Nombre</label>
          <input type="text" class="form-control" id="svc-nombre" value="${data ? data.nombre : ''}" required>
        </div>
        <div class="form-group">
          <label>Categoría</label>
          <select class="form-control" id="svc-categoria" required>
            <option value="facial" ${data && data.categoria === 'facial' ? 'selected' : ''}>Facial</option>
            <option value="corporal" ${data && data.categoria === 'corporal' ? 'selected' : ''}>Corporal</option>
            <option value="capilar" ${data && data.categoria === 'capilar' ? 'selected' : ''}>Capilar</option>
            <option value="otros" ${data && data.categoria === 'otros' ? 'selected' : ''}>Otros</option>
          </select>
        </div>
        <div class="form-group">
          <label>Duración (minutos)</label>
          <input type="number" class="form-control" id="svc-duracion" value="${data ? data.duracionMin : 60}" min="15" step="15" required>
        </div>
        <div class="form-group">
          <label>
            <input type="checkbox" id="svc-activo" ${!data || data.activo ? 'checked' : ''}> Activo
          </label>
        </div>
        <div class="modal-actions">
          <button type="button" class="btn btn-secondary" onclick="document.getElementById('service-modal').remove()">Cancelar</button>
          <button type="submit" class="btn btn-primary">${isEdit ? 'Guardar' : 'Crear'}</button>
        </div>
      </form>
    </div>`;

  document.body.appendChild(overlay);

  // Cerrar al click fuera
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.remove();
  });

  // Submit
  document.getElementById('service-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const serviceData = {
      nombre: document.getElementById('svc-nombre').value.trim(),
      categoria: document.getElementById('svc-categoria').value,
      duracionMin: parseInt(document.getElementById('svc-duracion').value),
      activo: document.getElementById('svc-activo').checked
    };

    if (!serviceData.nombre) {
      showAlert('service-modal-alert', 'Ingresá un nombre.');
      return;
    }

    try {
      if (isEdit) {
        await db.collection('services').doc(docId).update(serviceData);
      } else {
        await db.collection('services').add(serviceData);
      }
      overlay.remove();
      loadAllServices();
    } catch (err) {
      console.error('Error al guardar servicio:', err);
      showAlert('service-modal-alert', 'Error al guardar.');
    }
  });
}

async function editServiceModal(docId) {
  const doc = await db.collection('services').doc(docId).get();
  if (doc.exists) {
    showServiceModal(doc.data(), docId);
  }
}

// ─── SEED: Cargar servicios iniciales ───
async function seedServices() {
  if (!confirm('¿Cargar todos los servicios iniciales? Esto no duplicará servicios existentes con el mismo nombre.')) return;

  const services = [
    // Corporales
    { nombre: "Vela Body", categoria: "corporal", duracionMin: 60, activo: true },
    { nombre: "Inner", categoria: "corporal", duracionMin: 60, activo: true },
    { nombre: "Body Sculpt", categoria: "corporal", duracionMin: 60, activo: true },
    { nombre: "Criolipolisis", categoria: "corporal", duracionMin: 60, activo: true },
    { nombre: "Radiofrecuencia Corporal", categoria: "corporal", duracionMin: 60, activo: true },
    { nombre: "Cavitación + electrodos", categoria: "corporal", duracionMin: 60, activo: true },
    { nombre: "Peptonas", categoria: "corporal", duracionMin: 60, activo: true },
    { nombre: "Mesoterapia Corporal", categoria: "corporal", duracionMin: 60, activo: true },
    { nombre: "Vela/Radio y meso", categoria: "corporal", duracionMin: 60, activo: true },
    { nombre: "Hidrolip", categoria: "corporal", duracionMin: 60, activo: true },
    { nombre: "Drenaje linfático", categoria: "corporal", duracionMin: 60, activo: true },
    { nombre: "Drenaje completo", categoria: "corporal", duracionMin: 60, activo: true },
    { nombre: "Maderoterapia cuerpo completo", categoria: "corporal", duracionMin: 60, activo: true },
    { nombre: "Madero por zona", categoria: "corporal", duracionMin: 60, activo: true },
    { nombre: "Body Up", categoria: "corporal", duracionMin: 60, activo: true },
    { nombre: "Electrodos", categoria: "corporal", duracionMin: 60, activo: true },
    { nombre: "Reflexología", categoria: "corporal", duracionMin: 60, activo: true },
    { nombre: "Refle más ventosas", categoria: "corporal", duracionMin: 60, activo: true },
    { nombre: "Masaje completo", categoria: "corporal", duracionMin: 60, activo: true },
    { nombre: "Masaje por zona", categoria: "corporal", duracionMin: 60, activo: true },
    { nombre: "Plasma para alopecia", categoria: "corporal", duracionMin: 60, activo: true },
    { nombre: "Hifu Corporal", categoria: "corporal", duracionMin: 60, activo: true },
    { nombre: "Hifu vaginal", categoria: "corporal", duracionMin: 60, activo: true },
    // Faciales
    { nombre: "Diagnóstico", categoria: "facial", duracionMin: 60, activo: true },
    { nombre: "Limpieza facial", categoria: "facial", duracionMin: 60, activo: true },
    { nombre: "Limpieza básica", categoria: "facial", duracionMin: 60, activo: true },
    { nombre: "Dermaplaning", categoria: "facial", duracionMin: 60, activo: true },
    { nombre: "Dermapen", categoria: "facial", duracionMin: 60, activo: true },
    { nombre: "Radiofrecuencia Facial", categoria: "facial", duracionMin: 60, activo: true },
    { nombre: "Inner ball", categoria: "facial", duracionMin: 60, activo: true },
    { nombre: "Parches de colágeno", categoria: "facial", duracionMin: 60, activo: true },
    { nombre: "Baby Lips", categoria: "facial", duracionMin: 60, activo: true },
    { nombre: "Hydralips", categoria: "facial", duracionMin: 60, activo: true },
    { nombre: "Hilos sólidos y líquidos", categoria: "facial", duracionMin: 60, activo: true },
    { nombre: "Hilos nubes", categoria: "facial", duracionMin: 60, activo: true },
    { nombre: "Baby Botox", categoria: "facial", duracionMin: 60, activo: true },
    { nombre: "Baby Glow", categoria: "facial", duracionMin: 60, activo: true },
    { nombre: "Peeling", categoria: "facial", duracionMin: 60, activo: true },
    { nombre: "Plasma Facial", categoria: "facial", duracionMin: 60, activo: true },
    { nombre: "Hydrapeel", categoria: "facial", duracionMin: 60, activo: true },
    { nombre: "Mesoterapia Facial", categoria: "facial", duracionMin: 60, activo: true },
    { nombre: "Mesoterapia y dermaplaning", categoria: "facial", duracionMin: 60, activo: true },
    { nombre: "Hyaluron Pen", categoria: "facial", duracionMin: 60, activo: true },
    { nombre: "Perfilado con hilo en cejas", categoria: "facial", duracionMin: 60, activo: true },
    { nombre: "Perfilado con hilo en bozo y cejas", categoria: "facial", duracionMin: 60, activo: true },
    { nombre: "Tintura + perfilado", categoria: "facial", duracionMin: 60, activo: true },
    { nombre: "Laminado de cejas", categoria: "facial", duracionMin: 60, activo: true },
    { nombre: "Henna en cejas", categoria: "facial", duracionMin: 60, activo: true },
    { nombre: "Lifting de pestañas", categoria: "facial", duracionMin: 60, activo: true },
    { nombre: "Exosoma", categoria: "facial", duracionMin: 60, activo: true },
    { nombre: "Em face premium", categoria: "facial", duracionMin: 60, activo: true },
    { nombre: "Em face", categoria: "facial", duracionMin: 60, activo: true },
    { nombre: "Combos de lifting y laminado", categoria: "facial", duracionMin: 60, activo: true },
    { nombre: "Lifting de pestañas y laminado", categoria: "facial", duracionMin: 60, activo: true },
    // Capilares
    { nombre: "Mesoterapia capilar", categoria: "capilar", duracionMin: 60, activo: true },
  ];

  const btn = document.getElementById('btn-seed');
  if (btn) btn.disabled = true;

  // Obtener servicios existentes para no duplicar
  const existing = new Set();
  const snap = await db.collection('services').get();
  snap.forEach(doc => existing.add(doc.data().nombre));

  let count = 0;
  const batch = db.batch();

  for (const svc of services) {
    if (!existing.has(svc.nombre)) {
      const ref = db.collection('services').doc();
      batch.set(ref, svc);
      count++;
    }
  }

  if (count > 0) {
    await batch.commit();
    alert(`Se cargaron ${count} servicios nuevos.`);
  } else {
    alert('Todos los servicios ya estaban cargados.');
  }

  if (btn) btn.disabled = false;
  loadAllServices();
}
