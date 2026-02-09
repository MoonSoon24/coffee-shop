import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Navbar from './components/layout/Navbar';
import CartDrawer from './components/menu/CartDrawer';
import Home from './pages/Home';
import Menu from './pages/Menu';
import { CartProvider } from './context/CartContext';
import './App.css'; // Keep your global styles

function App() {
  return (
    <CartProvider>
      <Router>
        <div className="min-h-screen bg-[#0f0f0f] text-gray-200 font-sans overflow-hidden">
          <Navbar />
          <CartDrawer />
          
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/menu" element={<Menu />} />
            {/* Future pages: <Route path="/admin" element={<Admin />} /> */}
          </Routes>
        </div>
      </Router>
    </CartProvider>
  );
}

export default App;