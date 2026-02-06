use super::types::{EdgeKindInfo, NodeKindInfo};
use super::types::{KindsResponse, UiFieldHint};
use super::ui::{rk, ui_select, ui_text, ui_textarea, ui_toggle};

pub fn kinds_response() -> KindsResponse {
    fn common_node_ui_hints() -> Vec<UiFieldHint> {
        vec![
            ui_select(
                "env",
                "Miljö",
                vec!["Prod".into(), "Dev".into(), "Test".into()],
                Some("Välj miljö".into()),
                Some("Vilken miljö gäller objektet?".into()),
            ),
            ui_toggle(
                "critical",
                "Kritisk",
                Some("Markera om detta är kritiskt för verksamheten.".into()),
            ),
            ui_text(
                "owner_team",
                "Ägare (team)",
                Some("t.ex. Digit, Drift, Säkerhet".into()),
                Some("Vilket team ansvarar för detta objekt?".into()),
            ),
            ui_textarea(
                "description",
                "Beskrivning",
                Some("Kort och tydlig beskrivning".into()),
                Some("Beskriv vad objektet är och varför det finns.".into()),
            ),
        ]
    }

    fn with_common_node_hints(mut extra: Vec<UiFieldHint>) -> Vec<UiFieldHint> {
        let mut base = common_node_ui_hints();
        base.append(&mut extra);
        base
    }

    let node_kinds = vec![
        NodeKindInfo {
            kind: "system".into(),
            recommended_metadata_keys: vec![
                rk(
                    "env",
                    Some("Environment (dev/stage/prod)"),
                    Some(vec!["prod".into(), "dev".into()]),
                ),
                rk(
                    "critical",
                    Some("Critical system?"),
                    Some(vec!["true".into(), "false".into()]),
                ),
                rk("owner_team", Some("Owning team"), None),
                rk("description", Some("Description"), None),
            ],
            ui_hints: Some(with_common_node_hints(vec![
                ui_text(
                    "domain",
                    "Domän",
                    Some("t.ex. billing.karlshamnenergi.se".into()),
                    None,
                ),
                ui_text(
                    "sla",
                    "SLA",
                    Some("t.ex. 24/7, kontorstid".into()),
                    Some("Om ni har ett uttalat SLA.".into()),
                ),
            ])),
        },
        NodeKindInfo {
            kind: "service".into(),
            recommended_metadata_keys: vec![
                rk("env", Some("Environment"), Some(vec!["prod".into()])),
                rk("repo", Some("Source repository"), None),
                rk("owner_team", Some("Owning team"), None),
                rk("description", Some("Description"), None),
            ],
            ui_hints: Some(with_common_node_hints(vec![
                ui_text(
                    "repo",
                    "Repo",
                    Some("t.ex. git@... eller https://...".into()),
                    Some("Var ligger källkoden?".into()),
                ),
                ui_text(
                    "runtime",
                    "Runtime",
                    Some("t.ex. Node.js, .NET, Java".into()),
                    None,
                ),
            ])),
        },
        NodeKindInfo {
            kind: "database".into(),
            recommended_metadata_keys: vec![
                rk(
                    "engine",
                    Some("Database engine"),
                    Some(vec!["postgres".into(), "mysql".into()]),
                ),
                rk("version", Some("Engine version"), Some(vec!["16".into()])),
                rk(
                    "backup_policy",
                    Some("Backup policy summary"),
                    Some(vec!["nightly".into()]),
                ),
                rk("env", Some("Environment"), Some(vec!["prod".into()])),
                rk("owner_team", Some("Owning team"), None),
                rk(
                    "critical",
                    Some("Critical?"),
                    Some(vec!["true".into(), "false".into()]),
                ),
                rk("description", Some("Description"), None),
            ],
            ui_hints: Some(with_common_node_hints(vec![
                ui_select(
                    "engine",
                    "Databasmotor",
                    vec![
                        "Postgres".into(),
                        "MySQL".into(),
                        "MSSQL".into(),
                        "MongoDB".into(),
                        "Redis".into(),
                    ],
                    Some("Välj motor".into()),
                    None,
                ),
                ui_text("version", "Version", Some("t.ex. 16".into()), None),
                ui_text(
                    "backup_policy",
                    "Backup-policy",
                    Some("t.ex. nattlig + WAL".into()),
                    None,
                ),
                ui_text(
                    "host",
                    "Driftplats/host",
                    Some("t.ex. ds-db01".into()),
                    Some("Var kör databasen?".into()),
                ),
            ])),
        },
        NodeKindInfo {
            kind: "host".into(),
            recommended_metadata_keys: vec![
                rk(
                    "role",
                    Some("Host role"),
                    Some(vec!["swarm-manager".into(), "windows-server".into()]),
                ),
                rk(
                    "os",
                    Some("OS"),
                    Some(vec!["ubuntu".into(), "windows".into()]),
                ),
                rk("site", Some("Site / location"), None),
                rk("env", Some("Environment"), Some(vec!["prod".into()])),
                rk("owner_team", Some("Owning team"), None),
                rk(
                    "critical",
                    Some("Critical?"),
                    Some(vec!["true".into(), "false".into()]),
                ),
                rk("description", Some("Description"), None),
            ],
            ui_hints: Some(with_common_node_hints(vec![
                ui_text(
                    "role",
                    "Roll",
                    Some("t.ex. Swarm worker, DB-host, Filserver".into()),
                    None,
                ),
                ui_select(
                    "os",
                    "Operativsystem",
                    vec!["Linux".into(), "Windows".into(), "BSD".into()],
                    None,
                    None,
                ),
                ui_text("site", "Plats", Some("t.ex. Kontor, DC1, DC2".into()), None),
                ui_text("ip", "IP-adress", Some("t.ex. 10.1.2.3".into()), None),
            ])),
        },
        NodeKindInfo {
            kind: "vendor".into(),
            recommended_metadata_keys: vec![
                rk("contact", Some("Vendor contact"), None),
                rk("contract_ref", Some("Contract reference"), None),
                rk("owner_team", Some("Owning team"), None),
                rk("description", Some("Description"), None),
            ],
            ui_hints: Some(with_common_node_hints(vec![
                ui_text(
                    "contact",
                    "Kontakt",
                    Some("t.ex. support@leverantor.se".into()),
                    None,
                ),
                ui_text(
                    "contract_ref",
                    "Avtalsreferens",
                    Some("t.ex. Avtal-2024-12".into()),
                    None,
                ),
            ])),
        },
        NodeKindInfo {
            kind: "team".into(),
            recommended_metadata_keys: vec![
                rk("contact", Some("Team contact"), None),
                rk("slack", Some("Chat channel"), None),
                rk("description", Some("Description"), None),
            ],
            ui_hints: Some(vec![
                ui_text(
                    "contact",
                    "Kontakt",
                    Some("t.ex. digit@karlshamnenergi.se".into()),
                    None,
                ),
                ui_text("slack", "Kanal", Some("t.ex. #digit".into()), None),
                ui_textarea(
                    "description",
                    "Beskrivning",
                    Some("Vad ansvarar teamet för?".into()),
                    None,
                ),
            ]),
        },
        NodeKindInfo {
            kind: "data_category".into(),
            recommended_metadata_keys: vec![
                rk(
                    "classification",
                    Some("Classification"),
                    Some(vec![
                        "public".into(),
                        "internal".into(),
                        "restricted".into(),
                    ]),
                ),
                rk(
                    "pii",
                    Some("Contains personal data"),
                    Some(vec!["true".into(), "false".into()]),
                ),
                rk("retention", Some("Retention"), Some(vec!["2 years".into()])),
                rk("description", Some("Description"), None),
                rk("owner_team", Some("Owning team"), None),
            ],
            ui_hints: Some(with_common_node_hints(vec![
                ui_select(
                    "classification",
                    "Klassning",
                    vec!["Publik".into(), "Intern".into(), "Känslig".into()],
                    None,
                    Some("Hur känslig är datan?".into()),
                ),
                ui_toggle(
                    "pii",
                    "Personuppgifter",
                    Some("Markera om detta är personuppgifter (GDPR).".into()),
                ),
                ui_text(
                    "retention",
                    "Gallring/retention",
                    Some("t.ex. 1 år, 2 år, enligt policy".into()),
                    None,
                ),
            ])),
        },
        NodeKindInfo {
            kind: "app".into(),
            recommended_metadata_keys: vec![
                rk("env", Some("Environment"), Some(vec!["prod".into()])),
                rk("owner_team", Some("Owning team"), None),
                rk(
                    "critical",
                    Some("Critical?"),
                    Some(vec!["true".into(), "false".into()]),
                ),
                rk("description", Some("Description"), None),
                rk("url", Some("Primary URL"), None),
            ],
            ui_hints: Some(with_common_node_hints(vec![
                ui_text("url", "URL", Some("t.ex. https://app...".into()), None),
                ui_text(
                    "auth",
                    "Inloggning",
                    Some("t.ex. AD, SSO, lokalt".into()),
                    None,
                ),
            ])),
        },
        NodeKindInfo {
            kind: "container".into(),
            recommended_metadata_keys: vec![
                rk("image", Some("Container image"), None),
                rk("tag", Some("Image tag"), None),
                rk("env", Some("Environment"), Some(vec!["prod".into()])),
                rk("owner_team", Some("Owning team"), None),
                rk(
                    "critical",
                    Some("Critical?"),
                    Some(vec!["true".into(), "false".into()]),
                ),
                rk("description", Some("Description"), None),
            ],
            ui_hints: Some(with_common_node_hints(vec![
                ui_text(
                    "image",
                    "Image",
                    Some("t.ex. postgres".into()),
                    Some("Vilken container-image körs?".into()),
                ),
                ui_text("tag", "Tag", Some("t.ex. 16-alpine".into()), None),
                ui_text(
                    "stack",
                    "Stack/namespace",
                    Some("t.ex. monitoring".into()),
                    None,
                ),
            ])),
        },
        NodeKindInfo {
            kind: "external_dependency".into(),
            recommended_metadata_keys: vec![
                rk("provider", Some("Provider"), None),
                rk("service", Some("External service"), None),
                rk("owner_team", Some("Owning team"), None),
                rk(
                    "critical",
                    Some("Critical?"),
                    Some(vec!["true".into(), "false".into()]),
                ),
                rk("description", Some("Description"), None),
            ],
            ui_hints: Some(with_common_node_hints(vec![
                ui_text(
                    "provider",
                    "Leverantör",
                    Some("t.ex. Microsoft, Fortinet".into()),
                    None,
                ),
                ui_text(
                    "service",
                    "Tjänst",
                    Some("t.ex. Azure AD, SendGrid".into()),
                    None,
                ),
                ui_text("sla", "SLA", Some("t.ex. 99.9%".into()), None),
            ])),
        },
    ];

    fn common_edge_ui_hints() -> Vec<UiFieldHint> {
        vec![ui_textarea(
            "notes",
            "Kommentar",
            None,
            Some("Skriv kort vad relationen betyder i praktiken.".into()),
        )]
    }

    let edge_kinds = vec![
        EdgeKindInfo {
            kind: "depends_on".into(),
            recommended_metadata_keys: vec![
                rk("impact", Some("What breaks if target is down"), None),
                rk("notes", Some("Notes"), None),
            ],
            ui_hints: Some({
                let mut v = vec![ui_textarea(
                    "impact",
                    "Påverkan",
                    Some("Beskriv konsekvensen kort".into()),
                    None,
                )];
                v.extend(common_edge_ui_hints());
                v
            }),
        },
        EdgeKindInfo {
            kind: "runs_on".into(),
            recommended_metadata_keys: vec![
                rk("runtime", Some("Runtime/hosting details"), None),
                rk("notes", Some("Notes"), None),
            ],
            ui_hints: Some({
                let mut v = vec![ui_text(
                    "runtime",
                    "Runtime",
                    Some("t.ex. Docker, VM, k8s".into()),
                    None,
                )];
                v.extend(common_edge_ui_hints());
                v
            }),
        },
        EdgeKindInfo {
            kind: "stores_data".into(),
            recommended_metadata_keys: vec![
                rk("data_type", Some("What data is stored"), None),
                rk(
                    "contains_pii",
                    Some("Contains personal data?"),
                    Some(vec!["true".into(), "false".into()]),
                ),
                rk("notes", Some("Notes"), None),
            ],
            ui_hints: Some({
                let mut v = vec![
                    ui_text(
                        "data_type",
                        "Datatyp",
                        Some("t.ex. kunddata, loggar".into()),
                        None,
                    ),
                    ui_toggle(
                        "contains_pii",
                        "Personuppgifter",
                        Some("Markera om detta rör personuppgifter.".into()),
                    ),
                ];
                v.extend(common_edge_ui_hints());
                v
            }),
        },
        EdgeKindInfo {
            kind: "flows_to".into(),
            recommended_metadata_keys: vec![
                rk("flow_type", Some("Flow type"), None),
                rk(
                    "protocol",
                    Some("Transfer protocol"),
                    Some(vec!["https".into(), "sftp".into()]),
                ),
                rk(
                    "frequency",
                    Some("Frequency"),
                    Some(vec!["realtime".into(), "hourly".into()]),
                ),
                rk(
                    "contains_pii",
                    Some("Flow contains PII?"),
                    Some(vec!["true".into(), "false".into()]),
                ),
                rk("notes", Some("Notes"), None),
            ],
            ui_hints: Some(vec![
                ui_select(
                    "flow_type",
                    "Typ av flöde",
                    vec![
                        "API".into(),
                        "Filöverföring".into(),
                        "Logg".into(),
                        "Backup".into(),
                    ],
                    None,
                    Some("Vad är det för typ av flöde?".into()),
                ),
                ui_select(
                    "protocol",
                    "Protokoll",
                    vec![
                        "HTTPS".into(),
                        "SFTP".into(),
                        "SMB".into(),
                        "NFS".into(),
                        "MQTT".into(),
                    ],
                    None,
                    None,
                ),
                ui_toggle(
                    "contains_pii",
                    "Personuppgifter",
                    Some("Markera om flödet hanterar personuppgifter.".into()),
                ),
                ui_select(
                    "frequency",
                    "Frekvens",
                    vec![
                        "Realtime".into(),
                        "Minutvis".into(),
                        "Timvis".into(),
                        "Dagligen".into(),
                    ],
                    None,
                    None,
                ),
                ui_textarea("notes", "Kommentar", None, None),
            ]),
        },
        EdgeKindInfo {
            kind: "owned_by".into(),
            recommended_metadata_keys: vec![
                rk("responsibility", Some("Responsibility summary"), None),
                rk("notes", Some("Notes"), None),
            ],
            ui_hints: Some({
                let mut v = vec![ui_textarea(
                    "responsibility",
                    "Ansvar",
                    Some("Kort ansvarstext".into()),
                    None,
                )];
                v.extend(common_edge_ui_hints());
                v
            }),
        },
        EdgeKindInfo {
            kind: "backs_up_to".into(),
            recommended_metadata_keys: vec![
                rk(
                    "schedule",
                    Some("Backup schedule"),
                    Some(vec!["nightly".into()]),
                ),
                rk("notes", Some("Backup notes"), None),
            ],
            ui_hints: Some({
                let mut v = vec![ui_text(
                    "schedule",
                    "Schema",
                    Some("t.ex. nattlig".into()),
                    None,
                )];
                v.extend(common_edge_ui_hints());
                v
            }),
        },
        EdgeKindInfo {
            kind: "external_dependency".into(),
            recommended_metadata_keys: vec![
                rk(
                    "dependency_type",
                    Some("What kind of external dependency is this?"),
                    Some(vec![
                        "saas".into(),
                        "api".into(),
                        "support".into(),
                        "contract".into(),
                    ]),
                ),
                rk("contract_ref", Some("Contract reference"), None),
                rk("contact", Some("Vendor contact"), None),
                rk("notes", Some("Notes"), None),
            ],
            ui_hints: Some({
                let mut v = vec![
                    ui_select(
                        "dependency_type",
                        "Typ",
                        vec![
                            "SaaS".into(),
                            "API".into(),
                            "Support".into(),
                            "Avtal".into(),
                            "Annat".into(),
                        ],
                        None,
                        Some("Vad är det för sorts extern beroende?".into()),
                    ),
                    ui_text(
                        "contract_ref",
                        "Avtalsreferens",
                        Some("t.ex. C-123 / Avtal-2025-01".into()),
                        None,
                    ),
                    ui_text(
                        "contact",
                        "Kontakt",
                        Some("t.ex. support@leverantor.se".into()),
                        None,
                    ),
                ];
                v.extend(common_edge_ui_hints());
                v
            }),
        },
    ];

    KindsResponse {
        node_kinds,
        edge_kinds,
    }
}
