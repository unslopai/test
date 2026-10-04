const express = require('express');
const bodyParser = require('body-parser');

const app = express();
const port = 3000;

// Middleware to parse JSON bodies
app.use(bodyParser.json());

// Mock database (replace this with your actual database logic)
let orders = {};

// Route to receive webhook events from Stripe
app.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;
  try {
    event = require('stripe')(process.env.STRIPE_SECRET_KEY).webhooks.constructEvent(
      req.body,
      sig,
      endpointSecret
    );
  } catch (err) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the event
  switch (event.type) {
    case 'payment_intent.succeeded':
      const paymentIntent = event.data.object;
      // Fulfill any orders from the payment intent data
      handlePaymentIntentSucceeded(paymentIntent);
      break;
    default:
      console.log(`Unhandled event type ${event.type}`);
  }

  res.json({ received: true });
});

// Function to handle payment intent succeeded events
function handlePaymentIntentSucceeded(paymentIntent) {
  const { id, amount, currency, customer } = paymentIntent;

  // Simulate fetching order from the database based on the customer ID or another identifier
  if (!orders[customer]) {
    orders[customer] = {};
  }

  if (!orders[customer][id]) {
    orders[customer][id] = {
      amount,
      currency,
      status: 'paid'
    };
    console.log(`Order ${id} marked as paid for customer ${customer}`);
  } else {
    console.log(`Order ${id} is already marked as paid`);
  }
}

// Start the server
app.listen(port, () => {
  console.log(`Webhook receiver running on port ${port}`);
});
