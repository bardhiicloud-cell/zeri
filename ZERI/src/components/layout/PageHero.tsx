import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { AuraHero, AuraStats, type AuraTone } from '../aura/Aura';

export interface PageHeroStat { value: string; label: string }

interface PageHeroProps {
  eyebrow: string;
  icon: LucideIcon;
  title: ReactNode;
  subtitle: ReactNode;
  actions?: ReactNode;
  stats?: PageHeroStat[];
  aside?: ReactNode;
  tone?: AuraTone;
  className?: string;
}

/** Public page masthead. Now a thin wrapper over the Aura design system so every page matches. */
export function PageHero({ eyebrow, icon, title, subtitle, actions, stats, aside, tone = 'blue', className }: PageHeroProps) {
  return (
    <div className={className}>
      <AuraHero tone={tone} eyebrow={eyebrow} icon={icon} title={title} subtitle={subtitle} actions={actions}
        aside={stats?.length ? <AuraStats items={stats} /> : aside} />
    </div>
  );
}

export const heroPrimaryClass = 'au-btn au-btn-light';
export const heroSecondaryClass = 'au-btn au-btn-glass';

export default PageHero;
