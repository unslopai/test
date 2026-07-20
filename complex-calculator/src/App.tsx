import { useState, useEffect, useMemo } from 'react';
import { create, all } from 'mathjs';
import { 
  Calculator, Binary, Activity, ArrowRightLeft, 
  Moon, Sun, Trash2, 
  Zap, ChevronRight
} from 'lucide-react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer 
} from 'recharts';

const math = create(all, {});

type AppMode = 'calculator' | 'programmer' | 'graphing' | 'converter';
type CalcMode = 'standard' | 'scientific';
type Theme = 'dark' | 'light' | 'neon';

type HistoryEntry = {
  id: number;
  expression: string;
  result: string;
};

// Conversions mapping
const units = {
  Length: {
    Meter: 1,
    Kilometer: 1000,
    Centimeter: 0.01,
    Millimeter: 0.001,
    Mile: 1609.34,
    Yard: 0.9144,
    Foot: 0.3048,
    Inch: 0.0254
  },
  Weight: {
    Kilogram: 1,
    Gram: 0.001,
    Milligram: 0.000001,
    MetricTon: 1000,
    LongTon: 1016.05,
    ShortTon: 907.185,
    Pound: 0.453592,
    Ounce: 0.0283495
  },
  Temperature: {
    Celsius: 'C',
    Fahrenheit: 'F',
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

export default function App() {
  const [appMode, setAppMode] = useState<AppMode>('calculator');
  const [calcMode, setCalcMode] = useState<CalcMode>('scientific');
  const [theme, setTheme] = useState<Theme>('dark');
  
  const [expression, setExpression] = useState('');
  const [display, setDisplay] = useState('0');
  const [ans, setAns] = useState(0);
  const [memory, setMemory] = useState(0);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  
  // Graphing State
  const [graphExpr, setGraphExpr] = useState('sin(x) * x');
  const [graphData, setGraphData] = useState<any[]>([]);

  // Converter State
  const [convertCategory, setConvertCategory] = useState<keyof typeof units>('Length');
  const [fromUnit, setFromUnit] = useState('Meter');
  const [toUnit, setToUnit] = useState('Foot');
  const [fromValue, setFromValue] = useState('1');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // Handle calculator keys
  const appendToken = (token: string) => {
    let toAppend = token;
    if (['sin', 'cos', 'tan', 'asin', 'acos', 'atan', 'sqrt', 'log', 'ln', 'exp', 'abs'].includes(token)) {
      toAppend = token + '(';
    }
    setExpression(prev => prev + toAppend);
  };

  const clearAll = () => {
    setExpression('');
    setDisplay('0');
  };

  const backspace = () => {
    setExpression(prev => prev.slice(0, -1));
  };

  const evaluateCurrent = () => {
    if (!expression.trim()) return;
    try {
      let parsed = expression.replace(/C_HEX/g, 'C').replace(/AND/g, ' and ').replace(/OR/g, ' or ').replace(/XOR/g, ' xor ').replace(/NOT/g, ' not ');
      const result = math.evaluate(parsed, { ans, pi: Math.PI, e: Math.E });
      const raw = Number(result);
      if (isNaN(raw)) throw new Error('NaN');
      
      const formatted = Number.isInteger(raw) ? String(raw) : Number(raw.toFixed(8)).toString();
      setDisplay(formatted);
      setAns(raw);
      setHistory(prev => [{ id: Date.now(), expression, result: formatted }, ...prev.slice(0, 49)]);
      setExpression(''); // Auto clear expression on equals for better usability
    } catch {
      setDisplay('Error');
    }
  };

  const handleKeyPress = (key: string) => {
    if (key === 'C') return clearAll();
    if (key === 'Back') return backspace();
    if (key === '=') return evaluateCurrent();
    if (key === 'pi') return appendToken('pi');
    if (key === 'e') return appendToken('e');
    appendToken(key);
  };

  // Memory operations
  const memoryOp = (op: string) => {
    if (op === 'MC') setMemory(0);
    if (op === 'MR') appendToken(String(memory));
    if (op === 'M+') setMemory(m => m + ans);
    if (op === 'M-') setMemory(m => m - ans);
    if (op === 'MS') setMemory(ans);
  };

  // Keyboard support
  useEffect(() => {
    if (appMode !== 'calculator' && appMode !== 'programmer') return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter') { e.preventDefault(); evaluateCurrent(); }
      else if (e.key === 'Escape') clearAll();
      else if (e.key === 'Backspace') backspace();
      else if (/^[0-9+\-*/().%^!]$/.test(e.key)) appendToken(e.key);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  // Graphing execution
  const plotGraph = () => {
    try {
      const data = [];
      const node = math.parse(graphExpr);
      const compiled = node.compile();
      for (let x = -10; x <= 10; x += 0.5) {
        data.push({ x, y: compiled.evaluate({ x }) });
      }
      setGraphData(data);
    } catch (e) {
      console.error(e);
    }
  };

  // Programmer values
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

  // Converter execution
  const convertedValue = useMemo(() => {
    const v = Number(fromValue);
    if (isNaN(v)) return '0';
    if (convertCategory === 'Temperature') {
      if (fromUnit === toUnit) return v.toString();
      let c = v;
      if (fromUnit === 'Fahrenheit') c = (v - 32) * 5/9;
      if (fromUnit === 'Kelvin') c = v - 273.15;
      
      if (toUnit === 'Celsius') return c.toFixed(4);
      if (toUnit === 'Fahrenheit') return (c * 9/5 + 32).toFixed(4);
      if (toUnit === 'Kelvin') return (c + 273.15).toFixed(4);
    } else {
      const cat = units[convertCategory] as any;
      const baseV = v * cat[fromUnit];
      return (baseV / cat[toUnit]).toFixed(6).replace(/\.?0+$/, '');
    }
    return '0';
  }, [fromValue, fromUnit, toUnit, convertCategory]);

  return (
    <div className="app-container">
      {/* Sidebar */}
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

        <div className="bottom-actions">
          <button onClick={() => setTheme(theme === 'dark' ? 'light' : theme === 'light' ? 'neon' : 'dark')} title="Theme">
            {theme === 'dark' ? <Moon size={24}/> : theme === 'light' ? <Sun size={24}/> : <Zap size={24}/>}
          </button>
        </div>
      </nav>

      {/* Main Content */}
      <main className="main-content">
        <header className="topbar">
          <h2>
            {appMode === 'calculator' ? 'Calculator' : 
             appMode === 'programmer' ? 'Programmer Lab' : 
             appMode === 'graphing' ? 'Graphing Plotter' : 'Unit Converter'}
          </h2>
          
          {appMode === 'calculator' && (
            <div className="topbar-controls">
              <select value={calcMode} onChange={e => setCalcMode(e.target.value as CalcMode)}>
                <option value="standard">Standard</option>
                <option value="scientific">Scientific</option>
              </select>
            </div>
          )}
        </header>

        {appMode === 'calculator' && (
          <div className="calculator-view">
            <div className="calc-left">
              <div className="display-area">
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
                <div className="expression">{expression || '\u00A0'}</div>
                <div className="result">{display}</div>
              </div>

              <div className={`keyboard ${calcMode}`}>
                {(calcMode === 'standard' ? STANDARD_KEYS : SCIENTIFIC_KEYS).map(key => (
                  <button 
                    key={key} 
                    className={`key ${
                      ['C', 'Back'].includes(key) ? 'action' : 
                      ['/', '*', '-', '+'].includes(key) ? 'operator' : 
                      key === '=' ? 'equals' : 
                      !['0','1','2','3','4','5','6','7','8','9','.'].includes(key) ? 'scientific-fn' : ''
                    }`}
                    onClick={() => handleKeyPress(key)}
                  >
                    {key === 'Back' ? '⌫' : key === 'pi' ? 'π' : key === 'sqrt' ? '√' : key}
                  </button>
                ))}
              </div>
            </div>

            <div className="history-panel">
              <div className="history-header">
                <h3>History</h3>
                <button className="clear-btn" onClick={() => setHistory([])} title="Clear History">
                  <Trash2 size={18} />
                </button>
              </div>
              <div className="history-list">
                {history.map(item => (
                  <div key={item.id} className="history-item" onClick={() => { setExpression(item.expression); setDisplay(item.result); }}>
                    <div className="expr">{item.expression}</div>
                    <div className="res">{item.result}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {appMode === 'programmer' && (
          <div className="calculator-view">
            <div className="calc-left">
              <div className="display-area" style={{minHeight: '120px', marginBottom: '16px'}}>
                <div className="expression">{expression || '\u00A0'}</div>
                <div className="result">{display}</div>
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
                    <button key={bitIdx} className={`bit-btn ${bit === '1' ? 'active' : ''}`} onClick={() => toggleBit(bitIdx)}>
                      <span>{bit}</span>
                      <small>{bitIdx}</small>
                    </button>
                  );
                })}
              </div>

              <div className="keyboard programmer">
                {PROGRAMMER_KEYS.map(key => (
                  <button 
                    key={key} 
                    className={`key ${
                      ['C', 'Back'].includes(key) ? 'action' : 
                      ['/', '*', '-', '+', 'AND', 'OR', 'XOR', 'NOT', '<<', '>>'].includes(key) ? 'operator' : 
                      key === '=' ? 'equals' : ''
                    }`}
                    onClick={() => handleKeyPress(key)}
                  >
                    {key === 'Back' ? '⌫' : key === 'C_HEX' ? 'C' : key}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {appMode === 'graphing' && (
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
                {graphData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={graphData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                      <XAxis dataKey="x" stroke="var(--text-muted)" />
                      <YAxis stroke="var(--text-muted)" />
                      <Tooltip contentStyle={{background: 'var(--bg-secondary)', border: 'none', borderRadius: '8px'}} />
                      <Line type="monotone" dataKey="y" stroke="var(--accent-purple)" dot={false} strokeWidth={3} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div style={{height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)'}}>
                    Enter a function and plot to see graph
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {appMode === 'converter' && (
          <div className="special-view">
            <div className="card">
              <h3>Unit Converter</h3>
              
              <div style={{marginBottom: '24px'}}>
                <select 
                  value={convertCategory} 
                  onChange={e => {
                    const cat = e.target.value as keyof typeof units;
                    setConvertCategory(cat);
                    const keys = Object.keys(units[cat]);
                    setFromUnit(keys[0]);
                    setToUnit(keys[1] || keys[0]);
                  }}
                  style={{width: '100%', maxWidth: '300px', fontSize: '1.1rem'}}
                >
                  {Object.keys(units).map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div className="converter-grid">
                <div className="converter-box">
                  <select value={fromUnit} onChange={e => setFromUnit(e.target.value)}>
                    {Object.keys(units[convertCategory]).map(u => (
                      <option key={u} value={u}>{u}</option>
                    ))}
                  </select>
                  <input type="number" value={fromValue} onChange={e => setFromValue(e.target.value)} />
                </div>
                
                <div style={{color: 'var(--accent-purple)', margin: '0 16px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: '48px'}}>
                  <ChevronRight size={32} />
                </div>

                <div className="converter-box">
                  <select value={toUnit} onChange={e => setToUnit(e.target.value)}>
                    {Object.keys(units[convertCategory]).map(u => (
                      <option key={u} value={u}>{u}</option>
                    ))}
                  </select>
                  <input type="text" value={convertedValue} readOnly style={{background: 'rgba(0,0,0,0.1)'}} />
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
