import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Navbar from './components/layout/Navbar';
import CartDrawer from './components/menu/CartDrawer';
import Home from './pages/Home';
import Menu from './pages/Menu';
import Auth from './pages/Auth';
import Profile from './pages/Profile';
import Admin from './pages/Admin';
import Reservation from './pages/Reservation';
import Checkout from './pages/Checkout';
import EmailConfirmed from './pages/EmailConfirmed';
import { CartProvider } from './context/CartContext';
import { AuthProvider } from './context/AuthContext';
import { FeedbackProvider } from './context/FeedbackContext';
import './App.css';

function App() {
  return (
    <AuthProvider>
      <FeedbackProvider>
        <CartProvider>
          <Router>
            <div className="light-theme min-h-screen bg-[#f6f7fb] text-gray-800 font-sans overflow-hidden">
              <Navbar />
              <CartDrawer />
              
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/menu" element={<Menu />} />
                <Route path="/login" element={<Auth />} />
                <Route path="/profile" element={<Profile />} />
                <Route path="/admin" element={<Admin />} />
                <Route path="/reservation" element={<Reservation />} />
                <Route path="/checkout" element={<Checkout />} />
                <Route path="/email-confirmed" element={<EmailConfirmed />} />
              </Routes>
            </div>
          </Router>
        </CartProvider>
      </FeedbackProvider>
    </AuthProvider>
  );
}

export default App;