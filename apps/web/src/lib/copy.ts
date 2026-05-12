// Lucky's voice. Zomato's secret weapon is microcopy with warmth + wit.
// Centralising every customer-facing string here means we can tune the
// personality from one file without scavenging components.

// Order status → human-readable phrase. Keep these warm; the kitchen is
// "marinating" your food, not just "preparing" it.
export const ORDER_STATUS_PHRASE: Record<string, string> = {
  PENDING_PAYMENT:  'Waiting for payment',
  PAID:             'Order received · the kitchen is unboxing your spices',
  ACCEPTED:         'Chef accepted · your dum is calling',
  PREPARING:        'Your order is marinating in the handi…',
  READY:            'Packed and steaming · waiting for a rider',
  OUT_FOR_DELIVERY: 'On the way · steam still rising',
  DELIVERED:        'Delivered. Open the seal and enjoy.',
  CANCELLED:        'Cancelled',
  REFUNDED:         'Refunded',
};

// Short tag-line variants for the top of the order tracking screen
export const ETA_HEADLINE: Record<string, string> = {
  PAID:             'Confirming order',
  ACCEPTED:         'Heating up the handi',
  PREPARING:        'Slow-cooking your dum',
  READY:            'Packed · finding a rider',
  OUT_FOR_DELIVERY: 'Arriving in',
};

// Empty states — never just say "empty"
export const EMPTY = {
  cart:      { emoji: '🥘', title: 'Your handi is empty',         hint: 'Add a biryani — we will seal it the moment you check out.' },
  orders:    { emoji: '📜', title: 'No orders yet',                hint: 'Your story with Lucky Biryani starts with the first dum.' },
  favorites: { emoji: '💛', title: 'Nothing saved yet',            hint: 'Tap the heart on a dish to come back to it later.' },
  bookings:  { emoji: '🪑', title: 'No reservations on file',      hint: 'The window table is calling. Book a slot in two taps.' },
  reviews:   { emoji: '⭐', title: 'No reviews yet',                hint: 'Be the first voice on the wall — we read every one.' },
};

// Loading lines that rotate so we never show the same placeholder twice
export const LOADING_LINES = [
  'Sealing the handi…',
  'Counting cardamom pods…',
  'Toasting the cumin…',
  'Layering saffron rice…',
  'Whisking the raita…',
];

// Toast presets — short, on-brand
export const TOAST = {
  addedToCart:      (name: string) => `${name} is in the handi.`,
  removedFromCart:  (name: string) => `${name} removed.`,
  favoritedItem:    (name: string) => `${name} saved to your favourites.`,
  unfavoritedItem:  (name: string) => `Removed from favourites.`,
  orderPlaced:      'Order placed. The dum has begun.',
  reservationSet:   'Table booked. We will keep it warm for you.',
  reservationCancelled: 'Reservation cancelled.',
  tipUpdated:       'Tip updated. Thanks for taking care of your rider.',
  generic:          'Done.',
  error:            'Hmm, that didn\'t quite land. Try again?',
};

// Specific generic phrases used across the app
export const PHRASES = {
  thanks: 'Thanks — that helps us a lot.',
  loginToContinue: 'Log in to continue — takes 6 seconds.',
};
