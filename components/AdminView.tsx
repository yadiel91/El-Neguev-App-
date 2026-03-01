
import React, { useState, useEffect } from 'react';
import { StorageService } from '../services/storageService';
import { GeminiService } from '../services/geminiService';
import { Dish, Order, DeliveryPerson, OrderStatus, PaymentMethod } from '../types';

const AdminView: React.FC = () => {
  const [menu, setMenu] = useState<Dish[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [deliveryPeople, setDeliveryPeople] = useState<DeliveryPerson[]>([]);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiTheme, setAiTheme] = useState('Criollo Tradicional');
  const [printingOrder, setPrintingOrder] = useState<Order | null>(null);
  const [isAddingDish, setIsAddingDish] = useState(false);
  const [isManagingCategories, setIsManagingCategories] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newDish, setNewDish] = useState<Partial<Dish>>({
    name: '',
    description: '',
    price: 0,
    category: '',
    available: true
  });

  useEffect(() => {
    refreshData();
    const interval = setInterval(refreshData, 3000);
    return () => clearInterval(interval);
  }, []);

  const refreshData = () => {
    setMenu(StorageService.getMenu());
    const cats = StorageService.getCategories();
    setCategories(cats);
    const allOrders = StorageService.getOrders();
    setOrders(allOrders.sort((a, b) => b.createdAt - a.createdAt));
    setDeliveryPeople(StorageService.getDeliveryPeople());
    
    // Set default category for new dish if not set
    if (cats.length > 0 && !newDish.category) {
      setNewDish(prev => ({ ...prev, category: cats[0] }));
    }
  };

  const getCollectedCash = (deliveryId: string) => {
    return orders
      .filter(o => o.deliveryAssignedTo === deliveryId && o.status === OrderStatus.DELIVERED && o.paymentMethod === PaymentMethod.CASH_ON_DELIVERY)
      .reduce((sum, o) => sum + o.total, 0);
  };

  const handleAddCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategoryName.trim()) return;
    if (categories.includes(newCategoryName.trim())) {
      alert('Esta categoría ya existe.');
      return;
    }
    const updated = [...categories, newCategoryName.trim()];
    setCategories(updated);
    StorageService.saveCategories(updated);
    setNewCategoryName('');
  };

  const handleRemoveCategory = (cat: string) => {
    if (menu.some(item => item.category === cat)) {
      alert('No puedes eliminar una categoría que tiene platos asignados. Mueve o elimina los platos primero.');
      return;
    }
    if (confirm(`¿Seguro que deseas eliminar la categoría "${cat}"?`)) {
      const updated = categories.filter(c => c !== cat);
      setCategories(updated);
      StorageService.saveCategories(updated);
    }
  };

  const handleAddDish = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDish.name || !newDish.price) return;

    const dish: Dish = {
      id: `manual-${Date.now()}`,
      name: newDish.name!,
      description: newDish.description || '',
      price: Number(newDish.price),
      imageUrl: newDish.imageUrl || `https://picsum.photos/seed/${newDish.name}/800/600`,
      available: true,
      category: newDish.category || 'Platos'
    };

    const updatedMenu = [...menu, dish];
    setMenu(updatedMenu);
    StorageService.saveMenu(updatedMenu);
    setIsAddingDish(false);
    setNewDish({ name: '', description: '', price: 0, category: 'Platos', available: true });
  };

  const handleRemoveDish = (id: string) => {
    if (confirm('¿Seguro que deseas eliminar este plato del menú?')) {
      const updatedMenu = menu.filter(item => item.id !== id);
      setMenu(updatedMenu);
      StorageService.saveMenu(updatedMenu);
    }
  };

  const handleToggleAvailability = (id: string) => {
    const updatedMenu = menu.map(item => 
      item.id === id ? { ...item, available: !item.available } : item
    );
    setMenu(updatedMenu);
    StorageService.saveMenu(updatedMenu);
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

  const handleCancelOrder = (orderId: string) => {
    if (confirm("¿Seguro que deseas cancelar esta orden?")) {
      StorageService.cancelOrder(orderId);
      refreshData();
      alert("Orden cancelada con éxito.");
    }
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
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-bold">Gestión de Menú</h3>
            <div className="flex space-x-2">
              <button 
                onClick={() => setIsManagingCategories(true)}
                className="bg-stone-100 text-stone-600 px-3 py-1 rounded-lg text-xs font-bold hover:bg-stone-200 transition"
              >
                <i className="fa-solid fa-tags mr-1"></i> Categorías
              </button>
              <button 
                onClick={() => setIsAddingDish(true)}
                className="bg-orange-100 text-orange-600 px-3 py-1 rounded-lg text-xs font-bold hover:bg-orange-200 transition"
              >
                <i className="fa-solid fa-plus mr-1"></i> Plato
              </button>
            </div>
          </div>
          
          <div className="space-y-8">
            {categories.map(category => {
              const categoryItems = menu.filter(item => item.category === category);
              return (
                <div key={category} className="space-y-3">
                  <div className="flex items-center space-x-2 px-2">
                    <div className="h-4 w-1 bg-orange-500 rounded-full"></div>
                    <h4 className="text-sm font-black uppercase tracking-widest text-stone-400">{category}</h4>
                    <span className="text-[10px] bg-stone-100 text-stone-500 px-2 py-0.5 rounded-full font-bold">
                      {categoryItems.length}
                    </span>
                  </div>
                  
                  <div className="space-y-3">
                    {categoryItems.map(item => (
                      <div key={item.id} className="flex items-center space-x-3 p-3 bg-stone-50 rounded-2xl border border-stone-100">
                        <img src={item.imageUrl} className="w-12 h-12 rounded-lg object-cover" referrerPolicy="no-referrer" />
                        <div className="flex-grow">
                          <p className="font-bold text-sm leading-tight">{item.name}</p>
                          <p className="text-xs text-orange-600 font-bold">RD$ {item.price}</p>
                        </div>
                        <div className="flex flex-col space-y-1">
                          <button 
                            onClick={() => handleToggleAvailability(item.id)}
                            className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] ${item.available ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}
                            title={item.available ? 'Marcar como no disponible' : 'Marcar como disponible'}
                          >
                            <i className={`fa-solid ${item.available ? 'fa-check' : 'fa-xmark'}`}></i>
                          </button>
                          <button 
                            onClick={() => handleRemoveDish(item.id)}
                            className="w-6 h-6 rounded-full bg-stone-100 text-stone-400 flex items-center justify-center text-[10px] hover:bg-red-50 hover:text-red-500 transition"
                            title="Eliminar del menú"
                          >
                            <i className="fa-solid fa-trash"></i>
                          </button>
                        </div>
                      </div>
                    ))}
                    {categoryItems.length === 0 && (
                      <p className="text-center text-stone-300 text-[10px] italic py-2">Sin platos en esta categoría.</p>
                    )}
                  </div>
                </div>
              );
            })}
            
            {categories.length === 0 && (
              <div className="text-center py-10">
                <i className="fa-solid fa-tags text-stone-200 text-3xl mb-2"></i>
                <p className="text-stone-400 text-xs italic">No hay categorías configuradas.</p>
                <button 
                  onClick={() => setIsManagingCategories(true)}
                  className="mt-4 text-orange-600 text-xs font-bold hover:underline"
                >
                  Configurar Categorías
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal Gestionar Categorías */}
      {isManagingCategories && (
        <div className="fixed inset-0 bg-stone-900/50 backdrop-blur-sm flex items-center justify-center z-[110] p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-8 border border-stone-100">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold">Gestionar Categorías</h3>
              <button onClick={() => setIsManagingCategories(false)} className="text-stone-400 hover:text-stone-600">
                <i className="fa-solid fa-xmark text-xl"></i>
              </button>
            </div>
            
            <form onSubmit={handleAddCategory} className="flex space-x-2 mb-6">
              <input 
                type="text" 
                className="flex-grow px-4 py-2 rounded-xl border border-stone-200 outline-none focus:ring-2 focus:ring-orange-500 text-sm"
                placeholder="Nueva categoría..."
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
              />
              <button 
                type="submit"
                className="bg-orange-600 text-white px-4 py-2 rounded-xl font-bold hover:bg-orange-700 transition text-sm"
              >
                Añadir
              </button>
            </form>

            <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
              {categories.map(cat => (
                <div key={cat} className="flex justify-between items-center p-3 bg-stone-50 rounded-xl border border-stone-100">
                  <span className="text-sm font-bold text-stone-700">{cat}</span>
                  <button 
                    onClick={() => handleRemoveCategory(cat)}
                    className="text-stone-300 hover:text-red-500 transition"
                  >
                    <i className="fa-solid fa-trash-can text-sm"></i>
                  </button>
                </div>
              ))}
              {categories.length === 0 && (
                <p className="text-center text-stone-400 text-xs italic py-4">No hay categorías.</p>
              )}
            </div>
            
            <button 
              onClick={() => setIsManagingCategories(false)}
              className="w-full mt-8 bg-stone-100 text-stone-600 py-3 rounded-xl font-bold hover:bg-stone-200 transition"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}

      {/* Modal Agregar Plato */}
      {isAddingDish && (
        <div className="fixed inset-0 bg-stone-900/50 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-8 border border-stone-100">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold">Nuevo Plato</h3>
              <button onClick={() => setIsAddingDish(false)} className="text-stone-400 hover:text-stone-600">
                <i className="fa-solid fa-xmark text-xl"></i>
              </button>
            </div>
            <form onSubmit={handleAddDish} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-stone-400 uppercase mb-1">Nombre del Plato</label>
                <input 
                  required
                  type="text" 
                  className="w-full px-4 py-2 rounded-xl border border-stone-200 outline-none focus:ring-2 focus:ring-orange-500"
                  value={newDish.name}
                  onChange={(e) => setNewDish({...newDish, name: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-stone-400 uppercase mb-1">Descripción</label>
                <textarea 
                  className="w-full px-4 py-2 rounded-xl border border-stone-200 outline-none focus:ring-2 focus:ring-orange-500 h-20"
                  value={newDish.description}
                  onChange={(e) => setNewDish({...newDish, description: e.target.value})}
                ></textarea>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-stone-400 uppercase mb-1">Precio (RD$)</label>
                  <input 
                    required
                    type="number" 
                    className="w-full px-4 py-2 rounded-xl border border-stone-200 outline-none focus:ring-2 focus:ring-orange-500"
                    value={newDish.price || ''}
                    onChange={(e) => setNewDish({...newDish, price: Number(e.target.value)})}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-stone-400 uppercase mb-1">Categoría</label>
                  <select 
                    className="w-full px-4 py-2 rounded-xl border border-stone-200 outline-none focus:ring-2 focus:ring-orange-500"
                    value={newDish.category}
                    onChange={(e) => setNewDish({...newDish, category: e.target.value})}
                  >
                    {categories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-stone-400 uppercase mb-1">URL de Imagen (Opcional)</label>
                <input 
                  type="text" 
                  className="w-full px-4 py-2 rounded-xl border border-stone-200 outline-none focus:ring-2 focus:ring-orange-500"
                  placeholder="https://..."
                  value={newDish.imageUrl}
                  onChange={(e) => setNewDish({...newDish, imageUrl: e.target.value})}
                />
              </div>
              <button 
                type="submit"
                className="w-full bg-orange-600 text-white py-3 rounded-xl font-bold hover:bg-orange-700 transition mt-4"
              >
                Guardar Plato
              </button>
            </form>
          </div>
        </div>
      )}

      <section className="print:hidden lg:col-span-2 space-y-6">
        {/* Resumen de Efectivo por Repartidor */}
        <div className="bg-white rounded-3xl shadow-sm border border-stone-200 p-6">
          <h3 className="text-xl font-bold mb-6 flex items-center">
            <i className="fa-solid fa-money-bill-transfer text-green-600 mr-2"></i>
            Efectivo por Repartidor
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {deliveryPeople.map(person => (
              <div key={person.id} className="p-4 bg-stone-50 rounded-2xl border border-stone-100 flex items-center justify-between">
                <div>
                  <p className="font-black text-stone-800 uppercase tracking-tighter text-sm">{person.name}</p>
                  <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">ID: {person.id}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-black text-stone-400 uppercase tracking-widest mb-1">Por Entregar</p>
                  <p className="text-lg font-black text-green-600">RD$ {getCollectedCash(person.id)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

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
                        order.status === OrderStatus.CANCELLED ? 'bg-red-100 text-red-800' :
                        'bg-green-100 text-green-800'
                      }`}>
                        {order.status === OrderStatus.PENDING ? 'Pendiente' :
                         order.status === OrderStatus.PREPARING ? 'Preparando' :
                         order.status === OrderStatus.IN_TRANSIT ? 'En Ruta' :
                         order.status === OrderStatus.CANCELLED ? 'Cancelado' :
                         'Entregado'}
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
                        
                        {order.status !== OrderStatus.DELIVERED && order.status !== OrderStatus.CANCELLED && (
                          <div className="space-y-1">
                            <select 
                              className="w-full text-[10px] bg-white border border-stone-200 rounded-lg p-1.5 outline-none focus:ring-2 focus:ring-orange-500 font-bold"
                              onChange={(e) => {
                                if (e.target.value === "UNASSIGN") {
                                  StorageService.releaseOrder(order.id);
                                  refreshData();
                                  alert("Asignación eliminada. El pedido vuelve a estar pendiente.");
                                } else {
                                  handleAssign(order.id, e.target.value);
                                  alert("Pedido asignado correctamente.");
                                }
                              }}
                              value={order.deliveryAssignedTo || ""}
                            >
                              <option value="" disabled>Asignar...</option>
                              <option value="UNASSIGN" className="text-red-500">❌ Quitar Asignación</option>
                              {deliveryPeople.map(d => (
                                <option key={d.id} value={d.id}>{d.name}</option>
                              ))}
                            </select>
                            <button 
                              onClick={() => handleCancelOrder(order.id)}
                              className="w-full text-[10px] bg-red-50 text-red-600 py-1.5 rounded-lg font-bold hover:bg-red-100 transition flex items-center justify-center"
                            >
                              <i className="fa-solid fa-xmark mr-1"></i> Cancelar Orden
                            </button>
                          </div>
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
