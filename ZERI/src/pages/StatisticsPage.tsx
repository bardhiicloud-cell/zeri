import { dt } from '@/src/lib/dt';
import { AuraOrbit, AuraHero } from '../components/aura/Aura';
import React, { useMemo, useState, useEffect } from 'react';
import { useStore } from '../lib/store';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  BarChart as BarChartIcon, TrendingUp, Users, Map, CheckCircle2,
  AlertCircle, Activity, Award, PieChart as PieChartIcon, Filter, MapPin, Download, CheckSquare, Clock, FileText,
  Sparkles, ShieldCheck, Zap, ArrowUpRight, ArrowDownRight, RefreshCw, Radio, Video, MessageSquare, Search, X
} from 'lucide-react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Legend, PieChart, Pie, Cell, RadialBarChart, RadialBar
} from 'recharts';
import { KOSOVO_MUNICIPALITIES } from '../lib/constants';
import { ALL_SCOPE, isSpecificScope, scopeKey } from '../lib/municipalityScope';
import toast from 'react-hot-toast';
import AdBanner from '../components/AdBanner.tsx';
import type { Report } from '../types';
import { getReportTopic, getReportTopicLabel, getReportTopicValue, getReportTopicValueLabel, REPORT_TOPICS } from '../lib/reportTopics';

const COLORS = ['#1e3a8a', '#10b981', '#f59e0b', '#e11d48', '#0ea5e9', '#64748b', '#0f172a'];
const chartTooltipStyle: React.CSSProperties = {
  backgroundColor: 'var(--color-surface)',
  border: '1px solid var(--color-border-soft)',
  borderRadius: '12px',
  boxShadow: 'var(--shadow-floating)',
  color: 'var(--color-text)',
  fontSize: '11px',
};

type ReportAttachment = { url: string; type: 'image' | 'video'; label: string };

function escapeHtml(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character] || character);
}

function getReportAttachments(report: Report): ReportAttachment[] {
  const attachments: ReportAttachment[] = [];
  const seenUrls = new Set<string>();
  (report.media?.length
    ? report.media
    : (report.images || []).map(url => ({ url, type: 'image' as const }))
  ).forEach((item, index) => {
    if (!item.url || seenUrls.has(item.url)) return;
    seenUrls.add(item.url);
    attachments.push({ url: item.url, type: item.type, label: `Dëshmi ${index + 1}` });
  });
  if (report.resolvedImage && !seenUrls.has(report.resolvedImage)) {
    attachments.push({ url: report.resolvedImage, type: 'image', label: 'Dëshmi pas zgjidhjes' });
  }
  return attachments;
}

function formatReportDate(value?: string): string {
  if (!value) return 'Pa datë';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Pa datë' : date.toLocaleString('sq-AL');
}

async function embedMedia(url: string): Promise<string> {
  const parsedUrl = new URL(url, window.location.href);
  if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
    throw new Error('Lloji i lidhjes së medias nuk lejohet.');
  }
  const response = await fetch(parsedUrl.href);
  if (!response.ok) throw new Error(`Media u përgjigj me statusin ${response.status}.`);
  const blob = await response.blob();
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === 'string'
      ? resolve(reader.result)
      : reject(new Error('Media nuk u konvertua për eksport.'));
    reader.onerror = () => reject(reader.error || new Error('Media nuk u lexua.'));
    reader.readAsDataURL(blob);
  });
}

