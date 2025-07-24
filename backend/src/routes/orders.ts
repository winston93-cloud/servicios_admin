import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { mockEmployees, mockProducts } from '../data/mockData';
import { Order, OrderItem, ApiResponse } from '../types';

const router = express.Router();

// In-memory storage for orders (replace with database later)
let orders: Order[] = [];

// POST /api/orders - Create a new order
router.post('/', (req, res) => {
  try {
    const { employeeId, items, paymentMethod } = req.body;

    // Validate employee
    const employee = mockEmployees.find(emp => emp.id === employeeId);
    if (!employee) {
      const response: ApiResponse<Order> = {
        success: false,
        error: 'Employee not found'
      };
      return res.status(404).json(response);
    }

    // Validate and calculate order items
    const orderItems: OrderItem[] = [];
    let subtotal = 0;

    for (const item of items) {
      const product = mockProducts.find(prod => prod.id === item.productId);
      if (!product) {
        const response: ApiResponse<Order> = {
          success: false,
          error: `Product not found: ${item.productId}`
        };
        return res.status(404).json(response);
      }

      if (!product.available) {
        const response: ApiResponse<Order> = {
          success: false,
          error: `Product not available: ${product.name}`
        };
        return res.status(400).json(response);
      }

      const orderItem: OrderItem = {
        id: uuidv4(),
        productId: product.id,
        product,
        quantity: item.quantity,
        unitPrice: product.price,
        subtotal: product.price * item.quantity
      };

      orderItems.push(orderItem);
      subtotal += orderItem.subtotal;
    }

    // Create order
    const order: Order = {
      id: uuidv4(),
      employeeId,
      employee,
      items: orderItems,
      subtotal,
      total: subtotal, // Could add taxes, discounts, etc.
      paymentMethod,
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    orders.push(order);

    const response: ApiResponse<Order> = {
      success: true,
      data: order,
      message: 'Order created successfully'
    };

    res.status(201).json(response);
  } catch (error) {
    const response: ApiResponse<Order> = {
      success: false,
      error: 'Error creating order'
    };
    res.status(500).json(response);
  }
});

// GET /api/orders - Get all orders
router.get('/', (req, res) => {
  try {
    const response: ApiResponse<Order[]> = {
      success: true,
      data: orders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
      message: `Found ${orders.length} orders`
    };

    res.json(response);
  } catch (error) {
    const response: ApiResponse<Order[]> = {
      success: false,
      error: 'Error fetching orders'
    };
    res.status(500).json(response);
  }
});

// GET /api/orders/:id - Get order by ID
router.get('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const order = orders.find(ord => ord.id === id);

    if (!order) {
      const response: ApiResponse<Order> = {
        success: false,
        error: 'Order not found'
      };
      return res.status(404).json(response);
    }

    const response: ApiResponse<Order> = {
      success: true,
      data: order
    };

    res.json(response);
  } catch (error) {
    const response: ApiResponse<Order> = {
      success: false,
      error: 'Error fetching order'
    };
    res.status(500).json(response);
  }
});

// PATCH /api/orders/:id - Update order status
router.patch('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const orderIndex = orders.findIndex(ord => ord.id === id);
    if (orderIndex === -1) {
      const response: ApiResponse<Order> = {
        success: false,
        error: 'Order not found'
      };
      return res.status(404).json(response);
    }

    // Update order
    orders[orderIndex] = {
      ...orders[orderIndex],
      status,
      updatedAt: new Date()
    };

    const response: ApiResponse<Order> = {
      success: true,
      data: orders[orderIndex],
      message: 'Order updated successfully'
    };

    res.json(response);
  } catch (error) {
    const response: ApiResponse<Order> = {
      success: false,
      error: 'Error updating order'
    };
    res.status(500).json(response);
  }
});

export default router; 