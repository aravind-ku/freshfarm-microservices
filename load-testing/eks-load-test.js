import http from "k6/http";
import { check, sleep } from "k6";
import { Rate } from "k6/metrics";

const errors = new Rate("errors");

const BASE_URL = "https://freshfarm.vizagit.space";

const TEST_EMAIL = __ENV.TEST_EMAIL;
const TEST_PASSWORD = __ENV.TEST_PASSWORD;

export const options = {
  stages: [
    // Warm up
    { duration: "1m", target: 20 },

    // Normal load
    { duration: "2m", target: 50 },

    // Higher load
    { duration: "2m", target: 100 },

    // Stress HPA
    { duration: "3m", target: 200 },

    // Hold peak traffic
    { duration: "2m", target: 200 },

    // Cool down
    { duration: "1m", target: 0 },
  ],

  thresholds: {
    http_req_failed: ["rate<0.05"],
    http_req_duration: ["p(95)<1000"],
    errors: ["rate<0.05"],
  },
};

export function setup() {
  if (!TEST_EMAIL || !TEST_PASSWORD) {
    throw new Error(
      "TEST_EMAIL and TEST_PASSWORD environment variables are required",
    );
  }
}

export default function () {
  // ===================================
  // LOGIN
  // ===================================

  const loginResponse = http.post(
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

  const loginPassed = check(loginResponse, {
    "login 200": (r) => r.status === 200,
    "token returned": (r) => {
      try {
        return !!r.json("token");
      } catch {
        return false;
      }
    },
  });

  errors.add(!loginPassed);

  if (!loginPassed) {
    sleep(1);
    return;
  }

  const token = loginResponse.json("token");

  const headers = {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  };

  // ===================================
  // PROFILE
  // ===================================

  const profileResponse = http.get(`${BASE_URL}/api/user/profile`, headers);

  const profilePassed = check(profileResponse, {
    "profile 200": (r) => r.status === 200,
  });

  errors.add(!profilePassed);

  sleep(Math.random() * 2 + 1);

  // ===================================
  // ORDER HISTORY
  // ===================================

  const ordersResponse = http.get(`${BASE_URL}/api/orders/orders`, headers);

  const ordersPassed = check(ordersResponse, {
    "orders 200": (r) => r.status === 200,
  });

  errors.add(!ordersPassed);

  sleep(Math.random() * 2 + 1);

  // ===================================
  // NOTIFICATIONS
  // ===================================

  const notificationResponse = http.get(
    `${BASE_URL}/api/notifications/notifications`,
    headers,
  );

  const notificationsPassed = check(notificationResponse, {
    "notifications 200": (r) => r.status === 200,
  });

  errors.add(!notificationsPassed);

  // Human-like wait
  sleep(Math.random() * 3 + 1);
}
