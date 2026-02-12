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

  modifiers?: {
    selections: Record<string, string[]>;
    notes: string;
  };

  modifiersData?: any[];
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