const express = require("express");

// middleware để convert data gửi từ client (json) -> data cho server dùng (object)
const bodyParser = require("body-parser");

// path xử lý những string liên quan đến đường dẫn
const path = require("path");
const lib = require("./models");

const app = express();
const port = 3007;

app.use(bodyParser.json());

// Khởi tạo DB ORM khi khởi động server
lib.init().then(() => {
  console.log("Database synced!");
});

// API ghi dữ liệu
app.post("/add", async (req, res) => {
  try {
    const { key, value } = req.body;
    await lib.write(key, value);
    res.send("Insert a new record successfully!");
  } catch (err) {
    res.send(err.toString());
  }
});

// API lấy dữ liệu
app.get("/get/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const value = await lib.view(id);
    res.status(200).send(value);
  } catch (err) {
    res.send(err);
  }
});

// API lấy dữ liệu
app.get("/viewer/:id", (req, res) => {
  res.sendFile(path.join(__dirname, "viewer.html"));
});

// Bật server & lắng nghe request từ client
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
