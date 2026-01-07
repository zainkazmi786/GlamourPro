// server.js (or app.js)

const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const connectDB = require('./config/db'); // Import the connection function
const clientRoutes = require('./routes/clientRoutes');
const staffRoutes = require('./routes/staffRoutes');
const baseServiceRoutes = require('./routes/baseServiceRoutes');
const serviceVariationRoutes = require('./routes/serviceVariationRoutes');
const appointmentRoutes = require('./routes/appointmentRoutes');
const membershipTierRoutes = require('./routes/membershipTierRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const authRoutes = require('./routes/authRoutes');
const chatRoutes = require('./routes/chatRoutes');
const messageRoutes = require('./routes/messageRoutes');
const attendanceRoutes = require('./routes/attendanceRoutes');
const leaveRoutes = require('./routes/leaveRoutes');
const monthlySalaryConfigRoutes = require('./routes/monthlySalaryConfigRoutes');
const monthlySalaryRoutes = require('./routes/monthlySalaryRoutes');
const companyClosureRoutes = require('./routes/companyClosureRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const businessSettingsRoutes = require('./routes/businessSettingsRoutes');
const clientPortalRoutes = require('./routes/clientPortalRoutes');
const reportsRoutes = require('./routes/reportsRoutes')
const http = require('http');
const { Server } = require('socket.io');
const path = require("path");


// Load environment variables
dotenv.config();

// 1. Execute the connection function
connectDB(); 

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3000;

// CORS configuration - Allow all origins for now
const corsOptions = {
  origin: true, // Allow all origins
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
  exposedHeaders: ['Content-Range', 'X-Content-Range'],
  preflightContinue: false,
  optionsSuccessStatus: 204
};

// Middleware - CORS must be applied before routes
app.use(cors(corsOptions)); // Use cors package for better handling
app.use(express.json()); // Body parser for JSON
app.use(express.urlencoded({ extended: true })); // Body parser for URL-encoded
app.use(express.static(path.join(__dirname, "dist")));

// Serve uploads folder for PDF bills
app.use('/uploads', express.static('uploads'));

// Routes

app.get('/', (req, res) => {
  res.send('Server is running and attempting to connect to MongoDB...');
});

// API Routes
// Mount client portal routes FIRST to ensure public routes (register/login) are accessible
app.use('/api/client-portal', clientPortalRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/staff', staffRoutes);
app.use('/api/base-services', baseServiceRoutes);
app.use('/api/service-variations', serviceVariationRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/membership-tiers', membershipTierRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/chats', chatRoutes);
// Mount messageRoutes - these routes handle /api/chats/:chatId/messages and /api/messages/:id
app.use('/api', messageRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/leaves', leaveRoutes);
app.use('/api/monthly-salary-config', monthlySalaryConfigRoutes);
app.use('/api/monthly-salary', monthlySalaryRoutes);
app.use('/api/company-closures', companyClosureRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/business-settings', businessSettingsRoutes);
app.use('/api/reports', reportsRoutes);
app.use((req, res) => {
  res.sendFile(path.join(__dirname, "dist", "index.html"));
});

// Initialize Socket.io
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:8080',
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Socket.io authentication and event handlers
require('./socket/socketServer')(io);

server.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
  console.log(`Socket.io server is running on http://localhost:${PORT}`);
});