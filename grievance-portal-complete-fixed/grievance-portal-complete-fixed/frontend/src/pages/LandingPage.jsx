import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Shield, Search, FileText, Bell, ChevronRight, CheckCircle, Globe, Lock, Zap, Award, Phone, Mail } from 'lucide-react';
import Navbar from '../components/Navbar';
import { useTranslation } from '../utils/i18n';

const STATS = [
  { value: '2.4L+', label: 'Complaints Resolved', icon: CheckCircle },
  { value: '98%', label: 'Routing Accuracy', icon: Zap },
  { value: '36', label: 'States & UTs Covered', icon: Globe },
  { value: '72hr', label: 'Avg. Response Time', icon: Bell },
];

const STEPS = [
  { step: '01', title: 'Register & Login', desc: 'Create your account with basic details. Anonymous submission also available.', icon: '📝' },
  { step: '02', title: 'File Your Complaint', desc: 'Describe your grievance with location, category, and supporting evidence.', icon: '📤' },
  { step: '03', title: 'Auto-Routing', desc: 'Our smart engine routes your complaint to the correct authority instantly.', icon: '🔀' },
  { step: '04', title: 'Track & Resolve', desc: 'Get real-time updates as authorities take action on your complaint.', icon: '✅' },
];

const FEATURES = [
  { icon: Shield, title: 'Secure & Encrypted', desc: 'End-to-end encryption ensures your data stays private and protected.', color: 'text-blue-600' },
  { icon: Zap, title: 'Smart Routing', desc: 'AI-powered engine routes complaints to the right authority automatically.', color: 'text-amber-600' },
  { icon: Bell, title: 'Real-time Updates', desc: 'WebSocket-powered notifications keep you informed at every stage.', color: 'text-green-600' },
  { icon: Lock, title: 'Anonymous Option', desc: 'Submit complaints anonymously to protect your identity when needed.', color: 'text-purple-600' },
  { icon: Globe, title: 'Multi-language', desc: 'Available in English, Hindi, Telugu, Tamil, and 6 more regional languages.', color: 'text-red-600' },
  { icon: Award, title: 'Escalation System', desc: 'Unresolved complaints automatically escalate to higher authorities.', color: 'text-teal-600' },
];

const FadeIn = ({ children, delay = 0, className = '' }) => (
  <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay, duration: 0.5 }} className={className}>
    {children}
  </motion.div>
);

