import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Eye, EyeOff, Mail, Lock, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import useAuthStore from '../../store/authStore';
import Navbar from '../../components/Navbar';
import { useTranslation } from '../../utils/i18n';

export default function Login() {
  const [form, setForm] = useState({ email: '', password: '' });
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');
  const { login, isLoading } = useAuthStore();
  const { t } = useTranslation();
  const navigate = useNavigate();

  const REDIRECT_MAP = {
    citizen: '/dashboard',
    ps_officer: '/ps-dashboard',
    acb_officer: '/acb-dashboard',
    municipal_officer: '/municipal-dashboard',
    super_admin: '/admin',
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const { user } = await login(form.email, form.password);
      toast.success(`Welcome back, ${user.name.split(' ')[0]}!`);
      navigate(REDIRECT_MAP[user.role] || '/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed. Please try again.');
    }
  };

  const fillDemo = (email, pass) => {
    setForm({ email, password: pass });
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <Navbar />
      <div className="flex items-center justify-center min-h-[calc(100vh-66px)] px-4 py-12">
        <div className="w-full max-w-md">
          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} className="card p-8">
            {/* Header */}
            <div className="text-center mb-8">
              <div className="w-14 h-14 rounded-2xl bg-gradient-gov flex items-center justify-center mx-auto mb-4 shadow-gov">
                <span className="text-2xl font-bold text-white font-display">JS</span>
              </div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white font-display">{t('auth.login.title')}</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{t('auth.login.subtitle')}</p>
            </div>

            {/* Demo credentials */}
            <div className="mb-6 p-3 bg-brand-50 dark:bg-brand-950/50 rounded-lg border border-brand-100 dark:border-brand-900">
              <p className="text-xs font-semibold text-brand-700 dark:text-brand-400 mb-2">🧪 Demo Credentials</p>
              <div className="flex flex-wrap gap-2">
                {[
                  { label: 'Citizen', email: 'citizen@example.com', pass: 'Citizen@1234' },
                  { label: 'PS Officer', email: 'ps.guntur@ap.gov.in', pass: 'Authority@1234' },
                  { label: 'ACB', email: 'acb.guntur@ap.gov.in', pass: 'Authority@1234' },
                  { label: 'Admin', email: 'admin@grievanceportal.gov.in', pass: 'Admin@1234' },
                ].map((demo) => (
                  <button key={demo.label} onClick={() => fillDemo(demo.email, demo.pass)}
                    className="text-xs px-2.5 py-1 rounded-md bg-brand-100 dark:bg-brand-900/50 text-brand-700 dark:text-brand-400 hover:bg-brand-200 dark:hover:bg-brand-800 transition-colors">
                    {demo.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Error */}
            {error && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                className="flex items-center gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm mb-5">
                <AlertCircle size={16} className="flex-shrink-0" />
                {error}
              </motion.div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="label">{t('auth.login.email')}</label>
                <div className="relative">
                  <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="input pl-10" placeholder="you@example.com" />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="label mb-0">{t('auth.login.password')}</label>
                  <a href="#" className="text-xs text-brand-600 dark:text-brand-400 hover:underline">{t('auth.login.forgot')}</a>
                </div>
                <div className="relative">
                  <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input type={showPass ? 'text' : 'password'} required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })}
                    className="input pl-10 pr-10" placeholder="••••••••" />
                  <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                    {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <button type="submit" disabled={isLoading} className="btn-primary w-full py-3 mt-2">
                {isLoading ? (
                  <span className="flex items-center gap-2"><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Signing in...</span>
                ) : t('auth.login.submit')}
              </button>
            </form>

            <p className="text-center text-sm text-slate-500 dark:text-slate-400 mt-6">
              {t('auth.login.noAccount')}{' '}
              <Link to="/register" className="text-brand-600 dark:text-brand-400 font-medium hover:underline">{t('auth.login.createAccount')}</Link>
            </p>
          </motion.div>

          <p className="text-center text-xs text-slate-400 dark:text-slate-600 mt-4">
            Protected by end-to-end encryption • Government of India
          </p>
        </div>
      </div>
    </div>
  );
}
