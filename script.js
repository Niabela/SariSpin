
const SUPABASE_URL = "https://lpvxbiofludgvnwidzik.supabase.co";
const SUPABASE_KEY = "sb_publishable_ha6VbkFzDoNqJNsp_6gB2g_SfCNe8sm";

const db = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);

const BUSINESS_PHONE = "0966 210 8254";

// ==================================================
// GENERAL HELPER FUNCTIONS
// ==================================================

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, function (character) {
        const entities = {
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;"
        };

        return entities[character];
    });
}

function formatDate(dateValue) {
    if (!dateValue) {
        return "Not specified";
    }

    const date = new Date(dateValue + "T00:00:00");

    if (Number.isNaN(date.getTime())) {
        return escapeHTML(dateValue);
    }

    return date.toLocaleDateString("en-PH", {
        month: "long",
        day: "numeric",
        year: "numeric"
    });
}

function formatDateTime(dateValue) {
    if (!dateValue) {
        return "Not specified";
    }

    const date = new Date(dateValue);

    if (Number.isNaN(date.getTime())) {
        return "Not specified";
    }

    return date.toLocaleString("en-PH", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit"
    });
}

function getLocalDate() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
}

function serviceName(serviceType) {
    return serviceType === "pickup"
        ? "Pickup and Delivery"
        : "Drop-off and Self-Collection";
}

// ==================================================
// CUSTOMER BOOKING FORM
// ==================================================

