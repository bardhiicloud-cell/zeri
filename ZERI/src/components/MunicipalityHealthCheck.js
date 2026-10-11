import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { dt } from '@/src/lib/dt';
import { useStore } from '../lib/store';
import { BarChart3, FileText, CheckCircle2, ShieldAlert, Award } from 'lucide-react';
import { cn } from '../lib/utils';
export function MunicipalityHealthCheck({ selectedMunicipality }) {
    const reports = useStore(state => state.reports);
    // Filter reports according to selected municipality
    const filteredReports = reports.filter(r => !selectedMunicipality || r.location?.municipality === selectedMunicipality);
    const totalReports = filteredReports.length;
    const resolvedReports = filteredReports.filter(r => r.status === 'Resolved').length;
    const activeReports = filteredReports.filter(r => r.status !== 'Resolved' && r.status !== 'Rejected').length;
    const criticalReports = filteredReports.filter(r => r.urgency === 'Kritike' || r.urgency === 'E lartë').length;
    const currentEfficiency = totalReports > 0 ? Math.round((resolvedReports / totalReports) * 100) : 0;
    // Compute Grade
    const getGrade = (eff) => {
        if (eff >= 90)
            return 'A+';
        if (eff >= 75)
            return 'A';
        if (eff >= 60)
            return 'B';
        if (eff >= 40)
            return 'C';
        return 'D';
    };
    const getGradeText = (g) => {
        switch (g) {
            case 'A+': return 'Shkëlqyeshëm';
            case 'A': return 'Shumë Mirë';
            case 'B': return 'Mirë';
            case 'C': return 'Mjaftueshëm';
            default: return 'Kërkon Përmirësim';
        }
    };
    const grade = getGrade(currentEfficiency);
    const gradeText = getGradeText(grade);
    // Find top category
    const categoryCounts = {};
    filteredReports.forEach(r => {
        const cat = r.category || 'Infrastrukturë';
        categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
    });
    const topCategoryEntry = Object.entries(categoryCounts).sort((a, b) => b[1] - a[1])[0];
    const topCategory = topCategoryEntry ? topCategoryEntry[0] : 'Infrastrukturë';
    // Dynamic analysis text
    const muniName = selectedMunicipality || "Kosovës";
    const analysisText = totalReports > 0
        ? `Sistemi i analizës cloud tregon se për territorin e ${selectedMunicipality ? `Komunës së ${muniName}` : `gjithë Kosovës`}, janë regjistruar dhe verifikuar gjithsej ${totalReports} raste ankesash qytetare drejtpërdrejt në databazën cloud.

Prej tyre, ${resolvedReports} raste janë zgjidhur me sukses nga autoritetet përkatëse dhe ekipet e terrenit, duke sjellë një shkallë efikasiteti dhe zgjidhshmërie prej ${currentEfficiency}%.

Aktualisht, në sistem ndodhen ${activeReports} raste aktive që janë duke u trajtuar në faza të ndryshme (të alokuara për inspektorët apo në proces). Kategoria kryesore e ankesave që kërkon vëmendjen më të madhe është "${topCategory}". Gjithashtu, janë identifikuar ${criticalReports} çështje të urgjencës së lartë/kritike që kërkojnë ndërhyrje imediate mbrojtëse ose strukture rrugore.`
        : `Nuk ka ende raste të regjistruara për këtë komunë në databazën cloud. Performanca e komunës do të vlerësohet automatikisht dhe në kohë reale në momentin kur qytetarët fillojnë të raportojnë çështjet e tyre të para në këtë zonë.`;
    // Dynamic recommendations based on top category and statistics
    const getRecommendations = () => {
        if (totalReports === 0) {
            return [
                "Inkurajimi i qytetarëve për të përdorur platformën dhe raportuar problemet e para.",
                "Krijimi i fushatave sensibilizuese mbi rëndësinë e bashkëpunimit qytetar.",
                "Trajnimi i stafit komunal për të monitoruar dhe reaguar ndaj ankesave të ardhshme."
            ];
        }
        const recs = [];
        if (topCategory.toLowerCase().includes('rrug') || topCategory.toLowerCase().includes('infrastruktur')) {
            recs.push("Alokimi i menjëhershëm i buxhetit emergjent për mbulimin e gropave urbane dhe rurale.");
            recs.push("Rritja e mbikëqyrjes së kontratave të mirëmbajtjes së rrugëve nga inspektorët.");
        }
        else if (topCategory.toLowerCase().includes('ambient') || topCategory.toLowerCase().includes('mbeturin')) {
            recs.push("Shtimi i numrit të koshave publikë të mbeturinave dhe frekuencës së zbrazjes së tyre.");
            recs.push("Implementimi i gjobave të rrepta ndaj bizneseve dhe individëve që ndotin ambientin.");
        }
        else if (topCategory.toLowerCase().includes('ndriçim')) {
            recs.push("Zëvendësimi i ndriçuesve të vjetër me trupa LED me efikasitet të lartë dhe jetëgjatësi.");
            recs.push("Shtrirja e rrjetit të ndriçimit publik në zonat periferike dhe rrugët më të errëta.");
        }
        else {
            recs.push("Rritja e shpejtësisë së reagimit administrativ për ankesat e kategorisë kryesore.");
            recs.push("Koordinimi më i mirë ndërmjet drejtorisë përkatëse dhe kompanive publike komunale.");
        }
        if (criticalReports > 0) {
            recs.push("Formimi i një njësie të reagimit të shpejtë (SLA < 24h) për rastet e shënuara si kritike.");
        }
        else {
            recs.push("Ruajtja e standardit aktual të parandalimit të rreziqeve dhe çështjeve kritike mjedisore.");
        }
        recs.push("Digjitalizimi i plotë i ndarjes së rasteve për inspektorët e terrenit për të reduktuar vonesat.");
        return recs;
    };
    const recommendations = getRecommendations();
    const getGradeColor = (g) => {
        switch (g) {
            case 'A+':
            case 'A': return 'text-emerald-600 bg-emerald-50 border-emerald-200';
            case 'B': return 'text-blue-600 bg-blue-50 border-blue-200';
            case 'C': return 'text-amber-600 bg-amber-50 border-amber-200';
            default: return 'text-rose-600 bg-rose-50 border-rose-200';
        }
    };
    return (_jsxs("div", { className: "bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/60 dark:border-white/10 shadow-sm dark:shadow-none p-6 md:p-8 space-y-6 my-8", id: "municipality-health-check-widget", children: [_jsxs("div", { className: "flex flex-col sm:flex-row items-start sm:items-center justify-between border-b-2 border-slate-900 pb-4 gap-4", children: [_jsxs("div", { className: "flex items-center gap-3", children: [_jsx("div", { className: "w-10 h-10 bg-slate-900 text-white flex items-center justify-center border-2 border-slate-900 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]", children: _jsx(BarChart3, { className: "w-5 h-5 text-indigo-500" }) }), _jsxs("div", { children: [_jsxs("h2", { className: "text-xl sm:text-2xl font-bold uppercase title-serif text-slate-900 dark:text-white tracking-wide flex items-center gap-2", children: [dt(`Raporti i Shëndetit Komunal`), " ", _jsx("span", { className: "text-[10px] bg-emerald-500 text-slate-900 dark:text-white px-2 py-0.5 rounded-full font-bold", children: dt(`DATABASE CONNECTED`) })] }), _jsx("p", { className: "text-xs text-neutral-500 dark:text-slate-400 font-mono", children: dt(`RAPORT DIAGNOSTIK KRAHASUES MBI EFICASITETIN DHE SLA REALE`) })] })] }), _jsxs("div", { className: "text-right font-mono text-xs", children: [_jsxs("span", { className: "font-bold text-slate-900 dark:text-white", children: [dt(`ZONA:`), " "] }), _jsx("span", { className: "bg-slate-900 text-white px-2 py-0.5 uppercase font-bold", children: selectedMunicipality || "KOSOVA (TËRË)" })] })] }), _jsxs("div", { className: "space-y-6", children: [_jsxs("div", { className: "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4", children: [_jsxs("div", { className: cn("border-2 p-4 flex items-center justify-between shadow-sm dark:shadow-none", getGradeColor(grade)), children: [_jsxs("div", { children: [_jsx("p", { className: "text-[10px] font-mono font-bold uppercase tracking-wider opacity-75", children: dt(`Nota e Shëndetit`) }), _jsx("p", { className: "text-3xl font-bold title-serif mt-1", children: grade }), _jsx("p", { className: "text-[10px] font-bold uppercase tracking-wide opacity-80", children: gradeText })] }), _jsx(Award, { className: "w-8 h-8 opacity-40" })] }), _jsxs("div", { className: "border-2 border-slate-200/60 dark:border-white/10 bg-neutral-50 p-4 flex items-center justify-between shadow-sm dark:shadow-none text-slate-800 dark:text-slate-200 dark:text-slate-200", children: [_jsxs("div", { children: [_jsx("p", { className: "text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400", children: dt(`Zgjidhshmëria`) }), _jsxs("p", { className: "text-3xl font-bold title-serif text-slate-900 dark:text-white mt-1", children: [currentEfficiency, "%"] }), _jsxs("p", { className: "text-[10px] font-bold uppercase tracking-wide text-emerald-600", children: [resolvedReports, dt(`raste`)] })] }), _jsx(CheckCircle2, { className: "w-8 h-8 text-emerald-600 opacity-40" })] }), _jsxs("div", { className: "border-2 border-slate-200/60 dark:border-white/10 bg-neutral-50 p-4 flex items-center justify-between shadow-sm dark:shadow-none text-slate-800 dark:text-slate-200 dark:text-slate-200", children: [_jsxs("div", { children: [_jsx("p", { className: "text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400", children: dt(`Çështje Kritike`) }), _jsx("p", { className: "text-3xl font-bold title-serif text-rose-600 mt-1", children: criticalReports }), _jsx("p", { className: "text-[10px] font-bold uppercase tracking-wide text-rose-600", children: dt(`Rrezik i Lartë`) })] }), _jsx(ShieldAlert, { className: "w-8 h-8 text-rose-600 opacity-40" })] }), _jsxs("div", { className: "border-2 border-slate-200/60 dark:border-white/10 bg-neutral-50 p-4 flex items-center justify-between shadow-sm dark:shadow-none text-slate-800 dark:text-slate-200 dark:text-slate-200", children: [_jsxs("div", { children: [_jsx("p", { className: "text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400", children: dt(`Ndotësi Kryesor`) }), _jsx("p", { className: "text-sm font-bold title-serif text-slate-900 dark:text-white mt-2 uppercase truncate max-w-[150px]", children: topCategory }), _jsx("p", { className: "text-[10px] font-bold uppercase tracking-wide text-slate-400", children: dt(`Më i raportuari`) })] }), _jsx(FileText, { className: "w-8 h-8 text-blue-600 opacity-40" })] })] }), _jsxs("div", { className: "grid grid-cols-1 lg:grid-cols-12 gap-6 pt-2", children: [_jsxs("div", { className: "lg:col-span-7 bg-slate-50 dark:bg-slate-800 border-2 border-slate-900 p-6 space-y-3", children: [_jsxs("h4", { className: "font-extrabold text-slate-900 dark:text-white text-sm uppercase tracking-wider border-b-2 border-slate-900 pb-2 flex items-center gap-2", children: [_jsx(FileText, { className: "w-4 h-4 text-indigo-600" }), dt(`Diagnoza Strukturore Reale (Cloud DB)`)] }), _jsx("p", { className: "text-xs md:text-sm text-slate-700 dark:text-slate-300 leading-relaxed font-sans whitespace-pre-line", children: analysisText })] }), _jsxs("div", { className: "lg:col-span-5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/60 dark:border-white/10 p-6 space-y-4", children: [_jsxs("h4", { className: "font-extrabold text-slate-900 dark:text-white text-sm uppercase tracking-wider border-b-2 border-slate-200/60 dark:border-white/10 pb-2 flex items-center gap-2", children: [_jsx(CheckCircle2, { className: "w-4 h-4 text-emerald-600" }), dt(`Rekomandime për Komunën`)] }), _jsx("ul", { className: "space-y-3", children: recommendations.map((rec, i) => (_jsxs("li", { className: "flex gap-2 text-xs md:text-sm text-slate-500 dark:text-slate-400 leading-relaxed font-sans", children: [_jsx("span", { className: "w-5 h-5 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-[10px] shrink-0 animate-pulse", children: i + 1 }), _jsx("span", { children: rec })] }, i))) })] })] }), _jsx("div", { className: "flex justify-between items-center pt-4 border-t border-slate-200/60 dark:border-white/10", children: _jsxs("span", { className: "text-[10px] text-neutral-400 font-mono", children: [dt(`Gjeneruar në mënyrë automatike nga sistemet e databazës në kohë reale bazuar në`), " ", totalReports, dt(`raste të raportuara.`)] }) })] })] }));
}
