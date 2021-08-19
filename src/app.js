const express = require("express");
const cors = require("cors");
const path = require("path");
require("./db/mongoose");

const userRouter = require("./routers/user");
const postRouter = require("./routers/post");

const app = express();

app.use(cors());
app.use(express.json());

if (process.env.NODE_ENV === "production") {
  app.use(express.static(path.join(__dirname, "client/build")));

  app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "client/build", "index.html"));
  });
}

app.get("/service-worker.js", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "build", "service-worker.js"));
});

app.use("/users", userRouter);
app.use("/posts", postRouter);

module.exports = app;
