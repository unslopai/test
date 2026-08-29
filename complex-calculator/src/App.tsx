import { useState, useEffect, useMemo, useCallback } from 'react';
import { create, all } from 'mathjs';
import { 
  Calculator, Binary, Activity, ArrowRightLeft, DollarSign,
  Moon, Sun, Trash2, 
  Zap, ChevronRight, Grid
} from 'lucide-react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer 
} from 'recharts';

const math = create(all, {});

type AppMode = 'calculator' | 'programmer' | 'graphing' | 'converter' | 'financial' | 'matrix';
type CalcMode = 'standard' | 'scientific';
type Theme = 'dark' | 'light' | 'neon';

type HistoryEntry = {
  id: number;
  expression: string;
  result: string;
};

interface GraphPoint {
  x: number;
  y: number;
}

type UnitCategory = 'Length' | 'Weight' | 'Temperature';

const MAX_HISTORY_SLICES = 49;
const GRAPH_X_MIN = -10;
const GRAPH_X_MAX = 10;
const GRAPH_X_STEP = 0.5;

// MathJS unit symbol mapping for DRY unit conversion
const unitSymbols: Record<UnitCategory, Record<string, string>> = {
  Length: {
    Meter: 'm',
    Kilometer: 'km',
    Centimeter: 'cm',
    Millimeter: 'mm',
    Mile: 'mi',
    Yard: 'yd',
    Foot: 'ft',
    Inch: 'in'
  },
  Weight: {
    Kilogram: 'kg',
    Gram: 'g',
    Milligram: 'mg',
    MetricTon: 'tonne',
    LongTon: 'longton',
    ShortTon: 'shortton',
    Pound: 'lb',
    Ounce: 'oz'
  },
  Temperature: {
    Celsius: 'degC',
    Fahrenheit: 'degF',
    Kelvin: 'K'
  }
};

const STANDARD_KEYS = ['C', '(', ')', '/', '7', '8', '9', '*', '4', '5', '6', '-', '1', '2', '3', '+', '0', '.', 'Back', '='];
const SCIENTIFIC_KEYS = [
  'sin', 'cos', 'tan', 'C', 'Back',
  'asin', 'acos', 'atan', '(', ')',
  'sqrt', 'log', 'ln', '7', '8', '9', '/',
  'pi', 'e', '^', '4', '5', '6', '*',
  '!', 'exp', 'abs', '1', '2', '3', '-',
  '0', '.', '%', '+', '='
];
const PROGRAMMER_KEYS = [
  'A', 'B', 'C_HEX', 'C', 'Back',
  'D', 'E', 'F', '(', ')',
  '<<', '>>', 'AND', '7', '8', '9', '/',
  'OR', 'XOR', 'NOT', '4', '5', '6', '*',
  '1', '2', '3', '-', '0', '+', '=', 
];

function getThemeIcon(theme: Theme) {
  if (theme === 'dark') return <Moon size={24} />;
  if (theme === 'light') return <Sun size={24} />;
  return <Zap size={24} />;
}

