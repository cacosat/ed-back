const express = require('express');
const app = express();
const port = 3001;

// app.METHOD(PATH, HANDLER)
app.get('/api', (req, res) => {
    res.send('Hello World! From /api')
})

app.listen(port || 3000, () => {
    console.log(`app listening on ${port} or (||) 3000`)
})