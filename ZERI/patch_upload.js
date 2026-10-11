import fs from 'fs';
let content = fs.readFileSync('src/components/forum/ReelsTab.tsx', 'utf8');

const uploadLogic = `
  const handlePostReel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!requireAuth()) return;
    if (!newMediaUrl.trim() && !newMediaFile) {
      toast.error("Ju lutem ngarkoni një video ose foto");
      return;
    }

    let finalUrl = newMediaUrl;

    if (newMediaFile) {
      if (newMediaFile.size > 1048576) { // 1MB limit for firestore document
         toast.error("Skedari është shumë i madh (Max 1MB). Për video më të mëdha përdorni URL.");
         return;
      }
      
      const toBase64 = (file: File) => new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = error => reject(error);
      });
      
      try {
        finalUrl = await toBase64(newMediaFile);
      } catch (err) {
        toast.error("Gabim gjatë leximit të skedarit.");
        return;
      }
    }

    try {
      await addDoc(collection(db, 'forumReels'), {
        author: currentUser?.name || 'Anonim',
        authorId: currentUser?.id,
        avatar: currentUser?.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100',
        mediaUrl: finalUrl,
        song: newMusic || 'Tingull origjinal',
        isPhoto: isPhoto,
        description: newDescription,
        likes: [],
        comments: [],
        sharesCount: 0,
        createdAt: serverTimestamp()
      });
`;

content = content.replace(/const handlePostReel = async \(e: React\.FormEvent\) => \{[\s\S]*?createdAt: serverTimestamp\(\)\n      \}\);/, uploadLogic.trim());

fs.writeFileSync('src/components/forum/ReelsTab.tsx', content);
