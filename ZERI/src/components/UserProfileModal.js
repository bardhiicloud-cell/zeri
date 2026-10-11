import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { dt } from '@/src/lib/dt';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Camera, Save, User as UserIcon, Loader2 } from 'lucide-react';
import { useRef } from 'react';
import { updateDoc, doc } from 'firebase/firestore';
import { db, uploadFileToStorage } from '../lib/firebase';
import { useStore } from '../lib/store';
export function UserProfileModal({ isOpen, onClose }) {
    const currentUser = useStore(state => state.currentUser);
    const setCurrentUser = useStore(state => state.setCurrentUser);
    const addAuditLog = useStore(state => state.addAuditLog);
    const [name, setName] = useState(currentUser?.name || '');
    const [avatar, setPhotoUrl] = useState(currentUser?.avatar || '');
    const [isSaving, setIsSaving] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef(null);
    const handleFileChange = async (e) => {
        const file = e.target.files?.[0];
        if (!file)
            return;
        if (!file.type.startsWith('image/')) {
            alert('Ju lutem zgjidhni një fotografi.');
            return;
        }
        if (file.size > 5 * 1024 * 1024) {
            alert('Fotografia është shumë e madhe. Maksimumi është 5MB.');
            return;
        }
        setIsUploading(true);
        try {
            const url = await uploadFileToStorage(file, 'avatars');
            setPhotoUrl(url);
        }
        catch (err) {
            console.error("Gabim gjatë ngarkimit të fotografisë:", err);
            alert("Nuk arritëm të ngarkojmë fotografinë. Ju lutem provoni përsëri.");
        }
        finally {
            setIsUploading(false);
        }
    };
    if (!isOpen || !currentUser)
        return null;
    const handleSave = async () => {
        setIsSaving(true);
        try {
            const updates = { name, avatar };
            await updateDoc(doc(db, 'users', currentUser.id), updates);
            setCurrentUser({ ...currentUser, ...updates });
            addAuditLog('Përditësim Profili', 'success', `Përdoruesi ${currentUser.email} përditësoi profilin.`);
            onClose();
        }
        catch (e) {
            console.error(e);
            alert('Gabim gjatë ruajtjes së profilit.');
        }
        finally {
            setIsSaving(false);
        }
    };
    return (_jsx(AnimatePresence, { children: isOpen && (_jsx("div", { className: "fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 dark:bg-black/60 backdrop-blur-md", children: _jsxs(motion.div, { initial: { opacity: 0, scale: 0.95 }, animate: { opacity: 1, scale: 1 }, exit: { opacity: 0, scale: 0.95 }, className: "bg-white/90 dark:bg-slate-900/90 backdrop-blur-2xl rounded-[1.25rem] shadow-[0_8px_30px_rgb(0,0,0,0.12)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.4)] w-full max-w-md overflow-hidden border border-slate-200/60 dark:border-white/10", children: [_jsxs("div", { className: "flex items-center justify-between p-6 border-b border-slate-200/60 dark:border-white/10", children: [_jsx("h2", { className: "text-xl font-bold text-slate-900 dark:text-white", children: dt(`Profili Im`) }), _jsx("button", { onClick: onClose, className: "p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50 dark:bg-slate-800 rounded-full transition-colors", children: _jsx(X, { className: "w-5 h-5" }) })] }), _jsxs("div", { className: "p-6 space-y-6", children: [_jsxs("div", { className: "flex flex-col items-center", children: [_jsxs("div", { className: "relative", children: [avatar ? (_jsx("img", { src: avatar, alt: name, className: "w-24 h-24 rounded-full object-cover border-4 border-white shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)] dark:shadow-[0_4px_20px_-2px_rgba(0,0,0,0.3)]" })) : (_jsx("div", { className: "w-24 h-24 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center border-4 border-white shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)] dark:shadow-[0_4px_20px_-2px_rgba(0,0,0,0.3)] text-slate-400", children: _jsx(UserIcon, { className: "w-10 h-10" }) })), _jsx("input", { type: "file", accept: "image/*", className: "hidden", ref: fileInputRef, onChange: handleFileChange }), _jsx("button", { onClick: () => fileInputRef.current?.click(), disabled: isUploading, className: "absolute bottom-0 right-0 w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)] dark:shadow-[0_4px_20px_-2px_rgba(0,0,0,0.3)] hover:bg-blue-700 transition-colors disabled:opacity-70 disabled:cursor-not-allowed", children: isUploading ? _jsx(Loader2, { className: "w-4 h-4 animate-spin" }) : _jsx(Camera, { className: "w-4 h-4" }) })] }), _jsx("p", { className: "mt-3 text-sm text-slate-500 dark:text-slate-400 font-medium", children: currentUser.email }), _jsxs("div", { className: "mt-1 px-3 py-1 bg-emerald-50 text-emerald-600 font-bold text-xs rounded-full border border-emerald-200", children: [dt(`Roli:`), " ", currentUser.role] })] }), _jsx("div", { className: "space-y-4", children: _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1.5", children: dt(`Emri dhe Mbiemri`) }), _jsx("input", { type: "text", value: name, onChange: (e) => setName(e.target.value), className: "w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-white/10 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-[1rem] px-4 py-2.5 text-sm transition-all outline-none" })] }) })] }), _jsxs("div", { className: "p-6 border-t border-slate-200/60 dark:border-white/10 bg-slate-50 dark:bg-slate-800/50 flex justify-end gap-3", children: [_jsx("button", { onClick: onClose, className: "px-5 py-2.5 text-sm font-bold text-slate-500 dark:text-slate-400 hover:bg-slate-200 bg-slate-100 dark:bg-slate-800 rounded-[1rem] transition-colors", children: dt(`Anulo`) }), _jsxs("button", { onClick: handleSave, disabled: isSaving || !name.trim(), className: "flex items-center gap-2 px-6 py-2.5 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-[1rem] transition-colors disabled:opacity-50", children: [_jsx(Save, { className: "w-4 h-4" }), isSaving ? 'Duke ruajtur...' : 'Ruaj'] })] })] }) })) }));
}
