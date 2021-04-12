import { Db, MongoClient } from "mongodb";
import axios from "axios";
import express from "express";

const url = 'mongodb://localhost:27017';
const dbName = 'myproject';
const port = 8888;
const client = new MongoClient(url);
let db: Db;

const app = express();
app.use(express.json());

client.connect(function (err) {
    console.log("Connected successfully to server");
    db = client.db(dbName);
});

app.post("/", (req, res) => {
    const { } = req.body;
});

app.listen(port);