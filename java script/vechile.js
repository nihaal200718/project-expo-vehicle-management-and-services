
// ==================================================
// VEHICLE SERVICE AND MAINTENANCE MANAGEMENT SYSTEM
// MEMBER 2 - VEHICLE MANAGEMENT MODULE
// ==================================================


// 1. GET HTML ELEMENTS

const vehicleForm = document.getElementById("vehicleForm");

const ownerSelect = document.getElementById("ownerId");

const tableBody = document.getElementById("vehicleTableBody");


// 2. GET DATA FROM LOCAL STORAGE

let owners = [];
let vehicles = [];


// Safely read LocalStorage

function loadStorageData() {

    try {

        owners = JSON.parse(localStorage.getItem("owners")) || [];

        vehicles = JSON.parse(localStorage.getItem("vehicles")) || [];

        if (!Array.isArray(owners)) owners = [];

        if (!Array.isArray(vehicles)) vehicles = [];

    } catch (error) {

        console.error("Error reading LocalStorage:", error);

        owners = [];
        vehicles = [];

    }

}


// 3. GET OWNER ID

function getOwnerId(owner) {

    return String(
        owner.ownerId || owner.ownerID || owner.id || ""
    );

}


// 4. GET OWNER NAME

function getOwnerName(owner) {

    return owner.name ||
           owner.ownerName ||
           owner.fullName ||
           "Unknown";

}


// 5. LOAD OWNER IDs INTO DROPDOWN

function loadOwners() {

    loadStorageData();

    ownerSelect.innerHTML = "";

    const defaultOption = document.createElement("option");

    defaultOption.value = "";

    defaultOption.textContent = "Select Owner ID";

    ownerSelect.appendChild(defaultOption);


    const validOwners = owners.filter(function(owner) {

        return getOwnerId(owner) !== "";

    });


    const ownerStatus = document.getElementById("ownerStatus");

    const ownerWarning = document.getElementById("ownerWarning");


    if (validOwners.length === 0) {

        ownerStatus.textContent = "No registered owners found.";

        ownerWarning.hidden = false;

        return;

    }


    validOwners.forEach(function(owner) {

        const option = document.createElement("option");

        option.value = getOwnerId(owner);

        option.textContent =
            getOwnerId(owner) + " - " + getOwnerName(owner);

        ownerSelect.appendChild(option);

    });


    ownerStatus.textContent =
        validOwners.length + " registered owners available.";

    ownerWarning.hidden = true;

    console.log("Owners loaded successfully:", validOwners);

}


// 6. SAVE VEHICLES TO LOCAL STORAGE

function saveVehicles() {

    localStorage.setItem("vehicles", JSON.stringify(vehicles));

}


// 7. GENERATE UNIQUE VEHICLE ID

function generateVehicleId() {

    let highestNumber = 0;

    vehicles.forEach(function(vehicle) {

        const number = parseInt(
            String(vehicle.vehicleId || "").replace(/^V/i, ""),
            10
        );

        if (Number.isFinite(number)) {

            highestNumber = Math.max(highestNumber, number);

        }

    });


    return "V" + String(highestNumber + 1).padStart(3, "0");

}


// 8. GET FORM DATA

function getFormData() {

    const editingId =
        document.getElementById("editingVehicleId").value;


    return {

        vehicleId: editingId || generateVehicleId(),

        ownerId: ownerSelect.value,

        registrationNumber:
            document.getElementById("registrationNumber")
            .value.trim().toUpperCase(),

        vehicleType:
            document.getElementById("vehicleType").value,

        manufacturer:
            document.getElementById("manufacturer").value.trim(),

        model:
            document.getElementById("model").value.trim(),

        fuelType:
            document.getElementById("fuelType").value,

        purchaseDate:
            document.getElementById("purchaseDate").value,

        insuranceExpiry:
            document.getElementById("insuranceExpiry").value,

        pucExpiry:
            document.getElementById("pucExpiry").value,

        lastServiceDate:
            document.getElementById("lastServiceDate").value,

        nextServiceDate:
            document.getElementById("nextServiceDate").value

    };

}


// 9. VALIDATE VEHICLE DETAILS

