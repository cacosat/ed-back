require('dotenv').config();
const express = require('express');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST;

// routes
const authRoutes = require('./routes/auth');
const testRoutes = require('./routes/test');

// middleware
app.use(express.json()); // allows parsing of incoming json from the client, converts json to js object and attaches it to req.body
app.use(require('cookie-parser')()); // parses cookies attached to the req obj and makes it available at req.cookies
app.use(
    cors({
        origin: 'http://localhost:3000',
        credentials: true, // allow cookies across domains
    })
)

// app.METHOD(PATH, HANDLER)
// app.get('/api', (req, res) => {
//     res.send(`Hello World! From ${HOST}:${PORT}/api`)
// })

app.use('/api/auth', authRoutes);
app.use('/api/test', testRoutes);

app.listen(PORT, () => {
    console.log(`app listening on ${HOST}:${PORT} or (||) 3000`)
})