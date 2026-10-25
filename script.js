const STORAGE_KEY = "sarispinRequests";


const SUPABASE_URL = "https://lpvxbiofludgvnwidzik.supabase.co";
const SUPABASE_KEY = "sb_publishable_ha6VbkFzDoNqJNsp_6gB2g_SfCNe8sm";

const db = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);

// GENERAL HELPERS

function getRequests() {
    try {
        const savedRequests = localStorage.getItem(STORAGE_KEY);

        if (!savedRequests) {
            return [];
        }

        const parsedRequests = JSON.parse(savedRequests);

        return Array.isArray(parsedRequests) ? parsedRequests : [];
    } catch (error) {
        console.error("Could not load laundry requests:", error);
        return [];
    }
}

function saveRequests(requests) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(requests));
        return true;
    } catch (error) {
        console.error("Could not save laundry requests:", error);
        return false;
    }
}

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, function (character) {
        const replacements = {
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#039;"
        };

        return replacements[character];
    });
}

function serviceName(service) {
    if (service === "pickup") {
        return "Pickup and Delivery";
    }

    if (service === "dropoff") {
        return "Drop-off and Self-Collection";
    }

    return "Unspecified Service";
}

function getLocalDate() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
}

function formatDate(dateString) {
    if (!dateString) {
        return "Not provided";
    }

    const date = new Date(`${dateString}T12:00:00`);

    if (Number.isNaN(date.getTime())) {
        return dateString;
    }

    return date.toLocaleDateString("en-PH", {
        year: "numeric",
        month: "long",
        day: "numeric"
    });
}

function formatDateTime(dateString) {
    if (!dateString) {
        return "Not recorded";
    }

    const date = new Date(dateString);

    if (Number.isNaN(date.getTime())) {
        return "Not recorded";
    }

    return date.toLocaleString("en-PH", {
        dateStyle: "medium",
        timeStyle: "short"
    });
}

// CUSTOMER BOOKING FORM

function setupBookingForm() {
    const bookingForm = document.getElementById("bookingForm");

    if (!bookingForm) {
        return;
    }

    const serviceType = document.getElementById("serviceType");
    const addressGroup = document.getElementById("addressGroup");
    const customerAddress = document.getElementById("customerAddress");
    const preferredDate = document.getElementById("preferredDate");
    const formMessage = document.getElementById("formMessage");

    preferredDate.min = getLocalDate();

    function updateAddressField() {
        const pickupSelected = serviceType.value === "pickup";

        addressGroup.hidden = !pickupSelected;
        customerAddress.required = pickupSelected;

        if (!pickupSelected) {
            customerAddress.value = "";
        }
    }

    serviceType.addEventListener("change", updateAddressField);
    updateAddressField();

    bookingForm.addEventListener("submit", function (event) {
        event.preventDefault();

        formMessage.textContent = "";
        formMessage.className = "form-message";

        const customerName = document
            .getElementById("customerName")
            .value.trim();

        const customerPhone = document
            .getElementById("customerPhone")
            .value.trim();

        const selectedService = serviceType.value;
        const address = customerAddress.value.trim();
        const requestedDate = preferredDate.value;

        const notes = document
            .getElementById("customerNotes")
            .value.trim();

        const consent = document.getElementById("customerConsent").checked;

        if (
            !customerName ||
            !customerPhone ||
            !selectedService ||
            !requestedDate ||
            !consent
        ) {
            showFormMessage(
                "Please complete all required fields and confirm your information.",
                "error"
            );
            return;
        }

        if (selectedService === "pickup" && !address) {
            showFormMessage(
                "Please enter your address for pickup and delivery.",
                "error"
            );
            return;
        }

        if (requestedDate < getLocalDate()) {
            showFormMessage(
                "Please choose today or a future date.",
                "error"
            );
            return;
        }

        const requestId =
            Date.now().toString() +
            Math.random().toString(36).slice(2, 8);

        const newRequest = {
            id: requestId,
            name: customerName,
            phone: customerPhone,
            service: selectedService,
            preferredDate: requestedDate,
            address: selectedService === "pickup" ? address : "",
            notes: notes,
            status: "New Request",
            createdAt: new Date().toISOString(),
            completedAt: null
        };

        const requests = getRequests();

        requests.unshift(newRequest);

        if (!saveRequests(requests)) {
            showFormMessage(
                "Your request could not be saved. Please call or text SariSpin at 0966 210 8254.",
                "error"
            );
            return;
        }

        bookingForm.reset();
        updateAddressField();

        showFormMessage(
            "Your request has been submitted successfully! SariSpin will contact you to confirm your preferred date.",
            "success"
        );
    });

    function showFormMessage(message, type) {
        formMessage.textContent = message;
        formMessage.className = `form-message ${type}`;
    }
}

