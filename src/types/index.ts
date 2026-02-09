export interface Product {
  id: number;
  name: string;
  price: number;
  category: string;
  description: string;
  image_url?: string;
}

export interface CartItem extends Product {
  cartId: string;
  quantity: number;
}