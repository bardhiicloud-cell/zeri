import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { dt } from '@/src/lib/dt';
import { useState, useEffect } from 'react';
import { db } from '../../lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { Grid, Heart, Bookmark, Play } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../../lib/store';
export default function ForumProfileTab({ currentUser, setActiveTab }) {
    const [reels, setReels] = useState([]);
    const [totalLikes, setTotalLikes] = useState(0);
    const navigate = useNavigate();
    const systemSettings = useStore(state => state.systemSettings);
    const showReels = systemSettings?.showReels ?? true;
    useEffect(() => {
        if (!currentUser)
            return;
        const fetchUserReels = async () => {
            const q = query(collection(db, 'forumReels'), where('authorId', '==', currentUser.id));
            const snap = await getDocs(q);
            const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            // Sort client side because firestore needs compound index for where+orderBy
            data.sort((a, b) => {
                const tA = a.createdAt?.seconds || 0;
                const tB = b.createdAt?.seconds || 0;
                return tB - tA;
            });
            setReels(data);
            const likes = data.reduce((acc, curr) => acc + (curr.likes?.length || 0), 0);
            setTotalLikes(likes);
        };
        fetchUserReels();
    }, [currentUser]);
    if (!currentUser) {
        return (_jsxs("div", { className: "flex flex-col items-center justify-center h-full text-zinc-500", children: [_jsx("p", { children: dt(`Duhet të logoheni për të parë profilin.`) }), _jsx("button", { onClick: () => navigate('/login'), className: "mt-4 px-6 py-2 bg-rose-500 text-white rounded-full font-bold", children: dt(`Kyçu`) })] }));
    }
    return (_jsxs("div", { className: "w-full h-full bg-black text-white flex flex-col overflow-y-auto hide-scrollbar pb-20 pt-8", children: [_jsxs("div", { className: "flex flex-col items-center px-4 pt-6", children: [_jsx("div", { className: "w-24 h-24 rounded-full p-0.5 border border-zinc-800 mb-3", children: _jsx("img", { src: currentUser.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser.name)}&background=27272a&color=fff`, alt: "Profile", className: "w-full h-full rounded-full object-cover" }) }), _jsx("h2", { className: "text-lg font-bold", children: currentUser.name }), _jsxs("p", { className: "text-sm text-zinc-400 mb-4", children: ["@", currentUser.name?.replace(/\s+/g, '').toLowerCase() || 'user'] }), _jsxs("div", { className: "flex items-center gap-8 mb-5", children: [_jsxs("div", { className: "flex flex-col items-center", children: [_jsx("span", { className: "font-bold text-lg", children: "12" }), _jsx("span", { className: "text-[11px] text-zinc-500", children: dt(`Following`) })] }), _jsxs("div", { className: "flex flex-col items-center", children: [_jsx("span", { className: "font-bold text-lg", children: "248" }), _jsx("span", { className: "text-[11px] text-zinc-500", children: dt(`Followers`) })] }), _jsxs("div", { className: "flex flex-col items-center", children: [_jsx("span", { className: "font-bold text-lg", children: totalLikes }), _jsx("span", { className: "text-[11px] text-zinc-500", children: dt(`Likes`) })] })] }), _jsx("div", { className: "flex items-center gap-2 mb-6", children: _jsx("button", { className: "px-10 py-2.5 bg-zinc-800 hover:bg-zinc-700 rounded-2xl text-[13px] font-bold transition-colors", children: dt(`Edit profile`) }) }), _jsxs("p", { className: "text-xs text-center text-zinc-300 max-w-sm mb-6", children: [dt(`Qytetar aktiv i Kosovës. 🇽🇰`), _jsx("br", {}), dt(`Duke ndarë momente dhe opinione.`)] })] }), _jsxs("div", { className: "flex items-center justify-around border-b border-zinc-800 sticky top-0 bg-black z-10", children: [_jsx("div", { className: "flex-1 py-3 flex justify-center border-b-2 border-white", children: _jsx(Grid, { className: "w-5 h-5 text-white" }) }), _jsx("div", { className: "flex-1 py-3 flex justify-center text-zinc-600", children: _jsx(Heart, { className: "w-5 h-5" }) }), _jsx("div", { className: "flex-1 py-3 flex justify-center text-zinc-600", children: _jsx(Bookmark, { className: "w-5 h-5" }) })] }), _jsxs("div", { className: "grid grid-cols-3 gap-[1px] bg-zinc-900 flex-1", children: [showReels && reels.map(reel => (_jsxs("div", { className: "aspect-[3/4] bg-zinc-900 relative cursor-pointer", onClick: () => setActiveTab('reels'), children: [reel.isPhoto ? (_jsx("img", { src: reel.mediaUrl, className: "w-full h-full object-cover", alt: "" })) : (_jsx("video", { src: reel.mediaUrl, className: "w-full h-full object-cover" })), _jsxs("div", { className: "absolute bottom-1 left-1 flex items-center gap-1 text-white text-[10px] font-bold", children: [_jsx(Play, { className: "w-3 h-3" }), reel.views || 0] })] }, reel.id))), !showReels && (_jsx("div", { className: "col-span-3 py-20 flex flex-col items-center text-zinc-500", children: _jsx("p", { className: "text-sm font-bold", children: dt(`Reels janë çaktivizuar nga administratori`) }) })), showReels && reels.length === 0 && (_jsx("div", { className: "col-span-3 py-20 flex flex-col items-center text-zinc-500", children: _jsx("p", { className: "text-sm font-bold", children: dt(`Nuk keni publikuar asnjë Reel`) }) }))] })] }));
}