function getKeyClass(key: string): string {
  if (['C', 'Back'].includes(key)) return 'key action';
  if (['/', '*', '-', '+'].includes(key)) return 'key operator';
  if (key === '=') return 'key equals';
  if (!['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '.'].includes(key)) return 'key scientific-fn';
  return 'key';
}

function getKeyLabel(key: string): string {
  if (key === 'Back') return '⌫';
  if (key === 'pi') return 'π';
  if (key === 'sqrt') return '√';
  return key;
}

function getProgKeyClass(key: string): string {
  if (['C', 'Back'].includes(key)) return 'key action';
  if (['/', '*', '-', '+', 'AND', 'OR', 'XOR', 'NOT', '<<', '>>'].includes(key)) return 'key operator';
  if (key === '=') return 'key equals';
  return 'key';
}

interface SidebarProps {
  appMode: AppMode;
  setAppMode: (mode: AppMode) => void;
  theme: Theme;
  setTheme: React.Dispatch<React.SetStateAction<Theme>>;
}

function Sidebar({ appMode, setAppMode, theme, setTheme }: SidebarProps) {
  const toggleTheme = () => {
    setTheme(prev => (prev === 'dark' ? 'light' : prev === 'light' ? 'neon' : 'dark'));
  };

  return (
    <nav className="sidebar">
      <button className={appMode === 'calculator' ? 'active' : ''} onClick={() => setAppMode('calculator')} title="Calculator">
        <Calculator size={24} />
      </button>
      <button className={appMode === 'programmer' ? 'active' : ''} onClick={() => setAppMode('programmer')} title="Programmer">
        <Binary size={24} />
      </button>
      <button className={appMode === 'graphing' ? 'active' : ''} onClick={() => setAppMode('graphing')} title="Graphing">
        <Activity size={24} />
      </button>
      <button className={appMode === 'converter' ? 'active' : ''} onClick={() => setAppMode('converter')} title="Converter">
        <ArrowRightLeft size={24} />
      </button>
      <button className={appMode === 'financial' ? 'active' : ''} onClick={() => setAppMode('financial')} title="Financial">
        <DollarSign size={24} />
      </button>
      <button className={appMode === 'matrix' ? 'active' : ''} onClick={() => setAppMode('matrix')} title="Matrix Studio">
        <Grid size={24} />
      </button>

      <div className="bottom-actions">
        <button onClick={toggleTheme} title="Theme">
          {getThemeIcon(theme)}
        </button>
      </div>
    </nav>
  );
}

interface TopbarProps {
  appMode: AppMode;
  calcMode: CalcMode;
  setCalcMode: (mode: CalcMode) => void;
}

function Topbar({ appMode, calcMode, setCalcMode }: TopbarProps) {
  const titles: Record<AppMode, string> = {
    calculator: 'Calculator',
    programmer: 'Programmer Lab',
    graphing: 'Graphing Plotter',
    converter: 'Unit Converter',
    financial: 'Financial Calculator',
    matrix: 'Matrix Studio & Linear Algebra'
  };

  return (
    <header className="topbar">
      <h2>{titles[appMode]}</h2>
      {appMode === 'calculator' && (
        <div className="topbar-controls">
          <select value={calcMode} onChange={e => setCalcMode(e.target.value as CalcMode)}>
            <option value="standard">Standard</option>
            <option value="scientific">Scientific</option>
          </select>
        </div>
      )}
    </header>
  );
}

function HistoryItem({ item, onClick }: { item: HistoryEntry; onClick: () => void }) {
  return (
    <div className="history-item" onClick={onClick}>
      <div className="expr">{item.expression}</div>
      <div className="res">{item.result}</div>
    </div>
  );
}

interface HistoryPanelProps {
  history: HistoryEntry[];
  setHistory: React.Dispatch<React.SetStateAction<HistoryEntry[]>>;
  setExpression: (expr: string) => void;
  setDisplay: (disp: string) => void;
}

function HistoryPanel({ history, setHistory, setExpression, setDisplay }: HistoryPanelProps) {
  return (
    <div className="history-panel">
      <div className="history-header">
        <h3>History</h3>
        <button className="clear-btn" onClick={() => setHistory([])} title="Clear History">
          <Trash2 size={18} />
        </button>
      </div>
      <div className="history-list">
        {history.map(item => (
          <HistoryItem
            key={item.id}
            item={item}
            onClick={() => { setExpression(item.expression); setDisplay(item.result); }}
          />
        ))}
      </div>
    </div>
  );
}

function MemoryBar({ memory, memoryOp }: { memory: number; memoryOp: (op: string) => void }) {
  return (
    <div className="memory-indicator">
      {memory !== 0 && <span>M = {memory}</span>}
      <div className="memory-actions">
        <button onClick={() => memoryOp('MC')}>MC</button>
        <button onClick={() => memoryOp('MR')}>MR</button>
        <button onClick={() => memoryOp('M+')}>M+</button>
        <button onClick={() => memoryOp('M-')}>M-</button>
        <button onClick={() => memoryOp('MS')}>MS</button>
      </div>
    </div>
  );
}

interface CalculatorState {
  calcMode: CalcMode;
  expression: string;
  display: string;
  evalError: string | null;
  memory: number;
  history: HistoryEntry[];
}

interface CalculatorActions {
  handleKeyPress: (key: string) => void;
  memoryOp: (op: string) => void;
  setHistory: React.Dispatch<React.SetStateAction<HistoryEntry[]>>;
  setExpression: (expr: string) => void;
  setDisplay: (disp: string) => void;
}

interface CalculatorViewProps {
  state: CalculatorState;
  actions: CalculatorActions;
}

function CalculatorView({ state, actions }: CalculatorViewProps) {
  const { calcMode, expression, display, evalError, memory, history } = state;
  const { handleKeyPress, memoryOp, setHistory, setExpression, setDisplay } = actions;
  const keys = calcMode === 'standard' ? STANDARD_KEYS : SCIENTIFIC_KEYS;

  return (
    <div className="calculator-view">
      <div className="calc-left">
        <div className="display-area">
          <MemoryBar memory={memory} memoryOp={memoryOp} />
          <div className="expression">{expression || '\u00A0'}</div>
          <div className="result">{display}</div>
          {evalError && (
            <div className="error-context" style={{ color: '#ff4d4f', fontSize: '0.85rem', marginTop: '6px' }}>
              {evalError}
            </div>
          )}
        </div>

        <div className={`keyboard ${calcMode}`}>
          {keys.map(key => (
            <button
              key={key}
              className={getKeyClass(key)}
              onClick={() => handleKeyPress(key)}
            >
              {getKeyLabel(key)}
            </button>
          ))}
        </div>
      </div>

      <HistoryPanel history={history} setHistory={setHistory} setExpression={setExpression} setDisplay={setDisplay} />
    </div>
  );
}

function BitGridButton({ bit, bitIdx, onClick }: { bit: string; bitIdx: number; onClick: () => void }) {
  return (
    <button className={`bit-btn ${bit === '1' ? 'active' : ''}`} onClick={onClick}>
      <span>{bit}</span>
      <small>{bitIdx}</small>
    </button>
  );
}

interface ProgrammerState {
  expression: string;
  display: string;
  evalError: string | null;
}

interface ProgrammerActions {
  handleKeyPress: (key: string) => void;
  setDisplay: React.Dispatch<React.SetStateAction<string>>;
}

interface ProgrammerViewProps {
  state: ProgrammerState;
  actions: ProgrammerActions;
}

function ProgrammerView({ state, actions }: ProgrammerViewProps) {
  const { expression, display, evalError } = state;
  const { handleKeyPress, setDisplay } = actions;

  const progValues = useMemo(() => {
    const val = Math.trunc(Number(display) || 0) >>> 0;
    return {
      hex: val.toString(16).toUpperCase(),
      dec: val.toString(10),
      oct: val.toString(8),
      bin: val.toString(2).padStart(32, '0')
    };
  }, [display]);

  const toggleBit = (bitIndex: number) => {
    const val = Math.trunc(Number(display) || 0) >>> 0;
    const toggled = val ^ (1 << bitIndex);
    setDisplay(String(toggled));
  };

  return (
    <div className="calculator-view">
      <div className="calc-left">
        <div className="display-area" style={{ minHeight: '120px', marginBottom: '16px' }}>
          <div className="expression">{expression || '\u00A0'}</div>
          <div className="result">{display}</div>
          {evalError && (
            <div className="error-context" style={{ color: '#ff4d4f', fontSize: '0.85rem', marginTop: '6px' }}>
              {evalError}
            </div>
          )}
        </div>

        <div className="programmer-info">
          <div className="prog-box"><span>HEX</span><strong>{progValues.hex}</strong></div>
          <div className="prog-box"><span>DEC</span><strong>{progValues.dec}</strong></div>
          <div className="prog-box"><span>OCT</span><strong>{progValues.oct}</strong></div>
          <div className="prog-box"><span>BIN</span><strong>{progValues.bin}</strong></div>
        </div>

        <div className="bit-grid">
          {progValues.bin.split('').map((bit, idx) => {
            const bitIdx = 31 - idx;
            return (
              <BitGridButton
                key={bitIdx}
                bit={bit}
                bitIdx={bitIdx}
                onClick={() => toggleBit(bitIdx)}
              />
            );
          })}
        </div>

        <div className="keyboard programmer">
          {PROGRAMMER_KEYS.map(key => (
            <button
              key={key}
              className={getProgKeyClass(key)}
              onClick={() => handleKeyPress(key)}
            >
              {key === 'Back' ? '⌫' : key === 'C_HEX' ? 'C' : key}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function GraphPlotArea({ error, data }: { error: string | null; data: GraphPoint[] }) {
  if (error) {
    return (
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ff4d4f' }}>
        {error}
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
        Enter a function and plot to see graph
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
        <XAxis dataKey="x" stroke="var(--text-muted)" />
        <YAxis stroke="var(--text-muted)" />
        <Tooltip contentStyle={{ background: 'var(--bg-secondary)', border: 'none', borderRadius: '8px' }} />
        <Line type="monotone" dataKey="y" stroke="var(--accent-purple)" dot={false} strokeWidth={3} />
      </LineChart>
    </ResponsiveContainer>
  );
}

function GraphingView() {
  const [graphExpr, setGraphExpr] = useState('sin(x) * x');
  const [graphData, setGraphData] = useState<GraphPoint[]>([]);
  const [graphError, setGraphError] = useState<string | null>(null);

  const plotGraph = () => {
    try {
      setGraphError(null);
      const data: GraphPoint[] = [];
      const node = math.parse(graphExpr);
      const compiled = node.compile();
      for (let x = GRAPH_X_MIN; x <= GRAPH_X_MAX; x += GRAPH_X_STEP) {
        const y = compiled.evaluate({ x });
        if (typeof y === 'number' && !isNaN(y)) {
          data.push({ x, y });
        }
      }
      if (data.length === 0) {
        throw new Error('No valid numerical data points generated');
      }
      setGraphData(data);
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e));
      console.error('Failed to plot graph:', err);
      setGraphData([]);
      setGraphError(`Invalid expression: ${err.message}`);
    }
  };

  return (
    <div className="special-view">
      <div className="card">
        <h3>Plot Function</h3>
        <div className="input-group">
          <input
            type="text"
            value={graphExpr}
            onChange={e => setGraphExpr(e.target.value)}
            placeholder="e.g. sin(x) * x"
            onKeyDown={e => e.key === 'Enter' && plotGraph()}
          />
          <button className="btn-primary" onClick={plotGraph}>Plot Graph</button>
        </div>
        <div className="graph-container">
          <GraphPlotArea error={graphError} data={graphData} />
        </div>
      </div>
    </div>
  );
}

function UnitSelectBox({
  unit,
  setUnit,
  value,
  setValue,
  readOnly = false,
  unitsMap
}: {
  unit: string;
  setUnit: (u: string) => void;
  value: string;
  setValue?: (v: string) => void;
  readOnly?: boolean;
  unitsMap: Record<string, string>;
}) {
  return (
    <div className="converter-box">
      <select value={unit} onChange={e => setUnit(e.target.value)}>
        {Object.keys(unitsMap).map(u => (
          <option key={u} value={u}>{u}</option>
        ))}
      </select>
      <input
        type={readOnly ? 'text' : 'number'}
        value={value}
        onChange={setValue ? e => setValue(e.target.value) : undefined}
        readOnly={readOnly}
        style={readOnly ? { background: 'rgba(0,0,0,0.1)' } : undefined}
      />
    </div>
  );
}

function ConverterView() {
  const [convertCategory, setConvertCategory] = useState<UnitCategory>('Length');
  const [fromUnit, setFromUnit] = useState('Meter');
  const [toUnit, setToUnit] = useState('Foot');
  const [fromValue, setFromValue] = useState('1');

  const handleCategoryChange = (cat: UnitCategory) => {
    setConvertCategory(cat);
    const categoryKeys = Object.keys(unitSymbols[cat]);
    setFromUnit(categoryKeys[0]);
    setToUnit(categoryKeys[1] || categoryKeys[0]);
  };

  const { convertedValue, convertError } = useMemo(() => {
    const v = Number(fromValue);
    if (isNaN(v)) return { convertedValue: '0', convertError: null };
    try {
      const fromSymbol = unitSymbols[convertCategory][fromUnit];
      const toSymbol = unitSymbols[convertCategory][toUnit];
      if (!fromSymbol || !toSymbol) return { convertedValue: '0', convertError: null };

      const unitVal = math.unit(v, fromSymbol);
      const convertedNum = unitVal.toNumber(toSymbol);
      return {
        convertedValue: Number(convertedNum.toFixed(6)).toString(),
        convertError: null
      };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      console.error('Unit conversion failed:', err);
      return {
        convertedValue: '',
        convertError: `Conversion error: ${err.message}`
      };
    }
  }, [fromValue, fromUnit, toUnit, convertCategory]);

  const currentCategoryUnits = unitSymbols[convertCategory];

  return (
    <div className="special-view">
      <div className="card">
        <h3>Unit Converter</h3>
        <div style={{ marginBottom: '24px' }}>
          <select
            value={convertCategory}
            onChange={e => handleCategoryChange(e.target.value as UnitCategory)}
            style={{ width: '100%', maxWidth: '300px', fontSize: '1.1rem' }}
          >
            {(Object.keys(unitSymbols) as UnitCategory[]).map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>

        <div className="converter-grid">
          <UnitSelectBox
            unit={fromUnit}
            setUnit={setFromUnit}
            value={fromValue}
            setValue={setFromValue}
            unitsMap={currentCategoryUnits}
          />

          <div style={{ color: 'var(--accent-purple)', margin: '0 16px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: '48px' }}>
            <ChevronRight size={32} />
          </div>

          <UnitSelectBox
            unit={toUnit}
            setUnit={setToUnit}
            value={convertedValue}
            readOnly={true}
            unitsMap={currentCategoryUnits}
          />
        </div>

        {convertError && (
          <div style={{ color: '#ff4d4f', marginTop: '16px', textAlign: 'center', background: 'rgba(255, 77, 79, 0.1)', padding: '10px', borderRadius: '8px' }}>
            {convertError}
          </div>
        )}
      </div>
    </div>
  );
}

function FinancialInputField({
  label,
  value,
  setValue,
  step
}: {
  label: string;
  value: string;
  setValue: (v: string) => void;
  step?: string;
}) {
  return (
    <div>
      <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-muted)' }}>{label}</label>
      <input
        type="number"
        step={step}
        value={value}
        onChange={e => setValue(e.target.value)}
        style={{ width: '100%', padding: '12px', borderRadius: '8px', background: 'var(--bg-secondary)', border: '1px solid rgba(255,255,255,0.1)', color: 'inherit' }}
      />
    </div>
  );
}

function FinancialResultCard({ label, value, isAccent }: { label: string; value: string; isAccent?: boolean }) {
  return (
    <div className="prog-box" style={{ padding: '16px', background: 'var(--bg-secondary)', borderRadius: '12px' }}>
      <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>{label}</span>
      <strong style={{ fontSize: isAccent ? '1.8rem' : '1.4rem', color: isAccent ? 'var(--accent-purple)' : undefined, display: 'block', marginTop: '4px' }}>
        ${value}
      </strong>
    </div>
  );
}

function FinancialView() {
  const [finPrincipal, setFinPrincipal] = useState('250000');
  const [finRate, setFinRate] = useState('6.5');
  const [finTermYears, setFinTermYears] = useState('30');

  const { finMonthlyPayment, finTotalInterest, finTotalPayment } = useMemo(() => {
    const P = parseFloat(finPrincipal) || 0;
    const annualRate = parseFloat(finRate) || 0;
    const years = parseFloat(finTermYears) || 0;

    if (P <= 0 || annualRate <= 0 || years <= 0) {
      return { finMonthlyPayment: '0', finTotalInterest: '0', finTotalPayment: '0' };
    }

    const r = annualRate / 100 / 12;
    const n = years * 12;
    const monthly = (P * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
    const totalPay = monthly * n;
    const totalInt = totalPay - P;

    return {
      finMonthlyPayment: monthly.toFixed(2),
      finTotalPayment: totalPay.toFixed(2),
      finTotalInterest: totalInt.toFixed(2)
    };
  }, [finPrincipal, finRate, finTermYears]);

  return (
    <div className="special-view">
      <div className="card">
        <h3>Loan & Mortgage Amortization Calculator</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px', marginTop: '20px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <FinancialInputField label="Loan Amount ($)" value={finPrincipal} setValue={setFinPrincipal} />
            <FinancialInputField label="Interest Rate (% per year)" value={finRate} setValue={setFinRate} step="0.1" />
            <FinancialInputField label="Loan Term (Years)" value={finTermYears} setValue={setFinTermYears} />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', justifyContent: 'center' }}>
            <FinancialResultCard label="ESTIMATED MONTHLY PAYMENT" value={finMonthlyPayment} isAccent={true} />
            <FinancialResultCard label="TOTAL INTEREST PAID" value={finTotalInterest} />
            <FinancialResultCard label="TOTAL AMOUNT REPAID" value={finTotalPayment} />
          </div>
        </div>
      </div>
    </div>
  );
}

function MatrixView() {
  const [rows, setRows] = useState<number>(2);
  const [cols, setCols] = useState<number>(2);
  const [matrixA, setMatrixA] = useState<number[][]>([[1, 2], [3, 4]]);
  const [matrixB, setMatrixB] = useState<number[][]>([[5, 6], [7, 8]]);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleDimensionChange = (r: number, c: number) => {
    setRows(r);
    setCols(c);
    setMatrixA(Array(r).fill(0).map((_, ri) => Array(c).fill(0).map((_, ci) => matrixA[ri]?.[ci] ?? 0)));
    setMatrixB(Array(r).fill(0).map((_, ri) => Array(c).fill(0).map((_, ci) => matrixB[ri]?.[ci] ?? 0)));
  };

  const updateCellA = (r: number, c: number, val: number) => {
    const next = matrixA.map((row, ri) => row.map((cell, ci) => (ri === r && ci === c ? val : cell)));
    setMatrixA(next);
  };

  const updateCellB = (r: number, c: number, val: number) => {
    const next = matrixB.map((row, ri) => row.map((cell, ci) => (ri === r && ci === c ? val : cell)));
    setMatrixB(next);
  };

  const compute = (op: 'detA' | 'invA' | 'transposeA' | 'add' | 'multiply' | 'eigenA') => {
    setError(null);
    setResult(null);
    try {
      if (op === 'detA') {
        if (rows !== cols) throw new Error('Determinant requires a square matrix.');
        const res = math.det(matrixA);
        setResult(`Determinant of A: ${math.format(res, { precision: 6 })}`);
      } else if (op === 'invA') {
        if (rows !== cols) throw new Error('Inverse requires a square matrix.');
        const res = math.inv(matrixA);
        setResult(`Inverse of A:\n${math.format(res, { precision: 4 })}`);
      } else if (op === 'transposeA') {
        const res = math.transpose(matrixA);
        setResult(`Transpose of A:\n${math.format(res, { precision: 4 })}`);
      } else if (op === 'add') {
        const res = math.add(matrixA, matrixB);
        setResult(`A + B:\n${math.format(res, { precision: 4 })}`);
      } else if (op === 'multiply') {
        const res = math.multiply(matrixA, matrixB);
        setResult(`A × B:\n${math.format(res, { precision: 4 })}`);
      } else if (op === 'eigenA') {
        if (rows !== cols) throw new Error('Eigenvalues require a square matrix.');
        const res = math.eigs(matrixA);
        setResult(`Eigenvalues of A:\n${math.format(res.values, { precision: 4 })}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <div className="special-view">
      <div className="card">
        <h3>Matrix Operations & Linear Algebra</h3>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap' }}>
          <label style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            Rows:
            <select value={rows} onChange={e => handleDimensionChange(Number(e.target.value), cols)}>
              {[2, 3, 4].map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
          <label style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            Columns:
            <select value={cols} onChange={e => handleDimensionChange(rows, Number(e.target.value))}>
              {[2, 3, 4].map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px', marginBottom: '20px' }}>
          <div>
            <h4>Matrix A</h4>
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: '8px', marginTop: '10px' }}>
              {matrixA.map((row, r) => row.map((val, c) => (
                <input
                  key={`a-${r}-${c}`}
                  type="number"
                  value={val}
                  onChange={e => updateCellA(r, c, parseFloat(e.target.value) || 0)}
                  style={{ width: '100%', padding: '8px', textAlgn: 'center' } as any}
                />
              )))}
            </div>
          </div>

          <div>
            <h4>Matrix B</h4>
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: '8px', marginTop: '10px' }}>
              {matrixB.map((row, r) => row.map((val, c) => (
                <input
                  key={`b-${r}-${c}`}
                  type="number"
                  value={val}
                  onChange={e => updateCellB(r, c, parseFloat(e.target.value) || 0)}
                  style={{ width: '100%', padding: '8px', textAlign: 'center' } as any}
                />
              )))}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '20px' }}>
          <button className="key action" style={{ padding: '8px 16px', fontSize: '0.9rem' }} onClick={() => compute('detA')}>det(A)</button>
          <button className="key action" style={{ padding: '8px 16px', fontSize: '0.9rem' }} onClick={() => compute('invA')}>A⁻¹ (Inverse)</button>
          <button className="key action" style={{ padding: '8px 16px', fontSize: '0.9rem' }} onClick={() => compute('transposeA')}>Aᵀ (Transpose)</button>
          <button className="key action" style={{ padding: '8px 16px', fontSize: '0.9rem' }} onClick={() => compute('eigenA')}>Eigenvalues(A)</button>
          <button className="key operator" style={{ padding: '8px 16px', fontSize: '0.9rem' }} onClick={() => compute('add')}>A + B</button>
          <button className="key operator" style={{ padding: '8px 16px', fontSize: '0.9rem' }} onClick={() => compute('multiply')}>A × B</button>
        </div>

        {error && <div style={{ color: '#ef4444', marginBottom: '10px', padding: '10px', background: 'rgba(239,68,68,0.1)', borderRadius: '6px' }}>{error}</div>}
        {result && (
          <div style={{ background: 'var(--bg-secondary)', padding: '16px', borderRadius: '8px', fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>
            {result}
          </div>
        )}
      </div>
    </div>
  );
}

export default function App() {
  const [appMode, setAppMode] = useState<AppMode>('calculator');
  const [calcMode, setCalcMode] = useState<CalcMode>('scientific');
  const [theme, setTheme] = useState<Theme>('dark');

  const [expression, setExpression] = useState('');
  const [display, setDisplay] = useState('0');
  const [evalError, setEvalError] = useState<string | null>(null);
  const [ans, setAns] = useState(0);
  const [memory, setMemory] = useState(0);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const appendToken = useCallback((token: string) => {
    setEvalError(null);
    let toAppend = token;
    if (['sin', 'cos', 'tan', 'asin', 'acos', 'atan', 'sqrt', 'log', 'ln', 'exp', 'abs'].includes(token)) {
      toAppend = token + '(';
    }
    setExpression(prev => prev + toAppend);
  }, []);

  const clearAll = useCallback(() => {
    setEvalError(null);
    setExpression('');
    setDisplay('0');
  }, []);

  const backspace = useCallback(() => {
    setEvalError(null);
    setExpression(prev => prev.slice(0, -1));
  }, []);

  const evaluateCurrent = useCallback(() => {
    if (!expression.trim()) return;
    try {
      setEvalError(null);
      let parsed = expression
        .replace(/C_HEX/g, 'C')
        .replace(/AND/g, ' and ')
        .replace(/OR/g, ' or ')
        .replace(/XOR/g, ' xor ')
        .replace(/NOT/g, ' not ');
      const result = math.evaluate(parsed, { ans, pi: Math.PI, e: Math.E });
      const raw = Number(result);
      if (isNaN(raw) || !isFinite(raw)) {
        throw new Error('Evaluation produced non-finite or invalid numerical result');
      }

      const formatted = Number.isInteger(raw) ? String(raw) : Number(raw.toFixed(8)).toString();
      setDisplay(formatted);
      setAns(raw);
      setHistory(prev => [{ id: Date.now(), expression, result: formatted }, ...prev.slice(0, MAX_HISTORY_SLICES)]);
      setExpression('');
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      console.error('Failed to evaluate expression:', err);
      setDisplay('Error');
      setEvalError(`Calculation error: ${err.message}`);
    }
  }, [expression, ans]);

  const handleKeyPress = useCallback((key: string) => {
    if (key === 'C') return clearAll();
    if (key === 'Back') return backspace();
    if (key === '=') return evaluateCurrent();
    if (key === 'pi') return appendToken('pi');
    if (key === 'e') return appendToken('e');
    appendToken(key);
  }, [clearAll, backspace, evaluateCurrent, appendToken]);

  const memoryOp = useCallback((op: string) => {
    if (op === 'MC') setMemory(0);
    if (op === 'MR') appendToken(String(memory));
    if (op === 'M+') setMemory(m => m + ans);
    if (op === 'M-') setMemory(m => m - ans);
    if (op === 'MS') setMemory(ans);
  }, [appendToken, memory, ans]);

  // Keyboard support with full dependency tracking to prevent stale closures
  useEffect(() => {
    if (appMode !== 'calculator' && appMode !== 'programmer') return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        evaluateCurrent();
      } else if (e.key === 'Escape') {
        clearAll();
      } else if (e.key === 'Backspace') {
        backspace();
      } else if (/^[0-9+\-*/().%^!]$/.test(e.key)) {
        appendToken(e.key);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [appMode, evaluateCurrent, clearAll, backspace, appendToken]);

  return (
    <div className="app-container">
      <Sidebar appMode={appMode} setAppMode={setAppMode} theme={theme} setTheme={setTheme} />
      <main className="main-content">
        <Topbar appMode={appMode} calcMode={calcMode} setCalcMode={setCalcMode} />
        {appMode === 'calculator' && (
          <CalculatorView
            state={{ calcMode, expression, display, evalError, memory, history }}
            actions={{ handleKeyPress, memoryOp, setHistory, setExpression, setDisplay }}
          />
        )}
        {appMode === 'programmer' && (
          <ProgrammerView
            state={{ expression, display, evalError }}
            actions={{ handleKeyPress, setDisplay }}
          />
        )}
        {appMode === 'graphing' && <GraphingView />}
        {appMode === 'converter' && <ConverterView />}
        {appMode === 'financial' && <FinancialView />}
        {appMode === 'matrix' && <MatrixView />}
      </main>
    </div>
  );
}
