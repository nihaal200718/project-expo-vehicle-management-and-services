/* =========================================================
   appointments.js  -  Service Appointment Booking & Scheduling
   Member 4 module

   LocalStorage keys used (exact names):
     "vehicles"      -> READ ONLY here (created by Member 2)
     "appointments"  -> read + written here (Member 5 reads it for stats)

   Sections:
     1. Constants
     2. LocalStorage helpers
     3. Date & time helpers
     4. Vehicle helpers
     5. Slot availability + validation (business rules)
     6. Appointment operations (create / cancel / reschedule / status)
     7. Scheduler state (calendar month, chosen date/slot, 12h/24h)
     8. UI rendering (calendar, slot list, table, dialogs)
     9. Reschedule mode
    10. Event handlers
    11. Demo seed tools
    12. Nearest service centers (Google Maps)
    13. Start-up
   ========================================================= */

"use strict";

/* ---------------------------------------------------------
   1. CONSTANTS
   --------------------------------------------------------- */
const STORAGE_KEYS = {
	vehicles: "vehicles",
	appointments: "appointments",
};

// Fixed slots for the demonstration. The ORDER here is the display order.
const TIME_SLOTS = [
	"09:00 AM",
	"10:00 AM",
	"11:00 AM",
	"12:00 PM",
	"02:00 PM",
	"03:00 PM",
	"04:00 PM",
];

const SERVICE_TYPES = [
	"Oil Change",
	"General Service",
	"Brake Inspection",
	"Tire Replacement",
	"Wheel Alignment",
	"Battery Check",
	"AC Service",
	"Engine Diagnostics",
	"Other",
];

// ----- Google Maps settings -----
// 1. Create a key in Google Cloud Console and enable "Maps JavaScript API" + "Places API (New)".
// 2. Paste it below. (Restrict the key to your site/localhost under "Application restrictions".)
const GOOGLE_MAPS_API_KEY = "AIzaSyBOjTXsp4UggV7XVOEkp38AdHzECzJz4qc";
const SEARCH_RADII_METERS = [5000, 15000, 40000]; // widen the search if nothing is found
// Keep the map focused on the closest vehicle service shops, not every result nearby.
const MAX_CENTERS = 5;

const STATUS = {
	CONFIRMED: "Confirmed",
	PENDING: "Pending",
	CANCELLED: "Cancelled",
	COMPLETED: "Completed",
};

// Only these statuses "occupy" a time slot.
const ACTIVE_STATUSES = [STATUS.CONFIRMED, STATUS.PENDING];

/* ---------------------------------------------------------
   2. LOCALSTORAGE HELPERS
   localStorage only stores text, so we convert with
   JSON.stringify (array -> text) and JSON.parse (text -> array).
   --------------------------------------------------------- */
function readArray(key) {
	try {
		const raw = localStorage.getItem(key);
		if (!raw) return [];
		const data = JSON.parse(raw);
		return Array.isArray(data) ? data : [];
	} catch (err) {
		// Broken/corrupted JSON must not crash the page.
		console.error("Could not read '" + key + "' from localStorage:", err);
		return [];
	}
}

function getVehicles() {
	return readArray(STORAGE_KEYS.vehicles);
}
function getAppointments() {
	return readArray(STORAGE_KEYS.appointments);
}

function saveAppointments(list) {
	localStorage.setItem(STORAGE_KEYS.appointments, JSON.stringify(list));
}

/* ---------------------------------------------------------
   3. DATE & TIME HELPERS
   Dates are stored as "YYYY-MM-DD" text (what <input type="date">
   gives us). Text in that format sorts and compares correctly,
   so  "2026-12-10" > "2026-11-21"  works with plain > and <.

   We avoid new Date().toISOString() for "today" because it uses
   UTC, which can show yesterday's date in some time zones.
   --------------------------------------------------------- */
function pad2(n) {
	return String(n).padStart(2, "0");
}

function toDateString(dateObj) {
	return (
		dateObj.getFullYear() +
		"-" +
		pad2(dateObj.getMonth() + 1) +
		"-" +
		pad2(dateObj.getDate())
	);
}

function getTodayString() {
	return toDateString(new Date());
}

function addDaysToToday(days) {
	const d = new Date();
	d.setDate(d.getDate() + days);
	return toDateString(d);
}

function isPastDate(dateStr) {
	return dateStr < getTodayString();
}

// "10:00 AM" -> 600 (minutes since midnight), so slots can be compared with the clock.
function slotToMinutes(slot) {
	const parts = slot.split(" "); // ["10:00", "AM"]
	const hm = parts[0].split(":"); // ["10", "00"]
	let hours = Number(hm[0]);
	const minutes = Number(hm[1]);
	if (parts[1] === "PM" && hours !== 12) hours += 12;
	if (parts[1] === "AM" && hours === 12) hours = 0;
	return hours * 60 + minutes;
}

// For TODAY only: has this slot's start time already gone by?
function isSlotInPast(dateStr, slot) {
	if (dateStr !== getTodayString()) return false;
	const now = new Date();
	return slotToMinutes(slot) <= now.getHours() * 60 + now.getMinutes();
}

// "2026-12-10" -> "10 Dec 2026". We split the text ourselves so no time-zone shift can happen.
function formatDisplayDate(dateStr) {
	if (!dateStr) return "-";
	const p = dateStr.split("-").map(Number);
	return new Date(p[0], p[1] - 1, p[2]).toLocaleDateString("en-GB", {
		day: "2-digit",
		month: "short",
		year: "numeric",
	});
}

/* ---------------------------------------------------------
   4. VEHICLE HELPERS
   Member 2 may name the fields slightly differently, so we check
   a few likely names. If yours differ, add them to these lists.
   --------------------------------------------------------- */
function pickFirst(obj, fieldNames) {
	for (let i = 0; i < fieldNames.length; i++) {
		const value = obj[fieldNames[i]];
		if (value !== undefined && value !== null && value !== "") return value;
	}
	return "";
}

function getVehicleDetails(vehicle) {
	return {
		id: vehicle.vehicleId,
		regNo: pickFirst(vehicle, [
			"registrationNumber",
			"regNumber",
			"registrationNo",
			"regNo",
			"vehicleNumber",
			"plateNumber",
		]),
		model: pickFirst(vehicle, ["model", "vehicleModel", "modelName"]),
	};
}

function findVehicleById(vehicleId) {
	return (
		getVehicles().find(function (v) {
			return v.vehicleId === vehicleId;
		}) || null
	);
}

/* ---------------------------------------------------------
   5. SLOT AVAILABILITY + VALIDATION
   --------------------------------------------------------- */
