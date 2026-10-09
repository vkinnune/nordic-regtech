/* ---------- REGULATORY MONITORING FEED DATA (Horizon Tracking & Supervisory Stream) ---------- */

import feedItems from './feed_items.json';

export const FEED_CATEGORIES = {
  AMENDMENT: { id: 'AMENDMENT', label: 'Statutory Amendment', icon: 'file-diff' },
  CIRCULAR: { id: 'CIRCULAR', label: 'Supervisory Circular', icon: 'bell' },
  ENFORCEMENT: { id: 'ENFORCEMENT', label: 'Enforcement & Sanction', icon: 'alert-triangle' },
  TECHNICAL_STANDARD: { id: 'TECHNICAL_STANDARD', label: 'Technical Standard / RTS', icon: 'binary' },
  CONSULTATION: { id: 'CONSULTATION', label: 'Consultation Paper', icon: 'message-square' },
};

export const FEED_AUTHORITIES = {
  fi: { id: 'fi', label: 'Finansinspektionen (Swedish FSA)', short: 'FI', flag: '🇸🇪', icon: 'landmark', jur: 'SE' },
  riksdagen: { id: 'riksdagen', label: 'Swedish Parliament (Sveriges Riksdag)', short: 'Riksdagen', flag: '🇸🇪', icon: 'scale', jur: 'SE' },
  fiva: { id: 'fiva', label: 'FIN-FSA (Financial Supervisory Authority)', short: 'FIN-FSA', flag: '🇫🇮', icon: 'shield-check', jur: 'FI' },
  'fin-fsa': { id: 'fin-fsa', label: 'FIN-FSA (Financial Supervisory Authority)', short: 'FIN-FSA', flag: '🇫🇮', icon: 'shield-check', jur: 'FI' },
  eba: { id: 'eba', label: 'European Banking Authority', short: 'EBA', flag: '🇪🇺', icon: 'building-2', jur: 'EU' },
  esma: { id: 'esma', label: 'European Securities and Markets Authority', short: 'ESMA', flag: '🇪🇺', icon: 'activity', jur: 'EU' },
  konsumentverket: { id: 'konsumentverket', label: 'Swedish Consumer Agency', short: 'SCA', flag: '🇸🇪', icon: 'shopping-bag', jur: 'SE' },
  imy: { id: 'imy', label: 'Swedish Privacy Authority (IMY)', short: 'IMY', flag: '🇸🇪', icon: 'lock', jur: 'SE' },
  traficom: { id: 'traficom', label: 'Traficom NCSC-FI (Cyber Security Centre)', short: 'NCSC-FI', flag: '🇫🇮', icon: 'radio', jur: 'FI' },
  riksbank: { id: 'riksbank', label: 'Sveriges Riksbank (Central Bank)', short: 'Riksbank', flag: '🇸🇪', icon: 'landmark', jur: 'SE' },
  eduskunta: { id: 'eduskunta', label: 'Parliament of Finland (Eduskunta)', short: 'Eduskunta', flag: '🇫🇮', icon: 'scale', jur: 'FI' },
  tulli: { id: 'tulli', label: 'Finnish Customs (Tulli)', short: 'Tulli', flag: '🇫🇮', icon: 'shield', jur: 'FI' },
  domstol: { id: 'domstol', label: 'Swedish Courts (Domstolsverket)', short: 'Domstol', flag: '🇸🇪', icon: 'gavel', jur: 'SE' },
  tietosuoja: { id: 'tietosuoja', label: 'Data Protection Ombudsman (Tietosuoja)', short: 'Tietosuoja', flag: '🇫🇮', icon: 'lock', jur: 'FI' },
  finanssiala: { id: 'finanssiala', label: 'Finance Finland (Finanssiala)', short: 'FFI', flag: '🇫🇮', icon: 'briefcase', jur: 'FI' },
};

export const FEED_ITEMS = feedItems;
