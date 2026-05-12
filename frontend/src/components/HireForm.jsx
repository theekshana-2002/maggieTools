import React, { useState, useEffect } from 'react';
import { toolAPI, clientAPI, employeeAPI, hireAPI } from '../services/api';
import { Plus, Trash2, Copy } from 'lucide-react';
import Autocomplete from './Autocomplete';
import '../styles/books.css';
import '../styles/forms.css';

const defaultJob = (prevJob = {}) => ({
  tool:            prevJob.tool || '',
  toolType:        prevJob.toolType || '',
  isExternal:      prevJob.isExternal || false,
  externalCost:    prevJob.externalCost || 0,
  staffName:       prevJob.staffName || '',
  address:         prevJob.address || '',
  city:            prevJob.city || '',
  startTime:       '',
  endTime:         '',
  restTime:        0,
  workingHours:    0,
  oneHourFee:      prevJob.oneHourFee || 0,
  extraHours:      0,
  extraHourFee:    prevJob.extraHourFee || 0,
  transportFee:    0,
  billAmount:      0,
  timeSheetNumber: '',
  billNumber:      '',
  totalAmount:     0,
  details:         '',
  status:          'Pending'
});

const HireForm = ({ onSubmit, onCancel, initialData }) => {
  const [tools, setTools]       = useState([]);
  const [clients, setClients]     = useState([]);
  const [employees, setEmployees] = useState([]);
  const [previousJobs, setPreviousJobs] = useState([]);

  // Common fields (Date and Client)
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
        tool:    initialData.tool || initialData.vehicle || '',
        address: initialData.address || '',
        city:    initialData.city    || initialData.location || '',
      }]);
    }
  }, [initialData]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [toolRes, cliRes, empRes, hireRes] = await Promise.all([
          toolAPI.get(), clientAPI.get(), employeeAPI.get(), hireAPI.get()
        ]);
        setTools(Array.isArray(toolRes.data) ? toolRes.data : []);
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
                tool: lastJob.tool || job.tool || lastJob.vehicle || '',
                staffName: lastJob.staffName || job.staffName || lastJob.driverName || '',
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

      if (name === 'tool' && value) {
         const fleetTool = tools.find(t => t.number === value);
         if (fleetTool) {
           job.toolType = fleetTool.category || '';
           job.isExternal = false;
         } else {
           job.isExternal = true;
         }

         const lastJob = previousJobs
          .filter(j => (j.tool === value || j.vehicle === value))
          .sort((a, b) => new Date(b.date) - new Date(a.date))[0];
        if (lastJob) {
          job.staffName = lastJob.staffName || lastJob.driverName || '';
          if (!fleetTool) job.toolType = lastJob.toolType || lastJob.vehicleType || '';
        }
      }

      if (name === 'isExternal') {
        job.isExternal = e.target.checked;
      }

      // Calculations
      if (['startTime', 'endTime', 'restTime'].includes(name)) {
        const start = name === 'startTime' ? value : job.startTime;
        const end   = name === 'endTime'   ? value : job.endTime;
        if (start && end) {
          const [sh, sm] = start.split(':').map(Number);
          const [eh, em] = end.split(':').map(Number);
          let totalMins = (eh * 60 + em) - (sh * 60 + sm);
          if (totalMins < 0) totalMins += 1440; 
          job.workingHours = Math.max(0, +(totalMins / 60).toFixed(2));
        }
      }

      const wh = parseFloat(name === 'workingHours' ? value : job.workingHours) || 0;
      job.extraHours = 0; // No extra hours if no min duration
      const ohf = parseFloat(job.oneHourFee)    || 0;
      const tf  = parseFloat(job.transportFee)  || 0;
      job.billAmount = +(wh * ohf + tf).toFixed(2);
      job.externalCost = parseFloat(job.externalCost) || 0;
      job.totalAmount = job.billAmount;

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
    
    try {
      const existingClient = clients.find(c => c.name.toLowerCase() === commonData.client.toLowerCase());
      if (!existingClient && commonData.client.trim() !== '') {
        await clientAPI.create({ name: commonData.client, status: 'Active' });
      }

      for (const job of jobs) {
        const existingTool = tools.find(t => t.number.toLowerCase() === job.tool.toLowerCase());
        if (!existingTool && job.tool.trim() !== '') {
          await toolAPI.create({ number: job.tool, status: 'Active' });
        }

        if (job.staffName && job.staffName.trim() !== '') {
           const existingStaff = employees.find(emp => emp.name.toLowerCase() === job.staffName.toLowerCase());
           if (!existingStaff) {
             await employeeAPI.create({ name: job.staffName, role: 'Staff', status: 'Active' });
           }
        }
      }
    } catch (err) {
      console.error('Error auto-creating records:', err);
    }

    const finalData = jobs.map(job => ({
      ...commonData,
      ...job,
      toolId: job.tool, 
      toolCategory: job.toolType,
      operatorName: job.staffName
    }));
    
    if (initialData && initialData._id) {
      onSubmit(finalData[0]);
    } else {
      onSubmit(finalData);
    }
  };

  const staffList = employees.filter(emp => emp.status === 'Active');

  const totalBillAmount = jobs.reduce((sum, j) => sum + (parseFloat(j.totalAmount) || 0), 0);

  return (
    <form onSubmit={handleSubmit} className="hire-form">
      <div className="hire-form-scroll">
        
        <div className="form-section common-fields" style={{ background: 'var(--bg-main)', border: '1px solid var(--border)', borderRadius: '12px', padding: '20px', marginBottom: '24px' }}>
          <p className="form-section-title" style={{ color: 'var(--text-main)', fontWeight: '700' }}>Rental Information</p>
          <div className="form-grid-2">
            <div className="form-group">
              <label>Rental Date *</label>
              <input type="date" name="date" value={commonData.date} onChange={handleCommonChange} required />
            </div>
            <div className="form-group">
              <label>Customer Name *</label>
              <Autocomplete 
                name="client" 
                value={commonData.client} 
                onChange={handleCommonChange} 
                options={clients.map(c => c.name)}
                placeholder="Type or select customer"
                required
              />
            </div>
          </div>
        </div>

        <div className="jobs-container">
          {jobs.map((job, index) => (
            <div key={index} className="form-section job-entry" style={{ border: '1px solid var(--border)', padding: '16px', borderRadius: '12px', marginBottom: '16px', position: 'relative', background: 'var(--bg-side)', boxShadow: 'var(--shadow-sm)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px dashed var(--border)', paddingBottom: '10px' }}>
                <p className="form-section-title" style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-muted)' }}>RENTAL ITEM #{index + 1}</p>
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

              <div className="form-grid">
                <div className="form-group" style={{ flex: '1.2' }}>
                  <label>Tool ID / Serial *</label>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <div style={{ flex: 1 }}>
                      <Autocomplete 
                        name="tool" 
                        value={job.tool} 
                        onChange={(e) => handleJobChange(index, e)} 
                        options={tools.map(t => t.number)}
                        placeholder="Tool ID"
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
                      Sub-rented
                    </label>
                  </div>
                </div>

                <div className="form-group">
                  <label>Tool Category</label>
                  <select 
                    name="toolType" 
                    value={['Power Tools', 'Hand Tools', 'Heavy Machinery', 'Electrical Appliances', 'Gardening', 'Construction', ''].includes(job.toolType) ? job.toolType : (job.toolType ? 'Other' : '')} 
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === 'Other') {
                        handleJobChange(index, { target: { name: 'toolType', value: '__OTHER__' } });
                      } else {
                        handleJobChange(index, { target: { name: 'toolType', value: val } });
                      }
                    }}
                  >
                    <option value="">Select Category</option>
                    <option value="Power Tools">Power Tools</option>
                    <option value="Hand Tools">Hand Tools</option>
                    <option value="Heavy Machinery">Heavy Machinery</option>
                    <option value="Electrical Appliances">Electrical Appliances</option>
                    <option value="Gardening">Gardening</option>
                    <option value="Construction">Construction</option>
                    <option value="Other">Other (Type below)</option>
                  </select>
                </div>

                {(job.toolType === '__OTHER__' || (job.toolType && !['Power Tools', 'Hand Tools', 'Heavy Machinery', 'Electrical Appliances', 'Gardening', 'Construction', ''].includes(job.toolType))) && (
                  <div className="form-group">
                    <label>Specify Category</label>
                    <input 
                      type="text" 
                      name="toolType"
                      value={job.toolType === '__OTHER__' ? '' : job.toolType} 
                      onChange={(e) => handleJobChange(index, e)}
                      placeholder="e.g. Electric Grill"
                      required
                      autoFocus
                    />
                  </div>
                )}
              </div>

              <div className="form-grid" style={{ marginTop: '12px' }}>
                <div className="form-group">
                  <label>Assigned Staff</label>
                  <Autocomplete 
                    name="staffName" 
                    value={job.staffName} 
                    onChange={(e) => handleJobChange(index, e)} 
                    options={staffList.map(emp => emp.name)}
                    placeholder="Staff name"
                  />
                </div>
              </div>

              <div className="form-grid-2" style={{ marginTop: '12px' }}>
                <div className="form-group">
                  <label>Delivery / Service Address</label>
                  <input type="text" name="address" value={job.address} onChange={(e) => handleJobChange(index, e)} placeholder="Address" />
                </div>
                <div className="form-group">
                  <label>City</label>
                  <input type="text" name="city" value={job.city} onChange={(e) => handleJobChange(index, e)} placeholder="City" />
                </div>
              </div>

              <div className="form-grid-2" style={{ marginTop: '12px' }}>
                <div className="form-group">
                  <label>Bill Number</label>
                  <input type="text" name="billNumber" value={job.billNumber} onChange={(e) => handleJobChange(index, e)} placeholder="Optional" />
                </div>
                <div className="form-group">
                  <label>Reference No</label>
                  <input type="text" name="timeSheetNumber" value={job.timeSheetNumber} onChange={(e) => handleJobChange(index, e)} placeholder="Optional" />
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
                  <label>Duration (Hrs)</label>
                  <input type="number" name="workingHours" value={job.workingHours} readOnly className="input-highlight-blue" />
                </div>
              </div>

              <div className="form-grid" style={{ marginTop: '12px' }}>
                <div className="form-group">
                  <label>Rate / Hour</label>
                  <input type="number" name="oneHourFee" value={job.oneHourFee} onChange={(e) => handleJobChange(index, e)} min="0" />
                </div>
              </div>

              <div className="form-grid" style={{ marginTop: '12px' }}>
                <div className="form-group">
                  <label>Transport Fee</label>
                  <input type="number" name="transportFee" value={job.transportFee} onChange={(e) => handleJobChange(index, e)} min="0" />
                </div>
                <div className="form-group">
                  <label>Status</label>
                  <select name="status" value={job.status} onChange={(e) => handleJobChange(index, e)}>
                    <option value="Pending">Pending</option>
                    <option value="Completed">Completed</option>
                    <option value="Returned">Returned</option>
                    <option value="Paid">Paid</option>
                  </select>
                </div>
              </div>

              {job.isExternal && (
                <div className="form-group" style={{ marginTop: '12px', background: 'var(--warning-soft)', padding: '10px', borderRadius: '8px', border: '1px solid var(--warning-soft)' }}>
                  <label style={{ color: 'var(--warning)', fontWeight: 'bold' }}>Sub-rent Cost (Expense) *</label>
                  <input 
                    type="number" 
                    name="externalCost" 
                    value={job.externalCost === 0 ? '' : job.externalCost} 
                    onChange={(e) => handleJobChange(index, e)} 
                    placeholder="Amount paid to owner"
                    style={{ borderColor: 'var(--warning)' }}
                    required={job.isExternal}
                  />
                  <small style={{ color: 'var(--warning)' }}>This will be recorded as an expense.</small>
                </div>
              )}

              <div className="form-group" style={{ marginTop: '12px' }}>
                <label>Details / Remarks</label>
                <textarea name="details" value={job.details} onChange={(e) => handleJobChange(index, e)} rows="2" placeholder="Notes for this rental..." />
              </div>
              
              <div style={{ marginTop: '12px', textAlign: 'right', fontWeight: '600', color: 'var(--accent)' }}>
                Subtotal: LKR {Number(job.totalAmount).toLocaleString()}
              </div>
            </div>
          ))}
        </div>

        {(!initialData || !initialData._id) && (
          <button type="button" className="add-btn-batch" onClick={addJob}>
            <Plus size={20} /> Add Another Tool to Batch
          </button>
        )}

      </div>

      <div className="hire-form-footer">
        <div className="total-display">
          <span>{jobs.length} Item(s) — NET TOTAL</span>
          <strong>LKR {totalBillAmount.toLocaleString()}</strong>
        </div>
        <div className="modal-actions">
          <button type="button" className="cancel-btn" onClick={onCancel}>Cancel</button>
          <button type="submit" className="submit-btn">{initialData && initialData._id ? 'Update Rental' : 'Confirm & Save Rental'}</button>
        </div>
      </div>
    </form>
  );
};

export default HireForm;
