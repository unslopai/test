const express = require('express');
const bodyParser = require('body-parser');
const crypto = require('crypto');

// Initialize Express app
const app = express();
const port = process.env.PORT || 3000;

// Middleware to parse JSON bodies
app.use(bodyParser.json());

// Database connection (example using MySQL)
const mysql = require('mysql');
const db = mysql.createConnection({
    host: 'localhost',
    user: 'your_mysql_user',
    password: 'your_mysql_password',
    database: 'your_database'
});

db.connect((err) => {
    if (err) throw err;
    console.log('Connected to MySQL database!');
});

// PayPal webhook endpoint
app.post('/webhook', async (req, res) => {
    const payload = req.body;
    const signature = req.headers['paypal-signature'];
    const certUrl = 'https://www.paypalobjects.com/ApiCertification/cert_0123456789';
    
    try {
        // Verify the PayPal webhook signature
        if (!verifyPayPalSignature(payload, signature, certUrl)) {
            return res.status(400).send('Invalid PayPal signature');
        }

        // Process the payment notification
        await handlePaymentNotification(payload);

        res.status(200).send('OK');
    } catch (error) {
        console.error(error);
        res.status(500).send('Internal Server Error');
    }
});

// Function to verify PayPal signature
async function verifyPayPalSignature(payload, signature, certUrl) {
    const response = await fetch(certUrl);
    const certData = await response.text();
    
    return crypto.createVerify('RSA-SHA256')
        .update(JSON.stringify(payload))
        .verify(certData, signature, 'base64');
}

// Function to handle payment notification
async function handlePaymentNotification(payload) {
    const { resource: { id, state } } = payload;

    if (state === 'approved') {
        // Update the order in the database as paid
        await updateOrderStatus(id, 'paid');
    } else {
        console.log('Unrecognized payment state:', state);
    }
}

// Function to update order status in the database
async function updateOrderStatus(orderId, status) {
    const sql = 'UPDATE orders SET status = ? WHERE order_id = ?';
    await db.query(sql, [status, orderId]);
    console.log(`Updated order ${orderId} to status ${status}`);
}

// Start the server
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
