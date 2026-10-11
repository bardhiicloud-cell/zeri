import fs from 'fs';
let content = fs.readFileSync('src/components/forum/ReelsTab.tsx', 'utf8');

// Replace newMediaUrl with newMediaFile logic
content = content.replace(
  "const [newMediaUrl, setNewMediaUrl] = useState('');",
  "const [newMediaUrl, setNewMediaUrl] = useState('');\n  const [newMediaFile, setNewMediaFile] = useState<File | null>(null);\n  const [newMusic, setNewMusic] = useState('');"
);

content = content.replace(
  /if \(!newMediaUrl\.trim\(\)\) \{([\s\S]*?)return;\n\s*\}/,
  `if (!newMediaUrl.trim() && !newMediaFile) {
      toast.error("Ju lutem ngarkoni një video ose foto");
      return;
    }`
);

content = content.replace(
  /mediaUrl: newMediaUrl,/,
  `mediaUrl: newMediaFile ? URL.createObjectURL(newMediaFile) : newMediaUrl,
        music: newMusic || 'Tingull origjinal',`
);

content = content.replace(
  /setNewMediaUrl\(''\);/,
  `setNewMediaUrl('');
      setNewMediaFile(null);
      setNewMusic('');`
);

const oldUploadUI = /<div className="space-y-2">\s*<label className="block text-sm font-bold text-white\/80">\s*URL e \{isPhoto \? 'Fotos \(JPG\/PNG\)' : 'Videos \(MP4\)'\}\s*<\/label>\s*<div className="relative">\s*<input\s*type="url"\s*value=\{newMediaUrl\}\s*onChange=\{e => setNewMediaUrl\(e\.target\.value\)\}\s*placeholder=\{`https:\/\/example\.com\/\$\{isPhoto \? 'foto\.jpg' : 'video\.mp4'\}`\}\s*className="w-full bg-white\/5 border border-white\/10 text-white rounded-xl px-4 py-3\.5 focus:outline-none focus:border-\[#fe2c55\] transition-colors"\s*\/>\s*<\/div>\s*\{newMediaUrl && isPhoto && \(\s*<div className="mt-4 rounded-xl overflow-hidden border border-white\/10 h-48 bg-black">\s*<img src=\{newMediaUrl\} alt="Preview" className="w-full h-full object-cover" onError=\{\(e\) => e\.currentTarget\.style\.display = 'none'\} \/>\s*<\/div>\s*\)\}\s*<\/div>/;

const newUploadUI = `
              <div className="space-y-2">
                <label className="block text-sm font-bold text-white/80">
                  Ngarko {isPhoto ? 'Fotografi' : 'Video'}
                </label>
                <div className="relative">
                  <label className="flex flex-col items-center justify-center w-full h-40 border-2 border-white/20 border-dashed rounded-xl cursor-pointer bg-white/5 hover:bg-white/10 transition-colors relative overflow-hidden">
                    {newMediaFile || newMediaUrl ? (
                      isPhoto ? (
                        <img src={newMediaFile ? URL.createObjectURL(newMediaFile) : newMediaUrl} alt="Preview" className="w-full h-full object-cover opacity-60" />
                      ) : (
                        <video src={newMediaFile ? URL.createObjectURL(newMediaFile) : newMediaUrl} className="w-full h-full object-cover opacity-60" />
                      )
                    ) : (
                      <div className="flex flex-col items-center justify-center pt-5 pb-6">
                        <Camera className="w-8 h-8 mb-3 text-white/40" />
                        <p className="mb-2 text-sm text-white/60"><span className="font-bold text-white">Kliko për të ngarkuar</span> ose tërhiq skedarin</p>
                      </div>
                    )}
                    <input type="file" className="hidden" accept={isPhoto ? "image/*" : "video/mp4,video/webm"} onChange={(e) => {
                      const file = e.target.files?.[0];
                      if(file) setNewMediaFile(file);
                    }} />
                  </label>
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-bold text-white/80">Muzika / Audio</label>
                <div className="relative">
                  <Music className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
                  <input 
                    type="text"
                    value={newMusic}
                    onChange={e => setNewMusic(e.target.value)}
                    placeholder="Shto një titull muzike (Opsionale)"
                    className="w-full bg-white/5 border border-white/10 text-white rounded-xl pl-12 pr-4 py-3.5 focus:outline-none focus:border-[#fe2c55] transition-colors"
                  />
                </div>
              </div>
`;

content = content.replace(oldUploadUI, newUploadUI);

// Replace disabled condition
content = content.replace("disabled={!newMediaUrl.trim()}", "disabled={!newMediaUrl.trim() && !newMediaFile}");

fs.writeFileSync('src/components/forum/ReelsTab.tsx', content);
