import ReportQueuesPanel from './ReportQueuesPanel';

/**
 * The Reports panel: citizen reports through the six stages, nothing else. (The detailed
 * inspection tab was removed: the report drawer now holds the photos, details, history and
 * the next step in one place.)
 */
export default function ReportsSection({ openReportId }: { openReportId?: string }) {
  return (
    <ReportQueuesPanel
      title="Raportet e qytetarëve"
      subtitle="Këtu punohen raportimet: Në pritje → U aprovua → I caktuar → Në proces → U zgjidh → U mbyll. Të refuzuarat janë veçmas. Hap një raport për ta aprovuar, caktuar ose refuzuar."
      openReportId={openReportId}
    />
  );
}
