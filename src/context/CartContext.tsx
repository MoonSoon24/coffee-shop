import { createContext, useContext, useState, useEffect } from 'react';
import type { Product } from '../types';
import type { ReactNode } from 'react';

interface CartItem extends Product {
  cartId: string;
  quantity: number;
  basePrice: number;
  modifiers?: {
    selections: Record<string, string[]>;
    notes: string;
  };
  modifiersData?: any[];
}

interface CartContextType {
  cart: CartItem[];
  addToCart: (product: Product, quantity?: number, options?: { openCart?: boolean }) => void;
  removeFromCart: (cartId: string) => void;
  clearCart: () => void;
  cartTotal: number;
  cartCount: number;
  isCartOpen: boolean;
  setIsCartOpen: (isOpen: boolean) => void;
  onSelect: (product: Product) => void;
  tableNumber: string | null;
  setTableNumber: (table: string | null) => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);

  const [tableNumber, setTableNumber] = useState<string | null>(
    sessionStorage.getItem('tableNumber') || null
  );

  useEffect(() => {
    if (tableNumber) {
      sessionStorage.setItem('tableNumber', tableNumber);
    } else {
      sessionStorage.removeItem('tableNumber');
    }
  }, [tableNumber]);

  const generateCartId = (product: Product, selections: Record<string, string[]> = {}) => {
    const baseId = product.id;
    const selectionString = JSON.stringify(selections);
    return `${baseId}-${selectionString}`;
  };

  const addToCart = (product: Product, quantity: number = 1, options: { openCart?: boolean } = {}) => {
    setCart((prevCart) => {
      const modifiers = (product as any).modifiers;
      const modifiersData = (product as any).modifiersData ?? (Array.isArray((product as any).modifiers) ? (product as any).modifiers : undefined);
      const basePrice = (product as any).basePrice ?? product.price;
      const selections = modifiers?.selections || {};

      const uniqueId = generateCartId(product, selections);

      const existingItem = prevCart.find((item) => item.cartId === uniqueId);

      if (existingItem) {
        return prevCart.map((item) =>
          item.cartId === uniqueId
            ? { ...item, quantity: item.quantity + quantity }
            : item
        );
      } else {
        const newItem: CartItem = {
          ...product,
          cartId: uniqueId,
          quantity,
          basePrice,
          modifiers,
          modifiersData,
        };
        return [...prevCart, newItem];
      }
    });

    if (options.openCart !== false) {
      setIsCartOpen(true);
    }
  };

  const removeFromCart = (cartId: string) => {
    setCart((prevCart) => {
      const existingItem = prevCart.find((item) => item.cartId === cartId);
      
      if (existingItem && existingItem.quantity > 1) {
        return prevCart.map((item) =>
          item.cartId === cartId ? { ...item, quantity: item.quantity - 1 } : item
        );
      }
      return prevCart.filter((item) => item.cartId !== cartId);
    });
  };

  const clearCart = () => {
    setCart([]);
  };

  const cartTotal = cart.reduce((total, item) => total + (item.price * item.quantity), 0);
  const cartCount = cart.reduce((count, item) => count + item.quantity, 0);

  const onSelect = (product: Product) => {
     console.log("Product selected:", product.name);
  };

  return (
    <CartContext.Provider
      value={{
        cart,
        addToCart,
        removeFromCart,
        clearCart,
        cartTotal,
        cartCount,
        isCartOpen,
        setIsCartOpen,
        onSelect,
        tableNumber,
        setTableNumber
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}