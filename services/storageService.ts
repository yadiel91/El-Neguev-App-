
import { Order, OrderStatus, Dish, DeliveryPerson, LatLng } from '../types';

const KEYS = {
  ORDERS: 'el_neguev_orders',
  MENU: 'el_neguev_menu',
  DELIVERY_PEOPLE: 'el_neguev_delivery_people',
  LOCATIONS: 'el_neguev_delivery_locations'
};

const DEFAULT_MENU: Dish[] = [
  {
    id: '1',
    name: 'La Bandera Dominicana',
    description: 'Arroz blanco, habichuelas rojas guisadas, carne de pollo o res, y ensalada verde.',
    price: 350,
    imageUrl: 'https://picsum.photos/seed/bandera/800/600',
    available: true,
    category: 'Platos'
  },
  {
    id: '2',
    name: 'Sancocho Tradicional',
    description: 'El clásico caldo dominicano con 7 carnes, víveres y aguacate.',
    price: 450,
    imageUrl: 'https://picsum.photos/seed/sancocho/800/600',
    available: true,
    category: 'Platos'
  },
  {
    id: '3',
    name: 'Jugo de Chinola Natural',
    description: 'Refrescante jugo de pasión (chinola) recién exprimido.',
    price: 120,
    imageUrl: 'https://picsum.photos/seed/chinola/800/600',
    available: true,
    category: 'Bebidas'
  },
  {
    id: '4',
    name: 'Morir Soñando',
    description: 'Bebida tradicional de leche y naranja con un toque de vainilla.',
    price: 150,
    imageUrl: 'https://picsum.photos/seed/morir/800/600',
    available: true,
    category: 'Bebidas'
  },
  {
    id: '5',
    name: 'Habichuelas con Dulce',
    description: 'Postre típico dominicano con galletitas de leche y pasas.',
    price: 200,
    imageUrl: 'https://picsum.photos/seed/postre/800/600',
    available: true,
    category: 'Postres'
  },
  {
    id: '6',
    name: 'Majarete de Maíz',
    description: 'Crema dulce de maíz tierno con canela espolvoreada.',
    price: 175,
    imageUrl: 'https://picsum.photos/seed/majarete/800/600',
    available: true,
    category: 'Postres'
  }
];

const DEFAULT_DELIVERY: DeliveryPerson[] = [
  { id: 'd1', name: 'Juan Repartidor', active: true },
  { id: 'd2', name: 'Pedro Veloz', active: true }
];

export const StorageService = {
  getOrders: (): Order[] => {
    const data = localStorage.getItem(KEYS.ORDERS);
    return data ? JSON.parse(data) : [];
  },

  saveOrder: (order: Order) => {
    const orders = StorageService.getOrders();
    orders.push(order);
    localStorage.setItem(KEYS.ORDERS, JSON.stringify(orders));
  },

  updateOrder: (updatedOrder: Order) => {
    const orders = StorageService.getOrders();
    const index = orders.findIndex(o => o.id === updatedOrder.id);
    if (index !== -1) {
      orders[index] = updatedOrder;
      localStorage.setItem(KEYS.ORDERS, JSON.stringify(orders));
    }
  },

  updateOrderStatus: (orderId: string, status: OrderStatus) => {
    const orders = StorageService.getOrders();
    const updated = orders.map(o => o.id === orderId ? { ...o, status } : o);
    localStorage.setItem(KEYS.ORDERS, JSON.stringify(updated));
  },

  assignDelivery: (orderId: string, deliveryId: string) => {
    const orders = StorageService.getOrders();
    const updated = orders.map(o => o.id === orderId ? { 
      ...o, 
      deliveryAssignedTo: deliveryId,
      status: OrderStatus.PREPARING 
    } : o);
    localStorage.setItem(KEYS.ORDERS, JSON.stringify(updated));
  },

  updateDeliveryLocation: (deliveryId: string, location: LatLng) => {
    const locations = JSON.parse(localStorage.getItem(KEYS.LOCATIONS) || '{}');
    locations[deliveryId] = location;
    localStorage.setItem(KEYS.LOCATIONS, JSON.stringify(locations));
    
    // Also update order if it's in transit to help client tracking
    const orders = StorageService.getOrders();
    const updatedOrders = orders.map(o => 
      (o.deliveryAssignedTo === deliveryId && o.status === OrderStatus.IN_TRANSIT) 
      ? { ...o, deliveryLocation: location } 
      : o
    );
    localStorage.setItem(KEYS.ORDERS, JSON.stringify(updatedOrders));
  },

  getDeliveryLocation: (deliveryId: string): LatLng | null => {
    const locations = JSON.parse(localStorage.getItem(KEYS.LOCATIONS) || '{}');
    return locations[deliveryId] || null;
  },

  getMenu: (): Dish[] => {
    const data = localStorage.getItem(KEYS.MENU);
    // Ensure all items have a category
    const menuItems: Dish[] = data ? JSON.parse(data) : DEFAULT_MENU;
    return menuItems.map(item => ({ ...item, category: item.category || 'Platos' }));
  },

  saveMenu: (menu: Dish[]) => {
    localStorage.setItem(KEYS.MENU, JSON.stringify(menu));
  },

  getDeliveryPeople: (): DeliveryPerson[] => {
    const data = localStorage.getItem(KEYS.DELIVERY_PEOPLE);
    return data ? JSON.parse(data) : DEFAULT_DELIVERY;
  }
};
