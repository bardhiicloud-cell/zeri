import { describe, expect, it } from 'vitest';
import { REPORT_TOPICS, REPORT_TOPIC_GROUPS, getReportTopicPlainLabel } from '../../src/lib/reportTopics';

describe('REPORT_TOPIC_GROUPS', () => {
  it('places every topic in exactly one group', () => {
    const grouped = REPORT_TOPIC_GROUPS.flatMap(group => [...group.ids]);
    expect(new Set(grouped).size).toBe(grouped.length);
    expect([...grouped].sort()).toEqual(REPORT_TOPICS.map(topic => topic.id).sort());
  });
  it('gives a plain label without the decorative emoji', () => {
    expect(getReportTopicPlainLabel('rruge')).toBe('Rrugë');
    expect(getReportTopicPlainLabel('rruge')).not.toMatch(/\p{Extended_Pictographic}/u);
  });
});
