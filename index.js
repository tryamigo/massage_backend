const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const mysql = require("mysql2");
const cors = require("cors");

// Initialize express app
const app = express();
app.use(express.json()); // Middleware to parse JSON bodies
app.use(cors({ origin: "http://localhost:3000" })); // Enable CORS for API routes

// Create HTTP server
const server = http.createServer(app);

// Instantiate server via Socket.IO with CORS configuration
const io = new Server(server, {
  cors: {
    origin: ["http://localhost:3000"], // Allow requests from frontend
    methods: ["GET", "POST"],
    credentials: true,
  },
});

// Database connection using a pool
const pool = mysql.createPool({
  host: "localhost",
  user: "root",
  password: "123456",
  database: "chat_db",
  connectionLimit: 10,
});

// Helper function to handle queries with reconnection logic
function queryDatabase(query, values, callback) {
  pool.getConnection((err, connection) => {
    if (err) {
      console.error("Error getting connection from pool:", err);
      if (connection) connection.release();
      callback(err, null);
      return;
    }

    connection.query(query, values, (queryErr, result) => {
      connection.release();
      if (queryErr) {
        console.error("Error executing query:", queryErr);
        callback(queryErr, null);
      } else {
        callback(null, result);
      }
    });
  });
}

// Connect with client via Socket.IO
io.on("connection", (socket) => {
  console.log("Connected with client.");

  // Receive message from client
  socket.on("send_message", (data) => {
    console.log("Message arrived from client:", data);

    // Save message to database
    const query = "INSERT INTO messages (userId, message, timestamp) VALUES (?, ?, ?)";
    const values = [data.userId, data.message, new Date()];

    queryDatabase(query, values, (err, result) => {
      if (err) {
        console.error("Error saving message to database:", err);
        socket.emit("error_message", "Failed to save message. Please try again.");
        return;
      }
      console.log("Message saved to database:", result);

      // Send message back to all connected clients
      io.emit("received_message", data);
    });
  });

  // Handle disconnect event
  socket.on("disconnect", () => {
    console.log("Disconnected with client.");
  });
});

// Create an endpoint to fetch messages
app.get("/messages", (req, res) => {
  const query = "SELECT userId, message, DATE_FORMAT(timestamp, '%Y-%m-%d %H:%i:%s') AS timestamp FROM messages ORDER BY timestamp";

  queryDatabase(query, [], (err, results) => {
    if (err) {
      return res.status(500).json({ error: "Database error" });
    }
    res.json(results);
  });
});

// Start server
const PORT = 5001;
server.listen(PORT, () => console.log(`Server is running on port: ${PORT}`));
