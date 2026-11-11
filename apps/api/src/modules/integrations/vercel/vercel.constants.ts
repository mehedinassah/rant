/** BullMQ queue that processes verified Vercel webhook deliveries. */
export const VERCEL_EVENTS_QUEUE = 'vercel-events';

/** Vercel signs webhook bodies with HMAC-SHA1 (legacy) or HMAC-SHA256. */
export const VERCEL_SIGNATURE_HEADER = 'x-vercel-signature';
export const VERCEL_DELIVERY_HEADER = 'x-vercel-id';
