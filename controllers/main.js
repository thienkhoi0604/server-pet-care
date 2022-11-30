const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const sendMail = require("./mailer.js");
const sendLink = require("./mailer.js");
const { google } = require("googleapis");
const { OAuth2 } = google.auth;
const fetch = require("node-fetch");

const { CLIENT_URL } = process.env;

const client = new OAuth2(process.env.MAILING_SERVICE_CLIENT_ID);

const getAllAccounts = (req, res, db) => {
  db.select("*")
    .from("ACCOUNT")
    .then((items) => {
      if (items.length) {
        res.json(items);
      } else {
        res.json({ dataExists: "false" });
      }
    })
    .catch((err) => res.status(400).json({ dbError: "db error" }));
};

const getAccountAndGroup = async (req, res, db) => {
  await db
    .select("id_member")
    .where({
      email: req.query.email,
    })
    .from("ACCOUNT")
    .then((item) => {
      if (item.length) {
        const key = item[0]["id_member"];
        db.select("id_group", "name", "role")
          .where({
            member: key,
          })
          .from("MEMBER_GROUP")
          .join("GROUP", "id_group", "=", "id")
          .then((result) => {
            if (result.length) {
              res.json(result);
            } else {
              res.json({ dataExists: "false" });
            }
          });
      } else {
        res.json({ dataExists: "false" });
      }
    })
    .catch((err) =>
      res.status(400).json({ dbError: "get groups of member fail" })
    );
};

const getAllGroup = (req, res, db) => {
  db.select("*")
    .from("GROUP")
    .then((items) => {
      if (items.length) {
        res.json(items);
      } else {
        res.json({ dataExists: "false" });
      }
    })
    .catch((err) => res.status(400).json({ dbError: "db error" }));
};

const getMemberofGroupById = (req, res, db) => {
  db.select("email", "fullname", "telephone", "role")
    .from("ACCOUNT")
    .join("MEMBER_GROUP", "member", "=", "id_member")
    .where({
      id_group: req.query.id_group,
    })
    .then((items) => {
      if (items.length) {
        res.json(items);
      } else {
        res.json({ dataExists: "false" });
      }
    })
    .catch((err) =>
      res.status(400).json({ dbError: "get groups of member fail" })
    );
};

const postAccount = async (req, res, db, saltRounds) => {
  try {
    const { password, fullname, email, telephone } = req.body;
    const activation_token = createActivationToken({
      password,
      fullname,
      email,
      telephone,
    });
    const url = `${CLIENT_URL}/crud/${activation_token}`;
    sendMail(email, url, "Verify your email address");
    res.json({ msg: "Register Success! Please activate your email to start." });
  } catch (err) {
    return res.status(500).json({ msg: err.message });
  }
  // bcrypt.genSalt(Number(saltRounds), function (err, salt) {
  //   bcrypt.hash(password, salt, function (err, hash) {
  //     db("ACCOUNT")
  //       .insert({ email, fullname, password: hash, telephone })
  //       .returning("*")
  //       .then((item) => {
  //         res.json(item);
  //       })
  //       .catch((err) => res.status(400).json({ dbError: "db error" }));
  //   });
  // });
};

const postLink = async (req, res, db) => {
  try {
    const { id_group, email } = req.body;
    const activation_token = createActivationToken({
      id_group,
      email,
    });
    const url = `${CLIENT_URL}/${id_group}/${activation_token}`;
    sendLink(email, url, "Join group");
    res.json({ msg: "Join Success!" });
  } catch (err) {
    return res.status(500).json({ msg: err.message });
  }
};

const activateEmail = async (req, res, db) => {
  try {
    const { activation_token } = req.body;
    const user = jwt.verify(
      activation_token,
      process.env.ACTIVATION_TOKEN_SECRET
    );

    const { email, fullname, password, telephone } = user;
    await db("ACCOUNT")
      .select("*")
      .from("ACCOUNT")
      .where({
        email: email,
      })
      .then((items) => {
        if (items.length) {
          res.status(400).json({ dbError: "This email already exists." });
          return;
        }
      });

    await db("ACCOUNT")
      .insert({ email, fullname, password, telephone })
      .returning("*")
      .then((item) => {
        res.json({ msg: "Account has been activated!" });
      })
      .catch((err) => res.status(400).json({ dbError: "db error" }));
  } catch (err) {
    return res.status(500).json({ msg: err.message });
  }
};

const acceptInvitation = async (req, res, db) => {
  try {
    const { activation_token } = req.body;

    const invite = jwt.verify(
      activation_token,
      process.env.ACTIVATION_TOKEN_SECRET
    );

    const { email, id_group } = invite;
    await db
      .select("id_member")
      .where({
        email: email,
      })
      .from("ACCOUNT")
      .then((item) => {
        if (item.length) {
          const key = item[0]["id_member"];
          db.select("*")
            .where({
              member: key,
              id_group: id_group,
            })
            .from("MEMBER_GROUP")
            .then((result) => {
              if (result.length) {
                res.status(400).json({
                  dbError: "This email already exists in this group.",
                });
              } else {
                db("MEMBER_GROUP")
                  .insert({ member: key, id_group: id_group, role: "member" })
                  .returning("*")
                  .then((item) => {
                    res.json({ msg: "Account has been joined group" });
                  })
                  .catch((err) =>
                    res.status(400).json({ dbError: "db error" })
                  );
              }
            });
        }
      });
  } catch (err) {
    return res.status(500).json({ msg: err.message });
  }
};

