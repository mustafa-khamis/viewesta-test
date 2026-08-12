/**
 * Utility function to handle VirtualPay HTML form submission.
 * This is used to securely redirect users to the VirtualPay Hosted Payment Page.
 *
 * @param {Object} paymentForm - The form configuration returned from backend.
 * @param {string} paymentForm.action_url - URL to post the form to.
 * @param {string} paymentForm.method - Form submission method (e.g., 'POST').
 * @param {string} paymentForm.enctype - Form encoding type.
 * @param {Object} paymentForm.fields - Key-value pairs representing form inputs.
 */
export const submitVirtualPayForm = (paymentForm) => {
  if (!paymentForm || !paymentForm.action_url || !paymentForm.fields) {
    console.error('Invalid VirtualPay form data', paymentForm);
    throw new Error('Invalid payment form data received.');
  }

  const form = document.createElement('form');
  form.method = paymentForm.method || 'POST';
  form.action = paymentForm.action_url;
  form.enctype = paymentForm.enctype || 'application/x-www-form-urlencoded';
  form.style.display = 'none';

  Object.entries(paymentForm.fields).forEach(([name, value]) => {
    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = name;
    // Handle potential null/undefined values safely
    input.value = value === null || value === undefined ? '' : value;
    form.appendChild(input);
  });

  document.body.appendChild(form);
  form.submit();
};
