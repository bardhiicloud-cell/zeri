import { dt } from '@/src/lib/dt';
import { ArrowUpRight } from 'lucide-react';
import { SOCIAL_LINKS } from './SocialIcons';
import { cn } from '../lib/utils';

/**
 * Social follow block — the platform's owned-media funnel.
 *
 * Why this exists rather than a row of icons in the footer:
 *
 * A citizen who has just read the map and the reports table has a reason to keep
 * hearing from the platform, and that is the only moment they will ever click
 * "follow". Icons in the footer are read by people who were already leaving, and
 * on a dashboard this long the footer is several screens away. This block sits
 * where intent is highest and states the *reason* to follow — the status of a
 * report you filed, a new poll in your municipality — instead of asking for a
 * follow with no argument behind it.
 *
 * The channels are equal cards in a two-column grid. An earlier version ranked one
 * channel larger than the rest, which read as an advertisement for a single
 * network rather than as a set of official channels, and left the others
 * looking like afterthoughts. Identical cards are the honest presentation:
 * the platform publishes to all of them, and a citizen picks the one they
 * already use.
 */

/** Channels with the reason a citizen would follow each, and its brand colour. */
const CHANNELS = [
  {
    id: 'youtube',
    pitch: 'Videot dhe përditësimet e platformës',
    brand: '#FF0033',
  },
  {
    id: 'facebook',
    pitch: 'Njoftime zyrtare dhe përditësime',
    brand: '#1877F2',
  },
  {
    id: 'instagram',
    pitch: 'Lajmet e ditës dhe historitë',
    brand: '#E1306C',
  },
  {
    id: 'tiktok',
    pitch: 'Video të shkurtra nga terreni',
    brand: '#FE2C55',
  },
  {
    id: 'x',
    pitch: 'Njoftime të shpejta dhe reagime',
    brand: '#0F1419',
  },
  {
    id: 'discord',
    pitch: 'Bisedo me komunitetin qytetar',
    brand: '#5865F2',
  },
];

export function SocialFollowBlock({ className }: { className?: string }) {
  const channels = CHANNELS.map((channel) => {
    const link = SOCIAL_LINKS.find((item) => item.id === channel.id);
    return link ? { ...channel, ...link } : null;
  }).filter((item): item is NonNullable<typeof item> => item !== null);

  return (
    <section
      aria-labelledby="social-follow-heading"
      className={cn(
        'overflow-hidden rounded-[26px] border border-slate-200/80 bg-white dark:border-white/10 dark:bg-slate-900',
        className
      )}
    >
      <div className="p-5 sm:p-6">
        {/* The argument for following. */}
        <div className="max-w-2xl">
          <h3
            id="social-follow-heading"
            className="title-serif text-lg font-black tracking-tight text-slate-900 dark:text-white"
          >
            {dt('Mos e humb përditësimin')}
          </h3>
          <p className="mt-1.5 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
            {dt('Ndiq platformën dhe merr statusin e raportit tënd, sondazhet e reja dhe njoftimet e komunës tënde — drejtpërdrejt në rrjetin që përdor çdo ditë.')}
          </p>
        </div>

        {/* Six equal cards form a balanced three-by-two grid on larger screens. */}
        <ul className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {channels.map(({ id, label, href, Icon, pitch, brand }) => (
            <li key={id}>
              <a
                href={href}
                target="_blank"
                rel="me noopener noreferrer"
                aria-label={`${dt('Ndiq në')} ${label}`}
                title={`${dt('Ndiq në')} ${label}`}
                className="group flex h-full items-center gap-3.5 rounded-2xl border border-slate-200/80 bg-white p-3.5 transition-all duration-300 ease-out hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 motion-reduce:transition-none motion-reduce:hover:transform-none dark:border-white/10 dark:bg-slate-900 dark:hover:border-white/20 dark:focus-visible:ring-offset-slate-900"
              >
                {/*
                  The brand mark sits on its own brand colour so the card is
                  recognisable at a glance — that colour is the fastest signal of
                  which network a citizen is about to open, and it is the one
                  place a brand palette earns its keep. Applied inline rather
                  than as a utility class because Tailwind cannot generate a
                  class for a hex value that only exists here.
                */}
                <span
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white shadow-sm transition-transform duration-300 ease-out group-hover:scale-105 group-hover:-rotate-3 motion-reduce:transition-none motion-reduce:group-hover:transform-none"
                  style={{ backgroundColor: brand }}
                >
                  <Icon className="h-5 w-5" />
                </span>

                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-black text-slate-900 dark:text-white">
                    {label}
                  </span>
                  <span className="mt-0.5 block truncate text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                    {dt(pitch)}
                  </span>
                </span>

                <ArrowUpRight
                  className="h-4 w-4 shrink-0 text-slate-300 transition duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-slate-500 dark:text-slate-600 dark:group-hover:text-slate-300 motion-reduce:transition-none motion-reduce:group-hover:transform-none"
                  aria-hidden="true"
                />
              </a>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}