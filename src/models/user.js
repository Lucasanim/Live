const mongoose = require("mongoose");
const validator = require("validator");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const Post = require("./post");
const Comment = require("./comment");

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      unique: true,
      required: true,
      trim: true,
      lowercase: true,
      validate(value) {
        if (!validator.isEmail(value)) {
          throw new Error("Email is invalid");
        }
      },
    },
    password: {
      required: true,
      type: String,
      trim: true,
      minlength: 6,
      validate(value) {
        if (value.toLowerCase().includes("password")) {
          throw new Error("Password can't contain 'password'");
        }
      },
    },
    tokens: [
      {
        token: {
          type: String,
          required: true,
        },
      },
    ],
    avatar: {
      type: Buffer,
    },
    posts: [
      {
        post: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Post",
        },
      },
    ],
    followers: [
      {
        follower: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
      },
    ],
    follows: [
      {
        follow: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
      },
    ],
  },
  {
    timestamps: true,
  }
);

//relasionship with post
// userSchema.virtual("posts", {
//   ref: "Post",
//   localField: "_id",
//   foreignField: "owner",
// });
//relasionship with likes
userSchema.virtual("likes", {
  ref: "Post",
  localField: "_id",
  foreignField: "likes.like",
});
//relasionship with comments
userSchema.virtual("comments", {
  ref: "Comment",
  localField: "_id",
  foreignField: "owner",
});

//relasionship with self followers
// userSchema.virtual("followers", {
//   ref: "User",
//   localField: "follower",
//   foreignField: "owner",
// });
//relasionship with comments
// userSchema.virtual("comments", {
//   ref: "Comment",
//   localField: "_id",
//   foreignField: "owner",
// });

// getPublicProfile
userSchema.methods.toJSON = function () {
  const user = this;
  const userObject = user.toObject();

  delete userObject.password;
  delete userObject.tokens;
  // delete userObject.avatar;

  return userObject;
};

// Generate auth token
userSchema.methods.generateAuthToken = async function () {
  const user = this;

  const token = await jwt.sign(
    { _id: user._id.toString() },
    process.env.JWT_SECRET
  );

  user.tokens = user.tokens.concat({ token });
  await user.save();

  return token;
};

// findByCredentials
userSchema.statics.findByCredentials = async (email, password) => {
  const user = await User.findOne({ email });
  if (!user) {
    throw new Error("Unable to login");
  }

  const isMatch = await bcrypt.compare(password, user.password);

  if (!isMatch) {
    throw new Error("Unable to login");
  }

  return user;
};

// Hash password
userSchema.pre("save", async function (next) {
  const user = this;

  if (user.isModified("password")) {
    user.password = await bcrypt.hash(user.password, 8);
  }

  next();
});

//Delete user's posts and comments when user is removed
userSchema.pre("remove", async function (next) {
  const user = this;

  await Post.deleteMany({ owner: user._id });
  await Comment.deleteMany({ owner: user._id });

  next();
});

const User = mongoose.model("User", userSchema);

module.exports = User;
