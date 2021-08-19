const express = require("express");
const bcrypt = require("bcryptjs");
const multer = require("multer");
const sharp = require("sharp");

const User = require("../models/user");
const Post = require("../models/post");
const auth = require("../middleware/auth");

const router = new express.Router();

// Create user
router.post("", async (req, res) => {
  const user = new User(req.body);

  try {
    await user.save();
    const token = await user.generateAuthToken();
    res.status(201).send({ user, token });
  } catch (e) {
    res.status(400).send(e);
  }
});

// Login
router.post("/login", async (req, res) => {
  try {
    const user = await User.findByCredentials(
      req.body.email,
      req.body.password
    );
    const token = await user.generateAuthToken();
    res.send({ user, token });
  } catch (e) {
    res.status(400).send(e);
  }
});

// Logout current
router.post("/logout", auth, async (req, res) => {
  try {
    req.user.tokens = req.user.tokens.filter(
      (token) => token.token !== req.token
    );
    await req.user.save();
    res.send();
  } catch (e) {
    res.status(500).send(e);
  }
});

// Logout all
router.post("/logoutAll", auth, async (req, res) => {
  try {
    req.user.tokens = [];
    await req.user.save();
    res.send();
  } catch (e) {
    res.status(500).send(e);
  }
});

// Get user's profile
router.get("/me", auth, async (req, res) => {
  await req.user.populate("posts.post").execPopulate();
  res.send(req.user);
});

// Get other user's profile
router.get("/:id", auth, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    //
    const match = {};
    const sort = {};

    if (req.query.sortBy) {
      const parts = req.query.sortBy.split(":");
      sort[parts[0]] = parts[1] === "desc" ? -1 : 1;
    }

    // await user
    //   .populate({
    //     path: "posts",
    //     match,
    //     options: {
    //       limit: parseInt(req.query.limit),
    //       skip: parseInt(req.query.skip),
    //       sort,
    //     },
    //   })
    //   .execPopulate();

    if (!user.posts) {
      return res.send({ user, userPosts: [] });
    }
    await user.populate("posts.post").execPopulate();
    res.send({ user, userPosts: user.posts });
  } catch (e) {
    res.status(404).send(e);
  }
});

// Update user
router.patch("/me", auth, async (req, res) => {
  const updates = Object.keys(req.body);
  const allowedUpdates = ["username", "email", "password"];

  const isValid = updates.every((item) => {
    return allowedUpdates.includes(item);
  });

  if (!isValid) return res.status(400).send("Property not found.");

  try {
    const user = req.user;

    updates.forEach((update) => (user[update] = req.body[update]));

    await user.save();

    res.send(user);
  } catch (e) {
    res.status(400).send(e);
  }
});

// Delete user
router.delete("/me", auth, async (req, res) => {
  try {
    await req.user.remove();

    res.send(req.user);
  } catch (e) {
    res.status(500).send(e);
  }
});

// Upload user avatar
const upload = multer({
  // dest: 'avatars',
  limits: {
    fileSize: 10000000,
  },
  fileFilter(req, file, cb) {
    // cb(new Error('File must be a PDF.'))
    // cb(undefined, true)
    // cb(undefined, false)
    if (!file.originalname.match(/\.(jpg|jpeg|png)$/)) {
      return cb(new Error("Please upload an image"));
    }
    cb(undefined, true);
  },
});

//
router.post(
  "/me/avatar",
  auth,
  upload.single("avatar"),
  async (req, res) => {
    const buffer = await sharp(req.file.buffer)
      .resize({ width: 250, height: 250 })
      .png()
      .toBuffer();
    req.user.avatar = buffer;
    await req.user.save();

    res.send();
  },
  (error, req, res, next) => {
    res.status(400).send({ error: error.message });
  }
);

// Delete user avatar
router.delete("/me/avatar", auth, async (req, res) => {
  req.user.avatar = undefined;
  await req.user.save();

  res.send(req.user);
});

// Get user avatar
router.get("/:id/avatar", async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user || !user.avatar) {
      throw new Error();
    }
    res.set("Content-Type", "image/png");
    res.send(user.avatar);
  } catch (e) {
    res.status(404).send();
  }
});

// Search User
router.post("/search", auth, async (req, res) => {
  try {
    const { username } = req.body;

    if (username === "" || username === " ") {
      return res.send([]);
    }

    let users = await User.find({
      username: { $regex: username },
    });

    users = users.filter((user) => user._id != req.user._id.toString());

    res.send(users);
  } catch (e) {
    res.status(400).send();
  }
});

// Follow a user
router.post("/follow", auth, async (req, res) => {
  try {
    const { userId } = req.body;
    const otherUser = await User.findById(userId);

    const isFollower =
      req.user.follows.length &&
      req.user.follows.every((follow) => follow.follow != otherUser._id);
    console.log({ isFollower });

    if (isFollower) {
      console.log("c");
      return res.send();
    }
    console.log("a");
    req.user.follows = req.user.follows.concat({ follow: otherUser._id });
    otherUser.followers = otherUser.followers.concat({
      follower: req.user._id,
    });
    await req.user.save();
    await otherUser.save();
    console.log("b");
    res.send({ otherUser, user: req.user });
  } catch (e) {
    res.status(404).send(e);
  }
});

// Unfollow a user
router.post("/unfollow", auth, async (req, res) => {
  try {
    const { userId } = req.body;
    const otherUser = await User.findById(userId);

    req.user.follows = req.user.follows.filter(
      (follow) => follow.follow != userId
    );
    otherUser.followers = otherUser.followers.filter(
      (follower) => follower.follower != req.user._id.toString()
    );
    await otherUser.save();
    await req.user.save();

    res.send({ otherUser, user: req.user });
  } catch (e) {
    console.log({ e });
    res.status(404).send(e);
  }
});

module.exports = router;
