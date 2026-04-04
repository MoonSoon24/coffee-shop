export interface Product {
  id: number;
  name: string;
  price: number;
  category: string;
  description: string;
  image_url?: string;
  is_available?: boolean;
  is_bundle?: boolean; 
  is_recommended?: boolean;
  product_bundles?: BundleItem[]; 
}

export interface BundleItem {
  id: number;
  parent_product_id: number;
  child_product_id: number;
  quantity: number;
  products?: Product; 
}

export interface Promotion {
  id: string;
  code: string;
  description: string;
  type: 'percentage' | 'fixed_amount';
  value: number;
  scope: 'order' | 'category' | 'product';
  min_order_value?: number;
  min_quantity?: number;
  starts_at: string;
  ends_at: string;
  is_active: boolean;
  promotion_targets?: PromotionTarget[]; 
}

export interface PromotionTarget {
  id: string;
  promotion_id: string;
  target_product_id?: number;
  target_category?: string;
}

export interface CartItem extends Product {
  cartId: string;
  quantity: number;
  basePrice?: number;

  modifiers?: {
    selections: Record<string, string[]>;
    notes: string;
  };

  modifiersData?: any[];
}

export interface Order {
  id: number;
  customer_name?: string | null;
  customer_phone?: string | null;
  type?: 'delivery' | 'takeaway' | 'dine_in' | null;
  status?: string | null;
  table_number?: string | null;
  session_status?: 'open' | 'closed' | null;
  total_price?: number | null;
  created_at?: string | null;
}

export interface OrderItem {
  id: number;
  order_id: number;
  product_id?: number | null;
  quantity: number;
  price_at_time: number;
  notes?: string | null;
  modifiers?: Record<string, string[]> | null;
  payment_status?: 'paid' | 'unpaid' | null;
  batch_id?: string | null;
  created_at?: string | null;
}

export interface CartContextType {
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

export type ModifierOption = {
  id: string;
  name: string;
  price: number;
};

export type ProductModifier = {
  id: string;
  name: string;
  isRequired: boolean;
  type: 'single' | 'multi';
  options: ModifierOption[];
};