function isActive(appointment) {
	return ACTIVE_STATUSES.includes(appointment.status);
}

// ignoreId lets an appointment ignore ITSELF when it is being rescheduled.
function isSlotTaken(date, slot, ignoreId) {
	return getAppointments().some(function (a) {
		return (
			a.appointmentDate === date &&
			a.timeSlot === slot &&
			isActive(a) && // cancelled/completed never block
			a.appointmentId !== ignoreId
		);
	});
}

// Same vehicle + same service + same day, both still active = duplicate.
function hasDuplicateBooking(vehicleId, serviceType, date, ignoreId) {
	return getAppointments().some(function (a) {
		return (
			a.vehicleId === vehicleId &&
			a.serviceType === serviceType &&
			a.appointmentDate === date &&
			isActive(a) &&
			a.appointmentId !== ignoreId
		);
	});
}

// Checks date + slot (used by BOTH booking and rescheduling).
function validateSchedule(date, slot, ignoreId) {
	const errors = {};
	if (!date) {
		errors.date = "Please choose an appointment date.";
	} else if (isPastDate(date)) {
		errors.date = "Appointment date cannot be in the past.";
	}

	if (!slot) {
		errors.slot = "Please select a time slot.";
	} else if (!TIME_SLOTS.includes(slot)) {
		errors.slot = "Invalid time slot.";
	} else if (date && !errors.date) {
		if (isSlotInPast(date, slot)) {
			errors.slot = "That time has already passed today.";
		} else if (isSlotTaken(date, slot, ignoreId)) {
			errors.slot = "This slot is already booked. Please pick another.";
		}
	}
	return errors;
}

// Full booking validation. Returns an object of errors (empty object = valid).
function validateBooking(data) {
	const errors = validateSchedule(data.appointmentDate, data.timeSlot, null);

	if (!data.vehicleId) {
		errors.vehicle = "Please select a vehicle.";
	} else if (!findVehicleById(data.vehicleId)) {
		errors.vehicle = "Selected vehicle was not found.";
	}

	if (!data.serviceType) {
		errors.service = "Please select a service type.";
	}

	if (
		!errors.vehicle &&
		!errors.service &&
		!errors.date &&
		hasDuplicateBooking(
			data.vehicleId,
			data.serviceType,
			data.appointmentDate,
			null,
		)
	) {
		errors.form =
			"This vehicle already has an active '" +
			data.serviceType +
			"' appointment on this date.";
	}
	return errors;
}

/* ---------------------------------------------------------
   6. APPOINTMENT OPERATIONS
   --------------------------------------------------------- */
// "A001", "A002", ... Uses the highest existing number + 1 so IDs never repeat.
function generateAppointmentId() {
	const numbers = getAppointments().map(function (a) {
		return parseInt(String(a.appointmentId).replace(/\D/g, ""), 10) || 0;
	});
	const next = (numbers.length ? Math.max.apply(null, numbers) : 0) + 1;
	return "A" + String(next).padStart(3, "0");
}

function createAppointment(data) {
	const appointment = {
		appointmentId: generateAppointmentId(),
		vehicleId: data.vehicleId,
		serviceType: data.serviceType,
		appointmentDate: data.appointmentDate,
		timeSlot: data.timeSlot,
		description: (data.description || "").trim(),
		status: STATUS.CONFIRMED,
	};
	const list = getAppointments();
	list.push(appointment);
	saveAppointments(list);
	return appointment;
}

function findAppointment(id) {
	return (
		getAppointments().find(function (a) {
			return a.appointmentId === id;
		}) || null
	);
}

// Changes one appointment's fields and saves. Returns the updated record (or null).
function updateAppointment(id, changes) {
	const list = getAppointments();
	const index = list.findIndex(function (a) {
		return a.appointmentId === id;
	});
	if (index === -1) return null;
	list[index] = Object.assign({}, list[index], changes);
	saveAppointments(list);
	return list[index];
}

function cancelAppointment(id) {
	const appt = findAppointment(id);
	if (!appt || !isActive(appt)) return false;
	updateAppointment(id, { status: STATUS.CANCELLED });
	return true;
}

function setAppointmentStatus(id, newStatus) {
	const appt = findAppointment(id);
	if (!appt || !isActive(appt)) return false;
	updateAppointment(id, { status: newStatus });
	return true;
}

// Returns {ok:true} or {ok:false, errors:{...}}
function rescheduleAppointment(id, newDate, newSlot) {
	const appt = findAppointment(id);
	if (!appt || !isActive(appt)) {
		return {
			ok: false,
			errors: { form: "Only active appointments can be rescheduled." },
		};
	}
	const errors = validateSchedule(newDate, newSlot, id); // id = ignore itself
	if (
		!errors.date &&
		hasDuplicateBooking(appt.vehicleId, appt.serviceType, newDate, id)
	) {
		errors.date =
			"This vehicle already has the same service booked on that date.";
	}
	if (Object.keys(errors).length) return { ok: false, errors: errors };

	updateAppointment(id, { appointmentDate: newDate, timeSlot: newSlot });
	return { ok: true };
}

/* ---------------------------------------------------------
   7. SCHEDULER STATE
   One object holds everything the calendar + slot list need.
   Whenever it changes we call renderScheduler() to redraw.
   --------------------------------------------------------- */
const state = {
	viewYear: new Date().getFullYear(), // month currently shown in the calendar
	viewMonth: new Date().getMonth(), // 0 = January ... 11 = December
	selectedDate: "", // "YYYY-MM-DD" or ""
	selectedSlot: "", // "10:00 AM" or ""
	use24h: false, // 12h / 24h display toggle
	rescheduleId: null, // appointment ID when in reschedule mode
};

const el = {}; // filled in start-up: shortcuts to HTML elements

// "available" | "booked" | "passed" for one slot on one date.
function getSlotState(date, slot, ignoreId) {
	if (isSlotInPast(date, slot)) return "passed";
	if (isSlotTaken(date, slot, ignoreId)) return "booked";
	return "available";
}

function countAvailableSlots(date, ignoreId) {
	return TIME_SLOTS.filter(function (slot) {
		return getSlotState(date, slot, ignoreId) === "available";
	}).length;
}

// Display only: the stored value always stays "10:00 AM".
function formatSlot(slot) {
	if (!state.use24h) return slot;
	const mins = slotToMinutes(slot);
	return pad2(Math.floor(mins / 60)) + ":" + pad2(mins % 60);
}

function formatLongDate(dateStr) {
	const p = dateStr.split("-").map(Number);
	return new Date(p[0], p[1] - 1, p[2]).toLocaleDateString("en-US", {
		month: "short",
		day: "numeric",
		year: "numeric",
	});
}

