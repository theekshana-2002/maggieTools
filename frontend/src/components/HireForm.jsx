import React, { useState, useEffect } from 'react';
import { vehicleAPI, clientAPI, employeeAPI, hireAPI } from '../services/api';
import { Plus, Trash2, Copy } from 'lucide-react';
import Autocomplete from './Autocomplete';
import '../styles/books.css';
import '../styles/forms.css';

const defaultJob = (prevJob = {}) => ({
  vehicle:         prevJob.vehicle || '',
  vehicleType:     prevJob.vehicleType || '',
  isExternal:      prevJob.isExternal || false,
  externalCost:    prevJob.externalCost || 0,
  driverName:      prevJob.driverName || '',
  helperName:      prevJob.helperName || '',
  address:         prevJob.address || '',
  city:            prevJob.city || '',
  startTime:       '',
  endTime:         '',
  restTime:        0,
  workingHours:    0,
  minimumHours:    prevJob.minimumHours || 0,
  oneHourFee:      prevJob.oneHourFee || 0,
  extraHours:      0,
  extraHourFee:    prevJob.extraHourFee || 0,
  transportFee:    0,
  dieselCost:      0,
  billAmount:      0,
  commission:      0,
  timeSheetNumber: '',
  billNumber:      '',
  totalAmount:     0,
  details:         '',
  status:          'Pending'
});

