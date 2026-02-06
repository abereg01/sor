export const sv = {
  app: {
    title: "InfraGraph",
  },
  common: {
    loading: "Laddar…",
    save: "Spara",
    saving: "Sparar…",
    cancel: "Avbryt",
    close: "Stäng",
    confirm: "Bekräfta",
    clear: "Rensa",
    yes: "Ja",
    no: "Nej",
  },
  sidebar: {
    objects: "Objekt",
    relation: "Relation",
    metadata: "Extra info / attribut",
    advancedJson: "Avancerat: JSON",
  },
  queries: {
    title: "Frågor",
    impactTitle: "Påverkan (vad bryts om jag tar bort?)",
    impactHelp: "Visar vilka objekt och relationer som berörs om du tar bort ett objekt.",
    pathTitle: "Hur hänger A ihop med B?",
    pathHelp: "Hittar en väg mellan två objekt. Bra för att förstå beroenden och kopplingar.",
    complianceTitle: "Personuppgifter i flöden",
    complianceHelp:
      "Hittar flöden som sannolikt innehåller personuppgifter. Matchar objekt där metadata.classification = \"PII\" (skiftlägesokänsligt).",
    from: "Från",
    to: "Till",
    select: "— välj —",
    maxDepth: "Max djup",
    run: "Kör",
    clearHighlight: "Rensa markering",
    running: "Kör…",
  },
  metadata: {
    title: "Extra info / attribut",
    patchMerge: "PATCH merge (säkert)",
    invalidJson: "Ogiltig JSON.",
    previewTitle: "Förhandsgranskning (patch)",
    applyPatch: "Tillämpa patch",
    deleteKeysConfirmTitle: "Tar bort nycklar",
    deleteKeysConfirmBody: "Detta tar bort {count} nyckel/nycklar:\n\n{keys}\n\nFortsätt?",
  },
  delete: {
    button: "Ta bort objekt (farligt)",
    deleting: "Raderar…",
    confirmTitle: "Ta bort objekt",
    impactLine: "Detta tar även bort {edges} relationer automatiskt.",
    typeToConfirm: "Skriv RADERA för att bekräfta",
    typedPlaceholder: "RADERA",
    abort: "Avbryt",
    confirm: "RADERA",
  },
  result: {
    showingImpact: "Visar påverkan: {nodes} objekt, {edges} relationer",
    showingPath: "Visar koppling: {nodes} objekt, {edges} relationer",
    showingGeneric: "Visar resultat: {nodes} objekt, {edges} relationer",
    zoomTo: "Zooma till resultat",
  },

  datatrafik: {
    title: "Datatrafik",
    showProposals: "Visa förslag",
    showProposalsHelp:
      "Visar importerade/ej godkända ändringar som en blek overlay. Påverkar inte publicerad sanning.",

    enable: "Aktivera filter",
    enableHelp:
      "Datatrafik visas alltid. När filter är aktiva kan du begränsa vad som visas (riktning, kategori, typ).",
    direction: "Riktning",
    directionAll: "Alla",
    directionOutgoing: "Utgående (→)",
    directionIncoming: "Inkommande (←)",
    category: "Datakategori",
    categoryAll: "Alla datakategorier",
    categoryHelp:
      "Tips: skapa ‘data_category’-objekt (t.ex. PII, Ekonomi, Loggar) och koppla dem i flöden för bättre filter.",
    flowType: "Flödestyp",
    flowTypeAll: "Alla flödestyper",
    clearFilters: "Rensa filter",
    legend: "Färger",
  },

  imports: {
    title: "Import & granskning",
    refreshGraph: "Uppdatera graf",

    inbox: "Inkorg",
    newImport: "Ny import",
    refresh: "Uppdatera",

    batches: "Importbatcher",
    proposals: "Förslag i batch",

    reloadBatches: "Ladda om batcher",
    reloadProposals: "Ladda om förslag",

    noBatches: "Inga importbatcher ännu.",
    noProposalsInBatch: "Inga öppna förslag i vald batch.",

    approve: "Godkänn",
    reject: "Avvisa",

    createBatch: "Skapa importbatch",
    createBatchButton: "Skapa batch",
    createdBatch: "Skapad batch:",
    createdBatchHelp: "Skapa batch först, lägg sedan in förslag.",

    source: "Källa",
    note: "Notering",
    from: "Från",
    to: "Till",
    kind: "Relationstyp",
    confidence: "Confidence",

    addProposal: "Lägg till förslag",
    queueProposal: "Lägg i kö",
    submitProposals: "Skicka in förslag",
    queued: "Köade förslag",

    flows: "Flöden",
    flowsHelp: "Valfritt. Om tomt används implicit standardflöde.",
    addFlow: "Lägg till flöde",
    noFlows: "Inga flöden — implicit flöde används.",

    flowType: "Flödestyp",
    dataCategory: "Datakategori",
    protocol: "Protokoll",
    frequency: "Frekvens",
    none: "—",

    evidence: "Bevis",
    evidenceHelp: "Valfritt. Exempel: länk till dokument, ticket, anteckning.",
    addEvidence: "Lägg till bevis",
    noEvidence: "Inget bevis tillagt (ok).",
    evidenceType: "Typ",
    reference: "Referens",

    remove: "Ta bort",

    rejectTitle: "Avvisa förslag",
    rejectHelp:
      "Avvisning tar bort förslaget från inkorgen (det blir retired) men påverkar inte publicerad sanning.",
    reason: "Anledning (valfritt)",
    rejectConfirm: "Avvisa",
    cancel: "Avbryt",
    proposed: "Förslag",
    published: "Publicerad sanning",
  },
} as const;

export type SvDict = typeof sv;