function setupBookingForm() {
    const bookingForm = document.getElementById("bookingForm");

    if (!bookingForm) {
        return;
    }

    const customerNameInput = document.getElementById("customerName");
    const customerPhoneInput = document.getElementById("customerPhone");
    const serviceTypeInput = document.getElementById("serviceType");
    const addressGroup = document.getElementById("addressGroup");
    const customerAddressInput = document.getElementById("customerAddress");
    const preferredDateInput = document.getElementById("preferredDate");
    const customerNotesInput = document.getElementById("customerNotes");
    const customerConsentInput = document.getElementById("customerConsent");
    const formMessage = document.getElementById("formMessage");

    const submitButton = bookingForm.querySelector(
        'button[type="submit"]'
    );

    // Do not allow a requested date in the past.
    if (preferredDateInput) {
        preferredDateInput.min = getLocalDate();
    }

    function showFormMessage(message, type) {
        if (!formMessage) {
            return;
        }

        formMessage.textContent = message;
        formMessage.className = `form-message ${type}`;
        formMessage.hidden = false;
    }

    function updateAddressField() {
        if (!serviceTypeInput || !addressGroup || !customerAddressInput) {
            return;
        }

        const needsAddress = serviceTypeInput.value === "pickup";

        addressGroup.hidden = !needsAddress;
        customerAddressInput.required = needsAddress;

        if (!needsAddress) {
            customerAddressInput.value = "";
        }
    }

    if (serviceTypeInput) {
        serviceTypeInput.addEventListener("change", function () {
            updateAddressField();

            if (formMessage) {
                formMessage.hidden = true;
            }
        });
    }

    updateAddressField();

    bookingForm.addEventListener("submit", async function (event) {
        event.preventDefault();

        if (formMessage) {
            formMessage.hidden = true;
        }

        const customerName = customerNameInput.value.trim();
        const customerPhone = customerPhoneInput.value.trim();
        const selectedService = serviceTypeInput.value;
        const address = customerAddressInput.value.trim();
        const requestedDate = preferredDateInput.value;
        const notes = customerNotesInput
            ? customerNotesInput.value.trim()
            : "";

        if (!customerName || !customerPhone || !requestedDate) {
            showFormMessage(
                "Please complete all required fields.",
                "error"
            );
            return;
        }

        if (!["pickup", "dropoff"].includes(selectedService)) {
            showFormMessage(
                "Please select a valid laundry service.",
                "error"
            );
            return;
        }

        if (selectedService === "pickup" && !address) {
            showFormMessage(
                "Please enter your pickup and delivery address.",
                "error"
            );
            return;
        }

        if (requestedDate < getLocalDate()) {
            showFormMessage(
                "Please select today or a future preferred date.",
                "error"
            );
            return;
        }

        if (
            customerConsentInput &&
            !customerConsentInput.checked
        ) {
            showFormMessage(
                "Please confirm the privacy notice before submitting.",
                "error"
            );
            return;
        }

        if (submitButton) {
            submitButton.disabled = true;
            submitButton.textContent = "Submitting...";
        }

        try {
            const { error } = await db
                .from("laundry_requests")
                .insert({
                    customer_name: customerName,
                    customer_phone: customerPhone,
                    service_type: selectedService,
                    customer_address:
                        selectedService === "pickup" ? address : null,
                    preferred_date: requestedDate,
                    customer_notes: notes || null,
                    status: "new"
                });

            if (error) {
                console.error("Supabase booking error:", error);

                showFormMessage(
                    "Your request could not be submitted. Please try again or call/text SariSpin at " +
                    BUSINESS_PHONE + ".",
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
        } catch (error) {
            console.error("Booking submission error:", error);

            showFormMessage(
                "Something went wrong. Please try again or call/text SariSpin at " +
                BUSINESS_PHONE + ".",
                "error"
            );
        } finally {
            if (submitButton) {
                submitButton.disabled = false;
                submitButton.textContent = "Submit Request";
            }
        }
    });
}

// ==================================================
// OWNER DASHBOARD
// ==================================================

function setupAdminDashboard() {
    const requestList = document.getElementById("requestList");

    // Do not run dashboard code on the customer page.
    if (!requestList) {
        return;
    }

    const completedList = document.getElementById("completedList");
    const newCount = document.getElementById("newCount");
    const completedCount = document.getElementById("completedCount");
    const adminMessage = document.getElementById("adminMessage");
    const refreshButton = document.getElementById("refreshRequests");

    function showAdminMessage(message, type = "") {
        if (!adminMessage) {
            return;
        }

        adminMessage.textContent = message;
        adminMessage.className = `admin-message ${type}`;
    }

    function renderRequestCard(request, isCompleted) {
        const service = serviceName(request.service_type);

        const addressHTML = request.customer_address
            ? `<p><strong>Address:</strong> ${escapeHTML(request.customer_address)}</p>`
            : "";

        const notesHTML = request.customer_notes
            ? `<p><strong>Notes:</strong> ${escapeHTML(request.customer_notes)}</p>`
            : "";

        const completeButton = isCompleted
            ? ""
            : `<button type="button" class="complete-button" data-action="complete" data-id="${request.id}">Mark as Completed</button>`;

        const completedAtHTML = isCompleted && request.completed_at
            ? `<p><strong>Completed:</strong> ${escapeHTML(formatDateTime(request.completed_at))}</p>`
            : "";

        return `
            <article class="request-card">
                <div class="request-card-header">
                    <h3>${escapeHTML(request.customer_name)}</h3>
                    <span class="request-status ${isCompleted ? "completed" : "new"}">
                        ${isCompleted ? "Completed" : "New Request"}
                    </span>
                </div>

                <div class="request-details">
                    <p><strong>Phone:</strong> ${escapeHTML(request.customer_phone)}</p>
                    <p><strong>Service:</strong> ${escapeHTML(service)}</p>
                    <p><strong>Preferred date:</strong> ${escapeHTML(formatDate(request.preferred_date))}</p>
                    ${addressHTML}
                    ${notesHTML}
                    <p><strong>Request received:</strong> ${escapeHTML(formatDateTime(request.created_at))}</p>
                    ${completedAtHTML}
                </div>

                <div class="request-actions">
                    ${completeButton}
                    <button type="button" class="delete-button" data-action="delete" data-id="${request.id}">Delete Request</button>
                </div>
            </article>
        `;
    }

    function renderEmptyMessage(message) {
        return `<p class="empty-state">${escapeHTML(message)}</p>`;
    }

    async function renderDashboard() {
        showAdminMessage("Loading requests...");

        if (refreshButton) {
            refreshButton.disabled = true;
        }

        try {
            const { data, error } = await db
                .from("laundry_requests")
                .select("*")
                .order("created_at", { ascending: false });

            if (error) {
                console.error("Dashboard loading error:", error);

                showAdminMessage(
                    "Could not load requests. Please check your connection and refresh.",
                    "error"
                );

                requestList.innerHTML = renderEmptyMessage(
                    "Requests could not be loaded."
                );

                if (completedList) {
                    completedList.innerHTML = "";
                }

                return;
            }

            const requests = data || [];

            const incomingRequests = requests.filter(function (request) {
                return request.status === "new";
            });

            const completedRequests = requests.filter(function (request) {
                return request.status === "completed";
            });

            const today = getLocalDate();

            const completedToday = completedRequests.filter(function (request) {
                if (!request.completed_at) {
                    return false;
                }

                const completedDate = new Date(request.completed_at);

                if (Number.isNaN(completedDate.getTime())) {
                    return false;
                }

                const localCompletedDate =
                    completedDate.getFullYear() + "-" +
                    String(completedDate.getMonth() + 1).padStart(2, "0") + "-" +
                    String(completedDate.getDate()).padStart(2, "0");

                return localCompletedDate === today;
            });

            if (newCount) {
                newCount.textContent = incomingRequests.length;
            }

            if (completedCount) {
                completedCount.textContent = completedToday.length;
            }

            requestList.innerHTML = incomingRequests.length
                ? incomingRequests.map(function (request) {
                    return renderRequestCard(request, false);
                }).join("")
                : renderEmptyMessage("There are no new laundry requests.");

            if (completedList) {
                completedList.innerHTML = completedRequests.length
                    ? completedRequests.map(function (request) {
                        return renderRequestCard(request, true);
                    }).join("")
                    : renderEmptyMessage("No completed requests yet.");
            }

            showAdminMessage(
                `Requests loaded successfully. ${incomingRequests.length} new and ${completedRequests.length} completed.`
            );
        } catch (error) {
            console.error("Dashboard error:", error);

            showAdminMessage(
                "An unexpected error occurred while loading requests.",
                "error"
            );
        } finally {
            if (refreshButton) {
                refreshButton.disabled = false;
            }
        }
    }

    // Handle both buttons using one delegated event listener.
    async function handleRequestAction(event) {
        const button = event.target.closest("button[data-action]");

        if (!button) {
            return;
        }

        const action = button.dataset.action;
        const requestId = button.dataset.id;

        if (!requestId) {
            return;
        }

        if (action === "delete") {
            const confirmed = window.confirm(
                "Are you sure you want to delete this laundry request? This cannot be undone."
            );

            if (!confirmed) {
                return;
            }
        }

        const originalText = button.textContent;
        button.disabled = true;
        button.textContent = action === "complete"
            ? "Updating..."
            : "Deleting...";

        try {
            let result;

            if (action === "complete") {
                result = await db
                    .from("laundry_requests")
                    .update({
                        status: "completed",
                        completed_at: new Date().toISOString()
                    })
                    .eq("id", requestId);
            } else if (action === "delete") {
                result = await db
                    .from("laundry_requests")
                    .delete()
                    .eq("id", requestId);
            } else {
                return;
            }

            if (result.error) {
                console.error("Request action error:", result.error);

                showAdminMessage(
                    "The request could not be updated. Please try again.",
                    "error"
                );

                button.disabled = false;
                button.textContent = originalText;
                return;
            }

            showAdminMessage(
                action === "complete"
                    ? "Request marked as completed."
                    : "Request deleted successfully."
            );

            await renderDashboard();
        } catch (error) {
            console.error("Request action error:", error);

            showAdminMessage(
                "Something went wrong. Please try again.",
                "error"
            );

            button.disabled = false;
            button.textContent = originalText;
        }
    }

    requestList.addEventListener("click", handleRequestAction);

    if (completedList) {
        completedList.addEventListener("click", handleRequestAction);
    }

    if (refreshButton) {
        refreshButton.addEventListener("click", renderDashboard);
    }

    renderDashboard();
}

// ==================================================
// START THE CORRECT PAGE FEATURES
// ==================================================

document.addEventListener("DOMContentLoaded", function () {
    setupBookingForm();
    setupAdminDashboard();
});
