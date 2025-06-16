//Imports & Stuff
const express = require('express')
const mongoose = require('mongoose')
const cors = require('cors')
const UserModel = require('./models/User.js')
const port = process.env.PORT || 4000

const app = express()
app.use(express.json())
app.use(cors())

// mongoDB Connection 
mongoose.connect('mongodb+srv://ayaanplayz18:COUWkUzm5BDFAnmk@cluster18.bodkggd.mongodb.net/')
.then(() => {
    console.log("MongoDB Connection Established");
})

// paths
app.post('/register', async (req, res) => {
    const { name, email, password, subject} = req.body;

    // Check for empty fields
    if (!name || !email || !password || !subject) {
        return res.status(400).json("All fields are required");
    }

    try {
        const existingUser = await UserModel.findOne({ email });
        if (existingUser) {
            return res.json("User Already Exists");
        }

        const newUser = await UserModel.create({ name, email, password, subject});
        res.json(newUser);
    } catch (error) {
        res.status(500).json("Error registering user");
    }
});

app.post('/login', (req, res) => {
    const { email, password } = req.body;
    UserModel.findOne({ email })
        .then(user => {
            if (user) {
                if (user.password === password) {
                    res.json({ message: "Success", user }); // Return user object
                } else {
                    res.json({ message: "The Password Was Incorrect" });
                }
            } else {
                res.json({ message: "User Does Not Exist" });
            }
        })
        .catch(error => {
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
        res.status(500).json({ message: "Error fetching user" });
    }
});

app.listen(port, () => {
    console.log(`Server Is Running On Port: ${port}`)
})
