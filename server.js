const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");
const models = require("./models");

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const TOPIC = 'my-topic';
const { producer, consumer } = require('./kafka_client');

// Initialize database
models.init().then(() => {
    console.log("Database initialized");
});

// Serve static files
app.use(express.static(path.join(__dirname)));

// API endpoint to get value
app.get("/get/:key", async (req, res) => {
    const value = await models.view(req.params.key);
    res.send(value || "No value found");
});

// API endpoint to set value
app.post("/set/:key/:value", async (req, res) => {
    // Send message to Kafka
    await producer.send({
        topic: TOPIC,
        messages: [{ key: String(req.params.key), value: String(req.params.value) }],
    });
    res.send("Message published to Kafka");
});

// API endpoint to display value
app.get("/viewer/:id", (req, res) => {
    res.sendFile(path.join(__dirname, "viewer.html"));
});

// Socket.IO connection
io.on("connection", (socket) => {
    console.log("A client connected");

    socket.on("subscribe", async (key) => {
        console.log(`Client subscribed to key: ${key}`);
        socket.join(key);
        // Send current value to newly connected client
        const value = await models.view(key);
        socket.emit("initialValue", { key, value });
    });

    socket.on("disconnect", () => {
        console.log("A client disconnected");
    });
});

// Start server
const PORT = process.env.PORT || 3000;
const start = async () => {
    try {
        await producer.connect();
        await consumer.connect();
        await consumer.subscribe({ topic: TOPIC, fromBeginning: false });

        consumer.run({
            eachMessage: async ({ message }) => {
                const key = message.key.toString();
                const value = message.value.toString();
                console.log(`Received data: ${value} to key ${key}`);

                // Save to DB
                await models.write(key, value);
                
                // Broadcast via WebSocket
                io.emit("valueChanged", {
                    key: key,
                    value: value,
                });
            },
        });

        server.listen(PORT, () => {
            console.log(`🚀 Server running at http://localhost:${PORT}`);
        });
    } catch (err) {
        console.error('Startup error:', err);
    }
};

start();
