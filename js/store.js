/**
 * Vehicle Service Management System - Central Store & LocalStorage Layer
 * Handles data persistence, CRUD operations, relationships, and reactive events.
 * Fully compatible with team's LocalStorage keys: 'vehicles', 'owners', 'services', 'appointments', 'maintenance'.
 */

const Store = (() => {
  const KEYS = {
    AUTH_USER: 'vms_auth_user',
    PORTAL_ROLE: 'vms_portal_role',
    USERS: 'vms_users',
    OWNERS: 'owners',
    VEHICLES: 'vehicles',
    SERVICES: 'services',
    APPOINTMENTS: 'appointments',
    MAINTENANCE: 'maintenance',
    SEEDED: 'vms_clean_empty_v5'
  };

  // Helper to read LocalStorage
  const get = (key, fallback = []) => {
    try {
      const data = localStorage.getItem(key);
      if (data) {
        const parsed = JSON.parse(data);
        return Array.isArray(parsed) ? parsed : fallback;
      }
      // Check legacy prefixed key fallback
      const legacy = localStorage.getItem(`vms_${key}`);
      return legacy ? JSON.parse(legacy) : fallback;
    } catch (e) {
      console.error(`Error reading ${key} from localStorage:`, e);
      return fallback;
    }
  };

  // Helper to write LocalStorage
  const set = (key, value) => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      localStorage.setItem(`vms_${key}`, JSON.stringify(value));
      emitChange(key, value);
      return true;
    } catch (e) {
      console.error(`Error saving ${key} to localStorage:`, e);
      return false;
    }
  };

  // Event dispatching for cross-module synchronization
  const listeners = [];
  const subscribe = (callback) => {
    listeners.push(callback);
    return () => {
      const idx = listeners.indexOf(callback);
      if (idx > -1) listeners.splice(idx, 1);
    };
  };

  const emitChange = (key, data) => {
    listeners.forEach((fn) => {
      try {
        fn(key, data);
      } catch (err) {
        console.error('Error in store listener:', err);
      }
    });
    window.dispatchEvent(new CustomEvent('vms:data-change', { detail: { key, data } }));
  };

  // ID Generators
  const generateId = (prefix = 'ID') => {
    const random = Math.floor(1000 + Math.random() * 9000);
    const time = Date.now().toString().slice(-4);
    return `${prefix}-${time}${random}`.slice(0, 12);
  };

  // Initial Seed Data: Clean database with zero pre-existing mock records
  const seedDemoData = (force = false) => {
    if (!force && localStorage.getItem(KEYS.SEEDED) === 'vms_clean_empty_v5') {
      return;
    }

    const owners = [];
    const vehicles = [];
    const services = [];
    const appointments = [];
    const users = [
      {
        id: 'USR-01',
        name: 'Service Center Manager',
        email: 'admin@autocare.io',
        password: 'admin123',
        role: 'admin',
        provider: 'local',
        avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80'
      }
    ];

    set(KEYS.OWNERS, owners);
    set(KEYS.VEHICLES, vehicles);
    set(KEYS.SERVICES, services);
    set(KEYS.APPOINTMENTS, appointments);
    set(KEYS.USERS, users);
    localStorage.setItem(KEYS.SEEDED, 'vms_clean_empty_v5');
  };

  // --- MEMBER 1: OWNER OPERATIONS ---
  const getOwners = () => get(KEYS.OWNERS, []);
  
  const getOwnerById = (id) => {
    const list = getOwners();
    return list.find((o) => o.id === id || o.ownerId === id) || null;
  };

  const addOwner = (ownerData) => {
    const list = getOwners();
    const id = ownerData.id?.trim() ? ownerData.id.trim() : generateId('OWN');
    const newOwner = {
      id,
      ownerId: id,
      name: ownerData.name.trim(),
      ownerName: ownerData.name.trim(),
      mobile: ownerData.mobile.trim(),
      email: ownerData.email.trim().toLowerCase(),
      address: ownerData.address.trim(),
      createdDate: new Date().toISOString().split('T')[0]
    };

    if (list.some((o) => (o.id || o.ownerId || '').toLowerCase() === newOwner.id.toLowerCase())) {
      throw new Error(`Owner ID '${newOwner.id}' is already registered.`);
    }
    if (list.some((o) => o.email === newOwner.email)) {
      throw new Error(`Email address '${newOwner.email}' is already associated with another owner.`);
    }

    list.unshift(newOwner);
    set(KEYS.OWNERS, list);
    return newOwner;
  };

  const updateOwner = (id, updatedFields) => {
    const list = getOwners();
    const index = list.findIndex((o) => o.id === id || o.ownerId === id);
    if (index === -1) throw new Error(`Owner with ID ${id} not found.`);

    if (updatedFields.email) {
      const emailLower = updatedFields.email.trim().toLowerCase();
      const duplicate = list.find((o) => (o.id !== id && o.ownerId !== id) && o.email === emailLower);
      if (duplicate) throw new Error(`Email '${emailLower}' is already in use by owner ${duplicate.name || duplicate.ownerName}.`);
    }

    list[index] = {
      ...list[index],
      ...updatedFields,
      id: list[index].id || list[index].ownerId,
      ownerId: list[index].ownerId || list[index].id,
      name: updatedFields.name || list[index].name,
      ownerName: updatedFields.name || list[index].ownerName
    };

    set(KEYS.OWNERS, list);
    return list[index];
  };

  const deleteOwner = (id) => {
    const vehicles = getVehicles();
    const linkedVehicles = vehicles.filter((v) => v.ownerId === id);
    if (linkedVehicles.length > 0) {
      throw new Error(
        `Cannot delete owner ${id}: There are ${linkedVehicles.length} vehicle(s) currently registered under this owner. Please reassign or remove them first.`
      );
    }

    const list = getOwners().filter((o) => o.id !== id && o.ownerId !== id);
    set(KEYS.OWNERS, list);
    return true;
  };

  // --- MEMBER 2: VEHICLE OPERATIONS ---
  const getVehicles = () => get(KEYS.VEHICLES, []);

  const getVehicleById = (id) => {
    const list = getVehicles();
    return list.find((v) => v.id === id || v.vehicleId === id) || null;
  };

  const getVehiclesByOwner = (ownerId) => {
    return getVehicles().filter((v) => v.ownerId === ownerId);
  };

  const addVehicle = (vehicleData) => {
    const list = getVehicles();
    const regUpper = (vehicleData.regNumber || vehicleData.registrationNumber || '').trim().toUpperCase();

    if (list.some((v) => (v.regNumber || v.registrationNumber || '').toUpperCase() === regUpper)) {
      throw new Error(`Vehicle registration '${regUpper}' is already registered in the system.`);
    }

    const id = vehicleData.id?.trim() ? vehicleData.id.trim() : generateId('VEH');
    const owner = getOwnerById(vehicleData.ownerId);

    const newVehicle = {
      id,
      vehicleId: id,
      regNumber: regUpper,
      registrationNumber: regUpper,
      make: vehicleData.manufacturer || vehicleData.make || '',
      manufacturer: vehicleData.manufacturer || vehicleData.make || '',
      model: vehicleData.model.trim(),
      fuelType: vehicleData.fuelType,
      purchaseDate: vehicleData.purchaseDate,
      insuranceExpiry: vehicleData.insuranceExpiry || '',
      pucExpiry: vehicleData.pucExpiry || '',
      ownerId: vehicleData.ownerId,
      ownerName: owner ? owner.name : ''
    };

    list.unshift(newVehicle);
    set(KEYS.VEHICLES, list);
    return newVehicle;
  };

  const updateVehicle = (id, updatedFields) => {
    const list = getVehicles();
    const index = list.findIndex((v) => v.id === id || v.vehicleId === id);
    if (index === -1) throw new Error(`Vehicle with ID ${id} not found.`);

    if (updatedFields.regNumber || updatedFields.registrationNumber) {
      const regUpper = (updatedFields.regNumber || updatedFields.registrationNumber).trim().toUpperCase();
      const duplicate = list.find((v) => (v.id !== id && v.vehicleId !== id) && (v.regNumber || v.registrationNumber || '').toUpperCase() === regUpper);
      if (duplicate) throw new Error(`Vehicle registration '${regUpper}' already belongs to vehicle ${duplicate.model}.`);
      updatedFields.regNumber = regUpper;
      updatedFields.registrationNumber = regUpper;
    }

    const owner = updatedFields.ownerId ? getOwnerById(updatedFields.ownerId) : null;

    list[index] = {
      ...list[index],
      ...updatedFields,
      id: list[index].id || list[index].vehicleId,
      vehicleId: list[index].vehicleId || list[index].id,
      make: updatedFields.manufacturer || updatedFields.make || list[index].make,
      manufacturer: updatedFields.manufacturer || updatedFields.make || list[index].manufacturer,
      ownerName: owner ? owner.name : list[index].ownerName
    };

    set(KEYS.VEHICLES, list);
    return list[index];
  };

  const deleteVehicle = (id) => {
    const services = getServices().filter((s) => s.vehicleId === id);
    const appointments = getAppointments().filter((a) => a.vehicleId === id);

    const updatedServices = getServices().filter((s) => s.vehicleId !== id);
    const updatedAppointments = getAppointments().filter((a) => a.vehicleId !== id);

    set(KEYS.SERVICES, updatedServices);
    set(KEYS.APPOINTMENTS, updatedAppointments);

    const list = getVehicles().filter((v) => v.id !== id && v.vehicleId !== id);
    set(KEYS.VEHICLES, list);
    return { deletedId: id, removedServices: services.length, removedAppointments: appointments.length };
  };

  // --- MEMBER 3: SERVICE HISTORY & MAINTENANCE OPERATIONS ---
  const getServices = () => get(KEYS.SERVICES, []);

  const getServiceById = (id) => {
    return getServices().find((s) => s.id === id || s.serviceId === id) || null;
  };

  const getServicesByVehicle = (vehicleId) => {
    return getServices().filter((s) => s.vehicleId === vehicleId);
  };

  const calculateServiceTotal = (parts = [], laborCost = 0, taxPercent = 18) => {
    const partsTotal = parts.reduce((acc, part) => acc + (Number(part.unitPrice || part.unitCost || 0) * Number(part.quantity || 1)), 0);
    const subtotal = partsTotal + Number(laborCost || 0);
    const taxAmount = (subtotal * Number(taxPercent || 0)) / 100;
    return Math.round(subtotal + taxAmount);
  };

  const addService = (serviceData) => {
    const list = getServices();
    const parts = (serviceData.parts || []).map((p) => ({
      name: (p.name || p.partName || '').trim(),
      partName: (p.name || p.partName || '').trim(),
      partNumber: p.partNumber ? p.partNumber.trim() : 'N/A',
      quantity: Number(p.quantity) || 1,
      unitPrice: Number(p.unitPrice || p.unitCost) || 0,
      unitCost: Number(p.unitPrice || p.unitCost) || 0,
      total: (Number(p.quantity) || 1) * (Number(p.unitPrice || p.unitCost) || 0)
    }));

    const laborCost = Number(serviceData.laborCost || serviceData.labourCost) || 0;
    const taxPercent = Number(serviceData.taxPercent ?? 18);
    const totalExpenses = calculateServiceTotal(parts, laborCost, taxPercent);

    const id = serviceData.id?.trim() ? serviceData.id.trim() : generateId('SRV');
    const owner = getOwnerById(serviceData.ownerId);

    const newRecord = {
      id,
      serviceId: id,
      vehicleId: serviceData.vehicleId,
      ownerId: serviceData.ownerId,
      ownerName: owner ? owner.name : '',
      serviceDate: serviceData.serviceDate,
      serviceCenter: serviceData.serviceCenter.trim(),
      serviceCenterContact: serviceData.serviceCenterContact ? serviceData.serviceCenterContact.trim() : '',
      serviceDescription: serviceData.serviceDescription || serviceData.description || '',
      description: serviceData.serviceDescription || serviceData.description || '',
      serviceType: serviceData.serviceType || 'General Maintenance',
      parts,
      laborCost,
      labourCost: laborCost,
      taxPercent,
      totalExpenses,
      totalCost: totalExpenses
    };

    list.unshift(newRecord);
    set(KEYS.SERVICES, list);
    return newRecord;
  };

  const updateService = (id, updatedFields) => {
    const list = getServices();
    const index = list.findIndex((s) => s.id === id || s.serviceId === id);
    if (index === -1) throw new Error(`Service record ${id} not found.`);

    let parts = updatedFields.parts ? updatedFields.parts.map((p) => ({
      name: (p.name || p.partName || '').trim(),
      partName: (p.name || p.partName || '').trim(),
      partNumber: p.partNumber ? p.partNumber.trim() : 'N/A',
      quantity: Number(p.quantity) || 1,
      unitPrice: Number(p.unitPrice || p.unitCost) || 0,
      unitCost: Number(p.unitPrice || p.unitCost) || 0,
      total: (Number(p.quantity) || 1) * (Number(p.unitPrice || p.unitCost) || 0)
    })) : list[index].parts;

    const laborCost = updatedFields.laborCost !== undefined ? Number(updatedFields.laborCost) : (list[index].laborCost || list[index].labourCost || 0);
    const taxPercent = updatedFields.taxPercent !== undefined ? Number(updatedFields.taxPercent) : (list[index].taxPercent || 18);
    const totalExpenses = calculateServiceTotal(parts, laborCost, taxPercent);

    list[index] = {
      ...list[index],
      ...updatedFields,
      parts,
      laborCost,
      labourCost: laborCost,
      taxPercent,
      totalExpenses,
      totalCost: totalExpenses,
      id: list[index].id || list[index].serviceId,
      serviceId: list[index].serviceId || list[index].id
    };

    set(KEYS.SERVICES, list);
    return list[index];
  };

  const deleteService = (id) => {
    const list = getServices().filter((s) => s.id !== id && s.serviceId !== id);
    set(KEYS.SERVICES, list);
    return true;
  };

  // --- MEMBER 4: APPOINTMENT BOOKING OPERATIONS ---
  const getAppointments = () => get(KEYS.APPOINTMENTS, []);

  const getAppointmentById = (id) => {
    return getAppointments().find((a) => a.id === id || a.appointmentId === id) || null;
  };

  const addAppointment = (aptData) => {
    const list = getAppointments();
    const id = generateId('APT');
    const owner = getOwnerById(aptData.ownerId);

    const newApt = {
      id,
      appointmentId: id,
      vehicleId: aptData.vehicleId,
      ownerId: aptData.ownerId,
      ownerName: owner ? owner.name : '',
      serviceType: aptData.serviceType,
      date: aptData.date || aptData.appointmentDate,
      appointmentDate: aptData.date || aptData.appointmentDate,
      timeSlot: aptData.timeSlot,
      notes: aptData.notes ? aptData.notes.trim() : (aptData.description ? aptData.description.trim() : ''),
      description: aptData.notes ? aptData.notes.trim() : (aptData.description ? aptData.description.trim() : ''),
      status: 'Confirmed',
      createdAt: new Date().toISOString().split('T')[0]
    };

    list.unshift(newApt);
    set(KEYS.APPOINTMENTS, list);
    return newApt;
  };

  const updateAppointmentStatus = (id, newStatus, reason = '') => {
    const list = getAppointments();
    const index = list.findIndex((a) => a.id === id || a.appointmentId === id);
    if (index === -1) throw new Error(`Appointment ${id} not found.`);

    list[index].status = newStatus;
    if (reason) list[index].cancellationReason = reason;

    set(KEYS.APPOINTMENTS, list);
    return list[index];
  };

  const rescheduleAppointment = (id, newDate, newTimeSlot) => {
    const list = getAppointments();
    const index = list.findIndex((a) => a.id === id || a.appointmentId === id);
    if (index === -1) throw new Error(`Appointment ${id} not found.`);

    list[index].date = newDate;
    list[index].appointmentDate = newDate;
    list[index].timeSlot = newTimeSlot;
    list[index].status = 'Rescheduled';
    list[index].rescheduledAt = new Date().toISOString();

    set(KEYS.APPOINTMENTS, list);
    return list[index];
  };

  const deleteAppointment = (id) => {
    const list = getAppointments().filter((a) => a.id !== id && a.appointmentId !== id);
    set(KEYS.APPOINTMENTS, list);
    return true;
  };

  // --- AUTH MANAGEMENT ---
  const getAuthUser = () => {
    try {
      const data = localStorage.getItem(KEYS.AUTH_USER);
      return data ? JSON.parse(data) : null;
    } catch (e) {
      return null;
    }
  };

  const setAuthUser = (user) => {
    if (user) {
      localStorage.setItem(KEYS.AUTH_USER, JSON.stringify(user));
    } else {
      localStorage.removeItem(KEYS.AUTH_USER);
    }
    emitChange(KEYS.AUTH_USER, user);
  };

  const getPortalRole = () => {
    try {
      const saved = localStorage.getItem(KEYS.PORTAL_ROLE);
      if (saved === 'admin' || saved === 'customer') return saved;
      const user = getAuthUser();
      if (user && user.role) return user.role;
      return 'customer';
    } catch (e) {
      return 'customer';
    }
  };

  const setPortalRole = (role) => {
    const validRole = role === 'admin' ? 'admin' : 'customer';
    try {
      localStorage.setItem(KEYS.PORTAL_ROLE, validRole);
    } catch (e) {}
    const user = getAuthUser();
    if (user) {
      user.role = validRole;
      setAuthUser(user);
    }
    emitChange('portal_role', validRole);
    return validRole;
  };

  const getUsers = () => get(KEYS.USERS, []);

  const registerUser = (userData) => {
    const users = getUsers();
    const emailLower = userData.email.trim().toLowerCase();
    if (users.some((u) => u.email.toLowerCase() === emailLower)) {
      throw new Error(`An account with email ${emailLower} already exists.`);
    }

    const newUser = {
      id: generateId('USR'),
      name: userData.name.trim(),
      email: emailLower,
      password: userData.password,
      role: 'customer', // Any new user registration gets customer portal
      provider: 'email',
      avatar: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(userData.name)}`
    };

    users.push(newUser);
    set(KEYS.USERS, users);
    localStorage.setItem(KEYS.PORTAL_ROLE, 'customer');
    setAuthUser(newUser);

    // Auto-create customer profile in owners if not present
    const owners = getOwners();
    if (!owners.some((o) => o.email.toLowerCase() === emailLower)) {
      try {
        addOwner({
          name: newUser.name,
          email: newUser.email,
          mobile: '9876500000',
          address: 'Registered Online Customer'
        });
      } catch (e) {}
    }

    return newUser;
  };

  const loginUser = (email, password) => {
    const emailLower = (email || '').trim().toLowerCase();
    const passTrim = (password || '');
    const isDemoAdmin = (emailLower === 'admin@autocare.io' && passTrim === 'admin123');

    const users = getUsers();
    let found = users.find((u) => u.email.toLowerCase() === emailLower && u.password === passTrim);

    if (!found) {
      if (isDemoAdmin) {
        found = {
          id: 'USR-01',
          name: 'Senior Admin Officer',
          email: 'admin@autocare.io',
          password: 'admin123',
          role: 'admin',
          provider: 'local',
          avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80'
        };
        users.push(found);
        set(KEYS.USERS, users);
      } else {
        const existingEmail = users.find((u) => u.email.toLowerCase() === emailLower);
        if (existingEmail) {
          throw new Error('Invalid email address or password.');
        } else {
          // Allow instant seamless access for any new customer
          const generatedName = emailLower.split('@')[0].replace(/[._-]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
          found = {
            id: generateId('USR'),
            name: generatedName,
            email: emailLower,
            password: passTrim,
            role: 'customer',
            provider: 'local',
            avatar: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(generatedName)}`
          };
          users.push(found);
          set(KEYS.USERS, users);

          // Auto-register owner
          try {
            addOwner({
              name: generatedName,
              email: emailLower,
              mobile: '9876543210',
              address: 'Online Verified Customer'
            });
          } catch (e) {}
        }
      }
    }

    // Role assignment based strictly on user specification:
    // "the service center portal should be opened when the email and pass matches the demo and otherwise if anyone else logins open customer portal and save it in local storage and have to display it as well"
    if (isDemoAdmin) {
      found.role = 'admin';
      localStorage.setItem(KEYS.PORTAL_ROLE, 'admin');
    } else {
      found.role = 'customer';
      localStorage.setItem(KEYS.PORTAL_ROLE, 'customer');
    }

    setAuthUser(found);
    return found;
  };

  const loginWithGoogle = (googleProfile) => {
    const users = getUsers();
    const emailLower = googleProfile.email.toLowerCase();
    let user = users.find((u) => u.email.toLowerCase() === emailLower);

    if (!user) {
      user = {
        id: generateId('USR'),
        name: googleProfile.name,
        email: emailLower,
        role: 'customer', // Google login opens Customer portal
        provider: 'google',
        avatar: googleProfile.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(googleProfile.name)}`
      };
      users.push(user);
      set(KEYS.USERS, users);

      // Auto-register customer profile
      try {
        addOwner({
          name: user.name,
          email: user.email,
          mobile: '9845000000',
          address: 'Google Authenticated Customer'
        });
      } catch (e) {}
    } else {
      user.role = 'customer';
    }

    localStorage.setItem(KEYS.PORTAL_ROLE, 'customer');
    setAuthUser(user);
    return user;
  };

  const logout = () => {
    setAuthUser(null);
  };

  const resetAllData = () => {
    localStorage.removeItem(KEYS.SEEDED);
    localStorage.removeItem(KEYS.OWNERS);
    localStorage.removeItem(KEYS.VEHICLES);
    localStorage.removeItem(KEYS.SERVICES);
    localStorage.removeItem(KEYS.APPOINTMENTS);
    localStorage.removeItem('vms_owners');
    localStorage.removeItem('vms_vehicles');
    localStorage.removeItem('vms_services');
    localStorage.removeItem('vms_appointments');
    seedDemoData(true);
    emitChange('reset', true);
  };

  return {
    KEYS,
    seedDemoData,
    subscribe,
    generateId,
    // Owners (Member 1)
    getOwners,
    getOwnerById,
    addOwner,
    updateOwner,
    deleteOwner,
    // Vehicles (Member 2)
    getVehicles,
    getVehicleById,
    getVehiclesByOwner,
    addVehicle,
    updateVehicle,
    deleteVehicle,
    // Services (Member 3)
    getServices,
    getServiceById,
    getServicesByVehicle,
    calculateServiceTotal,
    addService,
    updateService,
    deleteService,
    // Appointments (Member 4)
    getAppointments,
    getAppointmentById,
    addAppointment,
    updateAppointmentStatus,
    rescheduleAppointment,
    deleteAppointment,
    // Auth & Portal Role
    getAuthUser,
    setAuthUser,
    getPortalRole,
    setPortalRole,
    registerUser,
    loginUser,
    loginWithGoogle,
    logout,
    resetAllData
  };
})();

// Auto-seed on load
Store.seedDemoData();
