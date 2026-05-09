// Human-readable order/booking numbers.
//   LBC-O-<ymd>-<seq6>
//   LBC-R-<ymd>-<seq6>

const pad = (n: number, w: number) => n.toString().padStart(w, '0');

const ymd = () => {
  const d = new Date();
  return `${d.getFullYear()}${pad(d.getMonth() + 1, 2)}${pad(d.getDate(), 2)}`;
};

let orderSeq = Math.floor(Math.random() * 1000);
let bookingSeq = Math.floor(Math.random() * 1000);

export const newOrderNumber = () =>
  `LBC-O-${ymd()}-${pad(++orderSeq % 1_000_000, 6)}`;

export const newBookingNumber = () =>
  `LBC-R-${ymd()}-${pad(++bookingSeq % 1_000_000, 6)}`;

export const randomToken = (len = 32) => {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let s = '';
  for (let i = 0; i < len; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
};
