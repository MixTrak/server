//Imports & Stuff
const express = require('express')
const mongoose = require('mongoose')
const cors = require('cors')
const UserModel = require('./models/User.js')
const port = process.env.PORT || 4000

const app = express()
app.use(express.json())

// --- START CORS Configuration ---
// Define your allowed frontend origins. REPLACE WITH YOUR ACTUAL VERCEL FRONTEND URL!
const allowedOrigins = [
  'https://server-green-nu.vercel.app', // <-- IMPORTANT: Replace with your actual Vercel domain!
  // Add other origins if needed, e.g., for local development if your backend is also deployed
  // 'http://localhost:5173', // Example for local Vite development
  // 'http://localhost:3000', // Example for local React development
  // 'https://your-custom-domain.com', // If you have a custom domain for your frontend
];

const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    // or if the origin is in our allowed list
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'], // Specify allowed HTTP methods
  allowedHeaders: ['Content-Type', 'Authorization'], // Specify allowed headers
  credentials: true // Allow sending of cookies/authorization headers if applicable
};

app.use(cors(corsOptions)); // Use the configured CORS middleware
// --- END CORS Configuration ---


// mongoDB Connection
mongoose.connect('mongodb+srv://ayaanplayz18:COUWkUzm5BDFAnmk@cluster18.bodkggd.mongodb.net/')
.then(() => {
    console.log("MongoDB Connection Established");
})
.catch(err => { 
    console.error("MongoDB Connection Error:", err);
});

// paths
app.post('/register', async (req, res) => {
    const { name, email, password } = req.body;

    // Check for empty fields
    if (!name || !email || !password) {
        return res.status(400).json("All fields are required");
    }
    // Check for valid name
    if (typeof name !== 'string' && name.trim() === ' ') {
        return res.status(400).json("Invalid name");
    }
    // Fix password validation logic
    if (password.length < 8) {
        return res.status(400).json("Password must be at least 8 characters long");
    }
    if (password.trim() === ' ') {
        return res.status(400).json("Invalid password");
    }

    try {
        const existingUser = await UserModel.findOne({ email });
        if (existingUser) {
            return res.status(409).json("User Already Exists"); // Use 409 Conflict for duplicate resource
        }

        const newUser = await UserModel.create({ name, email, password });
        res.status(201).json(newUser); // 201 Created for successful resource creation
    } catch (error) {
        console.error("Error during registration:", error);
        res.status(500).json("Error registering user");
    }
});

app.post('/login', (req, res) => {
    const { email, password } = req.body;
    // Add validation for empty fields for login
    if (!email || !password) {
        return res.status(400).json({ message: "Email and password are required" });
    }

    UserModel.findOne({ email })
        .then(user => {
            if (user) {
                if (user.password === password) {
                    // In a real app, you'd generate a JWT token here and send it back
                    // For now, sending the user object is okay for demonstration
                    res.json({ message: "Success", user });
                } else {
                    res.status(401).json({ message: "The Password Was Incorrect" }); // 401 Unauthorized
                }
            } else {
                res.status(404).json({ message: "User Does Not Exist" }); // 404 Not Found for non-existent user
            }
        })
        .catch(error => {
            console.error("Error logging in:", error); // Log the actual error
            res.status(500).json({ message: "Error logging in" });
        });
});

app.get('/user/:email', async (req, res) => {
    const { email } = req.params;
    try {
        const user = await UserModel.findOne({ email });
        if (user) {
            res.json({ user }); // Wrap the user object in a key
        } else {
            res.status(404).json({ message: "User not found" });
        }
    } catch (error) {
        console.error("Error fetching user:", error); // Log the actual error
        res.status(500).json({ message: "Error fetching user" });
    }
});

// Basic health check endpoint
app.get('/', (req, res) => {
    res.status(200).send('Backend is running!');
});

app.listen(port, () => {
    console.log(`Server Is Running On Port: ${port}`)
})