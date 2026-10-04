const express = require('express');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = 3000;

// SECRET KEY: In a real production app, use environment variables! (e.g., process.env.JWT_SECRET)
const JWT_SECRET = 'your_super_secret_key_here';

// Middleware to parse JSON bodies
app.use(express.json());

// ==========================================
// 1. MOCK DATABASE (In-memory for this example)
// ==========================================
const users = [];

// Helper function to add a test user
const seedUser = () => {
    // In a real app, passwords MUST be hashed using bcrypt, never stored in plain text!
    users.push({
        username: 'admin',
        password: 'password123' 
    });
    console.log('Test user created: username: "admin", password: "password123"');
};

// ==========================================
// 2. LOGIN ROUTE
// ==========================================
app.post('/login', (req, res) => {
    const { username, password } = req.body;

    // Basic validation
    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required' });
    }

    // Find the user in our "database"
    const user = users.find(u => u.username === username);

    // Check if user exists and password matches
    // NOTE: Use bcrypt.compare() in production for hashed passwords
    if (!user || user.password !== password) {
        return res.status(401).json({ error: 'Invalid username or password' });
    }

    // User matched! Create payload for the JWT
    const payload = {
        username: user.username,
        role: 'admin' // You can add claims like roles/permissions here
    };

    // Sign the JWT (Expires in 1 hour)
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });

    // Send the token back to the client
    return res.json({
        message: 'Login successful',
        token: token
    });
});

// ==========================================
// 3. PROTECTED ROUTE (Example of how to use the token)
// ==========================================
app.get('/dashboard', verifyToken, (req, res) => {
    res.json({ 
        message: 'Welcome to the protected dashboard!', 
        user: req.user 
    });
});

// Middleware to verify JWT
function verifyToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer <TOKEN>

    if (!token) {
        return res.status(403).json({ error: 'No token provided' });
    }

    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) {
            return res.status(401).json({ error: 'Unauthorized: Invalid token' });
        }
        req.user = decoded; // Save decoded payload to request
        next();
    });
}

// ==========================================
// 4. START SERVER
// ==========================================
app.listen(PORT, () => {
    seedUser();
    console.log(`Server is running on http://localhost:${PORT}`);
});