function formatWeekdayDate(dateStr) {
	const p = dateStr.split("-").map(Number);
	return new Date(p[0], p[1] - 1, p[2]).toLocaleDateString("en-GB", {
		weekday: "short",
		day: "2-digit",
		month: "short",
		year: "numeric",
	});
}

function getTimezoneLabel() {
	const offset = -new Date().getTimezoneOffset(); // minutes ahead of UTC
	const sign = offset >= 0 ? "+" : "-";
	const abs = Math.abs(offset);
	return "GMT" + sign + pad2(Math.floor(abs / 60)) + ":" + pad2(abs % 60);
}

/* ---------------------------------------------------------
   8. UI RENDERING
   --------------------------------------------------------- */
// Anything the user types must be escaped before going into innerHTML,
// otherwise text like <script> could run as code.
function escapeHtml(text) {
	return String(text === undefined || text === null ? "" : text)
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#39;");
}

function showToast(message, isError) {
	el.toast.textContent = message;
	el.toast.classList.toggle("toast-error", !!isError);
	el.toast.classList.add("show");
	clearTimeout(showToast.timer);
	showToast.timer = setTimeout(function () {
		el.toast.classList.remove("show");
	}, 3000);
}

function setError(inputEl, errorEl, message) {
	errorEl.textContent = message || "";
	if (inputEl) inputEl.classList.toggle("is-invalid", !!message);
}

function clearBookingErrors() {
	setError(el.vehicleSelect, el.vehicleError, "");
	setError(el.serviceType, el.serviceError, "");
	el.schedError.textContent = "";
	el.formError.textContent = "";
}

/* ----- Dropdowns ----- */
function renderVehicleOptions() {
	const vehicles = getVehicles();
	const previous = el.vehicleSelect.value;

	el.vehicleSelect.innerHTML =
		'<option value="">Select a registered vehicle</option>';
	vehicles.forEach(function (v) {
		const d = getVehicleDetails(v);
		const option = document.createElement("option");
		option.value = d.id;
		option.textContent =
			d.id +
			" - " +
			(d.regNo || "No reg. no.") +
			(d.model ? " (" + d.model + ")" : "");
		el.vehicleSelect.appendChild(option);
	});

	if (previous && findVehicleById(previous)) el.vehicleSelect.value = previous;

	const hasVehicles = vehicles.length > 0;
	el.noVehicleNotice.hidden = hasVehicles;
	el.bookBtn.disabled = !hasVehicles;
	showVehicleInfo();
}

function renderServiceOptions() {
	SERVICE_TYPES.forEach(function (type) {
		const option = document.createElement("option");
		option.value = type;
		option.textContent = type;
		el.serviceType.appendChild(option);
	});
}

// Shows registration number + model under the vehicle dropdown.
function showVehicleInfo() {
	const vehicle = findVehicleById(el.vehicleSelect.value);
	if (!vehicle) {
		el.vehicleInfo.hidden = true;
		return;
	}
	const d = getVehicleDetails(vehicle);
	el.infoRegNo.textContent = d.regNo || "-";
	el.infoModel.textContent = d.model || "-";
	el.vehicleInfo.hidden = false;
}

/* ----- Calendar -----
   A month grid is: (blank cells for the weekday the 1st falls on) + one cell per day. */
function renderCalendar() {
	const year = state.viewYear;
	const month = state.viewMonth;
	const today = new Date();
	const todayStr = getTodayString();
	const ignoreId = state.rescheduleId;

	el.monthLabel.textContent = new Date(year, month, 1).toLocaleDateString(
		"en-US",
		{ month: "long", year: "numeric" },
	);

	// Can't go back before the current month.
	el.prevMonth.disabled =
		year * 12 + month <= today.getFullYear() * 12 + today.getMonth();

	const firstWeekday = new Date(year, month, 1).getDay(); // 0 = Sunday
	const daysInMonth = new Date(year, month + 1, 0).getDate(); // day 0 of next month = last day of this one

	let html = "";
	for (let i = 0; i < firstWeekday; i++) {
		html += '<span class="day blank"></span>';
	}

	for (let day = 1; day <= daysInMonth; day++) {
		const dateStr = year + "-" + pad2(month + 1) + "-" + pad2(day);
		let cls = "day";
		let disabled = true;
		let title = "";

		if (isPastDate(dateStr)) {
			cls += " day-past";
		} else if (countAvailableSlots(dateStr, ignoreId) === 0) {
			cls += " day-full";
			title = "No free slots";
		} else {
			cls += " day-open";
			disabled = false;
		}
		if (dateStr === todayStr) cls += " day-today";
		if (dateStr === state.selectedDate) cls += " day-selected";

		html +=
			'<button type="button" class="' +
			cls +
			'" data-date="' +
			dateStr +
			'"' +
			(title ? ' title="' + title + '"' : "") +
			(disabled ? " disabled" : "") +
			">" +
			day +
			"</button>";
	}
	el.calendarGrid.innerHTML = html;
}

/* ----- Time slot list ----- */
function renderSlots() {
	el.fmt12.classList.toggle("active", !state.use24h);
	el.fmt24.classList.toggle("active", state.use24h);

	if (!state.selectedDate) {
		el.slotDateTitle.textContent = "Pick a date";
		el.slotList.innerHTML =
			'<p class="slot-empty">Select a date on the calendar to see available time slots.</p>';
		return;
	}

	el.slotDateTitle.textContent = formatLongDate(state.selectedDate);

	// If the chosen slot got taken meanwhile (e.g. another tab), unselect it.
	if (
		state.selectedSlot &&
		getSlotState(state.selectedDate, state.selectedSlot, state.rescheduleId) !==
			"available"
	) {
		state.selectedSlot = "";
	}

	el.slotList.innerHTML = TIME_SLOTS.map(function (slot) {
		const slotState = getSlotState(
			state.selectedDate,
			slot,
			state.rescheduleId,
		);
		const isSelected = slot === state.selectedSlot;
		const note =
			slotState === "booked"
				? "Booked"
				: slotState === "passed"
					? "Passed"
					: "";

		return (
			'<button type="button" class="slot-btn ' +
			slotState +
			(isSelected ? " selected" : "") +
			'"' +
			' data-slot="' +
			slot +
			'"' +
			(slotState !== "available" ? " disabled" : "") +
			">" +
			'<span class="dot"></span>' +
			escapeHtml(formatSlot(slot)) +
			(note ? " <small>" + note + "</small>" : "") +
			"</button>"
		);
	}).join("");
}

