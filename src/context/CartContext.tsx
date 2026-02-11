import { createContext, useContext, useState, useEffect } from 'react';
import type { Product } from '../types';
import type { ReactNode} from 'react';

// Extend the Product type to include Cart-specific fields
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
  addToCart: (product: Product, quantity?: number) => void; // Updated signature
  removeFromCart: (cartId: string) => void; // Updated to use cartId
  clearCart: () => void;
  cartTotal: number;
  cartCount: number;
  isCartOpen: boolean;
  setIsCartOpen: (isOpen: boolean) => void;
  onSelect: (product: Product) => void; // For opening the modal
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);

  // Helper to generate a unique ID based on options
  // This ensures "Latte (Oat Milk)" and "Latte (Almond Milk)" are separate rows
  const generateCartId = (product: Product, selections: Record<string, string[]>) => {
  const baseId = product.id;
  const selectionString = JSON.stringify(selections);
  return `${baseId}-${selectionString}`;
};


  const addToCart = (product: Product, quantity: number = 1) => {
  setCart((prevCart) => {
    const modifiers = (product as any).modifiers;
    const basePrice = (product as any).basePrice ?? product.price;

    const uniqueId = generateCartId(product, modifiers);

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
      };
      return [...prevCart, newItem];
    }
  });

  setIsCartOpen(true);
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

  // Calculate totals
  const cartTotal = cart.reduce((total, item) => total + (item.price * item.quantity), 0);
  const cartCount = cart.reduce((count, item) => count + item.quantity, 0);

  // Placeholder function if you need to trigger the modal from outside
  const onSelect = (product: Product) => {
     // This logic is usually handled in the Menu page state, 
     // but we keep the type definition here for compatibility.
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
        onSelect
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