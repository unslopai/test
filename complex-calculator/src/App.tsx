import { create, all } from 'mathjs';
import { useEffect, useMemo, useState } from 'react';

type Mode = 'standard' | 'scientific' | 'programmer';
type AngleUnit = 'deg' | 'rad';
type Theme = 'aurora' | 'sunset' | 'ocean';

type HistoryEntry = {
  id: number;
  expression: string;
  result: string;
  starred: boolean;
};

type EvalResult = {
  result: string;
  raw: number;
};

const math = create(all, {});

const FUNCTION_INSERTS = [
  'sin(',
  'cos(',
  'tan(',
  'asin(',
  'acos(',
  'atan(',
  'sqrt(',
  'log(',
  'ln(',
  'abs(',
  'floor(',
  'ceil(',
  'round(',
  'exp(',
];

const STANDARD_KEYS = [
  '(',
  ')',
  'C',
  'Back',
  '7',
  '8',
  '9',
  '/',
  '4',
  '5',
  '6',
  '*',
  '1',
  '2',
  '3',
  '-',
  '0',
  '.',
  '%',
  '+',
];

const SCIENTIFIC_KEYS = [
  ...STANDARD_KEYS,
  'pi',
  'e',
  '^',
  'sin(',
  'cos(',
  'tan(',
  'asin(',
  'acos(',
  'atan(',
  'sqrt(',
  'log(',
  'ln(',
  'abs(',
  'floor(',
  'ceil(',
  'round(',
  'exp(',
];

const PROGRAMMER_KEYS = [
  '(',
  ')',
  'C',
  'Back',
  'A',
  'B',
  'C_HEX',
  'D',
  'E',
  'F',
  '&',
  '|',
  '7',
  '8',
  '9',
  '<<',
  '4',
  '5',
  '6',
  '>>',
  '1',
  '2',
  '3',
  '^',
  '0',
  '~',
  '%',
  '+',
  '-',
  '*',
  '/',
];

const THEMES: Theme[] = ['aurora', 'sunset', 'ocean'];

