/**
 * Master Application Controller & Router
 * Coordinates between Member 1, 2, 3, 4, 5 modules, navigation, toasts, and helpers.
 */

const App = (() => {
  let activeTab = 'dashboard';

  const init = () => {
    // Initialize Auth first
    Auth.init();

    // Initialize all 5 Member Modules
    OwnerModule.init();
    VehicleModule.init();
    ServiceModule.init();
    AppointmentModule.init();
    DashboardModule.init();

    bindNavEvents();
    setupMobileSidebar();

    // Set default initial view
    navigateTo('dashboard');
  };

  const bindNavEvents = () => {
    const navLinks = document.querySelectorAll('.nav-link[data-tab]');
    navLinks.forEach((link) => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const tab = link.getAttribute('data-tab');
        navigateTo(tab);
      });
    });

    // Close modals on clicking overlay backdrop
    document.querySelectorAll('.modal-overlay').forEach((overlay) => {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
          overlay.classList.add('hidden');
          overlay.classList.remove('flex');
        }
      });
    });

    // Keyboard ESC key closes open modals
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        document.querySelectorAll('.modal-overlay:not(.hidden)').forEach((m) => {
          // Do not close auth modal if user is not authenticated
          if (m.id === 'auth-overlay-modal' && !Store.getAuthUser()) return;
          m.classList.add('hidden');
          m.classList.remove('flex');
        });
      }
    });
  };

  const navigateTo = (tabName) => {
    activeTab = tabName;

    // Update Nav Sidebar links
    document.querySelectorAll('.nav-link[data-tab]').forEach((link) => {
      if (link.getAttribute('data-tab') === tabName) {
        link.classList.add('active');
      } else {
        link.classList.remove('active');
      }
    });

    // Update View Containers
    document.querySelectorAll('.tab-view-container').forEach((view) => {
      if (view.id === `view-${tabName}`) {
        view.classList.remove('hidden');
      } else {
        view.classList.add('hidden');
      }
    });

    // Module-specific hooks when switching view
    if (tabName === 'dashboard') {
      DashboardModule.renderAllDashboardComponents();
    } else if (tabName === 'owners') {
      OwnerModule.renderOwnersList();
      OwnerModule.populateOwnerFilter();
    } else if (tabName === 'vehicles') {
      VehicleModule.renderVehicleList();
      VehicleModule.populateVehicleDropdowns();
    } else if (tabName === 'services') {
      ServiceModule.renderServiceRecords();
      VehicleModule.populateVehicleDropdowns();
    } else if (tabName === 'appointments') {
      AppointmentModule.renderAppointmentsList();
      VehicleModule.populateVehicleDropdowns();
    }

    // Scroll to top of content
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // Close mobile drawer if open
    closeMobileSidebar();
  };

  // Helper shortcuts connecting Member 2 with Member 3 & 4
  const openNewServiceForVehicle = (vehId) => {
    navigateTo('services');
    setTimeout(() => {
      const srvVehSelect = document.getElementById('srv-vehicle-input');
      if (srvVehSelect) {
        srvVehSelect.value = vehId;
        srvVehSelect.dispatchEvent(new Event('change'));
      }
      document.getElementById('form-service-add')?.scrollIntoView({ behavior: 'smooth' });
    }, 150);
  };

  const openBookingForVehicle = (vehId) => {
    navigateTo('appointments');
    setTimeout(() => {
      const aptVehSelect = document.getElementById('apt-vehicle-input');
      if (aptVehSelect) {
        aptVehSelect.value = vehId;
        aptVehSelect.dispatchEvent(new Event('change'));
      }
      document.getElementById('form-appointment-book')?.scrollIntoView({ behavior: 'smooth' });
    }, 150);
  };

  // Toast notification service
  const showToast = (message, type = 'info') => {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast-pill toast-${type} animate-slide-in`;

    const icon =
      type === 'success'
        ? '<i class="fas fa-check-circle"></i>'
        : type === 'error'
        ? '<i class="fas fa-exclamation-circle"></i>'
        : '<i class="fas fa-info-circle"></i>';

    toast.innerHTML = `
      <div class="toast-content">
        <span class="toast-icon">${icon}</span>
        <span class="toast-message">${escapeHtml(message)}</span>
      </div>
      <button class="toast-close">&times;</button>
    `;

    container.appendChild(toast);

    toast.querySelector('.toast-close').addEventListener('click', () => {
      toast.remove();
    });

    setTimeout(() => {
      toast.classList.add('fade-out');
      setTimeout(() => toast.remove(), 400);
    }, 4500);
  };

  const setupMobileSidebar = () => {
    const toggleBtn = document.getElementById('btn-mobile-sidebar-toggle');
    const sidebar = document.getElementById('app-sidebar');
    const overlay = document.getElementById('mobile-sidebar-backdrop');

    if (toggleBtn && sidebar && overlay) {
      toggleBtn.addEventListener('click', () => {
        sidebar.classList.toggle('open');
        overlay.classList.toggle('hidden');
      });

      overlay.addEventListener('click', closeMobileSidebar);
    }
  };

  const closeMobileSidebar = () => {
    const sidebar = document.getElementById('app-sidebar');
    const overlay = document.getElementById('mobile-sidebar-backdrop');
    if (sidebar) sidebar.classList.remove('open');
    if (overlay) overlay.classList.add('hidden');
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
    navigateTo,
    openNewServiceForVehicle,
    openBookingForVehicle,
    showToast
  };
})();

// Bootstrap app on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
