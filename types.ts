
export enum OrderStatus {
  PENDING = 'PENDING',
  PREPARING = 'PREPARING',
  IN_TRANSIT = 'IN_TRANSIT',
  DELIVERED = 'DELIVERED',
  CANCELLED = 'CANCELLED'
}

export enum PaymentMethod {
  PREPAID = 'PREPAID',
  CASH_ON_DELIVERY = 'CASH_ON_DELIVERY'
}

export interface LatLng {
  lat: number;
  lng: number;
}

export interface Dish {
  id: string;
  name: string;
  description: string;
  price: number;
  imageUrl: string;
  available: boolean;
  category: string; // New field for categorization: 'Platos', 'Bebidas', 'Postres', etc.
}

export interface Order {
  id: string;
  customerName: string;
  address: string;
  phone: string;
  notes?: string;
  items: { dishId: string; quantity: number; name: string; price: number }[];
  total: number;
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  deliveryAssignedTo?: string;
  createdAt: number;
  deliveryLocation?: LatLng;
}

export interface DeliveryPerson {
  id: string;
  name: string;
  active: boolean;
  currentLocation?: LatLng;
}

export type AppRole = 'CLIENT' | 'ADMIN' | 'DELIVERY';
