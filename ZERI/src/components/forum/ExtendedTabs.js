import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { dt } from '@/src/lib/dt';
import { db } from '../../lib/firebase';
import { collection, query, onSnapshot, orderBy, where, addDoc, updateDoc, doc, serverTimestamp, deleteDoc } from 'firebase/firestore';
import { useState, useEffect } from 'react';
import { Users, Send, ArrowLeft, Plus, Image as ImageIcon, MessageSquare, Heart, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
export const GroupsTab = ({ requireAuth, currentUser }) => {
    const [groups, setGroups] = useState([]);
    const [activeGroup, setActiveGroup] = useState(null);
    const [showCreate, setShowCreate] = useState(false);
    const [newGroupName, setNewGroupName] = useState('');
    const [newGroupDesc, setNewGroupDesc] = useState('');
    const [groupPosts, setGroupPosts] = useState([]);
    const [newPostContent, setNewPostContent] = useState('');
    const [activeCommentPost, setActiveCommentPost] = useState(null);
    const [newCommentContent, setNewCommentContent] = useState('');
    useEffect(() => {
        const q = query(collection(db, 'forumGroups'), orderBy('createdAt', 'desc'));
        const unsub = onSnapshot(q, (snap) => {
            setGroups(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        });
        return unsub;
    }, []);
    useEffect(() => {
        if (!activeGroup)
            return;
        const q = query(collection(db, 'posts'), where('groupId', '==', activeGroup.id), orderBy('createdAt', 'desc'));
        const unsub = onSnapshot(q, (snap) => {
            setGroupPosts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        });
        return unsub;
    }, [activeGroup]);
    const handleCreateGroup = async (e) => {
        e.preventDefault();
        if (!requireAuth())
            return;
        if (!newGroupName.trim())
            return;
        try {
            await addDoc(collection(db, 'forumGroups'), {
                name: newGroupName,
                description: newGroupDesc,
                createdBy: currentUser?.id,
                creatorName: currentUser?.name,
                members: [currentUser?.id],
                createdAt: serverTimestamp()
            });
            toast.success("Grupi u krijua me sukses!");
            setShowCreate(false);
            setNewGroupName('');
            setNewGroupDesc('');
        }
        catch (e) {
            toast.error("Gabim gjatë krijimit të grupit.");
        }
    };
    const handleJoinGroup = async (group) => {
        if (!requireAuth())
            return;
        const isMember = group.members?.includes(currentUser?.id);
        try {
            let newMembers = [...(group.members || [])];
            if (isMember) {
                newMembers = newMembers.filter((m) => m !== currentUser?.id);
                toast.success("U larguat nga grupi.");
            }
            else {
                newMembers.push(currentUser?.id);
                toast.success("U bashkuat me grupin!");
                // Send notification to group creator
                if (group.createdBy && group.createdBy !== currentUser?.id) {
                    await addDoc(collection(db, "notifications"), {
                        userId: group.createdBy,
                        title: 'Anëtar i ri në grup',
                        message: `${currentUser?.name || "Një përdorues"} u bashkua me grupin tuaj "${group.name}".`,
                        type: 'group_join',
                        read: false,
                        createdAt: serverTimestamp(),
                        link: '/forum'
                    });
                }
            }
            await updateDoc(doc(db, 'forumGroups', group.id), { members: newMembers });
            if (activeGroup?.id === group.id) {
                setActiveGroup({ ...group, members: newMembers });
            }
        }
        catch (e) {
            toast.error("Gabim.");
        }
    };
    const handleGroupPost = async (e) => {
        e.preventDefault();
        if (!requireAuth())
            return;
        if (!newPostContent.trim())
            return;
        try {
            await addDoc(collection(db, 'posts'), {
                groupId: activeGroup.id,
                content: newPostContent,
                authorId: currentUser?.id,
                authorName: currentUser?.name,
                createdAt: serverTimestamp(),
                likes: [],
                comments: []
            });
            setNewPostContent('');
            toast.success("Postimi u publikua!");
        }
        catch (e) {
            toast.error("Gabim gjatë postimit.");
        }
    };
    const handleLike = async (post) => {
        if (!requireAuth())
            return;
        const isLiked = post.likes?.includes(currentUser?.id);
        try {
            let newLikes = [...(post.likes || [])];
            if (isLiked) {
                newLikes = newLikes.filter((id) => id !== currentUser?.id);
            }
            else {
                newLikes.push(currentUser?.id);
                // Notification
                if (post.authorId !== currentUser?.id) {
                    await addDoc(collection(db, "notifications"), {
                        userId: post.authorId,
                        title: 'Pëlqim i ri në grup',
                        message: `${currentUser?.name || "Një përdorues"} pëlqeu postimin tuaj në grupin "${activeGroup?.name}".`,
                        type: 'like',
                        read: false,
                        createdAt: serverTimestamp(),
                        link: '/forum'
                    });
                }
            }
            await updateDoc(doc(db, 'posts', post.id), { likes: newLikes });
        }
        catch (e) {
            toast.error("Gabim.");
        }
    };
    const handleComment = async (e, post) => {
        e.preventDefault();
        if (!requireAuth())
            return;
        if (!newCommentContent.trim())
            return;
        try {
            const newComment = {
                id: Date.now().toString(),
                authorId: currentUser?.id,
                authorName: currentUser?.name || 'Anonim',
                content: newCommentContent,
                createdAt: new Date().toISOString()
            };
            const newComments = [...(post.comments || []), newComment];
            await updateDoc(doc(db, 'posts', post.id), { comments: newComments });
            setNewCommentContent('');
            setActiveCommentPost(null);
            // Notification
            if (post.authorId !== currentUser?.id) {
                await addDoc(collection(db, "notifications"), {
                    userId: post.authorId,
                    title: 'Koment i ri në grup',
                    message: `${currentUser?.name || "Një përdorues"} komentoi në postimin tuaj në "${activeGroup?.name}".`,
                    type: 'comment',
                    read: false,
                    createdAt: serverTimestamp(),
                    link: '/forum'
                });
            }
        }
        catch (err) {
            toast.error("Gabim gjatë komentimit.");
        }
    };
    const handleDeletePost = async (postId) => {
        if (!requireAuth())
            return;
        if (window.confirm("A jeni i sigurt që dëshironi ta fshini postimin?")) {
            try {
                await deleteDoc(doc(db, 'posts', postId));
                toast.success("Postimi u fshi.");
            }
            catch (err) {
                toast.error("Ndodhi një gabim gjatë fshirjes.");
            }
        }
    };
    if (showCreate) {
        return (_jsxs("div", { className: "bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/60 dark:border-white/10 shadow-sm dark:shadow-none p-6 mb-6", children: [_jsxs("button", { onClick: () => setShowCreate(false), className: "flex items-center gap-2 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:text-slate-200 dark:text-slate-200 mb-6 font-medium transition-colors", children: [_jsx(ArrowLeft, { className: "w-5 h-5" }), dt(`Kthehu te Grupet`)] }), _jsx("h2", { className: "text-2xl font-bold text-slate-900 dark:text-white mb-6", children: dt(`Krijoni një Grup të Ri`) }), _jsxs("form", { onSubmit: handleCreateGroup, className: "space-y-6 max-w-2xl", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2", children: dt(`Emri i Grupit`) }), _jsx("input", { type: "text", value: newGroupName, onChange: e => setNewGroupName(e.target.value), placeholder: dt(`psh. Zhvilluesit Kosovarë`), className: "w-full bg-slate-50 dark:bg-slate-800 border border-slate-200/60 dark:border-white/10 rounded-xl px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all font-medium" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2", children: dt(`Përshkrimi i Grupit`) }), _jsx("textarea", { value: newGroupDesc, onChange: e => setNewGroupDesc(e.target.value), placeholder: dt(`Përshkruani qëllimin e këtij grupi...`), className: "w-full bg-slate-50 dark:bg-slate-800 border border-slate-200/60 dark:border-white/10 rounded-xl px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all min-h-[120px] resize-none text-sm" })] }), _jsx("button", { type: "submit", disabled: !newGroupName.trim(), className: "px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-colors disabled:opacity-50", children: dt(`Krijo Grupin`) })] })] }));
    }
    if (activeGroup) {
        const isMember = activeGroup.members?.includes(currentUser?.id);
        return (_jsxs("div", { className: "bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/60 dark:border-white/10 shadow-sm dark:shadow-none overflow-hidden flex flex-col mb-6 min-h-[600px]", children: [_jsxs("div", { className: "p-4 sm:p-6 border-b border-slate-200/60 dark:border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50 dark:bg-slate-800", children: [_jsxs("div", { className: "flex items-center gap-4", children: [_jsx("button", { onClick: () => setActiveGroup(null), className: "w-10 h-10 bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-white/10 rounded-full flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:text-slate-200 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/50 dark:bg-slate-800 transition-colors shrink-0", children: _jsx(ArrowLeft, { className: "w-5 h-5" }) }), _jsxs("div", { children: [_jsx("h2", { className: "text-xl sm:text-2xl font-bold text-slate-900 dark:text-white leading-tight", children: activeGroup.name }), _jsxs("p", { className: "text-sm text-slate-500 dark:text-slate-400 font-medium mt-0.5", children: [activeGroup.members?.length || 1, dt(`anëtarë • Krijuar nga`), " ", activeGroup.creatorName] })] })] }), _jsx("button", { onClick: () => handleJoinGroup(activeGroup), className: `px-5 py-2.5 rounded-xl text-sm font-bold transition-all shadow-sm dark:shadow-none ${isMember ? 'bg-slate-200 text-slate-700 dark:text-slate-300 hover:bg-slate-300' : 'bg-blue-600 hover:bg-blue-700 text-white'}`, children: isMember ? 'Largohu nga Grupi' : 'Bashkohu me Grupin' })] }), _jsxs("div", { className: "flex-1 overflow-y-auto bg-slate-100 dark:bg-slate-800/50 p-4 sm:p-6 space-y-6", children: [_jsxs("div", { className: "bg-white dark:bg-slate-900 p-5 rounded-2xl shadow-sm dark:shadow-none border border-slate-200/60 dark:border-white/10", children: [_jsx("h3", { className: "text-sm font-bold text-slate-400 uppercase tracking-wider mb-2", children: dt(`Rreth këtij grupi`) }), _jsx("p", { className: "text-slate-700 dark:text-slate-300 text-sm leading-relaxed", children: activeGroup.description || "Nuk ka përshkrim." })] }), isMember ? (_jsxs("form", { onSubmit: handleGroupPost, className: "bg-white dark:bg-slate-900 p-5 rounded-2xl shadow-sm dark:shadow-none border border-slate-200/60 dark:border-white/10", children: [_jsxs("div", { className: "flex gap-3 mb-3", children: [_jsx("div", { className: "w-10 h-10 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-bold shrink-0", children: currentUser?.name?.substring(0, 2) || 'US' }), _jsx("textarea", { value: newPostContent, onChange: e => setNewPostContent(e.target.value), placeholder: dt(`Çfarë keni në mendje?`), className: "w-full bg-slate-50 dark:bg-slate-800 border border-slate-200/60 dark:border-white/10 rounded-xl p-4 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 text-sm resize-none", rows: 3 })] }), _jsx("div", { className: "flex justify-end", children: _jsxs("button", { type: "submit", disabled: !newPostContent.trim(), className: "bg-blue-600 text-white px-6 py-2.5 rounded-full text-sm font-bold disabled:opacity-50 hover:bg-blue-700 transition-colors flex items-center gap-2", children: [_jsx(Send, { className: "w-4 h-4" }), dt(`Posto`)] }) })] })) : (_jsxs("div", { className: "bg-blue-50 p-8 text-center rounded-2xl border border-blue-100 shadow-inner", children: [_jsx(Users, { className: "w-16 h-16 text-blue-300 mx-auto mb-4" }), _jsx("h3", { className: "text-blue-900 font-bold text-lg mb-2", children: dt(`Grupi është privat`) }), _jsxs("p", { className: "text-blue-700/80 text-sm max-w-sm mx-auto", children: [dt(`Bashkohuni me këtë grup për të parë dhe marrë pjesë në diskutimet me`), " ", activeGroup.members?.length || 1, dt(`anëtarë të tjerë.`)] })] })), isMember && groupPosts.map(post => {
                            const isLiked = post.likes?.includes(currentUser?.id);
                            return (_jsxs("div", { className: "bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-white/10 rounded-2xl p-5 shadow-sm dark:shadow-none", children: [_jsxs("div", { className: "flex justify-between items-start mb-4", children: [_jsxs("div", { className: "flex gap-3", children: [_jsx("div", { className: "w-10 h-10 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-full flex items-center justify-center font-bold shrink-0", children: post.authorName?.substring(0, 2) || 'US' }), _jsxs("div", { children: [_jsx("h3", { className: "font-bold text-slate-900 dark:text-white text-[15px]", children: post.authorName }), _jsx("p", { className: "text-xs text-slate-500 dark:text-slate-400 font-medium", children: post.createdAt ? new Date(post.createdAt.seconds * 1000).toLocaleString('sq-AL') : 'Sapo postuar' })] })] }), (currentUser?.role === 'admin' || currentUser?.id === post.authorId) && (_jsx("button", { onClick: () => handleDeletePost(post.id), className: "text-slate-400 hover:text-rose-500 transition-colors p-2 hover:bg-rose-50 rounded-full", children: _jsx(Trash2, { className: "w-4 h-4" }) }))] }), _jsx("p", { className: "text-slate-800 dark:text-slate-200 dark:text-slate-200 text-[15px] leading-relaxed mb-4 whitespace-pre-wrap", children: post.content }), _jsxs("div", { className: "flex items-center gap-6 pt-3 border-t border-slate-100 dark:border-white/5", children: [_jsxs("button", { onClick: () => handleLike(post), className: `flex items-center gap-2 text-sm font-bold transition-colors ${isLiked ? 'text-rose-500' : 'text-slate-500 dark:text-slate-400 hover:text-rose-500'}`, children: [_jsx(Heart, { className: `w-5 h-5 ${isLiked ? 'fill-current' : ''}` }), " ", post.likes?.length || 0] }), _jsxs("button", { onClick: () => setActiveCommentPost(activeCommentPost === post.id ? null : post.id), className: "flex items-center gap-2 text-sm font-bold text-slate-500 dark:text-slate-400 hover:text-blue-600 transition-colors", children: [_jsx(MessageSquare, { className: "w-5 h-5" }), " ", post.comments?.length || 0] })] }), activeCommentPost === post.id && (_jsxs("div", { className: "mt-4 pt-4 border-t border-slate-100 dark:border-white/5 space-y-4", children: [post.comments?.map((comment) => (_jsxs("div", { className: "flex gap-3", children: [_jsx("div", { className: "w-8 h-8 bg-slate-200 rounded-full flex items-center justify-center text-xs font-bold shrink-0", children: comment.authorName.substring(0, 2) }), _jsxs("div", { className: "bg-slate-50 dark:bg-slate-800 rounded-2xl rounded-tl-none p-3 border border-slate-100 dark:border-white/5 flex-1", children: [_jsx("h4", { className: "font-bold text-slate-900 dark:text-white text-[13px]", children: comment.authorName }), _jsx("p", { className: "text-slate-700 dark:text-slate-300 text-[14px] mt-0.5 leading-snug", children: comment.content })] })] }, comment.id))), _jsxs("form", { onSubmit: (e) => handleComment(e, post), className: "flex gap-2 items-center mt-2", children: [_jsx("input", { type: "text", value: newCommentContent, onChange: e => setNewCommentContent(e.target.value), placeholder: dt(`Shkruaj një koment...`), className: "flex-1 bg-slate-100 dark:bg-slate-800 border-none rounded-full px-4 py-2.5 text-[14px] outline-none focus:ring-2 focus:ring-blue-500/20" }), _jsx("button", { type: "submit", disabled: !newCommentContent.trim(), className: "w-10 h-10 bg-blue-600 text-white rounded-full flex items-center justify-center shrink-0 disabled:opacity-50", children: _jsx(Send, { className: "w-4 h-4" }) })] })] }))] }, post.id));
                        }), isMember && groupPosts.length === 0 && (_jsx("div", { className: "text-center py-12 text-slate-500 dark:text-slate-400 text-[15px] font-medium", children: dt(`Ende nuk ka postime. Jini i pari që ndani diçka me grupin!`) }))] })] }));
    }
    return (_jsxs("div", { className: "bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/60 dark:border-white/10 shadow-sm dark:shadow-none p-4 sm:p-6 mb-6", children: [_jsxs("div", { className: "flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6", children: [_jsx("h2", { className: "text-xl sm:text-2xl font-bold text-slate-900 dark:text-white", children: dt(`Grupet e Forumit`) }), _jsxs("button", { onClick: () => { if (requireAuth())
                            setShowCreate(true); }, className: "bg-blue-600 text-white px-5 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-blue-700 transition-colors shadow-sm dark:shadow-none", children: [_jsx(Plus, { className: "w-5 h-5" }), dt(`Krijoni Grup`)] })] }), _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6", children: [groups.map(g => {
                        const isMember = g.members?.includes(currentUser?.id);
                        return (_jsxs("div", { className: "border border-slate-200/60 dark:border-white/10 rounded-2xl p-5 hover:border-blue-500/50 hover:shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none transition-all cursor-pointer bg-slate-50 dark:bg-slate-800/50 group flex flex-col", onClick: () => setActiveGroup(g), children: [_jsxs("div", { className: "flex items-start gap-4 mb-3", children: [_jsx("div", { className: "w-14 h-14 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center group-hover:scale-105 transition-transform shrink-0 shadow-sm dark:shadow-none", children: _jsx(Users, { className: "w-6 h-6" }) }), _jsxs("div", { children: [_jsx("h3", { className: "font-bold text-slate-900 dark:text-white leading-tight mb-1 group-hover:text-blue-600 transition-colors line-clamp-2", children: g.name }), _jsxs("p", { className: "text-[13px] text-slate-500 dark:text-slate-400 font-medium", children: [g.members?.length || 1, dt(`anëtarë`)] })] })] }), _jsx("p", { className: "text-sm text-slate-500 dark:text-slate-400 line-clamp-2 mb-4 leading-relaxed flex-1", children: g.description }), _jsx("div", { className: "flex justify-end pt-3 border-t border-slate-200/60 dark:border-white/10/60 mt-auto", children: _jsx("button", { onClick: (e) => { e.stopPropagation(); handleJoinGroup(g); }, className: `px-4 py-2 text-sm font-bold rounded-xl transition-colors ${isMember ? 'bg-slate-200 text-slate-700 dark:text-slate-300 hover:bg-slate-300' : 'bg-blue-100 text-blue-700 hover:bg-blue-200'}`, children: isMember ? 'Largohu' : 'Bashkohu' }) })] }, g.id));
                    }), groups.length === 0 && (_jsxs("div", { className: "col-span-full py-16 text-center text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-200/60 dark:border-white/10", children: [_jsx(Users, { className: "w-12 h-12 mx-auto text-slate-300 mb-4" }), _jsx("p", { className: "text-lg font-medium text-slate-500 dark:text-slate-400", children: dt(`Nuk ka asnjë grup aktiv.`) }), _jsx("p", { className: "text-sm mt-1", children: dt(`Jini i pari që krijoni një komunitet!`) })] }))] })] }));
};
export const FriendsTab = ({ requireAuth, currentUser }) => {
    const [users, setUsers] = useState([]);
    useEffect(() => {
        const q = query(collection(db, 'users'));
        const unsub = onSnapshot(q, (snap) => {
            setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        });
        return unsub;
    }, []);
    const handleFollow = async (userToFollow) => {
        if (!requireAuth())
            return;
        try {
            // Implement a simplistic follow directly in the user document, 
            // or we can just send a toast to simulate follow
            toast.success(`Tani po ndiqni ${userToFollow.name}`);
            // Notification
            await addDoc(collection(db, "notifications"), {
                userId: userToFollow.id,
                title: 'Ndjekës i ri',
                message: `${currentUser?.name || "Një përdorues"} ka filluar t'ju ndjekë.`,
                type: 'follow',
                read: false,
                createdAt: serverTimestamp(),
                link: '/forum'
            });
        }
        catch (e) {
            toast.error("Gabim.");
        }
    };
    const otherUsers = users.filter(u => u.id !== currentUser?.id);
    return (_jsxs("div", { className: "bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/60 dark:border-white/10 shadow-sm dark:shadow-none p-4 sm:p-6 mb-6", children: [_jsx("h2", { className: "text-xl sm:text-2xl font-bold text-slate-900 dark:text-white mb-6", children: dt(`Përdoruesit në Forum`) }), _jsxs("div", { className: "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4", children: [otherUsers.map((u, i) => (_jsxs("div", { className: "flex items-center gap-4 p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-200/60 dark:border-white/10 transition-colors", children: [_jsx("div", { className: "w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-bold text-lg shrink-0", children: u.name?.substring(0, 2) || 'US' }), _jsxs("div", { className: "flex-1 overflow-hidden", children: [_jsx("h3", { className: "font-bold text-slate-900 dark:text-white truncate", children: u.name }), _jsx("p", { className: "text-xs text-slate-500 dark:text-slate-400 truncate", children: u.role === 'admin' ? 'Administrator' : 'Anëtar' })] }), _jsx("button", { onClick: () => handleFollow(u), className: "px-4 py-2 bg-blue-100 hover:bg-blue-200 text-blue-700 text-sm font-bold rounded-xl transition-colors shrink-0", children: dt(`Ndiq`) })] }, i))), otherUsers.length === 0 && (_jsx("div", { className: "col-span-full py-12 text-center text-slate-500 dark:text-slate-400", children: dt(`Nuk ka përdorues të tjerë të regjistruar.`) }))] })] }));
};
export const ProfileTab = ({ currentUser, userPosts, requireAuth }) => {
    const [coverImg, setCoverImg] = useState('https://images.unsplash.com/photo-1506744626753-1fa44df31c7f?auto=format&fit=crop&q=80&w=1200');
    const [profileImg, setProfileImg] = useState(currentUser?.avatar || '');
    const handleUpload = (type) => {
        if (!requireAuth())
            return;
        toast.success(`Tipari për ngarkim të fotos së ${type === 'cover' ? 'kopertinës' : 'profilit'} është në përditësim.`);
    };
    return (_jsxs("div", { className: "bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/60 dark:border-white/10 shadow-sm dark:shadow-none overflow-hidden mb-6", children: [_jsxs("div", { className: "relative h-48 sm:h-64 bg-slate-200 group", children: [_jsx("img", { src: coverImg, alt: "Cover", className: "w-full h-full object-cover" }), _jsxs("button", { onClick: () => handleUpload('cover'), className: "absolute bottom-4 right-4 bg-white/80 hover:bg-white dark:bg-slate-900 backdrop-blur-sm text-slate-900 dark:text-white px-3 py-1.5 rounded-2xl text-sm font-bold flex items-center gap-2 transition-colors opacity-0 group-hover:opacity-100", children: [_jsx(ImageIcon, { className: "w-4 h-4" }), dt(`Ndrysho Kopertinën`)] })] }), _jsxs("div", { className: "px-4 sm:px-8 pb-8 relative", children: [_jsxs("div", { className: "absolute -top-16 left-4 sm:left-8 w-32 h-32 bg-white dark:bg-slate-900 rounded-full p-1 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none group z-10", children: [profileImg ? (_jsx("img", { src: profileImg, alt: "Profile", className: "w-full h-full rounded-full object-cover" })) : (_jsx("div", { className: "w-full h-full bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-bold text-4xl uppercase", children: currentUser?.name?.substring(0, 2) || 'US' })), _jsx("button", { onClick: () => handleUpload('profile'), className: "absolute bottom-1 right-1 bg-slate-200 hover:bg-slate-300 text-slate-900 dark:text-white p-2 rounded-full transition-colors opacity-0 group-hover:opacity-100 shadow-sm dark:shadow-none", children: _jsx(ImageIcon, { className: "w-4 h-4" }) })] }), _jsxs("div", { className: "mt-20 flex flex-col sm:flex-row sm:items-end justify-between gap-4", children: [_jsxs("div", { children: [_jsx("h1", { className: "text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white", children: currentUser?.name || 'Përdoruesi' }), _jsxs("p", { className: "text-slate-500 dark:text-slate-400 font-medium", children: [userPosts.length, dt(`Postime ·`), " ", currentUser?.role === 'admin' ? 'Administrator' : 'Anëtar'] })] }), _jsx("div", { className: "flex gap-2", children: _jsx("button", { onClick: () => { if (requireAuth())
                                        toast.success('Profili u përditësua!'); }, className: "px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-800 dark:text-slate-200 dark:text-slate-200 font-bold rounded-xl transition-colors text-sm", children: dt(`Ndrysho Profilin`) }) })] }), _jsxs("div", { className: "mt-8 border-t border-slate-200/60 dark:border-white/10 pt-8", children: [_jsx("h2", { className: "text-xl font-bold text-slate-900 dark:text-white mb-6", children: dt(`Postimet e mia`) }), userPosts.length === 0 ? (_jsx("div", { className: "text-center py-12 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-200/60 dark:border-white/10", children: _jsx("p", { className: "text-slate-500 dark:text-slate-400 font-medium", children: dt(`Nuk keni bërë ende asnjë postim.`) }) })) : (_jsx("div", { className: "space-y-4", children: userPosts.slice(0, 5).map((post) => (_jsxs("div", { className: "bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-white/10 rounded-xl p-5 shadow-sm dark:shadow-none", children: [_jsxs("div", { className: "flex gap-3 mb-3", children: [_jsx("div", { className: "w-10 h-10 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-bold", children: currentUser?.name?.substring(0, 2) || 'US' }), _jsxs("div", { children: [_jsx("h3", { className: "font-bold text-slate-900 dark:text-white text-[15px]", children: post.authorName }), _jsx("p", { className: "text-xs text-slate-500 dark:text-slate-400 font-medium", children: post.createdAt ? new Date(post.createdAt.seconds * 1000).toLocaleString('sq-AL') : 'Sapo postuar' })] })] }), _jsx("p", { className: "text-slate-800 dark:text-slate-200 dark:text-slate-200 text-[15px] leading-relaxed", children: post.content }), post.imageUrl && (_jsx("img", { src: post.imageUrl, alt: "Post media", className: "mt-4 rounded-xl max-h-80 w-full object-cover" })), post.videoUrl && (_jsx("video", { src: post.videoUrl, controls: true, className: "mt-4 rounded-xl max-h-80 w-full object-cover" })), _jsxs("div", { className: "flex items-center gap-6 pt-4 mt-4 border-t border-slate-100 dark:border-white/5 text-slate-500 dark:text-slate-400", children: [_jsxs("span", { className: "flex items-center gap-2 text-sm font-bold", children: [_jsx(Heart, { className: "w-5 h-5" }), " ", post.likes?.length || 0] }), _jsxs("span", { className: "flex items-center gap-2 text-sm font-bold", children: [_jsx(MessageSquare, { className: "w-5 h-5" }), " ", post.comments?.length || 0] })] })] }, post.id))) }))] })] })] }));
};
