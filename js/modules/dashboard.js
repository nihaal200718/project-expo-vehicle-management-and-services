/**
 * Member 5 Deliverable: Dashboard, Reports & Integration Lead Module
 * Handles Executive KPI Cards, Upcoming Service Reminders, Insurance & PUC Expiry Tracking,
 * Maintenance Expense Interactive Charts & Reports, and Module Integration.
 */

const DashboardModule = (() => {
  const init = () => {
    bindEvents();
    renderAllDashboardComponents();
  };

  const bindEvents = () => {
    // Quick action buttons on dashboard
    document.getElementById('dash-btn-add-owner')?.addEventListener('click', () => {
      App.navigateTo('owners');
    });

    document.getElementById('dash-btn-add-vehicle')?.addEventListener('click', () => {
      App.navigateTo('vehicles');
    });

    document.getElementById('dash-btn-book-apt')?.addEventListener('click', () => {
      App.navigateTo('appointments');
    });

    document.getElementById('dash-btn-log-service')?.addEventListener('click', () => {
      App.navigateTo('services');
    });

    // Report filter changes
    document.getElementById('report-timeframe-filter')?.addEventListener('change', () => {
      renderExpenseReports();
    });

    // Seed data demo button
    document.getElementById('btn-reset-demo-data')?.addEventListener('click', () => {
      if (confirm('Reset and re-populate the system with complete demonstration data?')) {
        Store.resetAllData();
        App.showToast('System reset with fresh demo records!', 'success');
      }
    });

    // Export report buttons
    document.getElementById('btn-export-csv')?.addEventListener('click', exportExpenseCSV);
    document.getElementById('btn-print-report')?.addEventListener('click', () => window.print());

    // Store sync listener
    Store.subscribe(() => {
      renderAllDashboardComponents();
    });
  };

  const renderAllDashboardComponents = () => {
    renderKPICards();
    renderRemindersAndAlerts();
    renderDocumentExpiryTracker();
    renderExpenseReports();
    renderExpenseCharts();
  };

  // Executive KPI summary cards
  const renderKPICards = () => {
    const owners = Store.getOwners();
    const vehicles = Store.getVehicles();
    const services = Store.getServices();
    const appointments = Store.getAppointments();

    const totalExpense = services.reduce((acc, s) => acc + (s.totalExpenses || 0), 0);
    const pendingApts = appointments.filter((a) => a.status === 'Confirmed' || a.status === 'Pending').length;

    // Calculate critical alerts count
    let criticalDocCount = 0;
    vehicles.forEach((v) => {
      const ins = VehicleModule.checkExpiryStatus(v.insuranceExpiry);
      const puc = VehicleModule.checkExpiryStatus(v.pucExpiry);
      if (ins.colorClass === 'doc-critical' || puc.colorClass === 'doc-critical') {
        criticalDocCount++;
      }
    });

    setText('kpi-total-owners', owners.length);
    setText('kpi-total-vehicles', vehicles.length);
    setText('kpi-total-expense', `₹${totalExpense.toLocaleString('en-IN')}`);
    setText('kpi-active-appointments', pendingApts);
    setText('kpi-critical-alerts', criticalDocCount);
  };

  // Upcoming service reminders widget
  const renderRemindersAndAlerts = () => {
    const container = document.getElementById('dash-reminders-list');
    if (!container) return;

    const appointments = Store.getAppointments();
    const vehicles = Store.getVehicles();
    const owners = Store.getOwners();

    const today = new Date().toISOString().split('T')[0];

    // Upcoming appointments sorted by date
    const upcoming = appointments
      .filter((a) => a.date >= today && a.status !== 'Cancelled' && a.status !== 'Completed')
      .sort((a, b) => new Date(a.date) - new Date(b.date));

    if (upcoming.length === 0) {
      container.innerHTML = `
        <div class="empty-state-mini">
          <i class="far fa-calendar-check text-muted"></i>
          <span>No upcoming appointments scheduled for this week.</span>
        </div>
      `;
      return;
    }

    container.innerHTML = upcoming
      .slice(0, 5)
      .map((apt) => {
        const veh = vehicles.find((v) => v.id === apt.vehicleId);
        const owner = owners.find((o) => o.id === apt.ownerId);

        return `
        <div class="reminder-item">
          <div class="reminder-date-col">
            <span class="rmd-day">${new Date(apt.date).getDate()}</span>
            <span class="rmd-month">${new Date(apt.date).toLocaleString('default', { month: 'short' })}</span>
          </div>
          <div class="reminder-info-col">
            <div class="rmd-title font-semibold">${escapeHtml(apt.serviceType)}</div>
            <div class="rmd-sub text-muted">
              ${veh ? `${veh.manufacturer} ${veh.model} (${veh.regNumber})` : 'Vehicle N/A'}
            </div>
            <div class="rmd-owner text-xs">
              <i class="fas fa-user text-muted"></i> ${owner ? owner.name : 'Unknown'} • <i class="far fa-clock"></i> ${apt.timeSlot}
            </div>
          </div>
          <div class="reminder-action-col">
            <button class="btn btn-xs btn-outline" onclick="App.navigateTo('appointments'); AppointmentModule.viewDetail('${apt.id}')">
              View
            </button>
          </div>
        </div>
      `;
      })
      .join('');
  };

  // Insurance and PUC Expiry Tracker
  const renderDocumentExpiryTracker = () => {
    const container = document.getElementById('dash-expiry-tracker-list');
    if (!container) return;

    const vehicles = Store.getVehicles();
    const owners = Store.getOwners();

    const items = [];

    vehicles.forEach((v) => {
      const owner = owners.find((o) => o.id === v.ownerId);
      const ownerName = owner ? owner.name : 'Unknown';

      const insStatus = VehicleModule.checkExpiryStatus(v.insuranceExpiry);
      const pucStatus = VehicleModule.checkExpiryStatus(v.pucExpiry);

      if (insStatus.colorClass !== 'doc-valid') {
        items.push({
          vehicle: v,
          ownerName,
          docType: 'Insurance Policy',
          date: v.insuranceExpiry || 'Not set',
          status: insStatus
        });
      }

      if (pucStatus.colorClass !== 'doc-valid') {
        items.push({
          vehicle: v,
          ownerName,
          docType: 'PUC Pollution Certificate',
          date: v.pucExpiry || 'Not set',
          status: pucStatus
        });
      }
    });

    if (items.length === 0) {
      container.innerHTML = `
        <div class="empty-state-mini success-state">
          <i class="fas fa-check-double text-success"></i>
          <span>All vehicle insurance and PUC certificates are active and compliant!</span>
        </div>
      `;
      return;
    }

    container.innerHTML = items
      .map((item) => `
      <div class="expiry-item ${item.status.colorClass}">
        <div class="expiry-icon">
          <i class="${item.docType.includes('Insurance') ? 'fas fa-shield-alt' : 'fas fa-smog'}"></i>
        </div>
        <div class="expiry-text">
          <div class="expiry-veh-name font-semibold">${escapeHtml(item.vehicle.manufacturer)} ${escapeHtml(item.vehicle.model)} <span class="font-mono text-xs">(${escapeHtml(item.vehicle.regNumber)})</span></div>
          <div class="text-xs text-muted">Owner: ${escapeHtml(item.ownerName)} | <strong>${item.docType}</strong></div>
          <div class="expiry-status-pill">${item.status.text}</div>
        </div>
        <button class="btn btn-xs btn-primary-soft" onclick="App.navigateTo('vehicles'); VehicleModule.openEditModal('${item.vehicle.id}')">
          Renew / Update
        </button>
      </div>
    `)
      .join('');
  };

  // Maintenance Expense Detailed Reports
  const renderExpenseReports = () => {
    const tbody = document.getElementById('report-expenses-tbody');
    if (!tbody) return;

    const services = Store.getServices();
    const vehicles = Store.getVehicles();
    const owners = Store.getOwners();

    // Group expenses by vehicle
    const vehicleSummary = {};

    vehicles.forEach((v) => {
      vehicleSummary[v.id] = {
        vehicle: v,
        owner: owners.find((o) => o.id === v.ownerId),
        servicesCount: 0,
        partsTotal: 0,
        laborTotal: 0,
        grandTotal: 0
      };
    });

    services.forEach((s) => {
      if (!vehicleSummary[s.vehicleId]) {
        const v = vehicles.find((x) => x.id === s.vehicleId);
        vehicleSummary[s.vehicleId] = {
          vehicle: v || { regNumber: 'DELETED', manufacturer: 'Unknown', model: '' },
          owner: owners.find((o) => o.id === s.ownerId),
          servicesCount: 0,
          partsTotal: 0,
          laborTotal: 0,
          grandTotal: 0
        };
      }

      const pTotal = (s.parts || []).reduce((acc, p) => acc + (p.total || p.quantity * p.unitPrice), 0);
      vehicleSummary[s.vehicleId].servicesCount += 1;
      vehicleSummary[s.vehicleId].partsTotal += pTotal;
      vehicleSummary[s.vehicleId].laborTotal += s.laborCost || 0;
      vehicleSummary[s.vehicleId].grandTotal += s.totalExpenses || 0;
    });

    const rows = Object.values(vehicleSummary);

    if (rows.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" class="text-center py-4 text-muted">No vehicle expense data found.</td></tr>`;
      return;
    }

    tbody.innerHTML = rows
      .map((item) => `
      <tr>
        <td>
          <div class="font-semibold">${escapeHtml(item.vehicle.manufacturer)} ${escapeHtml(item.vehicle.model)}</div>
          <div class="font-mono text-xs text-muted">${escapeHtml(item.vehicle.regNumber)}</div>
        </td>
        <td>${item.owner ? escapeHtml(item.owner.name) : 'N/A'}</td>
        <td class="text-center font-bold">${item.servicesCount}</td>
        <td>₹${item.partsTotal.toLocaleString('en-IN')}</td>
        <td>₹${item.laborTotal.toLocaleString('en-IN')}</td>
        <td class="font-bold text-brand">₹${item.grandTotal.toLocaleString('en-IN')}</td>
      </tr>
    `)
      .join('');
  };

  // Pure SVG/Canvas interactive charts (No external library dependencies!)
  const renderExpenseCharts = () => {
    const chartContainer = document.getElementById('expense-bar-chart-container');
    if (!chartContainer) return;

    const vehicles = Store.getVehicles();
    const services = Store.getServices();

    // Calculate spend per vehicle
    const data = vehicles.map((v) => {
      const vServices = services.filter((s) => s.vehicleId === v.id);
      const total = vServices.reduce((acc, s) => acc + (s.totalExpenses || 0), 0);
      return {
        label: `${v.manufacturer} ${v.model.split(' ')[0]}`,
        reg: v.regNumber,
        value: total
      };
    });

    const maxVal = Math.max(...data.map((d) => d.value), 1000);

    chartContainer.innerHTML = `
      <div class="chart-bars-wrap">
        ${data
          .map((item) => {
            const heightPercent = Math.max(8, Math.round((item.value / maxVal) * 100));
            return `
            <div class="chart-bar-col" title="${item.reg}: ₹${item.value.toLocaleString('en-IN')}">
              <div class="chart-bar-value">₹${(item.value / 1000).toFixed(1)}k</div>
              <div class="chart-bar-track">
                <div class="chart-bar-fill" style="height: ${heightPercent}%"></div>
              </div>
              <div class="chart-bar-label font-mono">${escapeHtml(item.label)}</div>
            </div>
          `;
          })
          .join('')}
      </div>
    `;

    // Service Breakdown Donut / Stacked Bar
    const typeContainer = document.getElementById('service-type-distribution-container');
    if (typeContainer) {
      const typeCounts = {};
      services.forEach((s) => {
        typeCounts[s.serviceType] = (typeCounts[s.serviceType] || 0) + 1;
      });

      const totalSrv = services.length || 1;
      const typesList = Object.entries(typeCounts);

      typeContainer.innerHTML = `
        <div class="type-distribution-list">
          ${typesList
            .map(([type, count]) => {
              const percent = Math.round((count / totalSrv) * 100);
              return `
              <div class="type-dist-row">
                <div class="type-dist-header">
                  <span>${escapeHtml(type)}</span>
                  <strong>${count} (${percent}%)</strong>
                </div>
                <div class="progress-bar-bg">
                  <div class="progress-bar-fill" style="width: ${percent}%;"></div>
                </div>
              </div>
            `;
            })
            .join('')}
        </div>
      `;
    }
  };

  const exportExpenseCSV = () => {
    const services = Store.getServices();
    const vehicles = Store.getVehicles();
    const owners = Store.getOwners();

    let csv = 'Service ID,Date,Vehicle Reg,Manufacturer,Model,Owner Name,Owner Email,Service Type,Workshop,Total Expense (INR)\n';

    services.forEach((s) => {
      const v = vehicles.find((x) => x.id === s.vehicleId);
      const o = owners.find((x) => x.id === s.ownerId);

      const row = [
        s.id,
        s.serviceDate,
        v ? `"${v.regNumber}"` : 'N/A',
        v ? `"${v.manufacturer}"` : 'N/A',
        v ? `"${v.model}"` : 'N/A',
        o ? `"${o.name}"` : 'N/A',
        o ? `"${o.email}"` : 'N/A',
        `"${s.serviceType}"`,
        `"${s.serviceCenter}"`,
        s.totalExpenses || 0
      ];
      csv += row.join(',') + '\n';
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `VMS_Maintenance_Report_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    App.showToast('Expense report CSV downloaded successfully!', 'success');
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
    renderAllDashboardComponents,
    renderKPICards,
    renderRemindersAndAlerts,
    renderDocumentExpiryTracker,
    renderExpenseReports,
    renderExpenseCharts,
    exportExpenseCSV
  };
})();
