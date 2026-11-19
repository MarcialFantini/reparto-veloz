/**
 * Client entry. Astro's ClientRouter keeps this module alive across navigations,
 * so every page is (re)initialised on `astro:page-load` and cleaned up before the swap.
 */
import { gsap } from 'gsap';
import { sim } from '../lib/sim';
import { bindActivity, bindChrome } from './chrome';
import { bindCommands } from './commands';

// Shared illustration poses target optional parts; missing ones are expected.
gsap.config({ nullTargetWarn: false });

type Cleanup = () => void;
type PageInit = (root: HTMLElement) => Cleanup | void;

const pages: Record<string, () => Promise<{ init: PageInit }>> = {
  entry: () => import('./entry'),
  order: () => import('./order'),
  warehouse: () => import('./warehouse'),
  fleet: () => import('./views/fleet'),
  orders: () => import('./views/orders'),
  drivers: () => import('./views/drivers'),
  metrics: () => import('./views/metrics'),
  incidents: () => import('./views/incidents'),
};

let cleanups: Cleanup[] = [];

async function boot(): Promise<void> {
  sim.start();
  cleanups.push(bindChrome(), bindCommands(), bindActivity());
  const page = document.body.dataset.page ?? '';
  const showcase = sim.isShowcase ? await import('./showcase') : null;
  showcase?.prepareShowcase(page);
  const loader = pages[page];
  if (loader) {
    const mod = await loader();
    const result = mod.init(document.body);
    if (result) cleanups.push(result);
  }
  document.body.classList.add('is-ready');
  if (showcase) cleanups.push(showcase.runShowcase(page));
}

document.addEventListener('astro:page-load', () => {
  void boot();
});

document.addEventListener('astro:before-swap', () => {
  for (const fn of cleanups) fn();
  cleanups = [];
});
