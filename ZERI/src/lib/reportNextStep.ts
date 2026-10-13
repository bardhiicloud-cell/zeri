/**
 * "What happens next" for a citizen, in plain words, for every state a report can be in.
 *
 * A status label ("Aprovuar") says where a report is. It does not say what the
 * person should expect or whether they need to do anything. This does: who acts
 * next, what they will do, and whether it is the citizen's turn.
 */

export interface NextStep {
  /** Who has the ball. */
  who: 'citizen' | 'staff' | 'municipality' | 'nobody';
  title: string;
  text: string;
}

export interface StepInput {
  status: string;
  municipality?: string;
  awaitingInfo?: boolean;
  /** The municipality's response deadline has passed. */
  late?: boolean;
}

export function nextStep(report: StepInput): NextStep {
  const place = report.municipality ? `Komuna e ${report.municipality}` : 'Komuna';

  if (report.awaitingInfo) {
    return {
      who: 'citizen',
      title: 'Pret informacionin tuaj',
      text: 'Stafi ju ka bërë një pyetje për ta shqyrtuar raportimin. Përgjigjuni më poshtë; raportimi vazhdon sapo të përgjigjeni.',
    };
  }

  switch (report.status) {
    case 'Draft':
    case 'Pending Review':
      return {
        who: 'staff',
        title: 'Pret shqyrtimin e parë',
        text: 'Një agjent e kontrollon raportimin (foto, vendndodhje, përshkrim). Pastaj do ta aprovojë për komunën, do t\'ju kërkojë informacion shtesë, ose do ta refuzojë me arsye të shkruar. Nuk keni gjë për të bërë.',
      };
    case 'Approved':
      return {
        who: 'municipality',
        title: `Dërguar te ${place}`,
        text: `Raportimi u aprovua dhe i është përcjellë. Pret që ${place} ta marrë përsipër dhe të tregojë çfarë do të bëjë dhe kur.`,
      };
    case 'Assigned':
    case 'In Progress':
      return report.late
        ? {
          who: 'municipality',
          title: 'Afati i përgjigjes ka kaluar',
          text: `${place} e ka kaluar afatin e saj. Platforma e ndjek dhe shihet publikisht që është e vonuar.`,
        }
        : {
          who: 'municipality',
          title: `${place} po punon`,
          text: 'Raportimi është marrë përsipër. Do të njoftoheni kur punimet të shënohen të kryera.',
        };
    case 'Overdue':
      return {
        who: 'municipality',
        title: 'Afati i përgjigjes ka kaluar',
        text: `${place} e ka kaluar afatin e saj. Platforma e ndjek dhe shihet publikisht që është e vonuar.`,
      };
    case 'Resolved':
      return {
        who: 'staff',
        title: 'Punimet u shënuan të kryera',
        text: 'Komuna thotë se problemi u zgjidh. Platforma e verifikon para se ta mbyllë. Nëse nuk është zgjidhur, mund të na e thoni.',
      };
    case 'Closed':
      return { who: 'nobody', title: 'Raportimi u mbyll', text: 'Punimet u verifikuan dhe rasti u mbyll. Faleminderit që e raportuat.' };
    case 'Rejected':
      return {
        who: 'nobody',
        title: 'Raportimi nuk u pranua',
        text: 'Arsyen e shkruar e shihni te historiku. Nëse mendoni se u vendos gabim, mund të dërgoni një raportim të ri me më shumë dëshmi.',
      };
    default:
      return { who: 'staff', title: 'Në shqyrtim', text: 'Raportimi po ndiqet nga stafi i platformës.' };
  }
}
