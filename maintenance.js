/* maintenance.js - Spare Parts / Maintenance module (Member 3)
   Reads:  vehicles
   Writes: maintenance, and the partsCost / totalCost of the related record in services */
(function () {
  'use strict';

  /* ================= Storage helpers (same as services.js) ================= */

  function load(key) {
    try {
      const parsed = JSON.parse(localStorage.getItem(key));
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  }

  function save(key, data) {
    localStorage.setItem(key, JSON.stringify(data));
  }

  function nextId(list, field, prefix) {
    const highest = list.reduce(function (max, record) {
      const n = parseInt(String(record[field]).replace(/\D/g, ''), 10);
      return Number.isNaN(n) ? max : Math.max(max, n);
    }, 0);
    return prefix + String(highest + 1).padStart(3, '0');
  }

  /* ================= Small utilities ================= */

  const $ = function (id) { return document.getElementById(id); };

  function round2(n) { return Math.round((Number(n) + Number.EPSILON) * 100) / 100; }

  function money(n) {
    return '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });
  }

  function escapeHtml(value) {
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (c) { return map[c]; });
  }

  function vehicleLabel(v) {
    const name = v.vehicleName || [v.make || v.brand, v.model].filter(Boolean).join(' ');
    const reg = v.registrationNumber || v.regNumber || v.vehicleNumber || '';
    return [v.vehicleId, name, reg].filter(Boolean).join(' – ');
  }

  function serviceLabel(s) {
    return s.serviceId + ' – ' + s.serviceDate + ' – ' + s.serviceType;
  }

  function sumField(list, field) {
    return round2(list.reduce(function (sum, record) { return sum + (Number(record[field]) || 0); }, 0));
  }

  let toastTimer;
  function toast(message) {
    const el = $('toast');
    el.textContent = message;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove('show'); }, 3200);
  }

  /* ================= Element references ================= */

  const form = $('partForm');
  const mVehicle = $('mVehicle');
  const mService = $('mService');
  const mPartName = $('mPartName');
  const mQuantity = $('mQuantity');
  const mUnitCost = $('mUnitCost');
  const formError = $('formError');
  const saveBtn = $('saveBtn');
  const cancelEditBtn = $('cancelEditBtn');
  const filterVehicle = $('filterVehicle');
  const filterService = $('filterService');
  const filterText = $('filterText');
  const ledgerBody = $('ledgerBody');

  let editingId = null; // maintenanceId being edited, or null when adding

  /* ================= Core calculation ================= */

  // Rebuilds one service's totals from its spare part records:
  //   partsCost = sum of the parts' totalCost
  //   totalCost = partsCost + labourCost
  function recalculateService(serviceId) {
    const partsCost = sumField(
      load('maintenance').filter(function (m) { return m.serviceId === serviceId; }),
      'totalCost'
    );
    const updated = load('services').map(function (s) {
      if (s.serviceId !== serviceId) return s;
      return Object.assign({}, s, {
        partsCost: partsCost,
        totalCost: round2(partsCost + (Number(s.labourCost) || 0))
      });
    });
    save('services', updated);
  }

  // Repairs every total in both keys. Returns how many service records changed.
  function recalculateAll() {
    const maintenance = load('maintenance').map(function (m) {
      return Object.assign({}, m, { totalCost: round2(Number(m.quantity) * Number(m.unitCost)) });
    });
    save('maintenance', maintenance);

    const before = load('services');
    const after = before.map(function (s) {
      const partsCost = sumField(maintenance.filter(function (m) { return m.serviceId === s.serviceId; }), 'totalCost');
      return Object.assign({}, s, { partsCost: partsCost, totalCost: round2(partsCost + (Number(s.labourCost) || 0)) });
    });
    save('services', after);

    return after.filter(function (s, i) {
      return s.partsCost !== before[i].partsCost || s.totalCost !== before[i].totalCost;
    }).length;
  }

  /* ================= Dropdowns ================= */

  function populateVehicleOptions() {
    const vehicles = load('vehicles');
    const formValue = mVehicle.value;
    const filterValue = filterVehicle.value;
    const options = vehicles.map(function (v) {
      return '<option value="' + escapeHtml(v.vehicleId) + '">' + escapeHtml(vehicleLabel(v)) + '</option>';
    }).join('');

    mVehicle.innerHTML = '<option value="">Select a vehicle</option>' + options;
    filterVehicle.innerHTML = '<option value="">All vehicles</option>' + options;
    mVehicle.value = formValue;
    filterVehicle.value = filterValue;
  }

  // Only the services that belong to the chosen vehicle are offered.
  function populateFormServices(selected) {
    const vehicleId = mVehicle.value;
    const services = load('services')
      .filter(function (s) { return s.vehicleId === vehicleId; })
      .sort(function (a, b) { return b.serviceDate.localeCompare(a.serviceDate); });

    const placeholder = !vehicleId ? 'Select a vehicle first'
      : services.length ? 'Select a service' : 'No services for this vehicle';

    mService.innerHTML = '<option value="">' + placeholder + '</option>' +
      services.map(function (s) {
        return '<option value="' + escapeHtml(s.serviceId) + '">' + escapeHtml(serviceLabel(s)) + '</option>';
      }).join('');
    mService.disabled = !vehicleId || editingId !== null;
    mService.value = selected || '';
  }

  function populateFilterServices() {
    const vehicleId = filterVehicle.value;
    const current = filterService.value;
    const services = load('services')
      .filter(function (s) { return !vehicleId || s.vehicleId === vehicleId; })
      .sort(function (a, b) { return b.serviceDate.localeCompare(a.serviceDate); });

    filterService.innerHTML = '<option value="">All services</option>' +
      services.map(function (s) {
        return '<option value="' + escapeHtml(s.serviceId) + '">' + escapeHtml(serviceLabel(s)) + '</option>';
      }).join('');
    filterService.value = current; // becomes '' automatically if that service is no longer listed
  }

  /* ================= Form ================= */

  function updateLineTotal() {
    $('mLineTotal').textContent = money(round2((Number(mQuantity.value) || 0) * (Number(mUnitCost.value) || 0)));
  }

  function resetForm() {
    form.reset();
    editingId = null;
    mVehicle.disabled = false;
    populateFormServices('');
    formError.hidden = true;
    $('formTitle').textContent = 'Add spare part to a service';
    saveBtn.textContent = 'Add spare part';
    cancelEditBtn.hidden = true;
    updateLineTotal();
  }

  function startEdit(maintenanceId) {
    const m = load('maintenance').find(function (x) { return x.maintenanceId === maintenanceId; });
    if (!m) return;

    editingId = maintenanceId;
    mVehicle.value = m.vehicleId;
    populateFormServices(m.serviceId);
    // The part stays on the same service and vehicle while editing.
    mVehicle.disabled = true;
    mService.disabled = true;
    mPartName.value = m.partName;
    mQuantity.value = m.quantity;
    mUnitCost.value = m.unitCost;

    formError.hidden = true;
    $('formTitle').textContent = 'Edit spare part ' + maintenanceId;
    saveBtn.textContent = 'Update spare part';
    cancelEditBtn.hidden = false;
    updateLineTotal();
    form.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
  }

  form.addEventListener('submit', function (event) {
    event.preventDefault();

    const partName = mPartName.value.trim();
    const quantity = Number(mQuantity.value);
    const unitCost = Number(mUnitCost.value);
    const serviceId = editingId
      ? (load('maintenance').find(function (m) { return m.maintenanceId === editingId; }) || {}).serviceId
      : mService.value;

    let error = '';
    if (!serviceId) error = 'Select a vehicle and a service for this part.';
    else if (!partName) error = 'Enter the part name.';
    else if (!Number.isInteger(quantity) || quantity < 1) error = 'Quantity must be a whole number of 1 or more.';
    else if (mUnitCost.value === '' || Number.isNaN(unitCost) || unitCost < 0) error = 'Enter the unit cost.';

    // find(): get the one service this part belongs to
    const service = load('services').find(function (s) { return s.serviceId === serviceId; });
    if (!error && !service) error = 'The selected service no longer exists.';

    if (error) {
      formError.textContent = error;
      formError.hidden = false;
      return;
    }
    formError.hidden = true;

    const totalCost = round2(quantity * unitCost);
    const maintenance = load('maintenance');

    if (editingId) {
      save('maintenance', maintenance.map(function (m) {
        return m.maintenanceId === editingId
          ? Object.assign({}, m, { partName: partName, quantity: quantity, unitCost: unitCost, totalCost: totalCost })
          : m;
      }));
    } else {
      maintenance.push({
        maintenanceId: nextId(maintenance, 'maintenanceId', 'M'),
        serviceId: service.serviceId,
        vehicleId: service.vehicleId, // always copied from the service so the two keys never disagree
        partName: partName,
        quantity: quantity,
        unitCost: unitCost,
        totalCost: totalCost
      });
      save('maintenance', maintenance);
    }

    recalculateService(serviceId);
    const wasEdit = editingId !== null;
    resetForm();
    renderAll();
    toast((wasEdit ? 'Updated' : 'Added') + ' ' + partName + '. Service ' + serviceId + ' total is now ' +
          money(load('services').find(function (s) { return s.serviceId === serviceId; }).totalCost));
  });

  function deletePart(maintenanceId) {
    const m = load('maintenance').find(function (x) { return x.maintenanceId === maintenanceId; });
    if (!m) return;
    if (!confirm('Delete ' + m.partName + ' (' + maintenanceId + ') from service ' + m.serviceId + '?')) return;

    save('maintenance', load('maintenance').filter(function (x) { return x.maintenanceId !== maintenanceId; }));
    recalculateService(m.serviceId);
    if (editingId === maintenanceId) resetForm();
    renderAll();
    toast('Deleted ' + m.partName + '. Service ' + m.serviceId + ' totals updated.');
  }

  mVehicle.addEventListener('change', function () { populateFormServices(''); });
  mQuantity.addEventListener('input', updateLineTotal);
  mUnitCost.addEventListener('input', updateLineTotal);
  cancelEditBtn.addEventListener('click', resetForm);

  /* ================= Ledger table ================= */

  // filter(): keep only parts matching the vehicle, service and name filters
  function getFilteredParts() {
    const vehicleId = filterVehicle.value;
    const serviceId = filterService.value;
    const text = filterText.value.trim().toLowerCase();
    return load('maintenance')
      .filter(function (m) {
        return (!vehicleId || m.vehicleId === vehicleId) &&
               (!serviceId || m.serviceId === serviceId) &&
               (!text || String(m.partName).toLowerCase().includes(text));
      })
      .sort(function (a, b) { return a.maintenanceId.localeCompare(b.maintenanceId); });
  }

  function renderLedger() {
    const vehicles = load('vehicles');
    const list = getFilteredParts();

    ledgerBody.innerHTML = list.map(function (m) {
      const v = vehicles.find(function (x) { return x.vehicleId === m.vehicleId; });
      return '<tr>' +
        '<td>' + escapeHtml(m.maintenanceId) + '</td>' +
        '<td>' + escapeHtml(m.serviceId) + '</td>' +
        '<td>' + escapeHtml(v ? vehicleLabel(v) : m.vehicleId) + '</td>' +
        '<td>' + escapeHtml(m.partName) + '</td>' +
        '<td class="num">' + m.quantity + '</td>' +
        '<td class="num">' + money(m.unitCost) + '</td>' +
        '<td class="num total-cell">' + money(m.totalCost) + '</td>' +
        '<td><div class="row-actions">' +
          '<button type="button" class="btn-link" data-action="edit" data-id="' + escapeHtml(m.maintenanceId) + '">Edit</button>' +
          '<button type="button" class="btn-link danger" data-action="delete" data-id="' + escapeHtml(m.maintenanceId) + '">Delete</button>' +
        '</div></td>' +
      '</tr>';
    }).join('');

    $('emptyLedger').hidden = list.length > 0;
    $('statCount').textContent = list.length;
    $('statUnits').textContent = list.reduce(function (sum, m) { return sum + (Number(m.quantity) || 0); }, 0);
    $('statParts').textContent = money(sumField(list, 'totalCost'));
  }

  ledgerBody.addEventListener('click', function (event) {
    const btn = event.target.closest('button[data-action]');
    if (!btn) return;
    if (btn.dataset.action === 'edit') startEdit(btn.dataset.id);
    if (btn.dataset.action === 'delete') deletePart(btn.dataset.id);
  });

  filterVehicle.addEventListener('change', function () { populateFilterServices(); renderLedger(); });
  filterService.addEventListener('change', renderLedger);
  filterText.addEventListener('input', renderLedger);
  $('clearFilters').addEventListener('click', function () {
    filterVehicle.value = '';
    filterText.value = '';
    populateFilterServices();
    filterService.value = '';
    renderLedger();
  });

  /* ================= Expenses by vehicle ================= */

  function renderVehicleTotals() {
    const vehicles = load('vehicles');
    const services = load('services');
    const maintenance = load('maintenance');

    const ids = Array.from(new Set(
      vehicles.map(function (v) { return v.vehicleId; })
        .concat(services.map(function (s) { return s.vehicleId; }))
        .concat(maintenance.map(function (m) { return m.vehicleId; }))
    ));

    const rows = ids.map(function (id) {
      const ownParts = maintenance.filter(function (m) { return m.vehicleId === id; });
      const ownServices = services.filter(function (s) { return s.vehicleId === id; });
      const v = vehicles.find(function (x) { return x.vehicleId === id; });
      return {
        label: v ? vehicleLabel(v) : id + ' (not registered)',
        count: ownParts.length,
        parts: sumField(ownParts, 'totalCost'),
        labour: sumField(ownServices, 'labourCost'),
        total: sumField(ownServices, 'totalCost')
      };
    });

    $('vehicleTotalsBody').innerHTML = rows.length
      ? rows.map(function (r) {
          return '<tr><td>' + escapeHtml(r.label) + '</td><td class="num">' + r.count + '</td><td class="num">' + money(r.parts) +
                 '</td><td class="num">' + money(r.labour) + '</td><td class="num total-cell">' + money(r.total) + '</td></tr>';
        }).join('')
      : '<tr><td colspan="5" class="muted">No data yet.</td></tr>';

    $('vehicleTotalsFoot').innerHTML =
      '<tr><td>All vehicles</td><td class="num">' + maintenance.length + '</td><td class="num">' + money(sumField(maintenance, 'totalCost')) +
      '</td><td class="num">' + money(sumField(services, 'labourCost')) + '</td><td class="num">' + money(sumField(services, 'totalCost')) + '</td></tr>';
  }

  /* ================= Consistency check ================= */

  // some()/filter(): find services whose saved totals no longer match their parts
  function checkConsistency() {
    const services = load('services');
    const maintenance = load('maintenance');
    $('noServices').hidden = services.length > 0;

    const mismatched = services.filter(function (s) {
      const parts = sumField(maintenance.filter(function (m) { return m.serviceId === s.serviceId; }), 'totalCost');
      return parts !== round2(s.partsCost) || round2(parts + (Number(s.labourCost) || 0)) !== round2(s.totalCost);
    });

    const notice = $('mismatchNotice');
    notice.hidden = mismatched.length === 0;
    if (mismatched.length) {
      notice.textContent = mismatched.length + ' service record(s) have totals that do not match their spare parts (' +
        mismatched.map(function (s) { return s.serviceId; }).join(', ') + '). Use "Recalculate all totals" to fix them.';
    }
  }

  $('recalcBtn').addEventListener('click', function () {
    const changed = recalculateAll();
    renderAll();
    toast(changed ? 'Fixed totals on ' + changed + ' service record(s).' : 'All totals already match.');
  });

  /* ================= Start ================= */

  function renderAll() {
    populateVehicleOptions();
    populateFormServices(mService.value);
    populateFilterServices();
    renderLedger();
    renderVehicleTotals();
    checkConsistency();
  }

  resetForm();
  renderAll();
})();