function normalizeInput(expression: string, mode: Mode): string {
  let parsed = expression.trim();

  if (!parsed) {
    return parsed;
  }

  parsed = parsed.replace(/\bln\(/g, 'log(');
  parsed = parsed.replace(/\blog\(/g, 'log10(');
  parsed = parsed.replace(/\bpi\b/g, 'pi');

  if (mode !== 'programmer') {
    return parsed;
  }

  parsed = parsed.replace(/\b([A-F])\b/g, (_, value: string) => String(parseInt(value, 16)));
  parsed = parsed.replace(/\^/g, ' xor ');
  parsed = parsed.replace(/~/g, 'bitNot ');

  return parsed;
}

function formatOutput(value: number, precision: number): string {
  if (!Number.isFinite(value)) {
    return 'NaN';
  }

  const fixed = Number(value.toFixed(precision));
  return fixed.toLocaleString(undefined, {
    maximumFractionDigits: precision,
  });
}

function evaluateExpression(
  expression: string,
  mode: Mode,
  angleUnit: AngleUnit,
  ans: number,
  memory: number,
  precision: number
): EvalResult {
  const scope = {
    ans,
    m: memory,
    sin: (x: number) => Math.sin(angleUnit === 'deg' ? (x * Math.PI) / 180 : x),
    cos: (x: number) => Math.cos(angleUnit === 'deg' ? (x * Math.PI) / 180 : x),
    tan: (x: number) => Math.tan(angleUnit === 'deg' ? (x * Math.PI) / 180 : x),
    asin: (x: number) => {
      const result = Math.asin(x);
      return angleUnit === 'deg' ? (result * 180) / Math.PI : result;
    },
    acos: (x: number) => {
      const result = Math.acos(x);
      return angleUnit === 'deg' ? (result * 180) / Math.PI : result;
    },
    atan: (x: number) => {
      const result = Math.atan(x);
      return angleUnit === 'deg' ? (result * 180) / Math.PI : result;
    },
    bitNot: (x: number) => ~Math.trunc(x),
  };

  const parsed = normalizeInput(expression, mode);
  const evaluated = math.evaluate(parsed, scope);
  const raw = Number(evaluated);

  if (Number.isNaN(raw)) {
    throw new Error('Expression did not evaluate to a number');
  }

  return {
    raw,
    result: formatOutput(raw, precision),
  };
}

function withBitToggled(current: number, bitIndex: number): number {
  return current ^ (1 << bitIndex);
}

function toInteger(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.trunc(value);
}

export default function App() {
  const [mode, setMode] = useState<Mode>('scientific');
  const [angleUnit, setAngleUnit] = useState<AngleUnit>('deg');
  const [theme, setTheme] = useState<Theme>('aurora');
  const [precision, setPrecision] = useState(8);
  const [bitWidth, setBitWidth] = useState(16);

  const [expression, setExpression] = useState('');
  const [display, setDisplay] = useState('0');
  const [error, setError] = useState('');
  const [ans, setAns] = useState(0);
  const [memory, setMemory] = useState(0);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  const integerDisplay = useMemo(() => toInteger(ans), [ans]);

  const activeKeys = useMemo(() => {
    if (mode === 'standard') {
      return STANDARD_KEYS;
    }
    if (mode === 'scientific') {
      return SCIENTIFIC_KEYS;
    }
    return PROGRAMMER_KEYS;
  }, [mode]);

  const baseValues = useMemo(() => {
    const value = toInteger(ans);
    return {
      bin: (value >>> 0).toString(2),
      oct: (value >>> 0).toString(8),
      dec: String(value),
      hex: (value >>> 0).toString(16).toUpperCase(),
    };
  }, [ans]);

  const bitGrid = useMemo(() => {
    const value = toInteger(ans) >>> 0;
    const values: number[] = [];

    for (let i = bitWidth - 1; i >= 0; i -= 1) {
      values.push((value >> i) & 1);
    }

    return values;
  }, [ans, bitWidth]);

  function appendToken(token: string) {
    setError('');
    setExpression((current) => `${current}${token}`);
  }

  function clearAll() {
    setExpression('');
    setDisplay('0');
    setError('');
  }

  function backspace() {
    setExpression((current) => current.slice(0, -1));
  }

  function commitResult(result: EvalResult) {
    setDisplay(result.result);
    setAns(result.raw);
    setError('');

    if (expression.trim()) {
      setHistory((current) => [
        {
          id: Date.now(),
          expression,
          result: result.result,
          starred: false,
        },
        ...current.slice(0, 24),
      ]);
    }
  }

  function evaluateCurrentExpression() {
    if (!expression.trim()) {
      return;
    }

    try {
      const result = evaluateExpression(expression, mode, angleUnit, ans, memory, precision);
      commitResult(result);
    } catch {
      setError('Invalid expression');
    }
  }

  function handleKeyPress(key: string) {
    const keyName = key === 'C_HEX' ? 'C' : key;

    if (keyName === 'C') {
      clearAll();
      return;
    }
    if (keyName === 'Back') {
      backspace();
      return;
    }

    appendToken(keyName);
  }

  function applyMemoryAction(action: 'MC' | 'MR' | 'MS' | 'M+' | 'M-') {
    if (action === 'MC') {
      setMemory(0);
      return;
    }

    if (action === 'MR') {
      appendToken(String(memory));
      return;
    }

    if (action === 'MS') {
      setMemory(ans);
      return;
    }

    if (action === 'M+') {
      setMemory((current) => current + ans);
      return;
    }

    setMemory((current) => current - ans);
  }

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        evaluateCurrentExpression();
      }

      if (event.key === 'Escape') {
        event.preventDefault();
        clearAll();
      }

      if (event.key === 'Backspace') {
        event.preventDefault();
        backspace();
      }

      if (/^[0-9+\-*/().%]$/.test(event.key)) {
        appendToken(event.key);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  return (
    <main className={`app app-${theme}`}>
      <div className="bg-orb orb-a" aria-hidden="true" />
      <div className="bg-orb orb-b" aria-hidden="true" />

      <section className="calculator-shell">
        <header className="top-bar">
          <div>
            <h1>Quantum Calculator</h1>
            <p>Expression engine, scientific stack, bitwise lab, and productivity memory.</p>
          </div>
          <div className="top-controls">
            <select value={mode} onChange={(event) => setMode(event.target.value as Mode)}>
              <option value="standard">Standard</option>
              <option value="scientific">Scientific</option>
              <option value="programmer">Programmer</option>
            </select>
            <select value={theme} onChange={(event) => setTheme(event.target.value as Theme)}>
              {THEMES.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>
        </header>

        <div className="meta-grid">
          <label>
            Angle
            <select value={angleUnit} onChange={(event) => setAngleUnit(event.target.value as AngleUnit)}>
              <option value="deg">Degrees</option>
              <option value="rad">Radians</option>
            </select>
          </label>
          <label>
            Precision: {precision}
            <input
              type="range"
              min={2}
              max={14}
              value={precision}
              onChange={(event) => setPrecision(Number(event.target.value))}
            />
          </label>
          <label>
            Bit Width: {bitWidth}
            <select value={bitWidth} onChange={(event) => setBitWidth(Number(event.target.value))}>
              <option value={8}>8-bit</option>
              <option value={16}>16-bit</option>
              <option value={32}>32-bit</option>
            </select>
          </label>
        </div>

        <section className="display-panel">
          <div className="expression-row">{expression || '0'}</div>
          <div className="result-row">{display}</div>
          {error && <div className="error-row">{error}</div>}
        </section>

        <section className="quick-actions">
          <button onClick={() => appendToken('ans')}>ANS</button>
          <button onClick={() => appendToken('m')}>M</button>
          <button onClick={() => applyMemoryAction('MC')}>MC</button>
          <button onClick={() => applyMemoryAction('MR')}>MR</button>
          <button onClick={() => applyMemoryAction('MS')}>MS</button>
          <button onClick={() => applyMemoryAction('M+')}>M+</button>
          <button onClick={() => applyMemoryAction('M-')}>M-</button>
          <button
            onClick={() => {
              navigator.clipboard.writeText(display).catch(() => undefined);
            }}
          >
            Copy
          </button>
          <button className="equal-button" onClick={evaluateCurrentExpression}>
            =
          </button>
        </section>

        <section className="keypad">
          {activeKeys.map((key) => (
            <button
              key={key}
              className={
                key === 'C' || key === 'C_HEX'
                  ? 'danger'
                  : key === 'Back'
                    ? 'utility'
                    : /[+\-*/%|&^]|<<|>>/.test(key)
                      ? 'operator'
                      : ''
              }
              onClick={() => handleKeyPress(key)}
            >
              {key === 'C_HEX' ? 'C' : key}
            </button>
          ))}

          {mode !== 'standard' && (
            <>
              {FUNCTION_INSERTS.map((item) => (
                <button key={item} className="function" onClick={() => appendToken(item)}>
                  {item.replace('(', '')}
                </button>
              ))}
            </>
          )}
        </section>

        {mode === 'programmer' && (
          <section className="programmer-panel">
            <h2>Programmer Lens</h2>
            <div className="bases">
              <div>
                <span>BIN</span>
                <strong>{baseValues.bin}</strong>
              </div>
              <div>
                <span>OCT</span>
                <strong>{baseValues.oct}</strong>
              </div>
              <div>
                <span>DEC</span>
                <strong>{baseValues.dec}</strong>
              </div>
              <div>
                <span>HEX</span>
                <strong>{baseValues.hex}</strong>
              </div>
            </div>
            <div className="bit-grid">
              {bitGrid.map((bit, index) => {
                const bitPosition = bitWidth - index - 1;
                return (
                  <button
                    key={`${bitPosition}-${bit}`}
                    className={bit ? 'active' : ''}
                    onClick={() => {
                      const updated = withBitToggled(integerDisplay, bitPosition);
                      setAns(updated);
                      setDisplay(String(updated));
                    }}
                  >
                    <span>{bit}</span>
                    <small>b{bitPosition}</small>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        <section className="history-panel">
          <h2>History</h2>
          {history.length === 0 && <p>No entries yet. Run an expression to populate history.</p>}
          {history.map((entry) => (
            <article key={entry.id}>
              <button
                className="star"
                onClick={() => {
                  setHistory((current) =>
                    current.map((item) =>
                      item.id === entry.id ? { ...item, starred: !item.starred } : item
                    )
                  );
                }}
              >
                {entry.starred ? 'Starred' : 'Star'}
              </button>
              <div className="history-body">
                <code>{entry.expression}</code>
                <strong>{entry.result}</strong>
              </div>
              <button
                onClick={() => {
                  setExpression(entry.expression);
                  setDisplay(entry.result);
                }}
              >
                Reuse
              </button>
            </article>
          ))}
        </section>
      </section>
    </main>
  );
}
