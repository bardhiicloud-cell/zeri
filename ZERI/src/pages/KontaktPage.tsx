import React, { useState } from 'react';
import { 
  Phone, Mail, MapPin, Send, Clock, ShieldAlert, 
  CheckCircle2, AlertTriangle, Building, HelpCircle,
  MessageSquare, Sparkles
} from 'lucide-react';
import { KOSOVO_MUNICIPALITIES } from '../lib/constants';
import toast from 'react-hot-toast';

export default function KontaktPage() {
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    municipality: 'Prishtinë',
    department: 'Shërbimet Publike dhe Infrastruktura',
    subject: '',
    message: ''
  });
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [ticketId, setTicketId] = useState('');

  const departments = [
    'Shërbimet Publike dhe Infrastruktura',
    'Planifikimi Urban dhe Ndërtimi',
    'Kadastri dhe Gjeodezia',
    'Inspekcioni Komunal',
    'Financa dhe Tatimi në Pronë',
    'Shëndetësia dhe Mirëqenia Sociale',
    'Arsimi, Rinia dhe Sporti',
    'Zyra e Kryetarit të Komunës'
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.fullName.trim() || !formData.message.trim()) {
      toast.error('Ju lutemi plotësoni emrin dhe mesazhin tuaj.');
      return;
    }

    const generatedTicket = `ZQ-${Math.floor(100000 + Math.random() * 900000)}`;
    setTicketId(generatedTicket);
    setIsSubmitted(true);
    toast.success(`Kërkesa u regjistrua me sukses! Numri i tiketës: ${generatedTicket}`);
  };

  return (
    <div className="page-shell min-h-screen bg-(--color-page) dark:bg-(--color-brand-dark) text-slate-800 dark:text-slate-100 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header Hero */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 border border-slate-200/80 dark:border-white/10 shadow-xs relative overflow-hidden">
          <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
          
          <div className="relative z-10 max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 text-xs font-bold border border-blue-200/60 dark:border-blue-900 mb-3">
              <Phone className="w-3.5 h-3.5" />
              <span>Qendra e Komunikimit me Qytetarët</span>
            </div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-slate-900 dark:text-white tracking-tight">
              Kontakt & Ndihmë e Drejtpërdrejtë
            </h1>
            <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 mt-2">
              Jemi këtu për t'ju ndihmuar. Kontaktoni drejtpërdrejt administratën e komunës tuaj, 
              ekipin teknik të platformës "Zëri i Qytetarëve" ose linjat emergjente kombëtare.
            </p>
          </div>
        </div>

        {/* Emergency Quick Contacts Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <a
            href="tel:112"
            className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 p-4 rounded-2xl flex items-center gap-3.5 hover:bg-red-100 transition-all cursor-pointer"
          >
            <div className="w-10 h-10 rounded-xl bg-red-600 text-white flex items-center justify-center font-black text-base shrink-0 shadow-xs">
              112
            </div>
            <div>
              <div className="text-xs font-black text-red-900 dark:text-red-200">Emergjenca Qendrore</div>
              <div className="text-[10px] text-red-700/80 dark:text-red-300">24/7 Pa Pagesë</div>
            </div>
          </a>

          <a
            href="tel:192"
            className="bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 p-4 rounded-2xl flex items-center gap-3.5 hover:bg-blue-100 transition-all cursor-pointer"
          >
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-black text-base shrink-0 shadow-xs">
              192
            </div>
            <div>
              <div className="text-xs font-black text-blue-900 dark:text-blue-200">Policia e Kosovës</div>
              <div className="text-[10px] text-blue-700/80 dark:text-blue-300">Rend & Siguri</div>
            </div>
          </a>

          <a
            href="tel:193"
            className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 p-4 rounded-2xl flex items-center gap-3.5 hover:bg-amber-100 transition-all cursor-pointer"
          >
            <div className="w-10 h-10 rounded-xl bg-amber-600 text-white flex items-center justify-center font-black text-base shrink-0 shadow-xs">
              193
            </div>
            <div>
              <div className="text-xs font-black text-amber-900 dark:text-amber-200">Zjarrfikësit</div>
              <div className="text-[10px] text-amber-700/80 dark:text-amber-300">Shpëtim & Zjarre</div>
            </div>
          </a>

          <a
            href="tel:194"
            className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 p-4 rounded-2xl flex items-center gap-3.5 hover:bg-emerald-100 transition-all cursor-pointer"
          >
            <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-black text-base shrink-0 shadow-xs">
              194
            </div>
            <div>
              <div className="text-xs font-black text-emerald-900 dark:text-emerald-200">Ndihma e Shpejtë</div>
              <div className="text-[10px] text-emerald-700/80 dark:text-emerald-300">Emergjenca Mjekësore</div>
            </div>
          </a>
        </div>

        {/* Main Grid: Form + Info Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Left Column: Direct Interactive Inquiry Form (7 cols) */}
          <div className="lg:col-span-7 bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 border border-slate-200/80 dark:border-white/10 shadow-xs">
            <div className="flex items-center gap-2 mb-6">
              <MessageSquare className="w-5 h-5 text-blue-600" />
              <h2 className="text-lg font-black text-slate-900 dark:text-white">
                Dërgo Kërkesë apo Pyetje Administrative
              </h2>
            </div>

            {isSubmitted ? (
              <div className="text-center py-12 space-y-4">
                <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-950 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-black text-slate-900 dark:text-white">
                  Kërkesa Juaj u Dërgua me Sukses!
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-400 max-w-md mx-auto">
                  Numri i referencës suaj është <strong className="text-blue-600 font-mono text-base">{ticketId}</strong>. 
                  Zyrtari përgjegjës komunal do t'ju kontaktojë brenda 48 orëve të punës.
                </p>
                <button
                  onClick={() => {
                    setIsSubmitted(false);
                    setFormData({
                      fullName: '',
                      email: '',
                      phone: '',
                      municipality: 'Prishtinë',
                      department: 'Shërbimet Publike dhe Infrastruktura',
                      subject: '',
                      message: ''
                    });
                  }}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  Dërgo një Kërkesë Tjetër
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                      Emri dhe Mbiemri *
                    </label>
                    <input 
                      type="text" 
                      required
                      placeholder="p.sh. Agron Berisha"
                      value={formData.fullName}
                      onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                      Adresa e Emailit
                    </label>
                    <input 
                      type="email" 
                      placeholder="agron@shembull.com"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                      Numri i Telefonit
                    </label>
                    <input 
                      type="tel" 
                      placeholder="+383 44 123 456"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                      Komuna Përkatëse *
                    </label>
                    <select
                      value={formData.municipality}
                      onChange={(e) => setFormData({ ...formData, municipality: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {KOSOVO_MUNICIPALITIES.map(m => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    Drejtoria Komunale
                  </label>
                  <select
                    value={formData.department}
                    onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {departments.map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    Titulli / Subjekti i Kërkesës *
                  </label>
                  <input 
                    type="text" 
                    required
                    placeholder="Përmbledhje e shkurtër e kërkesës suaj"
                    value={formData.subject}
                    onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    Përshkrimi i Detajuar *
                  </label>
                  <textarea 
                    rows={4}
                    required
                    placeholder="Shkruani hollësisht kërkesën, pyetjen apo ankesën tuaj drejtuar komunës..."
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black flex items-center justify-center gap-2 transition-all shadow-xs cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Dërgo Kërkesën Zyrtarisht</span>
                </button>
              </form>
            )}
          </div>

          {/* Right Column: Contact Cards & Info (5 cols) */}
          <div className="lg:col-span-5 space-y-6">
            
            {/* Toll-Free Help Desk Card */}
            <div className="bg-gradient-to-br from-blue-900 to-slate-900 text-white p-6 rounded-3xl border border-blue-800/40 shadow-sm space-y-4">
              <div className="w-10 h-10 rounded-xl bg-blue-600/60 flex items-center justify-center">
                <Phone className="w-5 h-5 text-blue-200" />
              </div>
              <div>
                <h3 className="text-base font-black">Linja Qytetare pa Pagesë</h3>
                <p className="text-xs text-blue-200 mt-1">
                  Për çdo vështirësi në përdorimin e shërbimeve digjitale apo pyetje mbi procedurat komunale.
                </p>
              </div>
              <div className="bg-white/10 p-3.5 rounded-2xl border border-white/10">
                <div className="text-xl font-mono font-black tracking-wider text-amber-400">
                  0800 11 222
                </div>
                <div className="text-[11px] text-slate-300 mt-0.5">
                  E Hënë – E Premte: 08:00 – 16:00
                </div>
              </div>
            </div>

            {/* Official Headquarters */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200/80 dark:border-white/10 shadow-xs space-y-4">
              <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                <Building className="w-4 h-4 text-blue-600" />
                <span>Qendra Kombëtare e Koordinimit</span>
              </h3>

              <div className="space-y-3 text-xs text-slate-600 dark:text-slate-400">
                <div className="flex items-start gap-3">
                  <MapPin className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                  <span>Ndërtesa e Qeverisë "Rilindja", Sheshi Nëna Terezë, 10000 Prishtinë, Republika e Kosovës</span>
                </div>

                <div className="flex items-center gap-3">
                  <Mail className="w-4 h-4 text-slate-400 shrink-0" />
                  <span className="font-mono">kontakt@zeriqytetareve.rks-gov.net</span>
                </div>

                <div className="flex items-center gap-3">
                  <Clock className="w-4 h-4 text-slate-400 shrink-0" />
                  <span>Orari i punës me palë: 08:30 – 15:30</span>
                </div>
              </div>
            </div>

            {/* FAQ Box */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200/80 dark:border-white/10 shadow-xs space-y-3">
              <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-blue-600" />
                <span>Pyetje të Shpeshta (FAQ)</span>
              </h3>
              <div className="text-xs text-slate-600 dark:text-slate-400 space-y-2">
                <div>
                  <strong className="text-slate-800 dark:text-slate-200 block mb-0.5">Sa zgjat shqyrtimi i një kërkese?</strong>
                  <span>Kërkesat administrative shqyrtohen brenda 48 orëve të punës nga drejtoria përgjegjëse.</span>
                </div>
                <div className="pt-2 border-t border-slate-100 dark:border-white/5">
                  <strong className="text-slate-800 dark:text-slate-200 block mb-0.5">A mund të raportoj anonimisht?</strong>
                  <span>Po, në modulin "Raporto Problem" mund të zgjidhni opsionin e plotë të privatësisë.</span>
                </div>
              </div>
            </div>

          </div>

        </div>

      </div>
    </div>
  );
}
