/* TEMPORARY — verifying names render with zero highlight/warning. */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { CorrectedText, CorrectionsList, SuggestionsList } from './components/CorrectionsView';
import ModeToggle from './components/ui/ModeToggle';
import { useResolvedText } from './lib/suggestions';
import { useSuggestionMode } from './lib/suggestionMode';
import './index.css';

const SERVER = 'ගුණසේකර මහතා ජුනි මාසයේ පොලීසිය වෙත ගොස් දුෂණ චෝදනා කරමින්.';
const corrections = [
  { position: 0, original: 'ගුනවර්ධන', corrected: 'ගුණසේකර', type: 'grammar', rule: 'Grammar correction',
    suspicious: true, suspicious_reason: 'This looks like one name replaced by a different name.' },
  { position: 30, original: 'පොලිසිය', corrected: 'පොලීසිය', type: 'spelling', rule: 'Spelling correction', suspicious: false },
];
const S = (o, sg, n) => ({ position: SERVER.indexOf(o), original: o, suggestion: sg, seen: 0, suggestion_seen: n });
const suggestions = [S('ජුනි','ජූනි',5522), S('දුෂණ','දූෂණ',5749), S('කරමින්','කරමිනි',1631)];

function Demo() {
  const [mode, setMode] = useSuggestionMode();
  const r = useResolvedText(SERVER, { corrections, suggestions, autoApply: mode === 'auto' });
  return (
    <div style={{ maxWidth: 780, margin: '0 auto', padding: 30, background: '#fff' }}>
      <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:16 }}>
        <h1 style={{ font:'700 17px system-ui', margin:0 }}>Names: no highlight, no warning</h1>
        <ModeToggle value={mode} onChange={setMode} />
      </div>
      <div id="textBlock" style={{ border:'1px solid #f0efef', borderRadius:14, padding:16, marginBottom:14 }}>
        <p className="font-sinhala" style={{ fontSize:15, lineHeight:2.2 }}>
          <CorrectedText text={r.text} marks={r.marks} onToggle={r.toggle} />
        </p>
      </div>
      <pre id="resolved" className="font-sinhala" style={{ fontSize:12, background:'#f8f7f7', padding:10, borderRadius:8, whiteSpace:'pre-wrap', marginBottom:16 }}>{r.text}</pre>
      <div id="listBlock">
        <CorrectionsList corrections={corrections} />
      </div>
      <div style={{ height: 10 }} />
      <SuggestionsList suggestions={suggestions} acceptedKeys={r.activeKeys}
        onAccept={r.toggle} onAcceptAll={r.applyAllSuggestions} />
    </div>
  );
}
createRoot(document.getElementById('root')).render(<React.StrictMode><Demo /></React.StrictMode>);