export default function LandingPage() {
  const [trackId, setTrackId] = useState('');
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950">
      <Navbar />

      {/* ===== HERO ===== */}
      <section className="relative overflow-hidden bg-gradient-to-br from-brand-900 via-brand-800 to-brand-700 text-white">
        {/* Background pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(255,255,255,0.3) 1px, transparent 0)', backgroundSize: '40px 40px' }} />
        </div>
        {/* Decorative circles */}
        <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-white/5 blur-3xl" />
        <div className="absolute -bottom-24 -left-24 w-96 h-96 rounded-full bg-brand-400/20 blur-3xl" />

        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 py-20 sm:py-28">
          <div className="max-w-3xl mx-auto text-center">
            {/* Badge */}
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 border border-white/20 text-sm font-medium mb-8 backdrop-blur-sm">
              <span className="flex h-2 w-2 rounded-full bg-green-400 animate-pulse" />
              {t('landing.hero.badge')}
            </motion.div>

            <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
              className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight mb-6 font-display">
              <span>{t('landing.hero.titleLine1')}</span>
              <br />
              <span className="text-brand-200">{t('landing.hero.titleLine2')}</span>
            </motion.h1>

            <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
              className="text-lg sm:text-xl text-brand-100 mb-10 max-w-2xl mx-auto leading-relaxed">
              {t('landing.hero.subtitle')}
            </motion.p>

            {/* Quick track input */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
              className="flex flex-col sm:flex-row items-center gap-3 max-w-xl mx-auto mb-10">
              <div className="relative flex-1 w-full">
                <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder={t('landing.hero.trackPlaceholder')}
                  value={trackId}
                  onChange={(e) => setTrackId(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/50 text-sm backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-white/40 focus:bg-white/15"
                />
              </div>
              <Link to={trackId ? `/track/${trackId}` : '/track'} className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-white text-brand-800 font-semibold text-sm hover:bg-brand-50 transition-colors whitespace-nowrap shadow-lg">
                <Search size={15} /> {t('landing.hero.trackButton')}
              </Link>
            </motion.div>

            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}
              className="flex flex-wrap justify-center gap-4">
              <Link to="/register" className="flex items-center gap-2 px-8 py-3.5 rounded-xl bg-saffron-500 hover:bg-saffron-600 text-white font-semibold shadow-lg hover:shadow-xl transition-all">
                {t('landing.hero.fileButton')} <ChevronRight size={16} />
              </Link>
              <Link to="/login" className="flex items-center gap-2 px-8 py-3.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/30 text-white font-semibold transition-all backdrop-blur-sm">
                {t('landing.hero.loginButton')}
              </Link>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ===== STATS ===== */}
      <section className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-8">
            {STATS.map((stat, i) => (
              <FadeIn key={stat.label} delay={i * 0.1} className="text-center">
                <div className="text-3xl font-bold text-brand-700 dark:text-brand-400 font-display mb-1">{stat.value}</div>
                <div className="text-sm text-slate-500 dark:text-slate-400">{stat.label}</div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ===== HOW IT WORKS ===== */}
      <section className="py-20 px-4 sm:px-6 bg-slate-50 dark:bg-slate-950">
        <div className="max-w-5xl mx-auto">
          <FadeIn className="text-center mb-14">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-brand-100 dark:bg-brand-950 text-brand-700 dark:text-brand-400 text-sm font-semibold mb-4">{t('landing.section.process')}</div>
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 dark:text-white font-display">{t('landing.section.howItWorks')}</h2>
            <p className="mt-3 text-slate-500 dark:text-slate-400 max-w-xl mx-auto">{t('landing.section.howItWorksDesc')}</p>
          </FadeIn>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {STEPS.map((step, i) => (
              <FadeIn key={step.step} delay={i * 0.1}>
                <div className="relative card p-6 h-full">
                  {i < STEPS.length - 1 && (
                    <div className="hidden lg:block absolute top-10 -right-3 w-6 h-0.5 bg-slate-200 dark:bg-slate-700 z-10" />
                  )}
                  <div className="text-3xl mb-4">{step.icon}</div>
                  <div className="text-xs font-bold text-brand-500 dark:text-brand-400 mb-2 font-mono">{step.step}</div>
                  <h3 className="font-bold text-slate-900 dark:text-white mb-2">{step.title}</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">{step.desc}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ===== ROUTING INFO ===== */}
      <section className="py-20 px-4 sm:px-6 bg-white dark:bg-slate-900">
        <div className="max-w-5xl mx-auto">
          <FadeIn className="text-center mb-14">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-saffron-400/10 text-saffron-600 text-sm font-semibold mb-4">Smart Routing Engine</div>
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 dark:text-white font-display">Complaints Reach the Right Authority</h2>
          </FadeIn>

          <div className="grid sm:grid-cols-3 gap-6">
            {[
              { icon: '🚔', type: 'Crime', auth: 'Police Station (PS)', desc: 'Theft, assault, cybercrime, domestic violence and all criminal matters.', color: 'border-red-200 dark:border-red-900/50', header: 'bg-red-50 dark:bg-red-900/20' },
              { icon: '⚖️', type: 'Corruption', auth: 'Anti-Corruption Bureau', desc: 'Bribery, embezzlement, government misconduct and public funds misuse.', color: 'border-purple-200 dark:border-purple-900/50', header: 'bg-purple-50 dark:bg-purple-900/20' },
              { icon: '🏛️', type: 'Civic Issues', auth: 'Municipal Authority', desc: 'Roads, water, sewage, electricity, garbage collection and public works.', color: 'border-teal-200 dark:border-teal-900/50', header: 'bg-teal-50 dark:bg-teal-900/20' },
            ].map((item, i) => (
              <FadeIn key={item.type} delay={i * 0.1}>
                <div className={`rounded-xl border-2 overflow-hidden ${item.color}`}>
                  <div className={`px-5 py-4 ${item.header}`}>
                    <div className="text-2xl mb-1">{item.icon}</div>
                    <div className="font-bold text-slate-900 dark:text-white">{item.type}</div>
                  </div>
                  <div className="px-5 py-4 bg-white dark:bg-slate-800">
                    <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">Routed to</div>
                    <div className="font-semibold text-slate-900 dark:text-white text-sm mb-2">{item.auth}</div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ===== FEATURES ===== */}
      <section className="py-20 px-4 sm:px-6 bg-slate-50 dark:bg-slate-950">
        <div className="max-w-5xl mx-auto">
          <FadeIn className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 dark:text-white font-display">Built for Transparency & Trust</h2>
          </FadeIn>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((f, i) => (
              <FadeIn key={f.title} delay={i * 0.07}>
                <div className="card p-5 h-full">
                  <f.icon size={24} className={`${f.color} mb-3`} />
                  <h3 className="font-bold text-slate-900 dark:text-white mb-1.5">{f.title}</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">{f.desc}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ===== CTA ===== */}
      <section className="py-20 px-4 sm:px-6 bg-gradient-gov text-white">
        <FadeIn className="max-w-2xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4 font-display">{t('landing.cta.title')}</h2>
          <p className="text-brand-100 mb-8">{t('landing.cta.subtitle')}</p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link to="/register" className="px-8 py-3.5 rounded-xl bg-white text-brand-800 font-semibold hover:bg-brand-50 transition-colors shadow-lg">
              {t('landing.cta.register')}
            </Link>
            <Link to="/track" className="px-8 py-3.5 rounded-xl bg-white/10 border border-white/30 text-white font-semibold hover:bg-white/20 transition-colors">
              {t('landing.cta.track')}
            </Link>
          </div>
        </FadeIn>
      </section>

      {/* ===== FOOTER ===== */}
      <footer className="bg-slate-900 dark:bg-slate-950 text-slate-400 py-10 px-4 sm:px-6 border-t border-slate-800">
        <div className="max-w-5xl mx-auto">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <div className="font-bold text-white font-display mb-1">Jan Shakti Grievance Portal</div>
              <div className="text-sm">© {new Date().getFullYear()} Government of India. All rights reserved.</div>
            </div>
            <div className="flex items-center gap-6 text-sm">
              <a href="tel:1800111000" className="flex items-center gap-1.5 hover:text-white transition-colors"><Phone size={14} /> 1800-111-000</a>
              <a href="mailto:help@grievanceportal.gov.in" className="flex items-center gap-1.5 hover:text-white transition-colors"><Mail size={14} /> Help Desk</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
