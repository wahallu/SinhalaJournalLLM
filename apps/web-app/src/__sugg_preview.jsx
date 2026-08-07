/* TEMPORARY — delete after verifying the suggestion apply/hover flow. */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { CorrectedText, SuggestionsList } from './components/CorrectionsView';
import { useAcceptedSuggestions } from './lib/suggestions';
import './index.css';

const TEXT = 'ගුණසේකර මහතා ජුනි මාසයේ පොලීසිය වෙත ගොස් දුෂණ චෝදනා ගැන පැමිණිල්ලක් කළා.';

const corrections = [
  { position: 0, original: 'ගුනවර්ධන', corrected: 'ගුණසේකර', type: 'grammar', rule: 'Grammar correction',
    suspicious: true, suspicious_reason: 'This looks like one name replaced by a different name, not a spelling correction. Verify against the source before publishing.' },
  { position: 30, original: 'පොලිසිය', corrected: 'පොලීසිය', type: 'spelling', rule: 'Spelling correction', suspicious: false },
];

// Offsets must index TEXT exactly, or the mark is dropped by design.
const suggestions = [
  { position: TEXT.indexOf('ජුනි'), original: 'ජුනි', suggestion: 'ජූනි', seen: 0, suggestion_seen: 5522 },
  { position: TEXT.indexOf('දුෂණ'), original: 'දුෂණ', suggestion: 'දූෂණ', seen: 0, suggestion_seen: 5749 },
];

function Demo() {
  const accepted = useAcceptedSuggestions(TEXT, suggestions);
  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: 32, background: '#fff' }}>
      <h1 style={{ font: '700 19px system-ui', marginBottom: 6 }}>Suggestion apply — visual check</h1>
      <p style={{ font: '400 12px system-ui', color: '#7b7676', marginBottom: 20 }}>
        Hover or tab to a dotted word. Applied: {accepted.acceptedCount}
      </p>

      <div style={{ border: '1px solid #f0efef', borderRadius: 14, padding: 18, marginBottom: 22 }}>
        <p className="font-sinhala" style={{ fontSize: 15, lineHeight: 2.1 }}>
          <CorrectedText
            text={TEXT}
            corrections={corrections}
            suggestions={suggestions}
            acceptedKeys={accepted.acceptedKeys}
            onAccept={accepted.toggle}
          />
        </p>
      </div>

      <p style={{ font: '600 11px system-ui', color: '#7b7676', marginBottom: 8 }}>RESOLVED TEXT (what Copy sends)</p>
      <pre id="resolved" className="font-sinhala"
        style={{ fontSize: 13, background: '#f8f7f7', padding: 12, borderRadius: 10, whiteSpace: 'pre-wrap', marginBottom: 22 }}>
        {accepted.text}
      </pre>

      <SuggestionsList
        suggestions={suggestions}
        acceptedKeys={accepted.acceptedKeys}
        onAccept={accepted.toggle}
        onAcceptAll={accepted.acceptAll}
      />
    </div>
  );
}

createRoot(document.getElementById('root')).render(<React.StrictMode><Demo /></React.StrictMode>);
