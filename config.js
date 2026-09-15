// Fill this in once Flow 0 ("PWA-intake") exists in Power Automate --
// its HTTP-trigger URL is the only secret this app needs. Treat it like a
// password: don't commit the real value to a public repo.
// (In this repo the real value is injected at deploy time by
// .github/workflows/deploy.yml from the FLOW_URL repo secret -- never
// commit the real URL here.)
const CONFIG = {
  flowUrl: "REPLACE_WITH_FLOW_0_HTTP_TRIGGER_URL",

  // Flow 2 ("Uitbetaaloverzicht op aanvraag") HTTP-trigger URL. Same
  // deal: real value injected at deploy time from the OVERVIEW_FLOW_URL
  // repo secret -- never commit the real URL here.
  overviewFlowUrl: "REPLACE_WITH_FLOW_2_HTTP_TRIGGER_URL",

  // Flow 4 ("Uitbetaaloverzicht") HTTP-trigger URL. Same deal: real value
  // injected at deploy time from the FLOW4_URL repo secret -- never
  // commit the real URL here.
  flow4Url: "REPLACE_WITH_FLOW_4_HTTP_TRIGGER_URL",

  // Not a secret in the security sense (it's a soft speed-bump, not real
  // auth -- see app.js), but Max/Edwin should still change this from the
  // default before relying on it.
  uitbetaalPincode: "2019",

  // Hardcoded per CLAUDE.md -- editing this list means editing the code
  // and redeploying, which is fine at this scale.
  employees: ["Edwin", "Niels", "Stijn"],
  categories: ["Hotel", "Taxi", "Vlucht", "Eten", "Anders"],
  clients: ["Arpa", "Trespa", "Zelf"],
};
