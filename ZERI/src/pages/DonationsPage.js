import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Button } from '../components/ui/Button';
import { dt } from '@/src/lib/dt';
import { useState } from 'react';
import { useStore } from '../lib/store';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart, Globe, X, PlusCircle, Home, Utensils, Shirt, Grid, ChevronLeft, ChevronRight } from 'lucide-react';
import { handleFirebaseError } from '../lib/errorHandler';
import AdBanner from '../components/AdBanner';
export default function DonationsPage() {
    const donationCauses = useStore(state => state.donationCauses).filter(c => c.status === 'approved');
    const donationUrls = useStore(state => state.donationUrls);
    const addDonationCause = useStore(state => state.addDonationCause);
    const [selectedCause, setSelectedCause] = useState(null);
    const [activeCategory, setActiveCategory] = useState('all');
    const [isApplying, setIsApplying] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const ITEMS_PER_PAGE = 6;
    const [newApplication, setNewApplication] = useState({
        title: '',
        description: '',
        category: 'shtepi',
        mediaType: 'image',
        mediaUrl: '',
        donationUrl: ''
    });
    const categories = [
        { id: 'all', label: 'Të Gjitha', icon: Grid },
        { id: 'shtepi', label: 'Shtëpi', icon: Home },
        { id: 'ushqim', label: 'Ushqim', icon: Utensils },
        { id: 'veshmbathje', label: 'Veshmbathje', icon: Shirt },
        { id: 'tjera', label: 'Të Tjera', icon: Heart }
    ];
    const handleCategoryChange = (catId) => {
        setActiveCategory(catId);
        setCurrentPage(1);
    };
    const filteredCauses = activeCategory === 'all'
        ? donationCauses
        : donationCauses.filter(c => c.category === activeCategory);
    const totalPages = Math.ceil(filteredCauses.length / ITEMS_PER_PAGE);
    const activePage = currentPage > totalPages ? Math.max(1, totalPages) : currentPage;
    const indexOfLastItem = activePage * ITEMS_PER_PAGE;
    const indexOfFirstItem = indexOfLastItem - ITEMS_PER_PAGE;
    const currentItems = filteredCauses.slice(indexOfFirstItem, indexOfLastItem);
    const getPageNumbers = () => {
        const pages = [];
        if (totalPages <= 5) {
            for (let i = 1; i <= totalPages; i++) {
                pages.push(i);
            }
        }
        else {
            if (activePage <= 3) {
                pages.push(1, 2, 3, 4, '...', totalPages);
            }
            else if (activePage >= totalPages - 2) {
                pages.push(1, '...', totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
            }
            else {
                pages.push(1, '...', activePage - 1, activePage, activePage + 1, '...', totalPages);
            }
        }
        return pages;
    };
    const handleMaintenanceClick = (e) => {
        e.preventDefault();
        const confirmed = window.confirm("A jeni të sigurt që dëshironi të kontribuoni për mirëmbajtjen e platformës sonë parësisht njerëzve në nevojë?\n\nJu ftojmë të konsideroni ndarjen e donacionit tuaj në dy pjesë (50% për familjet në nevojë dhe 50% për platformën), apo t'i kushtoni vëmendje të plotë rasteve emergjente.\n\nFaleminderit përzemërsisht për mbështetjen tuaj pafund!");
        if (confirmed) {
            if (donationUrls.maintenance) {
                window.open(donationUrls.maintenance, '_blank', 'noopener,noreferrer');
            }
            else {
                alert("URL për mirëmbajtje nuk është konfiguruar nga administratori.");
            }
        }
    };
    const handleCharityClick = (e) => {
        e.preventDefault();
        if (donationUrls.charity) {
            window.open(donationUrls.charity, '_blank', 'noopener,noreferrer');
        }
        else {
            alert("URL për bamirësi nuk është konfiguruar nga administratori.");
        }
    };
    const handleSubmitApplication = async (e) => {
        e.preventDefault();
        if (!newApplication.title || !newApplication.description || !newApplication.mediaUrl) {
            alert("Ju lutem plotësoni të gjitha fushat obligative (Titulli, Përshkrimi, bashkëngjitni një Foto/Video).");
            return;
        }
        try {
            const { db } = await import('../lib/firebase');
            const { collection, addDoc, serverTimestamp } = await import('firebase/firestore');
            // Firebase
            await addDoc(collection(db, 'donationCauses'), {
                ...newApplication,
                status: 'pending',
                createdAt: serverTimestamp()
            });
            // Local State Update
            addDonationCause({
                ...newApplication,
                status: 'pending'
            });
            alert("Aplikimi juaj është dërguar me sukses! Administratori do ta shqyrtojë së shpejti.");
            setIsApplying(false);
            setNewApplication({
                title: '',
                description: '',
                category: 'shtepi',
                mediaType: 'image',
                mediaUrl: '',
                donationUrl: ''
            });
        }
        catch (err) {
            const appErr = handleFirebaseError(err);
            alert(appErr.message);
            console.error(appErr.technicalMessage);
        }
    };
    return (_jsxs(motion.div, { initial: { opacity: 0, y: 10 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -10 }, transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] }, className: "max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-32 md:py-16 font-sans text-slate-900 dark:text-white dark:text-slate-100", children: [_jsx("div", { className: "mb-6", children: _jsx(AdBanner, { position: "inline" }) }), _jsx("div", { className: "absolute top-1/4 left-1/2 -translate-x-1/2 -z-10 w-72 h-72 bg-rose-500/5 rounded-full blur-3xl pointer-events-none" }), _jsxs("div", { className: "mb-8 md:mb-12 flex flex-col md:flex-row md:items-end justify-between gap-4 md:gap-6", children: [_jsxs("div", { className: "w-full", children: [_jsxs("div", { className: "inline-flex items-center gap-2 md:gap-3 px-3 py-1.5 bg-slate-900 border border-slate-800 text-white text-[10px] md:text-xs font-bold tracking-widest mb-3 md:mb-5 rounded-xl uppercase", children: [_jsx(Heart, { className: "w-3 h-3 md:w-4 md:h-4 text-rose-500 fill-rose-500/20 active:scale-110 transition-transform cursor-pointer" }), dt(`Fushatat e Donacioneve`)] }), _jsxs("h2", { className: "text-2xl sm:text-4xl md:text-5xl font-black text-slate-900 dark:text-white tracking-tight uppercase title-serif mb-2 md:mb-4 leading-none select-none", children: [dt(`Njerëzit Me Nevojë`), _jsx("span", { className: "text-rose-600", children: "." })] }), _jsx("p", { className: "text-xs sm:text-sm md:text-base text-neutral-600 dark:text-slate-400 max-w-3xl border-l-4 border-rose-500 pl-3 md:pl-4 font-medium italic break-words", children: dt(`Zgjidhni formën e kontributit tuaj për të mbështetur zhvillimin dhe solidaritetin në qytetin tonë. Kontributi juaj është thelbësor.`) })] }), _jsxs(Button, { size: "lg", variant: "primary", onClick: () => setIsApplying(true), className: "w-full md:w-auto px-5 py-3.5 md:px-6 md:py-4 bg-rose-600 hover:bg-rose-700 text-white font-extrabold rounded-2xl transition-all shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none shadow-rose-600/10 hover:shadow-[0_20px_40px_-10px_rgba(0,0,0,0.08)] hover:shadow-rose-600/20 flex items-center justify-center gap-2 transform active:scale-95 text-xs md:text-sm mt-2 md:mt-0 whitespace-normal text-center break-words", children: [_jsx(PlusCircle, { className: "w-4 h-4 md:w-5 md:h-5" }), dt(`Aplikoni Për Rast Ndihme`)] })] }), isApplying && (_jsxs("div", { className: "mb-12 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl rounded-2xl border border-slate-200/60 dark:border-white/10 p-5 sm:p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none relative overflow-hidden", children: [_jsx("div", { className: "absolute top-0 left-0 w-2 h-full bg-rose-600" }), _jsxs("div", { className: "flex justify-between items-center mb-6 border-b border-rose-50 pb-4", children: [_jsx("h3", { className: "text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white uppercase tracking-tight", children: dt(`Aplikoni për Donacion`) }), _jsx("button", { "aria-label": "Mbyll", onClick: () => setIsApplying(false), className: "text-slate-400 hover:text-slate-500 dark:text-slate-400 p-1 hover:bg-slate-50 dark:bg-slate-900 rounded-2xl transition-colors", children: _jsx(X, { className: "w-6 h-6" }) })] }), _jsxs("form", { onSubmit: handleSubmitApplication, className: "space-y-5", children: [_jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-4", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5", children: dt(`Titulli i Rastit *`) }), _jsx("input", { required: true, value: newApplication.title, onChange: e => setNewApplication({ ...newApplication, title: e.target.value }), className: "w-full border border-slate-200/60 dark:border-white/10 bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3.5 text-sm focus:border-rose-600 focus:bg-white dark:bg-slate-900 dark:focus:bg-slate-800 dark:bg-slate-900 outline-none transition-all", placeholder: dt(`psh. Ndihmë për fëmijën...`) })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5", children: dt(`Kategoria *`) }), _jsxs("select", { value: newApplication.category, onChange: e => setNewApplication({ ...newApplication, category: e.target.value }), className: "w-full border border-slate-200/60 dark:border-white/10 bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3.5 text-sm focus:border-rose-600 focus:bg-white dark:bg-slate-900 dark:focus:bg-slate-800 dark:bg-slate-900 outline-none transition-all", children: [_jsx("option", { value: "shtepi", children: dt(`Shtëpi`) }), _jsx("option", { value: "ushqim", children: dt(`Ushqim`) }), _jsx("option", { value: "veshmbathje", children: dt(`Veshmbathje`) }), _jsx("option", { value: "tjera", children: dt(`Të Tjera`) })] })] }), _jsxs("div", { className: "md:col-span-2", children: [_jsx("label", { className: "block text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5", children: dt(`Përshkrimi i Rastit *`) }), _jsx("textarea", { required: true, value: newApplication.description, onChange: e => setNewApplication({ ...newApplication, description: e.target.value }), className: "w-full border border-slate-200/60 dark:border-white/10 bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3.5 text-sm focus:border-rose-600 focus:bg-white dark:bg-slate-900 dark:focus:bg-slate-800 dark:bg-slate-900 outline-none min-h-[120px] transition-all", placeholder: dt(`Shpjegoni detajet e rastit paktën disa rreshta...`) })] }), _jsxs("div", { className: "md:col-span-2", children: [_jsx("label", { className: "block text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5", children: dt(`Ngarko Foto ose Video (Deri në 5MB) *`) }), _jsx("div", { className: "flex items-center justify-center w-full overflow-hidden", children: _jsxs("label", { className: "flex flex-col items-center justify-center w-full h-36 border-2 border-slate-200/60 dark:border-white/10 border-dashed rounded-2xl cursor-pointer bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800/50 dark:bg-slate-800/80 transition-colors", children: [_jsxs("div", { className: "flex flex-col items-center justify-center pt-5 pb-6 px-4 text-center", children: [_jsx("svg", { className: "w-8 h-8 mb-3 text-slate-450 text-rose-500", "aria-hidden": "true", xmlns: "http://www.w3.org/2000/svg", fill: "none", viewBox: "0 0 20 16", children: _jsx("path", { stroke: "currentColor", strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: "2", d: "M13 13h3a3 3 0 0 0 0-6h-.025A5.56 5.56 0 0 0 16 6.5 5.5 5.5 0 0 0 5.207 5.021C5.137 5.017 5.071 5 5 5a4 4 0 0 0 0 8h2.167M10 15V6m0 0L8 8m2-2 2 2" }) }), _jsxs("p", { className: "mb-1 text-sm text-slate-500 dark:text-slate-400 font-bold", children: [_jsx("span", { className: "text-rose-600 underline", children: dt(`Kliko për të ngarkuar`) }), dt(`ose tërhiq këtu`)] }), _jsx("p", { className: "text-[11px] text-slate-400 uppercase tracking-widest font-black", children: dt(`SVG, PNG, JPG, ose MP4`) })] }), _jsx("input", { id: "dropzone-file", type: "file", className: "hidden", accept: "image/*,video/*", onChange: (e) => {
                                                                const file = e.target.files?.[0];
                                                                if (file) {
                                                                    const isVideo = file.type.startsWith('video/');
                                                                    if (isVideo) {
                                                                        if (file.size > 600 * 1024) {
                                                                            alert('Videoja është shumë e madhe (Maksimumi është 600KB për shkak të kufizimeve të databazës).');
                                                                            return;
                                                                        }
                                                                        const reader = new FileReader();
                                                                        reader.onloadend = () => {
                                                                            setNewApplication(prev => ({
                                                                                ...prev,
                                                                                mediaType: 'video',
                                                                                mediaUrl: reader.result
                                                                            }));
                                                                        };
                                                                        reader.readAsDataURL(file);
                                                                    }
                                                                    else {
                                                                        const reader = new FileReader();
                                                                        reader.onloadend = () => {
                                                                            const img = new Image();
                                                                            img.src = reader.result;
                                                                            img.onload = () => {
                                                                                const canvas = document.createElement('canvas');
                                                                                let width = img.width;
                                                                                let height = img.height;
                                                                                const maxWidth = 800;
                                                                                const maxHeight = 800;
                                                                                if (width > height) {
                                                                                    if (width > maxWidth) {
                                                                                        height = Math.round((height * maxWidth) / width);
                                                                                        width = maxWidth;
                                                                                    }
                                                                                }
                                                                                else {
                                                                                    if (height > maxHeight) {
                                                                                        width = Math.round((width * maxHeight) / height);
                                                                                        height = maxHeight;
                                                                                    }
                                                                                }
                                                                                canvas.width = width;
                                                                                canvas.height = height;
                                                                                const ctx = canvas.getContext('2d');
                                                                                if (ctx) {
                                                                                    ctx.drawImage(img, 0, 0, width, height);
                                                                                    setNewApplication(prev => ({
                                                                                        ...prev,
                                                                                        mediaType: 'image',
                                                                                        mediaUrl: canvas.toDataURL('image/jpeg', 0.75)
                                                                                    }));
                                                                                }
                                                                                else {
                                                                                    setNewApplication(prev => ({
                                                                                        ...prev,
                                                                                        mediaType: 'image',
                                                                                        mediaUrl: reader.result
                                                                                    }));
                                                                                }
                                                                            };
                                                                        };
                                                                        reader.readAsDataURL(file);
                                                                    }
                                                                }
                                                            } })] }) }), newApplication.mediaUrl && (_jsxs("div", { className: "mt-4 relative w-36 h-36 rounded-2xl overflow-hidden border-2 border-slate-200/60 dark:border-white/10 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none", children: [newApplication.mediaType === 'video' ? (_jsx("video", { src: newApplication.mediaUrl, className: "w-full h-full object-cover", controls: true, muted: true })) : (_jsx("img", { src: newApplication.mediaUrl, className: "w-full h-full object-cover", alt: "Preview preview" })), _jsx("button", { type: "button", onClick: () => setNewApplication(prev => ({ ...prev, mediaUrl: '', mediaType: 'image' })), className: "absolute top-2 right-2 bg-rose-600 hover:bg-rose-700 text-white rounded-full p-1.5 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none transition-colors", children: _jsx(X, { className: "w-3.5 h-3.5" }) })] }))] }), _jsxs("div", { className: "md:col-span-2", children: [_jsx("label", { className: "block text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5", children: dt(`Link Për Donacion (Opsionale)`) }), _jsx("input", { type: "url", value: newApplication.donationUrl, onChange: e => setNewApplication({ ...newApplication, donationUrl: e.target.value }), className: "w-full border border-slate-200/60 dark:border-white/10 bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3.5 text-sm focus:border-rose-600 focus:bg-white dark:bg-slate-900 dark:focus:bg-slate-800 dark:bg-slate-900 outline-none transition-all", placeholder: dt(`https://gofund.me/...`) }), _jsx("p", { className: "text-[11px] text-slate-500 dark:text-slate-400 mt-1.5 font-medium", children: dt(`Nëse keni një fushatë të hapur në GoFundMe, KosovaCharity apo rrjete tjera`) })] })] }), _jsx("div", { className: "pt-4", children: _jsx(Button, { type: "submit", size: "lg", variant: "primary", fullWidth: true, children: dt(`Dërgo Aplikimin për Shqyrtim Publik`) }) })] })] })), _jsx("div", { className: "relative mb-10", children: _jsx("div", { className: "flex overflow-x-auto gap-2 md:gap-3 pb-4 mb-2 md:mb-6 w-full hide-scrollbar snap-x snap-mandatory px-1", children: categories.map((cat) => (_jsxs("button", { onClick: () => handleCategoryChange(cat.id), className: `snap-start flex items-center justify-center gap-1.5 md:gap-2 px-4 py-3 md:px-5 md:py-4 rounded-xl font-bold whitespace-nowrap transition-all duration-300 ease-in-out text-[11px] sm:text-xs md:text-sm border-2 shrink-0 ${activeCategory === cat.id
                            ? 'bg-rose-600 text-white border-rose-600 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none scale-[1.02]'
                            : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200/60 dark:border-white/10 hover:border-slate-300 hover:bg-slate-50 dark:bg-slate-900 shadow-sm dark:shadow-none'} active:scale-[0.98] cursor-pointer`, children: [_jsx(cat.icon, { className: `w-3.5 h-3.5 md:w-4 md:h-4 ${activeCategory === cat.id ? 'text-white' : 'text-rose-500'}` }), _jsx("span", { className: "uppercase", children: cat.label })] }, cat.id))) }) }), _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8 mb-12", children: [currentItems.map((cause, index) => {
                        const categoryObj = categories.find(c => c.id === cause.category);
                        return (_jsxs(motion.div, { initial: { opacity: 0, y: 15 }, whileInView: { opacity: 1, y: 0 }, viewport: { once: true }, transition: { delay: (index % 3) * 0.08 }, onClick: () => setSelectedCause(cause), className: "bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/60 dark:border-white/10 overflow-hidden shadow-sm dark:shadow-none hover:shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none dark:hover:shadow-none hover:border-slate-300 dark:hover:border-white/20 transition-all duration-300 flex flex-col group cursor-pointer h-full", children: [_jsxs("div", { className: "relative aspect-[4/3] sm:aspect-video w-full overflow-hidden bg-slate-50 dark:bg-slate-900 shrink-0 select-none", children: [categoryObj && (_jsxs("div", { className: "absolute top-3 left-3 bg-slate-900/90 backdrop-blur-md text-white text-[9px] sm:text-[10px] font-black uppercase tracking-widest px-2.5 sm:px-3 py-1.5 rounded-2xl flex items-center gap-1.5 z-10 border border-white/10 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none", children: [_jsx(categoryObj.icon, { className: "w-3.5 h-3.5 text-rose-500 fill-rose-500/10" }), categoryObj.label] })), _jsx("div", { className: "absolute top-3 right-3 bg-rose-600/95 backdrop-blur-md text-white text-[9px] sm:text-[10px] font-black uppercase tracking-widest px-2.5 sm:px-3 py-1.5 rounded-2xl z-10 border border-white/10 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none", children: dt(`Rast Prioritar`) }), cause.mediaType === 'video' ? (_jsx("video", { src: cause.mediaUrl, className: "w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-500", muted: true })) : (_jsx("img", { src: cause.mediaUrl, alt: cause.title, className: "w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-500" })), _jsx("div", { className: "absolute inset-0 bg-gradient-to-t from-slate-950/40 to-transparent" })] }), _jsxs("div", { className: "p-4 sm:p-5 flex-1 flex flex-col justify-between", children: [_jsxs("div", { children: [_jsx("h3", { className: "font-extrabold text-base sm:text-lg text-slate-950 dark:text-white mb-1.5 leading-snug break-words group-hover:text-rose-600 transition-colors line-clamp-2", children: cause.title }), _jsx("p", { className: "text-neutral-600 dark:text-slate-400 mb-3 sm:mb-5 text-xs sm:text-sm flex-1 leading-relaxed font-semibold line-clamp-2 sm:line-clamp-4 break-words", children: cause.description })] }), _jsxs("div", { className: "mt-auto pt-3 sm:pt-4 border-t border-slate-100 dark:border-white/5 flex flex-col gap-3", children: [_jsxs("div", { className: "flex flex-wrap items-center justify-between text-[10px] sm:text-xs text-slate-400 font-extrabold uppercase tracking-wider px-0.5 gap-1", children: [_jsxs("span", { className: "flex items-center gap-1 shrink-0", children: [_jsx(Heart, { className: "w-3.5 h-3.5 text-rose-500 fill-rose-500/20" }), dt(`Ndihmë Urgjente`)] }), _jsx("span", { className: "text-emerald-600 font-black flex items-center gap-1 shrink-0", children: dt(`● AKTIVE`) })] }), _jsx("div", { onClick: (e) => e.stopPropagation(), children: _jsxs("a", { href: cause.donationUrl, target: "_blank", rel: "noopener noreferrer", className: "w-full py-2.5 sm:py-3 bg-slate-900 hover:bg-rose-600 text-white font-black rounded-xl sm:rounded-2xl transition-all duration-300 flex items-center justify-center gap-1.5 text-xs shadow-sm dark:shadow-none hover:shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none hover:shadow-rose-600/10 active:scale-95 cursor-pointer uppercase tracking-wide whitespace-normal text-center break-words px-2", children: [_jsx("span", { children: dt(`Kontriboni Tani`) }), _jsx(Heart, { className: "w-3.5 h-3.5 shrink-0 fill-transparent group-hover:fill-white transition-all duration-300 text-rose-500" })] }) })] })] })] }, cause.id));
                    }), filteredCauses.length === 0 && (_jsxs("div", { className: "col-span-full py-16 sm:py-24 text-center text-slate-500 dark:text-slate-400 border-2 border-dashed border-slate-200/60 dark:border-white/10 rounded-2xl bg-slate-50 dark:bg-slate-800/50 px-6", children: [_jsx(Heart, { className: "w-12 h-12 text-slate-300 mx-auto mb-4 animate-bounce" }), _jsx("h4", { className: "font-extrabold text-slate-800 dark:text-slate-200 dark:text-slate-200 mb-2 uppercase tracking-tight", children: dt(`Vonesë e përkohshme`) }), _jsx("p", { className: "font-semibold text-sm text-slate-500 dark:text-slate-400 max-w-sm mx-auto", children: dt(`Aktualisht nuk ka asnjë fushatë aktive për donacion në këtë kategori.`) })] }))] }), totalPages > 1 && (_jsxs("div", { className: "flex items-center justify-center gap-2 mt-12 mb-16 select-none flex-wrap", children: [_jsx("button", { onClick: () => setCurrentPage(prev => Math.max(1, prev - 1)), disabled: activePage === 1, className: "flex items-center justify-center p-2.5 rounded-xl border border-slate-200/60 dark:border-white/10 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:bg-slate-900 disabled:opacity-40 disabled:pointer-events-none transition-all shadow-sm dark:shadow-none active:scale-95 cursor-pointer", "aria-label": "Faqja e m\u00EBparshme", children: _jsx(ChevronLeft, { className: "w-5 h-5 text-slate-500 dark:text-slate-400" }) }), _jsx("div", { className: "flex items-center gap-1.5 sm:gap-2", children: getPageNumbers().map((page, index) => {
                            if (page === '...') {
                                return (_jsx("span", { className: "px-2 text-slate-400 font-bold font-mono", children: "..." }, `ellipsis-${index}`));
                            }
                            const isCurrent = page === activePage;
                            return (_jsx("button", { onClick: () => setCurrentPage(Number(page)), className: `min-w-[40px] h-[40px] px-2 flex items-center justify-center rounded-xl font-extrabold font-mono text-sm transition-all focus:outline-none cursor-pointer ${isCurrent
                                    ? 'bg-rose-600 text-white shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none shadow-rose-600/10'
                                    : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200/60 dark:border-white/10 hover:bg-slate-50 dark:bg-slate-900 hover:border-slate-350'} active:scale-95`, children: page }, `page-${page}`));
                        }) }), _jsx("button", { onClick: () => setCurrentPage(prev => Math.min(totalPages, prev + 1)), disabled: activePage === totalPages, className: "flex items-center justify-center p-2.5 rounded-xl border border-slate-200/60 dark:border-white/10 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:bg-slate-900 disabled:opacity-40 disabled:pointer-events-none transition-all shadow-sm dark:shadow-none active:scale-95 cursor-pointer", "aria-label": "Faqja tjet\u00EBr", children: _jsx(ChevronRight, { className: "w-5 h-5 text-slate-500 dark:text-slate-400" }) })] })), _jsxs("div", { className: "bg-slate-900 rounded-2xl border border-slate-800 p-5 sm:p-8 md:p-12 text-white overflow-hidden relative", children: [_jsx("div", { className: "absolute top-0 right-0 -mr-10 -mt-10 md:-mr-20 md:-mt-20 opacity-5 pointer-events-none", children: _jsx(Globe, { className: "w-48 h-48 md:w-96 md:h-96" }) }), _jsxs("div", { className: "relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6 md:gap-8", children: [_jsxs("div", { className: "flex-1 text-center lg:text-left", children: [_jsxs("h3", { className: "text-lg sm:text-xl md:text-3xl font-extrabold title-serif flex flex-wrap items-center justify-center lg:justify-start gap-2 md:gap-3 mb-2 md:mb-3", children: [_jsx(Globe, { className: "w-5 h-5 md:w-7 md:h-7 text-rose-500" }), dt(`Kontribuo Për Komunitetin`)] }), _jsx("p", { className: "text-xs sm:text-sm md:text-base text-neutral-400 max-w-xl mx-auto lg:mx-0 font-medium", children: dt(`Nëse dëshironi të kontribuoni drejtpërdrejt në mirëmbajtjen e platformës, ose në bamirësi shtesë, zgjidhni një nga opsionet më poshtë.`) })] }), _jsxs("div", { className: "flex flex-col sm:flex-row items-stretch sm:items-center gap-3 md:gap-4 w-full lg:w-auto shrink-0 mt-4 lg:mt-0", children: [_jsxs(Button, { size: "lg", variant: "primary", fullWidth: true, onClick: handleCharityClick, children: [_jsx("span", { className: "w-2 h-2 bg-white dark:bg-slate-900 rounded-full animate-pulse" }), dt(`Njerëzit me Nevojë`)] }), _jsx(Button, { size: "lg", variant: "outline", fullWidth: true, onClick: handleMaintenanceClick, children: dt(`Mirëmbajtja e Web-it`) })] })] })] }), _jsx(AnimatePresence, { children: selectedCause && (_jsx(motion.div, { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 }, className: "fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md", onClick: () => setSelectedCause(null), children: _jsxs(motion.div, { initial: { scale: 0.95, opacity: 0 }, animate: { scale: 1, opacity: 1 }, exit: { scale: 0.95, opacity: 0 }, onClick: (e) => e.stopPropagation(), className: "bg-white dark:bg-slate-900 rounded-2xl overflow-hidden shadow-xl dark:shadow-none border border-slate-200/60 dark:border-white/10 w-full max-w-3xl flex flex-col max-h-[90vh]", children: [_jsxs("div", { className: "relative aspect-video w-full bg-slate-50 dark:bg-slate-900 shrink-0 select-none", children: [selectedCause.mediaType === 'video' ? (_jsx("video", { src: selectedCause.mediaUrl, className: "w-full h-full object-cover", controls: true, autoPlay: true, muted: true })) : (_jsx("img", { src: selectedCause.mediaUrl, alt: selectedCause.title, className: "w-full h-full object-cover" })), _jsx("button", { onClick: () => setSelectedCause(null), className: "absolute top-4 right-4 p-2 bg-slate-900/50 hover:bg-slate-900 text-white rounded-full transition-colors backdrop-blur-md cursor-pointer", children: _jsx(X, { className: "w-5 h-5" }) })] }), _jsxs("div", { className: "p-5 sm:p-8 overflow-y-auto w-full flex-1", children: [_jsx("h2", { className: "text-xl sm:text-2xl md:text-3xl font-black text-slate-900 dark:text-white title-serif mb-4 leading-snug break-words", children: selectedCause.title }), _jsxs("div", { className: "text-xs font-extrabold text-slate-400 mb-6 flex items-center gap-2 uppercase tracking-wider", children: [_jsx("span", { className: "w-2.5 h-2.5 rounded-full bg-rose-600 animate-pulse" }), dt(`Publikuar:`), " ", new Date(selectedCause.createdAt).toLocaleDateString('sq-AL', { day: 'numeric', month: 'long', year: 'numeric' })] }), _jsx("div", { className: "prose prose-slate max-w-none text-neutral-605 leading-relaxed font-semibold text-sm md:text-base space-y-4 break-words", children: selectedCause.description.split('\n').map((paragraph, i) => (_jsx("p", { children: paragraph }, i))) })] }), _jsxs("div", { className: "p-5 sm:p-6 border-t border-slate-100 dark:border-white/5 bg-slate-50 dark:bg-slate-900 shrink-0 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4", children: [_jsx("p", { className: "text-xs font-extrabold text-slate-400 max-w-xs text-center sm:text-left leading-normal uppercase break-words", children: dt(`Duke ndihmuar këta njerëz, ju po ndihmoni të gjithë komunitetin e qytetit tonë.`) }), _jsxs("a", { href: selectedCause.donationUrl, target: "_blank", rel: "noopener noreferrer", className: "w-full sm:w-auto px-6 py-3.5 sm:px-8 sm:py-4 bg-rose-600 hover:bg-rose-700 text-white font-black rounded-2xl transition-all flex items-center justify-center gap-2 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none hover:shadow-[0_20px_40px_-10px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 active:translate-y-0 text-sm cursor-pointer uppercase tracking-wider text-center", children: [dt(`Dërgo Ndihmën Tënde`), _jsx(Heart, { className: "w-4 h-4 ml-1 fill-transparent" })] })] })] }) })) })] }));
}
