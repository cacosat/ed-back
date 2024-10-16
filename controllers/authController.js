require('dotenv').config();
const bcrypt = require('bcrypt');
const supabase = require('../config/supabase');
const { generateAccessToken, generateRefreshToken, verifyRefreshToken } = require('../utils/tokenUtils');

// handle user registration
const register = async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ message: 'Validation failed, email and password are required' });
    }

    try {
        // check if user exists
        const { data: existingUser, error: checkError } = await supabase 
            .from('users')        // Selects the 'users' table
            .select('id')         // Only retrieves the 'id' column
            .eq('email', email)   // Filters where 'email' equals the provided email
            .single();            // Expects a single result
        
        // if (checkError) {
        //     console.error('Error checking for existing user: ', checkError)
        //     return res.status(500).json({ message: 'Error checking for existing user' });
        // }

        if (existingUser) {
            // conflict error (409), existing resource
            return res.status(409).json({ message: 'email already in use' });
        }

        // hash password
        const password_hash = await bcrypt.hash(password, 10);

        // insert new user in db
        let { data: newUser, error: insertError } = await supabase
            .from('users')
            .insert([{ email, password_hash }])
            .select()
            .single()

        if (insertError) {
            console.error('Error inserting new user:', insertError);
            return res.status(500).json({ message: 'Failed to create new user' });
        }

        if (!newUser) {
            console.log(newUser)
            console.error('New user data is null after insertion');

            // fetch user data separately

            const { data: fetchedUser, error: fetchError } = await supabase
                .from('users')
                .select('id, email')
                .eq('email', email)
                .single()

            if (fetchError || !fetchedUser) {
                console.error('Error fetching new user data separately: ', fetchError);
                return res.status(500).json({ message: 'Failed to retrieve new user data separately'})
            }

            newUser = fetchedUser;
        }

        // generate token
        const accessToken = generateAccessToken(newUser.id);
        const refreshToken = generateRefreshToken(newUser.id);

        // store refreshToken in db
        const { error: updateError } = await supabase
            .from('users')
            .update({ refresh_token: refreshToken })
            .eq('id', newUser.id)

        if (updateError) {
            console.error('Error updating refresh token:', updateError);
        }

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
const login = async (req, res) => {
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
        const isMatch = await bcrypt.compare(password, user.password_hash);

        if (!isMatch) {
            // Unauthorized 401: invalid password
            return res.status(401).json({ message: 'Unauthorized: invalid password' })
        }

        // token generation
        const accessToken = generateAccessToken(user.id);
        const refreshToken = generateRefreshToken(user.id);

        // store refreshToken in db
        const { error: updateError } = await supabase
            .from('users')
            .update({ refresh_token: refreshToken })
            .eq('id', user.id);

        if (updateError) {
            console.error('Error updating the refresh token in login: ', updateError);
            return res.send(500).json({ error: 'error updating the refresh token in login'})
        }

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
const refreshToken = async (req, res) => {
    // retrieve refreshToken from cookie
    const refreshToken = req.cookies.refreshToken;

    if (!refreshToken) {
        // Unauthorized 401: invalid refresh token
        return res.status(401).json({ message: 'Unauthorized: refresh token not found' });
    }

    try {
        const decoded = verifyRefreshToken(refreshToken);

        // check for match in db
        const { data: user } = await supabase
            .from('users')
            .select('id, refresh_token')
            .eq('id', decoded.userId)
            .single()

        if (!user || user.refresh_token !== refreshToken) {
            // Forbidden 403: invalid refresh token
            return res.status(403).json({ message: 'Invalid refresh token, doesnt match DB' });
        }

        // generate new tokens
        const newAccessToken = generateAccessToken(user.id)
        const newRefreshToken = generateRefreshToken(user.id)

        // update db with refresh token

        const { error: updateError } = await supabase
            .from('users')
            .update({ refresh_token: newRefreshToken })
            .eq('id', user.id);

        if (updateError) {
            console.error('Error updating refresh token:', updateError);
            return res.status(500).json({ message: 'Error updating refresh token' });
        }

        res
            .status(200)
            .cookie('refreshToken', newRefreshToken, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                maxAge: 7*24*60*60*1000,
                sameSite: 'Strict',
            })
            .json({ accessToken: newAccessToken })

    } catch (err) {
        console.error('Refresh token function error: ', err)
        res.status(403).json({ message: 'Invalid refresh token, catch triggered in refresh token function'})
    }
}

// handle logout
const logout = async (req, res) => {
    const userId = req.user.id

    // remove refresh token form db
    await supabase
        .from('users')
        .update({ refresh_token: null })
        .eq('id', userId)

    // clear cookie
    res
        .status(200)
        .clearCookie('refreshToken')
        .json({ message: 'Logged out successfully' })
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
    register,
    login,
    refreshToken,
    logout,
    hashPassword,
    comparePassword
}