const express = require("express");
const clc = require("cli-color");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const validator = require("validator");
const session = require("express-session");
const mongoDbSession = require("connect-mongodb-session")(session);
const ObjectId = require("mongodb").ObjectId;

//file imports
const { cleanUpAndValidate } = require("./utils/AuthUtils");
const UserSchema = require("./UserSchema");
const { isAuth } = require("./middleware/authMiddleware");
const TodoModel = require("./models/TodoModel");
const rateLimiting = require("./middleware/rateLimiting");

const app = express();
const PORT = process.env.PORT || 9700;
const saltRound = 10;

app.set("view engine", "ejs");
mongoose.set("strictQuery", true);

//mongoDb connection
const MONGO_URI = `mongodb+srv://srinivasmuchu41:fgj7YmbDvCQmMGgs@cluster1.chlbv4j.mongodb.net/todo-list`;
mongoose
  .connect(MONGO_URI)
  .then((res) => {
    console.log(clc.yellow("Connected to mongoDb"));
  })
  .catch((err) => {
    console.log(clc.red(err));
  });

//middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));

const store = new mongoDbSession({
  uri: MONGO_URI,
  collection: "sessions",
});

app.use(
  session({
    secret: "This is your todo APP",
    resave: false,
    saveUninitialized: false,
    store: store,
  })
);

//routes
app.get("/", (req, res) => {
  return res.send("This is your TODO APP");
});

app.get("/register", (req, res) => {
  return res.render("register");
});

app.get("/login", (req, res) => {
  return res.render("login");
});

app.post("/register", async (req, res) => {
  const { name, email, password, username } = req.body;

  //data cleaning
  try {
    await cleanUpAndValidate({ name, email, username, password });

    //check if the user exits

    let userExits;
    try {
      userExits = await UserSchema.findOne({ email });
    } catch (error) {
      return res.send({
        status: 401,
        message: "Data Base error",
        error: error,
      });
    }
    console.log(userExits);
    if (userExits) {
      return res.send({
        status: 400,
        message: "User already exits",
      });
    }

    //create user and store inside database

    const hashedPassword = await bcrypt.hash(password, saltRound);

    const user = new UserSchema({
      name: name,
      email: email,
      password: hashedPassword,
      username: username,
    });

    try {
      const userDb = await user.save();
      console.log(userDb);

      return res.status(200).redirect("/login");
    } catch (error) {
      return res.send({
        status: 401,
        message: "Data Base error",
        error: error,
      });
    }
  } catch (error) {
    return res.send({
      status: 401,
      error: error,
    });
  }
});

app.post("/login", async (req, res) => {
  //console.log(req.body);
  //validate data
  const { loginId, password } = req.body;

  if (!loginId || !password) {
    return res.send({
      status: 400,
      message: "Missing credentials",
    });
  }

  if (typeof loginId !== "string" || typeof password !== "string") {
    return res.send({
      status: 400,
      message: "Invalid data format",
    });
  }

  //identify the loginId and searched in the DB
  try {
    let userDb;
    if (validator.isEmail(loginId)) {
      userDb = await UserSchema.findOne({ email: loginId });
    } else {
      userDb = await UserSchema.findOne({ username: loginId });
    }

    //if user is not present
    if (!userDb) {
      return res.send({
        status: 402,
        message: "UserId does not exsit",
      });
    }

    //validate the password
    const isMatch = await bcrypt.compare(password, userDb.password);
    console.log(isMatch);
    if (!isMatch) {
      return res.send({
        status: 402,
        message: "Password does not match",
      });
    }

    req.session.isAuth = true;
    req.session.user = {
      username: userDb.username,
      email: userDb.email,
      userId: userDb._id,
    };

    return res.status(200).redirect("/dashboard");
  } catch (error) {
    return res.send({
      status: 401,
      message: "Data base error",
      error: error,
    });
  }

  //user.password
  //match the password (plaintextpassword,user.password)
});

// app.get("/homepage", isAuth, (req, res) => {
//   return res.send("This is your homepage");
// });

app.get("/dashboard", isAuth, async (req, res) => {
  // const username = req.session.user.username;
  // let todos = [];
  // try {
  //   todos = await TodoModel.find({ username: username });
  //   // console.log(todos);

  //   // return res.send({
  //   //   status:200,
  //   //   message: "Read success",
  //   //   data: todos
  //   // })
  // } catch (error) {
  //   return res.send({
  //     status: 400,
  //     message: "Database error",
  //     error: error,
  //   });
  // }

  return res.render("dashboard");
});

app.post("/logout", isAuth, (req, res) => {
  console.log(req.session);

  req.session.destroy((err) => {
    if (err) throw err;

    res.redirect("/login");
  });
});

