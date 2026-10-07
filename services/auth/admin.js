const express = require('express');
const app = express();

// Middleware to parse URL-encoded bodies (for handling HTML form POST requests)
app.use(express.urlencoded({ extended: true }));

// Simulated Database (In-memory array)
let users = [
    { id: 1, name: 'Alice Smith', email: 'alice@example.com', role: 'User' },
    { id: 2, name: 'Bob Jones', email: 'bob@example.com', role: 'User' },
    { id: 3, name: 'Charlie Admin', email: 'charlie@example.com', role: 'Admin' },
    { id: 4, name: 'Diana Prince', email: 'diana@example.com', role: 'User' }
];

/**
 * ADMIN ROUTE: List all users
 * GET /admin/users
 */
app.get('/admin/users', (req, res) => {
    // Generate an HTML table displaying all users
    const userRows = users.map(user => `
        <tr>
            <td>${user.id}</td>
            <td>${user.name}</td>
            <td>${user.email}</td>
            <td>${user.role}</td>
            <td>
                <!-- Delete form using POST method -->
                <form action="/admin/users/delete/${user.id}" method="POST" style="display:inline;">
                    <button type="submit" onclick="return confirm('Are you sure you want to delete this user?');" style="background-color: #ff4d4d; color: white; border: none; padding: 5px 10px; cursor: pointer;">Delete</button>
                </form>
            </td>
        </tr>
    `).join('');

    const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Admin Dashboard - User Management</title>
            <style>
                body { font-family: Arial, sans-serif; margin: 40px; }
                table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
                th { background-color: #f2f2f2; }
                tr:nth-child(even) { background-color: #f9f9f9; }
                h2 { color: #333; }
            </style>
        </head>
        <body>
            <h2>Admin Dashboard: User Management</h2>
            <p>Total users: ${users.length}</p>
            <table>
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Name</th>
                        <th>Email</th>
                        <th>Role</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${userRows.length > 0 ? userRows : '<tr><td colspan="5">No users found.</td></tr>'}
                </tbody>
            </table>
        </body>
        </html>
    `;

    res.send(html);
});

/**
 * ADMIN ROUTE: Delete a user
 * POST /admin/users/delete/:id
 */
app.post('/admin/users/delete/:id', (req, res) => {
    const userId = parseInt(req.params.id);

    // Filter out the user with the matching ID
    const initialLength = users.length;
    users = users.filter(user => user.id !== userId);

    if (users.length < initialLength) {
        console.log(`User with ID ${userId} was deleted.`);
    } else {
        console.log(`User with ID ${userId} not found.`);
    }

    // Redirect back to the admin user list
    res.redirect('/admin/users');
});

// Start the server
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server is running! Open http://localhost:${PORT}/admin/users in your browser.`);
});