function renderSummary() {
	if (state.selectedDate && state.selectedSlot) {
		el.selectionSummary.textContent =
			formatWeekdayDate(state.selectedDate) +
			" at " +
			formatSlot(state.selectedSlot);
	} else {
		el.selectionSummary.textContent = "";
	}
}

function renderScheduler() {
	renderCalendar();
	renderSlots();
	renderSummary();
}

/* ----- Appointment table ----- */
// Which action buttons make sense for this appointment?
function buildActionButtons(appt, small) {
	const cls = small ? "btn btn-outline btn-sm" : "btn btn-outline";
	const dangerCls = small
		? "btn btn-danger-outline btn-sm"
		: "btn btn-danger-outline";
	const id = escapeHtml(appt.appointmentId);
	let html = "";

	if (isActive(appt)) {
		if (appt.status === STATUS.PENDING) {
			html +=
				'<button type="button" class="' +
				cls +
				'" data-action="confirm" data-id="' +
				id +
				'">Confirm</button>';
		}
		html +=
			'<button type="button" class="' +
			cls +
			'" data-action="complete" data-id="' +
			id +
			'">Complete</button>';
		html +=
			'<button type="button" class="' +
			cls +
			'" data-action="reschedule" data-id="' +
			id +
			'">Reschedule</button>';
		html +=
			'<button type="button" class="' +
			dangerCls +
			'" data-action="cancel" data-id="' +
			id +
			'">Cancel</button>';
	}
	return html;
}

function getFilteredAppointments() {
	const dateFilter = el.filterDate.value;
	const statusFilter = el.filterStatus.value;

	return getAppointments()
		.filter(function (a) {
			const dateOk = !dateFilter || a.appointmentDate === dateFilter;
			const statusOk = !statusFilter || a.status === statusFilter;
			return dateOk && statusOk;
		})
		.sort(function (a, b) {
			if (a.appointmentDate !== b.appointmentDate) {
				return a.appointmentDate < b.appointmentDate ? -1 : 1;
			}
			return TIME_SLOTS.indexOf(a.timeSlot) - TIME_SLOTS.indexOf(b.timeSlot);
		});
}

function renderAppointmentTable() {
	const rows = getFilteredAppointments();
	el.countPill.textContent = getAppointments().length;

	if (rows.length === 0) {
		const filtering = el.filterDate.value || el.filterStatus.value;
		el.appointmentBody.innerHTML =
			'<tr class="empty-row"><td colspan="7">' +
			(filtering
				? "No appointments match the selected filters."
				: "No appointments yet. Book your first one!") +
			"</td></tr>";
		return;
	}

	el.appointmentBody.innerHTML = rows
		.map(function (a) {
			const vehicle = findVehicleById(a.vehicleId);
			const d = vehicle ? getVehicleDetails(vehicle) : null;
			const vehicleCell = d
				? escapeHtml(d.regNo || a.vehicleId) +
					'<span class="cell-sub">' +
					escapeHtml(d.model) +
					"</span>"
				: escapeHtml(a.vehicleId) +
					'<span class="cell-sub">Vehicle not found</span>';

			return (
				"<tr>" +
				"<td><strong>" +
				escapeHtml(a.appointmentId) +
				"</strong></td>" +
				"<td>" +
				vehicleCell +
				"</td>" +
				"<td>" +
				escapeHtml(a.serviceType) +
				"</td>" +
				"<td>" +
				escapeHtml(formatDisplayDate(a.appointmentDate)) +
				"</td>" +
				"<td>" +
				escapeHtml(a.timeSlot) +
				"</td>" +
				'<td><span class="badge badge-' +
				escapeHtml(String(a.status).toLowerCase()) +
				'">' +
				escapeHtml(a.status) +
				"</span></td>" +
				'<td><div class="actions">' +
				'<button type="button" class="btn btn-outline btn-sm" data-action="view" data-id="' +
				escapeHtml(a.appointmentId) +
				'">View</button>' +
				buildActionButtons(a, true) +
				"</div></td>" +
				"</tr>"
			);
		})
		.join("");
}

/* ----- Dialogs ----- */
function detailRow(label, valueHtml) {
	return "<dt>" + label + "</dt><dd>" + valueHtml + "</dd>";
}

function openDetailsDialog(id) {
	const a = findAppointment(id);
	if (!a) return;
	const vehicle = findVehicleById(a.vehicleId);
	const d = vehicle ? getVehicleDetails(vehicle) : null;

	el.detailsBody.innerHTML =
		'<dl class="detail-list">' +
		detailRow("Appointment ID", escapeHtml(a.appointmentId)) +
		detailRow("Vehicle ID", escapeHtml(a.vehicleId)) +
		detailRow(
			"Registration No.",
			escapeHtml(d ? d.regNo || "-" : "Vehicle not found"),
		) +
		detailRow("Model", escapeHtml(d ? d.model || "-" : "-")) +
		detailRow("Service Type", escapeHtml(a.serviceType)) +
		detailRow("Date", escapeHtml(formatDisplayDate(a.appointmentDate))) +
		detailRow("Time Slot", escapeHtml(a.timeSlot)) +
		detailRow("Requirements", escapeHtml(a.description || "-")) +
		detailRow(
			"Status",
			'<span class="badge badge-' +
				escapeHtml(a.status.toLowerCase()) +
				'">' +
				escapeHtml(a.status) +
				"</span>",
		) +
		"</dl>";

	el.detailsActions.innerHTML =
		buildActionButtons(a, false) +
		'<button type="button" class="btn btn-primary" data-close>Close</button>';
	el.detailsDialog.showModal();
}

function openConfirmDialog(appt) {
	const vehicle = findVehicleById(appt.vehicleId);
	const d = vehicle ? getVehicleDetails(vehicle) : { regNo: "-", model: "-" };

	el.confirmBody.innerHTML =
		'<p class="confirm-id">' +
		escapeHtml(appt.appointmentId) +
		"</p>" +
		'<dl class="detail-list">' +
		detailRow(
			"Vehicle",
			escapeHtml((d.regNo || "-") + (d.model ? " (" + d.model + ")" : "")),
		) +
		detailRow("Service", escapeHtml(appt.serviceType)) +
		detailRow("Date", escapeHtml(formatDisplayDate(appt.appointmentDate))) +
		detailRow("Time", escapeHtml(appt.timeSlot)) +
		detailRow("Requirements", escapeHtml(appt.description || "-")) +
		detailRow(
			"Status",
			'<span class="badge badge-confirmed">' +
				escapeHtml(appt.status) +
				"</span>",
		) +
		"</dl>";
	el.confirmDialog.showModal();
}

