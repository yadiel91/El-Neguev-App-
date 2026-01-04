
import React, { useState, useEffect, useRef } from 'react';
import { StorageService } from '../services/storageService';
import { Order, OrderStatus, PaymentMethod } from '../types';

const DeliveryView: React.FC = () => {
  const [activeOrders, setActiveOrders] = useState<Order[]>([]);
  const [completedOrders, setCompletedOrders] = useState<Order[]>([]);
  const [activeTab, setActiveTab] = useState<'ACTIVE' | 'HISTORY'>('ACTIVE');
  const [currentDeliveryMan] = useState('d1'); 
  const watchIdRef = useRef<number | null>(null);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 5000);
    return () => {
      clearInterval(interval);
      if (watchIdRef.current) navigator.geolocation.clearWatch(watchIdRef.current);
    };
  }, []);

  const refresh = () => {
    const all = StorageService.getOrders();
    
    // Filter active orders (assigned to me and not delivered/cancelled)
    const active = all.filter(o => 
      o.deliveryAssignedTo === currentDeliveryMan && 
      o.status !== OrderStatus.DELIVERED && 
      o.status !== OrderStatus.CANCELLED
    );
    setActiveOrders(active);

    // Filter completed orders (assigned to me and delivered)
    const completed = all.filter(o => 
      o.deliveryAssignedTo === currentDeliveryMan && 
      o.status === OrderStatus.DELIVERED
    ).sort((a, b) => b.createdAt - a.createdAt);
    setCompletedOrders(completed);
    
    const anyInTransit = active.some(o => o.status === OrderStatus.IN_TRANSIT);
    if (anyInTransit && !watchIdRef.current) {
      startTracking();
    } else if (!anyInTransit && watchIdRef.current) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
  };

  const startTracking = () => {
    if (!navigator.geolocation) return;
    
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        StorageService.updateDeliveryLocation(currentDeliveryMan, { lat: latitude, lng: longitude });
      },
      (err) => console.error("Error tracking location:", err),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const updateStatus = (orderId: string, status: OrderStatus) => {
    StorageService.updateOrderStatus(orderId, status);
    if (status === OrderStatus.IN_TRANSIT) {
      navigator.geolocation.getCurrentPosition((pos) => {
        StorageService.updateDeliveryLocation(currentDeliveryMan, { 
          lat: pos.coords.latitude, 
          lng: pos.coords.longitude 
        });
      });
    }
    refresh();
  };

  const readyToPickUp = activeOrders.filter(o => o.status === OrderStatus.PREPARING || o.status === OrderStatus.PENDING);
  const inTransitOrders = activeOrders.filter(o => o.status === OrderStatus.IN_TRANSIT);

  const OrderCard = ({ order }: { order: Order }) => (
    <div key={order.id} className="bg-white rounded-[2rem] shadow-xl border border-stone-100 overflow-hidden hover:shadow-2xl transition-shadow duration-300">
      {order.paymentMethod === PaymentMethod.CASH_ON_DELIVERY && (
        <div className="bg-red-600 text-white px-8 py-2 text-center text-[10px] font-black uppercase tracking-widest">
          ⚠️ ¡Atención! Cobrar RD$ {order.total} al entregar
        </div>
      )}
      {order.paymentMethod === PaymentMethod.PREPAID && (
        <div className="bg-green-600 text-white px-8 py-2 text-center text-[10px] font-black uppercase tracking-widest">
          ✅ Pedido ya pagado
        </div>
      )}
      
      <div className="p-8 flex flex-col md:flex-row gap-8">
        <div className="flex-grow space-y-4">
          <div className="flex items-center space-x-3">
             <span className="bg-stone-100 px-3 py-1 rounded-full text-[10px] font-mono font-bold text-stone-400">ID: #{order.id.toUpperCase()}</span>
             <span className={`text-[10px] px-3 py-1 rounded-full font-black uppercase tracking-widest ${
              order.status === OrderStatus.IN_TRANSIT ? 'bg-orange-100 text-orange-800' : 'bg-blue-100 text-blue-800'
            }`}>
              {order.status === OrderStatus.IN_TRANSIT ? 'EN RUTA' : 'LISTO PARA RECOGER'}
            </span>
          </div>
          
          <div>
            <h3 className="text-2xl font-black text-stone-800">{order.customerName}</h3>
            <p className="text-stone-600 font-medium mt-1 text-lg leading-snug">
              {order.address}
            </p>
            {order.notes && (
              <p className="mt-2 text-xs bg-yellow-50 text-yellow-800 p-2 rounded-xl border border-yellow-100 italic">
                <span className="font-black not-italic uppercase tracking-tighter">Nota:</span> {order.notes}
              </p>
            )}
          </div>

          <div className="flex flex-wrap gap-4 pt-4">
            <div className="flex items-center bg-stone-50 px-4 py-2 rounded-xl text-sm font-bold text-stone-600">
               <i className="fa-solid fa-phone mr-3 text-orange-600"></i>
               {order.phone}
            </div>
            <div className="flex items-center bg-stone-50 px-4 py-2 rounded-xl text-sm font-bold text-stone-600">
               <i className="fa-solid fa-money-bill mr-3 text-green-600"></i>
               Total: RD$ {order.total}
            </div>
          </div>
        </div>

        <div className="flex flex-col justify-center space-y-4 min-w-[240px]">
          {order.status !== OrderStatus.IN_TRANSIT ? (
            <button 
              onClick={() => updateStatus(order.id, OrderStatus.IN_TRANSIT)}
              className="w-full bg-orange-600 text-white py-5 rounded-2xl font-black hover:bg-orange-700 transition shadow-xl flex items-center justify-center uppercase tracking-widest text-sm active:scale-95"
            >
              <i className="fa-solid fa-box-open mr-3"></i>
              Recoger Orden
            </button>
          ) : (
            <button 
              onClick={() => updateStatus(order.id, OrderStatus.DELIVERED)}
              className="w-full bg-green-600 text-white py-5 rounded-2xl font-black hover:bg-green-700 transition shadow-xl flex items-center justify-center uppercase tracking-widest text-sm active:scale-95"
            >
              <i className="fa-solid fa-circle-check mr-3"></i>
              Confirmar Entrega
            </button>
          )}
          
          <div className="grid grid-cols-2 gap-3">
            <a 
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(order.address)}`}
              target="_blank"
              rel="noreferrer"
              className="bg-stone-100 text-stone-600 py-3 rounded-xl font-bold hover:bg-stone-200 transition text-center flex items-center justify-center text-xs uppercase"
            >
               <i className="fa-solid fa-map-location-dot mr-2"></i>
               GPS
            </a>
            <a 
              href={`tel:${order.phone}`}
              className="bg-stone-100 text-stone-600 py-3 rounded-xl font-bold hover:bg-stone-200 transition text-center flex items-center justify-center text-xs uppercase"
            >
               <i className="fa-solid fa-phone mr-2"></i>
               Llamar
            </a>
          </div>
        </div>
      </div>
      
      {order.status === OrderStatus.IN_TRANSIT && (
        <div className="bg-orange-50 px-8 py-3 border-t border-orange-100 flex items-center justify-between">
          <span className="text-[10px] font-black text-orange-800 uppercase tracking-widest flex items-center">
            <i className="fa-solid fa-satellite-dish animate-pulse mr-2"></i>
            Transmisión de ubicación activa
          </span>
          <div className="flex space-x-1">
            <div className="w-1.5 h-1.5 rounded-full bg-orange-600 animate-bounce"></div>
            <div className="w-1.5 h-1.5 rounded-full bg-orange-600 animate-bounce delay-100"></div>
            <div className="w-1.5 h-1.5 rounded-full bg-orange-600 animate-bounce delay-200"></div>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-10 gap-4">
        <div>
          <h2 className="text-4xl font-black tracking-tight uppercase">Panel de Reparto</h2>
          <p className="text-stone-500 font-medium">Gestiona tu ruta y revisa tus entregas</p>
        </div>
        <div className="bg-white p-4 rounded-3xl shadow-sm border border-stone-100 flex items-center space-x-4">
          <div className="text-right">
            <p className="text-[10px] font-black uppercase text-orange-400 tracking-widest">En Línea</p>
            <p className="font-black text-stone-800 text-sm">Juan Repartidor</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-orange-100 flex items-center justify-center text-orange-600">
            <i className="fa-solid fa-motorcycle text-xl"></i>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex bg-stone-100 p-1.5 rounded-2xl mb-8 w-full md:w-fit">
        <button 
          onClick={() => setActiveTab('ACTIVE')}
          className={`flex-1 md:flex-none px-8 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'ACTIVE' ? 'bg-white text-orange-600 shadow-sm' : 'text-stone-400 hover:text-stone-600'}`}
        >
          Pendientes ({activeOrders.length})
        </button>
        <button 
          onClick={() => setActiveTab('HISTORY')}
          className={`flex-1 md:flex-none px-8 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'HISTORY' ? 'bg-white text-orange-600 shadow-sm' : 'text-stone-400 hover:text-stone-600'}`}
        >
          Completados ({completedOrders.length})
        </button>
      </div>

      {activeTab === 'ACTIVE' ? (
        <div className="space-y-12">
          {/* Section: In Transit */}
          {inTransitOrders.length > 0 && (
            <section className="space-y-6">
              <div className="flex items-center space-x-3">
                <div className="w-1.5 h-8 bg-orange-600 rounded-full"></div>
                <h3 className="text-xl font-black uppercase tracking-tighter text-stone-800">En Transcurso (En Ruta)</h3>
                <span className="bg-orange-100 text-orange-600 text-[10px] font-black px-2 py-1 rounded-lg">{inTransitOrders.length}</span>
              </div>
              <div className="space-y-6">
                {inTransitOrders.map(order => (
                  <OrderCard key={order.id} order={order} />
                ))}
              </div>
            </section>
          )}

          {/* Section: Ready to Pick Up */}
          <section className="space-y-6">
            <div className="flex items-center space-x-3">
              <div className="w-1.5 h-8 bg-blue-600 rounded-full"></div>
              <h3 className="text-xl font-black uppercase tracking-tighter text-stone-800">Listos para Recoger</h3>
              <span className="bg-blue-100 text-blue-600 text-[10px] font-black px-2 py-1 rounded-lg">{readyToPickUp.length}</span>
            </div>
            <div className="space-y-6">
              {readyToPickUp.length === 0 ? (
                <div className="bg-white rounded-[2.5rem] p-12 text-center border-2 border-dashed border-stone-200 shadow-sm">
                  <p className="text-stone-400 font-bold uppercase tracking-widest text-xs">Sin nuevas recolecciones</p>
                </div>
              ) : (
                readyToPickUp.map(order => (
                  <OrderCard key={order.id} order={order} />
                ))
              )}
            </div>
          </section>

          {activeOrders.length === 0 && (
            <div className="bg-white rounded-[2.5rem] p-20 text-center border-2 border-dashed border-stone-200 shadow-sm">
              <div className="w-20 h-20 bg-stone-50 rounded-full flex items-center justify-center mx-auto mb-6">
                <i className="fa-solid fa-mug-hot text-4xl text-stone-200"></i>
              </div>
              <p className="text-stone-400 font-bold uppercase tracking-widest text-sm">Sin tareas asignadas</p>
              <p className="text-stone-300 text-xs mt-2">Disfruta un cafecito mientras llega una orden.</p>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {completedOrders.length === 0 ? (
            <div className="bg-white rounded-3xl p-16 text-center border-2 border-dashed border-stone-200 shadow-sm">
              <div className="w-20 h-20 bg-stone-50 rounded-full flex items-center justify-center mx-auto mb-4">
                 <i className="fa-solid fa-clipboard-check text-3xl text-stone-200"></i>
              </div>
              <p className="text-stone-400 font-bold">Aún no has completado entregas hoy.</p>
            </div>
          ) : (
            completedOrders.map(order => (
              <div key={order.id} className="bg-white rounded-2xl p-6 shadow-sm border border-stone-100 flex flex-col md:flex-row md:items-center justify-between gap-4 group hover:border-green-100 transition-colors">
                <div className="flex items-start space-x-4">
                  <div className="w-12 h-12 rounded-xl bg-green-50 flex items-center justify-center text-green-600 shrink-0">
                    <i className="fa-solid fa-circle-check"></i>
                  </div>
                  <div>
                    <div className="flex items-center space-x-2 mb-1">
                      <span className="text-[10px] font-mono font-bold text-stone-400">#{order.id.toUpperCase()}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-black uppercase bg-green-100 text-green-700">
                        Entregado
                      </span>
                    </div>
                    <h4 className="font-bold text-stone-800 text-lg">{order.customerName}</h4>
                    <p className="text-xs text-stone-500 font-medium">{order.address}</p>
                    <p className="text-[10px] text-stone-400 mt-1">
                      {new Date(order.createdAt).toLocaleDateString()} • {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
                <div className="text-right flex flex-col items-end">
                  <p className="text-xl font-black text-green-600">RD$ {order.total}</p>
                  <p className={`text-[10px] font-black uppercase tracking-tighter ${order.paymentMethod === PaymentMethod.CASH_ON_DELIVERY ? 'text-red-500' : 'text-stone-400'}`}>
                    {order.paymentMethod === PaymentMethod.CASH_ON_DELIVERY ? 'Cobrado en Efectivo' : 'Pagado con tarjeta'}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default DeliveryView;
