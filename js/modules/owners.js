/**
 * Member 1 Deliverable: Owner Registration & Profile Management Module
 * Handles Owner CRUD, Form Validations, LocalStorage Persistence, and Profile Views.
 */

const OwnerModule = (() => {
  let currentEditingOwnerId = null;

  const init = () => {
    bindEvents();
    renderOwnersList();
    populateOwnerFilter();
    const idInput = document.getElementById('owner-id-input');
    if (idInput && !idInput.value) idInput.value = Store.generateId('OWN');
  };

  const bindEvents = () => {
    // Owner Registration Form
    const form = document.getElementById('form-owner-register');
    if (form) {
      form.addEventListener('submit', handleOwnerSubmit);
    }

    // Auto-generate Owner ID Button
    const btnGenId = document.getElementById('btn-generate-owner-id');
    if (btnGenId) {
      btnGenId.addEventListener('click', () => {
        const idInput = document.getElementById('owner-id-input');
        if (idInput) idInput.value = Store.generateId('OWN');
      });
    }

    // Search & Filter
    const searchInput = document.getElementById('owner-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', () => {
        renderOwnersList(searchInput.value.trim());
      });
    }

    // Edit Owner Form
    const editForm = document.getElementById('form-owner-edit');
    if (editForm) {
      editForm.addEventListener('submit', handleOwnerEditSubmit);
    }

    // Close Modal buttons
    document.querySelectorAll('.close-owner-modal').forEach((btn) => {
      btn.addEventListener('click', closeModals);
    });

    // Listen for Store changes to refresh lists
    Store.subscribe((key) => {
      if (key === Store.KEYS.OWNERS || key === 'reset') {
        renderOwnersList();
        populateOwnerFilter();
      }
    });
  };

  // Validation Logic
  const validateOwnerData = (data) => {
    const errors = [];

    if (!data.id || data.id.trim().length < 3) {
      errors.push('Owner ID must be at least 3 characters.');
    }

    if (!data.name || data.name.trim().length < 2) {
      errors.push('Owner full name is required (minimum 2 characters).');
    }

    // 10-digit mobile number validation (standard format)
    const mobileClean = data.mobile.replace(/\D/g, '');
    if (mobileClean.length !== 10) {
      errors.push('Mobile number must be a valid 10-digit phone number.');
    }

    // Standard email regex
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(data.email.trim())) {
      errors.push('Please enter a valid email address.');
    }

    if (!data.address || data.address.trim().length < 5) {
      errors.push('Address must be at least 5 characters long.');
    }

    return errors;
  };

  // Registration handler
  const handleOwnerSubmit = (e) => {
    e.preventDefault();

    const data = {
      id: document.getElementById('owner-id-input').value.trim(),
      name: document.getElementById('owner-name-input').value.trim(),
      mobile: document.getElementById('owner-mobile-input').value.trim(),
      email: document.getElementById('owner-email-input').value.trim(),
      address: document.getElementById('owner-address-input').value.trim()
    };

    const errors = validateOwnerData(data);
    const errorBox = document.getElementById('owner-form-errors');

    if (errors.length > 0) {
      if (errorBox) {
        errorBox.innerHTML = errors.map((err) => `<div>• ${err}</div>`).join('');
        errorBox.classList.remove('hidden');
      }
      return;
    }

    if (errorBox) errorBox.classList.add('hidden');

    try {
      const newOwner = Store.addOwner(data);
      App.showToast(`Owner "${newOwner.name}" successfully registered! (ID: ${newOwner.id})`, 'success');
      document.getElementById('form-owner-register').reset();
      // Auto-assign new generated ID for next entry
      const idInput = document.getElementById('owner-id-input');
      if (idInput) idInput.value = Store.generateId('OWN');
      renderOwnersList();
    } catch (err) {
      if (errorBox) {
        errorBox.innerHTML = `<div>• ${err.message}</div>`;
        errorBox.classList.remove('hidden');
      }
      App.showToast(err.message, 'error');
    }
  };

  // Render Owners Cards/Table
  const renderOwnersList = (filterTerm = '') => {
    const container = document.getElementById('owners-list-container');
    if (!container) return;

    let owners = Store.getOwners();
    const vehicles = Store.getVehicles();

    if (filterTerm) {
      const term = filterTerm.toLowerCase();
      owners = owners.filter(
        (o) =>
          o.name.toLowerCase().includes(term) ||
          o.id.toLowerCase().includes(term) ||
          o.email.toLowerCase().includes(term) ||
          o.mobile.includes(term)
      );
    }

    const countEl = document.getElementById('owners-count-badge');
    if (countEl) countEl.textContent = `${owners.length} Registered`;

    if (owners.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon"><i class="fas fa-user"></i></div>
          <h3>No Owners Found</h3>
          <p>${filterTerm ? 'No owner matches your search filter.' : 'Register your first vehicle owner using the form.'}</p>
        </div>
      `;
      return;
    }

    container.innerHTML = owners
      .map((owner) => {
        const ownerVehicles = vehicles.filter((v) => v.ownerId === owner.id);
        return `
        <div class="owner-card card">
          <div class="owner-card-header">
            <div class="owner-avatar-bubble">
              ${owner.name.charAt(0).toUpperCase()}
            </div>
            <div class="owner-primary-info">
              <h4 class="owner-name">${escapeHtml(owner.name)}</h4>
              <span class="owner-id-tag"><i class="fas fa-id-badge"></i> ${escapeHtml(owner.id)}</span>
            </div>
            <div class="owner-vehicles-badge ${ownerVehicles.length > 0 ? 'active' : 'empty'}">
              <i class="fas fa-car"></i> ${ownerVehicles.length} ${ownerVehicles.length === 1 ? 'Vehicle' : 'Vehicles'}
            </div>
          </div>
          
          <div class="owner-details-grid">
            <div class="owner-detail-row">
              <span class="detail-label"><i class="fas fa-phone"></i> Mobile:</span>
              <span class="detail-val font-mono">${escapeHtml(owner.mobile)}</span>
            </div>
            <div class="owner-detail-row">
              <span class="detail-label"><i class="fas fa-envelope"></i> Email:</span>
              <span class="detail-val">${escapeHtml(owner.email)}</span>
            </div>
            <div class="owner-detail-row full-width">
              <span class="detail-label"><i class="fas fa-map-marker-alt"></i> Address:</span>
              <span class="detail-val">${escapeHtml(owner.address)}</span>
            </div>
          </div>

          <div class="owner-card-actions">
            <button class="btn btn-secondary btn-sm" onclick="OwnerModule.openProfileModal('${owner.id}')">
              <i class="fas fa-eye"></i> View Profile
            </button>
            <button class="btn btn-primary-soft btn-sm" onclick="OwnerModule.openEditModal('${owner.id}')">
              <i class="fas fa-edit"></i> Edit
            </button>
            <button class="btn btn-danger-soft btn-sm" onclick="OwnerModule.handleDelete('${owner.id}')">
              <i class="fas fa-trash"></i> Delete
            </button>
          </div>
        </div>
      `;
      })
      .join('');
  };

  // View Profile Modal
  const openProfileModal = (ownerId) => {
    const owner = Store.getOwnerById(ownerId);
    if (!owner) return;

    const vehicles = Store.getVehiclesByOwner(ownerId);
    const services = Store.getServices().filter((s) => s.ownerId === ownerId);
    const appointments = Store.getAppointments().filter((a) => a.ownerId === ownerId);

    const modal = document.getElementById('modal-owner-profile');
    const content = document.getElementById('owner-profile-content');
    if (!modal || !content) return;

    const totalSpent = services.reduce((acc, s) => acc + (s.totalExpenses || 0), 0);

    content.innerHTML = `
      <div class="profile-hero">
        <div class="profile-avatar-large">
          ${owner.name.charAt(0).toUpperCase()}
        </div>
        <div class="profile-hero-text">
          <h2>${escapeHtml(owner.name)}</h2>
          <div class="profile-id-pill"><i class="fas fa-fingerprint"></i> ID: ${escapeHtml(owner.id)}</div>
          <p class="profile-date"><i class="far fa-calendar-alt"></i> Registered since: ${owner.createdDate || 'N/A'}</p>
        </div>
      </div>

      <div class="stats-mini-row">
        <div class="stat-pill">
          <span class="stat-num">${vehicles.length}</span>
          <span class="stat-lbl">Vehicles</span>
        </div>
        <div class="stat-pill">
          <span class="stat-num">${services.length}</span>
          <span class="stat-lbl">Services Done</span>
        </div>
        <div class="stat-pill">
          <span class="stat-num">₹${totalSpent.toLocaleString('en-IN')}</span>
          <span class="stat-lbl">Total Spent</span>
        </div>
        <div class="stat-pill">
          <span class="stat-num">${appointments.length}</span>
          <span class="stat-lbl">Appointments</span>
        </div>
      </div>

      <div class="profile-section">
        <h4 class="section-title"><i class="fas fa-id-card"></i> Contact Information</h4>
        <div class="profile-info-grid">
          <div><strong>Mobile:</strong> ${escapeHtml(owner.mobile)}</div>
          <div><strong>Email:</strong> ${escapeHtml(owner.email)}</div>
          <div class="full"><strong>Residential Address:</strong> ${escapeHtml(owner.address)}</div>
        </div>
      </div>

      <div class="profile-section">
        <h4 class="section-title"><i class="fas fa-car-side"></i> Registered Vehicles (${vehicles.length})</h4>
        ${
          vehicles.length === 0
            ? '<p class="text-muted">No vehicles linked to this owner yet. Add one from the Vehicle Registration tab.</p>'
            : `<div class="profile-vehicles-list">
              ${vehicles
                .map(
                  (v) => `
                <div class="profile-vehicle-card">
                  <div class="pv-header">
                    <strong>${escapeHtml(v.manufacturer)} ${escapeHtml(v.model)}</strong>
                    <span class="badge badge-outline">${escapeHtml(v.fuelType)}</span>
                  </div>
                  <div class="pv-reg font-mono">${escapeHtml(v.regNumber)}</div>
                  <div class="pv-footer">
                    <span>Purchased: ${v.purchaseDate || 'N/A'}</span>
                    <button class="btn btn-xs btn-outline" onclick="App.navigateTo('vehicles'); OwnerModule.closeModals();">Manage Vehicle</button>
                  </div>
                </div>
              `
                )
                .join('')}
            </div>`
        }
      </div>
    `;

    modal.classList.remove('hidden');
    modal.classList.add('flex');
  };

  // Edit Modal
  const openEditModal = (ownerId) => {
    const owner = Store.getOwnerById(ownerId);
    if (!owner) return;

    currentEditingOwnerId = ownerId;
    document.getElementById('edit-owner-id').value = owner.id;
    document.getElementById('edit-owner-name').value = owner.name;
    document.getElementById('edit-owner-mobile').value = owner.mobile;
    document.getElementById('edit-owner-email').value = owner.email;
    document.getElementById('edit-owner-address').value = owner.address;

    const errorBox = document.getElementById('edit-owner-errors');
    if (errorBox) errorBox.classList.add('hidden');

    const modal = document.getElementById('modal-owner-edit');
    if (modal) {
      modal.classList.remove('hidden');
      modal.classList.add('flex');
    }
  };

  const handleOwnerEditSubmit = (e) => {
    e.preventDefault();
    if (!currentEditingOwnerId) return;

    const data = {
      id: currentEditingOwnerId,
      name: document.getElementById('edit-owner-name').value.trim(),
      mobile: document.getElementById('edit-owner-mobile').value.trim(),
      email: document.getElementById('edit-owner-email').value.trim(),
      address: document.getElementById('edit-owner-address').value.trim()
    };

    const errors = validateOwnerData(data);
    const errorBox = document.getElementById('edit-owner-errors');

    if (errors.length > 0) {
      if (errorBox) {
        errorBox.innerHTML = errors.map((err) => `<div>• ${err}</div>`).join('');
        errorBox.classList.remove('hidden');
      }
      return;
    }

    try {
      Store.updateOwner(currentEditingOwnerId, data);
      App.showToast(`Owner details updated for "${data.name}"`, 'success');
      closeModals();
      renderOwnersList();
    } catch (err) {
      if (errorBox) {
        errorBox.innerHTML = `<div>• ${err.message}</div>`;
        errorBox.classList.remove('hidden');
      }
      App.showToast(err.message, 'error');
    }
  };

  const handleDelete = (ownerId) => {
    const owner = Store.getOwnerById(ownerId);
    if (!owner) return;

    if (!confirm(`Are you sure you want to delete owner "${owner.name}" (${owner.id})?`)) {
      return;
    }

    try {
      Store.deleteOwner(ownerId);
      App.showToast(`Owner "${owner.name}" deleted successfully.`, 'info');
      renderOwnersList();
    } catch (err) {
      alert(err.message);
      App.showToast(err.message, 'error');
    }
  };

  const closeModals = () => {
    document.querySelectorAll('.owner-modal').forEach((m) => {
      m.classList.add('hidden');
      m.classList.remove('flex');
    });
  };

  const populateOwnerFilter = () => {
    // Also helper for other modules to populate dropdowns
    const ownerSelects = document.querySelectorAll('.owner-select-dropdown');
    const owners = Store.getOwners();

    ownerSelects.forEach((select) => {
      const selectedValue = select.value;
      select.innerHTML = '<option value="">-- Select Registered Owner --</option>' +
        owners.map((o) => `<option value="${o.id}">${escapeHtml(o.name)} (${escapeHtml(o.id)})</option>`).join('');
      if (selectedValue) select.value = selectedValue;
    });
  };

  const escapeHtml = (str) => {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  };

  return {
    init,
    renderOwnersList,
    openProfileModal,
    openEditModal,
    handleDelete,
    closeModals,
    populateOwnerFilter
  };
})();
