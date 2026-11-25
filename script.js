
const ownerForm = document.getElementById("ownerForm");
const ownerTableBody = document.getElementById("ownerTableBody");
const searchInput = document.getElementById("searchInput");

let owners = JSON.parse(localStorage.getItem("owners")) || [];

// Generate unique Owner ID
function generateOwnerId() {
    let maxId = 0;

    owners.forEach(owner => {
        const number = Number(owner.ownerId.replace("O", ""));

        if (Number.isInteger(number) && number > maxId) {
            maxId = number;
        }
    });

    return "O" + String(maxId + 1).padStart(3, "0");
}

// Save owners in LocalStorage
function saveOwners() {
    localStorage.setItem("owners", JSON.stringify(owners));
}

// Display owners
function displayOwners(list = owners) {
    ownerTableBody.innerHTML = "";

    if (list.length === 0) {
        ownerTableBody.innerHTML =
            `<tr><td colspan="6">No owners found.</td></tr>`;
        return;
    }

    list.forEach(owner => {
        const row = document.createElement("tr");

        [
            owner.ownerId,
            owner.name,
            owner.mobile,
            owner.email,
            owner.address
        ].forEach(value => {
            const cell = document.createElement("td");
            cell.textContent = value;
            row.appendChild(cell);
        });

        const actionCell = document.createElement("td");

        const viewBtn = document.createElement("button");
        viewBtn.textContent = "View";
        viewBtn.className = "view-btn";
        viewBtn.onclick = () => viewOwner(owner.ownerId);

        const editBtn = document.createElement("button");
        editBtn.textContent = "Edit";
        editBtn.className = "edit-btn";
        editBtn.onclick = () => editOwner(owner.ownerId);

        const deleteBtn = document.createElement("button");
        deleteBtn.textContent = "Delete";
        deleteBtn.className = "delete-btn";
        deleteBtn.onclick = () => deleteOwner(owner.ownerId);

        actionCell.append(viewBtn, editBtn, deleteBtn);
        row.appendChild(actionCell);

        ownerTableBody.appendChild(row);
    });
}

// Register or update owner
ownerForm.addEventListener("submit", function(event) {
    event.preventDefault();

    const editId = document.getElementById("editOwnerId").value;

    const name = document.getElementById("name").value.trim();
    const mobile = document.getElementById("mobile").value.trim();
    const email = document.getElementById("email").value.trim();
    const address = document.getElementById("address").value.trim();

    // Mandatory validation
    if (!name || !mobile || !email || !address) {
        alert("Please fill in all fields.");
        return;
    }

    // Indian mobile validation
    if (!/^[6-9]\d{9}$/.test(mobile)) {
        alert("Enter a valid 10-digit Indian mobile number.");
        return;
    }

    // Email validation
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        alert("Enter a valid email address.");
        return;
    }

    // Duplicate mobile and email validation
    const duplicate = owners.find(owner =>
        owner.ownerId !== editId &&
        (owner.mobile === mobile ||
         owner.email.toLowerCase() === email.toLowerCase())
    );

    if (duplicate) {
        alert("Mobile number or email already exists.");
        return;
    }

    if (editId) {
        const index = owners.findIndex(owner =>
            owner.ownerId === editId
        );

        if (index !== -1) {
            owners[index] = {
                ownerId: editId,
                name,
                mobile,
                email,
                address
            };
        }

        alert("Owner details updated successfully!");
    } else {
        const newOwner = {
            ownerId: generateOwnerId(),
            name,
            mobile,
            email,
            address
        };

        owners.push(newOwner);

        alert("Owner registered successfully! ID: " +
            newOwner.ownerId);
    }

    saveOwners();
    displayOwners();
    ownerForm.reset();
    document.getElementById("editOwnerId").value = "";
    document.getElementById("submitBtn").textContent = "Register Owner";
});

// Search owners
searchInput.addEventListener("input", function() {
    const searchValue = this.value.toLowerCase().trim();

    const filteredOwners = owners.filter(owner =>
        owner.name.toLowerCase().includes(searchValue) ||
        owner.ownerId.toLowerCase().includes(searchValue) ||
        owner.mobile.includes(searchValue)
    );

    displayOwners(filteredOwners);
});

// Edit owner
function editOwner(ownerId) {
    const owner = owners.find(o => o.ownerId === ownerId);

    if (!owner) return;

    document.getElementById("editOwnerId").value = owner.ownerId;
    document.getElementById("name").value = owner.name;
    document.getElementById("mobile").value = owner.mobile;
    document.getElementById("email").value = owner.email;
    document.getElementById("address").value = owner.address;

    document.getElementById("submitBtn").textContent = "Update Owner";

    document.getElementById("profileSection").hidden = true;

    window.scrollTo({ top: 0, behavior: "smooth" });
}

// Delete owner
function deleteOwner(ownerId) {
    const confirmDelete = confirm(
        "Are you sure you want to delete this owner?"
    );

    if (!confirmDelete) return;

    owners = owners.filter(owner => owner.ownerId !== ownerId);

    saveOwners();
    displayOwners();

    document.getElementById("profileSection").hidden = true;

    alert("Owner deleted successfully!");
}

// View individual owner profile
function viewOwner(ownerId) {
    const owner = owners.find(o => o.ownerId === ownerId);

    if (!owner) return;

    const profileDetails = document.getElementById("profileDetails");
    profileDetails.replaceChildren();

    const details = [
        ["Owner ID", owner.ownerId],
        ["Name", owner.name],
        ["Mobile", owner.mobile],
        ["Email", owner.email],
        ["Address", owner.address]
    ];

    details.forEach(([label, value]) => {
        const paragraph = document.createElement("p");
        const strong = document.createElement("strong");

        strong.textContent = label + ": ";
        paragraph.append(strong, document.createTextNode(value));

        profileDetails.appendChild(paragraph);
    });

    document.getElementById("profileSection").hidden = false;

    document.getElementById("profileSection").scrollIntoView({
        behavior: "smooth"
    });
}

// Close profile
document.getElementById("closeProfile").addEventListener("click", function() {
    document.getElementById("profileSection").hidden = true;
});

// Initial display
displayOwners();

