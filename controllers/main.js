const bcrypt = require("bcrypt");

const getTableData = (req, res, db) => {
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

const postTableData = async (req, res, db, saltRounds) => {
  const { id, password, fullname, email, telephone } = req.body;

  // bcrypt.hash(password, saltRounds, function (err, hash) {
  //   let values = { id, hash, fullname, email, telephone }; // query values
  //   // store hash in database
  //   console.log(values);
  // });

  db("ACCOUNT")
    .insert({ id, password, fullname, email, telephone })
    .returning("*")
    .then((item) => {
      res.json(item);
    })
    .catch((err) => res.status(400).json({ dbError: "db error" }));
};

module.exports = {
  getTableData,
  postTableData,
};
