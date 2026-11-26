/**
 * Customer / Vehicle Owner Portal Module
 * Provides a dedicated, consumer-facing experience: My Garage, Booking Wizard,
 * Live Service Tracker, Invoices, Cost Estimator, and Profile & SOS Assistance.
 */

const CustomerModule = (() => {
  let activeCustomerOwnerId = null;
  let selectedPackages = ['Comprehensive Periodic Service'];
  let selectedSlot = '10:00 AM';

  const SERVICE_PACKAGES = [
    {
      id: 'pkg-basic',
      name: 'Basic Inspection & Oil Top-up',
      price: 2499,
      icon: 'fas fa-oil-can',
      description: 'Engine oil top-up, 20-point vital inspection, coolant check, and tire pressure check.'
    },
    {
      id: 'pkg-periodic',
      name: 'Comprehensive Periodic Service',
      price: 5499,
      icon: 'fas fa-tools',
      description: 'Full synthetic oil replacement, oil filter, air filter cleaning, brake check, suspension & AC scan.'
    },
    {
      id: 'pkg-brake',
      name: 'Brake System Overhaul',
      price: 3800,
      icon: 'fas fa-compact-disc',
      description: 'Brake pads inspection/replacement, disc rotor resurfacing check, and DOT 4 brake fluid top-up.'
    },
    {
      id: 'pkg-ac',
      name: 'AC Cooling & Gas Recharge',
      price: 2200,
      icon: 'fas fa-snowflake',
      description: 'AC condenser cleanup, refrigerant gas replenishment, cabin antibacterial treatment, and filter swap.'
    },
    {
      id: 'pkg-ev',
      name: 'EV Diagnostics & Battery Health',
      price: 4200,
      icon: 'fas fa-bolt',
      description: 'High-voltage battery diagnostic scan, battery pack coolant flush, firmware update, and regen brake check.'
    },
    {
      id: 'pkg-detail',
      name: 'Premium Spa & Foam Detailing',
      price: 1800,
      icon: 'fas fa-shower',
      description: 'High-pressure foam wash, interior vacuuming, dashboard polish, exterior ceramic wax protection.'
    }
  ];

  const init = () => {
    bindEvents();
    syncActiveCustomerFromAuth();
    renderCustomerPortal();
  };

  const syncActiveCustomerFromAuth = () => {
    const authUser = Store.getAuthUser();
    const owners = Store.getOwners();

    if (authUser && authUser.email) {
      const match = owners.find((o) => o.email.toLowerCase() === authUser.email.toLowerCase());
      if (match) {
        activeCustomerOwnerId = match.id;
      } else if (owners.length > 0) {
        if (!owners.some((o) => o.id === activeCustomerOwnerId)) {
          activeCustomerOwnerId = owners[0].id;
        }
      }
    } else if (owners.length > 0 && !activeCustomerOwnerId) {
      activeCustomerOwnerId = owners[0].id;
    }
  };

  const bindEvents = () => {
    // Switch Customer Persona Dropdown
    const personaSelect = document.getElementById('customer-persona-select');
    if (personaSelect) {
      personaSelect.addEventListener('change', (e) => {
        activeCustomerOwnerId = e.target.value;
        renderCustomerPortal();
        App.showToast(`Switched active customer to ${getCurrentOwner()?.name}`, 'info');
      });
    }

    // Customer Navigation Links
    document.querySelectorAll('.customer-nav-link').forEach((link) => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const viewId = link.getAttribute('data-cust-view');
        showCustomerView(viewId);
      });
    });

    // Add Vehicle to My Garage Form
    const addVehicleForm = document.getElementById('form-customer-add-vehicle');
    if (addVehicleForm) {
      addVehicleForm.addEventListener('submit', handleAddCustomerVehicle);
    }

    // Customer Booking Form
    const bookingForm = document.getElementById('form-customer-book-service');
    if (bookingForm) {
      bookingForm.addEventListener('submit', handleCustomerBookingSubmit);
    }

    // Customer Profile Update Form
    const profileForm = document.getElementById('form-customer-profile-update');
    if (profileForm) {
      profileForm.addEventListener('submit', handleCustomerProfileUpdate);
    }

    // Cost Estimator inputs
    const estimatorInputs = document.querySelectorAll('.estimator-trigger');
    estimatorInputs.forEach((input) => {
      input.addEventListener('change', updateCostEstimate);
    });

    // Store sync listener
    Store.subscribe(() => {
      syncActiveCustomerFromAuth();
      renderCustomerPortal();
    });
  };

  const getCurrentOwner = () => {
    const owner = Store.getOwnerById(activeCustomerOwnerId);
    if (owner) return owner;
    const owners = Store.getOwners();
    return owners[0] || null;
  };

  const showCustomerView = (viewName) => {
    // Update active nav link
    document.querySelectorAll('.customer-nav-link').forEach((link) => {
      if (link.getAttribute('data-cust-view') === viewName) {
        link.classList.add('active');
      } else {
        link.classList.remove('active');
      }
    });

    // Toggle sub-containers
    document.querySelectorAll('.customer-subview').forEach((view) => {
      if (view.id === `cust-view-${viewName}`) {
        view.classList.remove('hidden');
      } else {
        view.classList.add('hidden');
      }
    });

    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const renderCustomerPortal = () => {
    const owner = getCurrentOwner();
    const personaSelect = document.getElementById('customer-persona-select');
    const owners = Store.getOwners();

    if (personaSelect) {
      if (owners.length > 0) {
        personaSelect.innerHTML = owners
          .map((o) => `<option value="${o.id}" ${o.id === activeCustomerOwnerId ? 'selected' : ''}>${escapeHtml(o.name)} (${o.id})</option>`)
          .join('');
      } else {
        personaSelect.innerHTML = '<option value="">No Registered Owners</option>';
      }
    }

    if (!owner) {
      const welcomeNameEl = document.getElementById('cust-welcome-name');
      if (welcomeNameEl) welcomeNameEl.textContent = 'Valued Customer';
      setText('cust-kpi-vehicles', 0);
      setText('cust-kpi-active-bookings', 0);
      setText('cust-kpi-services-done', 0);
      setText('cust-kpi-total-invested', '₹0');

      const containers = [
        document.getElementById('cust-garage-cards-container'),
        document.getElementById('cust-garage-cards-container-full')
      ].filter(Boolean);
      containers.forEach((c) => {
        c.innerHTML = `
          <div class="empty-state" style="grid-column: 1 / -1;">
            <div class="empty-icon"><i class="fas fa-car"></i></div>
            <h3>Your Garage is Empty</h3>
            <p class="text-muted">You have not added any vehicles yet. Register your vehicle to schedule services and track maintenance.</p>
            <button class="btn btn-primary mt-3" onclick="CustomerModule.openAddVehicleModal()">
              <i class="fas fa-plus"></i> Add Vehicle
            </button>
          </div>
        `;
      });

      const aptListContainer = document.getElementById('cust-appointments-list-container');
      if (aptListContainer) {
        aptListContainer.innerHTML = `
          <div class="empty-state">
            <div class="empty-icon"><i class="fas fa-calendar-alt"></i></div>
            <h3>No Active Bookings</h3>
            <p class="text-muted">You have not scheduled any service appointments yet.</p>
            <button class="btn btn-primary mt-3" onclick="CustomerModule.showCustomerView('book')">
              <i class="fas fa-calendar-plus"></i> Book a Service
            </button>
          </div>
        `;
      }

      const invContainer = document.getElementById('cust-invoices-list-container');
      if (invContainer) {
        invContainer.innerHTML = `
          <div class="empty-state">
            <div class="empty-icon"><i class="fas fa-file-invoice"></i></div>
            <h3>No Service Invoices</h3>
            <p class="text-muted">Invoices will appear here once your service appointments are completed.</p>
          </div>
        `;
      }

      renderPackagesGrid();
      renderCustomerVehicleDropdowns(null);
      renderCustomerTimeSlots();
      updateCostEstimate();
      return;
    }

    // Update Welcome Title
    const welcomeNameEl = document.getElementById('cust-welcome-name');
    if (welcomeNameEl) welcomeNameEl.textContent = owner.name;

    renderDashboardStats(owner);
    renderGarageCards(owner);
    renderPackagesGrid();
    renderCustomerVehicleDropdowns(owner);
    renderCustomerTimeSlots();
    renderCustomerAppointmentsList(owner);
    renderCustomerInvoices(owner);
    populateProfileForm(owner);
    updateCostEstimate();
  };

  const renderDashboardStats = (owner) => {
    const vehicles = Store.getVehiclesByOwner(owner.id);
    const appointments = Store.getAppointments().filter((a) => a.ownerId === owner.id);
    const services = Store.getServices().filter((s) => s.ownerId === owner.id);

    const activeApts = appointments.filter((a) => a.status === 'Confirmed' || a.status === 'Pending' || a.status === 'Rescheduled');
    const totalSpent = services.reduce((acc, s) => acc + (s.totalExpenses || s.totalCost || 0), 0);

    // Document expiry alert check for this owner's cars
    let criticalDocCount = 0;
    const expiryAlerts = [];

    vehicles.forEach((v) => {
      const ins = VehicleModule.checkExpiryStatus(v.insuranceExpiry);
      const puc = VehicleModule.checkExpiryStatus(v.pucExpiry);
      if (ins.colorClass === 'doc-critical') {
        criticalDocCount++;
        expiryAlerts.push(`${v.manufacturer} ${v.model} (${v.regNumber}): Insurance expired or expires in < 7 days.`);
      }
      if (puc.colorClass === 'doc-critical') {
        criticalDocCount++;
        expiryAlerts.push(`${v.manufacturer} ${v.model} (${v.regNumber}): PUC Pollution Certificate renewal required.`);
      }
    });

    setText('cust-kpi-vehicles', vehicles.length);
    setText('cust-kpi-active-bookings', activeApts.length);
    setText('cust-kpi-services-done', services.length);
    setText('cust-kpi-total-invested', `₹${totalSpent.toLocaleString('en-IN')}`);

    // Expiry Notice Banner
    const banner = document.getElementById('cust-expiry-alert-banner');
    if (banner) {
      if (expiryAlerts.length > 0) {
        banner.innerHTML = `
          <div class="alert-box-warning">
            <div class="flex items-center gap-2">
              <i class="fas fa-exclamation-triangle text-danger" style="font-size: 1.25rem;"></i>
              <div>
                <strong>Document Renewal Alert for Your Vehicles:</strong>
                <ul class="text-xs mt-1" style="list-style-type: disc; margin-left: 1.25rem;">
                  ${expiryAlerts.map((a) => `<li>${escapeHtml(a)}</li>`).join('')}
                </ul>
              </div>
            </div>
            <button class="btn btn-xs btn-primary" onclick="CustomerModule.quickBookService()">Schedule Inspection</button>
          </div>
        `;
        banner.classList.remove('hidden');
      } else {
        banner.classList.add('hidden');
      }
    }
  };

  const renderGarageCards = (owner) => {
    const containers = [
      document.getElementById('cust-garage-cards-container'),
      document.getElementById('cust-garage-cards-container-full')
    ].filter(Boolean);

    if (containers.length === 0) return;

    const vehicles = Store.getVehiclesByOwner(owner.id);
    const services = Store.getServices();

    if (vehicles.length === 0) {
      const emptyHtml = `
        <div class="empty-state" style="grid-column: 1 / -1;">
          <div class="empty-icon"><i class="fas fa-car"></i></div>
          <h3>Your Garage is Empty</h3>
          <p class="text-muted">You have not added any vehicles yet. Register your car to schedule services and track maintenance.</p>
          <button class="btn btn-primary mt-3" onclick="CustomerModule.openAddVehicleModal()">
            <i class="fas fa-plus"></i> Add Vehicle to Garage
          </button>
        </div>
      `;
      containers.forEach((c) => { c.innerHTML = emptyHtml; });
      return;
    }

    const cardsHtml = vehicles
      .map((v) => {
        const vServices = services.filter((s) => s.vehicleId === v.id || s.vehicleId === v.vehicleId);
        const insStatus = VehicleModule.checkExpiryStatus(v.insuranceExpiry);
        const pucStatus = VehicleModule.checkExpiryStatus(v.pucExpiry);

        return `
        <div class="garage-car-card card">
          <div class="flex justify-between items-center mb-2">
            <span class="badge ${VehicleModule.getFuelBadgeClass(v.fuelType)}">
              ${escapeHtml(v.fuelType)}
            </span>
            <span class="font-mono text-xs text-muted">ID: ${escapeHtml(v.id || v.vehicleId)}</span>
          </div>

          <div class="car-card-body">
            <h3 class="car-model-name">${escapeHtml(v.manufacturer || v.make)} ${escapeHtml(v.model)}</h3>
            <div class="car-plate-badge font-mono">${escapeHtml(v.regNumber || v.registrationNumber)}</div>

            <div class="car-meta-list mt-3">
              <div class="flex justify-between text-xs py-1 border-b">
                <span class="text-muted"><i class="far fa-calendar-alt"></i> Purchase Date:</span>
                <span class="font-semibold">${v.purchaseDate || 'N/A'}</span>
              </div>
              <div class="flex justify-between text-xs py-1 border-b">
                <span class="text-muted"><i class="fas fa-history"></i> Services Completed:</span>
                <span class="font-semibold">${vServices.length} visits</span>
              </div>
            </div>

            <div class="doc-status-pills mt-3">
              <div class="doc-badge-chip ${insStatus.colorClass}">
                <i class="fas fa-shield-alt"></i>
                <span>Insurance: <strong>${insStatus.text}</strong></span>
              </div>
              <div class="doc-badge-chip ${pucStatus.colorClass}">
                <i class="fas fa-smog"></i>
                <span>PUC: <strong>${pucStatus.text}</strong></span>
              </div>
            </div>
          </div>

          <div class="car-card-actions mt-4 flex gap-2">
            <button class="btn btn-primary btn-sm flex-1" onclick="CustomerModule.bookForVehicle('${v.id || v.vehicleId}')">
              <i class="fas fa-calendar-plus"></i> Book Service
            </button>
            <button class="btn btn-secondary btn-sm" onclick="CustomerModule.viewCarHistory('${v.id || v.vehicleId}')" title="View past bills">
              <i class="fas fa-file-invoice"></i> Bills
            </button>
          </div>
        </div>
      `;
      })
      .join('');

    containers.forEach((c) => { c.innerHTML = cardsHtml; });
  };

  const renderPackagesGrid = () => {
    const container = document.getElementById('cust-packages-grid');
    if (!container) return;

    container.innerHTML = SERVICE_PACKAGES.map((pkg) => {
      const isSel = selectedPackages.includes(pkg.name);
      return `
        <div class="package-option-card ${isSel ? 'selected' : ''}" data-pkg="${escapeHtml(pkg.name)}" onclick="CustomerModule.togglePackage('${escapeHtml(pkg.name)}')">
          <div class="pkg-header flex justify-between items-center">
            <div class="pkg-icon-box"><i class="${pkg.icon}"></i></div>
            <div class="pkg-price font-bold font-mono">₹${pkg.price.toLocaleString('en-IN')}</div>
          </div>
          <h4 class="pkg-name mt-2">${escapeHtml(pkg.name)}</h4>
          <p class="pkg-desc text-xs text-muted mt-1">${escapeHtml(pkg.description)}</p>
          <div class="pkg-select-indicator mt-3 flex justify-between items-center">
            <span class="indicator-radio ${isSel ? 'text-brand' : 'text-muted'}">
              <i class="fas ${isSel ? 'fa-check-square text-brand' : 'fa-square'}"></i> ${isSel ? 'Selected' : 'Add to Booking'}
            </span>
            ${isSel ? '<span class="badge badge-xs badge-success">Added</span>' : ''}
          </div>
        </div>
      `;
    }).join('');

    renderPackagesSummary();
  };

  const renderPackagesSummary = () => {
    const container = document.getElementById('cust-packages-summary-container');
    if (!container) return;

    const selectedObjs = SERVICE_PACKAGES.filter((p) => selectedPackages.includes(p.name));
    const totalEst = selectedObjs.reduce((acc, p) => acc + p.price, 0);

    container.innerHTML = `
      <div class="selected-packages-cart-bar card p-3 mt-3">
        <div class="flex justify-between items-center flex-wrap gap-2">
          <div>
            <div class="font-bold text-sm">
              <i class="fas fa-layer-group text-brand"></i> Selected Services (<span id="cust-selected-count">${selectedPackages.length}</span>):
            </div>
            <div id="cust-selected-chips-container" class="flex flex-wrap gap-1 mt-2">
              ${selectedObjs.map((pkg) => `
                <span class="selected-package-chip badge badge-primary">
                  <i class="${pkg.icon}"></i> ${escapeHtml(pkg.name)}
                  <button type="button" class="chip-remove-btn" onclick="event.stopPropagation(); CustomerModule.removePackage('${escapeHtml(pkg.name)}')" title="Remove">&times;</button>
                </span>
              `).join('')}
            </div>
          </div>
          <div class="text-right">
            <span class="text-xs text-muted block">Combined Estimate</span>
            <span id="cust-selected-total-price" class="text-lg font-bold font-mono text-brand">₹${totalEst.toLocaleString('en-IN')}</span>
          </div>
        </div>
      </div>
    `;
  };

  const togglePackage = (pkgName) => {
    const idx = selectedPackages.indexOf(pkgName);
    if (idx > -1) {
      if (selectedPackages.length === 1) {
        if (typeof App !== 'undefined' && App.showToast) {
          App.showToast('Please keep at least one service package selected.', 'info');
        }
        return;
      }
      selectedPackages.splice(idx, 1);
    } else {
      selectedPackages.push(pkgName);
    }
    renderPackagesGrid();
    const pkgInput = document.getElementById('cust-book-service-type');
    if (pkgInput) pkgInput.value = selectedPackages.join(', ');
  };

  const removePackage = (pkgName) => {
    togglePackage(pkgName);
  };

  const selectPackage = (pkgName) => {
    togglePackage(pkgName);
  };

  const renderCustomerVehicleDropdowns = (owner) => {
    const vehicles = Store.getVehiclesByOwner(owner.id);
    const select = document.getElementById('cust-book-vehicle-select');
    if (!select) return;

    if (vehicles.length === 0) {
      select.innerHTML = '<option value="">-- No vehicles registered. Add one first --</option>';
      return;
    }

    select.innerHTML = vehicles
      .map((v) => `<option value="${v.id || v.vehicleId}">${escapeHtml(v.manufacturer || v.make)} ${escapeHtml(v.model)} (${escapeHtml(v.regNumber || v.registrationNumber)})</option>`)
      .join('');
  };

  const renderCustomerTimeSlots = () => {
    const container = document.getElementById('cust-time-slots-container');
    if (!container) return;

    const slots = ['09:00 AM', '10:30 AM', '12:00 PM', '02:00 PM', '03:30 PM', '05:00 PM'];

    container.innerHTML = slots.map((slot) => {
      const isSel = selectedSlot === slot;
      return `
        <button type="button" class="slot-pill ${isSel ? 'selected' : ''}" onclick="CustomerModule.selectSlot('${slot}')">
          <i class="far fa-clock"></i> ${slot}
        </button>
      `;
    }).join('');
  };

  const selectSlot = (slot) => {
    selectedSlot = slot;
    renderCustomerTimeSlots();
  };

  const handleCustomerBookingSubmit = (e) => {
    e.preventDefault();
    const owner = getCurrentOwner();
    if (!owner) return;

    const vehId = document.getElementById('cust-book-vehicle-select').value;
    const date = document.getElementById('cust-book-date').value;
    const centerSelect = document.getElementById('cust-book-center-select');
    const centerVal = centerSelect ? centerSelect.value : '';
    const notes = document.getElementById('cust-book-notes').value.trim();

    if (!vehId) {
      alert('Please select a vehicle from your garage.');
      return;
    }
    if (!date) {
      alert('Please choose a preferred service date.');
      return;
    }
    if (!selectedSlot) {
      alert('Please pick a convenient time slot.');
      return;
    }
    if (!selectedPackages || selectedPackages.length === 0) {
      alert('Please select at least one service package.');
      return;
    }

    try {
      const combinedNotes = [
        centerVal ? `Center: ${centerVal}` : '',
        notes ? `[Customer Request] ${notes}` : 'Booked via Customer Portal'
      ].filter(Boolean).join(' | ');

      const totalEstimatedCost = selectedPackages.reduce((acc, name) => {
        const p = SERVICE_PACKAGES.find((x) => x.name === name);
        return acc + (p ? p.price : 0);
      }, 0);

      const newApt = Store.addAppointment({
        vehicleId: vehId,
        ownerId: owner.id,
        serviceType: selectedPackages.join(', '),
        serviceTypes: [...selectedPackages],
        totalEstimatedCost,
        serviceCenter: centerVal || 'AutoCare Tech City Supercenter',
        date,
        timeSlot: selectedSlot,
        notes: combinedNotes
      });

      AppointmentModule.showBookingConfirmation(newApt);
      App.showToast(`Appointment ${newApt.id} booked successfully!`, 'success');

      // Reset Form
      document.getElementById('form-customer-book-service').reset();
      selectedPackages = ['Comprehensive Periodic Service'];
      showCustomerView('bookings');
      renderCustomerPortal();
    } catch (err) {
      App.showToast(err.message, 'error');
    }
  };

  // Live Service Tracker & Bookings
  const renderCustomerAppointmentsList = (owner) => {
    const container = document.getElementById('cust-appointments-list-container');
    if (!container) return;

    const appointments = Store.getAppointments().filter((a) => a.ownerId === owner.id);
    const vehicles = Store.getVehicles();

    if (appointments.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon"><i class="fas fa-calendar-alt"></i></div>
          <h3>No Service Bookings Yet</h3>
          <p class="text-muted">You do not have any pending or past appointments scheduled.</p>
          <button class="btn btn-primary mt-3" onclick="CustomerModule.showCustomerView('book')">
            <i class="fas fa-calendar-plus"></i> Book Your First Service
          </button>
        </div>
      `;
      return;
    }

    container.innerHTML = appointments
      .map((apt) => {
        const veh = vehicles.find((v) => (v.id || v.vehicleId) === apt.vehicleId);
        const stepProgress = getStatusStepIndex(apt.status);

        return `
        <div class="cust-booking-tracker-card card mb-4">
          <div class="flex justify-between items-center mb-3">
            <div>
              <span class="badge ${AppointmentModule.getStatusBadge(apt.status)}">${escapeHtml(apt.status)}</span>
              <span class="font-mono text-xs text-muted ml-2">Booking Ref: <strong>${escapeHtml(apt.id || apt.appointmentId)}</strong></span>
            </div>
            <div class="text-sm font-semibold">
              <i class="far fa-calendar-alt text-brand"></i> ${apt.date || apt.appointmentDate} • ${escapeHtml(apt.timeSlot)}
            </div>
          </div>

          <div class="booking-vehicle-headline">
            <div class="flex flex-wrap gap-1 mb-2">
              ${(apt.serviceTypes && apt.serviceTypes.length ? apt.serviceTypes : (apt.serviceType ? apt.serviceType.split(', ').map((s) => s.trim()) : ['General Service'])).map((s) => `
                <span class="badge badge-primary"><i class="fas fa-tools"></i> ${escapeHtml(s)}</span>
              `).join('')}
            </div>
            ${apt.totalEstimatedCost ? `<div class="text-xs text-muted mb-2 font-mono"><i class="fas fa-tag text-brand"></i> Estimated Total: <strong>₹${Number(apt.totalEstimatedCost).toLocaleString('en-IN')}</strong></div>` : ''}
            <p class="text-xs text-muted">
              Vehicle: <strong>${veh ? `${veh.manufacturer || veh.make} ${veh.model} (${veh.regNumber || veh.registrationNumber})` : 'Vehicle Deleted'}</strong>
            </p>
          </div>

          <!-- 5-Step Visual Workshop Progress Tracker -->
          <div class="service-stepper-wrap my-4">
            <div class="step-item ${stepProgress >= 1 ? 'completed' : ''} ${stepProgress === 1 ? 'current' : ''}">
              <div class="step-circle"><i class="fas fa-check"></i></div>
              <span class="step-label">Booked</span>
            </div>
            <div class="step-line ${stepProgress >= 2 ? 'completed' : ''}"></div>
            <div class="step-item ${stepProgress >= 2 ? 'completed' : ''} ${stepProgress === 2 ? 'current' : ''}">
              <div class="step-circle"><i class="fas fa-warehouse"></i></div>
              <span class="step-label">Arrived</span>
            </div>
            <div class="step-line ${stepProgress >= 3 ? 'completed' : ''}"></div>
            <div class="step-item ${stepProgress >= 3 ? 'completed' : ''} ${stepProgress === 3 ? 'current' : ''}">
              <div class="step-circle"><i class="fas fa-wrench"></i></div>
              <span class="step-label">In-Service</span>
            </div>
            <div class="step-line ${stepProgress >= 4 ? 'completed' : ''}"></div>
            <div class="step-item ${stepProgress >= 4 ? 'completed' : ''} ${stepProgress === 4 ? 'current' : ''}">
              <div class="step-circle"><i class="fas fa-soap"></i></div>
              <span class="step-label">QC & Wash</span>
            </div>
            <div class="step-line ${stepProgress >= 5 ? 'completed' : ''}"></div>
            <div class="step-item ${stepProgress >= 5 ? 'completed' : ''} ${stepProgress === 5 ? 'current' : ''}">
              <div class="step-circle"><i class="fas fa-key"></i></div>
              <span class="step-label">Ready</span>
            </div>
          </div>

          <div class="flex justify-between items-center pt-3 border-t">
            <div class="text-xs text-muted">
              ${apt.notes ? `<em>Notes: "${escapeHtml(apt.notes)}"</em>` : 'Standard workshop booking'}
            </div>
            <div class="flex gap-2">
              <button class="btn btn-xs btn-outline" onclick="AppointmentModule.viewDetail('${apt.id || apt.appointmentId}')">
                <i class="fas fa-receipt"></i> Booking Slip
              </button>
              ${
                apt.status !== 'Cancelled' && apt.status !== 'Completed'
                  ? `
                <button class="btn btn-xs btn-primary-soft" onclick="AppointmentModule.openRescheduleModal('${apt.id || apt.appointmentId}')">
                  Reschedule
                </button>
                <button class="btn btn-xs btn-danger-soft" onclick="AppointmentModule.openCancelModal('${apt.id || apt.appointmentId}')">
                  Cancel
                </button>
              `
                  : ''
              }
            </div>
          </div>
        </div>
      `;
      })
      .join('');
  };

  const getStatusStepIndex = (status) => {
    switch (status) {
      case 'Pending':
        return 1;
      case 'Confirmed':
      case 'Rescheduled':
        return 2;
      case 'In Progress':
        return 3;
      case 'QC & Wash':
        return 4;
      case 'Completed':
        return 5;
      case 'Cancelled':
        return 0;
      default:
        return 2;
    }
  };

  // Customer Invoices & Service History
  const renderCustomerInvoices = (owner) => {
    const container = document.getElementById('cust-invoices-list-container');
    if (!container) return;

    const services = Store.getServices().filter((s) => s.ownerId === owner.id);
    const vehicles = Store.getVehicles();

    if (services.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon"><i class="fas fa-file-invoice"></i></div>
          <h3>No Maintenance Invoices Found</h3>
          <p class="text-muted">Once your car completes a service at our workshop, detailed itemized bills will appear here.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div class="table-responsive">
        <table class="table">
          <thead>
            <tr>
              <th>Invoice # / Date</th>
              <th>Vehicle</th>
              <th>Service Type</th>
              <th>Workshop Center</th>
              <th>Replaced Parts</th>
              <th>Amount Paid</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            ${services
              .map((s) => {
                const veh = vehicles.find((v) => (v.id || v.vehicleId) === s.vehicleId);
                const partsCount = (s.parts || []).length;
                return `
                <tr>
                  <td>
                    <div class="font-mono font-bold text-brand">${escapeHtml(s.id || s.serviceId)}</div>
                    <small class="text-muted">${s.serviceDate}</small>
                  </td>
                  <td>
                    <div class="font-semibold">${veh ? `${veh.manufacturer || veh.make} ${veh.model}` : 'N/A'}</div>
                    <div class="font-mono text-xs text-muted">${veh ? (veh.regNumber || veh.registrationNumber) : ''}</div>
                  </td>
                  <td><span class="badge badge-outline">${escapeHtml(s.serviceType)}</span></td>
                  <td>${escapeHtml(s.serviceCenter)}</td>
                  <td>${partsCount > 0 ? `<span class="badge badge-secondary">${partsCount} item(s)</span>` : '<span class="text-muted text-xs">Labor Only</span>'}</td>
                  <td class="font-bold text-success font-mono">₹${(s.totalExpenses || s.totalCost || 0).toLocaleString('en-IN')}</td>
                  <td>
                    <button class="btn btn-xs btn-primary-soft" onclick="ServiceModule.viewServiceDetail('${s.id || s.serviceId}')">
                      <i class="fas fa-file-invoice"></i> View Invoice
                    </button>
                  </td>
                </tr>
              `;
              })
              .join('')}
          </tbody>
        </table>
      </div>
    `;
  };

  // Add Vehicle modal handler
  const openAddVehicleModal = () => {
    const modal = document.getElementById('modal-customer-add-vehicle');
    if (modal) {
      modal.classList.remove('hidden');
      modal.classList.add('flex');
    }
  };

  const closeModals = () => {
    document.querySelectorAll('.customer-modal').forEach((m) => {
      m.classList.add('hidden');
      m.classList.remove('flex');
    });
  };

  const handleAddCustomerVehicle = (e) => {
    e.preventDefault();
    const owner = getCurrentOwner();
    if (!owner) return;

    const data = {
      regNumber: document.getElementById('cust-veh-reg').value.trim(),
      manufacturer: document.getElementById('cust-veh-make').value.trim(),
      model: document.getElementById('cust-veh-model').value.trim(),
      fuelType: document.getElementById('cust-veh-fuel').value,
      purchaseDate: document.getElementById('cust-veh-date').value,
      insuranceExpiry: document.getElementById('cust-veh-insurance').value,
      pucExpiry: document.getElementById('cust-veh-puc').value,
      ownerId: owner.id
    };

    try {
      const newVeh = Store.addVehicle(data);
      App.showToast(`Vehicle ${newVeh.manufacturer} ${newVeh.model} added to your garage!`, 'success');
      document.getElementById('form-customer-add-vehicle').reset();
      closeModals();
      renderCustomerPortal();
    } catch (err) {
      alert(err.message);
    }
  };

  const populateProfileForm = (owner) => {
    const nameEl = document.getElementById('cust-prof-name');
    const idEl = document.getElementById('cust-prof-id');
    const mobileEl = document.getElementById('cust-prof-mobile');
    const emailEl = document.getElementById('cust-prof-email');
    const addrEl = document.getElementById('cust-prof-address');

    if (nameEl) nameEl.value = owner.name;
    if (idEl) idEl.value = owner.id;
    if (mobileEl) mobileEl.value = owner.mobile;
    if (emailEl) emailEl.value = owner.email;
    if (addrEl) addrEl.value = owner.address;
  };

  const handleCustomerProfileUpdate = (e) => {
    e.preventDefault();
    const owner = getCurrentOwner();
    if (!owner) return;

    const updated = {
      name: document.getElementById('cust-prof-name').value.trim(),
      mobile: document.getElementById('cust-prof-mobile').value.trim(),
      email: document.getElementById('cust-prof-email').value.trim(),
      address: document.getElementById('cust-prof-address').value.trim()
    };

    try {
      Store.updateOwner(owner.id, updated);
      App.showToast('Your profile information has been updated!', 'success');
      renderCustomerPortal();
    } catch (err) {
      alert(err.message);
    }
  };

  // Interactive Cost Estimator
  const updateCostEstimate = () => {
    const fuelType = document.querySelector('input[name="est-fuel"]:checked')?.value || 'Petrol';
    let base = fuelType === 'Electric' ? 1200 : (fuelType === 'Diesel' ? 1600 : 1400);

    let partsSum = 0;
    document.querySelectorAll('.est-checkbox:checked').forEach((cb) => {
      partsSum += parseInt(cb.value, 10) || 0;
    });

    const subtotal = base + partsSum;
    const gst = Math.round(subtotal * 0.18);
    const grand = subtotal + gst;

    setText('est-base-labor', `₹${base.toLocaleString('en-IN')}`);
    setText('est-parts-sum', `₹${partsSum.toLocaleString('en-IN')}`);
    setText('est-gst', `₹${gst.toLocaleString('en-IN')}`);
    setText('est-grand-total', `₹${grand.toLocaleString('en-IN')}`);
  };

  // Quick action shortcuts
  const bookForVehicle = (vehId) => {
    showCustomerView('book');
    setTimeout(() => {
      const select = document.getElementById('cust-book-vehicle-select');
      if (select) select.value = vehId;
    }, 100);
  };

  const viewCarHistory = (vehId) => {
    showCustomerView('invoices');
  };

  const quickBookService = () => {
    showCustomerView('book');
  };

  const setText = (id, text) => {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
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
    showCustomerView,
    renderCustomerPortal,
    selectPackage,
    togglePackage,
    removePackage,
    selectSlot,
    openAddVehicleModal,
    closeModals,
    bookForVehicle,
    viewCarHistory,
    quickBookService,
    updateCostEstimate
  };
})();
