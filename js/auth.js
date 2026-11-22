/**
 * Authentication Module
 * Supports Email/Password login/registration & Simulated Google OAuth
 */

const Auth = (() => {
  // Common Google accounts for instant 1-click test simulation
  const GOOGLE_ACCOUNTS = [
    {
      name: 'Vydhik Reddy',
      email: 'vydhik.reddy@gmail.com',
      avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&auto=format&fit=crop&q=80'
    },
    {
      name: 'Sarah Connor',
      email: 'sarah.connor@gmail.com',
      avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&auto=format&fit=crop&q=80'
    },
    {
      name: 'David Miller',
      email: 'david.m.dev@gmail.com',
      avatar: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=100&auto=format&fit=crop&q=80'
    }
  ];

  const init = () => {
    bindEvents();
    renderUserUI();
  };

  const bindEvents = () => {
    // Auth Form Toggle (Login vs Register)
    const toggleToRegister = document.getElementById('toggle-to-register');
    const toggleToLogin = document.getElementById('toggle-to-login');
    const loginFormContainer = document.getElementById('login-form-box');
    const registerFormContainer = document.getElementById('register-form-box');

    if (toggleToRegister && toggleToLogin) {
      toggleToRegister.addEventListener('click', (e) => {
        e.preventDefault();
        loginFormContainer.classList.add('hidden');
        registerFormContainer.classList.remove('hidden');
      });

      toggleToLogin.addEventListener('click', (e) => {
        e.preventDefault();
        registerFormContainer.classList.add('hidden');
        loginFormContainer.classList.remove('hidden');
      });
    }

    // Email Login Submit
    const emailLoginForm = document.getElementById('form-email-login');
    if (emailLoginForm) {
      emailLoginForm.addEventListener('submit', handleEmailLogin);
    }

    // Email Register Submit
    const emailRegisterForm = document.getElementById('form-email-register');
    if (emailRegisterForm) {
      emailRegisterForm.addEventListener('submit', handleEmailRegister);
    }

    // Google Sign-in Buttons
    const googleLoginBtns = document.querySelectorAll('.btn-google-login');
    googleLoginBtns.forEach((btn) => {
      btn.addEventListener('click', openGoogleOAuthModal);
    });

    // Logout Button
    const logoutBtn = document.getElementById('btn-logout');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', handleLogout);
    }

    // Close Google Modal
    const closeGoogleModalBtn = document.getElementById('close-google-modal');
    if (closeGoogleModalBtn) {
      closeGoogleModalBtn.addEventListener('click', closeGoogleOAuthModal);
    }

    // Custom Google Login Form inside modal
    const customGoogleForm = document.getElementById('form-custom-google');
    if (customGoogleForm) {
      customGoogleForm.addEventListener('submit', handleCustomGoogleSubmit);
    }
  };

  const handleEmailLogin = (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      showAuthError('login-error', 'Please enter a valid email address.');
      return;
    }
    if (!password) {
      showAuthError('login-error', 'Password is required.');
      return;
    }

    try {
      const user = Store.loginUser(email, password);
      App.showToast(`Welcome back, ${user.name}!`, 'success');
      hideAuthOverlay();
      renderUserUI();
    } catch (err) {
      showAuthError('login-error', err.message);
    }
  };

  const handleEmailRegister = (e) => {
    e.preventDefault();
    const name = document.getElementById('reg-name').value.trim();
    const email = document.getElementById('reg-email').value.trim();
    const password = document.getElementById('reg-password').value;
    const confirm = document.getElementById('reg-confirm-password').value;

    if (!name || name.length < 2) {
      showAuthError('register-error', 'Please enter your full name (minimum 2 characters).');
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      showAuthError('register-error', 'Please enter a valid email address.');
      return;
    }
    if (password.length < 6) {
      showAuthError('register-error', 'Password must be at least 6 characters.');
      return;
    }
    if (password !== confirm) {
      showAuthError('register-error', 'Passwords do not match.');
      return;
    }

    try {
      const user = Store.registerUser({ name, email, password });
      App.showToast(`Account created! Welcome, ${user.name}.`, 'success');
      hideAuthOverlay();
      renderUserUI();
    } catch (err) {
      showAuthError('register-error', err.message);
    }
  };

  const openGoogleOAuthModal = (e) => {
    if (e) e.preventDefault();
    const modal = document.getElementById('modal-google-oauth');
    if (!modal) return;

    // Render Google Accounts List
    const listContainer = document.getElementById('google-accounts-list');
    if (listContainer) {
      listContainer.innerHTML = GOOGLE_ACCOUNTS.map(
        (acc, idx) => `
        <div class="google-account-item" data-index="${idx}">
          <img src="${acc.avatar}" alt="${acc.name}" class="google-acc-avatar" onerror="this.src='https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(acc.name)}'">
          <div class="google-acc-info">
            <span class="google-acc-name">${acc.name}</span>
            <span class="google-acc-email">${acc.email}</span>
          </div>
          <span class="google-acc-arrow">→</span>
        </div>
      `
      ).join('');

      listContainer.querySelectorAll('.google-account-item').forEach((item) => {
        item.addEventListener('click', () => {
          const index = parseInt(item.getAttribute('data-index'), 10);
          const chosen = GOOGLE_ACCOUNTS[index];
          selectGoogleAccount(chosen);
        });
      });
    }

    modal.classList.remove('hidden');
    modal.classList.add('flex');
  };

  const closeGoogleOAuthModal = () => {
    const modal = document.getElementById('modal-google-oauth');
    if (modal) {
      modal.classList.add('hidden');
      modal.classList.remove('flex');
    }
  };

  const selectGoogleAccount = (profile) => {
    closeGoogleOAuthModal();
    const user = Store.loginWithGoogle(profile);
    App.showToast(`Signed in with Google as ${user.name}`, 'success');
    hideAuthOverlay();
    renderUserUI();
  };

  const handleCustomGoogleSubmit = (e) => {
    e.preventDefault();
    const name = document.getElementById('custom-google-name').value.trim();
    const email = document.getElementById('custom-google-email').value.trim();

    if (!name || !email) {
      alert('Please provide name and email.');
      return;
    }

    selectGoogleAccount({
      name,
      email,
      avatar: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name)}`
    });
  };

  const handleLogout = () => {
    if (confirm('Are you sure you want to log out of your session?')) {
      Store.logout();
      App.showToast('You have been logged out.', 'info');
      showAuthOverlay();
      renderUserUI();
    }
  };

  const showAuthOverlay = () => {
    const overlay = document.getElementById('auth-overlay-modal');
    if (overlay) {
      overlay.classList.remove('hidden');
      overlay.classList.add('flex');
    }
  };

  const hideAuthOverlay = () => {
    const overlay = document.getElementById('auth-overlay-modal');
    if (overlay) {
      overlay.classList.add('hidden');
      overlay.classList.remove('flex');
    }
  };

  const renderUserUI = () => {
    const user = Store.getAuthUser();
    const userProfileEl = document.getElementById('user-profile-display');
    const userAvatarEl = document.getElementById('user-header-avatar');
    const userNameEl = document.getElementById('user-header-name');
    const userEmailEl = document.getElementById('user-header-email');
    const userBadgeEl = document.getElementById('user-provider-badge');

    if (user) {
      if (userNameEl) userNameEl.textContent = user.name;
      if (userEmailEl) userEmailEl.textContent = user.email;
      if (userAvatarEl) userAvatarEl.src = user.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(user.name)}`;
      if (userBadgeEl) {
        userBadgeEl.textContent = user.provider === 'google' ? 'Google' : 'Email';
        userBadgeEl.className = `badge ${user.provider === 'google' ? 'badge-google' : 'badge-primary'}`;
      }
      hideAuthOverlay();
    } else {
      showAuthOverlay();
    }
  };

  const showAuthError = (targetId, message) => {
    const errorEl = document.getElementById(targetId);
    if (errorEl) {
      errorEl.textContent = message;
      errorEl.classList.remove('hidden');
      setTimeout(() => {
        errorEl.classList.add('hidden');
      }, 5000);
    }
  };

  return {
    init,
    openGoogleOAuthModal,
    showAuthOverlay,
    hideAuthOverlay,
    renderUserUI
  };
})();
