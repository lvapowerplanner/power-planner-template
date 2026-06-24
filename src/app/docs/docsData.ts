export type CalloutType = "tip" | "warning" | "info" | "best" | "danger";

export type DocCategory = {
  title: string;
  description: string;
  items: Array<{ title: string; slug: string; description: string }>;
};

export type DocScreenshot = {
  title: string;
  src: string;
  alt: string;
  caption?: string;
};

export type DocSection = {
  heading: string;
  body: string[];
  steps?: string[];
  bullets?: string[];
  screenshot?: DocScreenshot;
  callout?: {
    type: CalloutType;
    title: string;
    body: string;
  };
};

export type DocArticle = {
  title: string;
  slug: string;
  description: string;
  category: string;
  updated: string;
  readTime: string;
  summary: string;
  tags: string[];
  sections: DocSection[];
  related?: string[];
};

export const docCategories: DocCategory[] = [
  {
    title: "Getting Started",
    description: "Account access, workspaces and first project setup.",
    items: [
      { title: "Introduction", slug: "introduction", description: "What LVA Power Planner does and who it is for." },
      { title: "Logging In & MFA", slug: "logging-in", description: "Accessing your workspace and securing your account." },
      { title: "Creating Projects", slug: "creating-projects", description: "Create, open, rename and manage projects." },
    ],
  },
  {
    title: "Planning Workflow",
    description: "Build power systems from sources through to equipment.",
    items: [
      { title: "System Overview", slug: "system-overview", description: "Review the full temporary power system." },
      { title: "Power Sources", slug: "power-sources", description: "Add venue supplies, generators and auto sources." },
      { title: "Distro Overview", slug: "distro-overview", description: "Add, assign and manage distribution units." },
      { title: "Distro Editor", slug: "distro-editor", description: "Assign equipment, notes and downstream distros." },
      { title: "Downstream Distribution", slug: "downstream-distribution", description: "Feed distros from distro outputs using auto sources." },
    ],
  },
  {
    title: "Equipment & Templates",
    description: "Use company libraries and project-specific custom items.",
    items: [
      { title: "Company Libraries", slug: "company-libraries", description: "How company stock and distro libraries appear in projects." },
      { title: "Custom Equipment", slug: "custom-equipment", description: "Create project-specific equipment items." },
      { title: "Custom Distros", slug: "custom-distros", description: "Build project-specific distro templates." },
    ],
  },
  {
    title: "Reports & Data",
    description: "Generate deliverables and manage planner backups.",
    items: [
      { title: "Reports", slug: "reports", description: "Generate branded PDF and distro reports." },
      { title: "Import & Export", slug: "import-export", description: "Back up, restore and share planner data." },
    ],
  },
  {
    title: "Reference",
    description: "Warnings, calculations, troubleshooting and glossary.",
    items: [
      { title: "Warning System", slug: "warnings", description: "Understand active, dismissed and critical warnings." },
      { title: "Calculations", slug: "calculations", description: "How watts, amps, phase loading and imbalance are calculated." },
      { title: "Connector Reference", slug: "connector-reference", description: "Common connector and phase references used by the planner." },
      { title: "Best Practice", slug: "best-practice", description: "Recommended workflow before issuing reports." },
      { title: "FAQ", slug: "faq", description: "Common questions and troubleshooting." },
      { title: "Glossary", slug: "glossary", description: "Key terms used in the planner." },
      { title: "Release Notes", slug: "release-notes", description: "Current documentation and product notes." },
    ],
  },
];

