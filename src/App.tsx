import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Navbar from './components/layout/Navbar';
import CartDrawer from './components/menu/CartDrawer';
import Home from './pages/Home';
import Menu from './pages/Menu';
import Auth from './pages/Auth';
import Profile from './pages/Profile';
import Admin from './pages/Admin';
import Checkout from './pages/Checkout';
import EmailConfirmed from './pages/EmailConfirmed';
import OrderDetail from './pages/OrderDetail';
import OrderRedirect from './pages/OrderRedirect';
import { CartProvider } from './context/CartContext';
import { AuthProvider } from './context/AuthContext';
import { FeedbackProvider } from './context/FeedbackContext';
import { LanguageProvider } from './context/LanguageContext';
import './App.css';
import ulunLogoSvg from './assets/ulunLogo.svg';

function App() {

  useEffect(() => {
    const favicon = document.querySelector<HTMLLinkElement>("link[rel='icon']") || document.createElement('link');
    favicon.rel = 'icon';
    favicon.type = 'image/svg+xml';
    favicon.href = ulunLogoSvg;
    if (!favicon.parentNode) {
      document.head.appendChild(favicon);
    }
  }, []);
  return (
    <AuthProvider>
      <LanguageProvider>
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
                <Route path="/checkout" element={<Checkout />} />
                <Route path="/orders/:orderId" element={<OrderDetail />} />
                <Route path="/orders" element={<OrderRedirect />} />
                <Route path="/email-confirmed" element={<EmailConfirmed />} />
              </Routes>
            </div>
          </Router>
        </CartProvider>
      </FeedbackProvider>
      </LanguageProvider>
    </AuthProvider>
  );
}

export default App;