app.post("/logout_from_all_devices", isAuth, async (req, res) => {
  const username = req.session.user.username;

  //create a session schema
  const Schema = mongoose.Schema;
  const sessionSchema = new Schema({ _id: String }, { strict: false });
  const sessionModel = mongoose.model("session", sessionSchema);

  try {
    const sessionDbDeletedCount = await sessionModel.deleteMany({
      //key:value
      "session.user.username": username,
    });

    console.log(sessionDbDeletedCount);

    return res.send({
      status: 200,
      message: "Logout from all devices successfully",
    });
  } catch (error) {
    return res.send({
      status: 400,
      message: "Logout unsuccessfull",
      error: error,
    });
  }
});

//todos routes

app.post("/create-item", isAuth, rateLimiting, async (req, res) => {
  // console.log(req.body);
  // console.log(req.session.user.username);

  const todoText = req.body.todo;
  const username = req.session.user.username;

  //data validation
  if (!todoText) {
    return res.send({
      status: 400,
      message: "Missing todo text",
    });
  }

  if (typeof todoText !== "string") {
    return res.send({
      status: 400,
      message: "Invalid todo format",
    });
  }

  // if (todoText.length < 3 || todoText.length > 50) {
  //   return res.send({
  //     status: 400,
  //     message: "Length of a todo should be in the range 3-50 charachters",
  //   });
  // }

  //create a todo and save in DB

  const todo = new TodoModel({
    todo: todoText,
    username: username,
  });

  try {
    const todoDb = await todo.save();
    // console.log(todoDb);

    return res.send({
      status: 201,
      message: "Todo Created successfully",
      data: todoDb,
    });
  } catch (error) {
    return res.send({
      status: 400,
      message: "Database error, Please try again.",
      error: error,
    });
  }
});

app.post("/edit-item", isAuth, rateLimiting, async (req, res) => {
  console.log(req.body);
  const id = req.body.id;
  const newData = req.body.newData;

  //data validation
  if (!id || !newData) {
    return res.send({
      status: 400,
      message: "Missing credentials",
    });
  }

  if (typeof newData !== "string") {
    return res.send({
      status: 400,
      message: "Invalid todo format",
    });
  }

  if (newData.length < 3 || newData.length > 50) {
    return res.send({
      status: 400,
      message: "Length of a todo should be in the range 3-50 charachters",
    });
  }

  //find the todo and match the owner
  try {
    const todo = await TodoModel.findOne({ _id: ObjectId(id) });

    if (!todo) {
      return res.send({
        status: 401,
        message: "Todo not found",
      });
    }

    //check the owner
    if (todo.username !== req.session.user.username) {
      return res.send({
        status: 401,
        message: "Authorization failed to update the todo",
      });
    }

    const todoDb = await TodoModel.findOneAndUpdate(
      { _id: id },
      { todo: newData }
    );

    return res.send({
      status: 201,
      message: "todo updated successfully",
      data: todoDb,
    });
  } catch (error) {
    console.log(error);
    return res.send({
      status: 400,
      message: "Database error",
      error: error,
    });
  }
});

app.post("/delete-item", isAuth, async (req, res) => {
  const id = req.body.id;

  if (!id) {
    return res.send({
      status: 400,
      message: "Missing credentials",
    });
  }

  //find the todo

  try {
    const todo = await TodoModel.findOne({ _id: ObjectId(id) });

    if (!todo) {
      return res.send({
        status: 401,
        message: "Todo not found",
      });
    }

    //check the ownership

    if (todo.username !== req.session.user.username) {
      return res.send({
        status: 400,
        message: "Authorization failed to delete the todo",
      });
    }

    const todoDb = await TodoModel.findOneAndDelete({ _id: ObjectId(id) });

    return res.send({
      status: 200,
      message: "Todo Deleted Successfully",
      data: todoDb,
    });
  } catch (error) {
    return res.send({
      status: 400,
      message: "Database error",
      error: error,
    });
  }
});

//pagination
//pagination_dashboard?skip=10
app.get("/pagination_dashboard", isAuth, async (req, res) => {
  const skip = req.query.skip || 0; //client
  const LIMIT = 5; //backend

  const username = req.session.user.username;

  try {
    //mongodb aggregate
    let todos = await TodoModel.aggregate([
      { $match: { username: username } },
      {
        $facet: {
          data: [{ $skip: parseInt(skip) }, { $limit: LIMIT }],
        },
      },
    ]);

    // console.log(todos[0].data);
    return res.send({
      status: 200,
      message: "Read Successfull",
      data: todos,
    });
  } catch (err) {
    return res.send({
      status: 400,
      message: "Read unsuccessfull",
      error: err,
    });
  }
});

app.listen(PORT, () => {
  console.log(clc.yellow("App is running at "));
  console.log(clc.blue.underline(`http://localhost:${PORT}`));
});

//Registeration Page
//UI
//Get and Post
//User creation in Db

//Login
//UI
//Get and Post
//Comparison of password

//Session bases Auth
//isAuth middleware

//Dashboard Page
//UI
//logout
//logout from all devices

//backend
//todo Schema
//route to create a todo
//route to edit a todo
//route to delete a todo

//browser.js
//axios  create, read, update, delete. (CRUD) (Frontend)

//optimization
//pagination
//rate-limiting

//Deployment

//localhost <--> github <---> railway
