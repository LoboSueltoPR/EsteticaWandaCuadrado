/* ============================================================
   Reservas — CRUD de turnos
   ============================================================ */

// ─── Cargar servicios activos en un <select> (con cache local) ───
async function loadServicesSelect(selectId) {
  const select = document.getElementById(selectId);
  if (!select) return;

  select.innerHTML = '<option value="">Seleccioná un servicio...</option>';

  // Lectura cacheada con TTL — reduce hits a Firestore
  const servicios = await cachedFetch('services:activos', CACHE_TTL.SERVICES, async () => {
    const snap = await db.collection('services').where('activo', '==', true).get();
    const arr = [];
    snap.forEach(doc => arr.push({ id: doc.id, ...doc.data() }));
    arr.sort((a, b) =>
      (a.categoria || '').localeCompare(b.categoria || '') ||
      (a.nombre || '').localeCompare(b.nombre || '')
    );
    return arr;
  });

  let currentCat = '';
  let optgroup = null;

  servicios.forEach(s => {
    if (s.categoria !== currentCat) {
      currentCat = s.categoria;
      optgroup = document.createElement('optgroup');
      optgroup.label = currentCat.charAt(0).toUpperCase() + currentCat.slice(1);
      select.appendChild(optgroup);
    }
    const option = document.createElement('option');
    option.value = s.id;
    option.textContent = `${s.nombre} (${s.duracionMin} min)`;
    option.dataset.nombre = s.nombre;
    option.dataset.duracion = s.duracionMin;
    option.dataset.precio = s.precio || 0;
    (optgroup || select).appendChild(option);
  });
}

// ─── Renderizar horarios disponibles ───
async function renderTimeSlots(containerId, fecha, excludeReservationId = null) {
  const container = document.getElementById(containerId);
  if (!container || !fecha) return;

  container.innerHTML = '<div class="loading-overlay"><div class="spinner"></div> Cargando horarios...</div>';

  const allSlots = generateTimeSlots(9, 20, 60);
  const occupied = await getOccupiedSlots(fecha, excludeReservationId);

  container.innerHTML = '';
  const grid = document.createElement('div');
  grid.className = 'time-slots';

  allSlots.forEach(slot => {
    const div = document.createElement('div');
    div.className = 'time-slot';
    div.textContent = slot;

    if (occupied.includes(slot)) {
      div.classList.add('occupied');
      div.title = 'Horario ocupado';
    } else {
      div.addEventListener('click', () => {
        // Deseleccionar previo
        container.querySelectorAll('.time-slot.selected').forEach(s => s.classList.remove('selected'));
        div.classList.add('selected');
        // Guardar valor en input oculto
        const hiddenInput = document.getElementById('selected-time');
        if (hiddenInput) hiddenInput.value = slot;
      });
    }

    grid.appendChild(div);
  });

  container.appendChild(grid);
}

