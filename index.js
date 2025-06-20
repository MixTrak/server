//Imports & Stuff
const express = require('express')
const mongoose = require('mongoose')
const cors = require('cors')
const crypto = require('crypto') // For generating secure tokens
const nodemailer = require('nodemailer') // For sending emails
const UserModel = require('./models/User.js')
const port = process.env.PORT || 4000

const app = express()
app.use(express.json())

// --- START CORS Configuration ---
const allowedOrigins = [
  'https://server-green-nu.vercel.app', // Frontend origin
  'http://localhost:5173', // Add this for local development if needed
];

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
};

app.use(cors(corsOptions));
// --- END CORS Configuration ---

// Email configuration
const transporter = nodemailer.createTransport({
  service: 'gmail', // or your email service
  auth: {
    user: process.env.EMAIL_USER, // Your email
    pass: process.env.EMAIL_APP_PASSWORD // Your app password (not regular password)
  }
});

// Helper function to send verification email
const sendVerificationEmail = async (email, name, token) => {
  const verificationUrl = `${process.env.FRONTEND_URL}/verify-email/${token}`;
  
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: 'Verify Your Email Address',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Welcome ${name}!</h2>
        <p>Thank you for registering. Please verify your email address by clicking the button below:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${verificationUrl}" 
             style="background-color: #007bff; color: white; padding: 12px 30px; 
                    text-decoration: none; border-radius: 5px; display: inline-block;">
            Verify Email Address
          </a>
        </div>
        <p>Or copy and paste this link in your browser:</p>
        <p style="word-break: break-all; color: #666;">${verificationUrl}</p>
        <p><strong>This link will expire in 24 hours.</strong></p>
        <p>If you didn't create an account, please ignore this email.</p>
      </div>
    `
  };

  await transporter.sendMail(mailOptions);
};

// mongoDB Connection
mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log("MongoDB Connection Established");
  })
  .catch(err => {
    console.error("MongoDB Connection Error:", err);
    process.exit(1); // Exit process if MongoDB connection fails
  });

// UPDATED REGISTRATION ENDPOINT
app.post('/register', async (req, res) => {
    const { name, email, password } = req.body;

    // Check for empty fields
    if (!name || !email || !password) {
        return res.status(400).json({ message: "All fields are required" });
    }
    
    // Check for valid name
    if (typeof name !== 'string' || name.trim() === '') {
        return res.status(400).json({ message: "Invalid name" });
    }
    
    // Password validation
    if (password.length < 8) {
        return res.status(400).json({ message: "Password must be at least 8 characters long" });
    }
    if (password.trim() === '') {
        return res.status(400).json({ message: "Invalid password" });
    }

    try {
        // Check if user already exists
        const existingUser = await UserModel.findOne({ email });
        if (existingUser) {
            if (existingUser.isVerified) {
                return res.status(409).json({ message: "User already exists and is verified. Please login." });
            } else {
                // User exists but not verified - resend verification email
                const newToken = crypto.randomBytes(32).toString('hex');
                const tokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

                existingUser.verificationToken = newToken;
                existingUser.tokenExpiry = tokenExpiry;
                await existingUser.save();

                await sendVerificationEmail(email, name, newToken);
                return res.status(200).json({ 
                    message: "Verification email resent. Please check your inbox and verify your email." 
                });
            }
        }

        // Generate verification token
        const verificationToken = crypto.randomBytes(32).toString('hex');
        const tokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours from now

        // Create user (but not verified yet)
        const newUser = await UserModel.create({ 
            name, 
            email, 
            password,
            isVerified: false,
            verificationToken,
            tokenExpiry
        });

        // Send verification email
        await sendVerificationEmail(email, name, verificationToken);

        res.status(201).json({ 
            message: "Registration successful! Please check your email and verify your account before logging in.",
            userId: newUser._id 
        });

    } catch (error) {
        console.error("Error during registration:", error.stack || error); // Log full error stack

        // Improved error handling
        if (error.code === 'EAUTH') {
            res.status(500).json({ message: "Email service configuration error. Please contact support." });
        } else if (error.name === 'ValidationError') {
            res.status(400).json({ message: "Invalid data provided. Please check your input." });
        } else {
            res.status(500).json({ message: "An unexpected error occurred during registration. Please try again later." });
        }
    }
});

// NEW EMAIL VERIFICATION ENDPOINT
app.get('/verify-email/:token', async (req, res) => {
    const { token } = req.params;

    try {
        // Find user with this verification token
        const user = await UserModel.findOne({ 
            verificationToken: token,
            tokenExpiry: { $gt: new Date() } // Token not expired
        });

        if (!user) {
            return res.status(400).json({ 
                message: "Invalid or expired verification token. Please register again." 
            });
        }

        // Verify the user
        user.isVerified = true;
        user.verificationToken = null;
        user.tokenExpiry = null;
        await user.save();

        // Redirect to frontend with success message
        res.redirect(`${process.env.FRONTEND_URL}/login?verified=true`);

    } catch (error) {
        console.error("Error verifying email:", error);
        res.status(500).json({ message: "Error verifying email. Please try again." });
    }
});

// UPDATED LOGIN ENDPOINT
app.post('/login', (req, res) => {
    const { email, password } = req.body;
    
    if (!email || !password) {
        return res.status(400).json({ message: "Email and password are required" });
    }

    UserModel.findOne({ email })
        .then(user => {
            if (user) {
                // Check if user is verified
                if (!user.isVerified) {
                    return res.status(401).json({ 
                        message: "Please verify your email before logging in. Check your inbox for verification link." 
                    });
                }

                if (user.password === password) {
                    res.json({ message: "Success", user });
                } else {
                    res.status(401).json({ message: "The Password Was Incorrect" });
                }
            } else {
                res.status(404).json({ message: "User Does Not Exist" });
            }
        })
        .catch(error => {
            console.error("Error logging in:", error);
            res.status(500).json({ message: "Error logging in" });
        });
});

// RESEND VERIFICATION EMAIL ENDPOINT
app.post('/resend-verification', async (req, res) => {
    const { email } = req.body;

    if (!email) {
        return res.status(400).json({ message: "Email is required" });
    }

    try {
        const user = await UserModel.findOne({ email });

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        if (user.isVerified) {
            return res.status(400).json({ message: "User is already verified" });
        }

        // Generate new token
        const newToken = crypto.randomBytes(32).toString('hex');
        const tokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);

        user.verificationToken = newToken;
        user.tokenExpiry = tokenExpiry;
        await user.save();

        await sendVerificationEmail(email, user.name, newToken);

        res.status(200).json({ message: "Verification email sent successfully" });

    } catch (error) {
        console.error("Error resending verification:", error);
        res.status(500).json({ message: "Error sending verification email" });
    }
});

app.get('/user/:email', async (req, res) => {
    const { email } = req.params;
    try {
        const user = await UserModel.findOne({ email });
        if (user) {
            res.json({ user });
        } else {
            res.status(404).json({ message: "User not found" });
        }
    } catch (error) {
        console.error("Error fetching user:", error);
        res.status(500).json({ message: "Error fetching user" });
    }
});

// Basic health check endpoint
app.get('/', (req, res) => {
  try {
    res.status(200).send('Backend is running!');
  } catch (error) {
    console.error("Health check error:", error);
    res.status(500).send('Error: Backend health check failed.');
  }
});

app.listen(port, () => {
    console.log(`Server Is Running On Port: ${port}`)
})