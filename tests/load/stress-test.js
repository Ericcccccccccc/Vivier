import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

const errorRate = new Rate('errors');

// Stress test configuration
export const options = {
  stages: [
    { duration: '2m', target: 100 },  // Below normal load
    { duration: '5m', target: 200 },  // Normal load
    { duration: '2m', target: 300 },  // Around breaking point
    { duration: '5m', target: 400 },  // Beyond breaking point
    { duration: '2m', target: 500 },  // Peak stress
    { duration: '10m', target: 0 },   // Recovery
  ],
  thresholds: {
    http_req_duration: ['p(99)<10000'], // 99% of requests under 10s
    errors: ['rate<0.5'],                // Error rate under 50%
  }
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

export default function () {
  // Simple health check endpoint for stress testing
  const res = http.get(`${BASE_URL}/api/health`, {
    tags: { name: 'health_check' }
  });

  const success = check(res, {
    'status is 200': (r) => r.status === 200,
    'response time < 5s': (r) => r.timings.duration < 5000
  });

  errorRate.add(!success);

  // Very short sleep to maximize stress
  sleep(0.1);
}

// Spike test configuration (separate export)
export const spikeOptions = {
  stages: [
    { duration: '10s', target: 100 },   // Warm up
    { duration: '1m', target: 100 },    // Stay at 100
    { duration: '10s', target: 1000 },  // Spike to 1000
    { duration: '3m', target: 1000 },   // Stay at 1000
    { duration: '10s', target: 100 },   // Scale down
    { duration: '3m', target: 100 },    // Continue at 100
    { duration: '10s', target: 0 },     // Ramp down
  ]
};

// Soak test configuration (separate export)
export const soakOptions = {
  stages: [
    { duration: '5m', target: 200 },   // Ramp up
    { duration: '4h', target: 200 },   // Stay at 200 for 4 hours
    { duration: '5m', target: 0 },     // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<5000'], // 95% under 5s
    errors: ['rate<0.01'],              // Error rate under 1%
  }
};