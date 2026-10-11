import fs from 'fs';
let content = fs.readFileSync('src/components/forum/ReelsTab.tsx', 'utf8');

const trendingMusic = `
              <div className="space-y-3">
                <label className="block text-sm font-bold text-white/80">Muzika / Audio</label>
                <div className="relative">
                  <Music className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
                  <input 
                    type="text"
                    value={newMusic}
                    onChange={e => setNewMusic(e.target.value)}
                    placeholder="Shto një titull muzike ose zgjidh më poshtë..."
                    className="w-full bg-white/5 border border-white/10 text-white rounded-xl pl-12 pr-4 py-3.5 focus:outline-none focus:border-[#fe2c55] transition-colors font-medium"
                  />
                </div>
                
                <div className="pt-2">
                  <p className="text-xs font-bold text-white/50 mb-3 uppercase tracking-wider">Tingujt në Trend (TikTok & YouTube)</p>
                  <div className="flex flex-wrap gap-2">
                    {[
                      "Original Sound - Trending",
                      "Dua Lipa - Houdini",
                      "Elvana Gjata - Pow",
                      "Dafina Zeqiri - Si Mua",
                      "Ghetto Geasy - Moti",
                      "Bebe Rexha - I'm Good",
                      "Noizy - JENA MBRET",
                      "Loredana - Intro",
                      "Epic Cinematic Background",
                      "Funny Comedy Sound"
                    ].map((song) => (
                      <button
                        key={song}
                        type="button"
                        onClick={() => setNewMusic(song)}
                        className={\`px-3 py-1.5 rounded-full text-[11px] font-bold border transition-colors flex items-center gap-1.5 \${newMusic === song ? 'bg-[#fe2c55] text-white border-[#fe2c55]' : 'bg-white/5 text-white/70 border-white/10 hover:bg-white/10'}\`}
                      >
                        <Music className="w-3 h-3" />
                        {song}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
`;

content = content.replace(/<div className="space-y-2">\s*<label className="block text-sm font-bold text-white\/80">Muzika \/ Audio<\/label>\s*<div className="relative">\s*<Music className="absolute left-4 top-1\/2 -translate-y-1\/2 w-5 h-5 text-white\/40" \/>\s*<input\s*type="text"\s*value=\{newMusic\}\s*onChange=\{e => setNewMusic\(e\.target\.value\)\}\s*placeholder="Shto një titull muzike \(Opsionale\)"\s*className="w-full bg-white\/5 border border-white\/10 text-white rounded-xl pl-12 pr-4 py-3\.5 focus:outline-none focus:border-\[#fe2c55\] transition-colors"\s*\/>\s*<\/div>\s*<\/div>/, trendingMusic);

fs.writeFileSync('src/components/forum/ReelsTab.tsx', content);