export const docArticles: DocArticle[] = [
  {
    title: "Introduction",
    slug: "introduction",
    category: "Getting Started",
    updated: "June 2026",
    readTime: "7 min read",
    description: "LVA Power Planner is a professional planning tool for live event and temporary power systems.",
    summary: "Use LVA Power Planner to build structured power plans, calculate connected load, monitor system warnings and produce branded reports.",
    tags: ["overview", "temporary power", "live events", "reports", "BS7909"],
    sections: [
      {
        heading: "What LVA Power Planner is",
        body: [
          "LVA Power Planner is a professional software platform for planning temporary electrical distribution systems used in live events, broadcast, theatre, corporate production and temporary installations.",
          "Instead of relying on disconnected spreadsheets, the planner maintains a live project model. Sources, distros, downstream feeds, output schedules, equipment loads and reports all reference the same data, so changes are reflected throughout the project immediately.",
        ],
        callout: {
          type: "info",
          title: "Single source of truth",
          body: "When equipment is added, moved or removed, the planner recalculates the relevant outputs, distros, sources and reports from the same project data.",
        },
      },
      {
        heading: "Who should use it",
        body: [
          "The software is intended for AV companies, production electricians, temporary power suppliers, project managers, production managers, rental companies and technical teams who need a clearer method of planning event power systems.",
          "It assumes the user understands the principles of temporary electrical distribution. The documentation explains how to use the software, but it does not replace electrical competence or site-specific engineering judgement.",
        ],
        bullets: [
          "Production electricians and power engineers",
          "AV and event production companies",
          "Festival, theatre and broadcast teams",
          "Project managers preparing power documentation",
          "Rental companies managing repeatable distro and equipment libraries",
        ],
      },
      {
        heading: "Core workflow",
        body: [
          "Most projects follow the same high-level sequence: define the project, add sources, add distros, connect the hierarchy, assign equipment, review warnings and export reports.",
          "The planner is deliberately structured around that workflow. Users can move between overview, source management, distro management, detailed editing and report export without rebuilding information in separate documents.",
        ],
        steps: [
          "Create or open a project from the workspace dashboard.",
          "Complete project information in System Overview.",
          "Add manual power sources such as generators, venue supplies or temporary mains supplies.",
          "Add distros from the company library or project-specific custom templates.",
          "Assign equipment and downstream distribution in the Distro Editor.",
          "Review active warnings, resolve critical issues and export reports.",
        ],
      },
      {
        heading: "Compliance and responsibility",
        body: [
          "LVA Power Planner is an indicative planning and documentation tool. It may support BS 7909 documentation workflows, but it does not certify, verify or guarantee compliance with BS 7909, BS 7671, venue requirements or any other statutory or industry standard.",
          "Responsibility for verification, suitability, installation, inspection, testing, operation and compliance remains with the competent duty holder and the user issuing the design or report.",
        ],
        callout: {
          type: "warning",
          title: "Competent review required",
          body: "Always review exported reports and resolve critical warnings before issuing documentation to site teams, clients or suppliers.",
        },
      },
    ],
    related: ["creating-projects", "system-overview", "reports"],
  },
  {
    title: "Logging In & MFA",
    slug: "logging-in",
    category: "Getting Started",
    updated: "June 2026",
    readTime: "5 min read",
    description: "Sign in securely to your company workspace.",
    summary: "Users sign in to their assigned workspace with email/password, optional Microsoft sign-in and MFA where enabled.",
    tags: ["login", "mfa", "2fa", "workspace", "password reset", "microsoft"],
    sections: [
      {
        heading: "Workspace access",
        body: [
          "LVA Power Planner is normally accessed through a company workspace. Workspaces can apply company branding, company equipment libraries, company distro templates and workspace-specific access rules.",
          "Accounts are normally created or invited by the workspace administrator. If an account is not assigned to the current workspace, access is denied to prevent users entering the wrong company environment.",
        ],
      },
      {
        heading: "Signing in",
        body: [
          "Enter the email address and password supplied by your administrator. Some workspaces may also allow Microsoft sign-in if it has been enabled for that organisation.",
          "After signing in successfully, the project dashboard will show your available projects and the option to create a new project.",
        ],
        steps: [
          "Open your organisation workspace URL.",
          "Enter your email and password, or choose Microsoft sign-in if available.",
          "Complete MFA if prompted.",
          "Open an existing project or create a new one from the dashboard.",
        ],
      },
      {
        heading: "Multi-factor authentication",
        body: [
          "Where MFA is required, follow the on-screen instructions to scan the QR code into an authenticator app, then enter the 6-digit code to complete setup.",
          "On later sign-ins, enter the current code from the authenticator app when prompted. This protects the workspace even if a password is compromised.",
        ],
        callout: {
          type: "tip",
          title: "Authenticator app",
          body: "Use a trusted authenticator app and keep recovery access available through your organisation administrator.",
        },
      },
      {
        heading: "Password reset",
        body: [
          "Use Reset Password on the login page to request a password reset email. After setting a new password, return to the same workspace URL and sign in again.",
          "If you cannot access the workspace after resetting the password, contact your administrator to confirm that your account is assigned to the correct workspace.",
        ],
      },
    ],
    related: ["creating-projects", "company-libraries", "faq"],
  },
  {
    title: "Creating Projects",
    slug: "creating-projects",
    category: "Getting Started",
    updated: "June 2026",
    readTime: "7 min read",
    description: "Create, open, rename and remove project files.",
    summary: "Projects store sources, distros, equipment assignments, report options, dismissed warnings and project information.",
    tags: ["project", "dashboard", "rename", "delete", "project information", "backup"],
    sections: [
      {
        heading: "Create a new project",
        body: [
          "From the project dashboard, enter a project name and select Create Project. The new project opens with an empty planner state ready for sources, distros and equipment.",
          "Use a project name that clearly matches your internal job, event or production naming convention. This helps users identify the correct file when multiple events are being planned at the same time.",
        ],
        steps: [
          "Sign in to your company workspace.",
          "Enter the new project name in the project dashboard.",
          "Select Create Project.",
          "Open the project and begin by completing the System Overview project information fields.",
        ],
      },
      {
        heading: "Project information",
        body: [
          "In System Overview, complete Project Manager, Project Number, Project Name, Event Date and Venue. These values appear in report headers and exported project data.",
          "The Project Name field should normally match the public-facing event or production name, while the dashboard project name can follow your internal file naming convention.",
        ],
        callout: {
          type: "best",
          title: "Best practice",
          body: "Complete project information before building the system so reports are correctly labelled from the start.",
        },
      },
      {
        heading: "Opening, renaming and deleting projects",
        body: [
          "Use Open to load a project into the planner. Use Rename to correct or update the project name shown on the dashboard. Use Delete only when a project is no longer required.",
          "Deleting a project removes that project and its planner data. If the system may be needed later, export a project backup first.",
        ],
        callout: {
          type: "warning",
          title: "Deletion is permanent",
          body: "Export a project backup before deleting any project that might be required for records, future revisions or client queries.",
        },
      },
      {
        heading: "Autosave behaviour",
        body: [
          "Planner changes are saved automatically while a project is open. The save status indicates whether the current project is saved, has unsaved changes or is currently saving.",
          "For major revisions, still use Export Project to create a dated backup before making extensive changes.",
        ],
      },
    ],
    related: ["system-overview", "import-export", "reports"],
  },
  {
    title: "System Overview",
    slug: "system-overview",
    category: "Planning Workflow",
    updated: "June 2026",
    readTime: "9 min read",
    description: "Understand the full power hierarchy and project status.",
    summary: "System Overview is the main health check for the project and shows sources, downstream distros, project details, loading and warnings.",
    tags: ["system overview", "warnings", "phase loading", "project information", "unassigned distros", "tree"],
    sections: [
      {
        heading: "Purpose of the System Overview",
        body: [
          "System Overview is the main health check for the project. It shows the power hierarchy, source loading, distro loading, downstream relationships, unassigned distros and active warnings.",
          "Use this tab whenever you need to understand the complete temporary power system at a glance. It is also the best place to review the project immediately before exporting reports.",
        ],
        screenshot: {
          title: "System Overview screen",
          src: "/docs/images/system-overview.png",
          alt: "System Overview tab showing project information, source cards and distro hierarchy",
          caption: "Place a screenshot at public/docs/images/system-overview.png to activate this visual in the live documentation.",
        },
      },
      {
        heading: "Project information panel",
        body: [
          "The project information panel stores the details used by reports: Project Manager, Project Number, Project Name, Event Date and Venue.",
          "These values should be completed early and checked again before reports are exported. Report headers use this information automatically, so there is no need to re-enter it in the Report tab.",
        ],
      },
      {
        heading: "Visual system tree",
        body: [
          "Each manual power source appears as a parent card. Assigned distros appear beneath the source, with downstream distros nested under their parent outputs.",
          "Open buttons on distro cards jump directly to that distro in the Distro Editor. This is useful when a warning appears in the overview and you need to correct the relevant output or equipment assignment.",
        ],
        callout: {
          type: "info",
          title: "Single-phase and three-phase highlighting",
          body: "Visual highlights help distinguish single-phase and three-phase items when reviewing the system hierarchy.",
        },
      },
      {
        heading: "Phase loading and capacity",
        body: [
          "Phase load cards show the current loading for L1, L2 and L3. The percentage indicator compares current draw against the relevant source or distro rating.",
          "If a high-current distro is fed from a lower-rated high-current source, the displayed phase cap reflects the upstream source limit. This prevents a downstream board being interpreted as available at its full connector rating when the upstream source is smaller.",
        ],
      },
      {
        heading: "Unassigned distros",
        body: [
          "Distros that have not been assigned to a source are shown in the Unassigned Distros section. This does not delete or disable them; it simply means they are not currently part of the connected system hierarchy.",
          "Assign a source before issuing reports so the full system hierarchy is clear and all downstream loads are included in source summaries.",
        ],
        callout: {
          type: "warning",
          title: "Check unassigned distros before export",
          body: "An unassigned distro may represent an incomplete design. Review this section before sending reports to site teams.",
        },
      },
    ],
    related: ["power-sources", "distro-overview", "warnings"],
  },
  {
    title: "Power Sources",
    slug: "power-sources",
    category: "Planning Workflow",
    updated: "June 2026",
    readTime: "9 min read",
    description: "Create and manage venue supplies, generators and auto-created sources.",
    summary: "Power Sources are the starting points for the system, including manual supplies and auto-created downstream output sources.",
    tags: ["power sources", "generators", "venue supplies", "auto sources", "phase imbalance", "source warnings"],
    sections: [
      {
        heading: "Manual power sources",
        body: [
          "Manual Power Sources represent supplies that exist outside the planner hierarchy, such as generators, venue distribution boards, temporary mains supplies or incoming power from another supplier.",
          "Each manual source has a name, connector type, rating and notes. The notes field is useful for generator location, venue board details, cable routing, restrictions or operational comments.",
        ],
        steps: [
          "Open the Power Sources tab.",
          "Enter a clear source name, such as Generator 1 or Venue 125A Stage Left.",
          "Select the connector type.",
          "Add relevant notes.",
          "Select Add Manual Power Source.",
        ],
      },
      {
        heading: "Auto sources",
        body: [
          "Auto Sources are created automatically from eligible distro outputs. They allow downstream distros to be connected to parent distro outputs while still calculating load back through the parent distro and upstream source.",
          "Eligible outputs are generally 32A and larger non-Socapex outputs. Auto Sources are shown separately so users can see downstream connections without manually creating virtual sources.",
        ],
        callout: {
          type: "info",
          title: "Automatically generated",
          body: "You do not need to add Auto Sources manually. They appear when a distro contains a compatible output that can feed another distro.",
        },
      },
      {
        heading: "Assigned distros",
        body: [
          "Each source card shows the distros currently assigned to that source. The assigned distro list includes connected load and an Open button for quick access to the relevant distro in the Distro Editor.",
          "Use this area to check that every source is feeding the expected part of the system and that the hierarchy matches the physical installation plan.",
        ],
      },
      {
        heading: "Source loading and warnings",
        body: [
          "The Power Sources tab calculates the load assigned to each source and displays phase loading. Overloads, near-capacity conditions and three-phase imbalance warnings are shown directly on the relevant source card.",
          "For three-phase sources, imbalance warnings identify which phase is highest and which phase it is being compared against. This makes it easier to rebalance the system by moving equipment or adjusting downstream feeds.",
        ],
        callout: {
          type: "best",
          title: "Balance at source level",
          body: "A downstream distro may look balanced on its own, but the complete source may still be imbalanced once multiple distros are combined. Always review the source summary as well as individual distro outputs.",
        },
      },
      {
        heading: "Deleting and reordering sources",
        body: [
          "Manual sources can be moved up or down to match the order you want shown in the planner and reports. Auto Sources follow the distro hierarchy and are not manually reordered in the same way.",
          "If you delete a manual source that is currently feeding distros, those distros will be unassigned. Review the System Overview afterwards to reconnect anything that still belongs in the system.",
        ],
        callout: {
          type: "warning",
          title: "Deleting a source unassigns its distros",
          body: "Check the Unassigned Distros section after deleting a source so no part of the system is accidentally left disconnected.",
        },
      },
    ],
    related: ["distro-overview", "downstream-distribution", "warnings"],
  },
  {
    title: "Distro Overview",
    slug: "distro-overview",
    category: "Planning Workflow",
    updated: "June 2026",
    readTime: "10 min read",
    description: "Add, assign and manage distribution units.",
    summary: "Distro Overview is the control point for adding distros, assigning them to compatible sources and reviewing their load state before detailed editing.",
    tags: ["distros", "distro overview", "source assignment", "company library", "custom distros", "phase loading"],
    sections: [
      {
        heading: "Purpose of Distro Overview",
        body: [
          "Distro Overview is where the distribution layer of a project is created and managed. It sits between Power Sources and the Distro Editor: Power Sources define what is available, Distro Overview defines which distribution units are in the system, and the Distro Editor defines what is connected to each output.",
          "Use this tab to add distros from the company library or from project-specific custom templates, assign each distro to a source, review its phase loading and open the detailed editor when required."
        ],
        callout: {
          type: "info",
          title: "Overview before detail",
          body: "Build the basic source and distro hierarchy here first, then use the Distro Editor for output-level equipment assignment."
        }
      },
      {
        heading: "Adding a distro",
        body: [
          "Choose the required distro type from the Distro Type list, then select Add Distro. The list includes company library distros and any custom distros created within the current project.",
          "When a distro is added it receives its own project instance. The original library template is not modified, so the same distro type can be added multiple times and named separately for different locations."
        ],
        steps: [
          "Open Distro Overview.",
          "Choose the required distro type from the dropdown.",
          "Select Add Distro.",
          "Give the distro an instance name and location.",
          "Assign a compatible source."
        ],
        callout: {
          type: "tip",
          title: "Name by site location",
          body: "Use practical labels such as Stage Left, FOH, Video World, Dimmer Beach or Catering rather than only repeating the distro model name."
        },
        screenshot: {
          title: "Distro Overview add panel",
          src: "/docs/images/distro-overview.png",
          alt: "Distro Overview showing add distro controls and distro cards",
          caption: "Recommended screenshot: add a marked-up image showing the Distro Type selector, Add Distro button, source selector and Open button."
        }
      },
      {
        heading: "Assigning sources",
        body: [
          "Each distro can be assigned to a compatible manual power source or Auto Source. The source list is filtered so incompatible connector types are not offered and a source already feeding another distro is not accidentally duplicated.",
          "If a required source is missing from the dropdown, check the source connector type, whether the source is already in use, and whether the intended downstream feed has been created from a suitable output."
        ],
        bullets: [
          "Single-phase distros must be fed from compatible single-phase sources.",
          "Three-phase distros must be fed from compatible three-phase sources.",
          "High-current three-phase Powerlock-style sources may cap a larger distro to the upstream source rating.",
          "A distro cannot be assigned to one of its own downstream outputs."
        ]
      },
      {
        heading: "Reading distro cards",
        body: [
          "Each distro card summarises the distro instance, physical input, number of outputs, source assignment and phase loading. Cards are highlighted when warnings or critical issues are active for that distro.",
          "The card colour and phase summary allow you to identify where load is building up without opening every distro individually. Use Open to jump directly into the Distro Editor for the selected distro."
        ],
        callout: {
          type: "best",
          title: "Review before editing",
          body: "After adding several distros, pause on Distro Overview and confirm every distro has the expected source before assigning equipment."
        }
      },
      {
        heading: "Reordering and removing distros",
        body: [
          "Use the up and down controls to place distros in a logical order. This helps the overview and report read naturally, especially on larger projects with multiple areas or departments.",
          "Removing a distro deletes it from the project. Any equipment, notes and downstream assignments on that distro are also removed, so remove distros carefully once a design has been developed."
        ],
        callout: {
          type: "warning",
          title: "Removing distros is destructive",
          body: "Export a project backup before removing large sections of a developed distribution system."
        }
      }
    ],
    related: ["distro-editor", "power-sources", "custom-distros", "downstream-distribution"],
  },
  {
    title: "Distro Editor",
    slug: "distro-editor",
    category: "Planning Workflow",
    updated: "June 2026",
    readTime: "18 min read",
    description: "Assign equipment, notes and downstream distros.",
    summary: "The Distro Editor is the detailed workspace for assigning equipment to outputs, adjusting quantities, recording notes and building downstream distribution.",
    tags: ["distro editor", "drag and drop", "equipment", "outputs", "socapex", "notes", "downstream distros"],
    sections: [
      {
        heading: "What the Distro Editor is for",
        body: [
          "The Distro Editor is where the practical detail of a distribution unit is entered. It shows the selected distro, its source, its phase loading, output cards, Socapex circuits where applicable and the equipment library available to assign.",
          "Use this page when you need to place real equipment onto outputs, change quantities, add notes, feed child distros or understand exactly how an individual distro is being loaded."
        ],
        screenshot: {
          title: "Distro Editor layout",
          src: "/docs/images/distro-editor.png",
          alt: "Distro Editor showing equipment library, phase summary and output cards",
          caption: "Recommended screenshot: mark the equipment library, editing distro selector, phase summary, source selector and output cards."
        }
      },
      {
        heading: "Selecting the distro to edit",
        body: [
          "The active distro can be changed from the Editing Distro selector at the top of the editor. Opening a distro from System Overview, Power Sources or Distro Overview also sets it as the active distro automatically.",
          "This allows fast movement between overview pages and detailed output editing without losing the current project context."
        ],
        callout: {
          type: "tip",
          title: "Use Open buttons to move quickly",
          body: "When reviewing the system, use Open on a source or distro card to jump directly to the relevant distro in the editor."
        }
      },
      {
        heading: "Equipment library",
        body: [
          "The equipment library appears on the left of the editor. It contains company equipment loaded from the workspace library plus any custom equipment created for the current project.",
          "Use search and category filtering to find items quickly. Equipment can be dragged onto an output, or added using the dropdown within an output card."
        ],
        bullets: [
          "Company equipment is maintained at workspace level.",
          "Custom equipment is stored inside the current project.",
          "Equipment entries include name, category and wattage.",
          "Assigned item quantities multiply the wattage automatically."
        ]
      },
      {
        heading: "Assigning and moving equipment",
        body: [
          "Drag equipment from the library onto an output drop zone to assign it. Once assigned, the item appears on that output with a quantity, wattage and notes field.",
          "Assigned equipment can also be dragged between compatible output areas within the same distro. This is useful during balancing because you can move loads between phases and immediately see the recalculated result."
        ],
        steps: [
          "Search for the equipment item.",
          "Drag the item onto the required output or circuit.",
          "Adjust quantity if more than one item is connected.",
          "Add item notes if required for patching, location or operating restrictions.",
          "Review output, distro and source loading after the change."
        ],
        callout: {
          type: "best",
          title: "Use notes for site information",
          body: "Item notes and output notes are valuable in reports. Use them for cable routes, stand numbers, departments, dimmer references, rig positions and supplier notes."
        }
      },
      {
        heading: "Output cards",
        body: [
          "Each output card displays the output name, phase, connector type, rating and current loading. The load percentage gives immediate feedback on how close the output is to its rated capacity.",
          "For three-phase outputs, the load is distributed across L1, L2 and L3. For single-phase outputs, the load is applied to the assigned phase. Socapex circuits are displayed as individual circuit outputs grouped by phase."
        ],
        callout: {
          type: "warning",
          title: "Warnings are live",
          body: "If an output approaches capacity or becomes overloaded, the warning system updates immediately. Resolve critical output warnings before issuing reports."
        }
      },
      {
        heading: "Source and phase cap",
        body: [
          "The selected source is shown near the top of the editor. Where a larger distro is fed from a lower-rated compatible high-current three-phase source, the editor may show a phase cap. This means the distro input exists at one rating but is limited by the upstream source rating.",
          "The phase cap is important because it prevents the planner from treating a large distro as if its full input rating is available when the upstream source is smaller."
        ],
        callout: {
          type: "info",
          title: "Source caps follow the upstream feed",
          body: "If a 400A distro is fed from a 200A source, the planner must evaluate loading against the 200A source limit rather than the physical distro maximum."
        }
      },
      {
        heading: "Downstream distro feeds",
        body: [
          "Eligible outputs can feed compatible downstream distros. When this is possible, the editor presents a downstream distro selector on the output card. Selecting a child distro connects it to the Auto Source created from that output.",
          "The planner prevents circular feed loops and filters incompatible connector types so the hierarchy remains electrically sensible. Loads on the downstream distro are included in the parent output and upstream source calculations."
        ],
        bullets: [
          "Only eligible outputs create Auto Sources.",
          "Socapex outputs do not create Auto Sources.",
          "A child distro can only be assigned to one source at a time.",
          "The parent output includes downstream load in its calculation."
        ],
        callout: {
          type: "tip",
          title: "Model real-world cascades",
          body: "Use downstream distro feeds to represent systems such as generator → main distro → area distro → local breakout."
        }
      },
      {
        heading: "Socapex outputs",
        body: [
          "Socapex outputs are expanded into their individual circuits by phase. This makes it possible to place loads on the actual circuit numbers rather than treating the Socapex as a single combined output.",
          "Where paired Socapex outputs share breaker capacity, the editor shows linked capacity information. Review these shared loads carefully because two physical sockets may be protected by one breaker."
        ],
        callout: {
          type: "danger",
          title: "Do not ignore shared breaker warnings",
          body: "A Socapex circuit can appear acceptable in isolation while the shared breaker pair is overloaded. Resolve shared breaker critical warnings before issuing documentation."
        }
      }
    ],
    related: ["company-libraries", "custom-equipment", "downstream-distribution", "warnings"],
  },
  {
    title: "Downstream Distribution",
    slug: "downstream-distribution",
    category: "Planning Workflow",
    updated: "June 2026",
    readTime: "8 min read",
    description: "Feed distros from distro outputs using auto sources.",
    summary: "Downstream distribution lets the planner represent real cascaded systems while maintaining source-level calculations.",
    tags: ["downstream", "auto source", "feed distro", "nested distros", "loop prevention"],
    sections: [
      { heading: "How downstream feeds work", body: ["When a distro output is eligible to feed another distro, the planner creates an Auto Source for that output. A compatible child distro can then be assigned to that Auto Source."], },
      { heading: "Compatibility rules", body: ["The planner filters available downstream options to avoid incompatible connector types, duplicated assignments and circular feed loops."], callout: { type: "info", title: "Loop prevention", body: "The editor prevents a distro from being fed by one of its own downstream children." } },
      { heading: "Load propagation", body: ["Loads assigned to a downstream distro are included in the parent output, parent distro and upstream source calculations."], },
    ],
    related: ["power-sources", "distro-editor", "calculations"],
  },
  {
    title: "Company Libraries",
    slug: "company-libraries",
    category: "Equipment & Templates",
    updated: "June 2026",
    readTime: "5 min read",
    description: "How company stock and distro libraries appear in projects.",
    summary: "Company libraries provide standard equipment and distro definitions for each workspace.",
    tags: ["company library", "equipment", "stock", "workspace", "distro library"],
    sections: [
      { heading: "Equipment library", body: ["Company equipment appears in the Distro Editor and can be assigned to outputs. Equipment entries include category, name and wattage."], },
      { heading: "Distro library", body: ["Company distros appear in Distro Overview. Each definition includes input connector, rating and outputs."], },
      { heading: "Workspace separation", body: ["Each workspace can use its own library data so company-specific stock remains separate from other organisations."], },
    ],
    related: ["custom-equipment", "custom-distros", "logging-in"],
  },
  {
    title: "Custom Equipment",
    slug: "custom-equipment",
    category: "Equipment & Templates",
    updated: "June 2026",
    readTime: "7 min read",
    description: "Create project-specific equipment items.",
    summary: "Custom equipment is used when an item is required for a project but does not belong in the permanent company library.",
    tags: ["custom equipment", "equipment", "watts", "category", "project equipment"],
    sections: [
      {
        heading: "When to use custom equipment",
        body: [
          "Custom equipment is designed for project-specific items that are not part of the company library. This includes client-supplied equipment, temporary substitutions, one-off appliances, hired-in items or equipment whose load is only relevant to one project.",
          "Because custom equipment is stored inside the project, it does not change the standard company stock list for other users."
        ],
        callout: {
          type: "info",
          title: "Project scope",
          body: "Custom equipment belongs to the current project only. Add repeatable stock to the company equipment library instead."
        }
      },
      {
        heading: "Creating custom equipment",
        body: [
          "To create an item, enter the equipment name, select a category and enter the wattage. The wattage should represent the connected load for one item, not the total quantity required on the project.",
          "After saving, the item appears in the Distro Editor equipment library and can be assigned to outputs in the same way as company equipment."
        ],
        steps: [
          "Open Custom Equipment.",
          "Enter the equipment name.",
          "Choose the most appropriate category.",
          "Enter the wattage for one item.",
          "Select Add Custom Equipment.",
          "Open the Distro Editor and assign the new item where required."
        ],
        screenshot: {
          title: "Custom Equipment form",
          src: "/docs/images/custom-equipment.png",
          alt: "Custom Equipment page showing name category and watts fields",
          caption: "Recommended screenshot: show the form fields and the list of project custom equipment."
        }
      },
      {
        heading: "Editing custom equipment",
        body: [
          "Saved custom equipment can be edited from the Custom Equipment tab. You can update the name, category or wattage if the project information changes.",
          "If equipment has already been assigned to outputs, review the affected outputs after changing wattage so warnings and reports remain accurate."
        ],
        callout: {
          type: "warning",
          title: "Check assigned loads after wattage changes",
          body: "Changing wattage can affect output loading, phase balance and reports. Review System Overview after editing custom equipment."
        }
      },
      {
        heading: "Deleting custom equipment",
        body: [
          "Deleting a custom equipment item removes it from the project custom equipment list. Only delete items once you are confident they are no longer required for assignment.",
          "For record keeping, consider leaving uncommon client items in place until the final report and project backup have been exported."
        ]
      }
    ],
    related: ["distro-editor", "company-libraries", "reports"],
  },
  {
    title: "Custom Distros",
    slug: "custom-distros",
    category: "Equipment & Templates",
    updated: "June 2026",
    readTime: "9 min read",
    description: "Build project-specific distro templates.",
    summary: "Custom distros allow users to define temporary distro layouts with single-phase, three-phase and Socapex outputs for use within the current project.",
    tags: ["custom distros", "templates", "outputs", "socapex", "single phase", "three phase"],
    sections: [
      {
        heading: "Purpose of custom distros",
        body: [
          "Custom distros are used when a required distribution unit is not available in the company library or when a project needs a temporary layout. They are project-specific templates and appear in Distro Overview with a Custom prefix.",
          "Use custom distros for one-off breakouts, client-specific boards, temporary rack power layouts or bespoke distribution that should not become standard company stock."
        ],
        callout: {
          type: "best",
          title: "Keep company libraries clean",
          body: "Use the company library for repeatable stock and custom distros for project-only designs."
        }
      },
      {
        heading: "Creating the custom distro",
        body: [
          "Start by entering a distro name and choosing the input type. The selected input determines the input connector label and the amps per phase used for calculations.",
          "Then add outputs to define the layout. Outputs can be single-phase, three-phase or Socapex. The order outputs are added is the order they appear when the custom distro is used."
        ],
        steps: [
          "Open Custom Distros.",
          "Enter a clear distro name.",
          "Select the input type.",
          "Add the required outputs.",
          "Reorder or remove outputs if necessary.",
          "Select Save Custom Distro."
        ],
        screenshot: {
          title: "Custom Distro builder",
          src: "/docs/images/custom-distros.png",
          alt: "Custom Distros page showing input type and output builder controls",
          caption: "Recommended screenshot: show the input type, output controls and current layout preview."
        }
      },
      {
        heading: "Output types",
        body: [
          "Single-phase outputs are assigned to L1, L2 or L3 and can be created with common ratings. Three-phase outputs are added as three-phase outputs and distribute their connected load across all three phases. Socapex outputs create the default six-circuit Socapex structure with circuits split across L1, L2 and L3.",
          "Choose output types that represent the physical distro accurately. Reports and calculations rely on the template being a good representation of the real unit."
        ],
        bullets: [
          "Use single-phase outputs for 13A, 16A, 32A or similar single-phase feeds.",
          "Use three-phase outputs for three-phase downstream feeds or three-phase loads.",
          "Use Socapex outputs where the physical distro provides Socapex connectors with individual circuits."
        ]
      },
      {
        heading: "Using saved custom distros",
        body: [
          "After saving, the custom distro appears in Distro Overview. Add it to the project exactly like a company library distro, then assign a source and open it in the Distro Editor.",
          "Each custom distro added to the project becomes a separate instance, so you can use the same custom template multiple times with different names, locations and assigned equipment."
        ]
      },
      {
        heading: "Deleting custom distro templates",
        body: [
          "Custom distro templates can be deleted from the Custom Distros tab. Deleting the template removes it from the add list for future use in the project.",
          "Before deleting, check whether the template may be needed again later in the design process."
        ],
        callout: {
          type: "warning",
          title: "Template deletion is project-specific",
          body: "Deleting a custom template does not remove company library distros, but it may prevent you from adding the same custom layout again without rebuilding it."
        }
      }
    ],
    related: ["distro-overview", "distro-editor", "company-libraries"],
  },
  {
    title: "Reports",
    slug: "reports",
    category: "Reports & Data",
    updated: "June 2026",
    readTime: "12 min read",
    description: "Generate branded PDF and distro reports.",
    summary: "The Report tab turns the live planner state into branded project documentation for site teams, clients and project records.",
    tags: ["reports", "pdf", "export", "individual distro reports", "branding", "documentation"],
    sections: [
      {
        heading: "Purpose of the Report tab",
        body: [
          "The Report tab creates documentation from the current project state. It uses the project information, workspace branding, power sources, distros, output schedules, equipment, notes and load calculations already entered into the planner.",
          "The report preview mirrors the export layout so users can check content before generating a PDF. Reports should be reviewed as a professional deliverable, not treated as an automatic approval."
        ],
        callout: {
          type: "warning",
          title: "Reports are based on user-entered data",
          body: "The report is only as accurate as the project data entered into the planner. Always review source assignments, equipment quantities and warnings before export."
        },
        screenshot: {
          title: "Report preview",
          src: "/docs/images/reports.png",
          alt: "Report tab showing export controls and report preview",
          caption: "Recommended screenshot: show source/distro toggles, export buttons and the report preview header."
        }
      },
      {
        heading: "Project and branding information",
        body: [
          "Report headers use the project information entered in System Overview, including project manager, project number, project name, event date and venue. Workspace branding can also supply company name, logo, contact email and footer text.",
          "For best results, complete project information before exporting. Missing fields are omitted from the report rather than being filled with placeholder text."
        ],
        bullets: [
          "Project name becomes the report title.",
          "Project number appears in the report metadata when entered.",
          "Company logo and contact details come from workspace branding.",
          "Distro and output notes appear in the relevant report sections."
        ]
      },
      {
        heading: "Choosing what appears in the report",
        body: [
          "The Report tab includes controls for hiding or showing sources and distros in the current export. Hiding an item from the report does not delete it from the project; it only excludes it from the generated documentation.",
          "This is useful when issuing focused information to a department, supplier or site team without changing the main project design."
        ],
        callout: {
          type: "tip",
          title: "Create targeted reports",
          body: "Hide unrelated sources or distros when creating a report for one area, but keep the full design available in the project."
        }
      },
      {
        heading: "Show all outputs",
        body: [
          "By default, reports focus on outputs that contain equipment, notes or linked downstream distros. The Show All Outputs option includes unused outputs as well, which can be useful for full distro schedules or pre-production patch planning.",
          "If the report becomes too long, hide unused outputs again and include only the circuits that carry relevant information."
        ]
      },
      {
        heading: "Export PDF",
        body: [
          "Export PDF opens the report in a printable layout ready to save as PDF using the browser print dialogue. The report is designed for A4 portrait output and includes the relevant source and distro sections selected in the Report tab.",
          "Before saving the PDF, check the browser print settings so page size, margins and background graphics are appropriate for your output."
        ],
        steps: [
          "Open the Report tab.",
          "Confirm project details and source/distro selections.",
          "Review the preview for obvious omissions.",
          "Select Export PDF.",
          "Use the browser print dialogue to save or print the report."
        ]
      },
      {
        heading: "Individual distro reports",
        body: [
          "Export Distro Reports generates separate pages for individual selected distros. This is useful for sending a local distro schedule to a crew member, department lead or supplier without including the entire project report.",
          "Individual distro reports still use the same project and branding information, and they include the selected distro output schedule, notes and load summary."
        ],
        callout: {
          type: "best",
          title: "Use individual reports on site",
          body: "Individual distro reports are useful as local working documents when a crew member only needs the schedule for one distro or area."
        }
      },
      {
        heading: "Before issuing reports",
        body: [
          "Before issuing a report externally, review System Overview and the Report preview. Confirm that all relevant sources are included, all required distros are visible, notes are complete and no unresolved critical warnings remain unless they are intentionally documented elsewhere.",
          "The report includes a disclaimer stating that LVA Power Planner is an indicative planning tool and does not certify compliance. Competent review remains required."
        ],
        callout: {
          type: "danger",
          title: "Do not issue unchecked critical warnings",
          body: "Critical warnings indicate conditions such as overloads. Resolve or formally review them before reports are sent to clients or site teams."
        }
      }
    ],
    related: ["system-overview", "warnings", "import-export", "best-practice"],
  },
  {
    title: "Import & Export",
    slug: "import-export",
    category: "Reports & Data",
    updated: "June 2026",
    readTime: "5 min read",
    description: "Back up, restore and share planner data.",
    summary: "JSON import/export provides a complete project backup and restore workflow.",
    tags: ["import", "export", "backup", "json", "restore", "share"],
    sections: [
      { heading: "Export Project", body: ["Export Project downloads the current planner data as a JSON file. This is useful before major revisions, before deleting projects or when sharing a system externally."], },
      { heading: "Import Project", body: ["Import Project replaces the current project planner data with the selected JSON file after confirmation."], callout: { type: "warning", title: "Import replaces current data", body: "Export a backup of the current project before importing another file if you may need to return to the previous state." } },
      { heading: "Suggested backup practice", body: ["Create dated exports at major milestones such as initial design, client issue, pre-production revision and final onsite revision."], },
    ],
    related: ["creating-projects", "reports", "best-practice"],
  },
  {
    title: "Warning System",
    slug: "warnings",
    category: "Reference",
    updated: "June 2026",
    readTime: "9 min read",
    description: "Understand active, dismissed and critical warnings.",
    summary: "The warning system highlights overloads, near-capacity conditions, source issues, phase imbalance and shared Socapex breaker problems.",
    tags: ["warnings", "critical", "dismissed warnings", "phase imbalance", "overload"],
    sections: [
      { heading: "Warning levels", body: ["Warnings are split into warning and critical severity. Critical issues usually indicate overloads or conditions that require immediate review before reports are issued."], },
      { heading: "Dismissed warnings", body: ["Non-critical warnings can be dismissed where a competent user has reviewed the condition and accepts the known diversity or operating context."], callout: { type: "info", title: "Automatic reinstatement", body: "Dismissed warnings return when the monitored value changes significantly, preventing old dismissals from hiding changed conditions." } },
      { heading: "Common warning types", body: ["Common issues include output overload, near-capacity output, source overload, phase imbalance and shared Socapex breaker overload."], },
    ],
    related: ["system-overview", "power-sources", "calculations"],
  },
  {
    title: "Calculations",
    slug: "calculations",
    category: "Reference",
    updated: "June 2026",
    readTime: "8 min read",
    description: "How watts, amps, phase loading and imbalance are calculated.",
    summary: "This article explains the indicative calculations used by the planner.",
    tags: ["calculations", "watts", "amps", "phase loading", "imbalance"],
    sections: [
      { heading: "Watts to amps", body: ["The planner converts equipment wattage to current using a 230 V single-phase basis for indicative planning calculations."], },
      { heading: "Three-phase outputs", body: ["For three-phase equipment assigned to a three-phase output, load is distributed evenly across L1, L2 and L3 for planning purposes."], },
      { heading: "Phase imbalance", body: ["Phase imbalance compares the highest and lowest phase loading. The planner reports the result as a percentage and identifies the reference phases where appropriate."], },
    ],
    related: ["warnings", "power-sources", "system-overview"],
  },
  {
    title: "Connector Reference",
    slug: "connector-reference",
    category: "Reference",
    updated: "June 2026",
    readTime: "7 min read",
    description: "Common connector and phase references used by the planner.",
    summary: "A practical reference for connector labels and phase terminology used in LVA Power Planner.",
    tags: ["connectors", "13A", "16A", "32A", "63A", "125A", "Powerlock", "Socapex"],
    sections: [
      { heading: "Single-phase connectors", body: ["Common single-phase labels include 13A, 16A / 1, 32A / 1 and 63A / 1 where applicable."], },
      { heading: "Three-phase connectors", body: ["Common three-phase labels include 32A / 3, 63A / 3, 125A / 3, 200A / 3, 300A / 3 and 400A / 3."], },
      { heading: "Socapex", body: ["Socapex outputs are represented as grouped six-circuit outputs with circuits allocated across L1, L2 and L3."], },
    ],
    related: ["distro-editor", "custom-distros", "glossary"],
  },
  {
    title: "Best Practice",
    slug: "best-practice",
    category: "Reference",
    updated: "June 2026",
    readTime: "7 min read",
    description: "Recommended workflow before issuing reports.",
    summary: "A practical checklist for preparing reliable project files and reports.",
    tags: ["best practice", "workflow", "reports", "backup", "review"],
    sections: [
      { heading: "Recommended build order", body: ["Build projects in a consistent order: project information, manual sources, distros, source assignment, equipment assignment, downstream feeds, warning review and report export."], },
      { heading: "Before exporting reports", body: ["Review System Overview, check unassigned distros, confirm report toggles, resolve critical warnings and export a JSON backup."], },
      { heading: "Record keeping", body: ["Keep dated project exports for major revisions so the design history can be recovered if needed."], },
    ],
    related: ["reports", "import-export", "warnings"],
  },
  {
    title: "FAQ",
    slug: "faq",
    category: "Reference",
    updated: "June 2026",
    readTime: "6 min read",
    description: "Common questions and troubleshooting.",
    summary: "Answers to common operational questions.",
    tags: ["faq", "troubleshooting", "auto source", "warning", "report"],
    sections: [
      { heading: "Why can I not assign a source?", body: ["The source may be incompatible, already assigned to another distro or belong to the distro's own output. Check connector type and existing assignments."], },
      { heading: "What is an Auto Source?", body: ["An Auto Source is a virtual source created from an eligible distro output. It allows downstream distros to be connected while still calculating load through the parent distro."], },
      { heading: "Why did my dismissed warning come back?", body: ["Dismissed warnings return when the underlying load changes significantly. This prevents an old dismissal from hiding a newly changed condition."], },
      { heading: "Why is a report missing a distro?", body: ["Check the Report tab toggles. Sources and distros can be hidden from the report export without being removed from the project."], },
    ],
    related: ["warnings", "reports", "distro-overview"],
  },
  {
    title: "Glossary",
    slug: "glossary",
    category: "Reference",
    updated: "June 2026",
    readTime: "6 min read",
    description: "Definitions of common terms used in LVA Power Planner.",
    summary: "A quick reference for key planner terms.",
    tags: ["glossary", "terms", "definitions"],
    sections: [
      { heading: "Power Source", body: ["A venue supply, generator or auto-created output source that can feed one compatible distro."] },
      { heading: "Distro", body: ["A distribution unit with an input connector and one or more outputs feeding equipment or downstream distribution."] },
      { heading: "Auto Source", body: ["A source automatically generated from an eligible distro output so another distro can be fed downstream."] },
      { heading: "Phase imbalance", body: ["A measure of uneven loading between L1, L2 and L3 on a three-phase supply."] },
      { heading: "Report Hidden Source", body: ["A source that remains in the project but is excluded from the current report export."] },
    ],
    related: ["connector-reference", "calculations"],
  },
  {
    title: "Release Notes",
    slug: "release-notes",
    category: "Reference",
    updated: "June 2026",
    readTime: "4 min read",
    description: "Current documentation and product notes.",
    summary: "A customer-facing record of notable LVA Power Planner updates.",
    tags: ["release notes", "updates", "version"],
    sections: [
      { heading: "Documentation centre", body: ["Online documentation includes searchable articles, category navigation, article pages, metadata, callouts, related articles, previous/next navigation and command-palette search."], },
      { heading: "Current planner functionality", body: ["Current documented features include MFA login, branded workspaces, project dashboard, system overview, manual and auto sources, distro management, drag-and-drop equipment assignment, custom equipment, custom distros, warnings, report exports and JSON import/export."], },
    ],
    related: ["introduction", "best-practice"],
  },
];

