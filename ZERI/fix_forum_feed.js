import fs from 'fs';
let content = fs.readFileSync('src/pages/ForumPage.tsx', 'utf8');

const regex = /<PostFormatter[\s\S]*?setExpandedImage=\{setExpandedImage\}\n\s*\/>/;

const postHTML = `
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden mb-6">
                      <div className="p-5">
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-3 cursor-pointer" onClick={() => setProfileModalData({ isOpen: true, authorId: post.authorId, authorName: post.authorName, authorAvatar: post.authorAvatar })}>
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-slate-200 to-slate-300 overflow-hidden flex items-center justify-center font-bold text-slate-500 shadow-inner">
                              {post.authorAvatar ? <img src={post.authorAvatar} className="w-full h-full object-cover" /> : post.authorName.substring(0, 2)}
                            </div>
                            <div>
                              <div className="flex items-center gap-1.5">
                                <h3 className="font-bold text-[15px] text-slate-900 leading-none">{post.authorName}</h3>
                                {post.isAd && <span className="text-[10px] bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider border border-indigo-100">Sponsorizuar</span>}
                              </div>
                              <p className="text-[12px] text-slate-500 mt-1">{formatDate(post.createdAt)}</p>
                            </div>
                          </div>
                          {currentUser?.id === post.authorId && (
                            <button onClick={() => handleDeletePost(post.id)} className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-full transition-colors">
                              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                            </button>
                          )}
                        </div>

                        <div className="text-[15px] text-slate-800 leading-relaxed mb-4">
                          <PostFormatter content={post.content} />
                        </div>

                        {post.imageUrl && (
                          <div className="rounded-xl overflow-hidden mb-4 border border-slate-100 max-h-[400px] cursor-pointer" onClick={() => setExpandedImage(post.imageUrl)}>
                            <img src={post.imageUrl} alt="Post image" className="w-full h-full object-cover" />
                          </div>
                        )}

                        {post.isAd && post.adLink && (
                          <a href={post.adLink} target="_blank" rel="noopener noreferrer" className="block w-full py-3 mb-4 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-center font-bold text-[14px] rounded-xl transition-colors border border-indigo-200">
                            Mëso Më Shumë
                          </a>
                        )}

                        <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                          <div className="flex gap-1">
                            <button onClick={() => handleLike(post.id, post.likes || [])} className={\`flex items-center gap-2 px-4 py-2 rounded-xl transition-colors text-[14px] font-bold \${(post.likes || []).includes(currentUser?.id) ? 'bg-indigo-50 text-indigo-600' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'}\`}>
                              <svg width="20" height="20" viewBox="0 0 24 24" fill={(post.likes || []).includes(currentUser?.id) ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/></svg>
                              {post.likes?.length || 0}
                            </button>
                            <button onClick={() => setActiveCommentPost(activeCommentPost === post.id ? null : post.id)} className="flex items-center gap-2 px-4 py-2 rounded-xl transition-colors text-[14px] font-bold text-slate-500 hover:bg-slate-50 hover:text-slate-700">
                              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                              {post.comments || 0}
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Comments Section */}
                      {activeCommentPost === post.id && (
                        <div className="bg-slate-50 p-5 border-t border-slate-200">
                          <div className="flex gap-3 mb-4">
                            <div className="w-8 h-8 rounded-full bg-slate-200 overflow-hidden shrink-0 mt-1">
                               {currentUser?.avatar ? <img src={currentUser.avatar} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-xs font-bold text-slate-500">{currentUser?.name?.substring(0, 2) || 'U'}</div>}
                            </div>
                            <div className="flex-1 flex gap-2">
                              <input 
                                type="text"
                                value={newCommentContent}
                                onChange={(e) => setNewCommentContent(e.target.value)}
                                placeholder="Shkruaj një koment..."
                                className="flex-1 bg-white border border-slate-200 rounded-xl px-4 py-2 text-[14px] focus:outline-none focus:ring-2 focus:ring-indigo-500"
                              />
                              <button disabled={!newCommentContent.trim() || isPosting} onClick={() => {}} className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white p-2 rounded-xl">
                                <Send className="w-5 h-5" />
                              </button>
                            </div>
                          </div>
                          <div className="text-center text-sm text-slate-500 italic">Komentet po ngarkohen...</div>
                        </div>
                      )}
                    </div>
`;

content = content.replace(regex, postHTML);
fs.writeFileSync('src/pages/ForumPage.tsx', content);
