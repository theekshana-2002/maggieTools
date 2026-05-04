import React from 'react';
import './VehicleFilter.css';

const VehicleFilter = ({ vehicles, selectedVehicle, onSelect }) => {
  return (
    <div className="vehicle-filter-container">
      <div className="filter-scroll">
        <button 
          className={`filter-pill ${!selectedVehicle ? 'active' : ''}`}
          onClick={() => onSelect(null)}
        >
          All Vehicles
        </button>
        {vehicles.map((v, i) => (
          <button 
            key={v._id || i}
            className={`filter-pill ${selectedVehicle === v.number ? 'active' : ''}`}
            onClick={() => onSelect(v.number)}
          >
            {v.number}
          </button>
        ))}
      </div>
    </div>
  );
};

export default VehicleFilter;
