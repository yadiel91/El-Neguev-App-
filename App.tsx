
import React, { useState } from 'react';
import { AppRole } from './types';
import Layout from './components/Layout';
import CustomerView from './components/CustomerView';
import AdminView from './components/AdminView';
import DeliveryView from './components/DeliveryView';

const App: React.FC = () => {
  const [role, setRole] = useState<AppRole>('CLIENT');

  const renderContent = () => {
    switch (role) {
      case 'ADMIN': return <AdminView />;
      case 'DELIVERY': return <DeliveryView />;
      case 'CLIENT': 
      default: return <CustomerView />;
    }
  };

  return (
    <Layout role={role} setRole={setRole}>
      {renderContent()}
    </Layout>
  );
};

export default App;
