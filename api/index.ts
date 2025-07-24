import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { v4 as uuidv4 } from 'uuid';

const app = express();

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
});
app.use(limiter);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Mock data
const mockEmployees = [
  { id: '1', name: 'Juan Pérez', department: 'DCH', position: 'Supervisor' },
  { id: '2', name: 'María García', department: 'DCH', position: 'Empleado' },
  { id: '3', name: 'Carlos López', department: 'DCH', position: 'Empleado' }
];

const mockProducts = [
  { id: '1', name: 'Café Americano', price: 35, category: 'Bebidas', available: true },
  { id: '2', name: 'Huevos Rancheros', price: 85, category: 'Desayunos', available: true },
  { id: '3', name: 'Jugo de Naranja', price: 25, category: 'Bebidas', available: true }
];

// Routes
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'production' 
  });
});

// Employee routes
app.get('/api/employees', (req, res) => {
  res.json(mockEmployees);
});

app.get('/api/employees/:id', (req, res) => {
  const employee = mockEmployees.find(emp => emp.id === req.params.id);
  if (!employee) {
    return res.status(404).json({ error: 'Employee not found' });
  }
  res.json(employee);
});

// Product routes
app.get('/api/products', (req, res) => {
  res.json(mockProducts);
});

app.get('/api/products/:id', (req, res) => {
  const product = mockProducts.find(prod => prod.id === req.params.id);
  if (!product) {
    return res.status(404).json({ error: 'Product not found' });
  }
  res.json(product);
});

// Order routes
app.post('/api/orders', (req, res) => {
  const { employeeId, items, total } = req.body;
  
  const order = {
    id: uuidv4(),
    employeeId,
    items,
    total,
    status: 'pending',
    createdAt: new Date().toISOString()
  };
  
  res.status(201).json(order);
});

// Error handling middleware
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ 
    error: 'Something went wrong!',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Export the Express app as a serverless function
export default app; 