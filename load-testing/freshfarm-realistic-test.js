import http from "k6/http";
import { check, sleep } from "k6";
import { Rate } from "k6/metrics";

// ========================================
// CUSTOM METRICS
// ========================================

const errors = new Rate("errors");

// ========================================
// SERVICE URLS
// ========================================

const USER_SERVICE = "http://localhost:5000";

const ORDER_SERVICE = "http://localhost:5001";

const NOTIFICATION_SERVICE = "http://localhost:5003";

// ========================================
// TEST USER
// ========================================

const TEST_EMAIL = __ENV.TEST_EMAIL;

const TEST_PASSWORD = __ENV.TEST_PASSWORD;

// ========================================
// LOAD TEST CONFIGURATION
// ========================================

export const options = {
  scenarios: {
    // ------------------------------------
    // 80% READ USERS
    // ------------------------------------

    read_users: {
      executor: "constant-vus",

      exec: "readScenario",

      vus: 40,

      duration: "3m",
    },

    // ------------------------------------
    // ORDER CREATION USERS
    // ------------------------------------

    order_users: {
      executor: "constant-vus",

      exec: "createOrderScenario",

      vus: 8,

      duration: "3m",
    },

    // ------------------------------------
    // ORDER CANCELLATION USERS
    // ------------------------------------

    cancel_users: {
      executor: "constant-vus",

      exec: "cancelOrderScenario",

      vus: 2,

      duration: "3m",
    },
  },

  thresholds: {
    http_req_failed: ["rate<0.05"],

    http_req_duration: ["p(95)<1000"],

    errors: ["rate<0.05"],
  },
};

// ========================================
// SETUP
// ========================================

export function setup() {
  if (!TEST_EMAIL || !TEST_PASSWORD) {
    throw new Error("TEST_EMAIL and TEST_PASSWORD must be provided");
  }
}

// ========================================
// LOGIN HELPER
// ========================================

function login() {
  const payload = JSON.stringify({
    email: TEST_EMAIL,

    password: TEST_PASSWORD,
  });

  const response = http.post(
    `${USER_SERVICE}/login`,

    payload,

    {
      headers: {
        "Content-Type": "application/json",
      },

      tags: {
        endpoint: "login",
      },
    },
  );

  const success = check(
    response,

    {
      "login status 200": (r) => r.status === 200,

      "login token returned": (r) => {
        try {
          return r.json("token") !== undefined;
        } catch {
          return false;
        }
      },
    },
  );

  errors.add(!success);

  if (!success) {
    return null;
  }

  return response.json("token");
}

// ========================================
// AUTH HEADERS
// ========================================

function authHeaders(token) {
  return {
    headers: {
      "Content-Type": "application/json",

      Authorization: `Bearer ${token}`,
    },
  };
}

// ========================================
// READ SCENARIO
// ========================================

export function readScenario() {
  const token = login();

  if (!token) {
    sleep(1);

    return;
  }

  const headers = authHeaders(token);

  // ------------------------------------
  // PROFILE
  // ------------------------------------

  const profileResponse = http.get(
    `${USER_SERVICE}/profile`,

    {
      ...headers,

      tags: {
        endpoint: "profile",
      },
    },
  );

  const profileSuccess = check(
    profileResponse,

    {
      "profile status 200": (r) => r.status === 200,
    },
  );

  errors.add(!profileSuccess);

  sleep(randomThinkTime());

  // ------------------------------------
  // ORDER HISTORY
  // ------------------------------------

  const ordersResponse = http.get(
    `${ORDER_SERVICE}/orders`,

    {
      ...headers,

      tags: {
        endpoint: "order-history",
      },
    },
  );

  const ordersSuccess = check(
    ordersResponse,

    {
      "order history status 200": (r) => r.status === 200,
    },
  );

  errors.add(!ordersSuccess);

  sleep(randomThinkTime());

  // ------------------------------------
  // NOTIFICATIONS
  // ------------------------------------

  const notificationsResponse = http.get(
    `${NOTIFICATION_SERVICE}/notifications`,

    {
      ...headers,

      tags: {
        endpoint: "notifications",
      },
    },
  );

  const notificationSuccess = check(
    notificationsResponse,

    {
      "notifications status 200": (r) => r.status === 200,
    },
  );

  errors.add(!notificationSuccess);

  sleep(randomThinkTime());
}

