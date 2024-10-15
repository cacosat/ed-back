const jwt = require('jsonwebtoken');

// generate access token
exports.generateAccessToken = (userId) => {
    // jwt.sign(payload, secret, options)
    return jwt.sign({userId}, process.env.JWT_SECRET, { expiresIn: '1h' });
}

// generate refresh token
exports.generateRefreshToken = (userId) => {
    // jwt.sign(payload, secret, options)
    return jwt.sign({userId}, process.env.REFRESH_TOKEN_SECRET, { expiresIn: '7d' });
}

// verify access token
exports.verifyAccessToken = (token) => {
    // jwt.verify(token, secret)
    return jwt.verify(token, process.env.JWT_SECRET);
}

// verify refresh token
exports.verifyRefreshToken = (token) => {
    // jwt.verify(token, secret)
    return jwt.verify(token, process.env.REFRESH_TOKEN_SECRET);
}