// ─── Crear nueva reserva ───
async function handleCreateReservation(e) {
  e.preventDefault();
  const btn = e.target.querySelector('button[type="submit"]');
  btn.disabled = true;

  const servicioSelect = document.getElementById('reserva-servicio');
  const fecha = document.getElementById('reserva-fecha').value;
  const hora = document.getElementById('selected-time').value;

  if (!servicioSelect.value || !fecha || !hora) {
    showAlert('reserva-alert', 'Completá todos los campos y seleccioná un horario.');
    btn.disabled = false;
    return;
  }

  // Verificar que no esté ocupado (doble check)
  const occupied = await getOccupiedSlots(fecha);
  if (occupied.includes(hora)) {
    showAlert('reserva-alert', 'Ese horario acaba de ser reservado por otra persona. Elegí otro.');
    btn.disabled = false;
    // Refrescar horarios
    renderTimeSlots('time-slots-container', fecha);
    return;
  }

  const user = auth.currentUser;
  const selectedOption = servicioSelect.options[servicioSelect.selectedIndex];

  try {
    await db.collection('reservations').add({
      userId: user.uid,
      nombreUsuario: user.displayName || '',
      emailUsuario: user.email,
      servicioId: servicioSelect.value,
      servicioNombre: selectedOption.dataset.nombre,
      fecha: fecha,
      hora: hora,
      estado: 'pendiente',
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    showAlert('reserva-alert', 'Reserva creada con éxito.', 'success');
    setTimeout(() => {
      window.location.href = 'mis-reservas.html';
    }, 1500);
  } catch (err) {
    console.error('Error al crear reserva:', err);
    showAlert('reserva-alert', 'Error al crear la reserva. Intentá de nuevo.');
    btn.disabled = false;
  }
}

// ─── Cargar mis reservas ───
async function loadMyReservations(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const user = auth.currentUser;
  if (!user) return;

  container.innerHTML = '<div class="loading-overlay"><div class="spinner"></div> Cargando reservas...</div>';

  try {
    const snapshot = await db.collection('reservations')
      .where('userId', '==', user.uid)
      .orderBy('fecha', 'desc')
      .orderBy('hora', 'desc')
      .get();

    if (snapshot.empty) {
      container.innerHTML = `
        <div class="empty-state">
          <p>No tenés reservas todavía.</p>
          <a href="nueva-reserva.html" class="btn btn-primary">Reservar turno</a>
        </div>`;
      return;
    }

    let html = `
    <div class="table-responsive">
      <table>
        <thead>
          <tr>
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
      const canEdit = r.estado !== 'cancelada';
      html += `
          <tr>
            <td>${r.servicioNombre}</td>
            <td>${formatDate(r.fecha)}</td>
            <td>${r.hora}</td>
            <td><span class="badge badge-${r.estado}">${r.estado}</span></td>
            <td>
              <div class="btn-group">
                ${canEdit ? `<a href="editar-reserva.html?id=${doc.id}" class="btn btn-sm btn-secondary">Editar</a>` : ''}
                ${canEdit ? `<button class="btn btn-sm btn-danger" onclick="cancelReservation('${doc.id}')">Cancelar</button>` : ''}
              </div>
            </td>
          </tr>`;
    });

    html += '</tbody></table></div>';
    container.innerHTML = html;
  } catch (err) {
    console.error('Error al cargar reservas:', err);
    container.innerHTML = '<div class="alert alert-error">Error al cargar las reservas.</div>';
  }
}

// ─── Historial de tratamientos realizados ───
async function loadTreatmentHistory(containerId, wrapperClass) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const user = auth.currentUser;
  if (!user) return;

  const today = new Date().toISOString().split('T')[0];

  try {
    const snapshot = await db.collection('reservations')
      .where('userId', '==', user.uid)
      .where('estado', '==', 'confirmada')
      .where('fecha', '<', today)
      .orderBy('fecha', 'desc')
      .get();

    if (snapshot.empty) return; // no mostrar la sección si no hay historial

    // Mostrar el wrapper
    const wrapper = document.querySelector('.' + wrapperClass) || document.getElementById(wrapperClass);
    if (wrapper) wrapper.classList.remove('hidden');
    const hiddenEl = document.getElementById('historial-container');
    if (hiddenEl) hiddenEl.classList.remove('hidden');

    let html = '<div class="historial-grid">';
    snapshot.forEach(doc => {
      const r = doc.data();
      html += `
        <div class="historial-item">
          <div class="historial-fecha">${formatDate(r.fecha)}</div>
          <div class="historial-servicio">${r.servicioNombre}</div>
          ${r.precioTotal ? `<div class="historial-precio">$${r.precioTotal.toLocaleString('es-AR')}</div>` : ''}
        </div>`;
    });
    html += '</div>';
    container.innerHTML = html;

  } catch (err) {
    console.warn('Error al cargar historial:', err.message);
  }
}

// ─── Cancelar reserva ───
async function cancelReservation(reservationId) {
  if (!confirm('¿Estás segura de que querés cancelar esta reserva?')) return;

  try {
    await db.collection('reservations').doc(reservationId).update({
      estado: 'cancelada',
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    // Recargar lista
    loadMyReservations('reservations-list');
    showAlert('reserva-alert', 'Reserva cancelada.', 'warning');
  } catch (err) {
    console.error('Error al cancelar:', err);
    showAlert('reserva-alert', 'Error al cancelar la reserva.');
  }
}

// ─── Cargar datos de reserva para edición ───
async function loadReservationForEdit(reservationId) {
  try {
    const doc = await db.collection('reservations').doc(reservationId).get();
    if (!doc.exists) {
      showAlert('reserva-alert', 'Reserva no encontrada.');
      return null;
    }

    const data = doc.data();
    const user = auth.currentUser;

    // Verificar que sea del usuario
    if (data.userId !== user.uid) {
      showAlert('reserva-alert', 'No tenés permiso para editar esta reserva.');
      return null;
    }

    if (data.estado === 'cancelada') {
      showAlert('reserva-alert', 'No se puede editar una reserva cancelada.');
      return null;
    }

    return { id: doc.id, ...data };
  } catch (err) {
    console.error('Error al cargar reserva:', err);
    showAlert('reserva-alert', 'Error al cargar la reserva.');
    return null;
  }
}

// ─── Guardar edición de reserva ───
async function handleEditReservation(e, reservationId) {
  e.preventDefault();
  const btn = e.target.querySelector('button[type="submit"]');
  btn.disabled = true;

  const servicioSelect = document.getElementById('reserva-servicio');
  const fecha = document.getElementById('reserva-fecha').value;
  const hora = document.getElementById('selected-time').value;

  if (!servicioSelect.value || !fecha || !hora) {
    showAlert('reserva-alert', 'Completá todos los campos y seleccioná un horario.');
    btn.disabled = false;
    return;
  }

  // Verificar que no esté ocupado (excluyendo la reserva actual)
  const occupied = await getOccupiedSlots(fecha, reservationId);
  if (occupied.includes(hora)) {
    showAlert('reserva-alert', 'Ese horario ya está ocupado. Elegí otro.');
    btn.disabled = false;
    renderTimeSlots('time-slots-container', fecha, reservationId);
    return;
  }

  const selectedOption = servicioSelect.options[servicioSelect.selectedIndex];

  try {
    await db.collection('reservations').doc(reservationId).update({
      servicioId: servicioSelect.value,
      servicioNombre: selectedOption.dataset.nombre,
      fecha: fecha,
      hora: hora,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    showAlert('reserva-alert', 'Reserva actualizada con éxito.', 'success');
    setTimeout(() => {
      window.location.href = 'mis-reservas.html';
    }, 1500);
  } catch (err) {
    console.error('Error al editar reserva:', err);
    showAlert('reserva-alert', 'Error al actualizar la reserva.');
    btn.disabled = false;
  }
}
