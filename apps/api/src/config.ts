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
    // Brevo (Sendinblue) — free 300 emails/day, sends to any address after
    // verifying just your sender email (no domain DNS required).
    brevoKey: env('BREVO_API_KEY'),
    brevoSenderEmail: env('BREVO_SENDER_EMAIL'),
    brevoSenderName: env('BREVO_SENDER_NAME', 'Lucky Biryani'),
    // Resend kept as a fallback if anyone wants to use it (requires domain verification for non-self addresses).
    resendKey: env('RESEND_API_KEY'),
    from: env('EMAIL_FROM', 'Lucky Biryani <onboarding@resend.dev>'),
    enabled: !!env('BREVO_API_KEY') || !!env('RESEND_API_KEY'),
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

  ai: {
    // Anthropic Claude — used for the Lucky AI chatbot. The chat endpoint
    // degrades to a deterministic rule-based reply if no key is set, so the
    // UI keeps working out-of-the-box.
    anthropicKey: env('ANTHROPIC_API_KEY'),
    model: env('ANTHROPIC_MODEL', 'claude-haiku-4-5-20251001'),
    enabled: !!env('ANTHROPIC_API_KEY'),
  },

  push: {
    // Generate once via: npx web-push generate-vapid-keys
    vapidPublic: env('VAPID_PUBLIC_KEY'),
    vapidPrivate: env('VAPID_PRIVATE_KEY'),
    contact: env('VAPID_CONTACT', 'mailto:hello@luckybiryani.in'),
    enabled: !!env('VAPID_PUBLIC_KEY') && !!env('VAPID_PRIVATE_KEY'),
  },

  referrals: {
    bothEarnPoints: 50, // loyalty points credited to both parties on first paid order
  },

  loyalty: {
    pointsPerRupee: 0.01,        // 1 point per ₹100 spent
    redeemRupeesPerPoint: 1,     // 1 point = ₹1
    maxRedeemPctOfSubtotal: 0.2, // capped at 20%
  },
};
