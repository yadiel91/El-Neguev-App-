
import React, { useState, useEffect } from 'react';
import { StorageService } from '../services/storageService';
import { GeminiService } from '../services/geminiService';
import { Dish, Order, DeliveryPerson, OrderStatus, PaymentMethod } from '../types';

const AdminView: React.FC = () => {
  const [menu, setMenu] = useState<Dish[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [deliveryPeople, setDeliveryPeople] = useState<DeliveryPerson[]>([]);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiTheme, setAiTheme] = useState('Criollo Tradicional');
  const [printingOrder, setPrintingOrder] = useState<Order | null>(null);

  useEffect(() => {
    refreshData();
    const interval = setInterval(refreshData, 10000);
    return () => clearInterval(interval);
  }, []);

  const refreshData = () => {
    setMenu(StorageService.getMenu());
    setOrders(StorageService.getOrders().sort((a, b) => b.createdAt - a.createdAt));
    setDeliveryPeople(StorageService.getDeliveryPeople());
  };

  const handleAiSuggest = async () => {
    setIsAiLoading(true);
    const suggestions = await GeminiService.suggestDailyMenu(aiTheme);
    if (suggestions) {
      const newMenu: Dish[] = suggestions.map((s: any, idx: number) => ({
        id: `ai-${Date.now()}-${idx}`,
        name: s.name,
        description: s.description,
        price: s.price,
        imageUrl: `https://picsum.photos/seed/${s.name}/800/600`,
        available: true,
        category: 'Platos' // Default to Platos for AI generation
      }));
      setMenu(newMenu);
      StorageService.saveMenu(newMenu);
      alert('¡Menú actualizado con sugerencias de IA!');
    }
    setIsAiLoading(false);
  };

  const handleAssign = (orderId: string, deliveryId: string) => {
    StorageService.assignDelivery(orderId, deliveryId);
    refreshData();
  };

  const handlePrint = (order: Order) => {
    setPrintingOrder(order);
    // Timeout to ensure state update renders before printing
    setTimeout(() => {
      window.print();
    }, 100);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* Printable Ticket (Hidden on screen) */}
      <div id="printable-ticket" className="hidden print:block font-mono text-sm p-4 w-full">
        {printingOrder && (
          <div className="max-w-[80mm] mx-auto text-black">
            <div className="text-center border-b-2 border-black pb-2 mb-4">
              <h1 className="text-xl font-bold uppercase">EL NEGUEV</h1>
              <p className="text-xs">Sabor Criollo Dominicano</p>
              <p className="text-[10px] mt-1">{new Date(printingOrder.createdAt).toLocaleString()}</p>
            </div>
            
            <div className="mb-4">
              <p className="font-bold border-b border-dashed border-black">ORDEN: #{printingOrder.id.toUpperCase()}</p>
              <p className="mt-2"><span className="font-bold">Cliente:</span> {printingOrder.customerName}</p>
              <p><span className="font-bold">Tel:</span> {printingOrder.phone}</p>
              <p className="break-words"><span className="font-bold">Dir:</span> {printingOrder.address}</p>
              {printingOrder.notes && (
                <p className="bg-stone-100 p-1 mt-1 border border-black italic"><span className="font-bold">Nota:</span> {printingOrder.notes}</p>
              )}
            </div>

            <div className="border-y border-black py-2 mb-4">
              <p className="font-bold mb-1">DETALLE:</p>
              {printingOrder.items.map((item, idx) => (
                <div key={idx} className="flex justify-between">
                  <span>{item.quantity}x {item.name}</span>
                  <span>RD$ {item.price * item.quantity}</span>
                </div>
              ))}
            </div>

            <div className="text-right font-bold text-lg">
              <p>TOTAL: RD$ {printingOrder.total}</p>
              <p className="text-xs uppercase font-normal">
                Pago: {printingOrder.paymentMethod === PaymentMethod.CASH_ON_DELIVERY ? 'EFECTIVO (COBRAR)' : 'PAGADO'}
              </p>
            </div>

            <div className="mt-8 text-center text-[10px] border-t border-black pt-2">
              <p>¡Gracias por preferir El Neguev!</p>
              <p>Buen Provecho</p>
            </div>
          </div>
        )}
      </div>

      {/* Admin Interface (Hidden on print) */}
      <div className="print:hidden lg:col-span-1 space-y-6">
        <div className="bg-white rounded-3xl shadow-sm border border-stone-200 p-6">
          <h3 className="text-xl font-bold mb-4 flex items-center">
            <i className="fa-solid fa-wand-magic-sparkles text-orange-500 mr-2"></i>
            Asistente de Menú IA
          </h3>
          <p className="text-stone-500 text-sm mb-4">Genera un menú del día creativo usando Inteligencia Artificial.</p>
          <div className="space-y-3">
            <input 
              type="text" 
              className="w-full px-4 py-2 rounded-xl border border-stone-200 outline-none focus:ring-2 focus:ring-orange-500" 
              placeholder="Ej: Mariscos, San Valentín..."
              value={aiTheme}
              onChange={(e) => setAiTheme(e.target.value)}
            />
            <button 
              onClick={handleAiSuggest}
              disabled={isAiLoading}
              className="w-full bg-orange-600 text-white py-3 rounded-xl font-bold hover:bg-orange-700 disabled:bg-orange-300 transition flex items-center justify-center"
            >
              {isAiLoading ? (
                <>
                  <i className="fa-solid fa-spinner animate-spin mr-2"></i>
                  Cocinando Ideas...
                </>
              ) : 'Generar Menú'}
            </button>
          </div>
        </div>

        <div className="bg-white rounded-3xl shadow-sm border border-stone-200 p-6">
          <h3 className="text-xl font-bold mb-4">Menú Actual</h3>
          <div className="space-y-4">
            {menu.map(item => (
              <div key={item.id} className="flex items-center space-x-3 p-3 bg-stone-50 rounded-2xl border border-stone-100">
                <img src={item.imageUrl} className="w-12 h-12 rounded-lg object-cover" />
                <div className="flex-grow">
                  <p className="font-bold text-sm leading-tight">{item.name}</p>
                  <p className="text-[10px] text-stone-400 uppercase font-black">{item.category}</p>
                  <p className="text-xs text-orange-600 font-bold">RD$ {item.price}</p>
                </div>
                <div className={`w-3 h-3 rounded-full ${item.available ? 'bg-green-500' : 'bg-red-500'}`}></div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <section className="print:hidden lg:col-span-2 space-y-6">
        <div className="bg-white rounded-3xl shadow-sm border border-stone-200 p-6 overflow-hidden">
          <h3 className="text-2xl font-bold mb-6 flex items-center justify-between">
            Gestión de Órdenes
            <span className="text-xs bg-stone-100 text-stone-500 px-3 py-1 rounded-full uppercase tracking-widest font-bold">
              Total: {orders.length}
            </span>
          </h3>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-stone-100 text-stone-400 text-xs uppercase font-bold">
                  <th className="pb-4 pr-4">Orden</th>
                  <th className="pb-4 pr-4">Cliente / Info</th>
                  <th className="pb-4 pr-4">Pago</th>
                  <th className="pb-4 pr-4">Total</th>
                  <th className="pb-4 pr-4">Estado</th>
                  <th className="pb-4">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-50">
                {orders.map(order => (
                  <tr key={order.id} className="hover:bg-stone-50/50 transition">
                    <td className="py-4 pr-4 align-top">
                      <p className="font-mono text-xs font-bold text-stone-400">#{order.id.toUpperCase()}</p>
                    </td>
                    <td className="py-4 pr-4 align-top">
                      <div className="flex items-center space-x-2">
                        <p className="font-bold text-sm">{order.customerName}</p>
                        <a 
                          href={`tel:${order.phone}`} 
                          className="w-8 h-8 rounded-full bg-green-50 text-green-600 flex items-center justify-center hover:bg-green-100 transition shadow-sm border border-green-200"
                          title="Llamar al cliente"
                        >
                          <i className="fa-solid fa-phone text-xs"></i>
                        </a>
                      </div>
                      <p className="text-xs text-stone-500 italic max-w-xs">{order.address}</p>
                      {order.notes && (
                        <p className="text-[10px] bg-yellow-50 text-yellow-800 p-1.5 rounded-lg mt-1 border border-yellow-100 line-clamp-2">
                          <span className="font-bold uppercase tracking-tighter">Nota:</span> {order.notes}
                        </p>
                      )}
                    </td>
                    <td className="py-4 pr-4 align-top">
                      <div className={`text-[10px] font-bold px-2 py-1 rounded-lg inline-block ${order.paymentMethod === PaymentMethod.CASH_ON_DELIVERY ? 'bg-stone-100 text-stone-600' : 'bg-green-100 text-green-700'}`}>
                        {order.paymentMethod === PaymentMethod.CASH_ON_DELIVERY ? 'Contra Entrega' : 'Anticipado'}
                      </div>
                    </td>
                    <td className="py-4 pr-4 align-top">
                      <p className="font-bold text-sm text-orange-600">RD$ {order.total}</p>
                    </td>
                    <td className="py-4 pr-4 align-top">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                        order.status === OrderStatus.PENDING ? 'bg-yellow-100 text-yellow-800' :
                        order.status === OrderStatus.PREPARING ? 'bg-blue-100 text-blue-800' :
                        order.status === OrderStatus.IN_TRANSIT ? 'bg-purple-100 text-purple-800' :
                        'bg-green-100 text-green-800'
                      }`}>
                        {order.status}
                      </span>
                    </td>
                    <td className="py-4 align-top">
                      <div className="flex flex-col space-y-2">
                        <button 
                          onClick={() => handlePrint(order)}
                          className="w-full text-[10px] bg-stone-100 text-stone-600 py-1.5 rounded-lg font-bold hover:bg-stone-200 transition flex items-center justify-center"
                        >
                          <i className="fa-solid fa-print mr-1"></i> Imprimir Ticket
                        </button>
                        
                        {order.status === OrderStatus.PENDING ? (
                          <select 
                            className="w-full text-[10px] bg-white border border-stone-200 rounded-lg p-1.5 outline-none focus:ring-2 focus:ring-orange-500 font-bold"
                            onChange={(e) => handleAssign(order.id, e.target.value)}
                            defaultValue=""
                          >
                            <option value="" disabled>Asignar...</option>
                            {deliveryPeople.map(d => (
                              <option key={d.id} value={d.id}>{d.name}</option>
                            ))}
                          </select>
                        ) : (
                          <p className="text-[10px] text-stone-400 italic text-center">
                            {deliveryPeople.find(d => d.id === order.deliveryAssignedTo)?.name || 'Asignado'}
                          </p>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {orders.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-stone-400 italic">
                      No hay órdenes pendientes hoy.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #printable-ticket, #printable-ticket * {
            visibility: visible;
          }
          #printable-ticket {
            position: absolute;
            left: 0;
            top: 0;
            display: block !important;
          }
        }
      `}</style>
    </div>
  );
};

export default AdminView;
