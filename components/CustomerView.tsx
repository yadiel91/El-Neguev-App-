
import React, { useState, useEffect, useRef } from 'react';
import { StorageService } from '../services/storageService';
import { Dish, Order, OrderStatus, LatLng, PaymentMethod } from '../types';

declare const L: any; // Leaflet global

const CustomerView: React.FC = () => {
  const [menu, setMenu] = useState<Dish[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [activeOrders, setActiveOrders] = useState<Order[]>([]);
  const [selectedTrackingOrder, setSelectedTrackingOrder] = useState<Order | null>(null);
  const [history, setHistory] = useState<Order[]>([]);
  const [viewMode, setViewMode] = useState<'MENU' | 'TRACKING' | 'HISTORY'>('MENU');
  const [activeCategory, setActiveCategory] = useState<string>('');
  const [formData, setFormData] = useState({ 
    name: '', 
    address: '', 
    phone: '', 
    notes: '',
    paymentMethod: PaymentMethod.CASH_ON_DELIVERY 
  });
  const [isOrdering, setIsOrdering] = useState(false);
  const [isEditingOrder, setIsEditingOrder] = useState(false);
  const [selectedDish, setSelectedDish] = useState<Dish | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [showContactOptions, setShowContactOptions] = useState(false);
  const [cart, setCart] = useState<{ dishId: string; quantity: number; name: string; price: number }[]>([]);
  const [tempOrderItems, setTempOrderItems] = useState<{ dishId: string; quantity: number; name: string; price: number }[]>([]);
  
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);

  // Configuraciones del negocio
  const BUSINESS_PHONE = "8095551234"; // Número de ejemplo
  const WHATSAPP_LINK = `https://wa.me/${BUSINESS_PHONE}?text=Hola,%20tengo%20una%20duda%20con%20mi%20pedido`;

  // Carga inicial y persistencia de datos de usuario
  useEffect(() => {
    setMenu(StorageService.getMenu());
    const cats = StorageService.getCategories();
    setCategories(cats);
    if (cats.length > 0) setActiveCategory(cats[0]);
    
    refreshOrders();
    
    // Cargar datos del último pedido para conveniencia del usuario
    const savedOrders = StorageService.getOrders();
    if (savedOrders.length > 0) {
      const last = savedOrders[savedOrders.length - 1];
      setFormData(prev => ({
        ...prev,
        name: last.customerName,
        address: last.address,
        phone: last.phone
      }));
    }

    // Cargar carrito de localStorage si existe
    const savedCart = localStorage.getItem('el_neguev_cart');
    if (savedCart) setCart(JSON.parse(savedCart));
  }, []);

  useEffect(() => {
    localStorage.setItem('el_neguev_cart', JSON.stringify(cart));
  }, [cart]);

  const refreshOrders = () => {
    const allOrders = StorageService.getOrders();
    const active = allOrders.filter(o => o.status !== OrderStatus.DELIVERED && o.status !== OrderStatus.CANCELLED);
    setActiveOrders(active);
    
    // Seleccionar automáticamente el pedido actual si no hay uno seleccionado
    if (active.length > 0 && !selectedTrackingOrder) {
      setSelectedTrackingOrder(active[0]);
    } else if (active.length > 0 && selectedTrackingOrder) {
      const updated = active.find(o => o.id === selectedTrackingOrder.id);
      if (updated) setSelectedTrackingOrder(updated);
      else setSelectedTrackingOrder(active[0]);
    } else {
      setSelectedTrackingOrder(null);
    }

    setHistory(allOrders.filter(o => o.status === OrderStatus.DELIVERED || o.status === OrderStatus.CANCELLED).sort((a, b) => b.createdAt - a.createdAt));
  };

  // Sincronización automática de estados cada 3 segundos
  useEffect(() => {
    const interval = setInterval(refreshOrders, 3000);
    return () => clearInterval(interval);
  }, [selectedTrackingOrder?.id]);

  // Lógica del Mapa de Seguimiento
  useEffect(() => {
    if (viewMode === 'TRACKING' && selectedTrackingOrder?.status === OrderStatus.IN_TRANSIT && selectedTrackingOrder.deliveryLocation && mapContainerRef.current) {
      const loc = selectedTrackingOrder.deliveryLocation;
      
      if (!mapRef.current) {
        mapRef.current = L.map(mapContainerRef.current).setView([loc.lat, loc.lng], 15);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© OpenStreetMap contributors'
        }).addTo(mapRef.current);
        
        const motorIcon = L.divIcon({
          html: '<div class="bg-orange-600 w-10 h-10 rounded-full flex items-center justify-center border-4 border-white shadow-xl text-white"><i class="fa-solid fa-motorcycle"></i></div>',
          className: '',
          iconSize: [40, 40],
          iconAnchor: [20, 20]
        });
        
        markerRef.current = L.marker([loc.lat, loc.lng], { icon: motorIcon }).addTo(mapRef.current);
      } else {
        markerRef.current.setLatLng([loc.lat, loc.lng]);
        mapRef.current.panTo([loc.lat, loc.lng]);
      }
    } else if (mapRef.current && (!selectedTrackingOrder || selectedTrackingOrder.status !== OrderStatus.IN_TRANSIT)) {
        mapRef.current.remove();
        mapRef.current = null;
    }
  }, [viewMode, selectedTrackingOrder?.status, selectedTrackingOrder?.deliveryLocation, selectedTrackingOrder?.id]);

  const handleGetLocation = () => {
    if (!navigator.geolocation) {
      alert("Tu navegador no soporta geolocalización.");
      return;
    }
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setFormData(prev => ({ ...prev, address: `Ubicación GPS: ${latitude.toFixed(5)}, ${longitude.toFixed(5)}` }));
        setIsLocating(false);
      },
      () => {
        alert("No se pudo obtener la ubicación.");
        setIsLocating(false);
      },
      { enableHighAccuracy: true }
    );
  };

  const addToCart = (dish: Dish) => {
    setCart(prev => {
      const existing = prev.find(item => item.dishId === dish.id);
      if (existing) {
        return prev.map(item => item.dishId === dish.id ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [...prev, { dishId: dish.id, name: dish.name, quantity: 1, price: dish.price }];
    });
  };

  const updateCartQuantity = (dishId: string, delta: number) => {
    setCart(prev => {
      const index = prev.findIndex(item => item.dishId === dishId);
      if (index === -1) return prev;
      const updated = [...prev];
      const newQty = updated[index].quantity + delta;
      if (newQty <= 0) updated.splice(index, 1);
      else updated[index] = { ...updated[index], quantity: newQty };
      return updated;
    });
  };

  const cartTotal = cart.reduce((acc, item) => acc + (item.price * item.quantity), 0);

  const handleOrder = (e: React.FormEvent) => {
    e.preventDefault();
    if (cart.length === 0) return;

    const newOrder: Order = {
      id: Math.random().toString(36).substr(2, 9),
      customerName: formData.name,
      address: formData.address,
      phone: formData.phone,
      notes: formData.notes,
      paymentMethod: formData.paymentMethod,
      items: [...cart],
      total: cartTotal,
      status: OrderStatus.PENDING,
      createdAt: Date.now()
    };

    StorageService.saveOrder(newOrder);
    refreshOrders();
    setSelectedTrackingOrder(newOrder);
    setViewMode('TRACKING');
    setIsOrdering(false);
    setCart([]);
  };

  const handleReorder = (order: Order) => {
    const itemsToReorder = order.items.map(item => {
      const dish = menu.find(d => d.id === item.dishId);
      return { item, dish };
    });

    const availableItems = itemsToReorder.filter(x => x.dish && x.dish.available);
    
    if (availableItems.length > 0) {
      setCart(availableItems.map(x => ({
        dishId: x.item.dishId,
        name: x.item.name,
        quantity: x.item.quantity,
        price: x.item.price
      })));
      setIsOrdering(true);
    } else {
      alert("Los platos de este pedido no están disponibles hoy.");
    }
  };

  const startEditingOrder = () => {
    if (!selectedTrackingOrder) return;
    setTempOrderItems([...selectedTrackingOrder.items]);
    setIsEditingOrder(true);
  };

  const updateTempItemQuantity = (dishId: string, delta: number) => {
    setTempOrderItems(prev => {
        const index = prev.findIndex(i => i.dishId === dishId);
        if (index === -1) return prev;
        const updated = [...prev];
        const newQty = updated[index].quantity + delta;
        if (newQty <= 0) updated.splice(index, 1);
        else updated[index] = { ...updated[index], quantity: newQty };
        return updated;
    });
  };

  const addDishToTempOrder = (dish: Dish) => {
    setTempOrderItems(prev => {
        const index = prev.findIndex(i => i.dishId === dish.id);
        if (index !== -1) {
            const updated = [...prev];
            updated[index] = { ...updated[index], quantity: updated[index].quantity + 1 };
            return updated;
        }
        return [...prev, { dishId: dish.id, name: dish.name, quantity: 1, price: dish.price }];
    });
  };

  const saveEditedOrder = () => {
    if (!selectedTrackingOrder || tempOrderItems.length === 0) return;
    const total = tempOrderItems.reduce((acc, item) => acc + (item.price * item.quantity), 0);
    const updatedOrder = { ...selectedTrackingOrder, items: tempOrderItems, total };
    StorageService.updateOrder(updatedOrder);
    setSelectedTrackingOrder(updatedOrder);
    setIsEditingOrder(false);
    refreshOrders();
  };

  const getStatusColor = (status: OrderStatus) => {
    switch (status) {
      case OrderStatus.PENDING: return 'bg-yellow-100 text-yellow-800';
      case OrderStatus.PREPARING: return 'bg-blue-100 text-blue-800';
      case OrderStatus.IN_TRANSIT: return 'bg-orange-100 text-orange-800';
      case OrderStatus.DELIVERED: return 'bg-green-100 text-green-800';
      case OrderStatus.CANCELLED: return 'bg-stone-100 text-stone-500';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusLabel = (status: OrderStatus) => {
    switch (status) {
      case OrderStatus.PENDING: return 'Confirmando...';
      case OrderStatus.PREPARING: return 'En el fogón 🍳';
      case OrderStatus.IN_TRANSIT: return 'En camino 🛵';
      case OrderStatus.DELIVERED: return '¡Entregado! 🍛';
      case OrderStatus.CANCELLED: return 'Cancelado ❌';
      default: return status;
    }
  };

  const filteredMenu = menu.filter(d => d.available && d.category === activeCategory);

  // Vista de Seguimiento de Pedidos
  if (viewMode === 'TRACKING' && selectedTrackingOrder) {
    return (
      <div className="max-w-4xl mx-auto py-8 px-4 animate-in fade-in duration-500">
        <div className="flex items-center justify-between mb-8">
           <button onClick={() => setViewMode('MENU')} className="bg-stone-100 text-stone-600 px-5 py-2 rounded-2xl text-xs font-black hover:bg-orange-50 hover:text-orange-600 transition flex items-center uppercase tracking-widest shadow-sm">
             <i className="fa-solid fa-cart-plus mr-2"></i> Nuevo Pedido
           </button>
           <h2 className="text-xl font-black text-stone-800 uppercase tracking-tight">Seguimiento en Vivo</h2>
        </div>

        {activeOrders.length > 1 && (
          <div className="flex space-x-3 overflow-x-auto pb-6 mb-2 -mx-4 px-4 scrollbar-hide">
            {activeOrders.map(o => (
              <button 
                key={o.id}
                onClick={() => setSelectedTrackingOrder(o)}
                className={`flex-shrink-0 px-5 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest border-2 transition-all ${selectedTrackingOrder.id === o.id ? 'bg-orange-600 border-orange-600 text-white shadow-xl scale-105' : 'bg-white border-stone-100 text-stone-400'}`}
              >
                Pedido #{o.id.toUpperCase()}
              </button>
            ))}
          </div>
        )}
        
        <div className="grid grid-cols-1 md:grid-cols-5 gap-8">
          <div className="md:col-span-2 space-y-6">
            <div className="bg-white rounded-[2.5rem] shadow-2xl p-8 border border-orange-50 h-full flex flex-col">
              <div className="mb-8 flex justify-between items-start">
                <div>
                  <p className="text-[10px] text-stone-400 font-bold uppercase tracking-widest mb-1">Estado actual</p>
                  <div className={`px-4 py-2 rounded-2xl font-black inline-block text-xs ${getStatusColor(selectedTrackingOrder.status)}`}>
                    {getStatusLabel(selectedTrackingOrder.status)}
                  </div>
                </div>
                {selectedTrackingOrder.status === OrderStatus.PENDING && (
                  <div className="flex space-x-2">
                    <button onClick={startEditingOrder} className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center hover:bg-blue-100 transition shadow-sm" title="Editar pedido">
                      <i className="fa-solid fa-pen-to-square"></i>
                    </button>
                    <button onClick={() => { if(confirm("¿Cancelar orden?")) { StorageService.cancelOrder(selectedTrackingOrder.id); refreshOrders(); } }} className="w-10 h-10 rounded-2xl bg-red-50 text-red-500 flex items-center justify-center hover:bg-red-100 transition shadow-sm" title="Cancelar pedido">
                      <i className="fa-solid fa-trash-can"></i>
                    </button>
                  </div>
                )}
              </div>

              <div className="space-y-8 relative before:content-[''] before:absolute before:left-[17px] before:top-2 before:bottom-2 before:w-1 before:bg-orange-50">
                <div className="flex items-center relative z-10">
                  <div className="w-9 h-9 rounded-full flex items-center justify-center border-4 border-white shadow-md bg-orange-600 text-white">
                    <i className="fa-solid fa-check text-[10px]"></i>
                  </div>
                  <p className="ml-4 font-black text-xs uppercase tracking-widest text-stone-800">Recibido</p>
                </div>
                <div className="flex items-center relative z-10">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center border-4 border-white shadow-md transition-colors ${[OrderStatus.PREPARING, OrderStatus.IN_TRANSIT, OrderStatus.DELIVERED].includes(selectedTrackingOrder.status) ? 'bg-orange-600 text-white' : 'bg-stone-100 text-stone-300'}`}>
                    <i className="fa-solid fa-fire-burner text-[10px]"></i>
                  </div>
                  <p className="ml-4 font-black text-xs uppercase tracking-widest text-stone-800">Cocinando</p>
                </div>
                <div className="flex items-center relative z-10">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center border-4 border-white shadow-md transition-colors ${[OrderStatus.IN_TRANSIT, OrderStatus.DELIVERED].includes(selectedTrackingOrder.status) ? 'bg-orange-600 text-white' : 'bg-stone-100 text-stone-300'}`}>
                    <i className="fa-solid fa-motorcycle text-[10px]"></i>
                  </div>
                  <p className="ml-4 font-black text-xs uppercase tracking-widest text-stone-800">En Camino</p>
                </div>
              </div>

              <div className="mt-auto pt-8 border-t border-stone-50">
                <p className="text-[10px] font-black text-stone-400 uppercase tracking-widest mb-3">Resumen de Orden</p>
                <div className="space-y-2 mb-4">
                  {selectedTrackingOrder.items.map((item, idx) => (
                    <div key={idx} className="flex justify-between text-sm">
                      <span className="font-bold text-stone-700">{item.name} <span className="text-stone-300">x{item.quantity}</span></span>
                      <span className="font-mono text-stone-500">RD$ {item.price * item.quantity}</span>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between items-end">
                  <div>
                    <p className="text-[10px] font-black text-stone-400 uppercase tracking-widest">Total a pagar</p>
                    <p className="text-2xl font-black text-orange-600">RD$ {selectedTrackingOrder.total}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-black text-stone-400 uppercase tracking-widest">Método</p>
                    <p className="text-[10px] font-bold text-stone-600 uppercase">{selectedTrackingOrder.paymentMethod === PaymentMethod.CASH_ON_DELIVERY ? 'Efectivo' : 'Pagado'}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="md:col-span-3">
            <div className="bg-stone-100 rounded-[3rem] h-[400px] md:h-full relative overflow-hidden shadow-inner border-8 border-white">
              {selectedTrackingOrder.status === OrderStatus.IN_TRANSIT ? (
                <div ref={mapContainerRef} className="w-full h-full"></div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-center p-12">
                  <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center mb-6 shadow-xl relative">
                    <i className="fa-solid fa-utensils text-4xl text-orange-500 animate-bounce"></i>
                    <div className="absolute -bottom-2 -right-2 w-10 h-10 bg-orange-600 rounded-full flex items-center justify-center border-4 border-white text-white">
                      <i className="fa-solid fa-clock text-xs animate-spin-slow"></i>
                    </div>
                  </div>
                  <h4 className="text-xl font-black text-stone-800 uppercase tracking-tight">¡Casi Listo!</h4>
                  <p className="text-stone-500 mt-4 max-w-xs mx-auto">Nuestro chef está dando los toques finales. El mapa se activará cuando el repartidor inicie la ruta.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Vista de Historial
  if (viewMode === 'HISTORY') {
    return (
      <div className="max-w-4xl mx-auto py-8 px-4 animate-in slide-in-from-right-8 duration-500">
        <div className="flex items-center justify-between mb-10">
           <button onClick={() => setViewMode('MENU')} className="w-12 h-12 rounded-2xl bg-stone-100 text-stone-500 flex items-center justify-center hover:bg-orange-50 hover:text-orange-600 transition shadow-sm">
             <i className="fa-solid fa-chevron-left"></i>
           </button>
           <h2 className="text-2xl font-black text-stone-800 uppercase tracking-tight">Mi Historial</h2>
        </div>

        {history.length === 0 ? (
          <div className="bg-white rounded-[2.5rem] p-20 text-center border-2 border-dashed border-stone-200 shadow-sm">
            <i className="fa-solid fa-box-open text-5xl text-stone-100 mb-6"></i>
            <p className="text-stone-400 font-bold uppercase tracking-widest text-xs">Aún no tienes pedidos registrados</p>
          </div>
        ) : (
          <div className="space-y-6">
            {history.map(order => (
              <div key={order.id} className="bg-white rounded-[2rem] p-8 shadow-sm border border-stone-50 flex flex-col md:flex-row md:items-center justify-between gap-6 hover:shadow-md transition">
                <div className="flex items-start space-x-6">
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 ${order.status === OrderStatus.DELIVERED ? 'bg-green-50 text-green-600' : 'bg-stone-50 text-stone-400'}`}>
                    <i className={`fa-solid ${order.status === OrderStatus.DELIVERED ? 'fa-check-double' : 'fa-xmark'} text-xl`}></i>
                  </div>
                  <div>
                    <div className="flex items-center space-x-3 mb-1">
                      <span className="text-[10px] font-mono font-black text-stone-300">#{order.id.toUpperCase()}</span>
                      <span className={`text-[10px] px-3 py-1 rounded-full font-black uppercase tracking-tighter ${getStatusColor(order.status)}`}>
                        {getStatusLabel(order.status)}
                      </span>
                    </div>
                    <h4 className="font-black text-stone-800 text-lg leading-tight">{order.items.map(i => i.name).join(', ')}</h4>
                    <p className="text-xs text-stone-400 font-bold mt-1 uppercase tracking-widest">{new Date(order.createdAt).toLocaleDateString('es-DO', { weekday: 'long', day: 'numeric', month: 'short' })}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between md:flex-col md:items-end gap-2">
                  <p className="text-xl font-black text-orange-600">RD$ {order.total}</p>
                  <button 
                    onClick={() => handleReorder(order)}
                    className="bg-orange-50 text-orange-600 px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-orange-600 hover:text-white transition active:scale-95"
                  >
                    Repetir Pedido
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Vista de Menú (Principal)
  return (
    <div className="space-y-6 pb-32 relative">
      {/* Widget Flotante de Contacto */}
      <div className="fixed bottom-8 left-8 z-[100] flex flex-col items-start">
        {showContactOptions && (
          <div className="mb-4 bg-white rounded-3xl shadow-2xl p-5 border border-stone-100 flex flex-col space-y-4 animate-in slide-in-from-bottom-6 duration-300 w-48">
            <p className="text-[10px] font-black text-stone-400 uppercase tracking-widest border-b pb-2">Atención al Cliente</p>
            <a href={WHATSAPP_LINK} target="_blank" rel="noreferrer" className="flex items-center space-x-3 text-green-600 hover:scale-105 transition group">
              <div className="w-10 h-10 rounded-2xl bg-green-50 flex items-center justify-center group-hover:bg-green-600 group-hover:text-white transition-colors">
                <i className="fa-brands fa-whatsapp text-xl"></i>
              </div>
              <span className="text-xs font-black uppercase tracking-tighter">Chat WhatsApp</span>
            </a>
            <a href={`tel:${BUSINESS_PHONE}`} className="flex items-center space-x-3 text-orange-600 hover:scale-105 transition group">
              <div className="w-10 h-10 rounded-2xl bg-orange-50 flex items-center justify-center group-hover:bg-orange-600 group-hover:text-white transition-colors">
                <i className="fa-solid fa-phone text-lg"></i>
              </div>
              <span className="text-xs font-black uppercase tracking-tighter">Llamar Ahora</span>
            </a>
          </div>
        )}
        <button 
          onClick={() => setShowContactOptions(!showContactOptions)}
          className={`w-16 h-16 rounded-full shadow-2xl flex items-center justify-center hover:scale-110 transition-all active:scale-95 z-10 ${showContactOptions ? 'bg-stone-800 text-white' : 'bg-green-600 text-white animate-pulse'}`}
        >
          {showContactOptions ? <i className="fa-solid fa-xmark text-2xl"></i> : <i className="fa-brands fa-whatsapp text-3xl"></i>}
        </button>
      </div>

      {/* Botones de Navegación del Usuario */}
      <div className="fixed bottom-8 right-8 z-[90] flex flex-col items-end space-y-4">
        {cart.length > 0 && (
          <button 
            onClick={() => setIsOrdering(true)}
            className="bg-orange-600 text-white px-8 py-5 rounded-full shadow-2xl font-black flex items-center space-x-4 hover:bg-orange-700 transition-all scale-105 hover:scale-110 group"
          >
            <div className="relative">
              <i className="fa-solid fa-cart-shopping text-2xl group-hover:animate-bounce"></i>
              <span className="absolute -top-3 -right-3 bg-white text-orange-600 w-6 h-6 rounded-full text-[10px] flex items-center justify-center border-2 border-orange-600 shadow-sm">{cart.reduce((a, b) => a + b.quantity, 0)}</span>
            </div>
            <div className="text-left">
              <span className="uppercase tracking-widest text-[10px] block">Ver Mi Carrito</span>
              <span className="text-xs font-black">RD$ {cartTotal}</span>
            </div>
          </button>
        )}
        {activeOrders.length > 0 && (
          <button 
            onClick={() => setViewMode('TRACKING')}
            className="bg-stone-800 text-white px-8 py-5 rounded-full shadow-2xl font-black flex items-center space-x-4 hover:bg-stone-900 transition-all scale-105 hover:scale-110 group"
          >
            <div className="relative">
              <i className="fa-solid fa-motorcycle text-2xl group-hover:animate-bounce"></i>
              <span className="absolute -top-3 -right-3 bg-white text-stone-800 w-6 h-6 rounded-full text-[10px] flex items-center justify-center border-2 border-stone-800 shadow-sm">{activeOrders.length}</span>
            </div>
            <span className="uppercase tracking-widest text-[10px]">
                {activeOrders.length === 1 ? 'Seguir Mi Orden' : `Seguir ${activeOrders.length} Órdenes`}
            </span>
          </button>
        )}
        <button 
          onClick={() => setViewMode('HISTORY')}
          className="bg-white text-stone-800 px-8 py-4 rounded-full shadow-xl font-black flex items-center space-x-3 hover:bg-stone-50 transition border-2 border-stone-100"
        >
          <i className="fa-solid fa-history text-xl text-stone-300"></i>
          <span className="uppercase tracking-widest text-[10px]">Mis Pedidos</span>
        </button>
      </div>

      {/* Selector de Categorías (Sticky) */}
        <div className="flex justify-center space-x-3 md:space-x-6 sticky top-16 z-40 bg-stone-50/90 backdrop-blur-md py-6 -mx-4 px-4 border-b border-stone-100 shadow-sm overflow-x-auto scrollbar-hide">
          {categories.map(cat => (
            <button 
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-8 py-4 rounded-[1.5rem] text-[10px] md:text-xs font-black uppercase tracking-widest transition-all ${activeCategory === cat ? 'bg-orange-600 text-white shadow-xl scale-105' : 'bg-white text-stone-400 hover:text-stone-600 shadow-sm border border-stone-100'}`}
            >
              {cat}
            </button>
          ))}
          {categories.length === 0 && (
            <p className="text-stone-400 text-xs italic">No hay categorías disponibles.</p>
          )}
        </div>

      <section className="px-2">
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-10 gap-6">
          <div>
            <div className="flex items-center space-x-3 mb-2">
                <div className="w-1.5 h-8 bg-orange-600 rounded-full"></div>
                <h2 className="text-4xl font-black text-stone-800 uppercase tracking-tighter">Menú El Neguev</h2>
            </div>
            <p className="text-stone-400 font-bold uppercase tracking-widest text-[10px] ml-4">Auténtico sabor dominicano</p>
          </div>
          <div className="bg-white px-6 py-3 rounded-2xl shadow-sm border border-orange-100 flex items-center w-fit">
            <i className="fa-solid fa-calendar-check text-orange-600 mr-3"></i>
            <span className="font-black text-[10px] uppercase tracking-widest text-stone-600">{new Date().toLocaleDateString('es-DO', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
          {filteredMenu.map(dish => (
            <div key={dish.id} className="bg-white rounded-[3rem] shadow-sm border border-stone-100 overflow-hidden group hover:shadow-2xl transition-all duration-700 hover:-translate-y-2">
              <div className="h-72 relative overflow-hidden">
                <img src={dish.imageUrl} alt={dish.name} className="w-full h-full object-cover group-hover:scale-110 transition duration-1000" referrerPolicy="no-referrer" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                <div className="absolute top-6 right-6 bg-orange-600 text-white px-6 py-3 rounded-2xl font-black shadow-2xl text-lg">
                  RD$ {dish.price}
                </div>
              </div>
              <div className="p-10">
                <div className="flex justify-between items-start mb-4">
                    <h3 className="text-2xl font-black text-stone-800 group-hover:text-orange-600 transition-colors">{dish.name}</h3>
                </div>
                <p className="text-stone-400 text-sm mb-10 leading-relaxed font-medium line-clamp-3 italic">
                  "{dish.description}"
                </p>
                <button 
                  onClick={() => addToCart(dish)}
                  className="w-full py-5 rounded-[1.5rem] font-black shadow-xl transition-all active:scale-95 uppercase tracking-widest text-xs bg-orange-600 text-white hover:bg-orange-700 flex items-center justify-center"
                >
                  <i className="fa-solid fa-cart-plus mr-2"></i> Agregar al Carrito
                </button>
              </div>
            </div>
          ))}
        </div>
        {filteredMenu.length === 0 && (
          <div className="bg-white rounded-[3rem] p-20 text-center border-2 border-dashed border-stone-200 shadow-sm">
            <i className="fa-solid fa-utensils text-5xl text-stone-100 mb-6"></i>
            <p className="text-stone-400 font-bold uppercase tracking-widest text-xs">No hay {activeCategory.toLowerCase()} disponibles en este momento</p>
          </div>
        )}
      </section>

      {/* Modal de Modificación de Orden */}
      {isEditingOrder && selectedTrackingOrder && (
          <div className="fixed inset-0 bg-stone-900/90 backdrop-blur-xl flex items-center justify-center z-[120] p-4 animate-in fade-in duration-300">
            <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-2xl p-10 border-4 border-blue-50 max-h-[90vh] overflow-y-auto flex flex-col">
                <div className="flex justify-between items-center mb-8">
                    <div>
                        <h3 className="text-3xl font-black uppercase tracking-tight text-blue-700">Modificar Orden</h3>
                        <p className="text-[10px] text-stone-400 font-bold uppercase tracking-widest">Aún estás a tiempo de ajustar tu pedido</p>
                    </div>
                    <button onClick={() => setIsEditingOrder(false)} className="bg-stone-50 w-12 h-12 rounded-full flex items-center justify-center hover:bg-red-50 hover:text-red-500 transition shadow-sm">
                        <i className="fa-solid fa-xmark text-xl"></i>
                    </button>
                </div>

                <div className="flex-grow overflow-y-auto pr-2 space-y-10">
                    <section>
                        <h4 className="text-[10px] font-black text-stone-400 uppercase tracking-widest mb-4 flex items-center">
                            <i className="fa-solid fa-basket-shopping mr-2"></i> Platos en tu cesta
                        </h4>
                        <div className="space-y-4">
                            {tempOrderItems.map((item) => (
                                <div key={item.dishId} className="flex items-center justify-between p-6 bg-stone-50 rounded-3xl border border-stone-100 shadow-sm">
                                    <div className="flex items-center space-x-4">
                                        <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-blue-600 font-black shadow-sm">
                                            {item.quantity}
                                        </div>
                                        <div>
                                            <p className="font-black text-stone-800 text-lg uppercase tracking-tighter">{item.name}</p>
                                            <p className="text-[10px] font-bold text-stone-400 tracking-widest">RD$ {item.price} c/u</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center space-x-3">
                                        <button onClick={() => updateTempItemQuantity(item.dishId, -1)} className="w-10 h-10 rounded-xl bg-white border-2 border-stone-100 flex items-center justify-center text-stone-400 hover:border-red-200 hover:text-red-500 transition shadow-sm">
                                            <i className="fa-solid fa-minus"></i>
                                        </button>
                                        <button onClick={() => updateTempItemQuantity(item.dishId, 1)} className="w-10 h-10 rounded-xl bg-white border-2 border-stone-100 flex items-center justify-center text-stone-400 hover:border-green-200 hover:text-green-600 transition shadow-sm">
                                            <i className="fa-solid fa-plus"></i>
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>

                    <section>
                        <h4 className="text-[10px] font-black text-stone-400 uppercase tracking-widest mb-4 flex items-center">
                            <i className="fa-solid fa-utensils mr-2"></i> Añadir algo más
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {menu.filter(m => m.available).map(dish => (
                                <button key={dish.id} onClick={() => addDishToTempOrder(dish)} className="flex items-center p-4 bg-white border-2 border-stone-50 rounded-2xl hover:border-blue-200 transition text-left group shadow-sm">
                                    <img src={dish.imageUrl} className="w-14 h-14 rounded-xl object-cover mr-4 shadow-md group-hover:scale-105 transition" referrerPolicy="no-referrer" />
                                    <div className="flex-grow">
                                        <p className="text-xs font-black text-stone-800 uppercase tracking-tighter leading-tight mb-1">{dish.name}</p>
                                        <p className="text-[10px] font-black text-orange-600">RD$ {dish.price}</p>
                                    </div>
                                    <i className="fa-solid fa-circle-plus text-stone-200 group-hover:text-blue-500 text-xl transition-colors"></i>
                                </button>
                            ))}
                        </div>
                    </section>
                </div>

                <div className="mt-10 pt-8 border-t border-stone-100 flex items-center justify-between">
                    <div>
                        <p className="text-[10px] font-black text-stone-400 uppercase tracking-widest mb-1">Nuevo Total Ajustado</p>
                        <p className="text-3xl font-black text-orange-600">RD$ {tempOrderItems.reduce((acc, item) => acc + (item.price * item.quantity), 0)}</p>
                    </div>
                    <button 
                        onClick={saveEditedOrder}
                        className="bg-blue-600 text-white px-10 py-5 rounded-[1.5rem] font-black hover:bg-blue-700 shadow-2xl transition active:scale-95 uppercase tracking-widest text-xs"
                    >
                        Confirmar Cambios
                    </button>
                </div>
            </div>
          </div>
      )}

      {/* Formulario de Pedido Nuevo (Checkout) */}
      {isOrdering && cart.length > 0 && (
        <div className="fixed inset-0 bg-stone-900/90 backdrop-blur-xl flex items-center justify-center z-[110] p-4 animate-in zoom-in-95 duration-300">
          <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-2xl p-10 border-4 border-orange-50 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-8">
              <div>
                <h3 className="text-2xl font-black uppercase tracking-tight text-stone-800">Finalizar Pedido</h3>
                <p className="text-[10px] text-stone-400 font-bold uppercase tracking-widest">Revisa tu carrito y completa los datos</p>
              </div>
              <button onClick={() => setIsOrdering(false)} className="bg-stone-50 w-12 h-12 rounded-full flex items-center justify-center hover:bg-orange-100 hover:text-orange-600 transition shadow-sm">
                <i className="fa-solid fa-xmark text-xl"></i>
              </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
              <div className="space-y-6">
                <div className="bg-stone-50 rounded-3xl p-6 border border-stone-100">
                  <h4 className="text-[10px] font-black text-stone-400 uppercase tracking-widest mb-4">Tu Carrito</h4>
                  <div className="space-y-4 max-h-60 overflow-y-auto pr-2 scrollbar-hide">
                    {cart.map((item) => (
                      <div key={item.dishId} className="flex items-center justify-between">
                        <div className="flex-grow">
                          <p className="text-xs font-black text-stone-800 uppercase tracking-tighter">{item.name}</p>
                          <p className="text-[10px] text-stone-400 font-bold">RD$ {item.price} x {item.quantity}</p>
                        </div>
                        <div className="flex items-center space-x-2">
                          <button onClick={() => updateCartQuantity(item.dishId, -1)} className="w-8 h-8 rounded-lg bg-white border border-stone-200 flex items-center justify-center text-stone-400 hover:text-red-500 transition">
                            <i className="fa-solid fa-minus text-[10px]"></i>
                          </button>
                          <span className="text-xs font-black w-4 text-center">{item.quantity}</span>
                          <button onClick={() => updateCartQuantity(item.dishId, 1)} className="w-8 h-8 rounded-lg bg-white border border-stone-200 flex items-center justify-center text-stone-400 hover:text-green-600 transition">
                            <i className="fa-solid fa-plus text-[10px]"></i>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-6 pt-4 border-t border-stone-200 flex justify-between items-end">
                    <span className="text-[10px] font-black text-stone-400 uppercase tracking-widest">Total</span>
                    <span className="text-xl font-black text-orange-600">RD$ {cartTotal}</span>
                  </div>
                </div>
              </div>

              <form onSubmit={handleOrder} className="space-y-6">
                <div>
                  <label className="block text-[10px] font-black text-stone-400 uppercase tracking-widest mb-2 ml-2">¿Quién recibe?</label>
                  <input required type="text" className="w-full bg-stone-50 px-6 py-4 rounded-2xl border-2 border-transparent focus:border-orange-500 outline-none transition font-bold text-sm" 
                    placeholder="Tu nombre completo" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-stone-400 uppercase tracking-widest mb-2 ml-2 flex justify-between items-center">
                    Dirección de Entrega
                    <button type="button" onClick={handleGetLocation} className="text-[10px] text-orange-600 font-black hover:underline">
                      {isLocating ? <i className="fa-solid fa-spinner animate-spin"></i> : <i className="fa-solid fa-location-arrow"></i>} GPS
                    </button>
                  </label>
                  <input required type="text" className="w-full bg-stone-50 px-6 py-4 rounded-2xl border-2 border-transparent focus:border-orange-500 outline-none transition font-bold text-sm" 
                    placeholder="Calle, sector, referencia..." value={formData.address} onChange={(e) => setFormData({...formData, address: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-stone-400 uppercase tracking-widest mb-2 ml-2">Teléfono de Contacto</label>
                  <input required type="tel" className="w-full bg-stone-50 px-6 py-4 rounded-2xl border-2 border-transparent focus:border-orange-500 outline-none transition font-bold text-sm" 
                    placeholder="809..." value={formData.phone} onChange={(e) => setFormData({...formData, phone: e.target.value})}
                  />
                </div>
  
                <div className="space-y-3 pt-2">
                  <label className="block text-[10px] font-black text-stone-400 uppercase tracking-widest ml-2">Forma de Pago</label>
                  <div className="grid grid-cols-1 gap-2">
                      <button type="button" onClick={() => setFormData({...formData, paymentMethod: PaymentMethod.CASH_ON_DELIVERY})}
                          className={`p-5 rounded-[1.5rem] border-2 transition-all flex items-center justify-between ${formData.paymentMethod === PaymentMethod.CASH_ON_DELIVERY ? 'border-orange-600 bg-orange-50 shadow-md' : 'border-stone-100 hover:border-orange-200'}`}>
                          <div className="text-left">
                              <p className="font-black text-sm uppercase tracking-tighter">Efectivo</p>
                              <p className="text-[10px] text-stone-400 font-bold uppercase">Paga al recibir</p>
                          </div>
                          <i className={`fa-solid fa-circle-check ${formData.paymentMethod === PaymentMethod.CASH_ON_DELIVERY ? 'text-orange-600' : 'text-stone-100'}`}></i>
                      </button>
                  </div>
                </div>
                <button type="submit" className="w-full bg-orange-600 text-white py-6 rounded-[1.5rem] font-black hover:bg-orange-700 shadow-2xl transition-all active:scale-95 uppercase tracking-widest text-xs mt-4">
                  Confirmar Orden Final
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes bounce-slow {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-12px); }
        }
        .animate-bounce-slow {
          animation: bounce-slow 4s ease-in-out infinite;
        }
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        .animate-spin-slow {
          animation: spin 6s linear infinite;
        }
      `}</style>
    </div>
  );
};

export default CustomerView;
