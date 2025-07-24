import express from 'express';
import { mockProducts } from '../data/mockData';
import { Product, SearchProductParams, ApiResponse } from '../types';

const router = express.Router();

// GET /api/products - Get all products with optional search
router.get('/', (req, res) => {
  try {
    const { query, category, available } = req.query as SearchProductParams;
    
    let filteredProducts = [...mockProducts];

    // Filter by search query (name or description)
    if (query) {
      const searchTerm = query.toLowerCase();
      filteredProducts = filteredProducts.filter(product =>
        product.name.toLowerCase().includes(searchTerm) ||
        product.description.toLowerCase().includes(searchTerm)
      );
    }

    // Filter by category
    if (category) {
      filteredProducts = filteredProducts.filter(product =>
        product.category === category
      );
    }

    // Filter by availability
    if (available !== undefined) {
      const isAvailable = available === 'true';
      filteredProducts = filteredProducts.filter(product =>
        product.available === isAvailable
      );
    }

    const response: ApiResponse<Product[]> = {
      success: true,
      data: filteredProducts,
      message: `Found ${filteredProducts.length} products`
    };

    res.json(response);
  } catch (error) {
    const response: ApiResponse<Product[]> = {
      success: false,
      error: 'Error fetching products'
    };
    res.status(500).json(response);
  }
});

// GET /api/products/:id - Get product by ID
router.get('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const product = mockProducts.find(prod => prod.id === id);

    if (!product) {
      const response: ApiResponse<Product> = {
        success: false,
        error: 'Product not found'
      };
      return res.status(404).json(response);
    }

    const response: ApiResponse<Product> = {
      success: true,
      data: product
    };

    res.json(response);
  } catch (error) {
    const response: ApiResponse<Product> = {
      success: false,
      error: 'Error fetching product'
    };
    res.status(500).json(response);
  }
});

// GET /api/products/meta/categories - Get available categories
router.get('/meta/categories', (req, res) => {
  try {
    const categories = [...new Set(mockProducts.map(prod => prod.category))];
    
    const response: ApiResponse<string[]> = {
      success: true,
      data: categories
    };

    res.json(response);
  } catch (error) {
    const response: ApiResponse<string[]> = {
      success: false,
      error: 'Error fetching categories'
    };
    res.status(500).json(response);
  }
});

export default router; 