function validateVehicle(vehicle) {

    loadStorageData();


    // Check mandatory fields

    if (Object.values(vehicle).some(value => !String(value).trim())) {

        alert("Please fill in all mandatory fields.");

        return false;

    }


    // Check whether owner exists

    const ownerExists = owners.some(function(owner) {

        return getOwnerId(owner) === vehicle.ownerId;

    });


    if (!ownerExists) {

        alert("Please select a valid registered Owner ID.");

        return false;

    }


    // Check duplicate registration number

    const duplicate = vehicles.some(function(existing) {

        return (

            existing.registrationNumber.toUpperCase() ===
            vehicle.registrationNumber &&

            existing.vehicleId !== vehicle.vehicleId

        );

    });


    if (duplicate) {

        alert("This vehicle registration number already exists!");

        return false;

    }


    // Validate registration number

    if (!/^[A-Z0-9 -]{4,15}$/.test(vehicle.registrationNumber)) {

        alert("Enter a valid vehicle registration number.");

        return false;

    }


    // Get today's date

    const today = new Date();

    const todayString =
        today.getFullYear() + "-" +
        String(today.getMonth() + 1).padStart(2, "0") + "-" +
        String(today.getDate()).padStart(2, "0");


    // Check date order

    if (vehicle.purchaseDate > todayString) {

        alert("Purchase date cannot be in the future.");

        return false;

    }


    if (vehicle.lastServiceDate < vehicle.purchaseDate) {

        alert("Last service date cannot be before purchase date.");

        return false;

    }


    if (vehicle.nextServiceDate <= vehicle.lastServiceDate) {

        alert("Next service date must be after last service date.");

        return false;

    }


    return true;

}


// 10. REGISTER OR UPDATE VEHICLE

vehicleForm.addEventListener("submit", function(event) {

    event.preventDefault();

    loadStorageData();


    const vehicle = getFormData();

    if (!validateVehicle(vehicle)) {

        return;

    }


    const editingId =
        document.getElementById("editingVehicleId").value;


    if (editingId) {

        // UPDATE VEHICLE

        vehicles = vehicles.map(function(existing) {

            if (existing.vehicleId === editingId) {

                return vehicle;

            }

            return existing;

        });

        alert("Vehicle updated successfully!");

    }

    else {

        // REGISTER NEW VEHICLE

        vehicles.push(vehicle);

        alert("Vehicle registered successfully!");

    }


    saveVehicles();

    vehicleForm.reset();

    resetEditMode();

    displayVehicles();

    updateDashboard();

});


// 11. DISPLAY VEHICLES IN TABLE

function displayVehicles() {

    loadStorageData();

    tableBody.innerHTML = "";


    const searchValue =
        document.getElementById("searchInput").value.toLowerCase().trim();

    const typeValue =
        document.getElementById("typeFilter").value;

    const fuelValue =
        document.getElementById("fuelFilter").value;


    // SEARCH AND FILTER

    const filteredVehicles = vehicles.filter(function(vehicle) {

        const owner = owners.find(function(owner) {

            return getOwnerId(owner) === String(vehicle.ownerId);

        });


        const ownerName = owner ? getOwnerName(owner) : "Unknown";


        const searchText = [

            vehicle.vehicleId,
            vehicle.ownerId,
            ownerName,
            vehicle.registrationNumber,
            vehicle.manufacturer,
            vehicle.model

        ].join(" ").toLowerCase();


        return (

            searchText.includes(searchValue) &&

            (!typeValue || vehicle.vehicleType === typeValue) &&

            (!fuelValue || vehicle.fuelType === fuelValue)

        );

    });


    // DISPLAY EACH VEHICLE

    filteredVehicles.forEach(function(vehicle) {

        const owner = owners.find(function(owner) {

            return getOwnerId(owner) === String(vehicle.ownerId);

        });


        const ownerName = owner ? getOwnerName(owner) : "Unknown";

        const row = document.createElement("tr");


        const values = [

            vehicle.vehicleId,

            ownerName + " (" + vehicle.ownerId + ")",

            vehicle.registrationNumber,

            vehicle.manufacturer + " " + vehicle.model,

            vehicle.fuelType,

            vehicle.insuranceExpiry,

            vehicle.pucExpiry

        ];


        values.forEach(function(value) {

            const cell = document.createElement("td");

            cell.textContent = value;

            row.appendChild(cell);

        });


        // ACTION BUTTONS

        const actionCell = document.createElement("td");

        actionCell.className = "actions";


        const editButton = document.createElement("button");

        editButton.textContent = "Edit";

        editButton.className = "edit-btn";

        editButton.addEventListener("click", function() {

            editVehicle(vehicle.vehicleId);

        });


        const deleteButton = document.createElement("button");

        deleteButton.textContent = "Delete";

        deleteButton.className = "delete-btn";

        deleteButton.addEventListener("click", function() {

            deleteVehicle(vehicle.vehicleId);

        });


        actionCell.append(editButton, deleteButton);

        row.appendChild(actionCell);

        tableBody.appendChild(row);

    });


    document.getElementById("emptyMessage").hidden =
        filteredVehicles.length > 0;

}


