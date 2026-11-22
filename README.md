# Vehicle Service and Fleet Management System (AutoCare VMS)

A complete, enterprise-grade, integrated **Vehicle Management and Maintenance Web Application** built for **Project Expo**, engineering showcases, and operational fleet management.

---

## Live Demo & Navigation

- **Main Dashboard & Integrated Portal**: [`index.html`](file:///home/vydhikreddy/vehicle-service-management/index.html)
- **Member 1 (Owners)**: Direct tab in `index.html#owners`
- **Member 2 (Vehicles & Fleet)**: Direct tab in `index.html#vehicles`
- **Member 3 (Service History & Parts)**: Direct tab in `index.html#services` or standalone [`services.html`](file:///home/vydhikreddy/vehicle-service-management/services.html) & [`maintenance.html`](file:///home/vydhikreddy/vehicle-service-management/maintenance.html)
- **Member 4 (Appointments)**: Direct tab in `index.html#appointments` or standalone [`appointments.html`](file:///home/vydhikreddy/vehicle-service-management/appointments.html)
- **Member 5 (Reports & Analytics)**: Direct tab in `index.html#reports`

---

## Architecture & Team Deliverables Breakdown

### Authentication Portal (Email + Google Account)
- **Features**:
  - Secure email & password sign-in and account registration with field validation.
  - Interactive **"Sign in with Google"** OAuth flow with account picker dialog and custom profile login.
  - Active session indicator in the header bar showing avatar, name, email, and authentication provider badge.
  - Logout with confirmation and instant session state clearance.
  - Default Demo Login: `admin@autocare.io` / `admin123` (or 1-click Google Account sign-in).

---

### Member 1: Owner Registration and Profile Management
- **Role**: Frontend + Core JavaScript
- **Deliverables**:
  - **Owner Registration Form**: Captures unique Owner ID, Full Name, 10-digit Mobile Number, Email Address, and Residential Address.
  - **Form Validation**: Real-time regex validation for email formatting, 10-digit telephone check, mandatory address, and duplicate ID prevention.
  - **LocalStorage Persistence**: Full CRUD storage under the shared key `owners`.
  - **Profile View & Management**:
    - Interactive "View Profile" modal displaying personal credentials, linked vehicles count, total service spend, and past appointment history.
    - Inline "Edit Profile" modal with instant reactive updates.
    - Safety checks preventing deletion of owners who currently have active registered vehicles.

---

### Member 2: Vehicle Registration and Dashboard
- **Role**: Frontend + Core JavaScript
- **Deliverables**:
  - **Vehicle Registration Form**: Collects Registration Number (e.g., `MH 02 CL 4589`), Manufacturer / Make, Model, Fuel Type (Petrol, Diesel, Electric, Hybrid, CNG), Purchase Date, Insurance Expiry Date, and PUC Expiry Date.
  - **Owner Association**: Dynamic relational binding linking each vehicle to a registered Owner ID.
  - **Vehicle Dashboard Grid**:
    - Card view featuring registration number plates, fuel type badges with icons, owner contact chip, total services count, and maintenance spend.
    - Multi-criteria filter by Fuel Type, Owner, and search by registration plate or manufacturer.
  - **Vehicle Management**: Update modal and safe deletion with cascading cleanup of associated service history.

---

### Member 3: Service History and Maintenance
- **Role**: Core JavaScript & Financial Calculations
- **Deliverables**:
  - **Service History Logging**:
    - Select vehicle (auto-populates owner details), service date, authorized workshop center, contact number, classification type, and detailed job description.
  - **Dynamic Spare Parts Information**:
    - Interactive line-item table allowing users to dynamically add/remove replacement parts.
    - Fields: Part Name, Part / SKU Number, Quantity, Unit Price (₹), and row subtotal.
  - **Automated Expense Engine**:
    - Real-time calculation: `(Parts Subtotal + Labor Cost) + GST/Taxes (%) = Total Service Expense`.
  - **Detailed Invoice & Editing**:
    - Professional printable service invoice modal with itemized parts breakdown, labor costs, and tax breakdown.
    - Full editing and deletion of existing workshop records.

---

### Member 4: Appointment Booking System
- **Role**: JavaScript + Form Scheduling
- **Deliverables**:
  - **Appointment Booking Interface**:
    - Select vehicle, auto-detect owner, choose required service category (Periodic Service, Oil Change, Brake Inspection, Tire Rotation, Detailing, etc.).
    - Date picker restricting past dates, and interactive visual time slot selector chips.
  - **Instant Booking Confirmation Status**:
    - Pop-up confirmation slip with unique reference code (`APT-XXXX`), summary of vehicle, owner, chosen date, time slot, and "Confirmed" badge.
  - **Appointment Management Dashboard**:
    - Status filtering tabs: *All, Confirmed, Pending, Rescheduled, Completed, Cancelled*.
    - Rescheduling modal allowing users to alter scheduled date and pick a new slot.
    - Cancellation flow prompting for cancellation reasoning.

---

### Member 5: Dashboard, Reports & Integration Lead
- **Role**: Integration Lead & Analytics
- **Deliverables**:
  - **Executive KPI Dashboard**: Real-time summary tiles showing Total Owners, Total Vehicles, Cumulative Maintenance Expenditure, Active Appointments, and Expiring Document Alerts.
  - **Upcoming Service Reminders Widget**: Displays scheduled bookings due over the coming week with direct action shortcuts.
  - **Insurance & PUC Expiry Tracker**: Audits fleet compliance into *Critical (Expired / ≤ 7 days)*, *Warning (≤ 30 days)*, and *Compliant* categories with 1-click renewal navigation.
  - **Interactive Expense Visualizations**:
    - Self-contained SVG / CSS bar chart depicting maintenance expenses per vehicle.
    - Distribution progress bars showcasing service categories.
  - **Reporting & Data Export**:
    - Detailed summary report table grouping expenses per vehicle and owner.
    - 1-click **CSV Report Export** (`.csv` file download).
    - Print-ready CSS media stylesheet for hardcopy reports.
  - **Seamless System Integration**: Interconnects all 4 member modules via event-driven LocalStorage synchronization.

---

## Data Storage Schema (LocalStorage)

The application unifies all modules using the following LocalStorage keys:
- `owners`: Array of owner entities (`id`, `name`, `mobile`, `email`, `address`, `createdDate`).
- `vehicles`: Array of vehicle entities (`id`/`vehicleId`, `regNumber`/`registrationNumber`, `make`/`manufacturer`, `model`, `fuelType`, `purchaseDate`, `insuranceExpiry`, `pucExpiry`, `ownerId`, `ownerName`).
- `services`: Array of workshop service records (`id`/`serviceId`, `vehicleId`, `ownerId`, `serviceDate`, `serviceCenter`, `serviceType`, `parts`, `laborCost`, `taxPercent`, `totalExpenses`/`totalCost`).
- `appointments`: Array of scheduled appointments (`id`/`appointmentId`, `vehicleId`, `ownerId`, `serviceType`, `date`/`appointmentDate`, `timeSlot`, `notes`/`description`, `status`).
- `vms_auth_user`: Active authenticated user session.

---

## How to Run Locally

1. **Clone the repository**:
   ```bash
   git clone git@github.com:nihaal200718/project-expo-vehicle-management-and-services.git
   cd project-expo-vehicle-management-and-services
   ```

2. **Open in Browser**:
   - Double-click `index.html` to open directly in any modern web browser (Chrome, Firefox, Safari, Edge).
   - Or start a lightweight HTTP server:
     ```bash
     npx serve .
     # or
     python3 -m http.server 8000
     ```
   - Navigate to `http://localhost:8000`

3. **Demo Data**:
   - Click **"Reset Demo"** in the sidebar footer or top navigation at any time to instantly populate realistic demonstration records across all 5 modules!
