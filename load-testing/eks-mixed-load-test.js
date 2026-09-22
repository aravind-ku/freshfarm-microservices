import http from "k6/http";
import { check, sleep } from "k6";
import { Rate } from "k6/metrics";

const errors = new Rate("errors");

const BASE_URL = "https://freshfarm.vizagit.space";

const TEST_EMAIL = __ENV.TEST_EMAIL;
const TEST_PASSWORD = __ENV.TEST_PASSWORD;

export const options = {
  scenarios: {
    read_users: {
      executor: "constant-vus",
      vus: 70,
      duration: "8m",
      exec: "readScenario",
    },

    order_users: {
      executor: "constant-vus",
      vus: 20,
      duration: "8m",
      exec: "createOrderScenario",
    },

    cancel_users: {
      executor: "constant-vus",
      vus: 10,
      duration: "8m",
      exec: "cancelOrderScenario",
    },
  },

  thresholds: {
    http_req_failed: ["rate<0.05"],
    http_req_duration: ["p(95)<1000"],
    errors: ["rate<0.05"],
  },
};

function login() {
  const response = http.post(
    `${BASE_URL}/api/user/login`,
    JSON.stringify({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
    }),
    {
      headers: {
        "Content-Type": "application/json",
      },
      tags: {
        endpoint: "login",
      },
    },
  );

  const passed = check(response, {
    "login status 200": (r) => r.status === 200,
    "login token returned": (r) => {
      try {
        return !!r.json("token");
      } catch {
        return false;
      }
    },
  });

  errors.add(!passed);

  if (!passed) {
    return null;
  }

  return response.json("token");
}

function authHeaders(token) {
  return {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  };
}

// ========================================
// 70 VUs - READ SCENARIO
// ========================================

export function readScenario() {
  const token = login();

  if (!token) {
    sleep(1);
    return;
  }

  const headers = authHeaders(token);

  const profile = http.get(`${BASE_URL}/api/user/profile`, headers);

  check(profile, {
    "profile status 200": (r) => r.status === 200,
  });

  sleep(1);

  const orders = http.get(`${BASE_URL}/api/orders/orders`, headers);

  check(orders, {
    "order history status 200": (r) => r.status === 200,
  });

  sleep(1);

  const notifications = http.get(
    `${BASE_URL}/api/notifications/notifications`,
    headers,
  );

  check(notifications, {
    "notifications status 200": (r) => r.status === 200,
  });

  sleep(Math.random() * 3 + 1);
}

// ========================================
// 20 VUs - CREATE ORDER SCENARIO
// ========================================

export function createOrderScenario() {
  const token = login();

  if (!token) {
    sleep(1);
    return;
  }

  const headers = authHeaders(token);

  const orderPayload = JSON.stringify({
    customerName: "K6 EKS Load Test",
    phone: "9999999999",
    address: "K6 AWS EKS Load Test Address",
    milkType: "Cow Milk",
    quantity: 1,
  });

  const createResponse = http.post(
    `${BASE_URL}/api/orders/orders`,
    orderPayload,
    headers,
  );

  const created = check(createResponse, {
    "create order status 201": (r) => r.status === 201,
    "order id returned": (r) => {
      try {
        return !!r.json("orderId");
      } catch {
        return false;
      }
    },
  });

  errors.add(!created);

  if (!created) {
    sleep(1);
    return;
  }

  sleep(1);

  const history = http.get(`${BASE_URL}/api/orders/orders`, headers);

  check(history, {
    "history after create 200": (r) => r.status === 200,
  });

  sleep(1);

  const notifications = http.get(
    `${BASE_URL}/api/notifications/notifications`,
    headers,
  );

  check(notifications, {
    "notification after order 200": (r) => r.status === 200,
  });

  sleep(Math.random() * 2 + 1);
}

// ========================================
// 10 VUs - CREATE + CANCEL SCENARIO
// ========================================

export function cancelOrderScenario() {
  const token = login();

  if (!token) {
    sleep(1);
    return;
  }

  const headers = authHeaders(token);

  const orderPayload = JSON.stringify({
    customerName: "K6 EKS Cancel Test",
    phone: "9999999999",
    address: "K6 AWS EKS Cancel Test Address",
    milkType: "Buffalo Milk",
    quantity: 1,
  });

  const createResponse = http.post(
    `${BASE_URL}/api/orders/orders`,
    orderPayload,
    headers,
  );

  const created = check(createResponse, {
    "cancel test order created": (r) => r.status === 201,
  });

  errors.add(!created);

  if (!created) {
    sleep(1);
    return;
  }

  let orderId;

  try {
    orderId = createResponse.json("orderId");
  } catch {
    errors.add(true);
    return;
  }

  sleep(1);

  const cancelResponse = http.del(
    `${BASE_URL}/api/orders/orders/${orderId}`,
    null,
    headers,
  );

  const cancelled = check(cancelResponse, {
    "cancel order status 200": (r) => r.status === 200,
  });

  errors.add(!cancelled);

  sleep(1);

  const notifications = http.get(
    `${BASE_URL}/api/notifications/notifications`,
    headers,
  );

  check(notifications, {
    "notifications after cancel 200": (r) => r.status === 200,
  });

  sleep(Math.random() * 2 + 1);
}
