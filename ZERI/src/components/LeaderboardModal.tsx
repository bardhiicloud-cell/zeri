import { dt } from '@/src/lib/dt';
import { useState, useEffect } from 'react';
import { Award, Trophy, Medal, X } from 'lucide-react';
import { useStore } from '../lib/store';
import { AnimatePresence, motion } from 'framer-motion';
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useLanguage } from '../lib/LanguageContext';

interface LeaderboardUser {
  id: string;
  name: string;
  points: number;
}

interface LeaderboardModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function LeaderboardModal({ isOpen, onClose }: LeaderboardModalProps) {
  const [leaders, setLeaders] = useState<LeaderboardUser[]>([]);
  const [loading, setLoading] = useState(true);
  const currentUser = useStore(state => state.currentUser);
  const { t } = useLanguage();

  useEffect(() => {
    if (isOpen) {
      const fetchLeaders = async () => {
        try {
          const q = query(collection(db, "users"), orderBy("points", "desc"), limit(10));
          const snapshot = await getDocs(q);
          const topUsers = snapshot.docs.map(doc => ({
            id: doc.id,
            name: doc.data().name,
            points: doc.data().points || 0
          }));
          setLeaders(topUsers);
        } catch (error) {
          console.error("Gabim me liderët", error);
        } finally {
          setLoading(false);
        }
      };
      fetchLeaders();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div 
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 bg-slate-900/60 md:backdrop-blur-sm z-[10000] flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div 
          initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
          className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden relative"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="bg-gradient-to-br from-amber-500 to-orange-600 p-6 text-white text-center relative">
            <button onClick={onClose} className="absolute top-4 right-4 bg-white/20 p-1.5 rounded-full hover:bg-white/40 transition-colors">
              <X className="w-5 h-5" />
            </button>
            <Trophy className="w-12 h-12 mx-auto mb-3 text-amber-100" />
            <h2 className="text-2xl font-black title-serif tracking-wide">{dt(`Tabela e Liderëve`)}</h2>
            <p className="text-amber-100 text-sm font-medium mt-1">{dt(`Qytetarët më aktivë në platformë`)}</p>
          </div>
          
          <div className="p-4 max-h-[60vh] overflow-y-auto">
            {loading ? (
              <div className="py-10 text-center text-slate-400 font-medium">{dt(`Po ngarkohet...`)}</div>
            ) : (
              <div className="space-y-2">
                {leaders.map((user, index) => (
                  <div 
                    key={user.id} 
                    className={`flex items-center p-3 rounded-xl border ${user.id === currentUser?.id ? 'bg-amber-50 border-amber-200 shadow-sm dark:shadow-none' : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200/60 dark:border-white/10'}`}
                  >
                    <div className="w-8 flex justify-center shrink-0">
                      {index === 0 ? <Medal className="w-6 h-6 text-yellow-500" /> :
                       index === 1 ? <Medal className="w-6 h-6 text-slate-400" /> :
                       index === 2 ? <Medal className="w-6 h-6 text-amber-700" /> :
                       <span className="font-bold text-slate-400">#{index + 1}</span>}
                    </div>
                    <div className="ml-3 flex-1">
                      <p className="font-bold text-slate-900 dark:text-white text-sm">{user.name} {user.id === currentUser?.id && <span className="text-xs text-amber-600 ml-1 font-semibold">{dt(`(Ti)`)}</span>}</p>
                    </div>
                    <div className="shrink-0 flex items-center gap-1.5 bg-amber-100 text-amber-800 px-2.5 py-1 rounded-2xl font-bold text-xs border border-amber-200">
                      <Award className="w-3.5 h-3.5" />
                      {user.points}{dt(`pts`)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
