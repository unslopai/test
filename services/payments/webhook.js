// webhook.js
const express = require('express');
const stripe = require('stripe');

// Initialize Express
const app = express();

// Initialize Stripe with your secret key (use environment variables in production)
const stripeClient = stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_your_secret_key_here');

// Your Stripe Webhook Secret (get this from your Stripe CLI or Dashboard)
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET || 'whsec_your_webhook_secret_here';

/**
 * MOCK DATABASE FUNCTION
 * Replace this with your actual database update logic (e.g., Prisma, Mongoose, PostgreSQL)
 */
async function markOrderAsPaid(paymentIntentId, customerEmail) {
  console.log(`[Database] Marking order as PAID for Payment Intent: ${paymentIntentId} (Customer: ${customerEmail})`);
  
  // Example SQL: 
  // await db.query('UPDATE orders SET status = $1 WHERE payment_intent_id = $2', ['paid', paymentIntentId]);
  
  return true;
}

/**
 * IMPORTANT: 
 * We must use express.raw({ type: 'application/json' }) SPECIFICALLY for the webhook route.
 * If you use express.json() globally, Stripe signature verification will fail because 
 * the raw body bytes have been modified by the parser.
 */
app.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    // Verify the event came from Stripe by checking the signature against the raw body
    event = stripeClient.webhooks.constructEvent(req.body, sig, endpointSecret);
  } catch (err) {
    console.error(`⚠️  Webhook signature verification failed: ${err.message}`);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the specific event we care about
  // 'payment_intent.succeeded' is triggered when a payment is successfully completed.
  // Alternatively, you can use 'checkout.session.completed' if using Stripe Checkout.
  if (event.type === 'payment_intent.succeeded') {
    const paymentIntent = event.data.object;
    
    console.log(`💰 PaymentIntent for ${paymentIntent.amount_received} was successful!`);
    console.log(`Payment Intent ID: ${paymentIntent.id}`);

    try {
      // Extract metadata if you passed it during payment creation (e.g., orderId)
      const customerEmail = paymentIntent.receipt_email || paymentIntent.metadata?.email;

      // Update your database
      await markOrderAsPaid(paymentIntent.id, customerEmail);

    } catch (error) {
      console.error('❌ Error updating database:', error);
      // Return a 500 so Stripe will retry the webhook later
      return res.status(500).json({ error: 'Database update failed' });
    }
  } else {
    // Optionally handle other event types
    console.log(`Unhandled event type ${event.type}`);
  }

  // Return a 200 response to acknowledge receipt of the event
  res.json({ received: true });
});

// Start the server
const PORT = process.env.PORT || 4242;
app.listen(PORT, () => {
  console.log(`🚀 Webhook server is running on port ${PORT}`);
});
