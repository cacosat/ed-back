const bcrypt = require('bcrypt');
const supabase = require('../config/supabase');
const { generateAccessToken, generateRefreshToken, verifyRefreshToken } = require('../utils/tokenUtils');

// handle user registration
exports.register = async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ message: 'Validation failed, email and password are required' });
    }

    try {
        // check if user exists
        const { data: existingUser, error } = await supabase 
            .from('users')        // Selects the 'users' table
            .select('id')         // Only retrieves the 'id' column
            .eq('email', email)   // Filters where 'email' equals the provided email
            .single();            // Expects a single result
        
        if (error) {
            console.error('Error checking for existing user: ', error)
        }

        if (existingUser) {
            // conflict error (409), existing resource
            return res.status(409).json({ message: 'email already in use' });
        }

        // hash password
        const pass_hash = await bcrypt.hash(password, 10);

        // insert new user in db
        const { data: newUser, error: insertError } = await supabase
            .from('users')
            .insert([{ email, pass_hash }])
            .single()

        if (insertError) {
            throw insertError
        }

        // generate token
        const accessToken = generateAccessToken(newUser.id);
        const refreshToken = generateRefreshToken(newUser.id);

        // store refreshToken in db
        await supabase
            .from('users')
            .update({ refreshToken: refreshToken })
            .eq('id', newUser.id)

        // send token
        res
            .status(201) // created status code
            .cookie('refreshToken', refreshToken, {
                httpOnly: true, // prevents js access
                secure: process.env.NODE_ENV === 'production',
                maxAge: 7*24*60*60*1000, // 7 days in milliseconds
                sameSite: 'Strict', // CSRF protection
            })
            .json({ accessToken, user: { id: newUser.id, email: newUser.email } });

    } catch (err) {
        console.error('Registration Error: ', err);
        res.status(500).json({ message: 'Server error in registration at register function'});
    }
}

// handle user login
exports.login = async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        // validation error 400: server unable to process request due to client error (email and pass required)
        return res.status(400).json({ message: 'Email and Password required '})
    }

    try {
        // fetch user
        const { data: user } = await supabase
            .from('users')
            .select('*')
            .eq('email', email)
            .single()

        if (!user) {
            // unauthorized 401: invalid credentials
            return res.status(401).json({ message: 'Unauthorized, invalid credentials'})
        }

        // compare password
        const isMatch = await bcrypt.compare(password, user.pass_hash);

        if (!isMatch) {
            // Unauthorized 401: invalid password
            return res.status(401).json({ message: 'Unauthorized: invalid password' })
        }

        // token generation
        const accessToken = generateAccessToken(user.id);
        const refreshToken = generateRefreshToken(user.id);

        // store refreshToken in db
        res
            .status(201)
            .cookie('refreshToken', refreshToken, {
                httpOnly: true, // prevents js access
                secure: process.env.NODE_ENV === 'production',
                maxAge: 7*24*60*60*1000, // 7 days in milliseconds
                sameSite: 'Strict', // CSRF protection
            })
            .json({ accessToken, user: { id: user.id, email: user.email } });

    } catch (err) {
        console.error('Login error: ', err)
        res.status(500).json({ message: 'Internal server error: failed login, catch triggered '})
    }
}

// handle token refresh
exports.refreshToken = async (req, res) => {
    // handle refresh
}

// handle logout
exports.logout = async (req, res) => {
    // handle logout
}

// function for password hashing
const hashPassword = async (password) => {
    const saltRounds = 10; // hashing rounds
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    return hashedPassword;
}

// function to compare plain text and hashed password
const comparePassword = async (password, hash) => {
    const match = await bcrypt.compare(password, hash);
    return match;
}

module.exports = {
    hashPassword,
    comparePassword,
}