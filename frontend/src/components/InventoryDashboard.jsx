import React, { useState } from 'react';
import Tools from './Tools';
import Accessories from './Accessories';
import StockInventory from './StockInventory';
import { Package, Box, LayoutGrid } from 'lucide-react';
import '../styles/books.css'; // Uses existing styles or add new ones

const InventoryDashboard = () => {
  const [activeTab, setActiveTab] = useState('tools');

  return (
    <div className="inventory-dashboard page-enter">
      <div className="tab-switcher" style={{ marginBottom: '20px', display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '5px' }}>
        <button 
          className={`filter-pill ${activeTab === 'tools' ? 'active' : ''}`}
          onClick={() => setActiveTab('tools')}
        >
          <Package size={16} /> <span>Tool Inventory</span>
        </button>
        <button 
          className={`filter-pill ${activeTab === 'accessories' ? 'active' : ''}`}
          onClick={() => setActiveTab('accessories')}
        >
          <Box size={16} /> <span>Parts & Accessories</span>
        </button>
        <button 
          className={`filter-pill ${activeTab === 'stock' ? 'active' : ''}`}
          onClick={() => setActiveTab('stock')}
        >
          <LayoutGrid size={16} /> <span>Stock Overview</span>
        </button>
      </div>

      <div className="inventory-content">
        {activeTab === 'tools' && <Tools />}
        {activeTab === 'accessories' && <Accessories />}
        {activeTab === 'stock' && <StockInventory />}
      </div>
    </div>
  );
};

export default InventoryDashboard;
