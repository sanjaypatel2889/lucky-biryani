import 'dotenv/config';

const env = (k: string, d = '') => process.env[k] ?? d;

export const config = {
  port: Number(env('PORT', '4000')),
  jwtSecret: env('JWT_SECRET', 'dev-secret-change-me'),
  frontendUrl: env('FRONTEND_URL', 'http://localhost:3000'),
  devOtp: env('DEV_OTP', '000000'),
  enableAutomation: env('ENABLE_AUTOMATION', 'true') === 'true',

  razorpay: {
    keyId: env('RAZORPAY_KEY_ID'),
    keySecret: env('RAZORPAY_KEY_SECRET'),
    webhookSecret: env('RAZORPAY_WEBHOOK_SECRET'),
    enabled: !!env('RAZORPAY_KEY_ID'),
  },
  msg91: {
    authKey: env('MSG91_AUTH_KEY'),
    template: env('MSG91_DLT_TEMPLATE_ID_OTP'),
    enabled: !!env('MSG91_AUTH_KEY'),
  },
  fast2sms: {
    apiKey: env('FAST2SMS_API_KEY'),
    enabled: !!env('FAST2SMS_API_KEY'),
  },
  whatsapp: {
    phoneId: env('WA_PHONE_NUMBER_ID'),
    token: env('WA_ACCESS_TOKEN'),
    verifyToken: env('WA_VERIFY_TOKEN', 'dev'),
    enabled: !!env('WA_ACCESS_TOKEN'),
  },
  email: {
    resendKey: env('RESEND_API_KEY'),
    enabled: !!env('RESEND_API_KEY'),
  },

  branch: {
    // dev default — coords for Lucky Biryani Centre placeholder location.
    // Hyderabad-ish so demo distances make sense.
    lat: 17.385,
    lng: 78.4867,
  },

  delivery: {
    minCart: 150,
    freeDeliveryAt: 500,
    baseFee: 30,
    perKmFee: 8,
    maxRadiusKm: 6,
    codCapFirstOrder: 2000,
    codCap: 5000,
  },

  booking: {
    slotMinutes: 30,
    holdMinutes: 90,
    graceMinutes: 15,
    depositPerSeat: 100,
  },

  rider: {
    radiusKm: 3,
    acceptWindowSec: 10,
    maxAttempts: 5,
  },
};
