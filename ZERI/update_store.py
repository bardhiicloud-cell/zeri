import re

with open('src/lib/store.ts', 'r') as f:
    content = f.read()

# updateUser
content = re.sub(
    r"updateUser: \(id, user\) => set\(s => \(\{ users: s.users.map\(u => u.id === id \? \{ \.\.\.u, \.\.\.user \} : u\) \}\)\),",
    """updateUser: async (id, user) => {
        try {
          const { db } = await import('./firebase');
          const { doc, updateDoc } = await import('firebase/firestore');
          await updateDoc(doc(db, 'users', id), user);
        } catch(e) { console.error(e); }
      },""",
    content
)

# deleteUser
content = re.sub(
    r"deleteUser: \(id\) => set\(s => \(\{ users: s.users.filter\(u => u.id !== id\) \}\)\),",
    """deleteUser: async (id) => {
        try {
          const { db } = await import('./firebase');
          const { doc, deleteDoc } = await import('firebase/firestore');
          await deleteDoc(doc(db, 'users', id));
        } catch(e) { console.error(e); }
      },""",
    content
)

# banUser
content = re.sub(
    r"banUser: \(userId\) => set\(s => \(\{ users: s.users.map\(u => u.id === userId \? \{ \.\.\.u, isBanned: true \} : u\) \}\)\),",
    """banUser: async (userId) => {
        try {
          const { db } = await import('./firebase');
          const { doc, updateDoc } = await import('firebase/firestore');
          await updateDoc(doc(db, 'users', userId), { isBanned: true });
        } catch(e) { console.error(e); }
      },""",
    content
)

# adminCreateUser
content = re.sub(
    r"adminCreateUser: \(user\) => \{[^\}]+\},",
    """adminCreateUser: async (user) => {
        try {
          const { db } = await import('./firebase');
          const { doc, setDoc } = await import('firebase/firestore');
          const id = user.email.split('@')[0] + Math.random().toString(36).substr(2, 5);
          await setDoc(doc(db, 'users', id), { ...user, id });
        } catch(e) { console.error(e); }
      },""",
    content
)

# deletePoll
content = re.sub(
    r"deletePoll: \(id\) => set\(s => \(\{ polls: s.polls.filter\(p => p.id !== id\) \}\)\),",
    """deletePoll: async (id) => {
        try {
          const { db } = await import('./firebase');
          const { doc, deleteDoc } = await import('firebase/firestore');
          await deleteDoc(doc(db, 'polls', id));
        } catch(e) { console.error(e); }
      },""",
    content
)

# updatePoll
content = re.sub(
    r"updatePoll: \(id, updatedPoll\) => set\(s => \(\{ polls: s.polls.map\(p => p.id === id \? \{ \.\.\.p, \.\.\.updatedPoll \} : p\) \}\)\),",
    """updatePoll: async (id, updatedPoll) => {
        try {
          const { db } = await import('./firebase');
          const { doc, updateDoc } = await import('firebase/firestore');
          await updateDoc(doc(db, 'polls', id), updatedPoll);
        } catch(e) { console.error(e); }
      },""",
    content
)

# createPoll
content = re.sub(
    r"createPoll: \(pollParams\) => \{.*?set\(state => \(\{.*?polls: \[newPoll, \.\.\.state.polls\]\n.*?\}\)\);\n.*?\},",
    """createPoll: async (pollParams) => {
        try {
          const { db } = await import('./firebase');
          const { doc, setDoc } = await import('firebase/firestore');
          const id = Math.random().toString(36).substr(2, 9);
          const newPoll = {
            ...pollParams,
            id,
            totalVotes: 0,
            createdBy: get().currentUser?.name || 'Administrator',
            options: pollParams.options.map(opt => ({ ...opt, votes: 0 }))
          };
          await setDoc(doc(db, 'polls', id), newPoll);
        } catch(e) { console.error(e); }
      },""",
    content,
    flags=re.DOTALL
)