// ========================================
// CREATE ORDER SCENARIO
// ========================================

export function createOrderScenario() {
  const token = login();

  if (!token) {
    sleep(1);

    return;
  }

  const uniqueNumber = `${__VU}-${__ITER}-${Date.now()}`;

  const orderPayload = JSON.stringify({
    customerName: `K6 Load Test ${uniqueNumber}`,

    phone: "9999999999",

    address: "K6 Load Testing Address",

    milkType: "Cow Milk",

    quantity: 1,
  });

  const response = http.post(
    `${ORDER_SERVICE}/orders`,

    orderPayload,

    {
      headers: {
        "Content-Type": "application/json",

        Authorization: `Bearer ${token}`,
      },

      tags: {
        endpoint: "create-order",
      },
    },
  );

  const success = check(
    response,

    {
      "create order status 201": (r) => r.status === 201,

      "order id returned": (r) => {
        try {
          return r.json("orderId") !== undefined;
        } catch {
          return false;
        }
      },
    },
  );

  errors.add(!success);

  sleep(randomThinkTime());

  // ------------------------------------
  // READ ORDER HISTORY AFTER CREATE
  // ------------------------------------

  const historyResponse = http.get(
    `${ORDER_SERVICE}/orders`,

    {
      headers: {
        Authorization: `Bearer ${token}`,
      },

      tags: {
        endpoint: "history-after-create",
      },
    },
  );

  const historySuccess = check(
    historyResponse,

    {
      "history after create 200": (r) => r.status === 200,
    },
  );

  errors.add(!historySuccess);

  sleep(randomThinkTime());
}

// ========================================
// CREATE + CANCEL SCENARIO
// ========================================

export function cancelOrderScenario() {
  const token = login();

  if (!token) {
    sleep(1);

    return;
  }

  const uniqueNumber = `${__VU}-${__ITER}-${Date.now()}`;

  // ------------------------------------
  // CREATE ORDER FIRST
  // ------------------------------------

  const payload = JSON.stringify({
    customerName: `K6 Load Test Cancel ${uniqueNumber}`,

    phone: "9999999999",

    address: "K6 Cancellation Test Address",

    milkType: "Cow Milk",

    quantity: 1,
  });

  const createResponse = http.post(
    `${ORDER_SERVICE}/orders`,

    payload,

    {
      headers: {
        "Content-Type": "application/json",

        Authorization: `Bearer ${token}`,
      },

      tags: {
        endpoint: "create-before-cancel",
      },
    },
  );

  const createSuccess = check(
    createResponse,

    {
      "cancel test order created": (r) => r.status === 201,
    },
  );

  errors.add(!createSuccess);

  if (!createSuccess) {
    sleep(1);

    return;
  }

  const orderId = createResponse.json("orderId");

  sleep(randomThinkTime());

  // ------------------------------------
  // CANCEL THAT SAME ORDER
  // ------------------------------------

  const cancelResponse = http.del(
    `${ORDER_SERVICE}/orders/${orderId}`,

    null,

    {
      headers: {
        Authorization: `Bearer ${token}`,
      },

      tags: {
        endpoint: "cancel-order",
      },
    },
  );

  const cancelSuccess = check(
    cancelResponse,

    {
      "cancel order status 200": (r) => r.status === 200,
    },
  );

  errors.add(!cancelSuccess);

  sleep(randomThinkTime());

  // ------------------------------------
  // CHECK NOTIFICATIONS
  // ------------------------------------

  const notificationResponse = http.get(
    `${NOTIFICATION_SERVICE}/notifications`,

    {
      headers: {
        Authorization: `Bearer ${token}`,
      },

      tags: {
        endpoint: "notification-after-cancel",
      },
    },
  );

  const notificationSuccess = check(
    notificationResponse,

    {
      "notifications after cancel 200": (r) => r.status === 200,
    },
  );

  errors.add(!notificationSuccess);

  sleep(randomThinkTime());
}

// ========================================
// HUMAN-LIKE THINK TIME
// ========================================

function randomThinkTime() {
  return Math.random() * 2 + 1;
}