// OWNER DASHBOARD

function setupAdminDashboard() {
    const requestList = document.getElementById("requestList");

    if (!requestList) {
        return;
    }

    const completedList = document.getElementById("completedList");
    const newCount = document.getElementById("newCount");
    const completedCount = document.getElementById("completedCount");
    const adminMessage = document.getElementById("adminMessage");
    const refreshButton = document.getElementById("refreshRequests");

    function getDateFromTimestamp(timestamp) {
        const date = new Date(timestamp);

        if (Number.isNaN(date.getTime())) {
            return "";
        }

        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");

        return `${year}-${month}-${day}`;
    }

    function renderDashboard() {
        const requests = getRequests();
        const today = getLocalDate();

        const incomingRequests = requests.filter(function (request) {
            return request.status !== "Completed";
        });

        const completedToday = requests.filter(function (request) {
            return (
                request.status === "Completed" &&
                request.completedAt &&
                getDateFromTimestamp(request.completedAt) === today
            );
        });

        newCount.textContent = incomingRequests.length;
        completedCount.textContent = completedToday.length;

        renderIncomingRequests(incomingRequests);
        renderCompletedRequests(completedToday);
    }

    // INCOMING REQUESTS

    function renderIncomingRequests(requests) {
        if (requests.length === 0) {
            requestList.innerHTML = `
                <p class="empty-state">No incoming requests yet.</p>
            `;
            return;
        }

        requestList.innerHTML = requests.map(function (request) {
            const safeId = escapeHTML(request.id);
            const safeName = escapeHTML(request.name);
            const safePhone = escapeHTML(request.phone);
            const safeService = escapeHTML(serviceName(request.service));
            const safeDate = escapeHTML(formatDate(request.preferredDate));
            const safeAddress = escapeHTML(
                request.address || "Not applicable"
            );
            const safeNotes = escapeHTML(
                request.notes || "No additional notes"
            );
            const safeCreated = escapeHTML(
                formatDateTime(request.createdAt)
            );

            return `
                <article class="request-card">
                    <h3>${safeName}</h3>
                    <p class="request-date">
                        Submitted: ${safeCreated}
                    </p>

                    <div class="request-details">
                        <div class="request-detail">
                            <strong>Mobile number</strong>
                            <span>${safePhone}</span>
                        </div>

                        <div class="request-detail">
                            <strong>Service</strong>
                            <span>${safeService}</span>
                        </div>

                        <div class="request-detail">
                            <strong>Preferred date</strong>
                            <span>${safeDate}</span>
                        </div>

                        <div class="request-detail">
                            <strong>Address</strong>
                            <span>${safeAddress}</span>
                        </div>

                        <div class="request-detail">
                            <strong>Additional notes</strong>
                            <span>${safeNotes}</span>
                        </div>
                    </div>

                    <div class="request-actions">
                        <button
                            type="button"
                            class="button button-primary"
                            data-complete-id="${safeId}"
                        >
                            Mark as Completed
                        </button>

                        <button
                            type="button"
                            class="button button-secondary"
                            data-delete-id="${safeId}"
                        >
                            Delete Request
                        </button>
                    </div>
                </article>
            `;
        }).join("");
    }

    // COMPLETED REQUESTS

    function renderCompletedRequests(requests) {
        if (requests.length === 0) {
            completedList.innerHTML = `
                <p class="empty-state">
                    No requests marked as completed today.
                </p>
            `;
            return;
        }

        completedList.innerHTML = requests.map(function (request) {
            const safeId = escapeHTML(request.id);
            const safeName = escapeHTML(request.name);
            const safePhone = escapeHTML(request.phone);
            const safeService = escapeHTML(serviceName(request.service));
            const safeDate = escapeHTML(formatDate(request.preferredDate));
            const safeCompleted = escapeHTML(
                formatDateTime(request.completedAt)
            );

            return `
                <article class="request-card">
                    <h3>${safeName}</h3>
                    <p class="request-date">
                        Completed: ${safeCompleted}
                    </p>

                    <div class="request-details">
                        <div class="request-detail">
                            <strong>Mobile number</strong>
                            <span>${safePhone}</span>
                        </div>

                        <div class="request-detail">
                            <strong>Service</strong>
                            <span>${safeService}</span>
                        </div>

                        <div class="request-detail">
                            <strong>Preferred date</strong>
                            <span>${safeDate}</span>
                        </div>
                    </div>

                    <div class="request-actions">
                        <span class="completed-badge">Completed</span>

                        <button
                            type="button"
                            class="button button-secondary"
                            data-delete-id="${safeId}"
                        >
                            Delete Request
                        </button>
                    </div>
                </article>
            `;
        }).join("");
    }

    // MARK REQUEST AS COMPLETED

    requestList.addEventListener("click", function (event) {
        const button = event.target.closest("[data-complete-id]");

        if (!button) {
            return;
        }

        const requestId = button.dataset.completeId;
        const requests = getRequests();

        const request = requests.find(function (item) {
            return String(item.id) === String(requestId);
        });

        if (!request) {
            adminMessage.textContent =
                "The request could not be found. Please refresh the dashboard.";
            return;
        }

        const confirmed = window.confirm(
            `Mark the laundry request for ${request.name} as completed?`
        );

        if (!confirmed) {
            return;
        }

        request.status = "Completed";
        request.completedAt = new Date().toISOString();

        if (!saveRequests(requests)) {
            adminMessage.textContent =
                "The change could not be saved. Please try again.";
            return;
        }

        adminMessage.textContent = "Request marked as completed.";
        renderDashboard();
    });

    // DELETE REQUEST FROM EITHER SECTION

    function handleDeleteRequest(event) {
        const button = event.target.closest("[data-delete-id]");

        if (!button) {
            return;
        }

        const requestId = button.dataset.deleteId;
        const requests = getRequests();

        const request = requests.find(function (item) {
            return String(item.id) === String(requestId);
        });

        if (!request) {
            adminMessage.textContent =
                "The request could not be found. Please refresh the dashboard.";
            return;
        }

        const confirmed = window.confirm(
            `Are you sure you want to permanently delete the request for ${request.name}? This action cannot be undone.`
        );

        if (!confirmed) {
            return;
        }

        const updatedRequests = requests.filter(function (item) {
            return String(item.id) !== String(requestId);
        });

        if (!saveRequests(updatedRequests)) {
            adminMessage.textContent =
                "The request could not be deleted. Please try again.";
            return;
        }

        adminMessage.textContent =
            `The request for ${request.name} has been deleted.`;

        renderDashboard();
    }

    requestList.addEventListener("click", handleDeleteRequest);
    completedList.addEventListener("click", handleDeleteRequest);

    // REFRESH DASHBOARD

    refreshButton.addEventListener("click", function () {
        adminMessage.textContent = "Dashboard refreshed.";
        renderDashboard();
    });

    renderDashboard();
}

// START PAGE FEATURES

document.addEventListener("DOMContentLoaded", function () {
    setupBookingForm();
    setupAdminDashboard();
});
