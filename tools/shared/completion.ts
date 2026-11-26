/**
 * The suggestion list under the caret, for the playground's editor and for
 * every lesson snippet (TOOLING.md §2.2.1).
 *
 * This is glue. What is suggested, in what order, and what picking one does
 * to the text are all decided in `complete.ts`, which has no DOM and is
 * tested; this file only finds where the caret is on screen, draws the list
 * there, and turns keys into choices.
 *
 * The editor is a transparent textarea over its painted copy, so the caret
 * has no element to anchor to. Its position is arithmetic, exactly as the
 * hover tooltip's is (`playground/locate.ts`): the editor does not wrap, so a
 * line is one row, and the text before the caret is measured in the editor's
 * own font.
 *
 * Picking a suggestion goes through `execCommand('insertText')` where the
 * browser has it, because that is the one way of changing a textarea that
 * keeps its undo history — Ctrl+Z after a completion should take back the
 * completion, not everything typed since the page loaded.
 */

import { apply, complete } from './complete.js';
import type { Completion, Kind, Suggestion } from './complete.js';
import type { Language } from './nav.js';

export interface CompletionOptions {
  /** The page's language now; it can change while the page is open. */
  readonly language: () => Language;
}

/** What each kind looks like in the list: a mark, coloured by its syntax. */
const MARKS: Readonly<Record<Kind, string>> = {
  keyword: '፦',
  type: 'T',
  function: 'ƒ',
  class: '◆',
  variable: 'x',
  member: '.',
  param: '‹›',
};

const KIND_NAMES: Readonly<Record<Language, Readonly<Record<Kind, string>>>> = {
  am: {
    keyword: 'ቁልፍ ቃል',
    type: 'አይነት',
    function: 'ተግባር',
    class: 'ክላስ',
    variable: 'ተለዋጭ',
    member: 'አባል',
    param: 'ግቤት',
  },
  en: {
    keyword: 'keyword',
    type: 'type',
    function: 'function',
    class: 'class',
    variable: 'variable',
    member: 'member',
    param: 'parameter',
  },
};

let instances = 0;

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Characters that, typed, may mean the reader wants a suggestion. */
function opens(data: string | null): boolean {
  if (data === null || data === '') return false;
  const last = [...data].at(-1) ?? '';
  return last === '.' || /[\p{L}_]/u.test(last);
}

