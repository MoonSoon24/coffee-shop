import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Navbar from './components/layout/Navbar';
import CartDrawer from './components/menu/CartDrawer';
import Home from './pages/Home';
import Menu from './pages/Menu';
import Auth from './pages/Auth';
import Profile from './pages/Profile';
import Admin from './pages/Admin';
import { CartProvider } from './context/CartContext';
import { AuthProvider } from './context/AuthContext';
import './App.css';

function App() {
  return (
    <AuthProvider>
      <CartProvider>
        <Router>
          <div className="min-h-screen bg-[#0f0f0f] text-gray-200 font-sans overflow-hidden">
            <Navbar />
            <CartDrawer />
            
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/menu" element={<Menu />} />
              <Route path="/login" element={<Auth />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/admin" element={<Admin />} />
            </Routes>
          </div>
        </Router>
      </CartProvider>
    </AuthProvider>
  );
}

export default App;