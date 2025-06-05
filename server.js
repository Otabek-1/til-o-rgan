const express = require("express");
const cors = require("cors");
const pool = require("./pg");
require("dotenv").config;

const app = express();

app.use(express.json());
app.use(cors());

app.get("/", (req, res) => res.send("Hello World!"));

app.post("/auth",async (req, res) => {
    const { login, password } = req.body;
    const user = await pool.query("SELECT id FROM users WHERE login = $1 AND password = $2", [login, password]);
    if (user.rows.length > 0) {
        res.send({ success: true, user: user.rows[0] });
    } else {
        res.send({ success: false });
    }
});

app.put("/change", (req,res)=>{
    const {login, password, id} = req.body;
    pool.query("UPDATE users SET login = $1, password = $2 WHERE id = $3", [login, password, id]);
    res.send({success: true});
})

app.put("/result", async (req,res)=>{
    const {id, result} = req.body;
    try {
        const user = await pool.query("SELECT * FROM users WHERE id = $1", [id]);
        const userResults = user.rows[0].results;
        userResults.push(result);
        pool.query("UPDATE users SET results = $1 WHERE id = $2", [userResults, id]);
        res.send({success: true});
    } catch (error) {
        
    }
})

app.get("/personal-results", async (req, res) => {
    const { id } = req.query; // req.body emas!
    
    try {
        const user = await pool.query("SELECT * FROM users WHERE id = $1", [id]);
        res.send({ success: true, results: user.rows[0].results });
    } catch (error) {
        console.error(error);
        res.status(500).send({ error: "Server error" });
    }
});

app.get("/me", async (req,res)=>{
    const {id} = req.query;
    try {
        const user = await pool.query("SELECT * FROM users WHERE id = $1", [id]);
        res.send({success: true, user: user.rows[0]});
    } catch (error) {
        res.status(500).send({ error: "Server error in get /me" });
        console.log(error);
    }
})
const PORT = process.env.PORT || 80
app.listen(PORT, () => console.log(`Example app listening on port ${PORT}!`));