export function articleBySlug(slug: string) {
  return docArticles.find((article) => article.slug === slug);
}

export function orderedDocArticles() {
  return docCategories
    .flatMap((category) => category.items.map((item) => item.slug))
    .map((slug) => articleBySlug(slug))
    .filter((article): article is DocArticle => Boolean(article));
}

export function previousNextArticle(slug: string) {
  const flat = orderedDocArticles();
  const index = flat.findIndex((article) => article.slug === slug);

  return {
    previous: index > 0 ? flat[index - 1] : undefined,
    next: index >= 0 && index < flat.length - 1 ? flat[index + 1] : undefined,
  };
}

export function relatedArticles(slugs: string[] = []) {
  return slugs
    .map((slug) => docArticles.find((article) => article.slug === slug))
    .filter((article): article is DocArticle => Boolean(article));
}

export function articleSearchText(article: DocArticle) {
  return [
    article.title,
    article.description,
    article.category,
    article.summary,
    ...article.tags,
    ...article.sections.flatMap((section) => [
      section.heading,
      ...section.body,
      ...(section.steps ?? []),
      ...(section.bullets ?? []),
      section.callout?.title ?? "",
      section.callout?.body ?? "",
      section.screenshot?.title ?? "",
      section.screenshot?.caption ?? "",
    ]),
  ]
    .join(" ")
    .toLowerCase();
}
