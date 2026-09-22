// ========================================
// API BASE URL CONFIGURATION
// ========================================

const IS_LOCAL_FILE = window.location.protocol === "file:";

const API = {
  user: IS_LOCAL_FILE ? "http://localhost:5000" : "/api/user",

  orders: IS_LOCAL_FILE ? "http://localhost:5001" : "/api/orders",

  payments: IS_LOCAL_FILE ? "http://localhost:5002" : "/api/payments",

  notifications: IS_LOCAL_FILE ? "http://localhost:5003" : "/api/notifications",

  dairy: IS_LOCAL_FILE ? "http://localhost:5004" : "/api/dairy",
};

let selectedDairyProduct = null;

// ========================================
// PAGE NAVIGATION
// ========================================

function hideAllSections() {
  const sections = document.querySelectorAll("section");

  sections.forEach((section) => {
    section.classList.add("hidden");
  });
}

function showSection(sectionId) {
  hideAllSections();

  const homeSection = document.getElementById("home-section");

  if (homeSection) {
    homeSection.classList.add("hidden");
  }

  const selectedSection = document.getElementById(sectionId);

  if (!selectedSection) {
    console.error("Section not found:", sectionId);

    return;
  }

  selectedSection.classList.remove("hidden");

  window.scrollTo({
    top: 0,
    behavior: "smooth",
  });
}

function showHome() {
  hideAllSections();

  const homeSection = document.getElementById("home-section");

  if (homeSection) {
    homeSection.classList.remove("hidden");
  }

  window.scrollTo({
    top: 0,
    behavior: "smooth",
  });
}

// ========================================
// SIGN UP
// ========================================