/* ----- Tabs ----- */
function showView(name) {
	const isBook = name === "book";
	el.viewBook.hidden = !isBook;
	el.viewList.hidden = isBook;
	el.tabBook.classList.toggle("active", isBook);
	el.tabList.classList.toggle("active", !isBook);
	el.tabBook.setAttribute("aria-selected", String(isBook));
	el.tabList.setAttribute("aria-selected", String(!isBook));
}

/* Re-draw everything that depends on stored appointments. */
function refreshAll() {
	renderAppointmentTable();
	renderScheduler();
}

/* ---------------------------------------------------------
   9. RESCHEDULE MODE
   Instead of a separate pop-up, the same calendar is reused:
   vehicle/service are locked and the button saves the new time.
   --------------------------------------------------------- */
function setFormLocked(locked) {
	el.vehicleSelect.disabled = locked;
	el.serviceType.disabled = locked;
	el.description.disabled = locked;
}

function startReschedule(id) {
	const a = findAppointment(id);
	if (!a || !isActive(a)) return;

	state.rescheduleId = id;
	el.vehicleSelect.value = a.vehicleId;
	el.serviceType.value = a.serviceType;
	el.description.value = a.description;
	setFormLocked(true);
	showVehicleInfo();
	clearBookingErrors();

	// Start from the current booking if it is still in the future.
	const stillFuture = !isPastDate(a.appointmentDate);
	state.selectedDate = stillFuture ? a.appointmentDate : "";
	state.selectedSlot = stillFuture ? a.timeSlot : "";
	const parts = (stillFuture ? a.appointmentDate : getTodayString())
		.split("-")
		.map(Number);
	state.viewYear = parts[0];
	state.viewMonth = parts[1] - 1;

	el.rescheduleText.textContent =
		"Rescheduling " +
		a.appointmentId +
		" (" +
		a.serviceType +
		"). Pick a new date and time.";
	el.rescheduleBanner.hidden = false;
	el.bookBtn.textContent = "Confirm New Time";

	if (el.detailsDialog.open) el.detailsDialog.close();
	showView("book");
	renderScheduler();
}

function resetBookingForm() {
	state.rescheduleId = null;
	state.selectedDate = "";
	state.selectedSlot = "";
	setFormLocked(false);
	el.bookingForm.reset();
	el.vehicleInfo.hidden = true;
	el.rescheduleBanner.hidden = true;
	el.bookBtn.textContent = "Book Appointment";
	clearBookingErrors();
}

function exitReschedule() {
	resetBookingForm();
	renderVehicleOptions();
	renderScheduler();
}

/* ---------------------------------------------------------
   10. EVENT HANDLERS
   --------------------------------------------------------- */
function handleCalendarClick(event) {
	const button = event.target.closest("button[data-date]");
	if (!button || button.disabled) return;
	state.selectedDate = button.dataset.date;
	el.schedError.textContent = "";
	renderScheduler();
}

function handleSlotClick(event) {
	const button = event.target.closest("button[data-slot]");
	if (!button || button.disabled) return;
	state.selectedSlot = button.dataset.slot;
	el.schedError.textContent = "";
	renderSlots();
	renderSummary();
}

function changeMonth(step) {
	state.viewMonth += step;
	if (state.viewMonth > 11) {
		state.viewMonth = 0;
		state.viewYear++;
	}
	if (state.viewMonth < 0) {
		state.viewMonth = 11;
		state.viewYear--;
	}
	renderCalendar();
}

function setTimeFormat(use24h) {
	state.use24h = use24h;
	renderSlots();
	renderSummary();
}

function handleBookingSubmit(event) {
	event.preventDefault(); // stop the browser from reloading the page
	clearBookingErrors();

	/* ----- Reschedule mode ----- */
	if (state.rescheduleId) {
		const id = state.rescheduleId;
		const result = rescheduleAppointment(
			id,
			state.selectedDate,
			state.selectedSlot,
		);
		if (!result.ok) {
			el.schedError.textContent =
				result.errors.date || result.errors.slot || result.errors.form || "";
			renderScheduler();
			return;
		}
		exitReschedule();
		showView("list");
		refreshAll();
		showToast("Appointment " + id + " rescheduled.");
		return;
	}

	/* ----- New booking ----- */
	const data = {
		vehicleId: el.vehicleSelect.value,
		serviceType: el.serviceType.value,
		appointmentDate: state.selectedDate,
		timeSlot: state.selectedSlot,
		description: el.description.value,
	};

	const errors = validateBooking(data);
	if (Object.keys(errors).length) {
		setError(el.vehicleSelect, el.vehicleError, errors.vehicle);
		setError(el.serviceType, el.serviceError, errors.service);
		el.schedError.textContent = errors.date || errors.slot || "";
		el.formError.textContent = errors.form || "";
		renderScheduler(); // slot list may be stale if another tab booked it
		return;
	}

	const appointment = createAppointment(data);
	resetBookingForm();
	renderVehicleOptions();
	refreshAll();
	openConfirmDialog(appointment);
}

// One listener handles every button that has data-action (event delegation).
function handleAction(event) {
	const button = event.target.closest("[data-action]");
	if (!button) return;
	const id = button.dataset.id;
	const action = button.dataset.action;

	if (action === "view") {
		openDetailsDialog(id);
	} else if (action === "reschedule") {
		startReschedule(id);
	} else if (action === "cancel") {
		if (
			confirm(
				"Cancel appointment " +
					id +
					"? Its time slot will become available again.",
			)
		) {
			cancelAppointment(id);
			if (state.rescheduleId === id) exitReschedule();
			if (el.detailsDialog.open) el.detailsDialog.close();
			refreshAll();
			showToast("Appointment " + id + " cancelled.");
		}
	} else if (action === "confirm") {
		setAppointmentStatus(id, STATUS.CONFIRMED);
		if (el.detailsDialog.open) el.detailsDialog.close();
		refreshAll();
		showToast("Appointment " + id + " confirmed.");
	} else if (action === "complete") {
		setAppointmentStatus(id, STATUS.COMPLETED);
		if (state.rescheduleId === id) exitReschedule();
		if (el.detailsDialog.open) el.detailsDialog.close();
		refreshAll();
		showToast("Appointment " + id + " marked as completed.");
	}
}

function handleCloseButtons(event) {
	if (event.target.closest("[data-close]")) {
		const dialog = event.target.closest("dialog");
		if (dialog) dialog.close();
	}
}

function handleBack() {
	if (state.rescheduleId) {
		exitReschedule();
		showView("list");
	} else if (window.history.length > 1) {
		window.history.back();
	} else {
		showToast("No previous page to go back to.", true);
	}
}

