const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const app = express();

const dotenv = require("dotenv");
const main = require("./controllers/main.js");
const { sendConfirmationEmail } = require("./mailer");
const { sendInvitation } = require("./sendLink");

dotenv.config();

const PORT = process.env.PORT || 3001;
const saltRounds = process.env.saltRounds;
const HOST = process.env.DATABASE_URL;
const USER = process.env.DATABASE_USER;
const PASSWORD = process.env.DATABASE_PASSWORD;
const DATABASE = process.env.DATABASE;

let db = require("knex")({
  client: "pg",
  connection: {
    host: HOST,
    user: USER,
    password: PASSWORD,
    database: DATABASE,
  },
});

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.get("/user", (req, res) => main.getAccountAndGroup(req, res, db));
app.get("/members", (req, res) => main.getMemberofGroupById(req, res, db));
app.get("/allgroup", (req, res) => main.getAllGroup(req, res, db));
app.post("/crud", (req, res) =>
  main.postAccount(req, res, db, saltRounds, sendConfirmationEmail)
);
app.post("/activation", (req, res) => main.activateEmail(req, res, db));
app.post("/newgroup", (req, res) => main.postGroup(req, res, db));
app.post("/googlelogin", (req, res) => main.googleLogin(req, res, db));
app.post("/facebooklogin", (req, res) => main.facebookLogin(req, res, db));
app.post("/refresh_token", (req, res) => userCtrl.getAccessToken(req, res));
app.post("/send", (req, res) => main.postLink(req, res, db, sendInvitation));
app.post("/accept", (req, res) => main.acceptInvitation(req, res, db));
app.get("/", (req, res) => main.getAllAccounts(req, res, db));
app.get("*", (req, res) => {
  res.send("Page not found");
});

app.listen(PORT, () => console.log(`App is running on port ${PORT}`));
