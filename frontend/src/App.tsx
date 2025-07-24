import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import POSLayout from './components/layout/POSLayout';
import PointOfSale from './pages/PointOfSale';
import Orders from './pages/Orders';
import './App.css';

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        <Toaster 
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: '#363636',
              color: '#fff',
            },
          }}
        />
        <Routes>
          <Route path="/" element={<POSLayout />}>
            <Route index element={<PointOfSale />} />
            <Route path="orders" element={<Orders />} />
          </Route>
        </Routes>
      </div>
    </Router>
  );
}

export default App; 