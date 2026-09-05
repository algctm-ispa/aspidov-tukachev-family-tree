// Site-wide configuration. Update these as the family data grows.
const SITE_CONFIG = {
  // The couple this whole tree is anchored around (generation 0).
  anchorPersonIds: ["vladimir_vitalievich_aspidov", "lyudmila_mikhailovna_tukacheva"],

  // A person with no recorded death and a birth year within this many years
  // of "now" is treated as possibly still living: their birth date is shown
  // as a year only (no month/day), for privacy.
  livingThresholdYears: 100,
  currentYear: 2026,

  // Google Form for corrections / photo submissions.
  // Filled in once the form is created (see js/form-links.js).
  correctionForm: {
    baseUrl: "https://docs.google.com/forms/d/e/1FAIpQLSeWxikSAu3mH1aC-zs6a9PUGaMHNZ2Ur_S5OtoJKXpsI1M8MQ/viewform",
    personEntryId: "entry.1268214938",
    ready: true
  },

  layout: {
    generationHeight: 220,
    minNodeSpacing: 232,
    spouseGap: 16,
    nodeWidth: 212,
    nodeHeight: 92
  }
};