export function attachCompletion(area: HTMLTextAreaElement, options: CompletionOptions): void {
  instances += 1;
  const id = `cmp-${instances}`;

  const box = document.createElement('div');
  box.className = 'cmp';
  box.hidden = true;
  box.innerHTML = `<ul class="cmp-list" role="listbox" id="${id}"></ul><div class="cmp-doc" aria-live="polite"></div>`;
  const list = box.querySelector('ul') as HTMLUListElement;
  const doc = box.querySelector('.cmp-doc') as HTMLDivElement;
  document.body.append(box);

  area.setAttribute('aria-autocomplete', 'list');
  area.setAttribute('aria-controls', id);

  let current: Completion | null = null;
  let selected = 0;
  let composing = false;
  /** The next input event is our own insertion, and should not reopen the list. */
  let ours = false;

  // ---- measuring ------------------------------------------------------------

  const context2d = document.createElement('canvas').getContext('2d');
  function measure(text: string, style: CSSStyleDeclaration): number {
    if (context2d === null) return 0;
    context2d.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
    const tab = ' '.repeat(Number.parseInt(style.tabSize, 10) || 4);
    return context2d.measureText(text.replace(/\t/g, tab)).width;
  }

  /** Puts the list under the start of the word, or above it if there is no room. */
  function place(from: number): void {
    const style = getComputedStyle(area);
    const rect = area.getBoundingClientRect();
    const before = area.value.slice(0, from);
    const lineIndex = before.split('\n').length - 1;
    const lineText = before.slice(before.lastIndexOf('\n') + 1);
    const lineHeight = Number.parseFloat(style.lineHeight) || 20;

    const x =
      rect.left +
      Number.parseFloat(style.borderLeftWidth) +
      Number.parseFloat(style.paddingLeft) +
      measure(lineText, style) -
      area.scrollLeft;
    const top =
      rect.top +
      Number.parseFloat(style.borderTopWidth) +
      Number.parseFloat(style.paddingTop) +
      lineIndex * lineHeight -
      area.scrollTop;

    const size = box.getBoundingClientRect();
    const below = top + lineHeight + 4;
    const y = below + size.height > window.innerHeight - 8 ? top - size.height - 4 : below;
    const left = Math.min(x - 8, window.innerWidth - size.width - 8);
    box.style.left = `${Math.max(8, left)}px`;
    box.style.top = `${Math.max(8, y)}px`;
  }

  // ---- drawing --------------------------------------------------------------

  function optionId(index: number): string {
    return `${id}-${index}`;
  }

  function row(item: Suggestion, index: number, kinds: Readonly<Record<Kind, string>>): string {
    const via =
      item.via === undefined ? '' : `<span class="cmp-via">${escapeHtml(item.via)} →</span>`;
    return (
      `<li role="option" id="${optionId(index)}" data-index="${index}" aria-selected="${index === selected}">` +
      `<span class="cmp-mark cmp-${item.kind}" title="${escapeHtml(kinds[item.kind])}" aria-hidden="true">${MARKS[item.kind]}</span>` +
      `${via}<span class="cmp-label">${escapeHtml(item.label)}</span>` +
      `<span class="cmp-detail">${escapeHtml(item.detail)}</span>` +
      `</li>`
    );
  }

  function paintSelection(): void {
    if (current === null) return;
    for (const li of list.children) {
      const on = Number((li as HTMLElement).dataset.index) === selected;
      li.setAttribute('aria-selected', String(on));
      if (on) (li as HTMLElement).scrollIntoView({ block: 'nearest' });
    }
    area.setAttribute('aria-activedescendant', optionId(selected));

    const item = current.items[selected];
    if (item === undefined) return;
    const kind = KIND_NAMES[options.language()][item.kind];
    doc.innerHTML =
      (item.detail === '' ? '' : `<code>${escapeHtml(item.detail)}</code>`) +
      `<span class="cmp-kind">${escapeHtml(kind)}</span>` +
      (item.doc === '' ? '' : `<p>${escapeHtml(item.doc)}</p>`);
  }

  function show(completion: Completion): void {
    const kinds = KIND_NAMES[options.language()];
    current = completion;
    selected = 0;
    list.innerHTML = completion.items.map((item, i) => row(item, i, kinds)).join('');
    box.hidden = false;
    area.setAttribute('aria-expanded', 'true');
    paintSelection();
    place(completion.context.from);
  }

  function close(): void {
    if (current === null && box.hidden) return;
    current = null;
    box.hidden = true;
    area.removeAttribute('aria-activedescendant');
    area.setAttribute('aria-expanded', 'false');
  }

  function update(explicit: boolean): void {
    if (area.selectionStart !== area.selectionEnd) {
      close();
      return;
    }
    const found = complete(area.value, area.selectionStart, {
      language: options.language(),
      explicit,
    });
    if (found === null) close();
    else show(found);
  }

  // ---- choosing -------------------------------------------------------------

  function accept(index: number): void {
    const item = current?.items[index];
    const context = current?.context;
    close();
    if (item === undefined || context === undefined) return;

    const next = apply(area.value, context, item);
    area.focus();
    area.setSelectionRange(context.from, context.to);
    ours = true;
    const inserted = document.execCommand('insertText', false, item.insert);
    if (!inserted) {
      area.setRangeText(item.insert, context.from, context.to, 'end');
      area.dispatchEvent(new Event('input', { bubbles: true }));
    }
    ours = false;
    area.setSelectionRange(next.caret, next.caret);
  }

  // ---- events ---------------------------------------------------------------

  area.addEventListener('compositionstart', () => {
    composing = true;
    close();
  });

  area.addEventListener('compositionend', () => {
    composing = false;
    update(false);
  });

  area.addEventListener('input', (event) => {
    if (composing || ours) return;
    const input = event as InputEvent;
    // Once the list is up it follows every edit, deletions included; it only
    // *opens* on a typed letter or `.`, so pasting or pressing Enter does not
    // throw a list in front of the reader.
    if (current !== null) {
      update(false);
      return;
    }
    if (input.inputType === 'insertText' && opens(input.data)) update(false);
  });

  // Capture, so the list sees Tab and Enter before the editor's own handlers
  // (indent, run) do, and can keep them when it is using them.
  area.addEventListener(
    'keydown',
    (event) => {
      if (event.key === ' ' && event.ctrlKey && !event.metaKey && !event.altKey) {
        event.preventDefault();
        update(true);
        return;
      }
      if (current === null || composing || event.isComposing) return;

      const count = current.items.length;
      const take = (): void => {
        event.preventDefault();
        event.stopImmediatePropagation();
      };

      switch (event.key) {
        case 'ArrowDown':
          take();
          selected = (selected + 1) % count;
          paintSelection();
          return;
        case 'ArrowUp':
          take();
          selected = (selected - 1 + count) % count;
          paintSelection();
          return;
        case 'PageDown':
          take();
          selected = Math.min(count - 1, selected + 8);
          paintSelection();
          return;
        case 'PageUp':
          take();
          selected = Math.max(0, selected - 8);
          paintSelection();
          return;
        case 'Enter':
        case 'Tab':
          if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) {
            close();
            return;
          }
          take();
          accept(selected);
          return;
        case 'Escape':
          take();
          close();
          return;
        case 'ArrowLeft':
        case 'ArrowRight':
        case 'Home':
        case 'End':
          close();
          return;
        default:
          return;
      }
    },
    { capture: true },
  );

  // Pressing on the list must not take focus from the editor.
  box.addEventListener('pointerdown', (event) => {
    event.preventDefault();
  });

  list.addEventListener('click', (event) => {
    const li = (event.target as HTMLElement).closest<HTMLElement>('li[data-index]');
    if (li !== null) accept(Number(li.dataset.index));
  });

  list.addEventListener('pointermove', (event) => {
    const li = (event.target as HTMLElement).closest<HTMLElement>('li[data-index]');
    if (li === null) return;
    const index = Number(li.dataset.index);
    if (index !== selected) {
      selected = index;
      paintSelection();
    }
  });

  area.addEventListener('blur', close);
  area.addEventListener('mousedown', close);
  // The page or the editor moving under the list — a phone's keyboard
  // sliding up, a smooth scroll settling, the editor scrolling itself to
  // keep a new line's caret in view — moves the list with it rather than
  // closing it on the reader mid-word.
  const follow = (): void => {
    if (current !== null) place(current.context.from);
  };
  area.addEventListener('scroll', follow);
  window.addEventListener('resize', follow);
  window.addEventListener('scroll', follow, { passive: true });
}
