import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { dt } from '@/src/lib/dt';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Plus, Camera, MapPin, Loader2, Send } from 'lucide-react';
import { useStore } from '../lib/store';
import { db, uploadFileToStorage } from '../lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
export function QuickReportModal({ isOpen, onClose }) {
    const currentUser = useStore(state => state.currentUser);
    const navigate = useNavigate();
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [category, setCategory] = useState('Infrastrukturë');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [imageFile, setImageFile] = useState(null);
    if (!isOpen)
        return null;
    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!currentUser) {
            alert("Ju lutem kyçuni për të raportuar.");
            return;
        }
        setIsSubmitting(true);
        try {
            let imageUrl = '';
            if (imageFile) {
                imageUrl = await uploadFileToStorage(imageFile, 'reports', { scope: 'quick' });
            }
            const docRef = await addDoc(collection(db, "reports"), {
                title,
                description,
                category,
                urgency: 'Mesatare',
                status: 'Approved',
                location: { lat: null, lng: null },
                locationName: '',
                authorId: currentUser.id,
                authorName: currentUser.name,
                upvotes: [],
                createdAt: serverTimestamp(),
                imageUrl: imageUrl || null
            });
            try {
                await addDoc(collection(db, "forumReels"), {
                    author: currentUser.name,
                    authorId: currentUser.id,
                    avatar: currentUser.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser.name)}&background=3b82f6&color=fff`,
                    description: `📍 [Raportim i Shpejtë] ${title}\n\n${description}`,
                    mediaUrl: imageUrl || 'https://images.unsplash.com/photo-1517048676732-d65bc937f952?auto=format&fit=crop&w=1200&q=80',
                    isPhoto: true,
                    likes: [],
                    comments: [],
                    shares: 0,
                    views: 1,
                    song: 'Raportim i Shpejtë Qytetar',
                    createdAt: serverTimestamp(),
                    sourceReportId: docRef.id
                });
            }
            catch (e) {
                console.error("Quick report auto reel error", e);
            }
            alert("Raportimi u dërgua me sukses!");
            onClose();
            // Reset form
            setTitle('');
            setDescription('');
            setImageFile(null);
            setCategory('Infrastrukturë');
            navigate('/');
        }
        catch (error) {
            console.error(error);
            alert("Pati një gabim gjatë dërgimit.");
        }
        finally {
            setIsSubmitting(false);
        }
    };
    return (_jsx(AnimatePresence, { children: _jsx(motion.div, { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 }, className: "fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm", onClick: onClose, children: _jsxs(motion.div, { initial: { opacity: 0, scale: 0.95, y: 20 }, animate: { opacity: 1, scale: 1, y: 0 }, exit: { opacity: 0, scale: 0.95, y: 20 }, onClick: e => e.stopPropagation(), className: "bg-white dark:bg-slate-900 rounded-[2rem] shadow-2xl w-full max-w-lg overflow-hidden flex flex-col", children: [_jsxs("div", { className: "flex items-center justify-between p-5 border-b border-slate-100 dark:border-white/5 bg-slate-50 dark:bg-slate-800/50", children: [_jsxs("h3", { className: "font-bold text-lg text-slate-900 dark:text-white flex items-center gap-2", children: [_jsx(Plus, { className: "w-5 h-5 text-blue-600" }), dt(`Raportim i Shpejtë`)] }), _jsx("button", { onClick: onClose, className: "p-2 text-slate-400 hover:text-slate-500 dark:text-slate-400 hover:bg-slate-200 rounded-xl transition-colors", children: _jsx(X, { className: "w-5 h-5" }) })] }), _jsxs("form", { onSubmit: handleSubmit, className: "p-6 overflow-y-auto max-h-[70vh]", children: [_jsxs("div", { className: "space-y-4", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1", children: dt(`Titulli`) }), _jsx("input", { type: "text", required: true, value: title, onChange: e => setTitle(e.target.value), className: "w-full bg-slate-50 dark:bg-slate-800 border border-slate-200/60 dark:border-white/10 focus:bg-white dark:bg-slate-900 focus:border-blue-500 rounded-xl px-4 py-2.5 outline-none transition-all", placeholder: dt(`Çfarë problemi keni hasur?`) })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1", children: dt(`Kategoria`) }), _jsxs("select", { value: category, onChange: e => setCategory(e.target.value), className: "w-full bg-slate-50 dark:bg-slate-800 border border-slate-200/60 dark:border-white/10 focus:bg-white dark:bg-slate-900 focus:border-blue-500 rounded-xl px-4 py-2.5 outline-none transition-all", children: [_jsx("option", { children: dt(`Infrastrukturë`) }), _jsx("option", { children: dt(`Mbeturina`) }), _jsx("option", { children: dt(`Trafik`) }), _jsx("option", { children: dt(`Mjedis`) }), _jsx("option", { children: dt(`Siguri`) }), _jsx("option", { children: dt(`Tjetër`) })] })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1", children: dt(`Përshkrimi`) }), _jsx("textarea", { required: true, value: description, onChange: e => setDescription(e.target.value), rows: 3, className: "w-full bg-slate-50 dark:bg-slate-800 border border-slate-200/60 dark:border-white/10 focus:bg-white dark:bg-slate-900 focus:border-blue-500 rounded-xl px-4 py-2.5 outline-none transition-all resize-none", placeholder: dt(`Jepni më shumë detaje...`) })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1", children: dt(`Foto (Opsionale)`) }), _jsx("div", { className: "flex items-center gap-4", children: _jsxs("label", { className: "flex items-center justify-center gap-2 w-full h-12 bg-blue-50 border border-blue-200 border-dashed rounded-xl cursor-pointer hover:bg-blue-100 transition-colors", children: [_jsx(Camera, { className: "w-5 h-5 text-blue-600" }), _jsx("span", { className: "text-sm font-semibold text-blue-700", children: imageFile ? imageFile.name : 'Ngarko Foto' }), _jsx("input", { type: "file", accept: "image/*", className: "hidden", onChange: e => setImageFile(e.target.files?.[0] || null) })] }) })] }), _jsxs("div", { className: "flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 p-3 rounded-xl", children: [_jsx(MapPin, { className: "w-4 h-4 shrink-0" }), _jsx("span", { children: dt(`Për të shtuar lokacionin e saktë në hartë dhe më shumë detaje, përdorni formën e plotë të raportimit.`) })] })] }), _jsxs("div", { className: "mt-6 pt-5 border-t border-slate-100 dark:border-white/5 flex items-center justify-end gap-3", children: [_jsx("button", { type: "button", onClick: () => { onClose(); navigate('/raporto'); }, className: "px-5 py-2.5 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:text-white hover:bg-slate-100 dark:hover:bg-slate-800/50 dark:bg-slate-800 font-bold rounded-xl transition-colors text-sm", children: dt(`Forma e plotë`) }), _jsxs("button", { type: "submit", disabled: isSubmitting || !title || !description, className: "flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-all shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none text-sm", children: [isSubmitting ? (_jsx(Loader2, { className: "w-4 h-4 animate-spin" })) : (_jsx(Send, { className: "w-4 h-4" })), dt(`Dërgo Raportin`)] })] })] })] }) }) }));
}
