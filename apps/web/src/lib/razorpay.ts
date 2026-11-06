/**
 * Razorpay Checkout, the one payment window: loaded once from Razorpay's own script (allowed in both Content-Security-Policies),
 * opened with an order the server made through payments.ts. The browser never decides that something is paid: the webhook does.
 * Used by the product page and the strategy session's live call.
 */
export interface RazorpayOptions {
  key: string;
  amount: number;
  currency: string;
  order_id: string;
  name: string;
  description: string;
  handler: () => void;
  modal?: { ondismiss?: () => void };
}
declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => { open: () => void };
  }
}

/** Loads Razorpay Checkout once and resolves when it is ready. */
export function loadRazorpay(): Promise<void> {
  if (window.Razorpay) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-razorpay]');
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('Could not load the payment window.')));
      return;
    }
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.async = true;
    s.dataset.razorpay = '1';
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Could not load the payment window.'));
    document.head.appendChild(s);
  });
}
