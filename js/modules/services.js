/**
 * Member 3 Deliverable: Service History and Maintenance Module
 * Handles Service Record Creation, Spare Parts Line Items, Auto Total Calculation,
 * Service Invoicing/Details Modal, and Maintenance Records Management.
 */

const ServiceModule = (() => {
  let currentEditingServiceId = null;

  const init = () => {
    bindEvents();
    renderServiceRecords();
    setupDynamicPartsTable('service-parts-table-body', 'service-parts-total', 'service-labor-cost', 'service-tax-rate', 'service-grand-total');
  };

  const bindEvents = () => {
    // Add Service Form Submit
    const form = document.getElementById('form-service-add');
    if (form) {
      form.addEventListener('submit', handleServiceSubmit);
    }

    // Vehicle Select change in Add Service form -> auto fill owner
    const vehSelect = document.getElementById('srv-vehicle-input');
    if (vehSelect) {
      vehSelect.addEventListener('change', () => {
        const veh = Store.getVehicleById(vehSelect.value);
        const ownerInput = document.getElementById('srv-owner-display');
        if (veh && ownerInput) {
          const owner = Store.getOwnerById(veh.ownerId);
          ownerInput.value = owner ? `${owner.name} (${owner.id})` : 'Unknown';
          ownerInput.dataset.ownerId = veh.ownerId;
        } else if (ownerInput) {
          ownerInput.value = '';
          ownerInput.dataset.ownerId = '';
        }
      });
    }

    // Add Spare Part Row Button
    const btnAddPart = document.getElementById('btn-add-spare-part');
    if (btnAddPart) {
      btnAddPart.addEventListener('click', () => {
        addPartRow('service-parts-table-body', 'service-parts-total', 'service-labor-cost', 'service-tax-rate', 'service-grand-total');
      });
    }

    // Search / Filter
    const searchInput = document.getElementById('service-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', () => {
        applyServiceFilters();
      });
    }

    const typeFilter = document.getElementById('service-type-filter');
    if (typeFilter) {
      typeFilter.addEventListener('change', () => {
        applyServiceFilters();
      });
    }

    // Edit Modal Form Submit
    const editForm = document.getElementById('form-service-edit');
    if (editForm) {
      editForm.addEventListener('submit', handleServiceEditSubmit);
    }

    // Add part in Edit Modal
    const btnEditAddPart = document.getElementById('btn-edit-add-spare-part');
    if (btnEditAddPart) {
      btnEditAddPart.addEventListener('click', () => {
        addPartRow('edit-parts-table-body', 'edit-parts-total', 'edit-service-labor', 'edit-service-tax', 'edit-service-grand-total');
      });
    }

    // Close Modals
    document.querySelectorAll('.close-service-modal').forEach((btn) => {
      btn.addEventListener('click', closeModals);
    });

    // Store listener
    Store.subscribe((key) => {
      if (key === Store.KEYS.SERVICES || key === Store.KEYS.VEHICLES || key === 'reset') {
        renderServiceRecords();
      }
    });
  };

  // Helper for dynamic parts row creation and live computation
  const addPartRow = (tbodyId, partsTotalId, laborId, taxId, grandTotalId, existingData = null) => {
    const tbody = document.getElementById(tbodyId);
    if (!tbody) return;

    const row = document.createElement('tr');
    row.className = 'spare-part-row';
    row.innerHTML = `
      <td>
        <input type="text" class="input input-sm part-name-input" placeholder="Part name (e.g. Brake Pads)" value="${existingData ? escapeHtml(existingData.name) : ''}" required>
      </td>
      <td>
        <input type="text" class="input input-sm part-sku-input" placeholder="Part #" value="${existingData ? escapeHtml(existingData.partNumber) : ''}">
      </td>
      <td>
        <input type="number" class="input input-sm part-qty-input" min="1" step="1" value="${existingData ? existingData.quantity : '1'}" required style="width: 70px;">
      </td>
      <td>
        <input type="number" class="input input-sm part-price-input" min="0" step="1" value="${existingData ? existingData.unitPrice : '0'}" required style="width: 100px;">
      </td>
      <td>
        <span class="part-row-subtotal font-mono font-semibold">₹${existingData ? (existingData.quantity * existingData.unitPrice).toLocaleString('en-IN') : '0'}</span>
      </td>
      <td>
        <button type="button" class="btn btn-xs btn-danger-soft btn-remove-row" title="Remove part">
          <i class="fas fa-times"></i>
        </button>
      </td>
    `;

    tbody.appendChild(row);

    // Event listeners on row inputs
    const qtyInput = row.querySelector('.part-qty-input');
    const priceInput = row.querySelector('.part-price-input');
    const removeBtn = row.querySelector('.btn-remove-row');
    const subtotalEl = row.querySelector('.part-row-subtotal');

    const updateRow = () => {
      const q = Math.max(1, parseInt(qtyInput.value, 10) || 1);
      const p = Math.max(0, parseFloat(priceInput.value) || 0);
      subtotalEl.textContent = `₹${(q * p).toLocaleString('en-IN')}`;
      recalculateTotals(tbodyId, partsTotalId, laborId, taxId, grandTotalId);
    };

    qtyInput.addEventListener('input', updateRow);
    priceInput.addEventListener('input', updateRow);

    removeBtn.addEventListener('click', () => {
      row.remove();
      recalculateTotals(tbodyId, partsTotalId, laborId, taxId, grandTotalId);
    });

    recalculateTotals(tbodyId, partsTotalId, laborId, taxId, grandTotalId);
  };

  const setupDynamicPartsTable = (tbodyId, partsTotalId, laborId, taxId, grandTotalId) => {
    const laborInput = document.getElementById(laborId);
    const taxInput = document.getElementById(taxId);

    if (laborInput) {
      laborInput.addEventListener('input', () => {
        recalculateTotals(tbodyId, partsTotalId, laborId, taxId, grandTotalId);
      });
    }
    if (taxInput) {
      taxInput.addEventListener('input', () => {
        recalculateTotals(tbodyId, partsTotalId, laborId, taxId, grandTotalId);
      });
    }
  };

  const recalculateTotals = (tbodyId, partsTotalId, laborId, taxId, grandTotalId) => {
    const tbody = document.getElementById(tbodyId);
    if (!tbody) return;

    let partsSum = 0;
    tbody.querySelectorAll('.spare-part-row').forEach((row) => {
      const q = Math.max(1, parseInt(row.querySelector('.part-qty-input')?.value, 10) || 1);
      const p = Math.max(0, parseFloat(row.querySelector('.part-price-input')?.value) || 0);
      partsSum += q * p;
    });

    const labor = parseFloat(document.getElementById(laborId)?.value) || 0;
    const taxPercent = parseFloat(document.getElementById(taxId)?.value) || 0;

    const subtotal = partsSum + labor;
    const taxAmt = (subtotal * taxPercent) / 100;
    const grand = Math.round(subtotal + taxAmt);

    const partsTotalEl = document.getElementById(partsTotalId);
    const grandTotalEl = document.getElementById(grandTotalId);

    if (partsTotalEl) partsTotalEl.textContent = `₹${partsSum.toLocaleString('en-IN')}`;
    if (grandTotalEl) grandTotalEl.textContent = `₹${grand.toLocaleString('en-IN')}`;
  };

  const extractPartsFromTable = (tbodyId) => {
    const tbody = document.getElementById(tbodyId);
    if (!tbody) return [];

    const parts = [];
    tbody.querySelectorAll('.spare-part-row').forEach((row) => {
      const name = row.querySelector('.part-name-input')?.value.trim();
      const partNumber = row.querySelector('.part-sku-input')?.value.trim() || 'N/A';
      const quantity = Math.max(1, parseInt(row.querySelector('.part-qty-input')?.value, 10) || 1);
      const unitPrice = Math.max(0, parseFloat(row.querySelector('.part-price-input')?.value) || 0);

      if (name) {
        parts.push({
          name,
          partNumber,
          quantity,
          unitPrice,
          total: quantity * unitPrice
        });
      }
    });
    return parts;
  };

  const handleServiceSubmit = (e) => {
    e.preventDefault();

    const vehId = document.getElementById('srv-vehicle-input').value;
    const veh = Store.getVehicleById(vehId);
    if (!veh) {
      alert('Please select a registered vehicle.');
      return;
    }

    const serviceDate = document.getElementById('srv-date-input').value;
    const serviceCenter = document.getElementById('srv-center-input').value.trim();
    const serviceCenterContact = document.getElementById('srv-contact-input').value.trim();
    const serviceType = document.getElementById('srv-type-input').value;
    const serviceDescription = document.getElementById('srv-desc-input').value.trim();
    const laborCost = parseFloat(document.getElementById('service-labor-cost').value) || 0;
    const taxPercent = parseFloat(document.getElementById('service-tax-rate').value) || 0;

    if (!serviceDate) {
      alert('Service date is required.');
      return;
    }
    if (!serviceCenter) {
      alert('Service Center name is required.');
      return;
    }
    if (!serviceDescription) {
      alert('Please enter a service description.');
      return;
    }

    const parts = extractPartsFromTable('service-parts-table-body');

    try {
      const record = Store.addService({
        vehicleId: veh.id,
        ownerId: veh.ownerId,
        serviceDate,
        serviceCenter,
        serviceCenterContact,
        serviceType,
        serviceDescription,
        parts,
        laborCost,
        taxPercent
      });

      App.showToast(`Service Record ${record.id} logged successfully (Total: ₹${record.totalExpenses.toLocaleString('en-IN')})`, 'success');

      // Reset form
      document.getElementById('form-service-add').reset();
      const partsBody = document.getElementById('service-parts-table-body');
      if (partsBody) partsBody.innerHTML = '';
      recalculateTotals('service-parts-table-body', 'service-parts-total', 'service-labor-cost', 'service-tax-rate', 'service-grand-total');

      renderServiceRecords();
    } catch (err) {
      App.showToast(err.message, 'error');
    }
  };

  const applyServiceFilters = () => {
    const searchVal = document.getElementById('service-search-input')?.value.trim().toLowerCase() || '';
    const typeVal = document.getElementById('service-type-filter')?.value || '';

    let records = Store.getServices();
    const vehicles = Store.getVehicles();
    const owners = Store.getOwners();

    if (searchVal) {
      records = records.filter((r) => {
        const v = vehicles.find((x) => x.id === r.vehicleId);
        const o = owners.find((x) => x.id === r.ownerId);
        return (
          r.id.toLowerCase().includes(searchVal) ||
          r.serviceCenter.toLowerCase().includes(searchVal) ||
          r.serviceDescription.toLowerCase().includes(searchVal) ||
          (v && (v.regNumber.toLowerCase().includes(searchVal) || v.model.toLowerCase().includes(searchVal))) ||
          (o && o.name.toLowerCase().includes(searchVal))
        );
      });
    }

    if (typeVal) {
      records = records.filter((r) => r.serviceType === typeVal);
    }

    renderTableRecords(records);
  };

  const renderServiceRecords = () => {
    applyServiceFilters();
  };

  const renderTableRecords = (records) => {
    const tbody = document.getElementById('services-table-body');
    if (!tbody) return;

    const countEl = document.getElementById('services-count-badge');
    if (countEl) countEl.textContent = `${records.length} Services`;

    if (records.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" class="text-center py-6 text-muted">
            <div class="empty-state">
              <div class="empty-icon">🔧</div>
              <p>No service records match your criteria.</p>
            </div>
          </td>
        </tr>
      `;
      return;
    }

    const vehicles = Store.getVehicles();
    const owners = Store.getOwners();

    tbody.innerHTML = records
      .map((rec) => {
        const veh = vehicles.find((v) => v.id === rec.vehicleId);
        const owner = owners.find((o) => o.id === rec.ownerId);

        return `
        <tr>
          <td>
            <div class="font-mono font-bold text-brand">${escapeHtml(rec.id)}</div>
            <small class="text-muted">${rec.serviceDate}</small>
          </td>
          <td>
            <div class="font-semibold">${veh ? `${escapeHtml(veh.manufacturer)} ${escapeHtml(veh.model)}` : 'Unknown'}</div>
            <div class="font-mono text-xs text-muted">${veh ? escapeHtml(veh.regNumber) : ''}</div>
          </td>
          <td>
            <div>${owner ? escapeHtml(owner.name) : 'N/A'}</div>
            <small class="text-muted font-mono">${rec.ownerId}</small>
          </td>
          <td>
            <div class="badge badge-outline">${escapeHtml(rec.serviceType)}</div>
            <div class="text-xs text-muted mt-1 truncate" style="max-width: 180px;">${escapeHtml(rec.serviceCenter)}</div>
          </td>
          <td>
            <span class="badge badge-secondary">${(rec.parts || []).length} items</span>
          </td>
          <td>
            <div class="font-mono font-bold text-success">₹${(rec.totalExpenses || 0).toLocaleString('en-IN')}</div>
          </td>
          <td>
            <div class="flex gap-1">
              <button class="btn btn-xs btn-primary-soft" onclick="ServiceModule.viewServiceDetail('${rec.id}')" title="View Full Invoice Details">
                <i class="fas fa-file-invoice"></i> View
              </button>
              <button class="btn btn-xs btn-secondary" onclick="ServiceModule.openEditModal('${rec.id}')" title="Edit Record">
                <i class="fas fa-edit"></i>
              </button>
              <button class="btn btn-xs btn-danger-soft" onclick="ServiceModule.handleDelete('${rec.id}')" title="Delete Record">
                <i class="fas fa-trash"></i>
              </button>
            </div>
          </td>
        </tr>
      `;
      })
      .join('');
  };

  // View full detailed invoice modal
  const viewServiceDetail = (serviceId) => {
    const srv = Store.getServiceById(serviceId);
    if (!srv) return;

    const veh = Store.getVehicleById(srv.vehicleId);
    const owner = Store.getOwnerById(srv.ownerId);

    const modal = document.getElementById('modal-service-view');
    const content = document.getElementById('service-view-content');
    if (!modal || !content) return;

    const partsTotal = (srv.parts || []).reduce((acc, p) => acc + (p.total || (p.quantity * p.unitPrice)), 0);
    const labor = srv.laborCost || 0;
    const subtotal = partsTotal + labor;
    const taxAmt = Math.round((subtotal * (srv.taxPercent || 0)) / 100);

    content.innerHTML = `
      <div class="invoice-container">
        <div class="invoice-header">
          <div>
            <span class="badge badge-primary">${escapeHtml(srv.serviceType)}</span>
            <h2 class="invoice-title">Service Maintenance Invoice</h2>
            <div class="text-sm text-muted">Record Ref: <strong class="font-mono">${srv.id}</strong></div>
          </div>
          <div class="invoice-meta text-right">
            <div><strong>Date:</strong> ${srv.serviceDate}</div>
            <div><strong>Workshop:</strong> ${escapeHtml(srv.serviceCenter)}</div>
            ${srv.serviceCenterContact ? `<div><strong>Phone:</strong> ${escapeHtml(srv.serviceCenterContact)}</div>` : ''}
          </div>
        </div>

        <div class="invoice-bilateral-grid">
          <div class="invoice-box">
            <h4><i class="fas fa-car"></i> Vehicle Details</h4>
            <p><strong>Model:</strong> ${veh ? `${veh.manufacturer} ${veh.model}` : 'N/A'}</p>
            <p><strong>Reg #:</strong> <span class="font-mono font-bold">${veh ? veh.regNumber : 'N/A'}</span></p>
            <p><strong>Fuel:</strong> ${veh ? veh.fuelType : 'N/A'}</p>
          </div>
          <div class="invoice-box">
            <h4><i class="fas fa-user"></i> Owner Details</h4>
            <p><strong>Name:</strong> ${owner ? owner.name : 'N/A'}</p>
            <p><strong>Mobile:</strong> ${owner ? owner.mobile : 'N/A'}</p>
            <p><strong>Address:</strong> ${owner ? owner.address : 'N/A'}</p>
          </div>
        </div>

        <div class="invoice-desc-box">
          <strong>Work Description:</strong>
          <p>${escapeHtml(srv.serviceDescription)}</p>
        </div>

        <h4 class="mt-4 mb-2"><i class="fas fa-cogs"></i> Spare Parts & Consumables Installed</h4>
        <table class="table-compact full-width">
          <thead>
            <tr>
              <th>Part Name</th>
              <th>Part / SKU #</th>
              <th>Qty</th>
              <th>Unit Price</th>
              <th class="text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            ${
              (srv.parts || []).length === 0
                ? '<tr><td colspan="5" class="text-muted text-center py-2">No spare parts replaced (Labor & inspection only)</td></tr>'
                : srv.parts
                    .map(
                      (p) => `
                  <tr>
                    <td><strong>${escapeHtml(p.name)}</strong></td>
                    <td class="font-mono text-muted text-xs">${escapeHtml(p.partNumber || 'N/A')}</td>
                    <td>${p.quantity}</td>
                    <td>₹${(p.unitPrice || 0).toLocaleString('en-IN')}</td>
                    <td class="text-right font-mono font-semibold">₹${((p.quantity || 1) * (p.unitPrice || 0)).toLocaleString('en-IN')}</td>
                  </tr>
                `
                    )
                    .join('')
            }
          </tbody>
        </table>

        <!-- Totals summary block -->
        <div class="invoice-totals-breakdown">
          <div class="row">
            <span>Parts Subtotal:</span>
            <span>₹${partsTotal.toLocaleString('en-IN')}</span>
          </div>
          <div class="row">
            <span>Labor & Professional Fees:</span>
            <span>₹${labor.toLocaleString('en-IN')}</span>
          </div>
          <div class="row">
            <span>GST / Taxes (${srv.taxPercent || 0}%):</span>
            <span>₹${taxAmt.toLocaleString('en-IN')}</span>
          </div>
          <div class="row grand-total">
            <span>Total Maintenance Expense:</span>
            <span class="text-brand">₹${(srv.totalExpenses || 0).toLocaleString('en-IN')}</span>
          </div>
        </div>

        <div class="invoice-actions no-print mt-6 flex justify-end gap-2">
          <button class="btn btn-secondary" onclick="window.print()"><i class="fas fa-print"></i> Print Invoice</button>
          <button class="btn btn-primary" onclick="ServiceModule.closeModals()">Done</button>
        </div>
      </div>
    `;

    modal.classList.remove('hidden');
    modal.classList.add('flex');
  };

  // Open Edit Modal
  const openEditModal = (serviceId) => {
    const srv = Store.getServiceById(serviceId);
    if (!srv) return;

    currentEditingServiceId = serviceId;
    document.getElementById('edit-srv-id').value = srv.id;
    document.getElementById('edit-srv-date').value = srv.serviceDate;
    document.getElementById('edit-srv-center').value = srv.serviceCenter;
    document.getElementById('edit-srv-contact').value = srv.serviceCenterContact || '';
    document.getElementById('edit-srv-type').value = srv.serviceType;
    document.getElementById('edit-srv-desc').value = srv.serviceDescription;
    document.getElementById('edit-service-labor').value = srv.laborCost || 0;
    document.getElementById('edit-service-tax').value = srv.taxPercent !== undefined ? srv.taxPercent : 18;

    const editPartsTbody = document.getElementById('edit-parts-table-body');
    if (editPartsTbody) {
      editPartsTbody.innerHTML = '';
      (srv.parts || []).forEach((p) => {
        addPartRow('edit-parts-table-body', 'edit-parts-total', 'edit-service-labor', 'edit-service-tax', 'edit-service-grand-total', p);
      });
      recalculateTotals('edit-parts-table-body', 'edit-parts-total', 'edit-service-labor', 'edit-service-tax', 'edit-service-grand-total');
    }

    setupDynamicPartsTable('edit-parts-table-body', 'edit-parts-total', 'edit-service-labor', 'edit-service-tax', 'edit-service-grand-total');

    const modal = document.getElementById('modal-service-edit');
    if (modal) {
      modal.classList.remove('hidden');
      modal.classList.add('flex');
    }
  };

  const handleServiceEditSubmit = (e) => {
    e.preventDefault();
    if (!currentEditingServiceId) return;

    const serviceDate = document.getElementById('edit-srv-date').value;
    const serviceCenter = document.getElementById('edit-srv-center').value.trim();
    const serviceCenterContact = document.getElementById('edit-srv-contact').value.trim();
    const serviceType = document.getElementById('edit-srv-type').value;
    const serviceDescription = document.getElementById('edit-srv-desc').value.trim();
    const laborCost = parseFloat(document.getElementById('edit-service-labor').value) || 0;
    const taxPercent = parseFloat(document.getElementById('edit-service-tax').value) || 0;

    const parts = extractPartsFromTable('edit-parts-table-body');

    try {
      Store.updateService(currentEditingServiceId, {
        serviceDate,
        serviceCenter,
        serviceCenterContact,
        serviceType,
        serviceDescription,
        parts,
        laborCost,
        taxPercent
      });

      App.showToast(`Service Record ${currentEditingServiceId} updated!`, 'success');
      closeModals();
      renderServiceRecords();
    } catch (err) {
      App.showToast(err.message, 'error');
    }
  };

  const handleDelete = (serviceId) => {
    if (!confirm(`Are you sure you want to delete service record ${serviceId}?`)) return;

    try {
      Store.deleteService(serviceId);
      App.showToast(`Service record ${serviceId} deleted.`, 'info');
      renderServiceRecords();
    } catch (err) {
      alert(err.message);
    }
  };

  const closeModals = () => {
    document.querySelectorAll('.service-modal').forEach((m) => {
      m.classList.add('hidden');
      m.classList.remove('flex');
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
    renderServiceRecords,
    viewServiceDetail,
    openEditModal,
    handleDelete,
    closeModals
  };
})();