const HireForm = ({ onSubmit, onCancel, initialData }) => {
  const [vehicles, setVehicles]   = useState([]);
  const [clients, setClients]     = useState([]);
  const [employees, setEmployees] = useState([]);
  const [previousJobs, setPreviousJobs] = useState([]);

  // Common fields (just Date and Client now)
  const [commonData, setCommonData] = useState({
    date:            new Date().toISOString().split('T')[0],
    client:          '',
  });

  // Array of jobs
  const [jobs, setJobs] = useState([defaultJob()]);

  useEffect(() => {
    if (initialData) {
      setCommonData({
        date: initialData.date ? new Date(initialData.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
        client: initialData.client || '',
      });
      setJobs([{
        ...defaultJob(),
        ...initialData,
        address: initialData.address || '',
        city:    initialData.city    || initialData.location || '',
      }]);
    }
  }, [initialData]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [vehRes, cliRes, empRes, hireRes] = await Promise.all([
          vehicleAPI.get(), clientAPI.get(), employeeAPI.get(), hireAPI.get()
        ]);
        setVehicles(Array.isArray(vehRes.data) ? vehRes.data : []);
        setClients(Array.isArray(cliRes.data)  ? cliRes.data  : []);
        setEmployees(Array.isArray(empRes.data) ? empRes.data  : []);
        setPreviousJobs(Array.isArray(hireRes.data) ? hireRes.data : []);
      } catch (err) { console.error(err); }
    };
    fetchData();
  }, []);

  const handleCommonChange = (e) => {
    const { name, value } = e.target;
    setCommonData(prev => {
      const updated = { ...prev, [name]: value };

      if (name === 'client' && value && !initialData) {
        const lastJob = previousJobs
          .filter(j => j.client === value)
          .sort((a, b) => new Date(b.date) - new Date(a.date))[0];
        if (lastJob) {
          setJobs(currentJobs => currentJobs.map((job, idx) => {
            if (idx === 0 || !job.city) {
              return {
                ...job,
                address: lastJob.address || '',
                city: lastJob.city || '',
                minimumHours: lastJob.minimumHours || 0,
                oneHourFee: lastJob.oneHourFee || 0,
                extraHourFee: lastJob.extraHourFee || 0,
                vehicle: lastJob.vehicle || job.vehicle,
                driverName: lastJob.driverName || job.driverName,
              };
            }
            return job;
          }));
        }
      }
      return updated;
    });
  };

  const handleJobChange = (index, e) => {
    const { name, value } = e.target;
    setJobs(prev => {
      const updatedJobs = [...prev];
      const job = { ...updatedJobs[index], [name]: value };

      // Auto-fill Driver when vehicle changes
      if (name === 'vehicle' && value) {
         const fleetVeh = vehicles.find(v => v.number === value);
         if (fleetVeh) {
           job.vehicleType = fleetVeh.type || '';
           job.isExternal = false;
         } else {
           job.isExternal = true;
         }

         const lastJob = previousJobs
          .filter(j => j.vehicle === value)
          .sort((a, b) => new Date(b.date) - new Date(a.date))[0];
        if (lastJob) {
          job.driverName = lastJob.driverName || '';
          if (!fleetVeh) job.vehicleType = lastJob.vehicleType || '';
        }
      }

      if (name === 'isExternal') {
        job.isExternal = e.target.checked;
      }

      // Calculations
      if (['startTime', 'endTime', 'restTime'].includes(name)) {
        const start = name === 'startTime' ? value : job.startTime;
        const end   = name === 'endTime'   ? value : job.endTime;
        const rest  = parseFloat(name === 'restTime' ? value : job.restTime) || 0;
        if (start && end) {
          const [sh, sm] = start.split(':').map(Number);
          const [eh, em] = end.split(':').map(Number);
          let totalMins = (eh * 60 + em) - (sh * 60 + sm);
          if (totalMins < 0) totalMins += 1440; 
          totalMins -= rest;
          job.workingHours = Math.max(0, +(totalMins / 60).toFixed(2));
        }
      }

      if (['workingHours', 'minimumHours'].includes(name)) {
        const wh = parseFloat(name === 'workingHours' ? value : job.workingHours) || 0;
        const mh = parseFloat(name === 'minimumHours'  ? value : job.minimumHours) || 0;
        job.extraHours = Math.max(0, +(wh - mh).toFixed(2));
      }

      const mh  = parseFloat(job.minimumHours)  || 0;
      const ohf = parseFloat(job.oneHourFee)    || 0;
      const eh  = parseFloat(job.extraHours)    || 0;
      const ehf = parseFloat(job.extraHourFee)  || 0;
      const tf  = parseFloat(job.transportFee)  || 0;
      job.billAmount = +(mh * ohf + eh * ehf + tf).toFixed(2);

      const dc  = parseFloat(job.dieselCost)  || 0;
      const com = parseFloat(job.commission)  || 0;
      job.externalCost = parseFloat(job.externalCost) || 0;
      job.totalAmount = +(job.billAmount + dc - com).toFixed(2);

      updatedJobs[index] = job;
      return updatedJobs;
    });
  };

  const addJob = () => {
    const lastJob = jobs[jobs.length - 1];
    setJobs([...jobs, defaultJob(lastJob)]);
  };

  const removeJob = (index) => {
    if (jobs.length > 1) {
      setJobs(jobs.filter((_, i) => i !== index));
    }
  };
  const duplicateJob = (index) => {
    const newJob = { ...jobs[index] };
    setJobs([...jobs, newJob]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Auto-create new records if they don't exist
    try {
      // Check Client
      const existingClient = clients.find(c => c.name.toLowerCase() === commonData.client.toLowerCase());
      if (!existingClient && commonData.client.trim() !== '') {
        await clientAPI.create({ name: commonData.client, status: 'Active' });
      }

      // Process Jobs
      for (const job of jobs) {
        // Check Vehicle
        const existingVehicle = vehicles.find(v => v.number.toLowerCase() === job.vehicle.toLowerCase());
        if (!existingVehicle && job.vehicle.trim() !== '') {
          await vehicleAPI.create({ number: job.vehicle, status: 'Active' });
        }

        // Check Driver
        const existingDriver = employees.find(emp => emp.name.toLowerCase() === job.driverName.toLowerCase());
        if (!existingDriver && job.driverName.trim() !== '') {
          await employeeAPI.create({ name: job.driverName, role: 'Driver', status: 'Active' });
        }

        // Check Helper
        const existingHelper = employees.find(emp => emp.name.toLowerCase() === job.helperName.toLowerCase());
        if (!existingHelper && job.helperName.trim() !== '') {
          await employeeAPI.create({ name: job.helperName, role: 'Helper', status: 'Active' });
        }
      }
    } catch (err) {
      console.error('Error auto-creating records:', err);
      // We continue anyway, or we could show an error
    }

    const finalData = jobs.map(job => ({
      ...commonData,
      ...job
    }));
    
    if (initialData && initialData._id) {
      onSubmit(finalData[0]);
    } else {
      onSubmit(finalData);
    }
  };

  const driversList = employees.filter(emp => emp.role === 'Driver' && emp.status === 'Active');
  const helpersList = employees.filter(emp => emp.status === 'Active'); // Everyone can be a helper

  const totalBillAmount = jobs.reduce((sum, j) => sum + (parseFloat(j.totalAmount) || 0), 0);

  return (
    <form onSubmit={handleSubmit} className="hire-form">
      <div className="hire-form-scroll">
        
        {/* Common Section */}
        <div className="form-section common-fields" style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '20px', marginBottom: '24px' }}>
          <p className="form-section-title" style={{ color: '#1e293b', fontWeight: '700' }}>Batch Information</p>
          <div className="form-grid-2">
            <div className="form-group">
              <label>Booking Date *</label>
              <input type="date" name="date" value={commonData.date} onChange={handleCommonChange} required />
            </div>
            <div className="form-group">
              <label>Customer / Company *</label>
              <Autocomplete 
                name="client" 
                value={commonData.client} 
                onChange={handleCommonChange} 
                options={clients.map(c => c.name)}
                placeholder="Type or select client"
                required
              />
            </div>
          </div>
        </div>

        {/* Jobs Section */}
        <div className="jobs-container">
          {jobs.map((job, index) => (
            <div key={index} className="form-section job-entry" style={{ border: '1px solid #e2e8f0', padding: '16px', borderRadius: '12px', marginBottom: '16px', position: 'relative', background: '#fff', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px dashed #e2e8f0', paddingBottom: '10px' }}>
                <p className="form-section-title" style={{ margin: 0, fontSize: '0.9rem', color: '#64748b' }}>BOOKING ENTRY #{index + 1}</p>
                {!initialData && (
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button type="button" className="secondary-btn" onClick={() => duplicateJob(index)} title="Duplicate" style={{ padding: '6px 10px', height: '32px' }}>
                      <Copy size={14} /> <span style={{fontSize: '11px', fontWeight: '600'}}>Copy</span>
                    </button>
                    {jobs.length > 1 && (
                      <button type="button" className="delete-btn" onClick={() => removeJob(index)} title="Remove" style={{ padding: '6px 10px', height: '32px' }}>
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Vehicle & Personnel in each Job Entry */}
              <div className="form-grid">
                <div className="form-group" style={{ flex: '1.2' }}>
                  <label>Vehicle Number *</label>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <div style={{ flex: 1 }}>
                      <Autocomplete 
                        name="vehicle" 
                        value={job.vehicle} 
                        onChange={(e) => handleJobChange(index, e)} 
                        options={vehicles.map(v => v.number)}
                        placeholder="Vehicle No"
                        required
                      />
                    </div>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', whiteSpace: 'nowrap', cursor: 'pointer', marginBottom: 0, marginTop: '24px' }}>
                      <input 
                        type="checkbox" 
                        name="isExternal" 
                        checked={job.isExternal} 
                        onChange={(e) => handleJobChange(index, e)} 
                      />
                      External
                    </label>
                  </div>
                </div>

                <div className="form-group">
                  <label>Vehicle Category</label>
                  <select 
                    name="vehicleType" 
                    value={['Truck', 'Mini Truck', 'Van', 'Mini Van', 'Prime Mover', 'Crane', 'Tipper', 'Flatbed', 'Pickup', 'Bus', ''].includes(job.vehicleType) ? job.vehicleType : (job.vehicleType ? 'Other' : '')} 
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === 'Other') {
                        handleJobChange(index, { target: { name: 'vehicleType', value: '__OTHER__' } });
                      } else {
                        handleJobChange(index, { target: { name: 'vehicleType', value: val } });
                      }
                    }}
                  >
                    <option value="">Select Type</option>
                    <option value="Truck">Truck</option>
                    <option value="Mini Truck">Mini Truck</option>
                    <option value="Van">Van</option>
                    <option value="Mini Van">Mini Van</option>
                    <option value="Prime Mover">Prime Mover</option>
                    <option value="Crane">Crane</option>
                    <option value="Tipper">Tipper</option>
                    <option value="Flatbed">Flatbed</option>
                    <option value="Pickup">Pickup</option>
                    <option value="Bus">Bus</option>
                    <option value="Other">Other (Type below)</option>
                  </select>
                </div>

                {(job.vehicleType === '__OTHER__' || (job.vehicleType && !['Truck', 'Mini Truck', 'Van', 'Mini Van', 'Prime Mover', 'Crane', 'Tipper', 'Flatbed', 'Pickup', 'Bus', ''].includes(job.vehicleType))) && (
                  <div className="form-group">
                    <label>Specify Category</label>
                    <input 
                      type="text" 
                      name="vehicleType"
                      value={job.vehicleType === '__OTHER__' ? '' : job.vehicleType} 
                      onChange={(e) => handleJobChange(index, e)}
                      placeholder="e.g. Forklift"
                      required
                      autoFocus
                    />
                  </div>
                )}
              </div>

              <div className="form-grid" style={{ marginTop: '12px' }}>
                <div className="form-group">
                  <label>Driver</label>
                  <Autocomplete 
                    name="driverName" 
                    value={job.driverName} 
                    onChange={(e) => handleJobChange(index, e)} 
                    options={driversList.map(emp => emp.name)}
                    placeholder="Driver name"
                  />
                </div>
                <div className="form-group">
                  <label>Helper</label>
                  <Autocomplete 
                    name="helperName" 
                    value={job.helperName} 
                    onChange={(e) => handleJobChange(index, e)} 
                    options={helpersList.map(emp => emp.name)}
                    placeholder="Helper name"
                  />
                </div>
              </div>

              <div className="form-grid-2" style={{ marginTop: '12px' }}>
                <div className="form-group">
                  <label>Service Address</label>
                  <input type="text" name="address" value={job.address} onChange={(e) => handleJobChange(index, e)} placeholder="e.g. 123 Main St" />
                </div>
                <div className="form-group">
                  <label>City</label>
                  <input type="text" name="city" value={job.city} onChange={(e) => handleJobChange(index, e)} placeholder="e.g. Colombo" />
                </div>
              </div>

              <div className="form-grid-2" style={{ marginTop: '12px' }}>
                <div className="form-group">
                  <label>Bill Number</label>
                  <input type="text" name="billNumber" value={job.billNumber} onChange={(e) => handleJobChange(index, e)} placeholder="Auto-generated" />
                </div>
                <div className="form-group">
                  <label>Time Sheet No</label>
                  <input type="text" name="timeSheetNumber" value={job.timeSheetNumber} onChange={(e) => handleJobChange(index, e)} placeholder="e.g. TS-001" />
                </div>
              </div>

              <div className="form-grid" style={{ marginTop: '12px' }}>
                <div className="form-group">
                  <label>Start Time</label>
                  <input type="time" name="startTime" value={job.startTime} onChange={(e) => handleJobChange(index, e)} />
                </div>
                <div className="form-group">
                  <label>End Time</label>
                  <input type="time" name="endTime" value={job.endTime} onChange={(e) => handleJobChange(index, e)} />
                </div>
                <div className="form-group">
                  <label>Rest (min)</label>
                  <input type="number" name="restTime" value={job.restTime} onChange={(e) => handleJobChange(index, e)} min="0" />
                </div>
                <div className="form-group">
                  <label>Work Hours</label>
                  <input type="number" name="workingHours" value={job.workingHours} readOnly className="input-highlight-blue" />
                </div>
              </div>

              <div className="form-grid" style={{ marginTop: '12px' }}>
                <div className="form-group">
                  <label>Min Hours</label>
                  <input type="number" name="minimumHours" value={job.minimumHours} onChange={(e) => handleJobChange(index, e)} step="0.01" min="0" />
                </div>
                <div className="form-group">
                  <label>Rate / Hour</label>
                  <input type="number" name="oneHourFee" value={job.oneHourFee} onChange={(e) => handleJobChange(index, e)} min="0" />
                </div>
                <div className="form-group">
                  <label>Extra Hours</label>
                  <input type="number" name="extraHours" value={job.extraHours} readOnly className="input-highlight-gold" />
                </div>
                <div className="form-group">
                  <label>Extra Rate</label>
                  <input type="number" name="extraHourFee" value={job.extraHourFee} onChange={(e) => handleJobChange(index, e)} min="0" />
                </div>
              </div>

              <div className="form-grid" style={{ marginTop: '12px' }}>
                <div className="form-group">
                  <label>Fuel Cost</label>
                  <input type="number" name="dieselCost" value={job.dieselCost} onChange={(e) => handleJobChange(index, e)} min="0" />
                </div>
                <div className="form-group">
                  <label>Transport Fee</label>
                  <input type="number" name="transportFee" value={job.transportFee} onChange={(e) => handleJobChange(index, e)} min="0" />
                </div>
                <div className="form-group">
                  <label>Commission</label>
                  <input type="number" name="commission" value={job.commission} onChange={(e) => handleJobChange(index, e)} min="0" />
                </div>
                <div className="form-group">
                  <label>Status</label>
                  <select name="status" value={job.status} onChange={(e) => handleJobChange(index, e)}>
                    <option value="Pending">Pending</option>
                    <option value="Completed">Completed</option>
                    <option value="Paid">Paid</option>
                  </select>
                </div>
              </div>

              {job.isExternal && (
                <div className="form-group" style={{ marginTop: '12px', background: '#FFF7ED', padding: '10px', borderRadius: '8px', border: '1px solid #FFEDD5' }}>
                  <label style={{ color: '#9A3412', fontWeight: 'bold' }}>External Hire Cost (Expense Amount) *</label>
                  <input 
                    type="number" 
                    name="externalCost" 
                    value={job.externalCost === 0 ? '' : job.externalCost} 
                    onChange={(e) => handleJobChange(index, e)} 
                    placeholder="Amount paid to external owner"
                    style={{ borderColor: '#FDBA74' }}
                    required={job.isExternal}
                  />
                  <small style={{ color: '#C2410C' }}>This will be automatically added to Expenses.</small>
                </div>
              )}

              <div className="form-group" style={{ marginTop: '12px' }}>
                <label>Details / Remarks</label>
                <textarea name="details" value={job.details} onChange={(e) => handleJobChange(index, e)} rows="2" placeholder="Notes for this job..." />
              </div>
              
              <div style={{ marginTop: '12px', textAlign: 'right', fontWeight: '600', color: '#2563eb' }}>
                Subtotal: LKR {Number(job.totalAmount).toLocaleString()}
              </div>
            </div>
          ))}
        </div>

        {(!initialData || !initialData._id) && (
          <button type="button" className="add-btn-batch" onClick={addJob}>
            <Plus size={20} /> Add Another Booking Entry
          </button>
        )}

      </div>

      {/* Sticky Footer */}
      <div className="hire-form-footer">
        <div className="total-display">
          <span>{jobs.length} Entry(s) — NET TOTAL</span>
          <strong>LKR {totalBillAmount.toLocaleString()}</strong>
        </div>
        <div className="modal-actions">
          <button type="button" className="cancel-btn" onClick={onCancel}>Cancel</button>
          <button type="submit" className="submit-btn">{initialData && initialData._id ? 'Update Record' : 'Confirm & Save All'}</button>
        </div>
      </div>
    </form>
  );
};

export default HireForm;
