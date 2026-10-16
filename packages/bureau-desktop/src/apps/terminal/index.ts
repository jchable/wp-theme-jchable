import type { AppContext } from '../../core/types';
import { History } from './logic';
import { createRunner, PROMPT } from './run';
import './style.css';

let cleanup: (() => void) | null = null;

export function mount(el: HTMLElement, ctx: AppContext): void {
  cleanup?.();
  el.textContent = '';
  ctx.setTitle('Invite de commandes');

  const root = document.createElement('div');
  root.className = 'bapp-terminal-root';

  const output = document.createElement('div');
  output.className = 'bapp-terminal-output';
  output.setAttribute('role', 'log');
  output.setAttribute('aria-live', 'polite');
  output.setAttribute('aria-label', 'Sortie du terminal');

  const form = document.createElement('form');
  form.className = 'bapp-terminal-line';
  form.autocomplete = 'off';

  const prompt = document.createElement('span');
  prompt.className = 'bapp-terminal-prompt';
  prompt.textContent = PROMPT;
  prompt.setAttribute('aria-hidden', 'true');

  const input = document.createElement('input');
  input.className = 'bapp-terminal-input';
  input.type = 'text';
  input.setAttribute('aria-label', 'Commande');
  input.autocomplete = 'off';
  input.spellcheck = false;
  input.setAttribute('autocapitalize', 'off');
  input.setAttribute('autocorrect', 'off');

  form.append(prompt, input);
  root.append(output, form);
  el.append(root);

  const print = (text: string): void => {
    const row = document.createElement('div');
    row.className = 'bapp-terminal-row';
    row.textContent = text === '' ? ' ' : text;
    output.append(row);
    output.scrollTop = output.scrollHeight;
  };

  const runner = createRunner(ctx, {
    print,
    clear: () => {
      output.textContent = '';
    },
  });
  const history = new History();
  let busy = false;

  const onSubmit = (e: Event): void => {
    e.preventDefault();
    if (busy) return;
    const line = input.value;
    input.value = '';
    history.push(line);
    print(`${PROMPT}${line}`);
    busy = true;
    runner
      .run(line)
      .catch(() => print('Une erreur interne est survenue.'))
      .finally(() => {
        busy = false;
        output.scrollTop = output.scrollHeight;
      });
  };

  const onKeyDown = (e: KeyboardEvent): void => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      input.value = history.prev(input.value);
      input.setSelectionRange(input.value.length, input.value.length);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      input.value = history.next();
      input.setSelectionRange(input.value.length, input.value.length);
    }
  };

  const onOutputClick = (): void => {
    // Ne pas voler le focus pendant une sélection de texte.
    if (window.getSelection()?.toString()) return;
    input.focus();
  };

  form.addEventListener('submit', onSubmit);
  input.addEventListener('keydown', onKeyDown);
  output.addEventListener('click', onOutputClick);

  runner.welcome();
  input.focus();

  cleanup = () => {
    form.removeEventListener('submit', onSubmit);
    input.removeEventListener('keydown', onKeyDown);
    output.removeEventListener('click', onOutputClick);
    root.remove();
  };
}

export function unmount(): void {
  cleanup?.();
  cleanup = null;
}
