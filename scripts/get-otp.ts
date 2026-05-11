// Test helper. Reads the latest emailed OTP code for a given address from the
// NotificationLog table. Only works when no real email provider is configured
// (otherwise the OTP isn't logged into the local DB).
//
//   npx tsx scripts/get-otp.ts you@example.com

import { PrismaClient } from '@prisma/client';

const email = process.argv[2];
if (!email) {
  console.error('usage: tsx scripts/get-otp.ts <email>');
  process.exit(1);
}

const prisma = new PrismaClient();

async function main() {
  const row = await prisma.notificationLog.findFirst({
    where: { channel: 'EMAIL', to: email },
    orderBy: { createdAt: 'desc' },
  });
  if (!row) {
    console.error('no notification for', email);
    process.exit(2);
  }
  const m = String(row.payload).match(/(\d{6})/);
  if (!m) {
    console.error('could not extract 6-digit code from payload');
    process.exit(3);
  }
  process.stdout.write(m[1]);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
