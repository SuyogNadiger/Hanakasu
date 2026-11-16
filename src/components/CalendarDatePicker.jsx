import React, { useRef, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { formatDateDisplay } from '../engine/financeEngine';

const pad = (value) => String(value).padStart(2, '0');
const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function parseDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value || '');
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  if (
    date.getFullYear() !== Number(match[1]) ||
    date.getMonth() !== Number(match[2]) - 1 ||
    date.getDate() !== Number(match[3])
  ) return null;
  return date;
}

function toISO(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function formatValue(value, mode) {
  if (mode === 'month') {
    const match = /^(\d{4})-(\d{2})$/.exec(value || '');
    return match ? `${monthNames[Number(match[2]) - 1]} ${match[1]}` : '';
  }
  return formatDateDisplay(value);
}

function parseInput(value, mode) {
  const text = value.trim();
  if (!text) return '';

  if (mode === 'month') {
    let month;
    let year;
    let match = /^(\d{1,2})[/-](\d{4})$/.exec(text);
    if (match) {
      month = Number(match[1]);
      year = Number(match[2]);
    } else if ((match = /^(\d{4})-(\d{1,2})$/.exec(text))) {
      year = Number(match[1]);
      month = Number(match[2]);
    } else if ((match = /^([a-zA-Z]{3,9})[\s,./-]+(\d{4})$/.exec(text))) {
      month = monthNames.findIndex(name =>
        name.toLowerCase() === match[1].slice(0, 3).toLowerCase()
      ) + 1;
      year = Number(match[2]);
    } else {
      return null;
    }
    return month >= 1 && month <= 12 && year >= 1000
      ? `${year}-${pad(month)}`
      : null;
  }

  let day;
  let month;
  let year;
  let match = /^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/.exec(text);
  if (match) {
    [, day, month, year] = match;
  } else if ((match = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(text))) {
    [, year, month, day] = match;
  } else if ((match = /^(\d{1,2})\s+([a-zA-Z]{3,9})\s+(\d{4})$/.exec(text))) {
    day = match[1];
    month = monthNames.findIndex(name =>
      name.toLowerCase() === match[2].slice(0, 3).toLowerCase()
    ) + 1;
    year = match[3];
  } else if (/^\d{8}$/.test(text)) {
    day = text.slice(0, 2);
    month = text.slice(2, 4);
    year = text.slice(4);
  } else {
    return null;
  }

  const date = new Date(Number(year), Number(month) - 1, Number(day));
  if (
    date.getFullYear() !== Number(year) ||
    date.getMonth() !== Number(month) - 1 ||
    date.getDate() !== Number(day)
  ) return null;
  return toISO(date);
}

export default function CalendarDatePicker({
  value = '',
  onChange,
  mode = 'date',
  className = '',
  placeholder,
  ariaLabel,
  required = false,
  maxValue
}) {
  const containerRef = useRef(null);
  const popupRef = useRef(null);
  const inputRef = useRef(null);
  const [input, setInput] = useState(() => ({ value, text: formatValue(value, mode) }));
  const [open, setOpen] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const [popupPosition, setPopupPosition] = useState(null);
  const [portalRoot, setPortalRoot] = useState(null);
  const [initialDate] = useState(() => parseDate(value) || new Date());
  const [todayISO] = useState(() => toISO(new Date()));
  const [visibleMonth, setVisibleMonth] = useState(
    () => new Date(initialDate.getFullYear(), initialDate.getMonth(), 1)
  );
  const [visibleYear, setVisibleYear] = useState(initialDate.getFullYear());

  if (input.value !== value) {
    setInput({ value, text: formatValue(value, mode) });
  }

  useEffect(() => {
    inputRef.current?.setCustomValidity('');
  }, [value]);

  useEffect(() => {
    if (!open) return undefined;
    const closeOnOutsideClick = (event) => {
      if (
        !containerRef.current?.contains(event.target) &&
        !popupRef.current?.contains(event.target)
      ) setOpen(false);
    };
    document.addEventListener('mousedown', closeOnOutsideClick);
    return () => document.removeEventListener('mousedown', closeOnOutsideClick);
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;

    const updatePopupPosition = () => {
      const anchor = containerRef.current?.getBoundingClientRect();
      const popup = popupRef.current?.getBoundingClientRect();
      if (!anchor || !popup) return;

      const edge = 8;
      const gap = 8;
      const width = popup.width || Math.min(288, window.innerWidth - edge * 2);
      const height = popup.height || 320;
      const spaceBelow = window.innerHeight - anchor.bottom - gap - edge;
      const spaceAbove = anchor.top - gap - edge;
      const showBelow = spaceBelow >= height || spaceBelow >= spaceAbove;
      const top = showBelow
        ? Math.min(anchor.bottom + gap, window.innerHeight - height - edge)
        : Math.max(edge, anchor.top - height - gap);
      const left = Math.max(
        edge,
        Math.min(anchor.right - width, window.innerWidth - width - edge)
      );

      setPopupPosition({ left, top });
    };

    updatePopupPosition();
    window.addEventListener('resize', updatePopupPosition);
    window.addEventListener('scroll', updatePopupPosition, true);
    return () => {
      window.removeEventListener('resize', updatePopupPosition);
      window.removeEventListener('scroll', updatePopupPosition, true);
    };
  }, [open, mode, visibleMonth, visibleYear]);

  const chooseValue = (nextValue) => {
    if (isBeyondMonthLimit(nextValue)) return;
    setInput({ value: nextValue, text: formatValue(nextValue, mode) });
    setInvalid(false);
    inputRef.current?.setCustomValidity('');
    onChange(nextValue);
    setOpen(false);
  };

  const handleInputChange = (event) => {
    const text = event.target.value;
    const parsed = parseInput(text, mode);
    const futureMonth = parsed !== null && isBeyondMonthLimit(parsed);
    setInput({ value, text });
    setInvalid(futureMonth);
    event.currentTarget.setCustomValidity(futureMonth ? invalidMessage(true) : parsed === null ? invalidMessage() : '');
    if (parsed !== null && !futureMonth) {
      setInput({ value: parsed, text: formatValue(parsed, mode) });
      onChange(parsed);
    } else if (!text.trim() && !required) {
      onChange('');
    }
  };

  const handleBlur = () => {
    if (!input.text.trim() && !required) {
      setInvalid(false);
      inputRef.current?.setCustomValidity('');
      return;
    }
    const parsed = parseInput(input.text, mode);
    const futureMonth = parsed !== null && isBeyondMonthLimit(parsed);
    setInvalid(parsed === null || futureMonth || (required && !parsed));
    inputRef.current?.setCustomValidity(
      futureMonth ? invalidMessage(true) : parsed === null || (required && !parsed) ? invalidMessage() : ''
    );
  };

  const openPicker = () => {
    setPortalRoot(containerRef.current?.closest('.theme-dark, .theme-light') || document.body);
    if (mode === 'month') {
      const monthValue = /^(\d{4})-(\d{2})$/.exec(value || '');
      const year = monthValue ? Number(monthValue[1]) : new Date().getFullYear();
      setVisibleYear(year);
      setPopupPosition(null);
      setOpen(current => !current);
      return;
    }
    const selected = parseDate(value) || new Date();
    setVisibleMonth(new Date(selected.getFullYear(), selected.getMonth(), 1));
    setVisibleYear(selected.getFullYear());
    setPopupPosition(null);
    setOpen(current => !current);
  };

  const selectedDate = parseDate(value);
  const firstDay = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), 1).getDay();
  const daysInMonth = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 0).getDate();
  const isBeyondMonthLimit = (monthValue) =>
    mode === 'month' && Boolean(maxValue) && monthValue > maxValue;
  const invalidMessage = (isFutureMonth = false) => isFutureMonth
    ? 'Month cannot be in the future.'
    : mode === 'month'
      ? 'Enter a valid month (e.g. Jan 2026).'
      : 'Enter a valid date (e.g. 15 Nov 2026).';

  return (
    <div ref={containerRef} className={`relative min-w-0 ${className}`}>
      <div className={`flex items-center rounded-xl border hm-border hm-input p-0 ${invalid ? 'border-rose-500' : ''}`}>
        <input
          ref={inputRef}
          type="text"
          inputMode="text"
          autoComplete="off"
          value={input.text}
          placeholder={placeholder || (mode === 'month' ? 'MMM YYYY' : 'DD MMM YYYY')}
          aria-label={ariaLabel || (mode === 'month' ? 'Select month' : 'Select date')}
          aria-invalid={invalid}
          required={required}
          onChange={handleInputChange}
          onBlur={handleBlur}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && open) {
              event.preventDefault();
              setOpen(false);
            }
            if (event.key === 'Escape') setOpen(false);
          }}
          className="min-w-0 w-full bg-transparent px-3 py-2.5 font-mono-num text-xs font-bold outline-none"
        />
        <button
          type="button"
          onClick={openPicker}
          aria-label={mode === 'month' ? 'Open month picker' : 'Open calendar'}
          aria-haspopup="dialog"
          aria-expanded={open}
          className="shrink-0 p-2.5 hm-text-muted hover:opacity-100 cursor-pointer"
        >
          <CalendarDays size={15} />
        </button>
      </div>
      {invalid && (
        <span className="mt-1 block text-[10px] font-semibold text-rose-500" role="alert">
          {invalidMessage(input.text && isBeyondMonthLimit(parseInput(input.text, mode)))}
        </span>
      )}

      {open && portalRoot && createPortal(
        <div
          ref={popupRef}
          role="dialog"
          aria-label={mode === 'month' ? 'Choose month' : 'Choose date'}
          className="fixed z-[100] w-72 max-w-[calc(100vw-1rem)] rounded-2xl border hm-surface hm-border p-3 shadow-2xl"
          style={popupPosition
            ? { left: popupPosition.left, top: popupPosition.top }
            : { left: 0, top: 0, visibility: 'hidden' }}
        >
          {mode === 'month' ? (
            <>
              <div className="mb-3 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setVisibleYear(year => year - 1)}
                  aria-label="Previous year"
                  className="rounded-lg p-2 hm-elevated cursor-pointer"
                >
                  <ChevronLeft size={16} />
                </button>
                <strong className="text-sm">{visibleYear}</strong>
                <button
                  type="button"
                  onClick={() => setVisibleYear(year => year + 1)}
                  aria-label="Next year"
                  disabled={Boolean(maxValue && visibleYear >= Number(maxValue.slice(0, 4)))}
                  className="rounded-lg p-2 hm-elevated enabled:cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {monthNames.map((name, month) => {
                  const monthValue = `${visibleYear}-${pad(month + 1)}`;
                  const active = value === monthValue;
                  const disabled = isBeyondMonthLimit(monthValue);
                  return (
                    <button
                      type="button"
                      key={monthValue}
                      onClick={() => chooseValue(monthValue)}
                      disabled={disabled}
                      aria-pressed={Boolean(active)}
                      className={`rounded-xl py-2.5 text-xs font-bold ${
                        active ? 'hm-btn-primary' : 'hm-elevated hover:opacity-80'
                      } ${disabled ? 'cursor-not-allowed opacity-35' : 'cursor-pointer'}`}
                    >
                      {name}
                    </button>
                  );
                })}
              </div>
            </>
          ) : (
            <>
              <div className="mb-2 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setVisibleMonth(month => new Date(month.getFullYear(), month.getMonth() - 1, 1))}
                  aria-label="Previous month"
                  className="rounded-lg p-2 hm-elevated cursor-pointer"
                >
                  <ChevronLeft size={16} />
                </button>
                <strong className="text-sm">
                  {visibleMonth.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}
                </strong>
                <button
                  type="button"
                  onClick={() => setVisibleMonth(month => new Date(month.getFullYear(), month.getMonth() + 1, 1))}
                  aria-label="Next month"
                  className="rounded-lg p-2 hm-elevated cursor-pointer"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
              <div className="grid grid-cols-7 pb-1 text-center text-[10px] font-bold hm-text-muted">
                {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(day => <span key={day}>{day}</span>)}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {Array.from({ length: firstDay }, (_, index) => (
                  <span key={`empty-${index}`} />
                ))}
                {Array.from({ length: daysInMonth }, (_, index) => {
                  const date = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), index + 1);
                  const dateISO = toISO(date);
                  const active = selectedDate && toISO(selectedDate) === dateISO;
                  return (
                    <button
                      type="button"
                      key={dateISO}
                      onClick={() => chooseValue(dateISO)}
                      aria-pressed={Boolean(active)}
                      className={`aspect-square rounded-lg text-xs font-semibold cursor-pointer ${
                        active
                          ? 'hm-btn-primary'
                          : dateISO === todayISO
                            ? 'hm-elevated ring-1 ring-current'
                            : 'hover:opacity-80'
                      }`}
                    >
                      {index + 1}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>,
        portalRoot
      )}
    </div>
  );
}
