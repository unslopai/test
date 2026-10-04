const express = require('express');

const app = express();
app.use(express.json());

app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});

const port = process.env.PORT || 4000;
app.listen(port, () => {
    console.log(`auth service listening on ${port}`);
});
