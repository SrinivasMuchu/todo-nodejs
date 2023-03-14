const validator = require("validator");

const cleanUpAndValidate = ({ name, email, password, username }) => {
  return new Promise((resolve, reject) => {
    if (!email || !username || !name || !password) {
      reject("Missing credentials");
    }
    if (typeof email !== "string") reject("Invalid Email");
    if (typeof username !== "string") reject("Invalid Username");
    if (typeof password !== "string") reject("Invalid Password");

    if (!validator.isEmail(email)) reject("Invalid Email Format");

    if (username.length <= 2 || username.length > 50)
      reject("Username should be 3 to 50 char");

    if (password.length <= 2 || username.length > 25)
      reject("password should be 3 to 25 char");

    resolve();
  });
};

module.exports = { cleanUpAndValidate };
