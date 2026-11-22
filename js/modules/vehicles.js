/**
 * Member 2 Deliverable: Vehicle Registration & Dashboard Module
 * Handles Vehicle Registration, Owner Linkage, Fuel Types, Update/Delete, and Vehicle Dashboard.
 */

const VehicleModule = (() => {
  let currentEditingVehicleId = null;

  const init = () => {
    bindEvents();
    renderVehicleList();
    populateVehicleDropdowns();
  };

  const bindEvents = () => {
    // Vehicle Registration Form Submit
    const form = document.getElementById('form-vehicle-register');
    if (form) {
      form.addEventListener('submit', handleVehicleSubmit);
    }

    // Vehicle Edit Form Submit
    const editForm = document.getElementById('form-vehicle-edit');
    if (editForm) {
      editForm.addEventListener('submit', handleVehicleEditSubmit);
    }

    // Search input
    const searchInput = document.getElementById('vehicle-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', () => {
        applyVehicleFilters();
      });
    }

    // Fuel Type Filter
    const fuelFilter = document.getElementById('vehicle-fuel-filter');
    if (fuelFilter) {
      fuelFilter.addEventListener('change', () => {
        applyVehicleFilters();
      });
    }

    // Owner Filter
    const ownerFilter = document.getElementById('vehicle-owner-filter');
    if (ownerFilter) {
      ownerFilter.addEventListener('change', () => {
        applyVehicleFilters();
      });
    }

    // Close Modals
    document.querySelectorAll('.close-vehicle-modal').forEach((btn) => {
      btn.addEventListener('click', closeModals);
    });

    // Auto-generate vehicle ID button
    const btnGenId = document.getElementById('btn-generate-veh-id');
    if (btnGenId) {
      btnGenId.addEventListener('click', () => {
        const idInput = document.getElementById('veh-id-input');
        if (idInput) idInput.value = Store.generateId('VEH');
      });
    }

    // Store listener
    Store.subscribe((key) => {
      if (key === Store.KEYS.VEHICLES || key === Store.KEYS.OWNERS || key === 'reset') {
        renderVehicleList();
        populateVehicleDropdowns();
      }
    });
  };

  const validateVehicleData = (data) => {
    const errors = [];

    // Registration number format validation (alphanumeric, spaces/hyphens allowed, length 5-15)
    const regClean = data.regNumber.replace(/[\s-]/g, '');
    if (!regClean || regClean.length < 5 || regClean.length > 15) {
      errors.push('Registration number must be 5 to 15 alphanumeric characters (e.g. DL 03 CB 4120).');
    }

    if (!data.manufacturer || data.manufacturer.trim().length < 2) {
      errors.push('Manufacturer is required (e.g., Tata, Hyundai, Toyota).');
    }

    if (!data.model || data.model.trim().length < 1) {
      errors.push('Model name is required (e.g., Nexon EV, Creta, City).');
    }

    if (!data.fuelType) {
      errors.push('Please select a valid fuel type.');
    }

    if (!data.ownerId) {
      errors.push('Please associate this vehicle with a registered Owner.');
    }

    if (!data.purchaseDate) {
      errors.push('Purchase date is required.');
    }

    return errors;
  };

  const handleVehicleSubmit = (e) => {
    e.preventDefault();

    const data = {
      id: document.getElementById('veh-id-input')?.value.trim() || '',
      regNumber: document.getElementById('veh-reg-input').value.trim(),
      manufacturer: document.getElementById('veh-make-input').value.trim(),
      model: document.getElementById('veh-model-input').value.trim(),
      fuelType: document.getElementById('veh-fuel-input').value,
      purchaseDate: document.getElementById('veh-date-input').value,
      insuranceExpiry: document.getElementById('veh-insurance-input').value,
      pucExpiry: document.getElementById('veh-puc-input').value,
      ownerId: document.getElementById('veh-owner-input').value
    };

    const errors = validateVehicleData(data);
    const errorBox = document.getElementById('vehicle-form-errors');

    if (errors.length > 0) {
      if (errorBox) {
        errorBox.innerHTML = errors.map((e) => `<div>• ${e}</div>`).join('');
        errorBox.classList.remove('hidden');
      }
      return;
    }

    if (errorBox) errorBox.classList.add('hidden');

    try {
      const newVeh = Store.addVehicle(data);
      App.showToast(`Vehicle "${newVeh.manufacturer} ${newVeh.model}" (${newVeh.regNumber}) registered!`, 'success');
      document.getElementById('form-vehicle-register').reset();
      const idInput = document.getElementById('veh-id-input');
      if (idInput) idInput.value = Store.generateId('VEH');
      renderVehicleList();
    } catch (err) {
      if (errorBox) {
        errorBox.innerHTML = `<div>• ${err.message}</div>`;
        errorBox.classList.remove('hidden');
      }
      App.showToast(err.message, 'error');
    }
  };

  const applyVehicleFilters = () => {
    const searchVal = document.getElementById('vehicle-search-input')?.value.trim().toLowerCase() || '';
    const fuelVal = document.getElementById('vehicle-fuel-filter')?.value || '';
    const ownerVal = document.getElementById('vehicle-owner-filter')?.value || '';

    let vehicles = Store.getVehicles();

    if (searchVal) {
      vehicles = vehicles.filter(
        (v) =>
          v.regNumber.toLowerCase().includes(searchVal) ||
          v.manufacturer.toLowerCase().includes(searchVal) ||
          v.model.toLowerCase().includes(searchVal) ||
          v.id.toLowerCase().includes(searchVal)
      );
    }

    if (fuelVal) {
      vehicles = vehicles.filter((v) => v.fuelType === fuelVal);
    }

    if (ownerVal) {
      vehicles = vehicles.filter((v) => v.ownerId === ownerVal);
    }

    renderVehicleCards(vehicles);
  };

  const renderVehicleList = () => {
    applyVehicleFilters();
  };

  const renderVehicleCards = (vehicles) => {
    const container = document.getElementById('vehicles-list-container');
    if (!container) return;

    const countBadge = document.getElementById('vehicles-count-badge');
    if (countBadge) countBadge.textContent = `${vehicles.length} Vehicles`;

    if (vehicles.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon"><i class="fas fa-car"></i></div>
          <h3>No Vehicles Found</h3>
          <p>Register a vehicle or adjust your filters.</p>
        </div>
      `;
      return;
    }

    const owners = Store.getOwners();
    const services = Store.getServices();

    container.innerHTML = vehicles
      .map((veh) => {
        const owner = owners.find((o) => o.id === veh.ownerId);
        const ownerName = owner ? owner.name : 'Unknown Owner';
        const ownerMobile = owner ? owner.mobile : '';

        const vehServices = services.filter((s) => s.vehicleId === veh.id);
        const totalExp = vehServices.reduce((acc, s) => acc + (s.totalExpenses || 0), 0);

        // Insurance & PUC status badges
        const insStatus = checkExpiryStatus(veh.insuranceExpiry);
        const pucStatus = checkExpiryStatus(veh.pucExpiry);

        const fuelBadgeClass = getFuelBadgeClass(veh.fuelType);

        return `
        <div class="vehicle-card card">
          <div class="veh-card-header">
            <div>
              <span class="badge ${fuelBadgeClass}"><i class="${getFuelIcon(veh.fuelType)}"></i> ${escapeHtml(veh.fuelType)}</span>
              <h3 class="veh-title">${escapeHtml(veh.manufacturer)} ${escapeHtml(veh.model)}</h3>
              <div class="veh-reg-plate font-mono">${escapeHtml(veh.regNumber)}</div>
            </div>
            <div class="veh-id-badge"><i class="fas fa-barcode"></i> ${escapeHtml(veh.id)}</div>
          </div>

          <div class="veh-card-body">
            <div class="veh-owner-chip" onclick="OwnerModule.openProfileModal('${veh.ownerId}')" title="Click to view Owner Profile">
              <i class="fas fa-user-circle"></i>
              <div>
                <span class="voc-label">Owner</span>
                <span class="voc-name">${escapeHtml(ownerName)}</span>
              </div>
            </div>

            <div class="veh-meta-grid">
              <div class="meta-item">
                <span class="meta-label">Purchase Date:</span>
                <span class="meta-val">${veh.purchaseDate || 'N/A'}</span>
              </div>
              <div class="meta-item">
                <span class="meta-label">Total Services:</span>
                <span class="meta-val font-semibold">${vehServices.length} record(s)</span>
              </div>
              <div class="meta-item">
                <span class="meta-label">Maintenance Spend:</span>
                <span class="meta-val text-brand font-semibold">₹${totalExp.toLocaleString('en-IN')}</span>
              </div>
            </div>

            <!-- Expiry Trackers -->
            <div class="doc-expiry-box">
              <div class="doc-pill ${insStatus.colorClass}">
                <i class="fas fa-shield-alt"></i>
                <div class="doc-pill-info">
                  <span class="doc-pill-title">Insurance</span>
                  <span class="doc-pill-sub">${insStatus.text} (${veh.insuranceExpiry || 'Not set'})</span>
                </div>
              </div>

              <div class="doc-pill ${pucStatus.colorClass}">
                <i class="fas fa-smog"></i>
                <div class="doc-pill-info">
                  <span class="doc-pill-title">PUC Certificate</span>
                  <span class="doc-pill-sub">${pucStatus.text} (${veh.pucExpiry || 'Not set'})</span>
                </div>
              </div>
            </div>
          </div>

          <div class="veh-card-footer">
            <button class="btn btn-primary-soft btn-sm" onclick="VehicleModule.openEditModal('${veh.id}')">
              <i class="fas fa-edit"></i> Edit
            </button>
            <button class="btn btn-secondary btn-sm" onclick="App.openNewServiceForVehicle('${veh.id}')">
              <i class="fas fa-wrench"></i> Add Service
            </button>
            <button class="btn btn-secondary btn-sm" onclick="App.openBookingForVehicle('${veh.id}')">
              <i class="fas fa-calendar-check"></i> Book Appt
            </button>
            <button class="btn btn-danger-soft btn-sm" onclick="VehicleModule.handleDelete('${veh.id}')" title="Delete Vehicle">
              <i class="fas fa-trash"></i>
            </button>
          </div>
        </div>
      `;
      })
      .join('');
  };

  const getFuelBadgeClass = (fuel) => {
    switch (fuel) {
      case 'Electric':
        return 'badge-electric';
      case 'Hybrid':
        return 'badge-hybrid';
      case 'Diesel':
        return 'badge-diesel';
      case 'CNG':
        return 'badge-cng';
      default:
        return 'badge-petrol';
    }
  };

  const getFuelIcon = (fuel) => {
    switch (fuel) {
      case 'Electric':
        return 'fas fa-bolt';
      case 'Hybrid':
        return 'fas fa-leaf';
      case 'Diesel':
        return 'fas fa-gas-pump';
      case 'CNG':
        return 'fas fa-burn';
      default:
        return 'fas fa-gas-pump';
    }
  };

  const checkExpiryStatus = (dateStr) => {
    if (!dateStr) return { text: 'Not configured', colorClass: 'doc-unknown' };
    const exp = new Date(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diffTime = exp - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return { text: `Expired ${Math.abs(diffDays)}d ago`, colorClass: 'doc-critical' };
    } else if (diffDays <= 7) {
      return { text: `Expires in ${diffDays}d (Urgent)`, colorClass: 'doc-critical' };
    } else if (diffDays <= 30) {
      return { text: `Expires in ${diffDays}d`, colorClass: 'doc-warning' };
    } else {
      return { text: `Valid (${diffDays}d left)`, colorClass: 'doc-valid' };
    }
  };

  const openEditModal = (vehId) => {
    const veh = Store.getVehicleById(vehId);
    if (!veh) return;

    currentEditingVehicleId = vehId;
    document.getElementById('edit-veh-id').value = veh.id;
    document.getElementById('edit-veh-reg').value = veh.regNumber;
    document.getElementById('edit-veh-make').value = veh.manufacturer;
    document.getElementById('edit-veh-model').value = veh.model;
    document.getElementById('edit-veh-fuel').value = veh.fuelType;
    document.getElementById('edit-veh-date').value = veh.purchaseDate || '';
    document.getElementById('edit-veh-insurance').value = veh.insuranceExpiry || '';
    document.getElementById('edit-veh-puc').value = veh.pucExpiry || '';

    // Populate Owner dropdown in edit modal
    const editOwnerSelect = document.getElementById('edit-veh-owner');
    const owners = Store.getOwners();
    if (editOwnerSelect) {
      editOwnerSelect.innerHTML = owners
        .map((o) => `<option value="${o.id}" ${o.id === veh.ownerId ? 'selected' : ''}>${escapeHtml(o.name)} (${o.id})</option>`)
        .join('');
    }

    const modal = document.getElementById('modal-vehicle-edit');
    if (modal) {
      modal.classList.remove('hidden');
      modal.classList.add('flex');
    }
  };

  const handleVehicleEditSubmit = (e) => {
    e.preventDefault();
    if (!currentEditingVehicleId) return;

    const data = {
      regNumber: document.getElementById('edit-veh-reg').value.trim(),
      manufacturer: document.getElementById('edit-veh-make').value.trim(),
      model: document.getElementById('edit-veh-model').value.trim(),
      fuelType: document.getElementById('edit-veh-fuel').value,
      purchaseDate: document.getElementById('edit-veh-date').value,
      insuranceExpiry: document.getElementById('edit-veh-insurance').value,
      pucExpiry: document.getElementById('edit-veh-puc').value,
      ownerId: document.getElementById('edit-veh-owner').value
    };

    const errors = validateVehicleData(data);
    const errorBox = document.getElementById('edit-vehicle-errors');

    if (errors.length > 0) {
      if (errorBox) {
        errorBox.innerHTML = errors.map((e) => `<div>• ${e}</div>`).join('');
        errorBox.classList.remove('hidden');
      }
      return;
    }

    try {
      Store.updateVehicle(currentEditingVehicleId, data);
      App.showToast(`Vehicle "${data.regNumber}" updated successfully!`, 'success');
      closeModals();
      renderVehicleList();
    } catch (err) {
      if (errorBox) {
        errorBox.innerHTML = `<div>• ${err.message}</div>`;
        errorBox.classList.remove('hidden');
      }
      App.showToast(err.message, 'error');
    }
  };

  const handleDelete = (vehId) => {
    const veh = Store.getVehicleById(vehId);
    if (!veh) return;

    if (
      !confirm(
        `Are you sure you want to delete vehicle ${veh.manufacturer} ${veh.model} (${veh.regNumber})?\n\nNote: Any associated service records and appointments will also be cleaned up.`
      )
    ) {
      return;
    }

    try {
      const res = Store.deleteVehicle(vehId);
      App.showToast(`Vehicle ${veh.regNumber} deleted. (Removed ${res.removedServices} service records).`, 'info');
      renderVehicleList();
    } catch (err) {
      alert(err.message);
      App.showToast(err.message, 'error');
    }
  };

  const closeModals = () => {
    document.querySelectorAll('.vehicle-modal').forEach((m) => {
      m.classList.add('hidden');
      m.classList.remove('flex');
    });
  };

  const populateVehicleDropdowns = () => {
    const vehicles = Store.getVehicles();
    const vehSelects = document.querySelectorAll('.vehicle-select-dropdown');

    vehSelects.forEach((select) => {
      const val = select.value;
      select.innerHTML =
        '<option value="">-- Select Registered Vehicle --</option>' +
        vehicles
          .map((v) => `<option value="${v.id}">${escapeHtml(v.regNumber)} - ${escapeHtml(v.manufacturer)} ${escapeHtml(v.model)}</option>`)
          .join('');
      if (val) select.value = val;
    });

    // Populate vehicle owner filter
    const ownerFilter = document.getElementById('vehicle-owner-filter');
    const owners = Store.getOwners();
    if (ownerFilter) {
      const current = ownerFilter.value;
      ownerFilter.innerHTML =
        '<option value="">All Owners</option>' +
        owners.map((o) => `<option value="${o.id}">${escapeHtml(o.name)}</option>`).join('');
      if (current) ownerFilter.value = current;
    }
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
    renderVehicleList,
    openEditModal,
    handleDelete,
    closeModals,
    populateVehicleDropdowns,
    checkExpiryStatus
  };
})();
