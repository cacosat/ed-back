const jwt = require('jsonwebtoken');

// authenticate tokens
exports.authenticateToken = (req, res, next) => {
    // retrieve auth header
    const authHeader = req.headers['authorization'];
    // extract token; expected format 'Bearer <token>'
    const accessToken = authHeader && authHeader.split(' ')[1]; // 'short circuit eval', returns falsy if no auth token

    if (!accessToken) {
        // if no token return unauthorized 401
        return res.sendStatus(401);
    }

    // verify token
    jwt.verify(accessToken, process.env.JWT_SECRET, (err, decoded) => {
        if (err){
            console.error('Access token verification error: ', err);
            return res.sendStatus(403); // forbidden
        }

        // attach user info to req object
        req.user = { id: decoded.userId };
        // next middleware or route handler
        next();
    })
}