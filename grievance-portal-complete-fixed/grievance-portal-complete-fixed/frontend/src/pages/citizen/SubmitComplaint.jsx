import { useState, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { useDropzone } from 'react-dropzone';
import toast from 'react-hot-toast';
import {
  MapPin, Upload, X, AlertCircle, CheckCircle, Navigation,
  FileImage, FileVideo, Eye, EyeOff, ChevronRight, Info, Clipboard
} from 'lucide-react';
import DashboardLayout from '../../components/DashboardLayout';
import api from '../../utils/api';
import { CATEGORIES, INDIAN_STATES } from '../../utils/constants';

const STEPS = ['Category', 'Description', 'Location', 'Attachments', 'Review', 'Success'];

const DISTRICTS_MAP = {
  'andhra pradesh': ['Guntur', 'Krishna', 'Visakhapatnam', 'East Godavari', 'West Godavari', 'Kurnool', 'Kadapa', 'Chittoor', 'Nellore'],
  telangana: ['Hyderabad', 'Warangal', 'Khammam', 'Karimnagar', 'Nizamabad', 'Rangareddy'],
  maharashtra: ['Mumbai', 'Pune', 'Nagpur', 'Nashik', 'Aurangabad', 'Thane'],
  karnataka: ['Bengaluru', 'Mysuru', 'Hubli', 'Mangaluru', 'Belagavi'],
};

export default function SubmitComplaint() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [files, setFiles] = useState([]);
  const [submittedComplaintId, setSubmittedComplaintId] = useState(null);
  const [submittedAuthorityType, setSubmittedAuthorityType] = useState(null);
  const [form, setForm] = useState({
    category: '',
    subcategory: '',
    description: '',
    isAnonymous: false,
    location: { address: '', state: '', district: '', pincode: '', lat: null, lng: null },
  });

  const set = (field, val) => setForm(f => ({ ...f, [field]: val }));
  const setLoc = (field, val) => setForm(f => ({ ...f, location: { ...f.location, [field]: val } }));

  const onDrop = useCallback((accepted) => {
    if (files.length + accepted.length > 5) { toast.error('Max 5 files allowed'); return; }
    const withPreview = accepted.map(f => Object.assign(f, { preview: URL.createObjectURL(f) }));
    setFiles(prev => [...prev, ...withPreview]);
  }, [files]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop, maxFiles: 5, maxSize: 50 * 1024 * 1024,
    accept: { 'image/*': [], 'video/*': [], 'application/pdf': [] }
  });

  const detectGPS = () => {
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        setForm(f => ({ ...f, location: { ...f.location, lat, lng, address: `${lat.toFixed(4)}, ${lng.toFixed(4)}` } }));
        setGpsLoading(false);
        toast.success('Location detected!');
      },
      () => { setGpsLoading(false); toast.error('Could not detect location. Please enter manually.'); }
    );
  };

  const canNext = () => {
    if (step === 0) return form.category && form.subcategory;
    if (step === 1) return form.description.length >= 20;
    if (step === 2) return form.location.address && form.location.state;
    return true;
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
        const formData = new FormData();
      formData.append('category', form.category);
      formData.append('subcategory', form.subcategory);
      formData.append('description', form.description);
      formData.append('isAnonymous', form.isAnonymous);
      formData.append('location', JSON.stringify(form.location));
      files.forEach(f => formData.append('attachments', f));

      const res = await api.post('/complaints', formData);
      const { complaintId, authorityType } = res.data.data;

      queryClient.invalidateQueries(['myComplaints']);
      setSubmittedComplaintId(complaintId);
      setSubmittedAuthorityType(authorityType);
      setStep(STEPS.length - 1); // Move to the last step (Success)
      toast.success(`Complaint ${complaintId} filed successfully!`, { duration: 5000 });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Submission failed. Try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const selectedCategory = CATEGORIES[form.category];
  const districts = DISTRICTS_MAP[form.location.state.toLowerCase()] || [];

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="page-header">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white font-display">File a Complaint</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Your complaint will be automatically routed to the appropriate authority.</p>
        </div>

        {/* Progress */}
        <div className="flex items-center gap-1 mb-8">
          {STEPS.map((s, i) => (
            <div key={s} className="flex items-center flex-1">
              <div className={`flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold flex-shrink-0 transition-all duration-300
                ${i < step ? 'bg-green-500 text-white' : i === step ? 'bg-brand-600 text-white ring-4 ring-brand-100 dark:ring-brand-950' : 'bg-slate-200 dark:bg-slate-700 text-slate-500'}`}>
                {i < step ? <CheckCircle size={14} /> : i + 1}
              </div>
              <div className={`text-xs ml-1.5 font-medium hidden sm:block ${i === step ? 'text-brand-600 dark:text-brand-400' : 'text-slate-400'}`}>{s}</div>
              {i < STEPS.length - 1 && (
                <div className={`flex-1 h-0.5 mx-2 rounded transition-all duration-300 ${i < step ? 'bg-green-400' : 'bg-slate-200 dark:bg-slate-700'}`} />
              )}
            </div>
          ))}
        </div>

        {/* Step Content */}
        <AnimatePresence mode="wait">
          <motion.div key={step} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}>

            {/* Step 0: Category */}
            {step === 0 && (
              <div className="space-y-4">
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">Select Category</h2>
                <div className="grid gap-3">
                  {Object.entries(CATEGORIES).map(([key, cat]) => (
                    <button key={key} onClick={() => { set('category', key); set('subcategory', ''); }}
                      className={`p-4 rounded-xl border-2 text-left transition-all duration-150 ${form.category === key
                        ? 'border-brand-500 bg-brand-50 dark:bg-brand-950/50'
                        : 'border-slate-200 dark:border-slate-700 hover:border-brand-300 dark:hover:border-brand-700 bg-white dark:bg-slate-800'}`}>
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{cat.icon}</span>
                        <div>
                          <div className="font-semibold text-slate-900 dark:text-white">{cat.label}</div>
                          <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                            {key === 'crime' && 'Routed to Police Station (PS)'}
                            {key === 'corruption' && 'Routed to Anti-Corruption Bureau (ACB)'}
                            {key === 'civic_issue' && 'Routed to Municipal Authority'}
                          </div>
                        </div>
                        {form.category === key && <CheckCircle size={18} className="ml-auto text-brand-500 flex-shrink-0" />}
                      </div>
                    </button>
                  ))}
                </div>

                {selectedCategory && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}>
                    <label className="label mt-4">Subcategory</label>
                    <div className="grid grid-cols-2 gap-2">
                      {selectedCategory.subcategories.map(sub => (
                        <button key={sub.value} onClick={() => set('subcategory', sub.value)}
                          className={`px-3 py-2.5 rounded-lg border text-sm text-left transition-all ${form.subcategory === sub.value
                            ? 'border-brand-500 bg-brand-50 dark:bg-brand-950/50 text-brand-700 dark:text-brand-400 font-medium'
                            : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-brand-300 dark:hover:border-brand-700 bg-white dark:bg-slate-800'}`}>
                          {sub.label}
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}

                {/* Anonymous toggle */}
                <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 mt-4">
                  <label className="relative inline-flex items-center cursor-pointer mt-0.5">
                    <input type="checkbox" checked={form.isAnonymous} onChange={e => set('isAnonymous', e.target.checked)} className="sr-only peer" />
                    <div className="w-10 h-5 bg-slate-200 peer-focus:ring-2 peer-focus:ring-brand-300 dark:peer-focus:ring-800 rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-5 peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-brand-600" />
                  </label>
                  <div>
                    <div className="font-medium text-slate-900 dark:text-white text-sm flex items-center gap-1.5">
                      {form.isAnonymous ? <EyeOff size={14} /> : <Eye size={14} />}
                      Submit Anonymously
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Your identity will be hidden. You won't receive status notifications.</div>
                    {form.isAnonymous && (
                      <div className="p-2 mt-2 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 flex gap-2 text-xs text-red-700 dark:text-red-400">
                        <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
                        Anonymous complaints will NOT appear on your dashboard.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Step 1: Description */}
            {step === 1 && (
              <div className="space-y-4">
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">Describe Your Complaint</h2>
                <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 flex gap-2 text-sm text-blue-700 dark:text-blue-400">
                  <Info size={16} className="flex-shrink-0 mt-0.5" />
                  Be specific. Include dates, names, locations, and any relevant details. Do NOT include your contact info in the description.
                </div>
                <div>
                  <label className="label">Detailed Description <span className="text-red-500">*</span></label>
                  <textarea rows={8} value={form.description} onChange={e => set('description', e.target.value)}
                    className="input resize-none" placeholder="Describe the incident in detail. What happened? When? Who was involved? What evidence do you have?" />
                  <div className={`text-right text-xs mt-1 ${form.description.length < 20 ? 'text-red-400' : 'text-slate-400'}`}>
                    {form.description.length}/5000 {form.description.length < 20 && '(min. 20 chars)'}
                  </div>
                </div>
              </div>
            )}

            {/* Step 2: Location */}
            {step === 2 && (
              <div className="space-y-4">
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">Location Details</h2>
                <div className="flex gap-2">
                  <button onClick={detectGPS} disabled={gpsLoading}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-brand-300 dark:border-brand-700 text-brand-700 dark:text-brand-400 text-sm font-medium hover:bg-brand-50 dark:hover:bg-brand-950 transition-colors">
                    <Navigation size={15} className={gpsLoading ? 'animate-spin' : ''} />
                    {gpsLoading ? 'Detecting...' : 'Auto-detect GPS'}
                  </button>
                  {form.location.lat && (
                    <span className="flex items-center gap-1.5 text-xs text-green-600 dark:text-green-400 font-medium">
                      <CheckCircle size={13} /> GPS coordinates captured
                    </span>
                  )}
                </div>

                <div>
                  <label className="label">Incident Address <span className="text-red-500">*</span></label>
                  <div className="relative">
                    <MapPin size={16} className="absolute left-3.5 top-3.5 text-slate-400" />
                    <textarea rows={2} value={form.location.address} onChange={e => setLoc('address', e.target.value)}
                      className="input pl-10 resize-none" placeholder="House/Plot No., Street, Area, Landmark" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">State <span className="text-red-500">*</span></label>
                    <select value={form.location.state} onChange={e => { setLoc('state', e.target.value); setLoc('district', ''); }}
                      className="input">
                      <option value="">Select State</option>
                      {INDIAN_STATES.map(s => <option key={s} value={s.toLowerCase()}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="label">District <span className="text-red-500">*</span></label>
                    <select value={form.location.district} onChange={e => setLoc('district', e.target.value)} className="input" disabled={!form.location.state}>
                      <option value="">Select District</option>
                      {districts.length > 0 ? districts.map(d => <option key={d} value={d.toLowerCase()}>{d}</option>) : <option value="other">Other</option>}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="label">Pincode</label>
                  <input type="text" maxLength={6} pattern="[0-9]{6}" value={form.location.pincode} onChange={e => setLoc('pincode', e.target.value)} className="input" placeholder="500001" />
                </div>
              </div>
            )}

            {/* Step 3: Attachments */}
            {step === 3 && (
              <div className="space-y-4">
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">Attach Evidence <span className="text-slate-400 font-normal text-base">(Optional)</span></h2>
                <div {...getRootProps()} className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-200
                  ${isDragActive ? 'border-brand-500 bg-brand-50 dark:bg-brand-950/30' : 'border-slate-300 dark:border-slate-600 hover:border-brand-400 dark:hover:border-brand-600 bg-slate-50 dark:bg-slate-800/50'}`}>
                  <input {...getInputProps()} />
                  <Upload size={28} className="mx-auto mb-3 text-slate-400" />
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{isDragActive ? 'Drop files here...' : 'Drag & drop files here, or click to select'}</p>
                  <p className="text-xs text-slate-400 mt-1.5">Images, Videos, PDFs • Max 5 files • 50MB each</p>
                </div>

                {files.length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {files.map((file, i) => (
                      <div key={i} className="relative group rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
                        {file.type.startsWith('image/') ? (
                          <img src={file.preview} alt="" className="w-full h-24 object-cover" />
                        ) : (
                          <div className="w-full h-24 flex flex-col items-center justify-center gap-1 bg-slate-100 dark:bg-slate-700">
                            {file.type.startsWith('video/') ? <FileVideo size={24} className="text-slate-400" /> : <FileImage size={24} className="text-slate-400" />}
                            <span className="text-xs text-slate-500 truncate px-2 w-full text-center">{file.name}</span>
                          </div>
                        )}
                        <button onClick={() => setFiles(f => f.filter((_, j) => j !== i))}
                          className="absolute top-1.5 right-1.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <X size={10} />
                        </button>
                        <div className="px-2 py-1.5 text-xs text-slate-500 dark:text-slate-400 truncate">{file.name}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Step 4: Review */}
            {step === 4 && (
              <div className="space-y-4">
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">Review & Submit</h2>
                <div className="card divide-y divide-slate-100 dark:divide-slate-700 overflow-hidden">
                  {[
                    { label: 'Category', value: `${selectedCategory?.icon} ${selectedCategory?.label}` },
                    { label: 'Subcategory', value: form.subcategory.replace(/_/g, ' ') },
                    { label: 'Description', value: form.description.substring(0, 200) + (form.description.length > 200 ? '...' : '') },
                    { label: 'Location', value: `${form.location.address}, ${form.location.district}, ${form.location.state}` },
                    { label: 'Attachments', value: `${files.length} file(s)` },
                    { label: 'Anonymous', value: form.isAnonymous ? '✅ Yes - Identity hidden' : '❌ No - Linked to account' },
                    { label: 'Authority', value: form.category === 'crime' ? '🚔 Police Station (PS)' : form.category === 'corruption' ? '⚖️ Anti-Corruption Bureau' : '🏛️ Municipal Authority' },
                  ].map(({ label, value }) => (
                    <div key={label} className="px-4 py-3 flex gap-4">
                      <span className="text-sm text-slate-500 dark:text-slate-400 w-28 flex-shrink-0">{label}</span>
                      <span className="text-sm text-slate-900 dark:text-white font-medium capitalize">{value}</span>
                    </div>
                  ))}
                </div>

                <div className="p-3 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 flex gap-2 text-sm text-green-700 dark:text-green-400">
                  <CheckCircle size={16} className="flex-shrink-0 mt-0.5" />
                  Your complaint will be automatically routed to the correct authority. You will receive a unique Complaint ID for tracking.
                </div>
                {form.isAnonymous && (
                  <div className="p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 flex gap-2 text-sm text-red-700 dark:text-red-400">
                    <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
                    You have chosen to submit anonymously. This complaint will NOT appear on your personal dashboard.
                  </div>
                )}
              </div>
            )}

            {/* Step 5: Success */}
            {step === STEPS.length - 1 && (
              <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.3 }}
                className="card p-8 text-center">
                <CheckCircle size={64} className="text-green-500 mx-auto mb-6" />
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-3">Complaint Filed Successfully!</h2>
                <p className="text-slate-600 dark:text-slate-300 mb-6">
                  Your complaint has been successfully submitted and routed to the appropriate authority.
                </p>
                
                {submittedComplaintId && (
                  <div className="bg-slate-100 dark:bg-slate-700 p-4 rounded-lg mb-6">
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-2">Your Complaint ID:</p>
                    <div className="flex items-center justify-center gap-3">
                      <span className="text-xl font-bold text-brand-600 dark:text-brand-400">{submittedComplaintId}</span>
                      <button onClick={() => { navigator.clipboard.writeText(submittedComplaintId); toast.success('Copied to clipboard!'); }}
                        className="btn-icon-sm text-slate-500 dark:text-slate-400 hover:text-brand-600 dark:hover:text-brand-400">
                        <Clipboard size={18} />
                      </button>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                      Please save this ID to track your complaint status.
                    </p>
                  </div>
                )}

                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <Link to="/dashboard" className="btn-primary">Go to Dashboard</Link>
                  <Link to={`/track?id=${submittedComplaintId}`} className="btn-outline">Track Complaint</Link>
                </div>
              </motion.div>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Navigation Buttons */}
        {step < STEPS.length - 1 && (
          <div className="flex justify-between mt-8">
            <button onClick={() => setStep(s => s - 1)} disabled={step === 0} className="btn-secondary">
              Previous
            </button>
            {step === STEPS.length - 2 ? (
              <button onClick={handleSubmit} disabled={submitting || !canNext()} className="btn-primary">
                {submitting ? 'Submitting...' : 'Confirm & Submit'}
              </button>
            ) : (
              <button onClick={() => setStep(s => s + 1)} disabled={!canNext()} className="btn-primary">
                Next <ChevronRight size={16} />
              </button>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}