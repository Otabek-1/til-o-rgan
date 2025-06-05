const express = require("express");
const cors = require("cors");
const pool = require("./pg");
require("dotenv").config();

const app = express();

app.use(express.json());
app.use(cors());

app.get("/", (req, res) => res.send("Hello World!"));

app.post("/auth", async (req, res) => {
    try {
        const { login, password } = req.body;
        const user = await pool.query("SELECT id FROM users WHERE login = $1 AND password = $2", [login, password]);
        if (user.rows.length > 0) {
            res.send({ success: true, user: user.rows[0] });
        } else {
            res.send({ success: false });
        }
    } catch (error) {
        res.status(500).send({ error: "Server error in /auth" });
        console.error(error);
    }
});

app.put("/change", async (req, res) => {
    const { login, password, id } = req.body;
    try {
        await pool.query("UPDATE users SET login = $1, password = $2 WHERE id = $3", [login, password, id]);
        res.send({ success: true });
    } catch (error) {
        res.status(500).send({ error: "Server error in /change" });
        console.error(error);
    }
});

app.put("/result", async (req, res) => {
    const { id, result } = req.body;
    try {
        const user = await pool.query("SELECT * FROM users WHERE id = $1", [id]);
        if (!user.rows.length) return res.status(404).send({ success: false, error: "User not found" });
        const userResults = user.rows[0].results || [];
        userResults.push(result);
        await pool.query("UPDATE users SET results = $1 WHERE id = $2", [userResults, id]);
        res.send({ success: true });
    } catch (error) {
        res.status(500).send({ error: "Server error in /result" });
        console.error(error);
    }
});

app.get("/personal-results", async (req, res) => {
    const { id } = req.query;
    try {
        const user = await pool.query("SELECT * FROM users WHERE id = $1", [id]);
        if (!user.rows.length) return res.status(404).send({ success: false, error: "User not found" });
        res.send({ success: true, results: user.rows[0].results });
    } catch (error) {
        console.error(error);
        res.status(500).send({ error: "Server error" });
    }
});

app.get("/me", async (req, res) => {
    const { id } = req.query;
    try {
        const user = await pool.query("SELECT * FROM users WHERE id = $1", [id]);
        if (!user.rows.length) return res.status(404).send({ success: false, error: "User not found" });
        res.send({ success: true, user: user.rows[0] });
    } catch (error) {
        res.status(500).send({ error: "Server error in get /me" });
        console.log(error);
    }
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});

const PORT = process.env.PORT || 8000;
app.listen(PORT, () => console.log(`Example app listening on port ${PORT}!`));
