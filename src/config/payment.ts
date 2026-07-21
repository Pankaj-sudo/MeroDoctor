// eSewa manual-payment settings. Replace these with your real merchant details.
// (These are display/config values, not secrets.)

/** Consultation fee in Nepalese rupees. */
export const CONSULTATION_FEE = 800;

/** Your eSewa merchant / personal ID the patient pays to. */
export const ESEWA_ID = '98XXXXXXXX';

/** Name shown next to the eSewa ID. */
export const ESEWA_NAME = 'MeroDoctor Health';

/**
 * Your static eSewa QR image (a URL or data-URI). Leave empty to show a
 * styled placeholder — drop your real merchant QR here and it renders instead.
 */
export const ESEWA_QR_SRC = '';

export function formatNpr(amount: number): string {
  return 'Rs. ' + amount.toLocaleString('en-IN');
}
