/**
 * Member 4 Deliverable: Appointment Booking System Module
 * Handles Appointment Booking Form, Time Slot Availability, Confirmation Modal,
 * Status Tracking (Confirmed, Rescheduled, Cancelled, Completed), and Rescheduling.
 */

const AppointmentModule = (() => {
  const DEFAULT_TIME_SLOTS = [
    '09:00 AM - 10:30 AM',
    '10:30 AM - 12:00 PM',
    '12:00 PM - 01:30 PM',
    '02:00 PM - 03:30 PM',
    '03:30 PM - 05:00 PM',
    '05:00 PM - 06:30 PM'
  ];

  let selectedTimeSlot = null;
  let rescheduleTargetId = null;
  let rescheduleSelectedSlot = null;

  const init = () => {
    bindEvents();
    renderTimeSlots();
    renderAppointmentsList();
    setDefaultDate();
  };

  const setDefaultDate = () => {
    const dateInput = document.getElementById('apt-date-input');
    if (dateInput) {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      dateInput.min = new Date().toISOString().split('T')[0];
      dateInput.value = tomorrow.toISOString().split('T')[0];
    }
  };

  const bindEvents = () => {
    // Appointment Form Submit
    const form = document.getElementById('form-appointment-book');
    if (form) {
      form.addEventListener('submit', handleBookingSubmit);
    }

    // Vehicle Select change -> auto populate owner info
    const vehSelect = document.getElementById('apt-vehicle-input');
    if (vehSelect) {
      vehSelect.addEventListener('change', () => {
        const vehId = vehSelect.value;
        const veh = Store.getVehicleById(vehId);
        const ownerDisplay = document.getElementById('apt-owner-display');
        if (veh && ownerDisplay) {
          const owner = Store.getOwnerById(veh.ownerId);
          ownerDisplay.value = owner ? `${owner.name} (${owner.mobile})` : 'Unknown';
          ownerDisplay.dataset.ownerId = veh.ownerId;
        } else if (ownerDisplay) {
          ownerDisplay.value = '';
          ownerDisplay.dataset.ownerId = '';
        }
      });
    }

    // Tab Filters for appointment status
    document.querySelectorAll('.apt-status-tab').forEach((tab) => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.apt-status-tab').forEach((t) => t.classList.remove('active'));
        tab.classList.add('active');
        const status = tab.getAttribute('data-status');
        renderAppointmentsList(status);
      });
    });

    // Reschedule form submit
    const reschedForm = document.getElementById('form-reschedule-submit');
    if (reschedForm) {
      reschedForm.addEventListener('submit', handleRescheduleSubmit);
    }

    // Close Modals
    document.querySelectorAll('.close-apt-modal').forEach((btn) => {
      btn.addEventListener('click', closeModals);
    });

    // Store listener
    Store.subscribe((key) => {
      if (key === Store.KEYS.APPOINTMENTS || key === Store.KEYS.VEHICLES || key === 'reset') {
        renderAppointmentsList();
      }
    });
  };

  const renderTimeSlots = () => {
    const container = document.getElementById('time-slots-container');
    if (!container) return;

    container.innerHTML = DEFAULT_TIME_SLOTS.map((slot) => {
      const isSelected = selectedTimeSlot === slot;
      return `
        <button type="button" class="slot-pill ${isSelected ? 'selected' : ''}" data-slot="${slot}">
          <i class="far fa-clock"></i> ${slot}
        </button>
      `;
    }).join('');

    container.querySelectorAll('.slot-pill').forEach((btn) => {
      btn.addEventListener('click', () => {
        container.querySelectorAll('.slot-pill').forEach((b) => b.classList.remove('selected'));
        btn.classList.add('selected');
        selectedTimeSlot = btn.getAttribute('data-slot');
      });
    });
  };

  const handleBookingSubmit = (e) => {
    e.preventDefault();

    const vehId = document.getElementById('apt-vehicle-input').value;
    const veh = Store.getVehicleById(vehId);
    if (!veh) {
      alert('Please select a registered vehicle for the appointment.');
      return;
    }

    const serviceType = document.getElementById('apt-service-type').value;
    const date = document.getElementById('apt-date-input').value;
    const notes = document.getElementById('apt-notes-input').value.trim();

    if (!selectedTimeSlot) {
      alert('Please select an available time slot from the schedule.');
      return;
    }

    if (!date) {
      alert('Please select a preferred service date.');
      return;
    }

    try {
      const newApt = Store.addAppointment({
        vehicleId: veh.id,
        ownerId: veh.ownerId,
        serviceType,
        date,
        timeSlot: selectedTimeSlot,
        notes
      });

      // Display Booking Confirmation Modal
      showBookingConfirmation(newApt);

      // Reset Form
      document.getElementById('form-appointment-book').reset();
      selectedTimeSlot = null;
      renderTimeSlots();
      setDefaultDate();
      renderAppointmentsList();
    } catch (err) {
      App.showToast(err.message, 'error');
    }
  };

  const showBookingConfirmation = (apt) => {
    const veh = Store.getVehicleById(apt.vehicleId);
    const owner = Store.getOwnerById(apt.ownerId);

    const modal = document.getElementById('modal-booking-confirmation');
    const content = document.getElementById('booking-confirmation-content');
    if (!modal || !content) return;

    content.innerHTML = `
      <div class="confirmation-badge-success">
        <div class="icon-circle"><i class="fas fa-check"></i></div>
        <h3>Booking Confirmed!</h3>
        <p class="text-muted">Your service appointment has been scheduled successfully.</p>
      </div>

      <div class="confirmation-card-summary">
        <div class="summary-line">
          <span>Booking Reference:</span>
          <span class="font-mono font-bold text-brand">${apt.id}</span>
        </div>
        <div class="summary-line">
          <span>Status:</span>
          <span class="badge badge-success"><i class="fas fa-check-circle"></i> ${apt.status}</span>
        </div>
        <div class="summary-line">
          <span>Service Required:</span>
          <span class="font-semibold">${escapeHtml(apt.serviceType)}</span>
        </div>
        <div class="summary-line">
          <span>Scheduled Date:</span>
          <span class="font-semibold">${apt.date}</span>
        </div>
        <div class="summary-line">
          <span>Time Slot:</span>
          <span class="font-semibold">${apt.timeSlot}</span>
        </div>
        <hr class="my-2 border-subtle">
        <div class="summary-line">
          <span>Vehicle:</span>
          <span>${veh ? `${veh.manufacturer} ${veh.model} (${veh.regNumber})` : 'N/A'}</span>
        </div>
        <div class="summary-line">
          <span>Owner / Contact:</span>
          <span>${owner ? `${owner.name} (${owner.mobile})` : 'N/A'}</span>
        </div>
        ${apt.notes ? `<div class="mt-2 text-xs text-muted"><strong>Notes:</strong> ${escapeHtml(apt.notes)}</div>` : ''}
      </div>

      <div class="mt-4 flex justify-center gap-2">
        <button class="btn btn-secondary" onclick="window.print()"><i class="fas fa-print"></i> Print Slip</button>
        <button class="btn btn-primary" onclick="AppointmentModule.closeModals()">Great, Back to App</button>
      </div>
    `;

    modal.classList.remove('hidden');
    modal.classList.add('flex');
  };

  const renderAppointmentsList = (filterStatus = 'all') => {
    const container = document.getElementById('appointments-cards-container');
    if (!container) return;

    let appointments = Store.getAppointments();
    const countBadge = document.getElementById('appointments-count-badge');
    if (countBadge) countBadge.textContent = `${appointments.length} Total`;

    if (filterStatus && filterStatus !== 'all') {
      appointments = appointments.filter((a) => a.status.toLowerCase() === filterStatus.toLowerCase());
    }

    if (appointments.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon"><i class="fas fa-calendar-alt"></i></div>
          <h3>No Appointments Found</h3>
          <p>${filterStatus === 'all' ? 'No appointments have been booked yet.' : `No appointments with status "${filterStatus}".`}</p>
        </div>
      `;
      return;
    }

    const vehicles = Store.getVehicles();
    const owners = Store.getOwners();

    container.innerHTML = appointments
      .map((apt) => {
        const veh = vehicles.find((v) => v.id === apt.vehicleId);
        const owner = owners.find((o) => o.id === apt.ownerId);
        const statusBadgeClass = getStatusBadge(apt.status);

        return `
        <div class="appointment-card card status-border-${apt.status.toLowerCase()}">
          <div class="apt-card-header">
            <div>
              <span class="badge ${statusBadgeClass}">${escapeHtml(apt.status)}</span>
              <span class="apt-id-tag font-mono">${escapeHtml(apt.id)}</span>
            </div>
            <div class="apt-date-tag">
              <i class="far fa-calendar-check"></i> ${apt.date}
            </div>
          </div>

          <div class="apt-card-body">
            <h4 class="apt-service-title">${escapeHtml(apt.serviceType)}</h4>
            <div class="apt-slot-badge"><i class="far fa-clock"></i> ${escapeHtml(apt.timeSlot)}</div>

            <div class="apt-meta-info mt-3">
              <div class="meta-row">
                <i class="fas fa-car text-muted"></i>
                <span>${veh ? `${escapeHtml(veh.manufacturer)} ${escapeHtml(veh.model)} (${escapeHtml(veh.regNumber)})` : 'Vehicle Deleted'}</span>
              </div>
              <div class="meta-row">
                <i class="fas fa-user text-muted"></i>
                <span>${owner ? `${escapeHtml(owner.name)} - ${escapeHtml(owner.mobile)}` : 'Owner N/A'}</span>
              </div>
              ${
                apt.notes
                  ? `<div class="meta-row notes">
                      <i class="fas fa-comment-alt text-muted"></i>
                      <em>"${escapeHtml(apt.notes)}"</em>
                    </div>`
                  : ''
              }
              ${
                apt.cancellationReason
                  ? `<div class="meta-row text-danger">
                      <i class="fas fa-ban"></i>
                      <span>Reason: ${escapeHtml(apt.cancellationReason)}</span>
                    </div>`
                  : ''
              }
            </div>
          </div>

          <div class="apt-card-actions">
            <button class="btn btn-xs btn-secondary" onclick="AppointmentModule.viewDetail('${apt.id}')">
              <i class="fas fa-eye"></i> Details
            </button>
            ${
              apt.status !== 'Cancelled' && apt.status !== 'Completed'
                ? `
              <button class="btn btn-xs btn-primary-soft" onclick="AppointmentModule.openRescheduleModal('${apt.id}')">
                <i class="fas fa-clock"></i> Reschedule
              </button>
              <button class="btn btn-xs btn-outline-success" onclick="AppointmentModule.markCompleted('${apt.id}')">
                <i class="fas fa-check"></i> Complete
              </button>
              <button class="btn btn-xs btn-danger-soft" onclick="AppointmentModule.openCancelModal('${apt.id}')">
                <i class="fas fa-times"></i> Cancel
              </button>
            `
                : ''
            }
            <button class="btn btn-xs btn-danger-ghost" onclick="AppointmentModule.handleDelete('${apt.id}')" title="Delete record">
              <i class="fas fa-trash"></i>
            </button>
          </div>
        </div>
      `;
      })
      .join('');
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'Confirmed':
        return 'badge-success';
      case 'Pending':
        return 'badge-warning';
      case 'Rescheduled':
        return 'badge-info';
      case 'Cancelled':
        return 'badge-danger';
      case 'Completed':
        return 'badge-purple';
      default:
        return 'badge-secondary';
    }
  };

  const viewDetail = (aptId) => {
    const apt = Store.getAppointmentById(aptId);
    if (!apt) return;
    showBookingConfirmation(apt);
  };

  const openRescheduleModal = (aptId) => {
    const apt = Store.getAppointmentById(aptId);
    if (!apt) return;

    rescheduleTargetId = aptId;
    rescheduleSelectedSlot = apt.timeSlot;

    const modal = document.getElementById('modal-apt-reschedule');
    const dateInput = document.getElementById('resched-date-input');
    const slotsContainer = document.getElementById('resched-slots-container');

    if (dateInput) {
      dateInput.min = new Date().toISOString().split('T')[0];
      dateInput.value = apt.date;
    }

    if (slotsContainer) {
      slotsContainer.innerHTML = DEFAULT_TIME_SLOTS.map((slot) => {
        const isSel = slot === apt.timeSlot;
        return `
          <button type="button" class="slot-pill ${isSel ? 'selected' : ''}" data-slot="${slot}">
            ${slot}
          </button>
        `;
      }).join('');

      slotsContainer.querySelectorAll('.slot-pill').forEach((btn) => {
        btn.addEventListener('click', () => {
          slotsContainer.querySelectorAll('.slot-pill').forEach((b) => b.classList.remove('selected'));
          btn.classList.add('selected');
          rescheduleSelectedSlot = btn.getAttribute('data-slot');
        });
      });
    }

    if (modal) {
      modal.classList.remove('hidden');
      modal.classList.add('flex');
    }
  };

  const handleRescheduleSubmit = (e) => {
    e.preventDefault();
    if (!rescheduleTargetId) return;

    const newDate = document.getElementById('resched-date-input').value;
    if (!newDate || !rescheduleSelectedSlot) {
      alert('Please choose both a new date and time slot.');
      return;
    }

    try {
      Store.rescheduleAppointment(rescheduleTargetId, newDate, rescheduleSelectedSlot);
      App.showToast(`Appointment ${rescheduleTargetId} rescheduled to ${newDate} (${rescheduleSelectedSlot})`, 'success');
      closeModals();
      renderAppointmentsList();
    } catch (err) {
      App.showToast(err.message, 'error');
    }
  };

  const openCancelModal = (aptId) => {
    const reason = prompt('Please enter the reason for cancellation (e.g. Customer requested, Schedule conflict):');
    if (reason === null) return; // user cancelled prompt

    try {
      Store.updateAppointmentStatus(aptId, 'Cancelled', reason || 'Cancelled by user/operator');
      App.showToast(`Appointment ${aptId} cancelled.`, 'info');
      renderAppointmentsList();
    } catch (err) {
      alert(err.message);
    }
  };

  const markCompleted = (aptId) => {
    if (!confirm(`Mark appointment ${aptId} as Completed?`)) return;

    try {
      Store.updateAppointmentStatus(aptId, 'Completed');
      App.showToast(`Appointment ${aptId} marked as Completed.`, 'success');
      renderAppointmentsList();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDelete = (aptId) => {
    if (!confirm(`Permanently remove record for ${aptId}?`)) return;

    try {
      Store.deleteAppointment(aptId);
      App.showToast(`Appointment record ${aptId} removed.`, 'info');
      renderAppointmentsList();
    } catch (err) {
      alert(err.message);
    }
  };

  const closeModals = () => {
    document.querySelectorAll('.appointment-modal').forEach((m) => {
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
    renderAppointmentsList,
    viewDetail,
    openRescheduleModal,
    openCancelModal,
    markCompleted,
    handleDelete,
    closeModals
  };
})();