// 12. EDIT VEHICLE

function editVehicle(vehicleId) {

    loadStorageData();


    const vehicle = vehicles.find(function(item) {

        return item.vehicleId === vehicleId;

    });


    if (!vehicle) {

        alert("Vehicle not found!");

        return;

    }


    // LOAD OWNER DROPDOWN

    loadOwners();


    // FILL EXISTING DETAILS

    document.getElementById("editingVehicleId").value =
        vehicle.vehicleId;

    ownerSelect.value = vehicle.ownerId;

    document.getElementById("registrationNumber").value =
        vehicle.registrationNumber;

    document.getElementById("vehicleType").value =
        vehicle.vehicleType;

    document.getElementById("manufacturer").value =
        vehicle.manufacturer;

    document.getElementById("model").value =
        vehicle.model;

    document.getElementById("fuelType").value =
        vehicle.fuelType;

    document.getElementById("purchaseDate").value =
        vehicle.purchaseDate;

    document.getElementById("insuranceExpiry").value =
        vehicle.insuranceExpiry;

    document.getElementById("pucExpiry").value =
        vehicle.pucExpiry;

    document.getElementById("lastServiceDate").value =
        vehicle.lastServiceDate;

    document.getElementById("nextServiceDate").value =
        vehicle.nextServiceDate;


    document.getElementById("formTitle").textContent =
        "Update Vehicle Details";

    document.getElementById("saveButton").textContent =
        "Update Vehicle";

    document.getElementById("cancelButton").hidden = false;


    vehicleForm.scrollIntoView({

        behavior: "smooth"

    });

}


// 13. RESET EDIT MODE

function resetEditMode() {

    document.getElementById("editingVehicleId").value = "";

    document.getElementById("formTitle").textContent =
        "Register New Vehicle";

    document.getElementById("saveButton").textContent =
        "+ Register Vehicle";

    document.getElementById("cancelButton").hidden = true;

}


// CANCEL EDITING

document.getElementById("cancelButton").addEventListener(
    "click",
    function() {

        vehicleForm.reset();

        resetEditMode();

    }
);


// 14. DELETE VEHICLE

function deleteVehicle(vehicleId) {

    const confirmation = confirm(
        "Are you sure you want to delete this vehicle?"
    );


    if (!confirmation) {

        return;

    }


    vehicles = vehicles.filter(function(vehicle) {

        return vehicle.vehicleId !== vehicleId;

    });


    saveVehicles();


    if (
        document.getElementById("editingVehicleId").value === vehicleId
    ) {

        vehicleForm.reset();

        resetEditMode();

    }


    displayVehicles();

    updateDashboard();

    alert("Vehicle deleted successfully!");

}


// 15. UPDATE DASHBOARD

function updateDashboard() {

    loadStorageData();


    document.getElementById("totalVehicles").textContent =
        vehicles.length;


    document.getElementById("totalCars").textContent =

        vehicles.filter(function(vehicle) {

            return vehicle.vehicleType === "Car";

        }).length;


    document.getElementById("totalTwoWheelers").textContent =

        vehicles.filter(function(vehicle) {

            return ["Bike", "Scooter"].includes(vehicle.vehicleType);

        }).length;


    document.getElementById("totalOthers").textContent =

        vehicles.filter(function(vehicle) {

            return !["Car", "Bike", "Scooter"].includes(
                vehicle.vehicleType
            );

        }).length;

}


// 16. SEARCH AND FILTER EVENTS

document.getElementById("searchInput").addEventListener(
    "input",
    displayVehicles
);


document.getElementById("typeFilter").addEventListener(
    "change",
    displayVehicles
);


document.getElementById("fuelFilter").addEventListener(
    "change",
    displayVehicles
);


// 17. RESET FORM

vehicleForm.addEventListener("reset", function() {

    resetEditMode();

});


// 18. INITIALIZE APPLICATION

function initializeVehicleModule() {

    loadStorageData();

    loadOwners();

    displayVehicles();

    updateDashboard();

    console.log("Vehicle Management Module Loaded Successfully!");

}


// RUN AFTER HTML IS READY

if (document.readyState === "loading") {

    document.addEventListener(
        "DOMContentLoaded",
        initializeVehicleModule
    );

} else {

    initializeVehicleModule();

}
