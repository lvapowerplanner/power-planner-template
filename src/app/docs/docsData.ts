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
    readTime: "7 min read",
    description: "Add, assign and manage distribution units.",
    summary: "Distro Overview is where distros are added from libraries, assigned to sources and reviewed before detailed editing.",
    tags: ["distros", "distro overview", "source assignment", "company library", "custom distros"],
    sections: [
      { heading: "Add a distro", body: ["Choose a distro type from the company library or custom distro list, then select Add Distro. The new distro is added to the project and can be assigned to a compatible source."], callout: { type: "tip", title: "Name the instance", body: "Use the instance name for practical labels such as Stage Left, FOH, Video World or Catering." } },
      { heading: "Assign a source", body: ["Use the Source dropdown to connect the distro to a compatible manual source or Auto Source. Only compatible sources are shown to avoid mismatched connector types and duplicated source assignments."], },
      { heading: "Review distro cards", body: ["Each card shows the distro type, input, output count, phase loading and warning state. Use Open to continue detailed output editing in the Distro Editor."], },
    ],
    related: ["distro-editor", "power-sources", "custom-distros"],
  },
  {
    title: "Distro Editor",
    slug: "distro-editor",
    category: "Planning Workflow",
    updated: "June 2026",
    readTime: "12 min read",
    description: "Assign equipment, notes and downstream distros.",
    summary: "The Distro Editor is the detailed workspace for assigning equipment to outputs and building downstream distribution.",
    tags: ["distro editor", "drag and drop", "equipment", "outputs", "socapex", "notes"],
    sections: [
      { heading: "Equipment library", body: ["The left-hand equipment library contains company equipment and any project-specific custom equipment. Search or filter by category, then drag equipment onto an output or use the dropdown inside the output card."], },
      { heading: "Output editing", body: ["Outputs show rating, phase, current load and assigned equipment. Quantities and notes can be edited directly on assigned items. Output notes appear in reports and are useful for cable routes, patch references or operating restrictions."], },
      { heading: "Socapex outputs", body: ["Socapex outputs display their individual circuits by phase. Where linked breaker pairs are configured, the editor shows shared breaker capacity so paired circuit loading can be reviewed correctly."], callout: { type: "warning", title: "Shared breaker capacity", body: "When Socapex circuits share a breaker, review the shared load rather than treating each socket as independent." } },
    ],
    related: ["company-libraries", "custom-equipment", "downstream-distribution"],
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
    readTime: "5 min read",
    description: "Create project-specific equipment items.",
    summary: "Custom equipment is used when an item is required for one project but is not part of the company library.",
    tags: ["custom equipment", "equipment", "watts", "category"],
    sections: [
      { heading: "Create custom equipment", body: ["Enter the equipment name, category and wattage, then add it to the project. The item appears in the Distro Editor alongside company equipment."], },
      { heading: "Edit or delete", body: ["Project custom equipment can be edited or deleted from the Custom Equipment tab. Changes affect future assignments of that item in the current project."], },
      { heading: "When to use it", body: ["Use custom equipment for one-off items, temporary substitutions or client-supplied equipment that does not belong in the company library."], },
    ],
    related: ["distro-editor", "company-libraries"],
  },
  {
    title: "Custom Distros",
    slug: "custom-distros",
    category: "Equipment & Templates",
    updated: "June 2026",
    readTime: "6 min read",
    description: "Build project-specific distro templates.",
    summary: "Custom distros allow users to create temporary distro definitions for one project.",
    tags: ["custom distros", "templates", "outputs", "socapex"],
    sections: [
      { heading: "Create a custom distro", body: ["Enter a distro name and input type, then add outputs. Outputs can be single-phase, three-phase or Socapex depending on the required layout."], },
      { heading: "Save and use", body: ["Saved custom distros appear in Distro Overview with the Custom prefix and can be added to the project like company library distros."], },
      { heading: "Project scope", body: ["Custom distros are stored within the project rather than the company library. Use them for project-specific requirements or temporary layouts."], },
    ],
    related: ["distro-overview", "distro-editor", "company-libraries"],
  },
  {
    title: "Reports",
    slug: "reports",
    category: "Reports & Data",
    updated: "June 2026",
    readTime: "8 min read",
    description: "Generate branded PDF and distro reports.",
    summary: "The Report tab creates branded project reports from the current planner state.",
    tags: ["reports", "pdf", "export", "individual distro reports", "branding"],
    sections: [
      { heading: "Report preview", body: ["The Report tab shows a preview of the export layout. Project information, company branding, sources, distros, output schedules, notes and load summaries are taken from the planner state."], },
      { heading: "Select included items", body: ["Sources and distros can be hidden from the current export without being removed from the project. This is useful when preparing a report for a specific department or contractor."], },
      { heading: "Export options", body: ["Use Export PDF for the full report. Use Export Distro Reports to create individual distro reports for the selected distros."], callout: { type: "best", title: "Check warnings first", body: "Review System Overview before exporting. Reports should not be issued with unresolved critical warnings unless there is a documented reason." } },
    ],
    related: ["system-overview", "warnings", "import-export"],
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
