
import React, { useState, useEffect, useRef } from 'react';
import { StorageService } from '../services/storageService';
import { Dish, Order, OrderStatus, LatLng, PaymentMethod } from '../types';

declare const L: any; // Leaflet global

const CustomerView: React.FC = () => {
  const [menu, setMenu] = useState<Dish[]>([]);
  const [activeOrders, setActiveOrders] = useState<Order[]>([]);
  const [selectedTrackingOrder, setSelectedTrackingOrder] = useState<Order | null>(null);
  const [history, setHistory] = useState<Order[]>([]);
  const [viewMode, setViewMode] = useState<'MENU' | 'TRACKING' | 'HISTORY'>('MENU');
  const [activeCategory, setActiveCategory] = useState<string>('Platos');
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
  const [tempOrderItems, setTempOrderItems] = useState<{ dishId: string; quantity: number; name: string; price: number }[]>([]);
  
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);

  // Categories available in the app
  const categories = ['Platos', 'Bebidas', 'Postres'];
  const BUSINESS_PHONE = "8090000000"; // Reemplazar con el real

  // Initial load
  useEffect(() => {
    setMenu(StorageService.getMenu());
    refreshOrders();
  }, []);

  const refreshOrders = () => {
    const allOrders = StorageService.getOrders();
    const active = allOrders.filter(o => o.status !== OrderStatus.DELIVERED && o.status !== OrderStatus.CANCELLED);
    setActiveOrders(active);
    
    // Auto-select the first active order if none is selected
    if (active.length > 0 && !selectedTrackingOrder) {
      setSelectedTrackingOrder(active[0]);
    } else if (active.length > 0 && selectedTrackingOrder) {
      // Update the current selected order with fresh data
      const updated = active.find(o => o.id === selectedTrackingOrder.id);
      if (updated) setSelectedTrackingOrder(updated);
      else setSelectedTrackingOrder(active[0]);
    } else {
      setSelectedTrackingOrder(null);
    }

    setHistory(allOrders.filter(o => o.status === OrderStatus.DELIVERED || o.status === OrderStatus.CANCELLED).sort((a, b) => b.createdAt - a.createdAt));
  };

  // Sync active orders status in background
  useEffect(() => {
    const interval = setInterval(refreshOrders, 3000);
    return () => clearInterval(interval);
  }, [selectedTrackingOrder?.id]);

  // Handle Map Logic for Tracking
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
        // Cleanup map if order is not in transit
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
      async (position) => {
        const { latitude, longitude } = position.coords;
        const mockAddress = `Ubicación GPS: ${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
        setFormData(prev => ({ ...prev, address: mockAddress }));
        setIsLocating(false);
      },
      (error) => {
        console.error(error);
        alert("No pudimos obtener tu ubicación. Por favor, escríbela manualmente.");
        setIsLocating(false);
      },
      { enableHighAccuracy: true }
    );
  };

  const handleOrder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDish) return;

    const newOrder: Order = {
      id: Math.random().toString(36).substr(2, 9),
      customerName: formData.name,
      address: formData.address,
      phone: formData.phone,
      notes: formData.notes,
      paymentMethod: formData.paymentMethod,
      items: [{
        dishId: selectedDish.id,
        name: selectedDish.name,
        quantity: 1,
        price: selectedDish.price
      }],
      total: selectedDish.price,
      status: OrderStatus.PENDING,
      createdAt: Date.now()
    };

    StorageService.saveOrder(newOrder);
    refreshOrders();
    setSelectedTrackingOrder(newOrder);
    setViewMode('TRACKING');
    setIsOrdering(false);
    setSelectedDish(null);
    alert("¡Pedido realizado con éxito! Puedes seguirlo ahora o seguir comprando.");
  };

  const handleCancelOrder = (orderId: string) => {
    const confirmCancel = window.confirm('¿Deseas cancelar esta orden?');
    if (confirmCancel) {
      StorageService.updateOrderStatus(orderId, OrderStatus.CANCELLED);
      refreshOrders();
      alert('Tu orden ha sido cancelada.');
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
        if (newQty <= 0) {
            updated.splice(index, 1);
        } else {
            updated[index] = { ...updated[index], quantity: newQty };
        }
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
    if (!selectedTrackingOrder || tempOrderItems.length === 0) {
        if (tempOrderItems.length === 0) alert("La orden no puede estar vacía. Cancela la orden si ya no la deseas.");
        return;
    }
    const total = tempOrderItems.reduce((acc, item) => acc + (item.price * item.quantity), 0);
    const updatedOrder = { ...selectedTrackingOrder, items: tempOrderItems, total };
    StorageService.updateOrder(updatedOrder);
    setSelectedTrackingOrder(updatedOrder);
    setIsEditingOrder(false);
    refreshOrders();
    alert("Orden actualizada correctamente.");
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

  // Tracking View
  if (viewMode === 'TRACKING' && selectedTrackingOrder) {
    return (
      <div className="max-w-4xl mx-auto py-8 px-4">
        <div className="flex items-center justify-between mb-8">
           <button onClick={() => setViewMode('MENU')} className="bg-stone-100 text-stone-500 px-4 py-2 rounded-xl text-sm font-bold hover:bg-stone-200 transition flex items-center">
             <i className="fa-solid fa-plus mr-2"></i> Ordenar más
           </button>
           <h2 className="text-xl font-black text-stone-800 uppercase tracking-tight">Seguimiento Live</h2>
        </div>

        {activeOrders.length > 1 && (
          <div className="flex space-x-2 overflow-x-auto pb-4 mb-6 -mx-4 px-4">
            {activeOrders.map(o => (
              <button 
                key={o.id}
                onClick={() => setSelectedTrackingOrder(o)}
                className={`flex-shrink-0 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${selectedTrackingOrder.id === o.id ? 'bg-orange-600 border-orange-600 text-white shadow-lg' : 'bg-white border-stone-200 text-stone-400'}`}
              >
                #{o.id.toUpperCase()}
              </button>
            ))}
          </div>
        )}
        
        <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
          <div className="md:col-span-2 space-y-6">
            <div className="bg-white rounded-3xl shadow-xl p-6 border border-orange-100 h-full flex flex-col">
              <div className="mb-6 flex justify-between items-start">
                <div>
                  <p className="text-[10px] text-stone-400 font-bold uppercase tracking-widest mb-1">Orden #{selectedTrackingOrder.id.toUpperCase()}</p>
                  <div className={`px-4 py-2 rounded-2xl font-bold inline-block text-sm ${getStatusColor(selectedTrackingOrder.status)}`}>
                    {getStatusLabel(selectedTrackingOrder.status)}
                  </div>
                </div>
                {selectedTrackingOrder.status === OrderStatus.PENDING && (
                  <div className="flex space-x-2">
                    <button 
                        onClick={startEditingOrder}
                        className="text-blue-500 hover:text-blue-700 text-xs font-bold uppercase tracking-widest bg-blue-50 px-3 py-1 rounded-lg transition"
                        title="Modificar Orden"
                    >
                        <i className="fa-solid fa-pen"></i>
                    </button>
                    <button 
                        onClick={() => handleCancelOrder(selectedTrackingOrder.id)}
                        className="text-red-500 hover:text-red-700 text-xs font-bold uppercase tracking-widest bg-red-50 px-3 py-1 rounded-lg transition"
                    >
                        <i className="fa-solid fa-trash-can"></i>
                    </button>
                  </div>
                )}
              </div>

              <div className="space-y-6 relative before:content-[''] before:absolute before:left-[15px] before:top-2 before:bottom-2 before:w-0.5 before:bg-orange-100">
                <div className="flex items-start relative z-10">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center border-4 border-white shadow-sm bg-orange-600">
                    <i className="fa-solid fa-receipt text-white text-[10px]"></i>
                  </div>
                  <div className="ml-3">
                    <p className="font-bold text-sm">Recibido</p>
                  </div>
                </div>
                <div className="flex items-start relative z-10">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center border-4 border-white shadow-sm ${[OrderStatus.PREPARING, OrderStatus.IN_TRANSIT, OrderStatus.DELIVERED].includes(selectedTrackingOrder.status) ? 'bg-orange-600' : 'bg-stone-200'}`}>
                    <i className="fa-solid fa-fire-burner text-white text-[10px]"></i>
                  </div>
                  <div className="ml-3">
                    <p className="font-bold text-sm">Preparando</p>
                  </div>
                </div>
                <div className="flex items-start relative z-10">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center border-4 border-white shadow-sm ${[OrderStatus.IN_TRANSIT, OrderStatus.DELIVERED].includes(selectedTrackingOrder.status) ? 'bg-orange-600' : 'bg-stone-200'}`}>
                    <i className="fa-solid fa-motorcycle text-white text-[10px]"></i>
                  </div>
                  <div className="ml-3">
                    <p className="font-bold text-sm">En Camino</p>
                  </div>
                </div>
              </div>

              <div className="mt-8 pt-6 border-t border-stone-50">
                <p className="text-xs font-bold text-stone-400 uppercase tracking-widest mb-2">Resumen</p>
                {selectedTrackingOrder.items.map((item, idx) => (
                    <p key={idx} className="text-sm font-bold text-stone-800">{item.name} x {item.quantity}</p>
                ))}
                <p className="text-sm font-black text-orange-600 mt-1">Total: RD$ {selectedTrackingOrder.total}</p>
              </div>

              <div className="mt-4 pt-6 border-t border-stone-50 mb-auto">
                <p className="text-xs font-bold text-stone-400 uppercase tracking-widest mb-2">Destino</p>
                <p className="text-sm font-medium text-stone-800">{selectedTrackingOrder.address}</p>
              </div>
              
              {selectedTrackingOrder.status !== OrderStatus.PENDING && (
                  <p className="mt-4 text-[10px] text-stone-400 italic text-center">
                    La orden ya no puede modificarse porque está en preparación o ruta.
                  </p>
              )}
            </div>
          </div>

          <div className="md:col-span-3">
            <div className="bg-stone-200 rounded-3xl h-[400px] md:h-full relative overflow-hidden shadow-xl border-4 border-white">
              {selectedTrackingOrder.status === OrderStatus.IN_TRANSIT ? (
                <div ref={mapContainerRef} className="w-full h-full"></div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-center p-8">
                  <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mb-4 shadow-sm">
                    {selectedTrackingOrder.status === OrderStatus.PREPARING ? (
                      <i className="fa-solid fa-utensils text-3xl text-orange-400 animate-bounce"></i>
                    ) : (
                      <i className="fa-solid fa-clock text-3xl text-yellow-400 animate-spin-slow"></i>
                    )}
                  </div>
                  <h4 className="text-lg font-bold text-stone-700">El mapa se activará pronto</h4>
                  <p className="text-sm text-stone-500 mt-2">Tu pedido está siendo preparado con el mejor sazón.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // History View
  if (viewMode === 'HISTORY') {
    return (
      <div className="max-w-4xl mx-auto py-8 px-4">
        <div className="flex items-center justify-between mb-8">
           <button onClick={() => setViewMode('MENU')} className="bg-stone-100 text-stone-500 px-4 py-2 rounded-xl text-sm font-bold hover:bg-stone-200 transition flex items-center">
             <i className="fa-solid fa-arrow-left mr-2"></i> Volver
           </button>
           <h2 className="text-2xl font-black text-stone-800 uppercase tracking-tight">Mi Historial</h2>
        </div>

        {history.length === 0 ? (
          <div className="bg-white rounded-3xl p-16 text-center border-2 border-dashed border-stone-200 shadow-sm">
            <p className="text-stone-400 font-bold">Sin pedidos anteriores aún.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {history.map(order => (
              <div key={order.id} className="bg-white rounded-2xl p-6 shadow-sm border border-stone-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center space-x-2 mb-1">
                    <span className="text-[10px] font-mono font-bold text-stone-400">#{order.id.toUpperCase()}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${getStatusColor(order.status)}`}>
                      {getStatusLabel(order.status)}
                    </span>
                  </div>
                  <h4 className="font-bold text-stone-800">{order.items.map(i => i.name).join(', ')}</h4>
                  <p className="text-xs text-stone-500">{new Date(order.createdAt).toLocaleDateString()}</p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-black text-orange-600">RD$ {order.total}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Menu View Content
  return (
    <div className="space-y-6 pb-24 relative">
      {/* Floating Contact Widget */}
      <div className="fixed bottom-6 left-6 z-[100] flex flex-col items-start">
        {showContactOptions && (
          <div className="mb-4 bg-white rounded-2xl shadow-2xl p-4 border border-stone-100 flex flex-col space-y-3 animate-in slide-in-from-bottom-4">
            <a 
              href={`https://wa.me/${BUSINESS_PHONE}`}
              target="_blank" rel="noreferrer"
              className="flex items-center space-x-3 text-green-600 hover:text-green-700 transition"
            >
              <div className="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center">
                <i className="fa-brands fa-whatsapp text-xl"></i>
              </div>
              <span className="text-xs font-black uppercase">WhatsApp</span>
            </a>
            <a 
              href={`tel:${BUSINESS_PHONE}`}
              className="flex items-center space-x-3 text-orange-600 hover:text-orange-700 transition"
            >
              <div className="w-10 h-10 rounded-full bg-orange-50 flex items-center justify-center">
                <i className="fa-solid fa-phone text-xl"></i>
              </div>
              <span className="text-xs font-black uppercase">Llamar</span>
            </a>
          </div>
        )}
        <button 
          onClick={() => setShowContactOptions(!showContactOptions)}
          className="w-14 h-14 rounded-full bg-green-600 text-white shadow-2xl flex items-center justify-center hover:scale-110 transition-transform active:scale-95 z-10"
        >
          {showContactOptions ? <i className="fa-solid fa-xmark text-xl"></i> : <i className="fa-brands fa-whatsapp text-2xl"></i>}
        </button>
      </div>

      {/* Navigation Buttons */}
      <div className="fixed bottom-6 right-6 z-[90] flex flex-col items-end space-y-3">
        {activeOrders.length > 0 && (
          <button 
            onClick={() => setViewMode('TRACKING')}
            className="bg-orange-600 text-white px-6 py-4 rounded-full shadow-2xl font-black flex items-center space-x-3 hover:bg-orange-700 transition animate-bounce-slow"
          >
            <i className="fa-solid fa-motorcycle text-xl"></i>
            <span className="uppercase tracking-widest text-[10px]">
                {activeOrders.length === 1 ? 'Seguir Pedido' : `Seguir ${activeOrders.length} Pedidos`}
            </span>
          </button>
        )}
        <button 
          onClick={() => setViewMode('HISTORY')}
          className="bg-white text-stone-800 px-6 py-4 rounded-full shadow-2xl font-black flex items-center space-x-3 hover:bg-stone-50 transition border border-stone-100"
        >
          <i className="fa-solid fa-clock-rotate-left text-xl text-stone-400"></i>
          <span className="uppercase tracking-widest text-[10px]">Historial</span>
        </button>
      </div>

      {/* Category Tabs */}
      <div className="flex justify-center space-x-2 md:space-x-4 sticky top-16 z-40 bg-stone-50/95 backdrop-blur-sm py-6 -mx-4 px-4 border-b border-stone-100 shadow-sm">
        {categories.map(cat => (
          <button 
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`px-6 py-3 rounded-2xl text-xs md:text-sm font-black uppercase tracking-widest transition-all ${activeCategory === cat ? 'bg-orange-600 text-white shadow-lg' : 'bg-white text-stone-500 hover:bg-stone-100 shadow-sm border border-stone-100'}`}
          >
            {cat}
          </button>
        ))}
      </div>

      <section className="px-2">
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-4">
          <div>
            <h2 className="text-3xl font-black text-stone-800 uppercase tracking-tight">{activeCategory} del Día</h2>
            <p className="text-stone-500">Haz tu pedido hoy mismo</p>
          </div>
          <div className="bg-white px-6 py-2 rounded-2xl shadow-sm border border-orange-100 flex items-center w-fit">
            <i className="fa-solid fa-calendar-day text-orange-600 mr-3"></i>
            <span className="font-bold text-stone-700">{new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })}</span>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {filteredMenu.map(dish => (
            <div key={dish.id} className="bg-white rounded-3xl shadow-sm border border-stone-100 overflow-hidden group hover:shadow-2xl transition-all duration-500">
              <div className="h-64 relative overflow-hidden">
                <img src={dish.imageUrl} alt={dish.name} className="w-full h-full object-cover group-hover:scale-110 transition duration-700" />
                <div className="absolute top-4 right-4 bg-orange-600 text-white px-5 py-2 rounded-2xl font-black shadow-xl">
                  RD$ {dish.price}
                </div>
              </div>
              <div className="p-8">
                <h3 className="text-2xl font-bold mb-3">{dish.name}</h3>
                <p className="text-stone-500 text-sm mb-8 leading-relaxed line-clamp-2">
                  {dish.description}
                </p>
                <button 
                  onClick={() => {
                    setSelectedDish(dish);
                    setIsOrdering(true);
                  }}
                  className="w-full py-4 rounded-2xl font-black shadow-lg transition-all active:scale-95 uppercase tracking-widest text-sm bg-orange-600 text-white hover:bg-orange-700"
                >
                  Pedir Ahora
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Edit Order Modal */}
      {isEditingOrder && selectedTrackingOrder && (
          <div className="fixed inset-0 bg-stone-900/80 backdrop-blur-md flex items-center justify-center z-[110] p-4">
            <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-2xl p-8 border-4 border-blue-100 max-h-[90vh] overflow-y-auto flex flex-col">
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h3 className="text-2xl font-black uppercase tracking-tight">Modificar Orden</h3>
                        <p className="text-xs text-stone-400 font-bold uppercase tracking-widest">ID: #{selectedTrackingOrder.id.toUpperCase()}</p>
                    </div>
                    <button onClick={() => setIsEditingOrder(false)} className="bg-stone-100 w-10 h-10 rounded-full flex items-center justify-center hover:bg-red-100 hover:text-red-600 transition">
                        <i className="fa-solid fa-xmark"></i>
                    </button>
                </div>

                <div className="flex-grow overflow-y-auto pr-2">
                    <section className="mb-8">
                        <h4 className="text-xs font-black text-stone-400 uppercase tracking-widest mb-4">Platos actuales</h4>
                        <div className="space-y-3">
                            {tempOrderItems.map((item) => (
                                <div key={item.dishId} className="flex items-center justify-between p-4 bg-stone-50 rounded-2xl border border-stone-100">
                                    <div>
                                        <p className="font-bold text-stone-800">{item.name}</p>
                                        <p className="text-xs text-stone-400">RD$ {item.price} c/u</p>
                                    </div>
                                    <div className="flex items-center space-x-4">
                                        <button 
                                            onClick={() => updateTempItemQuantity(item.dishId, -1)}
                                            className="w-8 h-8 rounded-full bg-white border border-stone-200 flex items-center justify-center text-stone-400 hover:bg-red-50 hover:text-red-600 transition"
                                        >
                                            <i className="fa-solid fa-minus text-[10px]"></i>
                                        </button>
                                        <span className="font-black text-stone-800">{item.quantity}</span>
                                        <button 
                                            onClick={() => updateTempItemQuantity(item.dishId, 1)}
                                            className="w-8 h-8 rounded-full bg-white border border-stone-200 flex items-center justify-center text-stone-400 hover:bg-green-50 hover:text-green-600 transition"
                                        >
                                            <i className="fa-solid fa-plus text-[10px]"></i>
                                        </button>
                                    </div>
                                </div>
                            ))}
                            {tempOrderItems.length === 0 && (
                                <p className="text-center text-red-500 font-bold text-sm italic py-4">Agregue al menos un plato del menú.</p>
                            )}
                        </div>
                    </section>

                    <section>
                        <h4 className="text-xs font-black text-stone-400 uppercase tracking-widest mb-4">Agregar más del menú</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {menu.filter(m => m.available).map(dish => (
                                <button 
                                    key={dish.id} 
                                    onClick={() => addDishToTempOrder(dish)}
                                    className="flex items-center p-3 bg-white border border-stone-100 rounded-xl hover:border-orange-200 transition text-left group"
                                >
                                    <img src={dish.imageUrl} className="w-10 h-10 rounded-lg object-cover mr-3" />
                                    <div className="flex-grow">
                                        <p className="text-xs font-bold text-stone-800 group-hover:text-orange-600 transition">{dish.name}</p>
                                        <p className="text-[10px] text-stone-400">RD$ {dish.price}</p>
                                    </div>
                                    <i className="fa-solid fa-circle-plus text-stone-200 group-hover:text-orange-400"></i>
                                </button>
                            ))}
                        </div>
                    </section>
                </div>

                <div className="mt-8 pt-6 border-t border-stone-100 flex items-center justify-between">
                    <div>
                        <p className="text-xs font-black text-stone-400 uppercase tracking-widest">Nuevo Total</p>
                        <p className="text-2xl font-black text-orange-600">RD$ {tempOrderItems.reduce((acc, item) => acc + (item.price * item.quantity), 0)}</p>
                    </div>
                    <button 
                        onClick={saveEditedOrder}
                        className="bg-blue-600 text-white px-8 py-4 rounded-2xl font-black hover:bg-blue-700 shadow-xl transition active:scale-95 uppercase tracking-widest text-xs"
                    >
                        Guardar Cambios
                    </button>
                </div>
            </div>
          </div>
      )}

      {isOrdering && selectedDish && (
        <div className="fixed inset-0 bg-stone-900/80 backdrop-blur-md flex items-center justify-center z-[110] p-4">
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-lg p-10 border-4 border-orange-100 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-8">
              <h3 className="text-2xl font-black uppercase tracking-tight">Datos de Envío</h3>
              <button onClick={() => setIsOrdering(false)} className="bg-stone-100 w-10 h-10 rounded-full flex items-center justify-center hover:bg-orange-100 hover:text-orange-600 transition">
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>
            
            <form onSubmit={handleOrder} className="space-y-5">
              <div>
                <label className="block text-xs font-black text-stone-400 uppercase tracking-widest mb-2">Tu Nombre</label>
                <input required type="text" className="w-full bg-stone-50 px-6 py-4 rounded-2xl border-2 border-transparent focus:border-orange-500 outline-none transition" 
                  placeholder="Ej. Juan Pérez" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-xs font-black text-stone-400 uppercase tracking-widest mb-2 flex justify-between items-center">
                  Dirección
                  <button type="button" onClick={handleGetLocation} className="text-[10px] text-orange-600 font-black">
                    {isLocating ? 'Cargando...' : 'Usar GPS'}
                  </button>
                </label>
                <input required type="text" className="w-full bg-stone-50 px-6 py-4 rounded-2xl border-2 border-transparent focus:border-orange-500 outline-none transition" 
                  placeholder="Calle y Número..." value={formData.address} onChange={(e) => setFormData({...formData, address: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-xs font-black text-stone-400 uppercase tracking-widest mb-2">Teléfono</label>
                <input required type="tel" className="w-full bg-stone-50 px-6 py-4 rounded-2xl border-2 border-transparent focus:border-orange-500 outline-none transition" 
                  placeholder="809..." value={formData.phone} onChange={(e) => setFormData({...formData, phone: e.target.value})}
                />
              </div>
              <div className="space-y-3 pt-4">
                <label className="block text-xs font-black text-stone-400 uppercase tracking-widest">Pago</label>
                <div className="grid grid-cols-1 gap-2">
                    <button type="button" onClick={() => setFormData({...formData, paymentMethod: PaymentMethod.CASH_ON_DELIVERY})}
                        className={`p-4 rounded-2xl border-2 transition text-left ${formData.paymentMethod === PaymentMethod.CASH_ON_DELIVERY ? 'border-orange-600 bg-orange-50' : 'border-stone-100'}`}>
                        <p className="font-bold text-sm">Contra Entrega</p>
                    </button>
                </div>
              </div>
              <button type="submit" className="w-full bg-orange-600 text-white py-5 rounded-2xl font-black hover:bg-orange-700 shadow-xl transition-all active:scale-95 uppercase tracking-widest mt-6">
                Confirmar RD$ {selectedDish.price}
              </button>
            </form>
          </div>
        </div>
      )}

      <style>{`
        @keyframes bounce-slow {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
        .animate-bounce-slow {
          animation: bounce-slow 3s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
};

export default CustomerView;