/* ---------------------------------------------------------
   11. DEMO SEED TOOLS (remove before final integration)
   --------------------------------------------------------- */
function seedSampleVehicles() {
	if (getVehicles().length > 0) {
		showToast("Vehicles already exist - nothing was changed.", true);
		return;
	}
	const sample = [
		{
			vehicleId: "V001",
			registrationNumber: "TS09AB1234",
			make: "Honda",
			model: "City",
			ownerName: "Ravi Kumar",
		},
		{
			vehicleId: "V002",
			registrationNumber: "TS10CD5678",
			make: "Maruti",
			model: "Swift",
			ownerName: "Anita Rao",
		},
		{
			vehicleId: "V003",
			registrationNumber: "AP28EF9012",
			make: "Hyundai",
			model: "Creta",
			ownerName: "Suresh Reddy",
		},
	];
	localStorage.setItem(STORAGE_KEYS.vehicles, JSON.stringify(sample));
	renderVehicleOptions();
	refreshAll();
	showToast("Sample vehicles loaded.");
}

function seedSampleAppointments() {
	if (getAppointments().length > 0) {
		showToast("Appointments already exist - clear them first.", true);
		return;
	}
	if (getVehicles().length === 0) {
		showToast("Load vehicles first.", true);
		return;
	}
	const vehicles = getVehicles();
	const v1 = vehicles[0].vehicleId;
	const v2 = (vehicles[1] || vehicles[0]).vehicleId;
	const v3 = (vehicles[2] || vehicles[0]).vehicleId;

	// Dates are relative to today, so the sample never goes out of date.
	const sample = [
		{
			appointmentId: "A001",
			vehicleId: v1,
			serviceType: "Oil Change",
			appointmentDate: addDaysToToday(3),
			timeSlot: "10:00 AM",
			description: "Engine oil replacement",
			status: STATUS.CONFIRMED,
		},
		{
			appointmentId: "A002",
			vehicleId: v2,
			serviceType: "Brake Inspection",
			appointmentDate: addDaysToToday(3),
			timeSlot: "02:00 PM",
			description: "Squeaking noise when braking",
			status: STATUS.PENDING,
		},
		{
			appointmentId: "A003",
			vehicleId: v3,
			serviceType: "General Service",
			appointmentDate: addDaysToToday(5),
			timeSlot: "09:00 AM",
			description: "10,000 km service",
			status: STATUS.CONFIRMED,
		},
		{
			appointmentId: "A004",
			vehicleId: v1,
			serviceType: "AC Service",
			appointmentDate: addDaysToToday(4),
			timeSlot: "11:00 AM",
			description: "AC not cooling properly",
			status: STATUS.CANCELLED,
		},
		{
			appointmentId: "A005",
			vehicleId: v2,
			serviceType: "Tire Replacement",
			appointmentDate: addDaysToToday(-7),
			timeSlot: "03:00 PM",
			description: "Replace front tires",
			status: STATUS.COMPLETED,
		},
	];
	saveAppointments(sample);
	refreshAll();
	showToast("Sample appointments loaded.");
}

function clearAllAppointments() {
	if (!confirm("Delete ALL appointments from localStorage? (demo tool)"))
		return;
	localStorage.removeItem(STORAGE_KEYS.appointments);
	if (state.rescheduleId) exitReschedule();
	refreshAll();
	showToast("All appointments cleared.");
}

/* ---------------------------------------------------------
   12. NEAREST SERVICE CENTERS (Google Maps)
   Flow:  load Google Maps script -> ask browser for your location ->
          Places API "Nearby Search" for car repair / service centers ->
          sort by distance -> show markers on the map + a clickable list.
   If GOOGLE_MAPS_API_KEY is not set, this section shows a setup note
   and the rest of the page keeps working normally.
   --------------------------------------------------------- */
const geo = {
	loaded: false, // true once the map object exists
	map: null,
	lib: {}, // Google libraries we import: marker, places, core
	markers: [], // one marker per service center
	userMarker: null,
	infoWindow: null,
	userLocation: null, // {lat, lng} from the browser
	centers: [], // search results, nearest first
	selected: -1, // index of the highlighted center
};

function hasMapsKey() {
	return !!GOOGLE_MAPS_API_KEY && GOOGLE_MAPS_API_KEY.indexOf("YOUR_") !== 0;
}

function setCentersStatus(message, isError) {
	el.centersStatus.textContent = message;
	el.centersStatus.classList.toggle("is-error", !!isError);
}

// Straight-line distance between two lat/lng points in km (haversine formula).
function distanceKm(a, b) {
	const toRad = function (deg) {
		return (deg * Math.PI) / 180;
	};
	const R = 6371; // Earth radius in km
	const dLat = toRad(b.lat - a.lat);
	const dLng = toRad(b.lng - a.lng);
	const h =
		Math.sin(dLat / 2) * Math.sin(dLat / 2) +
		Math.cos(toRad(a.lat)) *
			Math.cos(toRad(b.lat)) *
			Math.sin(dLng / 2) *
			Math.sin(dLng / 2);
	return 2 * R * Math.asin(Math.sqrt(h));
}

// Adds the Google Maps <script> tag once and resolves when it has loaded.
function loadGoogleMaps() {
	return new Promise(function (resolve, reject) {
		if (
			window.google &&
			window.google.maps &&
			window.google.maps.importLibrary
		) {
			resolve();
			return;
		}
		window.__onGoogleMapsLoaded = resolve; // Google calls this when ready
		window.gm_authFailure = function () {
			// Google calls this if the key is rejected
			setCentersStatus(
				"Google rejected the API key. Check the key, its restrictions and billing.",
				true,
			);
		};
		const script = document.createElement("script");
		script.src =
			"https://maps.googleapis.com/maps/api/js?key=" +
			encodeURIComponent(GOOGLE_MAPS_API_KEY) +
			"&loading=async&v=weekly&callback=__onGoogleMapsLoaded";
		script.async = true;
		script.onerror = function () {
			reject(
				new Error(
					"Could not reach Google Maps. Check your internet connection.",
				),
			);
		};
		document.head.appendChild(script);
	});
}

async function setupMap(center) {
	const mapsLib = await google.maps.importLibrary("maps");
	geo.lib.marker = await google.maps.importLibrary("marker");
	geo.lib.places = await google.maps.importLibrary("places");
	geo.lib.core = await google.maps.importLibrary("core");

	geo.map = new mapsLib.Map(el.mapCanvas, {
		center: center,
		zoom: 13,
		mapId: "DEMO_MAP_ID", // needed for advanced markers
		colorScheme:
			(geo.lib.core.ColorScheme && geo.lib.core.ColorScheme.DARK) || "DARK",
		mapTypeControl: false,
		streetViewControl: false,
	});
	geo.infoWindow = new mapsLib.InfoWindow();
	geo.loaded = true;
	el.mapPlaceholder.hidden = true;
}

