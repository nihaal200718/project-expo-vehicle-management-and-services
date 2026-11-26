/**
 * Nearest Service Centers & Google Maps Module
 * Integrates Google Maps API (Key: AIzaSyBOjTXsp4UggV7XVOEkp38AdHzECzJz4qc)
 * Features live proximity calculation (Haversine formula), geolocation,
 * interactive map markers, search & filters, and direct appointment booking.
 */

const MapsModule = (() => {
  const GOOGLE_MAPS_API_KEY = 'AIzaSyBOjTXsp4UggV7XVOEkp38AdHzECzJz4qc';

  // Default coordinate reference (Hyderabad / central default)
  let userLocation = {
    lat: 17.4483,
    lng: 78.3752,
    city: 'Hyderabad',
    isLive: false
  };

  let googleMap = null;
  let mapMarkers = [];
  let userMarker = null;
  let activeInfoWindow = null;
  let isGoogleMapsLoaded = false;
  let googleMapsAuthFailed = false;

  // Verified Authorized AutoCare Service Centers
  const SERVICE_CENTERS = [
    {
      id: 'SC-HYD-01',
      name: 'AutoCare Tech City Supercenter',
      city: 'Hyderabad',
      locality: 'HITEC City / Madhapur',
      address: 'Plot 12, Phase 2, Mindspace Madhapur, HITEC City, Hyderabad, Telangana 500081',
      lat: 17.4483,
      lng: 78.3752,
      phone: '+91 40 4567 8901',
      email: 'hitec.service@autocare.io',
      rating: 4.9,
      reviewsCount: 384,
      hours: '08:00 AM - 08:00 PM (Mon - Sun)',
      fuelTypes: ['Petrol', 'Diesel', 'Electric', 'Hybrid'],
      specialties: ['EV High-Voltage Battery Lab', 'Express 90-Min Service', 'Laser Wheel Alignment', 'Ceramic Paint Booth'],
      manager: 'Rajesh K. Varma',
      availableBays: 12,
      isExpressBay: true
    },
    {
      id: 'SC-HYD-02',
      name: 'AutoCare Deccan Prime Workshop',
      city: 'Hyderabad',
      locality: 'Banjara Hills',
      address: 'Road No. 12, Opposite MLA Colony, Banjara Hills, Hyderabad, Telangana 500034',
      lat: 17.4123,
      lng: 78.4354,
      phone: '+91 40 4912 3456',
      email: 'banjara.service@autocare.io',
      rating: 4.8,
      reviewsCount: 295,
      hours: '08:30 AM - 07:30 PM (Mon - Sat)',
      fuelTypes: ['Petrol', 'Diesel', 'Hybrid'],
      specialties: ['Luxury Car Diagnostics', 'Engine Decarbonizing', 'Multi-Point Inspection', 'AC Overhaul'],
      manager: 'Praveen Reddy',
      availableBays: 8,
      isExpressBay: false
    },
    {
      id: 'SC-DEL-01',
      name: 'AutoCare Mega Hub & EV Express',
      city: 'Delhi NCR',
      locality: 'Okhla Industrial Area Phase 3',
      address: 'Plot 45, Okhla Industrial Area Phase 3, Near Modi Mill, New Delhi, Delhi 110020',
      lat: 28.5284,
      lng: 77.2764,
      phone: '+91 11 4050 8800',
      email: 'delhi.okhla@autocare.io',
      rating: 4.9,
      reviewsCount: 512,
      hours: '08:00 AM - 08:30 PM (Mon - Sun)',
      fuelTypes: ['Petrol', 'Diesel', 'Electric', 'Hybrid'],
      specialties: ['High-Power DC Fast Chargers', 'Automated Underbody Scanner', 'Heavy Mechanical Overhaul', 'Insurance Claim Cashless'],
      manager: 'Amitabh Sengupta',
      availableBays: 16,
      isExpressBay: true
    },
    {
      id: 'SC-GGN-01',
      name: 'AutoCare Cyber City Express Hub',
      city: 'Gurugram',
      locality: 'DLF Phase 2',
      address: 'Near Sikanderpur Metro Station, Sector 25, DLF Phase 2, Gurugram, Haryana 122002',
      lat: 28.4905,
      lng: 77.0898,
      phone: '+91 124 489 1200',
      email: 'gurugram.cyber@autocare.io',
      rating: 4.8,
      reviewsCount: 340,
      hours: '08:00 AM - 08:00 PM (Mon - Sun)',
      fuelTypes: ['Petrol', 'Diesel', 'Electric', 'Hybrid'],
      specialties: ['Corporate Fleet Desk', 'Express Periodic Maintenance', 'Tire Dynamic Balancing', 'Brake Disc Resurfacing'],
      manager: 'Vikram Malhotra',
      availableBays: 10,
      isExpressBay: true
    },
    {
      id: 'SC-BLR-01',
      name: 'AutoCare GreenTech & EV Hub',
      city: 'Bengaluru',
      locality: 'Koramangala 4th Block',
      address: '80 Feet Road, 4th Block, Koramangala, Bengaluru, Karnataka 560034',
      lat: 12.9352,
      lng: 77.6245,
      phone: '+91 80 4120 7700',
      email: 'bangalore.kora@autocare.io',
      rating: 4.9,
      reviewsCount: 467,
      hours: '08:00 AM - 08:00 PM (All 7 Days)',
      fuelTypes: ['Petrol', 'Diesel', 'Electric', 'Hybrid'],
      specialties: ['Certified EV Master Technicians', 'BOSCH Diagnostic Scan', 'Green Waterless Detailing', 'Suspension Tuning'],
      manager: 'Srinivas Murthy',
      availableBays: 14,
      isExpressBay: true
    },
    {
      id: 'SC-BLR-02',
      name: 'AutoCare Whitefield Tech Facility',
      city: 'Bengaluru',
      locality: 'ITPL Main Road, Whitefield',
      address: 'Plot 18, EPIP Zone, Near ITPL Gate, Whitefield, Bengaluru, Karnataka 560066',
      lat: 12.9845,
      lng: 77.7312,
      phone: '+91 80 4319 8899',
      email: 'whitefield.service@autocare.io',
      rating: 4.7,
      reviewsCount: 310,
      hours: '08:30 AM - 07:30 PM (Mon - Sat)',
      fuelTypes: ['Petrol', 'Diesel', 'Electric'],
      specialties: ['Tata & Mahindra EV Certified', 'Electronic Module Recalibration', 'Cashless Accidental Repair'],
      manager: 'Anand Rao',
      availableBays: 9,
      isExpressBay: false
    },
    {
      id: 'SC-MUM-01',
      name: 'AutoCare Coastal Works & Detailing',
      city: 'Mumbai',
      locality: 'Bandra West',
      address: 'Linking Road, Near Khar Telephone Exchange, Bandra West, Mumbai, Maharashtra 400050',
      lat: 19.0596,
      lng: 72.8295,
      phone: '+91 22 2640 5500',
      email: 'mumbai.bandra@autocare.io',
      rating: 4.8,
      reviewsCount: 418,
      hours: '08:00 AM - 08:00 PM (Mon - Sun)',
      fuelTypes: ['Petrol', 'Diesel', 'Electric', 'Hybrid'],
      specialties: ['Rust & Monsoon Anti-Corrosion Undercoating', 'Ceramic 9H Shielding', 'Transmission Flush', 'Wheel Align'],
      manager: 'Farhan Merchant',
      availableBays: 11,
      isExpressBay: true
    },
    {
      id: 'SC-NOI-01',
      name: 'AutoCare Sector 62 Facility',
      city: 'Noida',
      locality: 'Sector 62',
      address: 'C-56/2, Electronic City, Sector 62, Noida, Uttar Pradesh 201309',
      lat: 28.6280,
      lng: 77.3649,
      phone: '+91 120 455 6789',
      email: 'noida.sec62@autocare.io',
      rating: 4.7,
      reviewsCount: 278,
      hours: '08:30 AM - 07:30 PM (Mon - Sat)',
      fuelTypes: ['Petrol', 'Diesel', 'Hybrid'],
      specialties: ['Exhaust & Emission Tuning', 'Clutch Assembly Replacement', 'PUC Certified Check', 'Air Filter Ultrasonic Clean'],
      manager: 'Dinesh Tyagi',
      availableBays: 8,
      isExpressBay: false
    },
    {
      id: 'SC-PUN-01',
      name: 'AutoCare Deccan Tech Hub',
      city: 'Pune',
      locality: 'Hinjewadi Phase 1',
      address: 'Phase 1, Rajiv Gandhi Infotech Park, Hinjewadi, Pune, Maharashtra 411057',
      lat: 18.5913,
      lng: 73.7389,
      phone: '+91 20 6791 2200',
      email: 'pune.hinjewadi@autocare.io',
      rating: 4.8,
      reviewsCount: 325,
      hours: '08:00 AM - 08:00 PM (Mon - Sun)',
      fuelTypes: ['Petrol', 'Diesel', 'Electric', 'Hybrid'],
      specialties: ['Full Computerized ECU Scanning', 'Synthetic Lubes Dispenser', 'EV Battery Health Check', 'Express Service'],
      manager: 'Sachin Kulkarni',
      availableBays: 10,
      isExpressBay: true
    },
    {
      id: 'SC-CHE-01',
      name: 'AutoCare Marina Hub',
      city: 'Chennai',
      locality: 'Guindy Industrial Estate',
      address: 'SIDCO Industrial Estate, Guindy, Chennai, Tamil Nadu 600032',
      lat: 13.0067,
      lng: 80.2038,
      phone: '+91 44 4299 1100',
      email: 'chennai.guindy@autocare.io',
      rating: 4.8,
      reviewsCount: 362,
      hours: '08:00 AM - 08:00 PM (Mon - Sun)',
      fuelTypes: ['Petrol', 'Diesel', 'Electric', 'Hybrid'],
      specialties: ['Coastal Weather Protection', 'High Pressure Detailing Spa', 'Automatic Gearbox Service', 'Brake Overhaul'],
      manager: 'K. Balasubramanian',
      availableBays: 12,
      isExpressBay: true
    }
  ];

  const init = () => {
    bindEvents();
    calculateAllDistances();
    renderCentersList();
    renderCityDropdown();
    initGoogleMapsScript();
  };

  const bindEvents = () => {
    // Locate Me Button
    const btnLocate = document.getElementById('btn-map-locate-me');
    if (btnLocate) {
      btnLocate.addEventListener('click', requestUserLocation);
    }

    // City Selector
    const citySelect = document.getElementById('map-filter-city');
    if (citySelect) {
      citySelect.addEventListener('change', (e) => {
        handleCitySelection(e.target.value);
      });
    }

    // Distance Radius Filter
    const radiusFilter = document.getElementById('map-filter-radius');
    if (radiusFilter) {
      radiusFilter.addEventListener('change', () => {
        applyFilters();
      });
    }

    // Fuel Type Filter
    const fuelFilter = document.getElementById('map-filter-fuel');
    if (fuelFilter) {
      fuelFilter.addEventListener('change', () => {
        applyFilters();
      });
    }

    // Search Keyword Input
    const searchInput = document.getElementById('map-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', () => {
        applyFilters();
      });
    }
  };

  /**
   * Dynamically loads the Google Maps JavaScript API with the user provided key
   */
  const initGoogleMapsScript = () => {
    // Define global callback and error handlers for Google Maps
    window.initGoogleMapModule = () => {
      isGoogleMapsLoaded = true;
      googleMapsAuthFailed = false;
      renderGoogleMap();
    };

    window.gm_authFailure = () => {
      googleMapsAuthFailed = true;
      console.warn('Google Maps API authentication failed (Key requires active billing in Google Cloud Project). Gracefully switching to interactive visual map view.');
      renderVisualFallbackMap();
    };

    if (window.google && window.google.maps) {
      isGoogleMapsLoaded = true;
      renderGoogleMap();
      return;
    }

    // Check if script element is already added
    if (document.getElementById('google-maps-sdk-script')) return;

    const script = document.createElement('script');
    script.id = 'google-maps-sdk-script';
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(GOOGLE_MAPS_API_KEY)}&libraries=places&callback=initGoogleMapModule`;
    script.async = true;
    script.defer = true;
    script.onerror = () => {
      googleMapsAuthFailed = true;
      renderVisualFallbackMap();
    };
    document.head.appendChild(script);

    // Timeout safety: if Google Maps script takes longer than 4 seconds (e.g. offline/restricted), render interactive visual map
    setTimeout(() => {
      if (!isGoogleMapsLoaded && !googleMapsAuthFailed) {
        renderVisualFallbackMap();
      }
    }, 4000);
  };

  /**
   * Haversine formula to compute distance in kilometers between two geo coordinates
   */
  const calculateHaversineDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371; // Earth radius in kilometers
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return parseFloat((R * c).toFixed(1));
  };

  const calculateAllDistances = () => {
    SERVICE_CENTERS.forEach((center) => {
      center.distanceKm = calculateHaversineDistance(
        userLocation.lat,
        userLocation.lng,
        center.lat,
        center.lng
      );
    });

    // Sort in ascending order of proximity
    SERVICE_CENTERS.sort((a, b) => a.distanceKm - b.distanceKm);
  };

  /**
   * Request user's live coordinates using HTML5 Geolocation API
   */
  const requestUserLocation = () => {
    const btn = document.getElementById('btn-map-locate-me');
    const statusText = document.getElementById('map-user-loc-text');

    if (btn) btn.classList.add('loading');
    if (statusText) statusText.textContent = 'Acquiring GPS location...';

    if (!navigator.geolocation) {
      if (btn) btn.classList.remove('loading');
      if (statusText) statusText.textContent = 'Geolocation not supported by this browser.';
      App.showToast('Geolocation is not supported by your browser.', 'warning');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        userLocation = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          city: 'My Current Location',
          isLive: true
        };

        if (btn) btn.classList.remove('loading');
        if (statusText) {
          statusText.innerHTML = `<i class="fas fa-crosshairs text-success"></i> Live GPS: ${userLocation.lat.toFixed(4)}, ${userLocation.lng.toFixed(4)}`;
        }

        calculateAllDistances();
        applyFilters();

        if (isGoogleMapsLoaded && googleMap) {
          googleMap.setCenter({ lat: userLocation.lat, lng: userLocation.lng });
          googleMap.setZoom(13);
          updateUserLocationMarker();
        } else {
          renderVisualFallbackMap();
        }

        App.showToast('Location updated! Service centers sorted by distance to you.', 'success');
      },
      (error) => {
        if (btn) btn.classList.remove('loading');
        if (statusText) {
          statusText.innerHTML = `<i class="fas fa-map-pin text-brand"></i> Default: ${userLocation.city}`;
        }
        console.warn('Geolocation permission denied or error:', error.message);
        App.showToast('Location access denied. Displaying nearest centers from selected city.', 'info');
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }
    );
  };

  const handleCitySelection = (city) => {
    const cityCoords = {
      'Hyderabad': { lat: 17.4483, lng: 78.3752 },
      'Delhi NCR': { lat: 28.5284, lng: 77.2764 },
      'Bengaluru': { lat: 12.9352, lng: 77.6245 },
      'Gurugram': { lat: 28.4905, lng: 77.0898 },
      'Noida': { lat: 28.6280, lng: 77.3649 },
      'Mumbai': { lat: 19.0596, lng: 72.8295 },
      'Pune': { lat: 18.5913, lng: 73.7389 },
      'Chennai': { lat: 13.0067, lng: 80.2038 }
    };

    if (cityCoords[city]) {
      userLocation = {
        lat: cityCoords[city].lat,
        lng: cityCoords[city].lng,
        city: city,
        isLive: false
      };

      const statusText = document.getElementById('map-user-loc-text');
      if (statusText) {
        statusText.innerHTML = `<i class="fas fa-map-marker-alt text-brand"></i> Centered on ${city}`;
      }

      calculateAllDistances();
      applyFilters();

      if (isGoogleMapsLoaded && googleMap) {
        googleMap.setCenter(cityCoords[city]);
        googleMap.setZoom(12);
        updateUserLocationMarker();
      } else {
        renderVisualFallbackMap();
      }
    } else {
      applyFilters();
    }
  };

  /**
   * Initializes and renders Google Map on #service-centers-map
   */
  const renderGoogleMap = () => {
    const mapContainer = document.getElementById('service-centers-map');
    if (!mapContainer || !window.google || !window.google.maps) return;

    try {
      googleMap = new google.maps.Map(mapContainer, {
        center: { lat: userLocation.lat, lng: userLocation.lng },
        zoom: 12,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: true,
        styles: [
          { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] },
          { featureType: 'transit', elementType: 'labels', stylers: [{ visibility: 'off' }] }
        ]
      });

      activeInfoWindow = new google.maps.InfoWindow();
      updateUserLocationMarker();
      renderMapMarkers(getFilteredCenters());
    } catch (err) {
      console.error('Error initializing Google Map:', err);
      renderVisualFallbackMap();
    }
  };

  const updateUserLocationMarker = () => {
    if (!googleMap || !window.google) return;

    if (userMarker) {
      userMarker.setMap(null);
    }

    userMarker = new google.maps.Marker({
      position: { lat: userLocation.lat, lng: userLocation.lng },
      map: googleMap,
      title: 'Your Location',
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 8,
        fillColor: '#2563eb',
        fillOpacity: 1,
        strokeColor: '#ffffff',
        strokeWeight: 2
      }
    });
  };

  const renderMapMarkers = (centers) => {
    if (!googleMap || !window.google) return;

    // Clear existing markers
    mapMarkers.forEach((m) => m.setMap(null));
    mapMarkers = [];

    const bounds = new google.maps.LatLngBounds();
    bounds.extend(new google.maps.LatLng(userLocation.lat, userLocation.lng));

    centers.forEach((center) => {
      const position = { lat: center.lat, lng: center.lng };
      bounds.extend(position);

      const marker = new google.maps.Marker({
        position,
        map: googleMap,
        title: center.name,
        animation: google.maps.Animation.DROP,
        icon: {
          url: 'https://maps.google.com/mapfiles/ms/icons/red-dot.png'
        }
      });

      marker.addListener('click', () => {
        showMarkerInfoWindow(marker, center);
      });

      mapMarkers.push(marker);
    });

    if (centers.length > 0) {
      googleMap.fitBounds(bounds);
      if (googleMap.getZoom() > 14) googleMap.setZoom(14);
    }
  };

  const showMarkerInfoWindow = (marker, center) => {
    if (!activeInfoWindow) return;

    const contentString = `
      <div style="padding: 6px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 260px;">
        <h4 style="margin: 0 0 4px; font-size: 0.95rem; font-weight: 700; color: #0f172a;">${escapeHtml(center.name)}</h4>
        <div style="display: flex; align-items: center; gap: 6px; font-size: 0.8rem; margin-bottom: 6px;">
          <span style="color: #f59e0b; font-weight: 700;"><i class="fas fa-star" style="color:#f59e0b; margin-right: 2px;"></i>${center.rating}</span>
          <span style="color: #64748b;">(${center.reviewsCount} reviews)</span>
          <span style="background: #e0f2fe; color: #0284c7; padding: 1px 6px; border-radius: 4px; font-weight: 600;">${center.distanceKm} km away</span>
        </div>
        <p style="font-size: 0.75rem; color: #475569; margin: 0 0 6px; line-height: 1.3;">${escapeHtml(center.address)}</p>
        <p style="font-size: 0.75rem; color: #0f172a; margin: 0 0 8px;"><strong>Phone:</strong> ${center.phone}</p>
        <div style="display: flex; gap: 6px;">
          <button onclick="MapsModule.bookAtCenter('${encodeURIComponent(center.name)}')" style="flex: 1; background: #2563eb; color: #fff; border: none; padding: 5px 8px; border-radius: 4px; font-size: 0.75rem; font-weight: 600; cursor: pointer;">
            Book Here
          </button>
          <a href="https://www.google.com/maps/dir/?api=1&destination=${center.lat},${center.lng}" target="_blank" rel="noopener noreferrer" style="background: #f1f5f9; color: #334155; border: 1px solid #cbd5e1; padding: 5px 8px; border-radius: 4px; font-size: 0.75rem; font-weight: 600; text-decoration: none; text-align: center;">
            Directions
          </a>
        </div>
      </div>
    `;

    activeInfoWindow.setContent(contentString);
    activeInfoWindow.open(googleMap, marker);
  };

  /**
   * Fallback visual interactive map canvas if Google Maps SDK has no billing or encounters network block
   */
  const renderVisualFallbackMap = () => {
    const mapContainer = document.getElementById('service-centers-map');
    if (!mapContainer) return;

    const filtered = getFilteredCenters();
    const nearest = filtered[0] || SERVICE_CENTERS[0];

    mapContainer.innerHTML = `
      <div class="visual-map-canvas">
        <!-- Visual Grid Overlay -->
        <div class="visual-map-grid"></div>

        <!-- User Pin Marker -->
        <div class="visual-map-user-pin" style="top: 48%; left: 46%;">
          <div class="user-pulse"></div>
          <div class="user-dot" title="Your Location (${userLocation.city})">
            <i class="fas fa-location-arrow"></i>
          </div>
          <span class="user-pin-label">You (${userLocation.city})</span>
        </div>

        <!-- Workshop Service Center Pin Markers -->
        ${filtered.slice(0, 6).map((c, idx) => {
          // Calculate layout positions across the interactive visual radar
          const positions = [
            { top: '32%', left: '56%' },
            { top: '64%', left: '38%' },
            { top: '24%', left: '34%' },
            { top: '72%', left: '62%' },
            { top: '42%', left: '76%' },
            { top: '56%', left: '20%' }
          ];
          const pos = positions[idx] || { top: '50%', left: '50%' };
          return `
            <div class="visual-center-pin" style="top: ${pos.top}; left: ${pos.left};" onclick="MapsModule.selectCenter('${c.id}')">
              <div class="pin-badge ${c.isExpressBay ? 'express' : ''}">
                <i class="fas fa-tools"></i>
              </div>
              <div class="pin-tooltip">
                <strong>${escapeHtml(c.name)}</strong>
                <span>${c.distanceKm} km away • <i class="fas fa-star" style="color:#f59e0b;"></i> ${c.rating}</span>
              </div>
            </div>
          `;
        }).join('')}

        <!-- Interactive Map Header Overlay Info -->
        <div class="visual-map-overlay-info">
          <div class="flex items-center gap-2">
            <span class="pulse-indicator"></span>
            <strong>Google Maps Service Locator</strong>
          </div>
          <div class="text-xs text-muted mt-1">
            Showing ${filtered.length} verified workshops. Nearest: <strong>${escapeHtml(nearest.name)}</strong> (${nearest.distanceKm} km)
          </div>
          <div class="flex gap-2 mt-2">
            <a href="https://www.google.com/maps/search/vehicle+service+center/@${userLocation.lat},${userLocation.lng},13z" target="_blank" rel="noopener noreferrer" class="btn btn-xs btn-primary">
              <i class="fas fa-external-link-alt"></i> Open in Google Maps
            </a>
            <button class="btn btn-xs btn-outline" onclick="MapsModule.requestUserLocation()">
              <i class="fas fa-crosshairs"></i> Refresh GPS
            </button>
          </div>
        </div>
      </div>
    `;
  };

  /**
   * Filters the service centers based on city, distance, fuel type, and search query
   */
  const getFilteredCenters = () => {
    const cityVal = document.getElementById('map-filter-city')?.value || 'ALL';
    const radiusVal = document.getElementById('map-filter-radius')?.value || 'ALL';
    const fuelVal = document.getElementById('map-filter-fuel')?.value || 'ALL';
    const searchVal = (document.getElementById('map-search-input')?.value || '').trim().toLowerCase();

    return SERVICE_CENTERS.filter((center) => {
      // City Filter
      if (cityVal !== 'ALL' && center.city !== cityVal) return false;

      // Distance Radius Filter
      if (radiusVal !== 'ALL') {
        const maxKm = parseFloat(radiusVal);
        if (center.distanceKm > maxKm) return false;
      }

      // Fuel Compatibility Filter
      if (fuelVal !== 'ALL') {
        if (!center.fuelTypes.includes(fuelVal)) return false;
      }

      // Keyword Search
      if (searchVal) {
        const haystack = `${center.name} ${center.locality} ${center.city} ${center.address} ${center.specialties.join(' ')}`.toLowerCase();
        if (!haystack.includes(searchVal)) return false;
      }

      return true;
    });
  };

  const applyFilters = () => {
    const filtered = getFilteredCenters();
    renderCentersList(filtered);

    if (isGoogleMapsLoaded && googleMap) {
      renderMapMarkers(filtered);
    } else {
      renderVisualFallbackMap();
    }
  };

  const renderCityDropdown = () => {
    const citySelect = document.getElementById('map-filter-city');
    if (!citySelect) return;

    const cities = ['Hyderabad', 'Delhi NCR', 'Bengaluru', 'Gurugram', 'Noida', 'Mumbai', 'Pune', 'Chennai'];
    citySelect.innerHTML = `
      <option value="ALL">All Regions & Cities</option>
      ${cities.map((c) => `<option value="${c}" ${c === userLocation.city ? 'selected' : ''}>${c}</option>`).join('')}
    `;
  };

  /**
   * Renders the cards list of service centers
   */
  const renderCentersList = (centersToRender = null) => {
    const container = document.getElementById('service-centers-list');
    const countBadge = document.getElementById('centers-found-count');
    if (!container) return;

    const centers = centersToRender || SERVICE_CENTERS;
    if (countBadge) countBadge.textContent = `${centers.length} Centers Found`;

    if (centers.length === 0) {
      container.innerHTML = `
        <div class="empty-state-box py-8 text-center">
          <i class="fas fa-map-marked text-muted" style="font-size: 2.5rem; margin-bottom: 0.75rem;"></i>
          <h4>No Service Centers Found</h4>
          <p class="text-xs text-muted mb-3">No authorized centers match your selected distance or vehicle filter.</p>
          <button class="btn btn-xs btn-outline" onclick="MapsModule.resetFilters()">
            <i class="fas fa-redo"></i> Reset Filters
          </button>
        </div>
      `;
      return;
    }

    container.innerHTML = centers.map((center, index) => {
      const isNearest = index === 0;
      return `
        <div class="center-card ${isNearest ? 'nearest-center' : ''}" id="card-center-${center.id}">
          <div class="center-card-header">
            <div>
              <div class="flex items-center gap-2">
                <h4 class="center-title">${escapeHtml(center.name)}</h4>
                ${isNearest ? '<span class="badge badge-success text-xs font-semibold"><i class="fas fa-bolt"></i> Nearest to You</span>' : ''}
                ${center.isExpressBay ? '<span class="badge badge-primary text-xs">Express Bay</span>' : ''}
              </div>
              <div class="center-rating-row">
                <span class="rating-stars"><i class="fas fa-star text-warning"></i> ${center.rating}</span>
                <span class="reviews-count">(${center.reviewsCount} reviews)</span>
                <span class="center-locality">• ${escapeHtml(center.locality)}, ${escapeHtml(center.city)}</span>
              </div>
            </div>
            <div class="center-distance-chip">
              <i class="fas fa-location-arrow"></i>
              <strong>${center.distanceKm} km</strong>
            </div>
          </div>

          <p class="center-address">
            <i class="fas fa-map-marker-alt text-danger mr-1"></i> ${escapeHtml(center.address)}
          </p>

          <div class="center-meta-grid">
            <div class="center-meta-item">
              <i class="far fa-clock text-muted"></i>
              <span>${escapeHtml(center.hours)}</span>
            </div>
            <div class="center-meta-item">
              <i class="fas fa-phone-alt text-muted"></i>
              <a href="tel:${center.phone}" class="text-brand font-mono">${center.phone}</a>
            </div>
            <div class="center-meta-item">
              <i class="fas fa-user-cog text-muted"></i>
              <span>Manager: ${escapeHtml(center.manager)}</span>
            </div>
            <div class="center-meta-item">
              <i class="fas fa-warehouse text-muted"></i>
              <span>${center.availableBays} Active Service Bays</span>
            </div>
          </div>

          <!-- Specialties & Fuel Pills -->
          <div class="center-pills-row">
            ${center.fuelTypes.map((f) => `<span class="tag-pill tag-fuel"><i class="fas fa-gas-pump"></i> ${f}</span>`).join('')}
            ${center.specialties.map((s) => `<span class="tag-pill tag-spec"><i class="fas fa-check"></i> ${escapeHtml(s)}</span>`).join('')}
          </div>

          <!-- Action Buttons -->
          <div class="center-card-actions">
            <button type="button" class="btn btn-primary btn-sm flex-1" onclick="MapsModule.bookAtCenter('${encodeURIComponent(center.name)}')">
              <i class="fas fa-calendar-check"></i> Book Appointment Here
            </button>
            <a href="https://www.google.com/maps/dir/?api=1&destination=${center.lat},${center.lng}" target="_blank" rel="noopener noreferrer" class="btn btn-outline btn-sm" title="Open Google Maps turn-by-turn directions">
              <i class="fas fa-directions text-brand"></i> Get Directions
            </a>
            <button type="button" class="btn btn-outline btn-sm" onclick="MapsModule.selectCenter('${center.id}')" title="Center on Map">
              <i class="fas fa-crosshairs"></i> View Pin
            </button>
          </div>
        </div>
      `;
    }).join('');
  };

  /**
   * Smoothly selects a center on the map and highlights its card
   */
  const selectCenter = (centerId) => {
    const center = SERVICE_CENTERS.find((c) => c.id === centerId);
    if (!center) return;

    if (isGoogleMapsLoaded && googleMap) {
      googleMap.setCenter({ lat: center.lat, lng: center.lng });
      googleMap.setZoom(15);
      const marker = mapMarkers.find((m) => m.getTitle() === center.name);
      if (marker) showMarkerInfoWindow(marker, center);
    }

    // Highlight card in list
    document.querySelectorAll('.center-card').forEach((c) => c.classList.remove('selected-card'));
    const targetCard = document.getElementById(`card-center-${centerId}`);
    if (targetCard) {
      targetCard.classList.add('selected-card');
      targetCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  };

  /**
   * Direct Booking helper: opens the Customer Booking tab and selects this center
   */
  const bookAtCenter = (encodedCenterName) => {
    const centerName = decodeURIComponent(encodedCenterName);

    // Switch view to customer booking tab
    CustomerModule.showCustomerView('book');

    // Populate or pre-select center in booking form if selector exists
    const centerSelect = document.getElementById('cust-book-center-select');
    if (centerSelect) {
      let matched = false;
      for (let i = 0; i < centerSelect.options.length; i++) {
        if (centerSelect.options[i].value.toLowerCase().includes(centerName.toLowerCase()) || centerName.toLowerCase().includes(centerSelect.options[i].value.toLowerCase())) {
          centerSelect.selectedIndex = i;
          matched = true;
          break;
        }
      }
      if (!matched) {
        const newOpt = new Option(centerName, centerName, true, true);
        centerSelect.add(newOpt);
      }
    }

    // Also populate notes with selected center
    const notesEl = document.getElementById('cust-book-notes');
    if (notesEl && !notesEl.value.includes(centerName)) {
      notesEl.value = `Selected Service Center: ${centerName}\n${notesEl.value}`.trim();
    }

    App.showToast(`Selected ${centerName}. Complete your booking below!`, 'success');
  };

  const resetFilters = () => {
    const citySelect = document.getElementById('map-filter-city');
    const radiusFilter = document.getElementById('map-filter-radius');
    const fuelFilter = document.getElementById('map-filter-fuel');
    const searchInput = document.getElementById('map-search-input');

    if (citySelect) citySelect.value = 'ALL';
    if (radiusFilter) radiusFilter.value = 'ALL';
    if (fuelFilter) fuelFilter.value = 'ALL';
    if (searchInput) searchInput.value = '';

    applyFilters();
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
    requestUserLocation,
    selectCenter,
    bookAtCenter,
    resetFilters,
    getCenters: () => SERVICE_CENTERS,
    getUserLocation: () => userLocation,
    onGoogleMapsReady: () => {
      isGoogleMapsLoaded = true;
      renderGoogleMap();
    },
    handleGoogleMapsAuthFailure: () => {
      googleMapsAuthFailed = true;
      renderVisualFallbackMap();
    }
  };
})();
