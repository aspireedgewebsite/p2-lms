import { api, type ApiOne } from './api';

type CheckoutResult = { razorpay_payment_id: string; razorpay_signature: string };
type CheckoutOrder = { id: string; orderId: string; key: string; amount: number; currency: string; title: string };
type CheckoutOptions = {
  key: string; order_id: string; amount: number; currency: string; name: string; description: string;
  theme: { color: string }; modal: { ondismiss: () => void }; handler: (payment: CheckoutResult) => void;
};
type Checkout = new (options: CheckoutOptions) => { open: () => void };
declare global { interface Window { Razorpay?: Checkout } }

let checkoutScript: Promise<Checkout> | undefined;
function loadCheckout(): Promise<Checkout> {
  if (window.Razorpay) return Promise.resolve(window.Razorpay);
  checkoutScript ??= new Promise<Checkout>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    const failed = () => {
      window.clearTimeout(timer);
      script.remove();
      reject(new Error('Razorpay checkout could not load. Please try again.'));
    };
    const timer = window.setTimeout(failed, 12_000);
    script.onload = () => {
      window.clearTimeout(timer);
      if (window.Razorpay) resolve(window.Razorpay);
      else failed();
    };
    script.onerror = failed;
    document.head.append(script);
  }).catch(error => { checkoutScript = undefined; throw error; });
  return checkoutScript;
}

export async function payForCourse(courseId: string) {
  const Razorpay = await loadCheckout();
  const { data: order } = await api<ApiOne<CheckoutOrder>>('/payments/razorpay/orders', {
    method: 'POST', body: JSON.stringify({ courseId }),
  });
  const payment = await new Promise<CheckoutResult | null>(resolve => {
    new Razorpay({
      key: order.key, order_id: order.orderId, amount: order.amount, currency: order.currency,
      name: 'Aspireedge', description: order.title, theme: { color: '#0752cc' },
      modal: { ondismiss: () => resolve(null) }, handler: resolve,
    }).open();
  });
  if (!payment) return null;
  const { data } = await api<ApiOne<{ courseId: string }>>('/payments/razorpay/verify', {
    method: 'POST', body: JSON.stringify({
      id: order.id, paymentId: payment.razorpay_payment_id, signature: payment.razorpay_signature,
    }),
  });
  return data;
}