export default function StatisticsPage() {
  const storeReports = useStore(state => state.reports) || [];

  const userMunicipality = useStore((state) => state.userMunicipality);
  const setUserMunicipality = useStore((state) => state.setUserMunicipality);
  /**
   * The page mirrors the global scope instead of translating it into a private
   * label. It previously mapped "all" to the string 'Të gjitha' and every other
   * value to itself, which meant a municipality literally named after that word
   * — and, more often, any value the sidebar wrote in a different spelling —
   * silently widened the page back to the whole country.
   */
  const [selectedMunicipality, setSelectedMunicipality] = useState<string>(
    isSpecificScope(userMunicipality) ? scopeKey(userMunicipality) : 'Të gjitha'
  );
  const [selectedCategory, setSelectedCategory] = useState<string>('Të gjitha');
  const [timeRange, setTimeRange] = useState<string>('all');
  const [isExporting, setIsExporting] = useState(false);
  const [selectedReportIds, setSelectedReportIds] = useState<string[]>([]);
  const [reportSearch, setReportSearch] = useState('');
  const [dossierMunicipality, setDossierMunicipality] = useState('Të gjitha');
  const [dossierCategory, setDossierCategory] = useState('Të gjitha');

  useEffect(() => {
    setSelectedMunicipality(isSpecificScope(userMunicipality) ? scopeKey(userMunicipality) : 'Të gjitha');
  }, [userMunicipality]);

  const CATEGORIES = useMemo(() => {
    const observedValues = new Set(storeReports.map(getReportTopicValue));
    return ['Të gjitha', ...REPORT_TOPICS.map(topic => topic.id), ...Array.from(observedValues).filter(value => !REPORT_TOPICS.some(topic => topic.id === value))];
  }, [storeReports]);

  // Derived Aggregate Analytics & Computation
  const {
    stats,
    filteredReports,
    categoryData,
    timelineData,
    municipalityStats,
    categoryByMunicipality,
    statusData,
    urgencyData,
    weekdayData,
    comparison,
    dataCoverage,
    aiInsight
  } = useMemo(() => {

    // The time-range selector previously filtered nothing, so picking a period did
    // not change a single number on the page.
    const MS_PER_DAY = 24 * 60 * 60 * 1000;
    const RANGE_DAYS: Record<string, number> = { '7d': 7, '30d': 30, '90d': 90 };
    const rangeStart = timeRange === 'all' ? 0 : Date.now() - (RANGE_DAYS[timeRange] ?? 0) * MS_PER_DAY;

    // 1. Filter reports based on selected filters
    const filteredReports = storeReports.filter(r => {
      const matchMuni = selectedMunicipality === 'Të gjitha' ||
        (r.location?.municipality && scopeKey(r.location.municipality) === scopeKey(selectedMunicipality));
      const matchCat = selectedCategory === 'Të gjitha' || getReportTopicValue(r) === selectedCategory;
      if (!matchMuni || !matchCat) return false;
      if (rangeStart === 0) return true;
      const createdAt = new Date(r.createdAt).getTime();
      return Number.isFinite(createdAt) && createdAt >= rangeStart;
    });

    const totalR = filteredReports.length;
    const resolvedR = filteredReports.filter(r => r.status === 'Resolved').length;
    const pendingR = filteredReports.filter(r => r.status === 'Pending Review').length;
    const inProgressR = totalR - resolvedR - pendingR;
    const urgentR = filteredReports.filter(r => r.urgency === 'Kritike' || r.urgency === 'E lartë').length;
    const periodDays = RANGE_DAYS[timeRange] ?? 0;
    const previousStart = rangeStart - periodDays * MS_PER_DAY;
    const previousReports = periodDays > 0
      ? storeReports.filter(r => {
          const matchMuni = selectedMunicipality === 'Të gjitha' ||
            (r.location?.municipality && scopeKey(r.location.municipality) === scopeKey(selectedMunicipality));
          const matchCat = selectedCategory === 'Të gjitha' || getReportTopicValue(r) === selectedCategory;
          const createdAt = new Date(r.createdAt).getTime();
          return matchMuni && matchCat && Number.isFinite(createdAt) &&
            createdAt >= previousStart && createdAt < rangeStart;
        })
      : [];
    const previousTotal = previousReports.length;
    const reportChange = previousTotal > 0
      ? Math.round(((totalR - previousTotal) / previousTotal) * 100)
      : totalR > 0 && periodDays > 0 ? null : 0;

    // Measured from real timestamps instead of the previously hard-coded '1.2 ditë'.
    const resolutionDays = filteredReports
      .filter(r => r.status === 'Resolved' && r.updatedAt)
      .map(r => (new Date(r.updatedAt as string).getTime() - new Date(r.createdAt).getTime()) / MS_PER_DAY)
      .filter(days => Number.isFinite(days) && days > 0);
    const avgResolutionDays = resolutionDays.length > 0
      ? (resolutionDays.reduce((sum, days) => sum + days, 0) / resolutionDays.length).toFixed(1)
      : 'N/A';

    // 2. Aggregate per municipality
    const muniMap = new globalThis.Map<string, any>();
    KOSOVO_MUNICIPALITIES.forEach(m => {
      if (selectedMunicipality === 'Të gjitha' || m === selectedMunicipality) {
        muniMap.set(m, { total: 0, resolved: 0, pending: 0, inProgress: 0, categoryCounts: {} });
      }
    });

    filteredReports.forEach(r => {
      const m = r.location?.municipality;
      if (m && muniMap.has(m)) {
        const data = muniMap.get(m);
        data.total++;
        if (r.status === 'Resolved') data.resolved++;
        else if (r.status === 'Pending Review') data.pending++;
        else data.inProgress++;

        const topicValue = getReportTopicValue(r);
        data.categoryCounts[topicValue] = (data.categoryCounts[topicValue] || 0) + 1;
      }
    });

    let mStats = Array.from(muniMap.entries())
      .filter(([_, data]) => data.total > 0)
      .map(([municipality, data]) => {
        const rate = Math.round((data.resolved / Math.max(data.total, 1)) * 100);

        // Find top category
        let topCategory = 'N/A';
        let maxCount = 0;
        Object.entries(data.categoryCounts).forEach(([cat, count]) => {
          if ((count as number) > maxCount) {
            maxCount = count as number;
            topCategory = getReportTopicValueLabel(cat);
          }
        });

        return {
          municipality,
          total: data.total,
          resolved: data.resolved,
          pending: data.pending,
          inProgress: data.inProgress,
          urgent: filteredReports.filter(r =>
            r.location?.municipality &&
            scopeKey(r.location.municipality) === scopeKey(municipality) &&
            (r.urgency === 'Kritike' || r.urgency === 'E lartë')
          ).length,
          rate,
          avgDays: (() => {
            // Real computation of resolution time based on created and updated timestamps
            const resolvedReportsInMuni = filteredReports.filter(r =>
              r.location?.municipality &&
              scopeKey(r.location.municipality) === scopeKey(municipality) &&
              r.status === 'Resolved'
            );
            if (resolvedReportsInMuni.length === 0) return 'N/A';

            let totalDays = 0;
            let validReports = 0;
            resolvedReportsInMuni.forEach(r => {
              if (r.createdAt && r.updatedAt) {
                 const created = new Date(r.createdAt).getTime();
                 const resolved = new Date(r.updatedAt).getTime();
                 if (resolved > created) {
                    totalDays += (resolved - created) / (1000 * 60 * 60 * 24);
                    validReports++;
                 }
              }
            });
            return validReports > 0 ? (totalDays / validReports).toFixed(1) : 'N/A';
          })(),
          topCategory,
          status: rate >= 80 ? 'Lartë (Përmbush Standards)' : 'Mesatare (Nën Objektiv)',
          categoryCounts: data.categoryCounts
        };
      })
      .sort((a, b) => b.total - a.total);

    // 3. Category Distribution
    const categoryDistributionMap: Record<string, number> = {};
    filteredReports.forEach(r => {
      const topicValue = getReportTopicValue(r);
      categoryDistributionMap[topicValue] = (categoryDistributionMap[topicValue] || 0) + 1;
    });

    const catData = Object.entries(categoryDistributionMap)
      .map(([valueKey, value]) => ({ name: getReportTopicValueLabel(valueKey), value, topicValue: valueKey }))
      .sort((a, b) => b.value - a.value);

    // 4. Timeline Generation (Real Data from Timestamps)
    const timelineDays = timeRange === 'all' ? 14 : (RANGE_DAYS[timeRange] ?? 14);
    const tDataMap: Record<string, { new: number, resolved: number }> = {};
    for (let i = timelineDays - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dayName = d.toLocaleDateString('sq-AL', { month: 'short', day: 'numeric' });
      tDataMap[dayName] = { new: 0, resolved: 0 };
    }

    filteredReports.forEach(r => {
      const createdAt = new Date(r.createdAt).getTime();
      if (Number.isFinite(createdAt)) {
        const dayName = new Date(createdAt).toLocaleDateString('sq-AL', { month: 'short', day: 'numeric' });
        if (tDataMap[dayName]) tDataMap[dayName].new++;
      }
      if (r.status === 'Resolved' && r.updatedAt) {
        const resolvedAt = new Date(r.updatedAt as string).getTime();
        if (Number.isFinite(resolvedAt)) {
          const dayName = new Date(resolvedAt).toLocaleDateString('sq-AL', { month: 'short', day: 'numeric' });
          if (tDataMap[dayName]) tDataMap[dayName].resolved++;
        }
      }
    });

    const tData = Object.entries(tDataMap).map(([date, counts]) => ({
      date,
      'Raportime të Reja': counts.new,
      'Të Zgjidhura': counts.resolved
    }));

    const statusBreakdown = [
      { name: 'Të zgjidhura', value: resolvedR },
      { name: 'Në trajtim', value: inProgressR },
      { name: 'Në shqyrtim', value: pendingR },
    ];
    const urgencyBreakdown = [
      { name: 'Kritike', value: filteredReports.filter(r => r.urgency === 'Kritike').length },
      { name: 'E lartë', value: filteredReports.filter(r => r.urgency === 'E lartë').length },
      { name: 'Mesatare', value: filteredReports.filter(r => r.urgency === 'Mesatare').length },
      { name: 'E ulët', value: filteredReports.filter(r => r.urgency === 'E ulët').length },
    ];
    const weekdayNames = ['Hënë', 'Martë', 'Mërkurë', 'Enjte', 'Premte', 'Shtunë', 'Diel'];
    const weekdayCounts = weekdayNames.map(name => ({ name, value: 0 }));
    filteredReports.forEach(report => {
      const createdAt = new Date(report.createdAt);
      if (!Number.isFinite(createdAt.getTime())) return;
      const mondayFirstIndex = (createdAt.getDay() + 6) % 7;
      weekdayCounts[mondayFirstIndex].value++;
    });

    // 5. Stacked Bar Matrix for Top Municipalities
    const catByMuniData = mStats.slice(0, 7).map(m => {
      const dataObj: any = { name: m.municipality };
      catData.slice(0, 6).forEach(category => {
        dataObj[category.topicValue] = m.categoryCounts[category.topicValue] || 0;
      });
      return dataObj;
    });

    const resRate = totalR > 0 ? Math.round((resolvedR / totalR) * 100) : 0;
    const contributors = new Set(filteredReports.map(report => report.authorId).filter(Boolean)).size;

    const today = new Date().toLocaleDateString('sq-AL', { day: 'numeric', month: 'long', year: 'numeric' });
    const aiText = totalR > 0
      ? `Përmbledhje automatike · ${today}: në këtë pamje ka ${totalR.toLocaleString('sq-AL')} raportime. Shkalla e zgjidhjes është ${resRate}%. ${mStats.length > 0 ? `${mStats[0].municipality} ka vëllimin më të madh me ${mStats[0].total} raportime; kategoria më e shpeshtë është “${mStats[0].topCategory}”.` : ''}`
      : `Nuk ka raportime që përputhen me filtrat e zgjedhur. Ndryshoni periudhën, kategorinë ose komunën për të parë të dhënat përkatëse.`;

    return {
      stats: {
        totalReports: totalR,
        resolvedReports: resolvedR,
        inProgressReports: inProgressR,
        pendingReports: pendingR,
        rate: resRate,
        urgentReports: urgentR,
        avgDays: avgResolutionDays === 'N/A' ? 'N/A' : `${avgResolutionDays} ditë`,
        contributors,
        assignedReports: filteredReports.filter(report => Boolean(report.assignedTo?.trim())).length,
        reportsWithMunicipality: filteredReports.filter(report => Boolean(report.location?.municipality)).length,
        reportsWithDescription: filteredReports.filter(report => Boolean(report.description?.trim())).length,
      },
      filteredReports,
      categoryData: catData,
      timelineData: tData,
      municipalityStats: mStats,
      categoryByMunicipality: catByMuniData,
      statusData: statusBreakdown,
      urgencyData: urgencyBreakdown,
      weekdayData: weekdayCounts,
      comparison: {
        previousTotal,
        change: reportChange,
        periodDays,
      },
      dataCoverage: {
        assigned: totalR > 0 ? Math.round((filteredReports.filter(report => Boolean(report.assignedTo?.trim())).length / totalR) * 100) : 0,
        municipality: totalR > 0 ? Math.round((filteredReports.filter(report => Boolean(report.location?.municipality)).length / totalR) * 100) : 0,
        description: totalR > 0 ? Math.round((filteredReports.filter(report => Boolean(report.description?.trim())).length / totalR) * 100) : 0,
      },
      aiInsight: aiText
    };
  }, [storeReports, selectedMunicipality, selectedCategory, timeRange]);

  const selectableReports = useMemo(() => {
    const query = reportSearch.trim().toLocaleLowerCase('sq-AL');
    return filteredReports
      .filter(report =>
        (dossierMunicipality === 'Të gjitha' ||
          scopeKey(report.location?.municipality || '') === scopeKey(dossierMunicipality)) &&
        (dossierCategory === 'Të gjitha' || getReportTopicValue(report) === dossierCategory)
      )
      .filter(report => !query || [
        report.title,
        report.description,
        report.category,
        getReportTopicValueLabel(getReportTopicValue(report)),
        report.location?.municipality,
        report.location?.address,
        report.trackingId,
      ].some(value => value?.toLocaleLowerCase('sq-AL').includes(query)))
      .sort((first, second) => new Date(second.createdAt).getTime() - new Date(first.createdAt).getTime());
  }, [filteredReports, dossierMunicipality, dossierCategory, reportSearch]);

  const selectedReports = useMemo(() => {
    const selectedIds = new Set(selectedReportIds);
    return selectableReports.filter(report => selectedIds.has(report.id));
  }, [selectableReports, selectedReportIds]);

  useEffect(() => {
    const visibleIds = new Set(selectableReports.map(report => report.id));
    setSelectedReportIds(current => current.filter(id => visibleIds.has(id)));
  }, [selectableReports]);

  const toggleReportSelection = (reportId: string) => {
    setSelectedReportIds(current => current.includes(reportId)
      ? current.filter(id => id !== reportId)
      : [...current, reportId]);
  };

  const toggleVisibleReports = () => {
    const visibleIds = selectableReports.map(report => report.id);
    const allVisibleSelected = visibleIds.length > 0 && visibleIds.every(id => selectedReportIds.includes(id));
    setSelectedReportIds(current => allVisibleSelected
      ? current.filter(id => !visibleIds.includes(id))
      : Array.from(new Set([...current, ...visibleIds])));
  };

  const handleDownloadSelectedReports = async () => {
    if (selectedReports.length === 0) {
      toast.error('Zgjidh së paku një raportim për dosjen.');
      return;
    }

    setIsExporting(true);
    try {
      let mediaFailures = 0;
      const reportSections = await Promise.all(selectedReports.map(async report => {
        const attachments = await Promise.all(getReportAttachments(report).map(async attachment => {
          try {
            const embeddedUrl = await embedMedia(attachment.url);
            const mediaElement = attachment.type === 'video'
              ? `<video controls preload="metadata" src="${escapeHtml(embeddedUrl)}"></video>`
              : `<img loading="lazy" src="${escapeHtml(embeddedUrl)}" alt="${escapeHtml(attachment.label)}">`;
            return `<figure>${mediaElement}<figcaption>${escapeHtml(attachment.label)}</figcaption></figure>`;
          } catch (error) {
            mediaFailures += 1;
            console.error(`Media e raportimit ${report.trackingId || report.id} nuk u përfshi në dosje:`, error);
            return `<figure class="unavailable"><a href="${escapeHtml(attachment.url)}" target="_blank" rel="noopener noreferrer">Hap ${escapeHtml(attachment.label)}</a><figcaption>Nuk mund të përfshihej në skedarin offline; hape lidhjen me internet.</figcaption></figure>`;
          }
        }));

        const status = report.status || 'E panjohur';
        const location = [report.location?.municipality, report.location?.address].filter(Boolean).join(' · ') || 'Pa vendndodhje';
        const timeline = (report.timeline || []).map(event =>
          `<li><strong>${escapeHtml(event.status)}</strong><span>${escapeHtml(formatReportDate(event.date))}</span>${event.comment ? `<p>${escapeHtml(event.comment)}</p>` : ''}</li>`
        ).join('');
        const meta = [
          ['Track ID', report.trackingId || report.id],
          ['Statusi', status],
          ['Urgjenca', report.urgency],
          ['Tema', getReportTopic(report) ? `${getReportTopic(report)?.icon} ${getReportTopic(report)?.label}` : 'Pa temë të klasifikuar'],
          ['Sektori / institucioni', report.category],
          ['Komuna / adresa', location],
          ['Raportuar më', formatReportDate(report.createdAt)],
          ['Përditësuar më', formatReportDate(report.updatedAt)],
          ['Institucioni përgjegjës', report.responsibleInstitution || 'Nuk është caktuar'],
          ['Zyra përgjegjëse', report.responsibleOffice || report.assignedTo || 'Nuk është caktuar'],
          ['Afati i përgjigjes', formatReportDate(report.responseDueAt)],
          ['Përgjegjësia', report.accountabilityStatus || 'Pa status të veçantë'],
          ['Pëlqime / komente', `${report.upvotes || 0} / ${report.commentsCount || 0}`],
          ['Raportuesi', report.isAnonymous ? 'Anonim' : report.authorName || 'Pa emër publik'],
          ['Identifikuesi i regjistrimit', report.id],
          ['Vlerësimi automatik', report.aiSeverity || 'Nuk ka vlerësim'],
          ['Etiketat', report.aiTags?.join(', ') || 'Nuk ka etiketa'],
        ].map(([label, value]) => `<div class="meta"><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`).join('');

        return `<article class="report">
          <header><p class="eyebrow">DOSJE RAPORTIMI · ZËRI QYTETARËVE</p><h2>${escapeHtml(report.title || 'Raportim pa titull')}</h2><p class="summary">${escapeHtml(report.aiSummary || '')}</p></header>
          <dl class="metadata">${meta}</dl>
          <section><h3>Përshkrimi i plotë</h3><p class="description">${escapeHtml(report.description || 'Nuk ka përshkrim.')}</p></section>
          ${attachments.length ? `<section><h3>Fotot dhe videot (${attachments.length})</h3><div class="media">${attachments.join('')}</div></section>` : '<section><h3>Fotot dhe videot</h3><p class="muted">Nuk ka media të bashkëngjitura.</p></section>'}
          ${timeline ? `<section><h3>Historiku i raportimit</h3><ol class="timeline">${timeline}</ol></section>` : ''}
        </article>`;
      }));

      const generatedAt = new Date().toLocaleString('sq-AL');
      const html = `<!doctype html><html lang="sq"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Dosja e raportimeve · Zëri Qytetarëve</title>
        <style>
          :root{font-family:Arial,Helvetica,sans-serif;color:#172033;background:#eef3f8}*{box-sizing:border-box}body{margin:0;padding:32px}.page{max-width:1000px;margin:auto}.brand{padding:30px;border-radius:20px;background:#0f2a44;color:#fff}.brand h1{margin:0 0 8px;font-size:30px}.brand p{margin:0;color:#cbd5e1}.report{margin:24px 0;padding:28px;border:1px solid #d9e2ec;border-radius:18px;background:#fff;break-inside:avoid}.eyebrow{font-size:11px;font-weight:bold;letter-spacing:.15em;color:#2563eb}.report h2{margin:8px 0 18px;font-size:25px}.summary{color:#475569}.metadata{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin:20px 0}.meta{padding:12px;border:1px solid #e2e8f0;border-radius:10px}.meta dt{font-size:10px;font-weight:bold;text-transform:uppercase;color:#64748b}.meta dd{margin:5px 0 0;overflow-wrap:anywhere;font-size:13px;font-weight:600}.report section{margin-top:22px}.report h3{margin:0 0 10px;font-size:16px}.description{white-space:pre-wrap;line-height:1.65}.media{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px}.media figure{margin:0;padding:10px;border:1px solid #e2e8f0;border-radius:12px}.media img,.media video{display:block;width:100%;max-height:480px;object-fit:contain;background:#0f172a;border-radius:8px}.media figcaption{margin-top:8px;font-size:12px;color:#475569}.unavailable{background:#fff7ed}.timeline{padding-left:22px}.timeline li{margin:12px 0;padding-left:4px}.timeline li span{margin-left:10px;color:#64748b;font-size:12px}.muted,footer{color:#64748b}.report footer{margin-top:20px;border-top:1px solid #e2e8f0;padding-top:12px;font-size:11px}@media(max-width:620px){body{padding:12px}.report{padding:18px}.metadata{grid-template-columns:1fr}.brand h1{font-size:24px}}@media print{body{padding:0;background:#fff}.brand,.report{border-radius:0}.report{margin:0 0 16px;box-shadow:none}.report header,.report section{break-inside:avoid}a{color:#1d4ed8}}
        </style></head><body><main class="page"><header class="brand"><h1>Dosja e raportimeve</h1><p>Zëri Qytetarëve · ${selectedReports.length} raportim(e) · Gjeneruar më ${escapeHtml(generatedAt)}</p><p>Dokument për informim dhe përcjellje. Informacioni pasqyron të dhënat e dukshme në platformë në momentin e shkarkimit.</p></header>
        ${reportSections.join('')}<footer>Gjeneruar nga Zëri Qytetarëve · Në shfletues, përdor Printo → Ruaj si PDF për kopje PDF.</footer></main></body></html>`;
      const url = URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `Zeri-Qytetareve-Dosje-Raportimesh-${new Date().toISOString().slice(0, 10)}.html`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast.success(mediaFailures
        ? `Dosja u shkarkua; ${mediaFailures} media nuk u përfshi offline dhe ka lidhje për t’u hapur.`
        : `Dosja e ${selectedReports.length} raportimeve u shkarkua me tekst dhe media.`);
    } catch (error) {
      console.error('Dosja e raportimeve nuk u shkarkua:', error);
      toast.error(error instanceof Error ? `Shkarkimi dështoi: ${error.message}` : 'Dosja nuk u shkarkua.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="page-shell w-full bg-(--color-page) dark:bg-(--color-brand-dark) min-h-screen pb-20 font-sans text-[var(--color-text)] dark:text-white dark:text-slate-100 transition-colors">
      <div className="mx-auto max-w-[1440px] px-4 py-6 sm:px-6 md:py-10 lg:px-8">

        <div className="mb-6">
          <AuraHero visual={<AuraOrbit core={Activity} />} tone="teal" eyebrow={dt(`Analitika e pjesëmarrjes qytetare`)} icon={Activity}
            title={dt(`Statistikat & Analitika`)}
            subtitle={dt(`Një pasqyrë e matshme e raportimeve, zgjidhjeve dhe nevojave sipas komunës. Çdo shifër tregon çfarë numërohet dhe në cilin filtër.`)} />
        </div>
        {/* Filter toolbar */}
        <div className="au-tile relative mb-7 p-4 sm:p-5">
          {/* Interactive Filters Bar */}
          <div className="relative grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="relative">
              <label className="text-[11px] font-black text-[var(--color-text-muted)] uppercase tracking-widest mb-1.5 block">{dt(`Filtro Komunën`)}</label>
              <div className="relative">
                <select
                  value={selectedMunicipality}
                  onChange={e => {
                    const value = e.target.value;
                    setSelectedMunicipality(value);
                    // Choosing here also sets the platform scope, so leaving for
                    // the map or the forum keeps this selection instead of
                    // snapping back to whatever was set before.
                    setUserMunicipality(value === 'Të gjitha' ? ALL_SCOPE : value);
                  }}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200/60 dark:border-white/10 text-[var(--color-text)] dark:text-white text-xs font-bold rounded-2xl px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 appearance-none shadow-sm dark:shadow-none"
                >
                  <option value="Të gjitha">{dt(`Të Gjitha Komunat (Kosovë)`)}</option>
                  {KOSOVO_MUNICIPALITIES.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
                <MapPin className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)] pointer-events-none" />
              </div>
            </div>

            <div className="relative">
              <label className="text-[11px] font-black text-[var(--color-text-muted)] uppercase tracking-widest mb-1.5 block">{dt(`Kategoria e Problemit`)}</label>
              <div className="relative">
                <select 
                  value={selectedCategory} 
                  onChange={e => setSelectedCategory(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200/60 dark:border-white/10 text-[var(--color-text)] dark:text-white text-xs font-bold rounded-2xl px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 appearance-none shadow-sm dark:shadow-none"
                >
                  {CATEGORIES.map(c => <option key={c} value={c}>{c === 'Të gjitha' ? c : getReportTopicValueLabel(c)}</option>)}
                </select>
                <Filter className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)] pointer-events-none" />
              </div>
            </div>

            <div className="relative">
              <label className="text-[11px] font-black text-[var(--color-text-muted)] uppercase tracking-widest mb-1.5 block">{dt(`Periudha Kohore`)}</label>
              <div className="relative">
                <select 
                  value={timeRange} 
                  onChange={e => setTimeRange(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200/60 dark:border-white/10 text-[var(--color-text)] dark:text-white text-xs font-bold rounded-2xl px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 appearance-none shadow-sm dark:shadow-none"
                >
                  <option value="all">{dt(`E gjithë koha`)}</option>
                  <option value="7d">{dt(`7 Ditët e Fundit`)}</option>
                  <option value="30d">{dt(`30 Ditët e Fundit`)}</option>
                  <option value="90d">{dt(`3 Muajt e Fundit`)}</option>
                </select>
                <Clock className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)] pointer-events-none" />
              </div>
            </div>
          </div>
        </div>

        {/* AI Insight Summary Banner */}
        <div className="mb-8 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-[2rem] p-[var(--spacing-6)] text-white shadow-xl border border-indigo-900/40 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 relative z-10">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shrink-0 shadow-[0_20px_40px_-10px_rgba(0,0,0,0.08)] shadow-blue-500/30">
                <Sparkles className="w-6 h-6 text-white" />
              </div>
              <div>
                    <div className="mb-1 flex items-center gap-2">
                      <span className="text-[11px] font-black uppercase tracking-widest text-cyan-300">{dt(`Përmbledhje e të dhënave`)}</span>
                      <span className="rounded-full border border-white/15 bg-white/10 px-2 py-0.5 text-[11px] font-black uppercase text-slate-200">{dt(`Llogaritur nga filtrat`)}</span>
                </div>
                <p className="text-sm text-slate-200 font-medium leading-relaxed max-w-4xl">
                  {aiInsight}
                </p>
              </div>
            </div>
            <div className="shrink-0 rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-center backdrop-blur-md">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-300">{dt(`Komuna në pamje`)}</p>
              <p className="text-lg font-black text-cyan-200">{selectedMunicipality === 'Të gjitha' ? '38' : '1'}</p>
            </div>
          </div>
        </div>

        {/*
          Executive KPI row: the four counters that used to sit on the home page
          (Raportime / Në trajtim / Të zgjidhura / Urgjente) plus two derived rates.
        */}
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-[var(--spacing-6)] mb-8">
          {[
            { label: 'Raportime', value: stats.totalReports.toLocaleString('sq-AL'), note: 'Në datasetin e filtruar', icon: FileText, color: 'text-blue-600 dark:text-blue-300' },
            { label: 'Në Trajtim', value: stats.inProgressReports.toLocaleString('sq-AL'), note: 'Raste aktive', icon: Activity, color: 'text-amber-500 dark:text-amber-300' },
            { label: 'Të Zgjidhura', value: stats.resolvedReports.toLocaleString('sq-AL'), note: 'Të përfunduara', icon: CheckCircle2, color: 'text-emerald-600 dark:text-emerald-300' },
            { label: 'Urgjente', value: stats.urgentReports.toLocaleString('sq-AL'), note: 'Kërkojnë vëmendje', icon: AlertCircle, color: 'text-rose-600 dark:text-rose-300' },
            { label: 'Shkalla e Zgjidhjes', value: `${stats.rate}%`, note: 'Nga filtrat aktualë', icon: TrendingUp, color: 'text-indigo-600 dark:text-indigo-300' },
            { label: 'Koha Mesatare', value: stats.avgDays, note: 'Deri në zgjidhje', icon: Clock, color: 'text-slate-600 dark:text-slate-300' },
            { label: 'Të Caktuara', value: stats.assignedReports.toLocaleString('sq-AL'), note: 'Me përgjegjës të caktuar', icon: CheckSquare, color: 'text-cyan-600 dark:text-cyan-300' },
            { label: 'Ndryshimi i Raportimeve', value: comparison.periodDays
              ? comparison.change === null ? 'N/A' : `${comparison.change > 0 ? '+' : ''}${comparison.change}%`
              : '—',
              note: comparison.periodDays ? `Krahasuar me ${comparison.periodDays} ditët paraprake` : 'Zgjidh 7, 30 ose 90 ditë për krahasim',
              icon: comparison.change !== null && comparison.change < 0 ? ArrowDownRight : ArrowUpRight,
              color: comparison.change !== null && comparison.change < 0 ? 'text-emerald-600 dark:text-emerald-300' : 'text-violet-600 dark:text-violet-300' }
          ].map((kpi, i) => (
            <motion.div 
              key={kpi.label} 
              initial={{ opacity: 0, y: 15 }} 
              animate={{ opacity: 1, y: 0 }} 
              transition={{ delay: i * 0.08 }} 
              className="rounded-[1.5rem] border border-slate-200/70 bg-white p-4 shadow-[0_18px_50px_-38px_rgba(15,23,42,0.5)] transition-all hover:-translate-y-0.5 hover:shadow-lg dark:border-white/10 dark:bg-slate-900 dark:hover:border-blue-300/30 dark:hover:shadow-[0_16px_38px_-20px_rgba(0,0,0,0.75)] sm:p-5"
            >
              <div className={`mb-4 inline-flex p-3 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-white/5 ${kpi.color}`}>
                <kpi.icon className="w-5 h-5" />
              </div>
              <p className="text-[11px] font-black uppercase tracking-widest text-[var(--color-text-muted)] mb-1">{kpi.label}</p>
              <p className={`text-3xl md:text-4xl font-black tracking-tight title-serif ${kpi.color}`}>{kpi.value}</p>
              <p className="mt-2 text-xs font-bold text-[var(--color-text-muted)]">{kpi.note}</p>
            </motion.div>
          ))}
        </div>

        {/* Honest data scope summary: these counts describe this filtered report set. */}
        <div className="mb-8 flex flex-col gap-5 rounded-[2rem] border border-slate-800 bg-slate-950 p-5 text-white shadow-xl shadow-slate-950/10 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-cyan-300/20 bg-cyan-300/10 text-cyan-300">
              <Radio className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black uppercase tracking-widest text-cyan-300">{dt(`Shtrirja e kësaj pamjeje`)}</span>
              </div>
              <p className="mt-1 max-w-xl text-xs font-medium leading-relaxed text-slate-300">{dt(`Numrat më poshtë përfaqësojnë raportimet që janë ngarkuar në këtë pamje dhe ndikohen nga filtrat sipër.`)}</p>
            </div>
          </div>

          <div className="grid w-full grid-cols-2 gap-3 md:w-auto md:min-w-[20rem]">
            <div className="rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-center">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{dt(`Raportime`)}</p>
              <p className="text-xl font-black text-white">{stats.totalReports.toLocaleString('sq-AL')}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-center">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{dt(`Kontribuues`)}</p>
              <p className="text-xl font-black text-cyan-300">{stats.contributors.toLocaleString('sq-AL')}</p>
            </div>
          </div>
        </div>

        {/* Charts & Analytical Visualizations */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-[var(--spacing-6)] mb-8">
          
          {/* Main Area Chart: Timeline Trend */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-[var(--spacing-6)] border border-slate-200/60 dark:border-white/10 shadow-sm dark:shadow-none">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-6">
                <div>
                  <h2 className="text-base font-black text-[var(--color-text)] dark:text-white uppercase tracking-wider">{dt(`Trendi i Raportimeve & Zgjidhjeve`)}</h2>
                  <p className="text-xs text-[var(--color-text-muted)] dark:text-[var(--color-text-muted)] font-medium">
                    {dt(`Raportime të reja dhe të zgjidhura · `)}{timeRange === 'all' ? '14' : timeRange.replace('d', '')} {dt(`ditët e fundit`)}
                  </p>
                </div>
                <div className="flex items-center gap-4 text-xs font-bold">
                  <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-blue-500"/>{dt(`Raportime`)}</div>
                  <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-emerald-500"/>{dt(`Të Zgjidhura`)}</div>
                </div>
              </div>
              <div className="h-[320px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={timelineData}>
                    <defs>
                      <linearGradient id="colorReports" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.35}/>
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorResolved" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.35}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-soft)" vertical={false} />
                    <XAxis dataKey="date" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={chartTooltipStyle} labelStyle={{ color: 'var(--color-text)' }} itemStyle={{ color: 'var(--color-text)' }} />
                    <Area type="monotone" dataKey="Raportime të Reja" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorReports)" />
                    <Area type="monotone" dataKey="Të Zgjidhura" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorResolved)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Stacked Bar Chart by Municipality */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-[var(--spacing-6)] border border-slate-200/60 dark:border-white/10 shadow-sm dark:shadow-none">
              <div className="mb-6">
                <h2 className="text-base font-black text-[var(--color-text)] dark:text-white uppercase tracking-wider">{dt(`Sektorët Problemorë sipas Komunave Kryesore`)}</h2>
                <p className="text-xs text-[var(--color-text-muted)] dark:text-[var(--color-text-muted)] font-medium">{dt(`Ndarja e kategorive në 7 qendrat më të mëdha urbane`)}</p>
              </div>
              <div className="h-[320px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={categoryByMunicipality} margin={{ top: 20, right: 0, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-soft)" vertical={false} />
                    <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={chartTooltipStyle} labelStyle={{ color: 'var(--color-text)' }} itemStyle={{ color: 'var(--color-text)' }} />
                    <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '12px' }} />
                    {categoryData.slice(0, 6).map((category, index) => (
                      <Bar key={category.topicValue} dataKey={category.topicValue} name={category.name} stackId="a" fill={COLORS[index % COLORS.length]} radius={index === Math.min(categoryData.length, 6) - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]} />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Right Column: Donut Breakdown & Citizen Engagement */}
          <div className="space-y-6">
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-[var(--spacing-6)] border border-slate-200/60 dark:border-white/10 shadow-sm dark:shadow-none">
              <h2 className="text-base font-black text-[var(--color-text)] dark:text-white uppercase tracking-wider mb-4">{dt(`Ndarja sipas Kategorive`)}</h2>
              <div className="h-[210px] relative">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={categoryData} cx="50%" cy="50%" innerRadius={60} outerRadius={85} paddingAngle={3} dataKey="value" stroke="none">
                      {categoryData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={chartTooltipStyle} labelStyle={{ color: 'var(--color-text)' }} itemStyle={{ color: 'var(--color-text)' }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none flex-col">
                  <span className="text-2xl font-black text-[var(--color-text)] dark:text-white">{stats.totalReports.toLocaleString('sq-AL')}</span>
                  <span className="text-[11px] uppercase font-bold text-[var(--color-text-muted)]">{dt(`Totali`)}</span>
                </div>
              </div>
              
              <div className="mt-4 space-y-2.5 max-h-[190px] overflow-y-auto pr-1 hide-scrollbar">
                {categoryData.map((cat, i) => (
                  <div key={i} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                      <span className="font-semibold text-slate-700 dark:text-[var(--color-text-muted)] truncate max-w-[150px]" title={cat.name}>{cat.name}</span>
                    </div>
                    <span className="font-black text-[var(--color-text)] dark:text-white">{cat.value.toLocaleString('sq-AL')} <span className="text-xs text-[var(--color-text-muted)] font-normal">({Math.round((cat.value / Math.max(stats.totalReports, 1)) * 100)}%)</span></span>
                  </div>
                ))}
              </div>
            </div>

            {/* Citizen Engagement Box */}
            <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-[2rem] p-[var(--spacing-6)] border border-blue-500 text-white shadow-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-xl pointer-events-none" />
              <Users className="w-8 h-8 text-blue-200 mb-3" />
              <p className="text-[11px] font-black uppercase tracking-widest text-blue-200 mb-1">{dt(`Kontribuues të dallueshëm`)}</p>
              <h3 className="text-3xl font-black tracking-tight mb-2">{stats.contributors.toLocaleString('sq-AL')}</h3>
              <p className="text-xs text-blue-100 font-medium leading-relaxed mb-4">{dt(`Numri i llogarive unike që kanë raportime në grupin e të dhënave aktualisht të filtruar.`)}
              </p>
              <div className="flex items-center gap-2 text-xs font-bold text-blue-200 bg-white/10 px-3 py-1.5 rounded-full w-max">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />{dt(`Të llogaritur nga raportimet`)}
              </div>
            </div>
          </div>
        </div>

        <section className="mb-8 rounded-[2rem] border border-slate-200/70 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-slate-900 sm:p-7" aria-labelledby="detailed-analytics-title">
          <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 id="detailed-analytics-title" className="text-lg font-black text-slate-950 dark:text-white">{dt('Pamje e thelluar e shërbimit')}</h2>
              <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                {dt('Ndarja e statusit, urgjencës dhe ditëve të raportimit për të njëjtët filtra. Bazohet vetëm në')} {stats.totalReports.toLocaleString('sq-AL')} {dt('raportimet e ngarkuara.')}
              </p>
            </div>
            {comparison.periodDays > 0 && (
              <span className="w-fit rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-bold text-indigo-800 dark:border-indigo-300/20 dark:bg-indigo-300/10 dark:text-indigo-200">
                {dt('Periudha paraprake:')} {comparison.previousTotal.toLocaleString('sq-AL')} {dt('raportime')}
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            {[
              { title: 'Gjendja e raportimeve', subtitle: 'Shpërndarja aktuale sipas statusit', data: statusData, color: '#2563eb' },
              { title: 'Niveli i urgjencës', subtitle: 'Vëmendja që kërkohet sipas raportimit', data: urgencyData, color: '#e11d48' },
              { title: 'Ditët e raportimit', subtitle: 'Aktiviteti sipas ditës së javës', data: weekdayData, color: '#7c3aed' },
            ].map((chart) => (
              <div key={chart.title} className="rounded-2xl border border-slate-200/70 bg-slate-50/70 p-4 dark:border-white/10 dark:bg-slate-950/40">
                <h3 className="text-sm font-black text-slate-900 dark:text-white">{dt(chart.title)}</h3>
                <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">{dt(chart.subtitle)}</p>
                <div className="mt-3 h-48 w-full">
                  {chart.data.some(item => item.value > 0) ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chart.data} layout="vertical" margin={{ top: 4, right: 12, left: 4, bottom: 4 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-soft)" horizontal={false} />
                        <XAxis type="number" allowDecimals={false} stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} />
                        <YAxis type="category" dataKey="name" width={94} stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                        <Tooltip contentStyle={chartTooltipStyle} labelStyle={{ color: 'var(--color-text)' }} itemStyle={{ color: 'var(--color-text)' }} />
                        <Bar dataKey="value" name={dt('Raportime')} fill={chart.color} radius={[0, 6, 6, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-slate-200 text-xs font-medium text-slate-400 dark:border-white/10">
                      {dt('Nuk ka të dhëna për filtrat aktualë')}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            {[
              { label: 'Me komunë të shënuar', value: dataCoverage.municipality },
              { label: 'Me përshkrim', value: dataCoverage.description },
              { label: 'Me përgjegjës të caktuar', value: dataCoverage.assigned },
            ].map(item => (
              <div key={item.label} className="rounded-xl border border-slate-200/70 px-4 py-3 dark:border-white/10">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300">{dt(item.label)}</span>
                  <span className="text-xs font-black text-slate-900 dark:text-white">{item.value}%</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                  <div className="h-full rounded-full bg-cyan-500" style={{ width: `${item.value}%` }} />
                </div>
              </div>
            ))}
          </div>
        </section>

        <AdBanner position="inline" className="mb-8 max-w-none" />

        <section className="mb-8 overflow-hidden rounded-[2rem] border border-slate-200/70 bg-white shadow-sm dark:border-white/10 dark:bg-slate-900" aria-labelledby="report-download-title">
          <div className="border-b border-slate-200/70 bg-slate-50/80 p-5 dark:border-white/10 dark:bg-slate-800/50 sm:p-7">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
              <div>
                <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-[11px] font-black uppercase tracking-wider text-blue-800 dark:border-blue-300/20 dark:bg-blue-300/10 dark:text-blue-200">
                  <FileText className="h-3.5 w-3.5" />
                  {dt('Dosje e shkarkueshme')}
                </div>
                <h2 id="report-download-title" className="text-lg font-black text-slate-950 dark:text-white sm:text-xl">{dt('Zgjidh raportimet dhe shkarko dosjen')}</h2>
                <p className="mt-1 max-w-3xl text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                  {dt('Zgjidh një ose disa raportime nga rezultatet e filtruar. Dosja përmban tekstin, statusin, vendndodhjen, historikun dhe fotot/videot; mediat që nuk lejohen nga burimi do të shfaqen si lidhje.')}
                </p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <span className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-center text-xs font-bold text-slate-700 dark:border-white/10 dark:bg-slate-900 dark:text-slate-200">
                  {selectedReports.length} / {selectableReports.length} {dt('të zgjedhura')}
                </span>
                <button
                  type="button"
                  onClick={handleDownloadSelectedReports}
                  disabled={selectedReports.length === 0 || isExporting}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 py-2.5 text-xs font-black text-white shadow-sm transition hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-45 dark:bg-blue-500 dark:hover:bg-blue-400"
                >
                  {isExporting ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                  {dt('Shkarko dosjen')}
                </button>
                {selectedReportIds.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setSelectedReportIds([])}
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-600 transition hover:bg-slate-100 dark:border-white/10 dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    <X className="h-4 w-4" />
                    {dt('Pastro')}
                  </button>
                )}
              </div>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2">
              <label className="block">
                <span className="mb-1.5 block text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">{dt('Komuna e dosjes')}</span>
                <select
                  value={dossierMunicipality}
                  onChange={event => setDossierMunicipality(event.target.value)}
                  className="min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-800 outline-none focus:border-blue-500 dark:border-white/10 dark:bg-slate-900 dark:text-white"
                >
                  <option value="Të gjitha">{dt('Të gjitha komunat')}</option>
                  {KOSOVO_MUNICIPALITIES.map(municipality => <option key={municipality} value={municipality}>{municipality}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="mb-1.5 block text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">{dt('Reparti / kategoria')}</span>
                <select
                  value={dossierCategory}
                  onChange={event => setDossierCategory(event.target.value)}
                  className="min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-800 outline-none focus:border-blue-500 dark:border-white/10 dark:bg-slate-900 dark:text-white"
                >
                  <option value="Të gjitha">{dt('Të gjitha kategoritë')}</option>
                  {CATEGORIES.filter(category => category !== 'Të gjitha').map(category => <option key={category} value={category}>{getReportTopicValueLabel(category)}</option>)}
                </select>
              </label>
            </div>

            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
              <label className="relative block">
                <span className="sr-only">{dt('Kërko raportime për shkarkim')}</span>
                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                <input
                  type="search"
                  value={reportSearch}
                  onChange={event => setReportSearch(event.target.value)}
                  placeholder={dt('Kërko titull, përshkrim, kategori, komunë ose Track ID...')}
                  className="min-h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-sm text-slate-900 outline-none focus:border-blue-500 dark:border-white/10 dark:bg-slate-900 dark:text-white"
                />
              </label>
              <button
                type="button"
                onClick={toggleVisibleReports}
                disabled={selectableReports.length === 0}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 text-xs font-bold text-slate-700 transition hover:bg-slate-100 disabled:opacity-40 dark:border-white/10 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                <CheckSquare className="h-4 w-4" />
                {selectableReports.length > 0 && selectableReports.every(report => selectedReportIds.includes(report.id))
                  ? dt('Hiq zgjedhjen nga rezultatet')
                  : dt('Zgjidh të gjitha rezultatet')}
              </button>
            </div>
          </div>

          <div className="max-h-[680px] divide-y divide-slate-200/70 overflow-y-auto dark:divide-white/10">
            {selectableReports.length === 0 ? (
              <div className="p-8 text-center">
                <FileText className="mx-auto h-8 w-8 text-slate-400" />
                <p className="mt-3 text-sm font-bold text-slate-800 dark:text-slate-200">
                  {filteredReports.length ? dt('Nuk u gjet raportim për komunën, repartin ose kërkimin e zgjedhur.') : dt('Nuk ka raportime për filtrat e statistikave.')}
                </p>
              </div>
            ) : selectableReports.map(report => {
              const attachments = getReportAttachments(report);
              const isSelected = selectedReportIds.includes(report.id);
              return (
                <article
                  key={report.id}
                  className={`p-4 transition-colors sm:p-5 ${isSelected ? 'bg-blue-50/70 dark:bg-blue-400/[0.07]' : 'hover:bg-slate-50/80 dark:hover:bg-slate-800/50'}`}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleReportSelection(report.id)}
                      aria-label={`${dt('Zgjidh raportimin')} ${report.title}`}
                      className="mt-1 h-4 w-4 shrink-0 accent-blue-600"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-start">
                        <div className="min-w-0">
                          <h3 className="break-words text-sm font-black text-slate-950 dark:text-white">{report.title || dt('Raportim pa titull')}</h3>
                          <p className="mt-1 text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                            {getReportTopicLabel(report)} · {report.category || dt('Pa sektor')} · {report.location?.municipality || dt('Pa komunë')} · {report.urgency || dt('Pa urgjencë')}
                          </p>
                        </div>
                        <div className="flex shrink-0 flex-wrap items-center gap-2">
                          <span className="rounded-full border border-slate-200 px-2.5 py-1 text-xs font-bold text-slate-600 dark:border-white/10 dark:text-slate-300">{report.status}</span>
                          <span className="font-mono text-xs font-bold text-slate-500 dark:text-slate-400">{report.trackingId || report.id}</span>
                        </div>
                      </div>
                      <p className="mt-2 whitespace-pre-line break-words text-xs leading-relaxed text-slate-700 dark:text-slate-300">{report.description || dt('Nuk ka përshkrim.')}</p>
                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs font-medium text-slate-500 dark:text-slate-400">
                        <span>{formatReportDate(report.createdAt)}</span>
                        <span>{attachments.length} {dt('foto/video')}</span>
                        {report.responsibleInstitution && <span>{report.responsibleInstitution}</span>}
                      </div>
                      {attachments.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {attachments.slice(0, 4).map(attachment => (
                            <a
                              key={attachment.url}
                              href={attachment.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="group/media relative h-16 w-20 overflow-hidden rounded-lg border border-slate-200 bg-slate-900 dark:border-white/10"
                              aria-label={`${dt('Hap')} ${attachment.label} ${dt('në skedë të re')}`}
                            >
                              {attachment.type === 'video'
                                ? <video src={attachment.url} preload="metadata" muted className="h-full w-full object-cover" />
                                : <img src={attachment.url} loading="lazy" alt={attachment.label} className="h-full w-full object-cover transition group-hover/media:scale-105" />}
                              <span className="absolute inset-x-0 bottom-0 truncate bg-black/65 px-1 py-0.5 text-center text-[11px] font-bold text-white">{attachment.type === 'video' ? dt('VIDEO') : dt('FOTO')}</span>
                            </a>
                          ))}
                          {attachments.length > 4 && <span className="self-center text-xs font-bold text-slate-500 dark:text-slate-400">+{attachments.length - 4} media</span>}
                        </div>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>

          <div className="border-t border-slate-200/70 bg-slate-50/70 p-4 dark:border-white/10 dark:bg-slate-800/40 sm:px-7">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-[11px] leading-relaxed text-slate-600 dark:text-slate-300">
                {dt('Dosja shkarkohet si një skedar HTML i gatshëm për printim ose ruajtje si PDF. Mediat e lejuara nga serveri përfshihen brenda skedarit.')}
              </p>
              <button
                type="button"
                onClick={handleDownloadSelectedReports}
                disabled={selectedReports.length === 0 || isExporting}
                className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 py-2.5 text-xs font-black text-white transition hover:bg-blue-950 disabled:cursor-not-allowed disabled:opacity-45 dark:bg-blue-500 dark:hover:bg-blue-400"
              >
                {isExporting ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                {dt('Shkarkim · Zëri Qytetarëve')}
              </button>
            </div>
          </div>
        </section>

        {/* Detailed Municipal Performance Leaderboard Table */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/60 dark:border-white/10 shadow-sm dark:shadow-none overflow-hidden">
          <div className="p-[var(--spacing-6)] border-b border-slate-100 dark:border-white/5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-50 dark:bg-slate-800/50">
            <div>
              <h2 className="text-base font-black text-[var(--color-text)] dark:text-white uppercase tracking-wider">{dt(`Pasqyra e Performancës sipas Komunave`)}</h2>
              <p className="text-xs text-[var(--color-text-muted)] dark:text-[var(--color-text-muted)] font-medium">{dt(`Renderimi i efikasitetit në zgjidhjen e problematikave qytetare`)}</p>
            </div>
            <span className="text-xs font-black px-3 py-1 bg-blue-50 text-blue-700 border border-blue-100 rounded-full">
              {municipalityStats.length}{dt(`Komuna në Monitorim`)}
            </span>
          </div>

          <div className="block md:hidden divide-y divide-slate-100">
            {municipalityStats.map((stat: any, i) => (
              <div key={i} className="p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-black text-[var(--color-text-muted)]">#{i + 1}</span>
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center border border-blue-100 text-blue-600">
                        <MapPin className="w-4 h-4" />
                      </div>
                      <span className="font-bold text-[var(--color-text)] dark:text-white text-sm">{stat.municipality}</span>
                    </div>
                  </div>
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-[var(--color-text-muted)]">
                    {stat.topCategory}
                  </span>
                </div>
                
                <div className="grid grid-cols-2 gap-4 bg-slate-50 dark:bg-slate-900 rounded-2xl p-4">
                  <div>
                    <p className="text-[11px] font-black text-[var(--color-text-muted)] uppercase tracking-widest mb-1">{dt(`Raportime`)}</p>
                    <p className="font-bold text-slate-700 dark:text-[var(--color-text-muted)]">{stat.total.toLocaleString('sq-AL')}</p>
                  </div>
                  <div>
                    <p className="text-[11px] font-black text-[var(--color-text-muted)] uppercase tracking-widest mb-1">{dt(`Të Zgjidhura`)}</p>
                    <p className="font-bold text-emerald-600">{stat.resolved.toLocaleString('sq-AL')}</p>
                  </div>
                  <div>
                    <p className="text-[11px] font-black text-[var(--color-text-muted)] uppercase tracking-widest mb-1">{dt('Në shqyrtim')}</p>
                    <p className="font-bold text-amber-600">{stat.pending.toLocaleString('sq-AL')}</p>
                  </div>
                  <div>
                    <p className="text-[11px] font-black text-[var(--color-text-muted)] uppercase tracking-widest mb-1">{dt('Urgjente')}</p>
                    <p className="font-bold text-rose-600">{stat.urgent.toLocaleString('sq-AL')}</p>
                  </div>
                  <div className="col-span-2">
                    <div className="flex items-center justify-between mb-1.5">
                      <p className="text-[11px] font-black text-[var(--color-text-muted)] uppercase tracking-widest">{dt(`Efikasiteti`)}</p>
                      <span className="font-black text-[var(--color-text)] dark:text-white text-xs">{stat.rate}%</span>
                    </div>
                    <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full ${stat.rate >= 82 ? 'bg-emerald-500' : stat.rate >= 70 ? 'bg-blue-500' : 'bg-amber-500'}`} 
                        style={{ width: `${stat.rate}%` }}
                      />
                    </div>
                  </div>
                  <div className="col-span-2">
                    <p className="text-[11px] font-black text-[var(--color-text-muted)] uppercase tracking-widest mb-1">{dt(`Koha Mesatare`)}</p>
                    <p className="font-bold text-[var(--color-text-muted)] dark:text-[var(--color-text-muted)] text-xs">{stat.avgDays === 'N/A' ? 'N/A' : `${stat.avgDays}${dt(' ditë')}`}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-white/5">
                  <th className="px-6 py-4 text-[11px] font-black text-[var(--color-text-muted)] uppercase tracking-widest">{dt(`Renditja`)}</th>
                  <th className="px-6 py-4 text-[11px] font-black text-[var(--color-text-muted)] uppercase tracking-widest">{dt(`Komuna`)}</th>
                  <th className="px-6 py-4 text-[11px] font-black text-[var(--color-text-muted)] uppercase tracking-widest">{dt(`Raportime`)}</th>
                  <th className="px-6 py-4 text-[11px] font-black text-[var(--color-text-muted)] uppercase tracking-widest">{dt(`Të Zgjidhura`)}</th>
                  <th className="px-6 py-4 text-[11px] font-black text-[var(--color-text-muted)] uppercase tracking-widest">{dt('Në shqyrtim')}</th>
                  <th className="px-6 py-4 text-[11px] font-black text-[var(--color-text-muted)] uppercase tracking-widest">{dt('Urgjente')}</th>
                  <th className="px-6 py-4 text-[11px] font-black text-[var(--color-text-muted)] uppercase tracking-widest">{dt(`Shkalla e Efikasitetit`)}</th>
                  <th className="px-6 py-4 text-[11px] font-black text-[var(--color-text-muted)] uppercase tracking-widest">{dt(`Koha Mesatare`)}</th>
                  <th className="px-6 py-4 text-[11px] font-black text-[var(--color-text-muted)] uppercase tracking-widest">{dt(`Sektori Dominues`)}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {municipalityStats.map((stat: any, i) => (
                  <tr key={i} className="bg-white transition-colors hover:bg-slate-50 dark:bg-slate-800/80 dark:hover:bg-slate-700/80">
                    <td className="px-6 py-4 font-black text-[var(--color-text-muted)]">
                      #{i + 1}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center border border-blue-100 text-blue-600 font-bold">
                          <MapPin className="w-4 h-4" />
                        </div>
                        <span className="font-bold text-[var(--color-text)] dark:text-white text-sm">{stat.municipality}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 font-bold text-slate-700 dark:text-[var(--color-text-muted)]">{stat.total.toLocaleString('sq-AL')}</td>
                    <td className="px-6 py-4 font-bold text-emerald-600">{stat.resolved.toLocaleString('sq-AL')}</td>
                    <td className="px-6 py-4 font-bold text-amber-600">{stat.pending.toLocaleString('sq-AL')}</td>
                    <td className="px-6 py-4 font-bold text-rose-600">{stat.urgent.toLocaleString('sq-AL')}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <span className="font-black text-[var(--color-text)] dark:text-white w-8">{stat.rate}%</span>
                        <div className="w-28 h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                          <div 
                            className={`h-full rounded-full ${stat.rate >= 82 ? 'bg-emerald-500' : stat.rate >= 70 ? 'bg-blue-500' : 'bg-amber-500'}`} 
                            style={{ width: `${stat.rate}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 font-bold text-[var(--color-text-muted)] dark:text-[var(--color-text-muted)]">
                      {stat.avgDays === 'N/A' ? 'N/A' : `${stat.avgDays}${dt(' ditë')}`}
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-[11px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-[var(--color-text-muted)]">
                        {stat.topCategory}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Bottom Ad Banner */}
        

      </div>
    </div>
  );
}
