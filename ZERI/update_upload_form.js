import fs from 'fs';
let content = fs.readFileSync('src/components/forum/ReelsTab.tsx', 'utf8');

const regex = /<label className="block text-sm font-bold text-white\/80">Muzika \/ Audio<\/label>[\s\S]*?<\/div>\s*<\/div>/;

const replacement = `<label className="block text-sm font-bold text-white/80">Muzika / Audio</label>
                <div className="relative">
                  <Music className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
                  <select 
                    value={newMusic}
                    onChange={e => setNewMusic(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 text-white rounded-xl pl-12 pr-4 py-3.5 focus:outline-none focus:border-[#fe2c55] transition-colors font-medium appearance-none"
                  >
                    <option value="">Tingull origjinal</option>
                    {Object.entries(MUSIC_TRACKS).map(([id, track]) => (
                      <option key={id} value={id}>{track.title}</option>
                    ))}
                  </select>
                </div>
              </div>`;

content = content.replace(regex, replacement);

// We need to also add trackId to the post object
content = content.replace(/song: newMusic \|\| 'Tingull origjinal',/, "song: newMusic ? MUSIC_TRACKS[newMusic]?.title : 'Tingull origjinal',\n        trackId: newMusic || null,");

fs.writeFileSync('src/components/forum/ReelsTab.tsx', content);
