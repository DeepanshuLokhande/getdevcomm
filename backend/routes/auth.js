const express = require("express");
const jwt = require("jsonwebtoken");
const axios = require("axios");
const { body, validationResult } = require("express-validator");
const User = require("../models/User");

const router = express.Router();

// Generate JWT Token
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || "7d",
  });
};

// @route   POST /api/auth/register
// @desc    Register a new user
// @access  Public
router.post(
  "/register",
  [
    body("name").trim().notEmpty().withMessage("Name is required"),
    body("email").isEmail().withMessage("Please provide a valid email"),
    body("password")
      ?.isLength({ min: 6 })
      .withMessage("Password must be at least 6 characters"),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array(),
        });
      }

      const { name, email, password } = req.body;

      // Check if user already exists
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: "User already exists with this email",
        });
      }

      // Create user
      const user = await User.create({
        name,
        email,
        password,
      });

      const token = generateToken(user._id);

      res.status(201).json({
        success: true,
        token,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          techStack: user.techStack,
        },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Server error",
        error: error.message,
      });
    }
  }
);

// @route   POST /api/auth/login
// @desc    Login user
// @access  Public
router.post(
  "/login",
  [
    body("email").isEmail().withMessage("Please provide a valid email"),
    body("password").notEmpty().withMessage("Password is required"),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array(),
        });
      }

      const { email, password } = req.body;

      // Check if user exists and get password
      const user = await User.findOne({ email }).select("+password");
      if (!user || !user.password) {
        return res.status(401).json({
          success: false,
          message: "Invalid credentials",
        });
      }

      // Check password
      const isMatch = await user.comparePassword(password);
      if (!isMatch) {
        return res.status(401).json({
          success: false,
          message: "Invalid credentials",
        });
      }

      const token = generateToken(user._id);

      res.json({
        success: true,
        token,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          techStack: user.techStack,
        },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Server error",
        error: error.message,
      });
    }
  }
);

// @route  GET /api/auth/google
//@desc   Google OAuth
//@access Public

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI;

router.get("/google", (req, res) => {
  const scope = [
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/userinfo.profile",
  ].join(" ");

  const redirectUrl =
    `https://accounts.google.com/o/oauth2/v2/auth?` +
    `client_id=${GOOGLE_CLIENT_ID}&` +
    `redirect_uri=${REDIRECT_URI}&` +
    `response_type=code&` +
    `scope=${scope}&` +
    `access_type=offline`;

  res.redirect(redirectUrl);
});

// @route GET /api/auth/google/callback
// @desc Google OAuth callback
// @access Public

router.get("/google/callback", async (req, res) => {
  const code = req.query.code;
  if (!code) {
    return res.status(400).json({ message: "Missing authorization token" });
  }
  try {
    // Exchange authorization code for tokens
    const params = new URLSearchParams({
      code,
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      redirect_uri: REDIRECT_URI,
      grant_type: "authorization_code",
    });
    const tokenResponse = await axios.post(
      "https://oauth2.googleapis.com/token",
      params,
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
    );

    const { access_token } = tokenResponse.data;

    // Get user info
    const userInfoResponse = await axios.get(
      "https://www.googleapis.com/oauth2/v2/userinfo",
      {
        headers: { Authorization: `Bearer ${access_token}` },
      }
    );

const { email, name, id, verified_email } = userInfoResponse.data;
    if (!verified_email) {
      return res.status(401).json({ message: "Google email not verified" });
    }
    const existingUser = await User.findOne({ email });
    let userDoc;
    if (existingUser) {
      existingUser.googleId = existingUser.googleId || id;
      await existingUser.save();
      userDoc = existingUser;
    } else {
      const username = name || email.split("@")[0] + Math.floor(Math.random() * 10000);
      userDoc = await User.create({
        name: username,
        email: email,
        googleId: id,
        password: null,
      });
    }

    // Generate JWT using same helper to keep claims consistent
    const token = generateToken(userDoc._id);

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    res.cookie('token', token, { httpOnly: true, secure: true, sameSite: 'Lax' });
    res.redirect(`${frontendUrl}/oauth/callback`);
  } catch (error) {
    console.error("Error during Google OAuth", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

// @route   GET /api/auth/me
// @desc    Get current user
// @access  Private
router.get("/me", require("../middleware/auth").protect, async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
      .populate("joinedCommunities.communityId")
      .populate("savedCommunities");

    res.json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        techStack: user.techStack,
        joinedCommunities: user.joinedCommunities,
        savedCommunities: user.savedCommunities,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
});

module.exports = router;