const postGroup = async (req, res, db) => {
  const { name, user } = req.body;
  let value = {};
  db("GROUP")
    .insert({ name })
    .returning("*")
    .then((item) => {
      const key = item[0]["id"];
      value.id = key;

      db.select("id_member")
        .where({
          email: user,
        })
        .from("ACCOUNT")
        .then((item) => {
          value.user = item[0]["id_member"];

          db("MEMBER_GROUP")
            .insert({ member: value.user, id_group: value.id, role: "owner" })
            .returning("*")
            .then((item_2) => {
              res.json(item_2);
            })
            .catch((err) => res.status(400).json({ dbError: "db error" }));
        })
        .catch((err) => res.status(400).json({ dbError: "db error" }));
    })
    .catch((err) => res.status(400).json({ dbError: "db error" }));
};

const getAccessToken = (req, res) => {
  try {
    const rf_token = req.cookies.refreshtoken;
    if (!rf_token) return res.status(400).json({ msg: "Please login now!" });

    jwt.verify(rf_token, process.env.REFRESH_TOKEN_SECRET, (err, user) => {
      if (err) return res.status(400).json({ msg: "Please login now!" });

      const access_token = createAccessToken({ id: user.id });
      res.json({ access_token });
    });
  } catch (err) {
    return res.status(500).json({ msg: err.message });
  }
};

const googleLogin = async (req, res, db) => {
  try {
    const { tokenId } = req.body;

    const verify = await client.verifyIdToken({
      idToken: tokenId,
      audience: process.env.MAILING_SERVICE_CLIENT_ID,
    });

    const { email_verified, email, name, picture } = verify.payload;

    const password = email + process.env.GOOGLE_SECRET;

    const passwordHash = await bcrypt.hash(password, 12);

    if (!email_verified)
      return res.status(400).json({ msg: "Email verification failed." });

    await db("ACCOUNT")
      .select("*")
      .from("ACCOUNT")
      .where({
        email: email,
      })
      .then((items) => {
        if (items.length) {
          // const refresh_token = createRefreshToken({ id: items._id });
          // res.cookie("refreshtoken", refresh_token, {
          //   httpOnly: true,
          //   path: "/refresh_token",
          //   maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
          // });

          res.json({ msg: "Login success!", user: email });
        } else {
          const newUser = {
            name,
            email,
            password: passwordHash,
            avatar: picture,
          };
          db("ACCOUNT")
            .insert({ email: newUser.name, fullname: newUser.name, password })
            .returning("*")
            .then((item) => {
              res.json({ msg: { mess: "Login success!", item }, user: email });
            })
            .catch((err) => res.status(400).json({ dbError: "db error" }));

          // const refresh_token = createRefreshToken({ id: newUser._id });
          // res.cookie("refreshtoken", refresh_token, {
          //   httpOnly: true,
          //   path: "/refresh_token",
          //   maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
          // });
        }
      })
      .catch((err) => {
        console.log("error: ", err);
      });
  } catch (err) {
    return res.status(500).json({ msg: err.message });
  }
};

const facebookLogin = async (req, res, db) => {
  try {
    const { accessToken, userID } = req.body;

    const URL = `https://graph.facebook.com/v2.9/${userID}/?fields=id,name,email,picture&access_token=${accessToken}`;

    const data = await fetch(URL)
      .then((res) => res.json())
      .then((res) => {
        return res;
      });
    const { email, name, picture } = data;

    const password = email + process.env.FACEBOOK_SECRET;

    const passwordHash = await bcrypt.hash(password, 12);

    await db("ACCOUNT")
      .select("*")
      .from("ACCOUNT")
      .where({
        email: email,
      })
      .then((items) => {
        if (items.length) {
          // const refresh_token = createRefreshToken({ id: items._id });
          // res.cookie("refreshtoken", refresh_token, {
          //   httpOnly: true,
          //   path: "/refresh_token",
          //   maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
          // });

          res.json({ msg: "Login success!", user: email });
        } else {
          const newUser = {
            name,
            email,
            password: passwordHash,
            avatar: picture.data.url,
          };
          db("ACCOUNT")
            .insert({ email: newUser.name, fullname: newUser.name, password })
            .returning("*")
            .then((item) => {
              res.json({ msg: { mess: "Login success!", item }, user: email });
            })
            .catch((err) => res.status(400).json({ dbError: "db error" }));
          // const refresh_token = createRefreshToken({ id: newUser._id });
          // res.cookie("refreshtoken", refresh_token, {
          //   httpOnly: true,
          //   path: "/refresh_token",
          //   maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
          // });
        }
      })
      .catch((err) => {
        console.log("error: ", err);
      });
  } catch (err) {
    return res.status(500).json({ msg: err.message });
  }
};

const deleteMember = async (req, res, db) => {
  await db
    .select("id_member")
    .where({
      email: req.body.member,
    })
    .from("ACCOUNT")
    .then((item) => {
      db("MEMBER_GROUP")
        .del()
        .where({
          id_group: req.body.id_group,
          member: item[0]["id_member"],
        })
        .then((result) => {
          res.json(result);
        })
        .catch((err) => res.status(400).json({ dbError: "db error" }));
    })
    .catch((err) => res.status(400).json({ msg: err.message }));
};

const createActivationToken = (payload) => {
  return jwt.sign(payload, process.env.ACTIVATION_TOKEN_SECRET, {
    expiresIn: "5m",
  });
};

const createAccessToken = (payload) => {
  return jwt.sign(payload, process.env.ACCESS_TOKEN_SECRET, {
    expiresIn: "15m",
  });
};

const createRefreshToken = (payload) => {
  return jwt.sign(payload, process.env.REFRESH_TOKEN_SECRET, {
    expiresIn: "7d",
  });
};

module.exports = {
  getAllAccounts,
  getAccountAndGroup,
  getAllGroup,
  getMemberofGroupById,
  postAccount,
  postLink,
  deleteMember,
  activateEmail,
  acceptInvitation,
  postGroup,
  getAccessToken,
  googleLogin,
  facebookLogin,
};
