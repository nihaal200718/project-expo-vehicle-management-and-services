/* services.js - Service History module (Member 3)
   Reads:  vehicles
   Writes: services, maintenance, and vehicles.lastServiceDate / nextServiceDate only */
(function () {
  'use strict';

  const SERVICE_TYPES = [
    'General Service', 'Oil Change', 'Repair', 'Engine Service', 'Brake Service',
    'Tyre Service', 'Battery Service', 'AC Service', 'Wheel Alignment', 'Other'
  ];
  const DEFAULT_NEXT_SERVICE_MONTHS = 6;

  /* ================= Storage helpers ================= */

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

  // Next ID = highest existing number + 1, so deleting a record never causes a duplicate ID.
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

  function pad(n) { return String(n).padStart(2, '0'); }

  function toISO(date) {
    return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate());
  }

  function addMonths(iso, months) {
    const d = new Date(iso + 'T00:00:00');
    d.setMonth(d.getMonth() + months);
    return toISO(d);
  }

  // Works with whatever display fields Member 2's vehicle records have.
  function vehicleLabel(v) {
    const name = v.vehicleName || [v.make || v.brand, v.model].filter(Boolean).join(' ');
    const reg = v.registrationNumber || v.regNumber || v.vehicleNumber || '';
    return [v.vehicleId, name, reg].filter(Boolean).join(' – ');
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

  const form = $('serviceForm');
  const vehicleSelect = $('vehicleId');
  const dateInput = $('serviceDate');
  const centerInput = $('serviceCenter');
  const typeSelect = $('serviceType');
  const mileageInput = $('mileage');
  const nextDateInput = $('nextServiceDate');
  const descInput = $('description');
  const labourInput = $('labourCost');
  const partsBody = $('partsBody');
  const formError = $('formError');
  const saveBtn = $('saveBtn');
  const cancelEditBtn = $('cancelEditBtn');
  const filterVehicle = $('filterVehicle');
  const filterFrom = $('filterFrom');
  const filterTo = $('filterTo');
  const historyBody = $('historyBody');

  let editingId = null;           // serviceId being edited, or null when adding
  const expanded = new Set();     // serviceIds whose detail row is open

  /* ================= Form: spare part rows ================= */

  function addPartRow(part) {
    part = part || {};
    const tr = document.createElement('tr');
    tr.innerHTML =
      '<td><input type="text" class="p-name" list="partSuggestions" placeholder="Engine Oil" aria-label="Part name" value="' + escapeHtml(part.partName || '') + '"></td>' +
      '<td><input type="number" class="p-qty" min="1" step="1" aria-label="Quantity" value="' + (part.quantity != null ? part.quantity : 1) + '"></td>' +
      '<td><input type="number" class="p-cost" min="0" step="0.01" aria-label="Unit cost" value="' + (part.unitCost != null ? part.unitCost : '') + '"></td>' +
      '<td class="num p-line">₹0</td>' +
      '<td><button type="button" class="btn-link danger" data-remove>Remove</button></td>';
    partsBody.appendChild(tr);
    updateTotals();
  }

  // Reads every filled-in row of the parts table. Completely empty rows are ignored.
  function readPartRows() {
    return Array.from(partsBody.querySelectorAll('tr'))
      .map(function (tr) {
        return {
          partName: tr.querySelector('.p-name').value.trim(),
          quantity: Number(tr.querySelector('.p-qty').value),
          costRaw: tr.querySelector('.p-cost').value,
          unitCost: Number(tr.querySelector('.p-cost').value)
        };
      })
      .filter(function (p) { return p.partName !== '' || p.costRaw !== ''; });
  }

  // Live calculation shown in the "Cost summary" panel.
  function updateTotals() {
    const rows = Array.from(partsBody.querySelectorAll('tr'));

    // map(): turn each table row into { name, qty, line } where line = qty x unit cost
    const items = rows.map(function (tr) {
      const qty = Number(tr.querySelector('.p-qty').value) || 0;
      const unit = Number(tr.querySelector('.p-cost').value) || 0;
      const line = round2(qty * unit);
      tr.querySelector('.p-line').textContent = money(line);
      return { name: tr.querySelector('.p-name').value.trim(), qty: qty, line: line };
    });

    // reduce(): add up all line totals into one number
    const partsCost = round2(items.reduce(function (sum, item) { return sum + item.line; }, 0));
    const labour = round2(Number(labourInput.value) || 0);

    $('receiptParts').innerHTML = items
      .filter(function (item) { return item.name !== ''; })
      .map(function (item) {
        return '<li><span>' + escapeHtml(item.name) + ' × ' + item.qty + '</span><span>' + money(item.line) + '</span></li>';
      })
      .join('');

    $('sumParts').textContent = money(partsCost);
    $('sumLabour').textContent = money(labour);
    $('sumTotal').textContent = money(round2(partsCost + labour));
  }

  /* ================= Form: validate, save, reset ================= */

  // Returns { error } or { service, parts }. serviceId is added at save time.
  function collectForm() {
    const vehicleId = vehicleSelect.value;
    const serviceDate = dateInput.value;
    const serviceCenter = centerInput.value.trim();
    const serviceType = typeSelect.value;
    const mileageRaw = mileageInput.value;
    const nextServiceDate = nextDateInput.value;
    const labourCost = labourInput.value === '' ? 0 : Number(labourInput.value);

    if (!vehicleId) return { error: 'Select a vehicle.' };
    if (!serviceDate) return { error: 'Enter the service date.' };
    if (!serviceCenter) return { error: 'Enter the service center name.' };
    if (!serviceType) return { error: 'Select a service type.' };
    if (mileageRaw === '' || Number.isNaN(Number(mileageRaw)) || Number(mileageRaw) < 0) {
      return { error: 'Enter the mileage as a number of 0 or more.' };
    }
    if (Number.isNaN(labourCost) || labourCost < 0) return { error: 'Labour charges must be 0 or more.' };
    if (nextServiceDate && nextServiceDate < serviceDate) {
      return { error: 'The next service date cannot be before the service date.' };
    }

    const parts = readPartRows();
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i];
      const n = i + 1;
      if (p.partName === '') return { error: 'Part ' + n + ': enter a part name.' };
      if (!Number.isInteger(p.quantity) || p.quantity < 1) return { error: 'Part ' + n + ': quantity must be a whole number of 1 or more.' };
      if (p.costRaw === '' || Number.isNaN(p.unitCost) || p.unitCost < 0) return { error: 'Part ' + n + ': enter the unit cost.' };
    }

    const partsCost = round2(parts.reduce(function (sum, p) { return sum + p.quantity * p.unitCost; }, 0));

    return {
      parts: parts,
      service: {
        vehicleId: vehicleId,
        serviceDate: serviceDate,
        serviceCenter: serviceCenter,
        serviceType: serviceType,
        description: descInput.value.trim(),
        mileage: Number(mileageRaw),
        labourCost: round2(labourCost),
        partsCost: partsCost,
        totalCost: round2(partsCost + labourCost),
        nextServiceDate: nextServiceDate || ''
      }
    };
  }

  // Keeps the vehicle's dates in step with its newest service (coordinate with Member 2).
  function syncVehicleDates(vehicleId) {
    const vehicles = load('vehicles');
    const vehicle = vehicles.find(function (v) { return v.vehicleId === vehicleId; });
    if (!vehicle) return;

    const history = load('services').filter(function (s) { return s.vehicleId === vehicleId; });
    if (history.length === 0) return; // nothing to base the dates on, so leave Member 2's values alone

    // reduce(): pick the service with the latest date, so back-dated entries never overwrite newer dates
    const latest = history.reduce(function (a, b) { return b.serviceDate > a.serviceDate ? b : a; });
    vehicle.lastServiceDate = latest.serviceDate;
    vehicle.nextServiceDate = latest.nextServiceDate || addMonths(latest.serviceDate, DEFAULT_NEXT_SERVICE_MONTHS);
    save('vehicles', vehicles);
  }

  function persistService(service, parts, serviceId) {
    const services = load('services');
    const record = Object.assign({ serviceId: serviceId }, service);
    const exists = services.some(function (s) { return s.serviceId === serviceId; });

    const updated = exists
      ? services.map(function (s) { return s.serviceId === serviceId ? record : s; })
      : services.concat(record);
    save('services', updated);

    // Replace this service's spare parts: drop the old ones, then add the new ones.
    const maintenance = load('maintenance').filter(function (m) { return m.serviceId !== serviceId; });
    parts.forEach(function (p) {
      maintenance.push({
        maintenanceId: nextId(maintenance, 'maintenanceId', 'M'),
        serviceId: serviceId,
        vehicleId: record.vehicleId,
        partName: p.partName,
        quantity: p.quantity,
        unitCost: p.unitCost,
        totalCost: round2(p.quantity * p.unitCost)
      });
    });
    save('maintenance', maintenance);
    return record;
  }

  form.addEventListener('submit', function (event) {
    event.preventDefault();
    const result = collectForm();
    if (result.error) {
      formError.textContent = result.error;
      formError.hidden = false;
      return;
    }
    formError.hidden = true;

    const services = load('services');
    const svc = result.service;

    // Soft warning if mileage is lower than an earlier service of the same vehicle.
    const earlierMax = services
      .filter(function (s) { return s.vehicleId === svc.vehicleId && s.serviceId !== editingId && s.serviceDate <= svc.serviceDate; })
      .reduce(function (max, s) { return Math.max(max, Number(s.mileage) || 0); }, 0);
    if (svc.mileage < earlierMax &&
        !confirm('An earlier service of this vehicle recorded ' + earlierMax + ' km, which is higher than ' + svc.mileage + ' km. Save anyway?')) {
      return;
    }

    const isEdit = editingId !== null;
    const serviceId = isEdit ? editingId : nextId(services, 'serviceId', 'S');
    const previous = isEdit ? services.find(function (s) { return s.serviceId === serviceId; }) : null;

    persistService(svc, result.parts, serviceId);
    syncVehicleDates(svc.vehicleId);
    if (previous && previous.vehicleId !== svc.vehicleId) syncVehicleDates(previous.vehicleId);

    resetForm();
    renderAll();
    toast((isEdit ? 'Updated service ' : 'Saved service ') + serviceId + ' (' + money(svc.totalCost) + ')');
  });

  function resetForm() {
    form.reset();
    editingId = null;
    partsBody.innerHTML = '';
    addPartRow();
    dateInput.value = toISO(new Date());
    formError.hidden = true;
    $('formTitle').textContent = 'Add service record';
    saveBtn.textContent = 'Save service record';
    cancelEditBtn.hidden = true;
    updateTotals();
  }

  function startEdit(serviceId) {
    const s = load('services').find(function (x) { return x.serviceId === serviceId; });
    if (!s) return;

    editingId = serviceId;
    vehicleSelect.value = s.vehicleId;
    dateInput.value = s.serviceDate;
    centerInput.value = s.serviceCenter;
    typeSelect.value = s.serviceType;
    mileageInput.value = s.mileage;
    nextDateInput.value = s.nextServiceDate || '';
    descInput.value = s.description || '';
    labourInput.value = s.labourCost;

    partsBody.innerHTML = '';
    const parts = load('maintenance').filter(function (m) { return m.serviceId === serviceId; });
    if (parts.length) { parts.forEach(function (p) { addPartRow(p); }); } else { addPartRow(); }

    formError.hidden = true;
    $('formTitle').textContent = 'Edit service record ' + serviceId;
    saveBtn.textContent = 'Update service record';
    cancelEditBtn.hidden = false;
    updateTotals();
    form.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
  }

  function deleteService(serviceId) {
    const service = load('services').find(function (s) { return s.serviceId === serviceId; });
    if (!service) return;
    const partCount = load('maintenance').filter(function (m) { return m.serviceId === serviceId; }).length;
    if (!confirm('Delete service ' + serviceId + ' and its ' + partCount + ' spare part record(s)? This cannot be undone.')) return;

    save('services', load('services').filter(function (s) { return s.serviceId !== serviceId; }));
    save('maintenance', load('maintenance').filter(function (m) { return m.serviceId !== serviceId; }));
    syncVehicleDates(service.vehicleId);
    expanded.delete(serviceId);
    if (editingId === serviceId) resetForm();
    renderAll();
    toast('Deleted service ' + serviceId);
  }

  /* ================= Form events ================= */

  $('addPartBtn').addEventListener('click', function () { addPartRow(); });
  cancelEditBtn.addEventListener('click', resetForm);
  labourInput.addEventListener('input', updateTotals);

  partsBody.addEventListener('input', updateTotals);
  partsBody.addEventListener('click', function (event) {
    if (event.target.matches('[data-remove]')) {
      event.target.closest('tr').remove();
      updateTotals();
    }
  });

  /* ================= History: filters and table ================= */

  // filter(): keep only the records that match the chosen vehicle and date range
  function getFilteredServices() {
    const vehicleId = filterVehicle.value;
    const from = filterFrom.value;
    const to = filterTo.value;
    return load('services')
      .filter(function (s) {
        return (!vehicleId || s.vehicleId === vehicleId) &&
               (!from || s.serviceDate >= from) &&
               (!to || s.serviceDate <= to);
      })
      .sort(function (a, b) { return b.serviceDate.localeCompare(a.serviceDate); });
  }

  function sumField(list, field) {
    return round2(list.reduce(function (sum, record) { return sum + (Number(record[field]) || 0); }, 0));
  }

  function renderHistory() {
    const vehicles = load('vehicles');
    const maintenance = load('maintenance');
    const list = getFilteredServices();

    function labelOf(id) {
      const v = vehicles.find(function (x) { return x.vehicleId === id; });
      return v ? vehicleLabel(v) : id;
    }

    historyBody.innerHTML = list.map(function (s) {
      const parts = maintenance.filter(function (m) { return m.serviceId === s.serviceId; });
      const isOpen = expanded.has(s.serviceId);

      let html =
        '<tr>' +
          '<td>' + escapeHtml(s.serviceId) + '</td>' +
          '<td>' + escapeHtml(s.serviceDate) + '</td>' +
          '<td>' + escapeHtml(labelOf(s.vehicleId)) + '</td>' +
          '<td>' + escapeHtml(s.serviceCenter) + '</td>' +
          '<td><span class="pill">' + escapeHtml(s.serviceType) + '</span></td>' +
          '<td class="num">' + Number(s.mileage).toLocaleString('en-IN') + ' km</td>' +
          '<td class="num">' + money(s.partsCost) + '</td>' +
          '<td class="num">' + money(s.labourCost) + '</td>' +
          '<td class="num total-cell">' + money(s.totalCost) + '</td>' +
          '<td><div class="row-actions">' +
            '<button type="button" class="btn-link" data-action="toggle" data-id="' + escapeHtml(s.serviceId) + '" aria-expanded="' + isOpen + '">' + (isOpen ? 'Hide' : 'Details') + '</button>' +
            '<button type="button" class="btn-link" data-action="edit" data-id="' + escapeHtml(s.serviceId) + '">Edit</button>' +
            '<button type="button" class="btn-link danger" data-action="delete" data-id="' + escapeHtml(s.serviceId) + '">Delete</button>' +
          '</div></td>' +
        '</tr>';

      if (isOpen) {
        const partsHtml = parts.length
          ? '<ul class="detail-parts">' + parts.map(function (p) {
              return '<li><span>' + escapeHtml(p.partName) + ' × ' + p.quantity + ' at ' + money(p.unitCost) + '</span><span>' + money(p.totalCost) + '</span></li>';
            }).join('') + '</ul>'
          : '<p class="muted">No spare parts recorded for this service.</p>';
        html +=
          '<tr class="detail-row"><td colspan="10">' +
            '<p>' + (s.description ? escapeHtml(s.description) : '<span class="muted">No description.</span>') + '</p>' +
            (s.nextServiceDate ? '<p class="muted">Next service due: ' + escapeHtml(s.nextServiceDate) + '</p>' : '') +
            partsHtml +
          '</td></tr>';
      }
      return html;
    }).join('');

    $('emptyHistory').hidden = list.length > 0;
    $('statCount').textContent = list.length;
    $('statParts').textContent = money(sumField(list, 'partsCost'));
    $('statLabour').textContent = money(sumField(list, 'labourCost'));
    $('statTotal').textContent = money(sumField(list, 'totalCost'));
  }

  historyBody.addEventListener('click', function (event) {
    const btn = event.target.closest('button[data-action]');
    if (!btn) return;
    const id = btn.dataset.id;
    if (btn.dataset.action === 'edit') startEdit(id);
    if (btn.dataset.action === 'delete') deleteService(id);
    if (btn.dataset.action === 'toggle') {
      if (expanded.has(id)) { expanded.delete(id); } else { expanded.add(id); }
      renderHistory();
    }
  });

  [filterVehicle, filterFrom, filterTo].forEach(function (el) { el.addEventListener('input', renderHistory); });
  $('clearFilters').addEventListener('click', function () {
    filterVehicle.value = '';
    filterFrom.value = '';
    filterTo.value = '';
    renderHistory();
  });

  /* ================= Expenses by vehicle ================= */

  function renderVehicleTotals() {
    const vehicles = load('vehicles');
    const services = load('services');

    // Every vehicle ID that is registered OR has a service record (so no expense is ever hidden)
    const ids = Array.from(new Set(
      vehicles.map(function (v) { return v.vehicleId; }).concat(services.map(function (s) { return s.vehicleId; }))
    ));

    const rows = ids.map(function (id) {
      const own = services.filter(function (s) { return s.vehicleId === id; });
      const v = vehicles.find(function (x) { return x.vehicleId === id; });
      return {
        label: v ? vehicleLabel(v) : id + ' (not registered)',
        count: own.length,
        parts: sumField(own, 'partsCost'),
        labour: sumField(own, 'labourCost'),
        total: sumField(own, 'totalCost')
      };
    });

    $('vehicleTotalsBody').innerHTML = rows.length
      ? rows.map(function (r) {
          return '<tr><td>' + escapeHtml(r.label) + '</td><td class="num">' + r.count + '</td><td class="num">' + money(r.parts) +
                 '</td><td class="num">' + money(r.labour) + '</td><td class="num total-cell">' + money(r.total) + '</td></tr>';
        }).join('')
      : '<tr><td colspan="5" class="muted">No vehicles or services yet.</td></tr>';

    $('vehicleTotalsFoot').innerHTML =
      '<tr><td>All vehicles</td><td class="num">' + services.length + '</td><td class="num">' + money(sumField(services, 'partsCost')) +
      '</td><td class="num">' + money(sumField(services, 'labourCost')) + '</td><td class="num">' + money(sumField(services, 'totalCost')) + '</td></tr>';
  }

  /* ================= Dropdowns ================= */

  function populateVehicleOptions() {
    const vehicles = load('vehicles');
    const formValue = vehicleSelect.value;
    const filterValue = filterVehicle.value;
    const options = vehicles.map(function (v) {
      return '<option value="' + escapeHtml(v.vehicleId) + '">' + escapeHtml(vehicleLabel(v)) + '</option>';
    }).join('');

    vehicleSelect.innerHTML = '<option value="">Select a vehicle</option>' + options;
    filterVehicle.innerHTML = '<option value="">All vehicles</option>' + options;
    vehicleSelect.value = formValue;
    filterVehicle.value = filterValue;
    $('noVehicles').hidden = vehicles.length > 0;
  }

  function populateTypeOptions() {
    typeSelect.innerHTML = '<option value="">Select a service type</option>' +
      SERVICE_TYPES.map(function (t) { return '<option>' + t + '</option>'; }).join('');
  }

  function renderAll() {
    populateVehicleOptions();
    renderHistory();
    renderVehicleTotals();
  }

  /* ================= Sample data (for testing only) ================= */

  function seedSampleData() {
    let vehicles = load('vehicles');
    if (vehicles.length === 0) {
      vehicles = [
        { vehicleId: 'V001', make: 'Honda', model: 'City', registrationNumber: 'TS09AB1234', lastServiceDate: '', nextServiceDate: '' },
        { vehicleId: 'V002', make: 'Hyundai', model: 'i20', registrationNumber: 'TS08CD5678', lastServiceDate: '', nextServiceDate: '' }
      ];
      save('vehicles', vehicles);
    }
    if (load('services').length > 0) {
      toast('Service records already exist, so sample data was not added.');
      return;
    }

    // Uses the first two real vehicles so the samples always link to existing IDs.
    const first = vehicles[0].vehicleId;
    const second = (vehicles[1] || vehicles[0]).vehicleId;

    const samples = [
      { vehicleId: first, serviceDate: '2026-04-10', serviceCenter: 'Speed Auto Care', serviceType: 'Brake Service',
        description: 'Front brake pad replacement', mileage: 12500, labourCost: 800, nextServiceDate: '',
        parts: [{ partName: 'Brake Pads', quantity: 1, unitCost: 2200 }] },
      { vehicleId: first, serviceDate: '2026-10-15', serviceCenter: 'ABC Motors', serviceType: 'General Service',
        description: 'Engine oil and filter replacement', mileage: 15000, labourCost: 1000, nextServiceDate: '2027-04-15',
        parts: [{ partName: 'Engine Oil', quantity: 2, unitCost: 750 }, { partName: 'Oil Filter', quantity: 1, unitCost: 450 }, { partName: 'Air Filter', quantity: 1, unitCost: 550 }] },
      { vehicleId: second, serviceDate: '2026-09-02', serviceCenter: 'City Auto Works', serviceType: 'Repair',
        description: 'Clutch plate and release bearing replacement', mileage: 28400, labourCost: 1800, nextServiceDate: '',
        parts: [{ partName: 'Clutch Plate', quantity: 1, unitCost: 3500 }, { partName: 'Release Bearing', quantity: 1, unitCost: 900 }] }
    ];

    samples.forEach(function (sample) {
      const parts = sample.parts;
      const partsCost = round2(parts.reduce(function (sum, p) { return sum + p.quantity * p.unitCost; }, 0));
      const service = {
        vehicleId: sample.vehicleId, serviceDate: sample.serviceDate, serviceCenter: sample.serviceCenter,
        serviceType: sample.serviceType, description: sample.description, mileage: sample.mileage,
        labourCost: sample.labourCost, partsCost: partsCost, totalCost: round2(partsCost + sample.labourCost),
        nextServiceDate: sample.nextServiceDate
      };
      persistService(service, parts, nextId(load('services'), 'serviceId', 'S'));
    });

    syncVehicleDates(first);
    syncVehicleDates(second);
    renderAll();
    toast('Sample vehicles, services and spare parts loaded.');
  }

  $('seedBtn').addEventListener('click', seedSampleData);

  /* ================= Start ================= */

  populateTypeOptions();
  resetForm();
  renderAll();
})();