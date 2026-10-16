import type { AppContext } from '../../core/types';
import './style.css';
import { createMessenger, type Messenger } from './view';

let instance: Messenger | null = null;

export function mount(el: HTMLElement, ctx: AppContext): Promise<void> {
  instance?.destroy();
  instance = createMessenger(el, ctx, {
    navigate: (url) => window.location.assign(url),
    now: () => new Date(),
  });
  return instance.ready;
}

export function unmount(): void {
  instance?.destroy();
  instance = null;
}