// Browser location (the user must click "Allow").
function getBrowserLocation() {
	return new Promise(function (resolve, reject) {
		if (!navigator.geolocation) {
			reject(new Error("This browser does not support location."));
			return;
		}
		navigator.geolocation.getCurrentPosition(
			function (pos) {
				resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude });
			},
			function (err) {
				reject(new Error(err.message || "Location permission was denied."));
			},
			{ enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 },
		);
	});
}

// Asks Google's Places API for the closest vehicle repair/service shops near `origin`.
// If nothing is found in a small radius, the radius is widened step by step.
async function searchServiceCenters(origin) {
	const Place = geo.lib.places.Place;
	const rankByDistance = geo.lib.places.SearchNearbyRankPreference.DISTANCE;
	let places = [];

	for (let i = 0; i < SEARCH_RADII_METERS.length && places.length === 0; i++) {
		const result = await Place.searchNearby({
			fields: [
				"displayName",
				"location",
				"formattedAddress",
				"rating",
				"userRatingCount",
				"googleMapsURI",
				"nationalPhoneNumber",
			],
			locationRestriction: { center: origin, radius: SEARCH_RADII_METERS[i] },
			includedPrimaryTypes: ["car_repair"],
			maxResultCount: MAX_CENTERS,
			rankPreference: rankByDistance,
		});
		places = result.places || [];
	}

	return places
		.map(function (p) {
			const point = { lat: p.location.lat(), lng: p.location.lng() };
			return {
				id: p.id || "",
				name: p.displayName || "Service center",
				address: p.formattedAddress || "",
				lat: point.lat,
				lng: point.lng,
				rating: p.rating || null,
				ratingCount: p.userRatingCount || 0,
				phone: p.nationalPhoneNumber || "",
				url: p.googleMapsURI || "",
				distanceKm: distanceKm(origin, point),
			};
		})
		.sort(function (a, b) {
			return a.distanceKm - b.distanceKm;
		});
}

function directionsUrl(center, origin) {
	let url =
		"https://www.google.com/maps/dir/?api=1&destination=" +
		center.lat +
		"," +
		center.lng;
	if (center.id)
		url += "&destination_place_id=" + encodeURIComponent(center.id);
	if (origin) url += "&origin=" + origin.lat + "," + origin.lng;
	return url;
}

function formatDistance(km) {
	return km < 1 ? Math.round(km * 1000) + " m" : km.toFixed(1) + " km";
}

function clearCenterMarkers() {
	geo.markers.forEach(function (m) {
		m.map = null;
	});
	geo.markers = [];
}

function renderCenters(origin) {
	clearCenterMarkers();
	geo.selected = -1;

	if (geo.centers.length === 0) {
		el.centerList.innerHTML =
			'<li class="center-empty">No service centers found near this location.</li>';
		return;
	}

	const AdvancedMarkerElement = geo.lib.marker.AdvancedMarkerElement;
	const PinElement = geo.lib.marker.PinElement;
	const bounds = new geo.lib.core.LatLngBounds();
	bounds.extend(origin);

	geo.centers.forEach(function (c, index) {
		const pin = new PinElement({
			glyphText: String(index + 1),
			glyphColor: "#FFFFFF",
			background: index === 0 ? "#0F9D8A" : "#2563EB",
			borderColor: "#FFFFFF",
		});
		const marker = new AdvancedMarkerElement({
			map: geo.map,
			position: { lat: c.lat, lng: c.lng },
			title: c.name,
			content: pin.element || pin,
		});
		marker.addEventListener("gmp-click", function () {
			selectCenter(index, true);
		});
		geo.markers.push(marker);
		bounds.extend({ lat: c.lat, lng: c.lng });
	});

	geo.map.fitBounds(bounds, 60);

	el.centerList.innerHTML = geo.centers
		.map(function (c, index) {
			const rating = c.rating
				? c.rating.toFixed(1) + "  (" + c.ratingCount + ")"
				: "No rating yet";
			return (
				'<li class="center-item' +
				(index === 0 ? " nearest" : "") +
				'" data-index="' +
				index +
				'">' +
				'<div class="center-top"><span class="center-rank">' +
				(index + 1) +
				"</span>" +
				'<span class="center-name">' +
				escapeHtml(c.name) +
				"</span>" +
				'<span class="center-dist">' +
				formatDistance(c.distanceKm) +
				"</span></div>" +
				(index === 0 ? '<span class="center-tag">Nearest</span>' : "") +
				'<p class="center-meta">' +
				escapeHtml(c.address) +
				"</p>" +
				'<p class="center-meta">' +
				escapeHtml(rating) +
				(c.phone ? " &middot; " + escapeHtml(c.phone) : "") +
				"</p>" +
				'<div class="center-links">' +
				'<a href="' +
				escapeHtml(directionsUrl(c, origin)) +
				'" target="_blank" rel="noopener">Directions</a>' +
				(c.url
					? '<a href="' +
						escapeHtml(c.url) +
						'" target="_blank" rel="noopener">Open in Google Maps</a>'
					: "") +
				"</div></li>"
			);
		})
		.join("");
}

// Highlights one center in the list and on the map.
function selectCenter(index, scrollList) {
	const c = geo.centers[index];
	if (!c) return;
	geo.selected = index;

	Array.prototype.forEach.call(
		el.centerList.querySelectorAll(".center-item"),
		function (item) {
			const isThis = Number(item.dataset.index) === index;
			item.classList.toggle("selected", isThis);
			if (isThis && scrollList)
				item.scrollIntoView({ block: "nearest", behavior: "smooth" });
		},
	);

	geo.map.panTo({ lat: c.lat, lng: c.lng });
	geo.infoWindow.setContent(
		'<div class="gm-info"><strong>' +
			escapeHtml(c.name) +
			"</strong>" +
			escapeHtml(c.address) +
			"<br>" +
			formatDistance(c.distanceKm) +
			" away<br>" +
			'<a href="' +
			escapeHtml(directionsUrl(c, geo.userLocation)) +
			'" target="_blank" rel="noopener">Get directions</a></div>',
	);
	geo.infoWindow.open({ map: geo.map, anchor: geo.markers[index] });
}

