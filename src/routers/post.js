const express = require("express");

const Post = require("../models/post");
const auth = require("../middleware/auth");
const multer = require("multer");
const sharp = require("sharp");
const User = require("../models/user");

const router = new express.Router();

// Create new post
router.post("", auth, async (req, res) => {
  const post = new Post({
    ...req.body,
    owner: req.user._id,
  });
  try {
    req.user.posts = req.user.posts.concat({ post });
    await post.save();
    await req.user.save();
    res.status(201).send(post);
  } catch (e) {
    res.status(400).send(e);
  }
});

// Get user's posts
router.get("/self", auth, async (req, res) => {
  const match = {};
  const sort = {};

  if (req.query.sortBy) {
    const parts = req.query.sortBy.split(":");
    sort[parts[0]] = parts[1] === "desc" ? -1 : 1;
  }

  try {
    // await req.user
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

    if (!req.user.posts) {
      return res.status(404).send();
    }

    await req.user
      .populate({
        path: "posts.post",
        options: {
          // sort: { createdAt: -1 },
        },
      })
      .execPopulate();

    res.send(req.user.posts);
  } catch (e) {
    res.status(500).send(e);
  }
});

// Get follows's posts
router.get("/", auth, async (req, res) => {
  // const match = {};
  // const sort = {};

  // if (req.query.sortBy) {
  //   const parts = req.query.sortBy.split(":");
  //   sort[parts[0]] = parts[1] === "desc" ? -1 : 1;
  // }

  try {
    // await req.user.populate({
    //   path: "follows.follow",
    //   populate: {
    //     path: "posts.post",
    //     populate: {
    //       path: "owner",
    //     },
    //   },
    // });

    await req.user
      .populate({
        path: "follows",
        populate: {
          path: "follow",
          populate: {
            path: "posts",
            populate: {
              path: "post",
              Option: {
                sort: { updatedAt: 1 },
              },
              populate: {
                path: "owner",
              },
            },
          },
        },
      })
      .execPopulate();

    // await req.user.populate("follows.follow").execPopulate();
    // await req.user
    //   .populate({
    //     path: "follows.follow.posts.post",
    //     options: {
    //       sort: { createdAt: 1 },
    //     },
    //   })
    //   .execPopulate();
    // await req.user.populate("follows.follow.posts.post.owner").execPopulate();

    let posts = [];

    for (const follow of req.user.follows) {
      posts = posts.concat(follow.follow.posts);
    }

    res.send(posts);
  } catch (e) {
    res.status(500).send(e);
  }
});

// Get determined post
router.get("/:id", auth, async (req, res) => {
  const { id } = req.params;

  try {
    const post = await Post.findOne({
      _id: id,
      // owner: req.user._id
    });

    if (!post) {
      return res.status(404).send();
    }

    res.send(post);
  } catch (e) {
    res.status(500).send(e);
  }
});

// Update post
router.patch("/:id", auth, async (req, res) => {
  const { id } = req.params;

  const updates = Object.keys(req.body);
  const allowedUpdates = ["description"];
  const isValid = updates.every((item) => allowedUpdates.includes(item));

  if (!isValid) {
    return res.status(400).send();
  }

  try {
    const post = await Post.findOne({
      _id: id,
      owner: req.user._id,
    });

    if (!post) {
      return res.status(404).send();
    }

    updates.forEach((update) => (post[update] = req.body[update]));

    await post.save();

    res.send(post);
  } catch (e) {
    res.status(400).send(e);
  }
});

// Delete post
router.delete("/:id", auth, async (req, res) => {
  const { id } = req.params;

  try {
    const post = await Post.findOneAndDelete({
      _id: id,
      owner: req.user._id,
    });

    if (!post) {
      return res.status(404).send();
    }

    res.send(post);
  } catch (e) {
    res.status(500).send(e);
  }
});

// Post image
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

// Upload post image
router.post(
  "/:id/image",
  auth,
  upload.single("image"),
  async (req, res) => {
    const { id } = req.params;

    const post = await Post.findOne({
      _id: id,
      owner: req.user._id,
    });

    const buffer = await sharp(req.file.buffer).png().toBuffer();
    // const buffer = await sharp(req.file.buffer).resize({width: 250, height: 250}).png().toBuffer()
    post.image = buffer;
    await post.save();

    res.send(post);
  },
  (error, req, res, next) => {
    res.status(400).send({ error: error.message });
  }
);

// delete post image
router.delete("/:id/image", auth, async (req, res) => {
  const { id } = req.params;

  const post = await Post.findOne({
    _id: id,
    owner: req.user._id,
  });

  post.image = undefined;
  await post.save();

  res.send(post);
});

//Get post image
router.get("/:id/image", async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);

    if (!post || !post.image) {
      throw new Error();
    }
    res.set("Content-Type", "image/png");
    res.send(post.image);
  } catch (e) {
    res.status(404).send();
  }
});

// Like a post
router.post("/like/:id", auth, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);

    if (!post) {
      throw new Error();
    }

    post.likes = post.likes.concat({ like: req.user });
    await post.save();

    res.send();
  } catch (e) {
    res.status(404).send();
  }
});

// DisLike a post
router.post("/dislike/:id", auth, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);

    if (!post) {
      throw new Error();
    }

    post.likes = post.likes.filter((like) => like.like != req.user._id);
    await post.save();

    res.send();
  } catch (e) {
    res.status(404).send();
  }
});

module.exports = router;
