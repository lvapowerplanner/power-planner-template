export type CalloutType = "tip" | "warning" | "info" | "best" | "danger";

export type DocCategory = {
  title: string;
  description: string;
  items: Array<{ title: string; slug: string; description: string }>;
};

export type DocSection = {
  heading: string;
  body: string[];
  steps?: string[];
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
    readTime: "5 min read",
    description: "LVA Power Planner is a professional planning tool for live event and temporary power systems.",
    summary: "Use LVA Power Planner to build structured power plans, calculate connected load, monitor system warnings and produce branded reports.",
    sections: [
      {
        heading: "What LVA Power Planner is",
        body: [
          "LVA Power Planner helps production teams create structured temporary power plans for generators, venue supplies, distros, circuits, equipment loads and professional reports.",
          "The planner replaces disconnected spreadsheets with a live project model that recalculates whenever sources, distros or equipment are changed.",
        ],
      },
      {
        heading: "Who it is for",
        body: [
          "The software is intended for AV companies, production electricians, project managers, production managers, rental companies and temporary power specialists working on live events and temporary installations.",
        ],
      },
      {
        heading: "Core workflow",
        body: [
          "A typical workflow starts with project details, continues through source and distro planning, then finishes with equipment assignment, warning review and report export.",
        ],
        steps: [
          "Create or open a project.",
          "Complete project information in System Overview.",
          "Add manual power sources such as generators or venue supplies.",
          "Add distros from the company library or project custom templates.",
          "Assign equipment and downstream distribution in the Distro Editor.",
          "Review active warnings and export reports.",
        ],
      },
      {
        heading: "Important compliance note",
        body: [
          "LVA Power Planner is an indicative planning and documentation tool. It does not certify, verify or guarantee compliance with BS 7909, BS 7671, venue requirements or any other standard.",
          "Responsibility for verification, installation, inspection, testing and compliance remains with the competent duty holder and the user issuing the design or report.",
        ],
        callout: {
          type: "warning",
          title: "Competent review required",
          body: "Always review exported reports and resolve critical warnings before issuing documentation to site teams or clients.",
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
    readTime: "4 min read",
    description: "Sign in securely to your company workspace.",
    summary: "Users sign in to their assigned workspace with email/password, optional Microsoft sign-in and MFA where enabled.",
    sections: [
      {
        heading: "Workspace access",
        body: [
          "Users sign in to the workspace provided by their organisation. Workspaces may include company branding, a company equipment library, company distro templates and workspace-specific login options.",
          "Accounts are normally created or invited by the workspace administrator. If an account is not assigned to the current workspace, access is denied.",
        ],
      },
      {
        heading: "Multi-factor authentication",
        body: [
          "Where MFA is required, follow the on-screen instructions to scan the QR code into an authenticator app, then enter the 6-digit code to complete setup.",
          "On later sign-ins, enter the current code from the authenticator app when prompted.",
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
          "Use Reset Password on the login page to request a password reset email. After resetting your password, return to your workspace and sign in again.",
        ],
      },
    ],
    related: ["creating-projects", "company-libraries"],
  },
  {
    title: "Creating Projects",
    slug: "creating-projects",
    category: "Getting Started",
    updated: "June 2026",
    readTime: "6 min read",
    description: "Create, open, rename and remove project files.",
    summary: "Projects store sources, distros, equipment assignments, report options, dismissed warnings and project information.",
    sections: [
      {
        heading: "Create a new project",
        body: [
          "From the project dashboard, enter a project name and select Create Project. The new project opens with an empty planner state ready for sources, distros and equipment.",
          "Use a clear project name that matches your internal job, event or production naming convention.",
        ],
      },
      {
        heading: "Project information",
        body: [
          "In System Overview, complete Project Manager, Project Number, Project Name, Event Date and Venue. These values are used in report headers and project exports.",
        ],
        callout: {
          type: "best",
          title: "Best practice",
          body: "Complete project information before building the system so exported reports are correctly labelled from the start.",
        },
      },
      {
        heading: "Rename or delete projects",
        body: [
          "Projects can be renamed or deleted from the dashboard. Deleting a project removes that project and its planner data, so export a backup first if the data may be needed later.",
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
    readTime: "8 min read",
    description: "Understand the full power hierarchy and project status.",
    summary: "System Overview is the main health check for the project and shows sources, downstream distros, project details, loading and warnings.",
    sections: [
      {
        heading: "Purpose of the System Overview",
        body: [
          "System Overview is the main health check for the project. It shows the power hierarchy, source loading, distro loading, downstream relationships, unassigned distros and active warnings.",
          "Use this tab to confirm that every distro is fed, loading is acceptable and there are no critical issues before exporting reports.",
        ],
      },
      {
        heading: "Project information",
        body: [
          "The project information panel stores the details used by reports: Project Manager, Project Number, Project Name, Event Date and Venue.",
        ],
      },
      {
        heading: "Visual system tree",
        body: [
          "Each manual power source appears as a parent card. Assigned distros appear beneath the source, with downstream distros nested under their parent outputs.",
          "Open buttons on distro cards jump directly to that distro in the Distro Editor.",
        ],
        callout: {
          type: "info",
          title: "Single-phase and three-phase highlighting",
          body: "Visual highlights help distinguish single-phase and three-phase items when reviewing the system hierarchy.",
        },
      },
      {
        heading: "Unassigned distros",
        body: [
          "Distros that have not been assigned to a source are shown in the Unassigned Distros section. Assign a source before issuing reports so the full system hierarchy is clear.",
        ],
      },
    ],
    related: ["power-sources", "distro-overview", "warnings"],
  },
  {
    title: "Power Sources",
    slug: "power-sources",
    category: "Planning Workflow",
    updated: "June 2026",
    readTime: "8 min read",
    description: "Create and manage venue supplies, generators and auto-created sources.",
    summary: "Power Sources are the starting points for the system, including manual supplies and auto-created downstream output sources.",
    sections: [
      {
        heading: "Manual power sources",
        body: [
          "Manual power sources represent venue supplies, generators or main incoming power points. Enter a source name, connection type and notes, then add it to the project.",
          "Each source displays connected watts, total draw, phase loading and assigned distros.",
        ],
      },
      {
        heading: "Source notes",
        body: [
          "Use source notes for generator location, venue DB information, cable route comments, supply restrictions or operational notes that should be visible during planning and reporting.",
        ],
      },
      {
        heading: "Auto sources",
        body: [
          "Auto sources are created automatically from eligible distro outputs. They allow a downstream distro to be fed from a parent distro output while still appearing as a usable source within the planner.",
        ],
        callout: {
          type: "info",
          title: "Eligible outputs",
          body: "Distro outputs rated 32A or above can create downstream auto sources. Socapex outputs do not create auto sources.",
        },
      },
      {
        heading: "Assigned distros",
        body: [
          "The assigned distro area shows which distros are currently fed from each source. Use Open beside a distro to jump directly into the editor.",
        ],
      },
    ],
    related: ["downstream-distribution", "distro-overview", "calculations"],
  },
  {
    title: "Distro Overview",
    slug: "distro-overview",
    category: "Planning Workflow",
    updated: "June 2026",
    readTime: "7 min read",
    description: "Add, organise and assign distribution units.",
    summary: "Distro Overview is used to add distros from libraries, name them, assign locations and connect them to compatible sources.",
    sections: [
      {
        heading: "Adding distros",
        body: [
          "Choose a distro type from the company library or from custom distros created inside the project. Select Add Distro to add it to the project.",
        ],
      },
      {
        heading: "Naming and location",
        body: [
          "Use the optional Name and Location fields to identify each distro clearly, for example Stage Left, FOH Audio or LED Wall PSU Rack.",
          "Clear naming improves System Overview, Reports and individual distro exports.",
        ],
      },
      {
        heading: "Assigning sources",
        body: [
          "The Source selector only displays compatible power sources. If a source is missing, check the connector type, phase type and whether the source is already assigned to another distro.",
        ],
      },
      {
        heading: "Opening the editor",
        body: [
          "Select Open on a distro card to jump directly into the Distro Editor for that distro.",
        ],
      },
    ],
    related: ["distro-editor", "power-sources", "company-libraries"],
  },
  {
    title: "Distro Editor",
    slug: "distro-editor",
    category: "Planning Workflow",
    updated: "June 2026",
    readTime: "12 min read",
    description: "Assign equipment, notes and downstream distros.",
    summary: "Distro Editor is where most detailed planning happens: equipment assignment, quantities, notes, output loading and downstream feeds.",
    sections: [
      {
        heading: "Equipment sidebar",
        body: [
          "The equipment library sidebar lists company equipment and project custom equipment. Use search and category filters to find items quickly.",
          "Drag equipment onto an output, or use the output dropdown where available.",
        ],
      },
      {
        heading: "Editing the active distro",
        body: [
          "Use the Editing Distro selector to switch between distros without returning to Distro Overview. The header displays the active distro name, input and loading summary.",
        ],
      },
      {
        heading: "Assigning equipment",
        body: [
          "Drop equipment onto single-phase outputs, three-phase outputs or Socapex socket circuits. Update quantity and notes directly on the assigned equipment item.",
        ],
        steps: [
          "Find the equipment item in the sidebar.",
          "Drag it onto the correct output or Socapex circuit.",
          "Adjust quantity if more than one item is connected.",
          "Add notes for circuit purpose, fixture address, rack location or operational comments.",
        ],
      },
      {
        heading: "Moving equipment",
        body: [
          "Assigned equipment can be dragged between outputs. The planner recalculates the source, distro and phase loading after the move.",
        ],
      },
      {
        heading: "Output notes",
        body: [
          "Use output notes for cable details, circuit references, patch notes or any information that should appear on exported reports.",
        ],
        callout: {
          type: "best",
          title: "Label practical details",
          body: "Output notes make reports more useful on site. Include details that help technicians identify where each circuit should go.",
        },
      },
    ],
    related: ["downstream-distribution", "custom-equipment", "reports"],
  },
  {
    title: "Downstream Distribution",
    slug: "downstream-distribution",
    category: "Planning Workflow",
    updated: "June 2026",
    readTime: "9 min read",
    description: "Feed distros from distro outputs using auto sources.",
    summary: "Downstream distribution allows a child distro to be fed from a compatible parent distro output while keeping load calculations connected through the hierarchy.",
    sections: [
      {
        heading: "What downstream distribution means",
        body: [
          "A downstream distro is a distro fed from an output on another distro rather than directly from a manual source.",
          "When a compatible output exists, the planner creates an auto source that can be selected as the child distro source.",
        ],
      },
      {
        heading: "Connecting a downstream distro",
        body: [
          "Open the parent distro in Distro Editor. On an eligible output, select the child distro to feed from that output.",
        ],
        steps: [
          "Add both the parent and child distros to the project.",
          "Open the parent distro in Distro Editor.",
          "Find the output that will feed the child distro.",
          "Select the child distro in the downstream feed control.",
          "Review System Overview to confirm the child now appears under the parent distro.",
        ],
      },
      {
        heading: "Compatibility and loop prevention",
        body: [
          "Only compatible downstream distros are shown. The planner also prevents circular feed loops, such as feeding a parent distro from one of its own downstream children.",
        ],
        callout: {
          type: "info",
          title: "Why a distro is missing",
          body: "If a downstream distro does not appear, check connector compatibility, phase type and whether connecting it would create a circular feed path.",
        },
      },
    ],
    related: ["distro-editor", "power-sources", "system-overview"],
  },
  {
    title: "Company Libraries",
    slug: "company-libraries",
    category: "Equipment & Templates",
    updated: "June 2026",
    readTime: "5 min read",
    description: "How company stock and distro libraries appear in projects.",
    summary: "Company libraries provide reusable equipment and distro templates for each workspace so teams plan with consistent stock data.",
    sections: [
      {
        heading: "Equipment library",
        body: [
          "Company equipment appears in the Distro Editor equipment sidebar. Each item includes a category, name and wattage used for calculations.",
          "Workspace administrators maintain the company stock library so users plan with approved equipment data.",
        ],
      },
      {
        heading: "Distro library",
        body: [
          "Company distros appear in the Distro Overview add list. Each template defines an input connector, input rating and output layout.",
        ],
      },
      {
        heading: "Project custom items",
        body: [
          "If an item is not in the company library, users can create project-specific custom equipment or custom distro templates without changing the shared company library.",
        ],
      },
    ],
    related: ["custom-equipment", "custom-distros", "distro-editor"],
  },
  {
    title: "Custom Equipment",
    slug: "custom-equipment",
    category: "Equipment & Templates",
    updated: "June 2026",
    readTime: "5 min read",
    description: "Create project-specific equipment items.",
    summary: "Custom equipment is useful for temporary, unusual or project-only items that are not part of the company library.",
    sections: [
      {
        heading: "Create custom equipment",
        body: [
          "Open Custom Equipment, enter an equipment name, category and wattage, then select Add Custom Equipment.",
          "The item appears in the Distro Editor equipment sidebar and can be dragged onto outputs like any company equipment item.",
        ],
      },
      {
        heading: "Editing and deleting",
        body: [
          "Project custom equipment can be edited or deleted from the Custom Equipment tab. Changes affect the project custom library.",
        ],
        callout: {
          type: "tip",
          title: "Use consistent names",
          body: "Name custom equipment clearly so it is easy to find later in the Distro Editor search.",
        },
      },
    ],
    related: ["distro-editor", "company-libraries"],
  },
  {
    title: "Custom Distros",
    slug: "custom-distros",
    category: "Equipment & Templates",
    updated: "June 2026",
    readTime: "7 min read",
    description: "Build project-specific distro templates.",
    summary: "Custom distros allow users to create project-specific distro templates with configured inputs and outputs.",
    sections: [
      {
        heading: "Create a custom distro",
        body: [
          "Open Custom Distros, enter a distro name, select an input type and add outputs. Save the custom distro when the layout is complete.",
        ],
      },
      {
        heading: "Output types",
        body: [
          "Custom distros can include single-phase outputs, three-phase outputs and Socapex outputs. Socapex outputs include the standard six-circuit layout with circuits mapped across L1, L2 and L3.",
        ],
      },
      {
        heading: "Using custom distros",
        body: [
          "Saved custom distros appear in the Distro Overview add list prefixed with Custom. They are stored inside the project rather than the shared company library.",
        ],
        callout: {
          type: "best",
          title: "Build before planning",
          body: "Create project-specific distro templates before building the main system so they are available from the start.",
        },
      },
    ],
    related: ["distro-overview", "company-libraries"],
  },
  {
    title: "Reports",
    slug: "reports",
    category: "Reports & Data",
    updated: "June 2026",
    readTime: "9 min read",
    description: "Generate branded PDF and distro reports.",
    summary: "Reports turn the live planner model into branded documentation for site teams, clients and project records.",
    sections: [
      {
        heading: "Report preview",
        body: [
          "The Report tab shows a preview of the exported report layout. It includes project information, branding, sources, distros, output schedules, equipment loads and notes.",
        ],
      },
      {
        heading: "Selecting sources and distros",
        body: [
          "Use the source and distro toggles to decide what appears in the exported report. This is useful when producing focused documentation for a specific department or area.",
        ],
      },
      {
        heading: "Show all outputs",
        body: [
          "Show All Outputs includes unused outputs in the report. Hide Unused Outputs produces a more compact report showing only populated or noted outputs.",
        ],
      },
      {
        heading: "Export options",
        body: [
          "Export PDF generates the main report. Export Distro Reports generates individual distro pages for the currently selected distros.",
        ],
        callout: {
          type: "warning",
          title: "Review before issue",
          body: "Exported reports are based on user-entered information. Always review the report and warning state before sending it to site teams or clients.",
        },
      },
    ],
    related: ["warnings", "creating-projects", "import-export"],
  },
  {
    title: "Import & Export",
    slug: "import-export",
    category: "Reports & Data",
    updated: "June 2026",
    readTime: "5 min read",
    description: "Back up, restore and share planner data.",
    summary: "JSON project export provides a portable backup of the planner state. Import replaces the current planner state after confirmation.",
    sections: [
      {
        heading: "Export project",
        body: [
          "Export Project downloads the full planner state as a JSON file. Use this before major revisions, before deleting projects or when archiving a final design.",
        ],
      },
      {
        heading: "Import project",
        body: [
          "Import Project replaces the current project planner data with the selected JSON file after confirmation.",
        ],
        callout: {
          type: "warning",
          title: "Import replaces current data",
          body: "Always export a backup before importing into a project that already contains important data.",
        },
      },
      {
        heading: "Recommended backup points",
        body: [
          "Export a project backup before major revisions, before deleting old versions, before issuing final reports and after completing a confirmed design.",
        ],
      },
    ],
    related: ["creating-projects", "reports"],
  },
  {
    title: "Warning System",
    slug: "warnings",
    category: "Reference",
    updated: "June 2026",
    readTime: "10 min read",
    description: "Understand active, dismissed and critical planner warnings.",
    summary: "Warnings identify conditions that need review, while critical issues identify calculated limits that have been exceeded.",
    sections: [
      {
        heading: "Warning types",
        body: [
          "The planner can show output overloads, near-capacity outputs, source overloads, phase imbalance, shared Socapex breaker warnings and unassigned distribution issues.",
        ],
      },
      {
        heading: "Critical vs warning",
        body: [
          "Critical issues indicate that a calculated value has exceeded a limit. Warnings indicate that a limit is being approached or that a condition should be reviewed.",
        ],
        callout: {
          type: "danger",
          title: "Critical warnings",
          body: "Critical warnings should not be ignored. Resolve or professionally review them before reports are issued.",
        },
      },
      {
        heading: "Dismissed warnings",
        body: [
          "Non-critical warnings can be dismissed where the user has reviewed and accepted the condition. Dismissed warnings are grouped separately and counted in the warning panel.",
          "Dismissed warnings automatically return when the monitored value changes significantly, helping users avoid missing issues after design changes.",
        ],
        callout: {
          type: "info",
          title: "Why a warning returned",
          body: "A dismissed warning may reappear after a significant load change so the revised condition can be reviewed again.",
        },
      },
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
    summary: "The planner uses user-entered wattages and 230V calculations to estimate connected current and phase loading across the system.",
    sections: [
      {
        heading: "Watts to amps",
        body: [
          "Equipment wattage is converted to current using a 230V nominal calculation. The calculated current is used for output, distro and source loading.",
        ],
      },
      {
        heading: "Single-phase outputs",
        body: [
          "Single-phase output load is assigned to the selected phase. For example, an L2 output contributes load to L2 only.",
        ],
      },
      {
        heading: "Three-phase outputs",
        body: [
          "Three-phase equipment load is distributed evenly across L1, L2 and L3 for the purpose of planning calculations.",
        ],
      },
      {
        heading: "Nested distro loads",
        body: [
          "Downstream distro loads are included in the parent distro output, the parent distro total and the upstream source total.",
        ],
        callout: {
          type: "info",
          title: "Live recalculation",
          body: "When equipment is moved, edited or deleted, parent and source totals update automatically.",
        },
      },
    ],
    related: ["downstream-distribution", "warnings", "power-sources"],
  },
  {
    title: "Connector Reference",
    slug: "connector-reference",
    category: "Reference",
    updated: "June 2026",
    readTime: "7 min read",
    description: "Common connector and phase references used by the planner.",
    summary: "Connector names in the planner identify the rating and phase type used for compatibility checks and calculations.",
    sections: [
      {
        heading: "Single-phase connectors",
        body: [
          "Common single-phase options include 13A, 16A / 1, 32A / 1 and 63A / 1 where available in custom outputs.",
        ],
      },
      {
        heading: "Three-phase connectors",
        body: [
          "Common three-phase options include 32A / 3, 63A / 3, 125A / 3, 200A / 3, 300A / 3 and 400A / 3. Powerlock-style high current connectors are treated as three-phase connectors for planning.",
        ],
      },
      {
        heading: "Socapex",
        body: [
          "Socapex outputs are modelled as six 16A circuits, with two circuits on each phase: L1, L2 and L3. Shared breaker pairs are monitored where applicable.",
        ],
      },
      {
        heading: "Compatibility",
        body: [
          "The planner only shows compatible sources for distro assignment. This helps prevent single-phase distros being assigned to unsuitable outputs and prevents mismatched current ratings where compatibility rules require exact matching.",
        ],
      },
    ],
    related: ["distro-overview", "downstream-distribution", "warnings"],
  },
  {
    title: "Best Practice",
    slug: "best-practice",
    category: "Reference",
    updated: "June 2026",
    readTime: "6 min read",
    description: "Recommended workflow before issuing reports.",
    summary: "Follow a consistent planning sequence to reduce errors and produce clearer reports.",
    sections: [
      {
        heading: "Recommended sequence",
        body: [
          "The most reliable workflow is to build the system from the top down, then assign equipment, then review warnings and export reports.",
        ],
        steps: [
          "Create the project and complete project information.",
          "Add manual power sources.",
          "Add distros and assign sources.",
          "Create any custom equipment or custom distros required for the project.",
          "Open each distro and assign equipment to outputs.",
          "Connect downstream distros from eligible outputs.",
          "Review System Overview and warnings.",
          "Export a project backup.",
          "Export PDF reports.",
        ],
      },
      {
        heading: "Before issuing reports",
        body: [
          "Check that project information is complete, all intended distros are connected, critical warnings have been resolved and report toggles include the required sources and distros.",
        ],
        callout: {
          type: "best",
          title: "Final export habit",
          body: "Export both the PDF report and a JSON project backup at the same revision point.",
        },
      },
    ],
    related: ["reports", "warnings", "import-export"],
  },
  {
    title: "FAQ",
    slug: "faq",
    category: "Reference",
    updated: "June 2026",
    readTime: "8 min read",
    description: "Answers to common questions.",
    summary: "Troubleshooting answers for source assignment, auto sources, warnings and reports.",
    sections: [
      {
        heading: "Why can't I assign a source?",
        body: [
          "The source selector only shows compatible sources. Check the distro input, source connector, phase type and whether the source is already assigned elsewhere.",
        ],
      },
      {
        heading: "What is an Auto Source?",
        body: [
          "An Auto Source is a virtual source created from an eligible distro output. It allows downstream distros to be connected while still calculating load through the parent distro.",
        ],
      },
      {
        heading: "Why did my dismissed warning come back?",
        body: [
          "Dismissed warnings return when the underlying load changes significantly. This prevents an old dismissal from hiding a newly changed condition.",
        ],
      },
      {
        heading: "Why is a report missing a distro?",
        body: [
          "Check the Report tab toggles. Sources and distros can be hidden from the report export without being removed from the project.",
        ],
      },
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
    sections: [
      {
        heading: "Version 1.0 documentation centre",
        body: [
          "Initial online documentation centre with searchable articles, category navigation, article pages, callouts, related articles and previous/next navigation.",
        ],
      },
      {
        heading: "Recent planner functionality",
        body: [
          "Current documented features include MFA login, branded workspaces, project dashboard, system overview, manual and auto sources, distro management, drag-and-drop equipment assignment, custom equipment, custom distros, warnings, report exports and JSON import/export.",
        ],
      },
    ],
    related: ["introduction", "best-practice"],
  },
];

export function articleBySlug(slug: string) {
  return docArticles.find((article) => article.slug === slug);
}

export function previousNextArticle(slug: string) {
  const flat = docCategories.flatMap((category) => category.items);
  const index = flat.findIndex((item) => item.slug === slug);

  return {
    previous: index > 0 ? flat[index - 1] : null,
    next: index >= 0 && index < flat.length - 1 ? flat[index + 1] : null,
  };
}

export function relatedArticles(slugs: string[] = []) {
  return slugs
    .map((slug) => docArticles.find((article) => article.slug === slug))
    .filter((article): article is DocArticle => Boolean(article));
}
