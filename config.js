// Fill this in once Flow 0 ("PWA-intake") exists in Power Automate --
// its HTTP-trigger URL is the only secret this app needs. Treat it like a
// password: don't commit the real value to a public repo.
const CONFIG = {
  flowUrl: "REPLACE_WITH_FLOW_0_HTTP_TRIGGER_URL",

  // Hardcoded per CLAUDE.md -- editing this list means editing the code
  // and redeploying, which is fine at this scale.
  employees: ["Edwin", "Niels", "Stijn"],
  categories: ["Hotel", "Taxi", "Vlucht", "Eten", "Anders"],
  clients: ["Arpa", "Trespa", "Zelf"],
};
