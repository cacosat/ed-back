require('dotenv').config();
const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST;

// app.METHOD(PATH, HANDLER)
app.get('/api', (req, res) => {
    res.send(`Hello World! From ${HOST}:${PORT}/api`)
})

app.listen(PORT, () => {
    console.log(`app listening on ${HOST}:${PORT} or (||) 3000`)
})