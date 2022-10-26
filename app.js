const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const app = express();

const dotenv = require("dotenv");
const main = require("./controllers/main.js");

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

app.get("/", (req, res) => main.getTableData(req, res, db));
app.post("/crud", (req, res) => main.postTableData(req, res, db, saltRounds));

app.listen(PORT, () => console.log(`App is running on port ${PORT}`));
