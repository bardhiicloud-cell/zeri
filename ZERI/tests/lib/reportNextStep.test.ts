import { describe, expect, it } from 'vitest';
import { nextStep } from '../../src/lib/reportNextStep';

const STATUSES = ['Draft', 'Pending Review', 'Approved', 'Assigned', 'In Progress', 'Overdue', 'Resolved', 'Closed', 'Rejected'];

describe('nextStep', () => {
  it('says something useful for every status a report can have', () => {
    for (const status of STATUSES) {
      const step = nextStep({ status, municipality: 'Pejë' });
      expect(step.title.length, status).toBeGreaterThan(5);
      expect(step.text.length, status).toBeGreaterThan(30);
    }
  });

  it('puts the ball with the citizen only when they were asked something', () => {
    expect(nextStep({ status: 'Pending Review', awaitingInfo: true }).who).toBe('citizen');
    for (const status of STATUSES) expect(nextStep({ status }).who, status).not.toBe('citizen');
  });

  it('a pending question outranks the status (the report cannot move until it is answered)', () => {
    expect(nextStep({ status: 'Pending Review', awaitingInfo: true }).title).toContain('informacionin tuaj');
  });

  it('names the municipality, and does not break without one', () => {
    expect(nextStep({ status: 'Approved', municipality: 'Pejë' }).title).toBe('Dërguar te Komuna e Pejë');
    expect(nextStep({ status: 'Approved' }).title).toBe('Dërguar te Komuna');
  });

  it('is honest about lateness: an overdue municipality is said to be overdue', () => {
    expect(nextStep({ status: 'In Progress', late: true }).title).toContain('Afati');
    expect(nextStep({ status: 'In Progress', late: false }).title).not.toContain('Afati');
    expect(nextStep({ status: 'Overdue' }).who).toBe('municipality');
  });

  it('never promises a result: a rejection points to what can be done, not to an appeal that does not exist', () => {
    expect(nextStep({ status: 'Rejected' }).text).toContain('raportim të ri');
    expect(nextStep({ status: 'Rejected' }).who).toBe('nobody');
  });

  it('falls back for a status it does not know', () => {
    expect(nextStep({ status: 'Something New' }).who).toBe('staff');
  });
});
