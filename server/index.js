require('dotenv').config();
const express = require('express');
const cors = require('cors');

const caregiverRoutes = require('./routes/caregivers');
const clientRoutes = require('./routes/clients');
const visitRoutes = require('./routes/visits');

const app = express();

app.use(cors());
app.use(express.json());

// Health check
app.get('/', (req, res) => {
  res.send('Care Calendar API is running');
});

app.use('/api/caregivers', caregiverRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/visits', visitRoutes);

// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: err.message });
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
