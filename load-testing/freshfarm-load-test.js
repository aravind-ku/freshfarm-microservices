import http from "k6/http";
import { check, sleep } from "k6";
import { Rate } from "k6/metrics";

const errorRate = new Rate("errors");

export const options = {
  stages: [
    // Warm-up
    {
      duration: "30s",
      target: 5,
    },

    // Increase to 20 users
    {
      duration: "1m",
      target: 20,
    },

    // Hold 20 concurrent users
    {
      duration: "2m",
      target: 20,
    },

    // Increase to 50 users
    {
      duration: "1m",
      target: 50,
    },

    // Hold 50 users
    {
      duration: "2m",
      target: 50,
    },

    // Cool down
    {
      duration: "30s",
      target: 0,
    },
  ],

  thresholds: {
    http_req_failed: ["rate<0.05"],

    http_req_duration: ["p(95)<1000"],

    errors: ["rate<0.05"],
  },
};

const USER_SERVICE = "http://localhost:5000";

const ORDER_SERVICE = "http://localhost:5001";

const NOTIFICATION_SERVICE = "http://localhost:5003";

// IMPORTANT:
// Use an existing TEST ACCOUNT.
// Do not use a real customer's credentials.

const TEST_EMAIL = __ENV.TEST_EMAIL;

const TEST_PASSWORD = __ENV.TEST_PASSWORD;

export function setup() {
  if (!TEST_EMAIL || !TEST_PASSWORD) {
    throw new Error("TEST_EMAIL and TEST_PASSWORD must be provided");
  }
}

export default function () {
  // =====================================
  // LOGIN
  // =====================================

  const loginPayload = JSON.stringify({
    email: TEST_EMAIL,

    password: TEST_PASSWORD,
  });

  const loginResponse = http.post(
    `${USER_SERVICE}/login`,

    loginPayload,

    {
      headers: {
        "Content-Type": "application/json",
      },
    },
  );

  const loginSuccess = check(
    loginResponse,

    {
      "login returns 200": (response) => response.status === 200,

      "login contains token": (response) => {
        try {
          const body = response.json();

          return !!body.token;
        } catch {
          return false;
        }
      },
    },
  );

  errorRate.add(!loginSuccess);

  if (!loginSuccess) {
    sleep(1);

    return;
  }

  const token = loginResponse.json().token;

  const authHeaders = {
    headers: {
      Authorization: `Bearer ${token}`,

      "Content-Type": "application/json",
    },
  };

  sleep(1);

  // =====================================
  // PROFILE
  // =====================================

  const profileResponse = http.get(
    `${USER_SERVICE}/profile`,

    authHeaders,
  );

  const profileSuccess = check(
    profileResponse,

    {
      "profile returns 200": (response) => response.status === 200,
    },
  );

  errorRate.add(!profileSuccess);

  sleep(1);

  // =====================================
  // ORDER HISTORY
  // =====================================

  const orderHistoryResponse = http.get(
    `${ORDER_SERVICE}/orders`,

    authHeaders,
  );

  const historySuccess = check(
    orderHistoryResponse,

    {
      "order history returns 200": (response) => response.status === 200,
    },
  );

  errorRate.add(!historySuccess);

  sleep(1);

  // =====================================
  // NOTIFICATIONS
  // =====================================

  const notificationResponse = http.get(
    `${NOTIFICATION_SERVICE}/notifications`,

    authHeaders,
  );

  const notificationSuccess = check(
    notificationResponse,

    {
      "notifications return 200": (response) => response.status === 200,
    },
  );

  errorRate.add(!notificationSuccess);

  sleep(Math.random() * 3 + 1);
}
