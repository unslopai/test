/**
 * PayPal Webhook Receiver in Node.js (Express)
 * 
 * File: paypal-webhook.js
 */

const express = require('express');
const https = require('https');

const app = express();
const PORT = process.env.PORT || 3000;

// ==========================================
// CONFIGURATION (Use environment variables in production)
// ==========================================
const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID || 'your_client_id';
const PAYPAL_CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET || 'your_client_secret';
const PAYPAL_WEBHOOK_ID = process.env.PAYPAL_WEBHOOK_ID || 'your_webhook_id';

// Use 'api-m.paypal.com' for Live, or 'api-m.sandbox.paypal.com' for Testing
const PAYPAL_API_HOST = process.env.PAYPAL_MODE === 'live' 
    ? 'api-m.paypal.com' 
    : 'api-m.sandbox.paypal.com';

// ==========================================
// CRITICAL: CAPTURE RAW BODY FOR SIGNATURE CHECK
// ==========================================
// PayPal signature verification requires the exact raw body string sent by PayPal.
app.use(express.json({
    verify: (req, res, buf) => {
        req.rawBody = buf.toString();
    }
}));

// ==========================================
// MOCK DATABASE FUNCTION
// ==========================================
async function markOrderAsPaid(orderId, transactionId) {
    // TODO: Replace this with your actual database logic (e.g., Mongoose, Sequelize, pg)
    console.log(`[DATABASE] Success! Order ID: ${orderId} marked as PAID. Transaction ID: ${transactionId}`);
    return true;
}

// ==========================================
// HELPER: GET PAYPAL ACCESS TOKEN
// ==========================================
function getPayPalAccessToken() {
    return new Promise((resolve, reject) => {
        const auth = Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`).toString('base64');
        const data = 'grant_type=client_credentials';

        const options = {
            hostname: PAYPAL_API_HOST,
            path: '/v1/oauth2/token',
            method: 'POST',
            headers: {
                'Authorization': `Basic ${auth}`,
                'Content-Type': 'application/x-www-form-urlencoded',
                'Content-Length': data.length
            }
        };

        const req = https.request(options, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                if (res.statusCode === 200) {
                    resolve(JSON.parse(body).access_token);
                } else {
                    reject(new Error(`Failed to get PayPal token: ${body}`));
                }
            });
        });

        req.on('error', err => reject(err));
        req.write(data);
        req.end();
    });
}

// ==========================================
// HELPER: VERIFY PAYPAL SIGNATURE
// ==========================================
function verifyPayPalSignature(headers, rawBody) {
    return new Promise(async (resolve, reject) => {
        try {
            const accessToken = await getPayPalAccessToken();

            const verificationPayload = JSON.stringify({
                auth_algo: headers['paypal-auth-algo'],
                cert_url: headers['paypal-cert-url'],
                transmission_id: headers['paypal-transmission-id'],
                transmission_sig: headers['paypal-transmission-sig'],
                transmission_time: headers['paypal-transmission-time'],
                webhook_id: PAYPAL_WEBHOOK_ID,
                webhook_event: JSON.parse(rawBody)
            });

            const options = {
                hostname: PAYPAL_API_HOST,
                path: '/v1/notifications/verify-webhook-signature',
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                    'Content-Length': verificationPayload.length
                }
            };

            const req = https.request(options, (res) => {
                let body = '';
                res.on('data', chunk => body += chunk);
                res.on('end', () => {
                    if (res.statusCode === 200) {
                        const result = JSON.parse(body);
                        resolve(result.verification_status === 'SUCCESS');
                    } else {
                        reject(new Error(`Verification API failed: ${body}`));
                    }
                });
            });

            req.on('error', err => reject(err));
            req.write(verificationPayload);
            req.end();

        } catch (error) {
            reject(error);
        }
    });
}

// ==========================================
// WEBHOOK ENDPOINT
// ==========================================
app.post('/webhook/paypal', async (req, res) => {
    try {
        const headers = req.headers;
        const event = req.body;

        // 1. Verify the signature to ensure request came from PayPal
        const isVerified = await verifyPayPalSignature(headers, req.rawBody);

        if (!isVerified) {
            console.warn('[WARNING] Invalid PayPal webhook signature.');
            return res.status(400).send('Invalid webhook signature');
        }

        console.log(`[INFO] Verified PayPal Event: ${event.event_type}`);

        // 2. Handle specific event types
        // 'CHECKOUT.ORDER.APPROVED' or 'PAYMENT.CAPTURE.COMPLETED' are standard for paid orders
        if (event.event_type === 'PAYMENT.CAPTURE.COMPLETED' || event.event_type === 'CHECKOUT.ORDER.APPROVED') {
            
            // Extract the Custom ID or Invoice ID you passed during order creation, 
            // or extract the PayPal Order ID.
            const resource = event.resource;
            
            // If you passed your internal DB Order ID into `custom_id` during checkout:
            // const internalOrderId = resource.custom_id; 
            
            // Otherwise, using the PayPal Order/Capture ID:
            const paypalOrderId = resource.id; 
            const transactionId = resource.id;

            // 3. Mark the order as paid in your database
            await markOrderAsPaid(paypalOrderId, transactionId);
        }

        // 4. Acknowledge receipt of the webhook to PayPal immediately
        res.status(200).json({ received: true });

    } express (error) {
        console.error('[ERROR] Processing webhook failed:', error);
        // Send a 500 so PayPal knows to retry later
        res.status(500).send('Webhook processing failed');
    }
});

// Start Server
app.listen(PORT, () => {
    console.log(`PayPal Webhook receiver listening on port ${PORT}`);
});