// Runs one search and updates the status text, map and list.
async function runCenterSearch(origin, label) {
	setCentersStatus("Searching for service centers...");
	try {
		geo.centers = await searchServiceCenters(origin);
		renderCenters(origin);
		if (geo.centers.length) {
			setCentersStatus(
				"Nearest to " +
					label +
					": " +
					geo.centers[0].name +
					" (" +
					formatDistance(geo.centers[0].distanceKm) +
					")",
			);
		} else {
			setCentersStatus("No service centers found near " + label + ".", true);
		}
	} catch (err) {
		console.error(err);
		setCentersStatus(
			"Could not load service centers. Make sure 'Places API (New)' is enabled for your key.",
			true,
		);
	}
}

function showUserMarker(location) {
	if (geo.userMarker) geo.userMarker.map = null;
	const dot = document.createElement("div");
	dot.className = "user-dot";
	geo.userMarker = new geo.lib.marker.AdvancedMarkerElement({
		map: geo.map,
		position: location,
		title: "You are here",
		content: dot,
	});
}

// The map is initialized only after the browser returns the user's current location.
async function useMyLocation() {
	setCentersStatus("Getting your location...");
	try {
		geo.userLocation = await getBrowserLocation();
		if (!geo.loaded) await setupMap(geo.userLocation);
		showUserMarker(geo.userLocation);
		geo.map.setCenter(geo.userLocation);
		await runCenterSearch(geo.userLocation, "your location");
	} catch (err) {
		setCentersStatus(
			"Location unavailable: " +
				err.message +
				". Allow location access and try again.",
			true,
		);
	}
}

function searchThisArea() {
	if (!geo.loaded) return;
	const c = geo.map.getCenter();
	runCenterSearch({ lat: c.lat(), lng: c.lng() }, "the map centre");
}

async function initMapSection() {
	if (!hasMapsKey()) {
		setCentersStatus(
			"Add your Google Maps API key to js/appointments.js to enable this section.",
		);
		el.locateBtn.disabled = true;
		el.searchAreaBtn.disabled = true;
		return;
	}
	try {
		setCentersStatus("Loading Google Maps...");
		await loadGoogleMaps();
		await useMyLocation();
	} catch (err) {
		console.error(err);
		setCentersStatus(err.message || "Could not load Google Maps.", true);
	}
}

/* ---------------------------------------------------------
   13. START-UP
   --------------------------------------------------------- */
function init() {
	// Shortcuts to every element we need (the id becomes the property name).
	const ids = [
		"viewBook",
		"viewList",
		"tabBook",
		"tabList",
		"countPill",
		"bookingForm",
		"backBtn",
		"descText",
		"toggleDesc",
		"rescheduleBanner",
		"rescheduleText",
		"cancelReschedule",
		"vehicleSelect",
		"vehicleError",
		"vehicleInfo",
		"infoRegNo",
		"infoModel",
		"noVehicleNotice",
		"serviceType",
		"serviceError",
		"description",
		"tzChip",
		"prevMonth",
		"nextMonth",
		"monthLabel",
		"calendarGrid",
		"slotDateTitle",
		"fmt12",
		"fmt24",
		"slotList",
		"selectionSummary",
		"schedError",
		"formError",
		"bookBtn",
		"filterDate",
		"filterStatus",
		"clearFilters",
		"appointmentBody",
		"seedVehicles",
		"seedAppointments",
		"clearAppointments",
		"centersStatus",
		"locateBtn",
		"searchAreaBtn",
		"mapCanvas",
		"mapPlaceholder",
		"centerList",
		"confirmDialog",
		"confirmBody",
		"detailsDialog",
		"detailsBody",
		"detailsActions",
		"toast",
	];
	ids.forEach(function (id) {
		el[id] = document.getElementById(id);
	});

	el.tzChip.textContent = getTimezoneLabel();

	renderServiceOptions();
	renderVehicleOptions();
	refreshAll();

	// Tabs + header
	el.tabBook.addEventListener("click", function () {
		showView("book");
	});
	el.tabList.addEventListener("click", function () {
		showView("list");
		renderAppointmentTable();
	});
	el.backBtn.addEventListener("click", handleBack);
	el.cancelReschedule.addEventListener("click", exitReschedule);
	el.toggleDesc.addEventListener("click", function () {
		const collapsed = el.descText.classList.toggle("clamp");
		el.toggleDesc.textContent = collapsed ? "+ Show more" : "- Show less";
	});

	// Booking form
	el.bookingForm.addEventListener("submit", handleBookingSubmit);
	el.vehicleSelect.addEventListener("change", function () {
		showVehicleInfo();
		setError(el.vehicleSelect, el.vehicleError, "");
	});
	el.serviceType.addEventListener("change", function () {
		setError(el.serviceType, el.serviceError, "");
	});

	// Calendar + slots
	el.prevMonth.addEventListener("click", function () {
		changeMonth(-1);
	});
	el.nextMonth.addEventListener("click", function () {
		changeMonth(1);
	});
	el.calendarGrid.addEventListener("click", handleCalendarClick);
	el.slotList.addEventListener("click", handleSlotClick);
	el.fmt12.addEventListener("click", function () {
		setTimeFormat(false);
	});
	el.fmt24.addEventListener("click", function () {
		setTimeFormat(true);
	});

	// Filters
	el.filterDate.addEventListener("change", renderAppointmentTable);
	el.filterStatus.addEventListener("change", renderAppointmentTable);
	el.clearFilters.addEventListener("click", function () {
		el.filterDate.value = "";
		el.filterStatus.value = "";
		renderAppointmentTable();
	});

	// Table + dialogs
	el.appointmentBody.addEventListener("click", handleAction);
	el.detailsActions.addEventListener("click", handleAction);
	el.detailsActions.addEventListener("click", handleCloseButtons);
	el.confirmDialog.addEventListener("click", handleCloseButtons);

	// Service centers map
	el.locateBtn.addEventListener("click", useMyLocation);
	el.searchAreaBtn.addEventListener("click", searchThisArea);
	el.centerList.addEventListener("click", function (event) {
		if (event.target.closest("a")) return; // let links open normally
		const item = event.target.closest(".center-item");
		if (item) selectCenter(Number(item.dataset.index), false);
	});
	initMapSection();

	// Demo tools
	el.seedVehicles.addEventListener("click", seedSampleVehicles);
	el.seedAppointments.addEventListener("click", seedSampleAppointments);
	el.clearAppointments.addEventListener("click", clearAllAppointments);

	// If another browser tab (e.g. the vehicle page) changes localStorage, refresh here too.
	window.addEventListener("storage", function (e) {
		if (e.key === STORAGE_KEYS.vehicles) {
			renderVehicleOptions();
			refreshAll();
		}
		if (e.key === STORAGE_KEYS.appointments) {
			refreshAll();
		}
	});
}

document.addEventListener("DOMContentLoaded", init);