document
  .getElementById("signupForm")
  .addEventListener("submit", async function (e) {
    e.preventDefault();

    const name = document.getElementById("signupName").value;

    const email = document.getElementById("signupEmail").value;

    const password = document.getElementById("signupPassword").value;

    try {
      const response = await fetch(`${API.user}/register`, {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          name,
          email,
          password,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        alert(data.message);

        this.reset();

        showSection("login-section");
      } else {
        alert("Registration failed: " + data.message);
      }
    } catch (error) {
      console.error("Registration Error:", error);

      alert("Unable to connect to User Service");
    }
  });

// ========================================
// LOGIN
// ========================================

document
  .getElementById("loginForm")
  .addEventListener("submit", async function (e) {
    e.preventDefault();

    const email = document.getElementById("loginEmail").value;

    const password = document.getElementById("loginPassword").value;

    try {
      const response = await fetch(`${API.user}/login`, {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          email,
          password,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        localStorage.setItem("token", data.token);

        await updateNotificationCount();

        alert(data.message);

        this.reset();

        showHome();
      } else {
        alert("Login failed: " + data.message);
      }
    } catch (error) {
      console.error("Login Error:", error);

      alert("Unable to connect to User Service");
    }
  });

// ========================================
// PLACE ORDER
// ========================================

document
  .getElementById("orderForm")
  .addEventListener("submit", async function (e) {
    e.preventDefault();

    const token = localStorage.getItem("token");

    if (!token) {
      alert("Please login before placing an order");

      return;
    }

    const order = {
      customerName: document.getElementById("customerName").value,

      phone: document.getElementById("phone").value,

      address: document.getElementById("address").value,

      milkType: selectedDairyProduct
        ? selectedDairyProduct.name
        : document.getElementById("milkType").value,

      quantity: document.getElementById("quantity").value,

      productType: selectedDairyProduct ? "DAIRY" : "MILK",

      productId: selectedDairyProduct ? selectedDairyProduct.id : null,
    };

    try {
      const response = await fetch(`${API.orders}/orders`, {
        method: "POST",

        headers: {
          "Content-Type": "application/json",

          Authorization: `Bearer ${token}`,
        },

        body: JSON.stringify(order),
      });

      const data = await response.json();

      if (response.ok) {
        alert(
          `${data.message}\n\n` +
            `Order ID: ${data.orderId}\n` +
            `Product: ${data.product}\n` +
            `Quantity: ${data.quantity}\n` +
            `Unit Price: ₹${data.unitPrice}\n` +
            `Total: ₹${data.totalAmount}`,
        );

        this.reset();
        selectedDairyProduct = null;

        const dairyOption = document.getElementById("dairyProductOption");

        if (dairyOption) {
          dairyOption.remove();
        }

        await updateNotificationCount();

        getOrderHistory();
      } else {
        alert("Order failed: " + data.message);
      }
    } catch (error) {
      console.error("Order Error:", error);

      alert("Unable to connect to Order Service");
    }
  });

// ========================================
// PROFILE
// ========================================

async function getProfile() {
  const token = localStorage.getItem("token");

  if (!token) {
    alert("Please login first");

    return;
  }

  try {
    const response = await fetch(`${API.user}/profile`, {
      method: "GET",

      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      alert(data.message);

      return;
    }

    showSection("profile-section");

    document.getElementById("profileId").textContent = data.user.id;

    document.getElementById("profileName").textContent = data.user.name;

    document.getElementById("profileNameHeading").textContent = data.user.name;

    document.getElementById("profileInitial").textContent = data.user.name
      .charAt(0)
      .toUpperCase();

    document.getElementById("profileEmail").textContent = data.user.email;

    document.getElementById("profileCreated").textContent = new Date(
      data.user.created_at,
    ).toLocaleString();
  } catch (error) {
    console.error("Profile Error:", error);

    alert("Unable to connect to User Service");
  }
}

// ========================================
// ORDER HISTORY
// ========================================

async function getOrderHistory() {
  const token = localStorage.getItem("token");

  if (!token) {
    alert("Please login first");

    return;
  }

  try {
    const response = await fetch(`${API.orders}/orders`, {
      method: "GET",

      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      alert("Unable to fetch orders: " + data.message);

      return;
    }

    showSection("history-section");

    const orderList = document.getElementById("orderList");

    orderList.innerHTML = "";

    if (!data.orders || data.orders.length === 0) {
      orderList.innerHTML = "<p>No orders found.</p>";

      return;
    }

    data.orders.forEach((order) => {
      const card = document.createElement("div");

      card.classList.add("order-card");

      let statusClass = "status-pending";

      if (order.status === "PAID") {
        statusClass = "status-paid";
      }

      if (order.status === "CANCELLED") {
        statusClass = "status-cancelled";
      }

      if (order.status === "DELIVERED") {
        statusClass = "status-delivered";
      }

      const isDairy = order.product_type === "DAIRY";

      const productLabel = isDairy ? "Product" : "Milk Type";

      const quantityText = isDairy
        ? `${order.quantity} × 500g`
        : `${order.quantity} ${Number(order.quantity) === 1 ? "Litre" : "Litres"}`;

      const unitPrice =
        order.unit_price !== null && order.unit_price !== undefined
          ? Number(order.unit_price).toFixed(2)
          : "0.00";

      const totalAmount =
        order.total_amount !== null && order.total_amount !== undefined
          ? Number(order.total_amount).toFixed(2)
          : "0.00";

      card.innerHTML = `
    <div class="order-top">

      <span class="order-id">
        Order #${order.id}
      </span>

      <span class="status-badge ${statusClass}">
        ${order.status}
      </span>

    </div>

    <div class="order-details">

      <div class="order-row">

        <span class="order-label">
          ${productLabel}
        </span>

        <span class="order-value">
          ${order.milk_type}
        </span>

      </div>

      ${
        isDairy
          ? `
            <div class="order-row">

              <span class="order-label">
                Category
              </span>

              <span class="order-value">
                Dairy Product
              </span>

            </div>
          `
          : ""
      }

      <div class="order-row">

        <span class="order-label">
          Quantity
        </span>

        <span class="order-value">
          ${quantityText}
        </span>

      </div>

      <div class="order-row">

        <span class="order-label">
          Unit Price
        </span>

        <span class="order-value">
          ₹${unitPrice}
        </span>

      </div>

      <div class="order-row">

        <span class="order-label">
          Total Amount
        </span>

        <span class="order-value">
          <strong>₹${totalAmount}</strong>
        </span>

      </div>

      <div class="order-row">

        <span class="order-label">
          Delivery Address
        </span>

        <span class="order-value">
          ${order.address}
        </span>

      </div>

      <div class="order-row">

        <span class="order-label">
          Ordered On
        </span>

        <span class="order-value">
          ${new Date(order.created_at).toLocaleString()}
        </span>

      </div>

    </div>

    <div class="order-actions">

      ${
        order.status === "PAYMENT_PENDING"
          ? `
            <button
              class="pay-btn"
              onclick="payNow(${order.id})"
            >
              Pay Now
            </button>
          `
          : ""
      }

      ${
        order.status !== "CANCELLED" && order.status !== "DELIVERED"
          ? `
            <button
              class="cancel-btn"
              onclick="cancelOrder(${order.id})"
            >
              Cancel Order
            </button>
          `
          : ""
      }

    </div>
  `;

      orderList.appendChild(card);
    });
  } catch (error) {
    console.error("Order History Error:", error);

    alert("Order History Error: " + error.message);
  }
}

// ========================================
// CANCEL ORDER
// ========================================

async function cancelOrder(orderId) {
  const token = localStorage.getItem("token");

  if (!token) {
    alert("Please login first");

    return;
  }

  const confirmCancel = confirm("Are you sure you want to cancel this order?");

  if (!confirmCancel) {
    return;
  }

  try {
    const response = await fetch(`${API.orders}/orders/${orderId}`, {
      method: "DELETE",

      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await response.json();

    if (response.ok) {
      alert(data.message);

      await updateNotificationCount();

      getOrderHistory();
    } else {
      alert("Cancel failed: " + data.message);
    }
  } catch (error) {
    console.error("Cancel Order Error:", error);

    alert("Unable to connect to Order Service");
  }
}

// ========================================
// RAZORPAY PAYMENT
// ========================================

async function payNow(orderId) {
  const token = localStorage.getItem("token");

  if (!token) {
    alert("Please login first");

    return;
  }

  try {
    const response = await fetch(`${API.payments}/create-payment-order`, {
      method: "POST",

      headers: {
        "Content-Type": "application/json",

        Authorization: `Bearer ${token}`,
      },

      body: JSON.stringify({
        orderId,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      alert(data.message);

      return;
    }

    const options = {
      key: data.keyId,

      amount: data.amount,

      currency: data.currency,

      name: "Fresh Farm Milk",

      description: `Payment for Order ${orderId}`,

      order_id: data.razorpayOrderId,

      handler: async function (paymentResponse) {
        try {
          const verifyResponse = await fetch(`${API.payments}/verify-payment`, {
            method: "POST",

            headers: {
              "Content-Type": "application/json",

              Authorization: `Bearer ${token}`,
            },

            body: JSON.stringify({
              razorpay_order_id: paymentResponse.razorpay_order_id,

              razorpay_payment_id: paymentResponse.razorpay_payment_id,

              razorpay_signature: paymentResponse.razorpay_signature,

              orderId,
            }),
          });

          const verifyData = await verifyResponse.json();

          if (verifyResponse.ok) {
            alert("Payment successful and verified");

            await updateNotificationCount();

            getOrderHistory();
          } else {
            alert("Payment verification failed: " + verifyData.message);
          }
        } catch (error) {
          console.error("Verification Error:", error);

          alert("Unable to verify payment");
        }
      },

      theme: {
        color: "#43A047",
      },
    };

    const razorpay = new Razorpay(options);

    razorpay.open();
  } catch (error) {
    console.error("Payment Error:", error);

    alert("Unable to connect to Payment Service");
  }
}

// ========================================
// PAYMENT HISTORY
// ========================================

async function getPaymentHistory() {
  const token = localStorage.getItem("token");

  if (!token) {
    alert("Please login first");

    return;
  }

  try {
    const response = await fetch(`${API.payments}/payments`, {
      method: "GET",

      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      alert("Unable to fetch payment history: " + data.message);

      return;
    }

    showSection("payment-history-section");

    const paymentList = document.getElementById("paymentList");

    paymentList.innerHTML = "";

    if (!data.payments || data.payments.length === 0) {
      paymentList.innerHTML = "<p>No payment records found.</p>";

      return;
    }

    data.payments.forEach((payment) => {
      const card = document.createElement("div");

      card.classList.add("order-card");

      card.innerHTML = `

          <div class="order-top">

            <span class="order-id">
              Payment #${payment.id}
            </span>

            <span
              class="status-badge status-paid"
            >
              ${payment.status}
            </span>

          </div>


          <div class="order-details">

            <div class="order-row">

              <span class="order-label">
                Order ID
              </span>

              <span class="order-value">
                #${payment.order_id}
              </span>

            </div>


            <div class="order-row">

              <span class="order-label">
                Amount
              </span>

              <span class="order-value">
                ₹${payment.amount}
              </span>

            </div>


            <div class="order-row">

              <span class="order-label">
                Currency
              </span>

              <span class="order-value">
                ${payment.currency}
              </span>

            </div>


            <div class="order-row">

              <span class="order-label">
                Razorpay Payment ID
              </span>

              <span class="order-value">
                ${payment.razorpay_payment_id}
              </span>

            </div>


            <div class="order-row">

              <span class="order-label">
                Paid On
              </span>

              <span class="order-value">

                ${new Date(payment.created_at).toLocaleString()}

              </span>

            </div>

          </div>
        `;

      paymentList.appendChild(card);
    });
  } catch (error) {
    console.error("Payment History Error:", error);

    alert("Payment History Error: " + error.message);
  }
}

// ========================================
// NOTIFICATIONS
// ========================================

async function getNotifications() {
  const token = localStorage.getItem("token");

  if (!token) {
    alert("Please login first");

    return;
  }

  try {
    const response = await fetch(`${API.notifications}/notifications`, {
      method: "GET",

      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      alert("Unable to fetch notifications: " + data.message);

      return;
    }

    showSection("notifications-section");

    const notificationList = document.getElementById("notificationList");

    notificationList.innerHTML = "";

    if (!data.notifications || data.notifications.length === 0) {
      notificationList.innerHTML = "<p>No notifications available.</p>";

      updateNotificationCount();

      return;
    }

    data.notifications.forEach((notification) => {
      const card = document.createElement("div");

      card.classList.add("notification-card");

      let icon = "🔔";

      if (notification.type === "ORDER_PLACED") {
        icon = "📦";
      }

      if (notification.type === "PAYMENT_SUCCESS") {
        icon = "✓";
      }

      if (notification.type === "ORDER_CANCELLED") {
        icon = "✕";
      }

      card.innerHTML = `

          <div class="notification-icon">
            ${icon}
          </div>


          <div class="notification-content">

            <div class="notification-top">

              <strong>
                ${formatNotificationType(notification.type)}
              </strong>

              <span
                class="notification-status"
              >
                ${notification.status}
              </span>

            </div>


            <p>
              ${notification.message}
            </p>


            <div class="notification-meta">

              <span>

                ${
                  notification.order_id ? `Order #${notification.order_id}` : ""
                }

              </span>


              <span>

                ${new Date(notification.created_at).toLocaleString()}

              </span>

            </div>


            ${
              notification.status === "UNREAD"
                ? `
                  <button
                    class="mark-read-btn"
                    onclick="markNotificationRead(
                      ${notification.id}
                    )"
                  >
                    Mark as Read
                  </button>
                `
                : ""
            }

          </div>
        `;

      notificationList.appendChild(card);
    });

    updateNotificationCount();
  } catch (error) {
    console.error("Notification Error:", error);

    alert("Notification Error: " + error.message);
  }
}

// ========================================
// FORMAT NOTIFICATION TYPE
// ========================================

function formatNotificationType(type) {
  if (type === "ORDER_PLACED") {
    return "Order Placed";
  }

  if (type === "PAYMENT_SUCCESS") {
    return "Payment Successful";
  }

  if (type === "ORDER_CANCELLED") {
    return "Order Cancelled";
  }

  return "Notification";
}

// ========================================
// MARK NOTIFICATION AS READ
// ========================================

async function markNotificationRead(notificationId) {
  const token = localStorage.getItem("token");

  if (!token) {
    alert("Please login first");

    return;
  }

  try {
    const response = await fetch(
      `${API.notifications}/notifications/${notificationId}/read`,
      {
        method: "PATCH",

        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );

    const data = await response.json();

    if (!response.ok) {
      alert("Unable to update notification: " + data.message);

      return;
    }

    await getNotifications();

    await updateNotificationCount();
  } catch (error) {
    console.error("Mark Read Error:", error);

    alert("Unable to connect to Notification Service");
  }
}

// ========================================
// NOTIFICATION COUNT
// ========================================

async function updateNotificationCount() {
  const countElement = document.getElementById("notificationCount");

  if (!countElement) {
    return;
  }

  const token = localStorage.getItem("token");

  if (!token) {
    countElement.textContent = "0";

    return;
  }

  try {
    const response = await fetch(`${API.notifications}/notifications`, {
      method: "GET",

      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      return;
    }

    const unreadCount = data.notifications.filter(
      (notification) => notification.status === "UNREAD",
    ).length;

    countElement.textContent = unreadCount;
  } catch (error) {
    console.error("Notification Count Error:", error);
  }
}

// ========================================
// BACKGROUND IMAGE ROTATOR
// ========================================

const farmBackgroundImages = [
  "images/farm1.jpg",

  "images/farm2.jpg",

  "images/farm3.jpg",

  "images/farm4.jpg",
];

let currentFarmImage = 0;

function rotateFarmBackground() {
  const homeSection = document.getElementById("home-section");

  if (!homeSection) {
    return;
  }

  currentFarmImage = (currentFarmImage + 1) % farmBackgroundImages.length;

  homeSection.style.backgroundImage = `

      linear-gradient(
        rgba(245,251,246,0.78),
        rgba(245,251,246,0.84)
      ),

      url(
        "${farmBackgroundImages[currentFarmImage]}"
      )

    `;
}

setInterval(rotateFarmBackground, 5000);

// ========================================
// PAGE LOAD
// ========================================

document.addEventListener("DOMContentLoaded", () => {
  showHome();

  updateNotificationCount();

  const dairyProductsNav = document.getElementById("dairyProductsNav");

  if (dairyProductsNav) {
    dairyProductsNav.addEventListener("click", async (event) => {
      event.preventDefault();

      await showDairyProducts();
    });
  }
});

async function showDairyProducts() {
  showSection("dairy-products-section");
  await loadDairyProducts();
}

async function loadDairyProducts() {
  const container = document.getElementById("dairy-products-container");

  if (!container) {
    console.error("Dairy products container not found");
    return;
  }

  container.innerHTML = `
    <div class="products-loading">
      Loading fresh dairy products...
    </div>
  `;

  try {
    const response = await fetch(`${API.dairy}/products`);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const products = await response.json();

    container.innerHTML = "";

    products.forEach((product, index) => {
      const card = document.createElement("div");

      card.className = "product-card";

      card.style.animationDelay = `${index * 0.08}s`;

      const imagePath = getDairyProductImage(product.name);

      card.innerHTML = `
        <div class="product-image-wrapper">
          <img
            src="${imagePath}"
            alt="${product.name}"
            class="product-image"
            onerror="this.style.display='none'; this.parentElement.classList.add('image-fallback');"
          >
        </div>

        <div class="product-content">

          <h3>${product.name}</h3>

          <p class="product-category">
            <strong>Category:</strong>
            ${product.category}
          </p>

          <p class="product-description">
            ${product.description}
          </p>

          <div class="product-price">
            ₹${product.price}
            <span>/ ${product.unit}</span>
          </div>

          <div class="product-status">
            ${
              product.available
                ? `<span class="available">Available</span>`
                : `<span class="unavailable">Out of Stock</span>`
            }
          </div>

          ${
            product.available
              ? `
                <button
                  class="dairy-order-btn"
                  onclick="orderDairyProduct(
                    ${product.id},
                    '${product.name.replace(/'/g, "\\'")}',
                    ${product.price}
                  )"
                >
                  <span class="cart-icon">🛒</span>
                  Order Now
                </button>
              `
              : `
                <button class="dairy-order-btn disabled" disabled>
                  Out of Stock
                </button>
              `
          }

        </div>
      `;

      container.appendChild(card);
    });
  } catch (error) {
    console.error("Dairy Products Error:", error);

    container.innerHTML = `
      <div class="products-error">
        Unable to load dairy products.
        Please make sure the Go service is running.
      </div>
    `;
  }
}

function getDairyProductImage(productName) {
  const imageMap = {
    "Fresh Paneer": "images/products/paneer.png",
    "Fresh Curd": "images/products/curd.PNG",
    "Pure Ghee": "images/products/ghee.PNG",
    "Fresh Butter": "images/products/butter.PNG",
    "Milk Peda": "images/products/peda.PNG",
    "Kalakand": "images/products/kalakand.PNG",
    "Rasgulla": "images/products/rasgulla.PNG",
    "Gulab Jamun": "images/products/gulab-jamun.PNG",
    "Milk Cake": "images/products/milk-cake.PNG",
    "Khoa": "images/products/khoa.PNG",
  };

  return imageMap[productName] || "images/products/default-product.png";
}

function orderDairyProduct(id, name, price) {
  const token = localStorage.getItem("token");

  if (!token) {
    alert("Please login before ordering dairy products");
    showSection("login-section");
    return;
  }

  selectedDairyProduct = {
    id: Number(id),
    name,
    price: Number(price),
  };

  const orderForm = document.getElementById("orderForm");

  if (!orderForm) {
    alert("Order form not found");
    return;
  }

  const orderSection = orderForm.closest("section");

  if (orderSection) {
    showSection(orderSection.id);
  }

  const milkTypeSelect = document.getElementById("milkType");

  if (milkTypeSelect) {
    let dairyOption = document.getElementById("dairyProductOption");

    if (!dairyOption) {
      dairyOption = document.createElement("option");
      dairyOption.id = "dairyProductOption";
      milkTypeSelect.appendChild(dairyOption);
    }

    dairyOption.value = name;
    dairyOption.textContent = `${name} - ₹${price}`;

    dairyOption.selected = true;
  }

  alert(
    `${name} selected.\n\n` +
      `Price: ₹${price}\n` +
      `Enter quantity and delivery details to continue.`,
  );
}
