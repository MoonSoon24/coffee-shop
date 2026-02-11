export interface Product {
  id: number;
  name: string;
  price: number;
  category: string;
  description: string;
  image_url?: string;
  is_available?: boolean;
}

export interface Promotion {
  id: string; // uuid
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
  // Optional join field for UI display
  promotion_targets?: PromotionTarget[]; 
}

export interface PromotionTarget {
  id: string; // uuid
  promotion_id: string;
  target_product_id?: number;
  target_category?: string;
}

export interface CartItem extends Product {
  cartId: string;
  quantity: number;
}