/**
 * Master Application Controller & Router
 * Coordinates between Member 1, 2, 3, 4, 5 modules, Customer/User Portal, navigation, toasts, and helpers.
 */

const App = (() => {
  let activePortalMode = 'customer'; // 'customer' or 'admin'
  let activeAdminTab = 'dashboard';

  const init = () => {
    // Initialize Auth first
    Auth.init();

    // Initialize all 5 Member Service Center Modules
    OwnerModule.init();
    VehicleModule.init();
    ServiceModule.init();
    AppointmentModule.init();
    DashboardModule.init();

    // Initialize Customer/User Portal Module
    CustomerModule.init();

    // Initialize Nearest Service Centers & Google Maps Module
    if (typeof MapsModule !== 'undefined') {
      MapsModule.init();
    }

    bindNavEvents();
    setupMobileSidebar();

    // Check LocalStorage saved role & URL Hash routing
    handleInitialRoute();
  };

  const handleInitialRoute = () => {
    const savedRole = Store.getPortalRole ? Store.getPortalRole() : (localStorage.getItem('vms_portal_role') || 'customer');
    const hash = window.location.hash.replace('#', '').toLowerCase();

    if (savedRole === 'admin') {
      setPortalMode('admin');
      if (['owners', 'vehicles', 'services', 'appointments', 'reports', 'dashboard', 'centers'].includes(hash)) {
        navigateTo(hash);
      }
    } else {
      setPortalMode('customer');
      if (['garage', 'book', 'bookings', 'invoices', 'estimator', 'profile', 'centers'].includes(hash)) {
        CustomerModule.showCustomerView(hash);
      }
    }
  };

  const setPortalMode = (mode) => {
    activePortalMode = mode;
    try {
      localStorage.setItem('vms_portal_role', mode);
    } catch (e) {}

    const adminSidebar = document.getElementById('sidebar-nav-admin');
    const customerSidebar = document.getElementById('sidebar-nav-customer');
    const adminViews = document.getElementById('admin-views-wrapper');
    const customerViews = document.getElementById('customer-views-wrapper');
    const headerTitle = document.getElementById('portal-header-title');
    const headerSub = document.getElementById('portal-header-sub');
    const personaWidget = document.getElementById('customer-persona-widget');

    if (headerTitle) headerTitle.textContent = 'Vehicle Management & Services';

    if (mode === 'customer') {
      adminSidebar?.classList.add('hidden');
      customerSidebar?.classList.remove('hidden');

      adminViews?.classList.add('hidden');
      customerViews?.classList.remove('hidden');

      personaWidget?.classList.remove('hidden');

      if (headerSub) headerSub.textContent = 'Manage your garage, live service progress, nearest workshops & roadside help';

      CustomerModule.renderCustomerPortal();
    } else {
      customerSidebar?.classList.add('hidden');
      adminSidebar?.classList.remove('hidden');

      customerViews?.classList.add('hidden');
      adminViews?.classList.remove('hidden');

      personaWidget?.classList.add('hidden');

      if (headerSub) headerSub.textContent = 'Operations command center: fleet inventory, owner registry, job cards, schedule & reports';

      navigateTo(activeAdminTab);
    }
  };

  const bindNavEvents = () => {
    // Admin Nav Links
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
          m.classList.add('hidden');
          m.classList.remove('flex');
        });
      }
    });
  };

  const navigateTo = (tabName) => {
    activeAdminTab = tabName;

    // Update Nav Sidebar links
    document.querySelectorAll('#sidebar-nav-admin .nav-link[data-tab]').forEach((link) => {
      if (link.getAttribute('data-tab') === tabName) {
        link.classList.add('active');
      } else {
        link.classList.remove('active');
      }
    });

    // Update View Containers
    if (tabName === 'centers') {
      document.querySelectorAll('#admin-views-wrapper .tab-view-container').forEach((view) => {
        view.classList.add('hidden');
      });
      document.getElementById('customer-views-wrapper')?.classList.remove('hidden');
      CustomerModule.showCustomerView('centers');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      closeMobileSidebar();
      return;
    } else {
      document.getElementById('customer-views-wrapper')?.classList.add('hidden');
      document.getElementById('admin-views-wrapper')?.classList.remove('hidden');
    }

    document.querySelectorAll('#admin-views-wrapper .tab-view-container').forEach((view) => {
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
    } else if (tabName === 'reports') {
      DashboardModule.renderExpenseReports();
      DashboardModule.renderExpenseCharts();
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
    closeMobileSidebar();
  };

  // Helper shortcuts connecting Member 2 with Member 3 & 4
  const openNewServiceForVehicle = (vehId) => {
    setPortalMode('admin');
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
    setPortalMode('admin');
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
    setPortalMode,
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