# votePoll
content = re.sub(
    r"votePoll: \(pollId, optionId\) => \{.*?set\(s => \(\{.*?polls: s.polls.map.*?\}\)\);\n.*?\},",
    """votePoll: async (pollId, optionId) => {
        try {
          const { db } = await import('./firebase');
          const { doc, getDoc, updateDoc } = await import('firebase/firestore');
          const pollRef = doc(db, 'polls', pollId);
          const pollSnap = await getDoc(pollRef);
          if (pollSnap.exists()) {
             const data = pollSnap.data();
             const newOptions = data.options.map((opt: any) => 
               opt.id === optionId ? { ...opt, votes: (opt.votes || 0) + 1 } : opt
             );
             await updateDoc(pollRef, {
               options: newOptions,
               totalVotes: (data.totalVotes || 0) + 1
             });
          }
        } catch(e) { console.error(e); }
      },""",
    content,
    flags=re.DOTALL
)

# addCategory
content = re.sub(
    r"addCategory: \(category\) => set\(s => \(\{ categories: \[\.\.\.s.categories, \{ \.\.\.category, id: Math.random\(\).toString\(36\).substr\(2, 9\) \}\] \}\)\),",
    """addCategory: async (category) => {
        try {
          const { db } = await import('./firebase');
          const { doc, setDoc } = await import('firebase/firestore');
          const id = Math.random().toString(36).substr(2, 9);
          await setDoc(doc(db, 'categories', id), { ...category, id });
        } catch(e) { console.error(e); }
      },""",
    content
)

# deleteCategory
content = re.sub(
    r"deleteCategory: \(id\) => set\(s => \(\{ categories: s.categories.filter\(c => c.id !== id\) \}\)\),",
    """deleteCategory: async (id) => {
        try {
          const { db } = await import('./firebase');
          const { doc, deleteDoc } = await import('firebase/firestore');
          await deleteDoc(doc(db, 'categories', id));
        } catch(e) { console.error(e); }
      },""",
    content
)

# createAd
content = re.sub(
    r"createAd: \(ad\) => set\(s => \(\{ ads: \[\{ \.\.\.ad, id: `AD-\$\{Math.random\(\).toString\(36\).substr\(2, 6\).toUpperCase\(\)\}`, views: 0, clicks: 0 \}, \.\.\.s.ads\] \}\)\),",
    """createAd: async (ad) => {
        try {
          const { db } = await import('./firebase');
          const { doc, setDoc } = await import('firebase/firestore');
          const id = `AD-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
          await setDoc(doc(db, 'ads', id), { ...ad, id, views: 0, clicks: 0 });
        } catch(e) { console.error(e); }
      },""",
    content
)

# deleteAd
content = re.sub(
    r"deleteAd: \(id\) => set\(s => \(\{ ads: s.ads.filter\(a => a.id !== id\) \}\)\),",
    """deleteAd: async (id) => {
        try {
          const { db } = await import('./firebase');
          const { doc, deleteDoc } = await import('firebase/firestore');
          await deleteDoc(doc(db, 'ads', id));
        } catch(e) { console.error(e); }
      },""",
    content
)

# updateAdStatus
content = re.sub(
    r"updateAdStatus: \(id, status\) => set\(s => \(\{ ads: s.ads.map\(a => a.id === id \? \{ \.\.\.a, status \} : a\) \}\)\),",
    """updateAdStatus: async (id, status) => {
        try {
          const { db } = await import('./firebase');
          const { doc, updateDoc } = await import('firebase/firestore');
          await updateDoc(doc(db, 'ads', id), { status });
        } catch(e) { console.error(e); }
      },""",
    content
)

# incrementAdView
content = re.sub(
    r"incrementAdView: \(id\) => set\(s => \(\{ ads: s.ads.map\(a => a.id === id \? \{ \.\.\.a, views: a.views \+ 1 \} : a\) \}\)\),",
    """incrementAdView: async (id) => {
        try {
          const { db } = await import('./firebase');
          const { doc, increment, updateDoc } = await import('firebase/firestore');
          await updateDoc(doc(db, 'ads', id), { views: increment(1) });
        } catch(e) { console.error(e); }
      },""",
    content
)

# incrementAdClick
content = re.sub(
    r"incrementAdClick: \(id\) => set\(s => \(\{ ads: s.ads.map\(a => a.id === id \? \{ \.\.\.a, clicks: a.clicks \+ 1 \} : a\) \}\)\),",
    """incrementAdClick: async (id) => {
        try {
          const { db } = await import('./firebase');
          const { doc, increment, updateDoc } = await import('firebase/firestore');
          await updateDoc(doc(db, 'ads', id), { clicks: increment(1) });
        } catch(e) { console.error(e); }
      },""",
    content
)

with open('src/lib/store.ts', 'w') as f:
    f.write(content)

