const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

// Sample user data (usually you would store this in a database)
const users = [
  {
    id: 1,
    username: 'admin',
    password: '$2a$10$vV5lGpLJ9NwZvX3rM7UjleZSjbh3bEYfWnQvzgKcT8nZvqLsF7kIy' // bcrypt hash of 'password'
  }
];

const app = express();
app.use(express.json());

// Secret key for signing the JWT
const SECRET_KEY = 'your_secret_key_here';

// Login route
app.post('/login', (req, res) => {
  const { username, password } = req.body;

  // Find user by username
  const user = users.find(u => u.username === username);

  if (!user) {
    return res.status(401).json({ message: 'Invalid credentials' });
  }

  // Compare passwords
  bcrypt.compare(password, user.password, (err, isMatch) => {
    if (err) throw err;
    if (isMatch) {
      // User authenticated, generate JWT
      const payload = { id: user.id, username: user.username };
      jwt.sign(payload, SECRET_KEY, { expiresIn: '1h' }, (err, token) => {
        if (err) throw err;
        res.json({ token });
      });
    } else {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
  });
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
