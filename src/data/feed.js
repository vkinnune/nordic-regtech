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
  konsumentverket: { id: 'konsumentverket', label: 'Swedish Consumer Agency', short: 'SCA', flag: '🇸🇪', icon: 'shopping-bag', jur: 'SE' },
  imy: { id: 'imy', label: 'Swedish Privacy Authority (IMY)', short: 'IMY', flag: '🇸🇪', icon: 'lock', jur: 'SE' },
  riksbank: { id: 'riksbank', label: 'Sveriges Riksbank (Central Bank)', short: 'Riksbank', flag: '🇸🇪', icon: 'landmark', jur: 'SE' },
  domstol: { id: 'domstol', label: 'Swedish Courts (Domstolsverket)', short: 'Domstol', flag: '🇸🇪', icon: 'gavel', jur: 'SE' },
};

export const FEED_ITEMS = feedItems;
