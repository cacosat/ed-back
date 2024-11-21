require('dotenv').config();
const express = require('express');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST;

// routes
const authRoutes = require('./routes/auth');
const testRoutes = require('./routes/test');
const deckRoutes = require('./routes/decks')

// CORS
const allowedOrigins = [
    'http://localhost:3000',  // Frontend
    'http://localhost:3001'   // Backend
];

// middleware
app.use(express.json()); // allows parsing of incoming json from the client, converts json to js object and attaches it to req.body
app.use(require('cookie-parser')()); // parses cookies attached to the req obj and makes it available at req.cookies
app.use(
    cors({
        origin: function(origin, callback) {
            // Allow requests with no origin (like mobile apps or curl requests)
            if (!origin) return callback(null, true);
            
            if (allowedOrigins.indexOf(origin) === -1) {
                const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
                return callback(new Error(msg), false);
            }
            return callback(null, true);
        },
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization']
    })
);

// app.METHOD(PATH, HANDLER)
// app.get('/api', (req, res) => {
//     res.send(`Hello World! From ${HOST}:${PORT}/api`)
// })

app.use('/api/auth', authRoutes);
app.use('/api/test', testRoutes);
app.use('/api/decks', deckRoutes);

app.listen(PORT, () => {
    console.log(`app listening on ${HOST}:${PORT}`)
})