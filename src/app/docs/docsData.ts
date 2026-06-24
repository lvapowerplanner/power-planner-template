export type DocCategory = {
  title: string;
  items: Array<{ title: string; slug: string; description: string }>;
};

export type DocSection = {
  heading: string;
  body: string[];
  callout?: {
    type: "tip" | "warning" | "info" | "best";
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
  sections: DocSection[];
};

export const docCategories: DocCategory[] = [
  {
    title: "Getting Started",
    items: [
      { title: "Introduction", slug: "introduction", description: "What LVA Power Planner does and who it is for." },
      { title: "Logging In", slug: "logging-in", description: "Accessing your workspace and account security." },
      { title: "Creating Projects", slug: "creating-projects", description: "Create, open, rename and manage projects." },
    ],
  },
  {
    title: "Planning",
    items: [
      { title: "System Overview", slug: "system-overview", description: "Review the full temporary power system." },
      { title: "Power Sources", slug: "power-sources", description: "Add venue supplies, generators and auto sources." },
      { title: "Distro Overview", slug: "distro-overview", description: "Add, assign and manage distribution units." },
      { title: "Distro Editor", slug: "distro-editor", description: "Assign equipment, notes and downstream distros." },
    ],
  },
  {
    title: "Equipment & Templates",
    items: [
      { title: "Custom Equipment", slug: "custom-equipment", description: "Create project-specific equipment items." },
      { title: "Custom Distros", slug: "custom-distros", description: "Build project-specific distro templates." },
    ],
  },
  {
    title: "Reports & Data",
    items: [
      { title: "Reports", slug: "reports", description: "Generate branded PDF and distro reports." },
      { title: "Import & Export", slug: "import-export", description: "Back up, restore and share planner data." },
    ],
  },
  {
    title: "Reference",
    items: [
      { title: "Warnings", slug: "warnings", description: "Understand active, dismissed and critical warnings." },
      { title: "FAQ", slug: "faq", description: "Common questions and troubleshooting." },
      { title: "Glossary", slug: "glossary", description: "Key terms used in the planner." },
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
    sections: [
      {
        heading: "What LVA Power Planner is",
        body: [
          "LVA Power Planner helps production teams create structured temporary power plans for generators, venue supplies, distros, circuits, equipment loads and professional reports.",
          "The planner is designed to replace disconnected spreadsheets with a live project model that recalculates whenever sources, distros or equipment are changed.",
        ],
      },
      {
        heading: "Who it is for",
        body: [
          "The software is intended for AV companies, production electricians, project managers, production managers, rental companies and temporary power specialists working on live events and temporary installations.",
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
  },
  {
    title: "Logging In",
    slug: "logging-in",
    category: "Getting Started",
    updated: "June 2026",
    readTime: "4 min read",
    description: "Sign in securely to your company workspace.",
    sections: [
      {
        heading: "Workspace access",
        body: [
          "Users sign in to the workspace provided by their organisation. Workspaces may include company branding, a company equipment library and company distro templates.",
          "Accounts are normally created or invited by the workspace administrator.",
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
  },
  {
    title: "Creating Projects",
    slug: "creating-projects",
    category: "Getting Started",
    updated: "June 2026",
    readTime: "5 min read",
    description: "Create, open, rename and remove project files.",
    sections: [
      {
        heading: "Create a new project",
        body: [
          "From the project dashboard, enter a project name and select Create Project. The new project opens with an empty planner state ready for sources, distros and equipment.",
          "Use a clear project name that matches your internal job or production naming convention.",
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
  },
  {
    title: "System Overview",
    slug: "system-overview",
    category: "Planning",
    updated: "June 2026",
    readTime: "8 min read",
    description: "Understand the full power hierarchy and project status.",
    sections: [
      {
        heading: "Purpose of the System Overview",
        body: [
          "System Overview is the main health check for the project. It shows the power hierarchy, source loading, distro loading, downstream relationships, unassigned distros and active warnings.",
        ],
      },
      {
        heading: "Project information",
        body: [
          "The project information panel stores the details used by reports: Project Manager, Project Number, Project Name, Event Date and Venue.",
        ],
      },
      {
        heading: "Colour and warning status",
        body: [
          "Cards are highlighted when warnings or critical issues are present. Three-phase and single-phase items use visual highlighting so users can quickly understand the system structure.",
        ],
        callout: {
          type: "info",
          title: "Open from overview",
          body: "Use the Open button on a distro card to jump directly to that distro in the Distro Editor.",
        },
      },
    ],
  },
  {
    title: "Power Sources",
    slug: "power-sources",
    category: "Planning",
    updated: "June 2026",
    readTime: "8 min read",
    description: "Create and manage venue supplies, generators and auto-created sources.",
    sections: [
      {
        heading: "Manual power sources",
        body: [
          "Manual power sources represent venue supplies, generators or main incoming power points. Enter a source name, connection type and notes, then add it to the project.",
          "Each source displays connected watts, total draw, phase loading and assigned distros.",
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
  },
  {
    title: "Distro Overview",
    slug: "distro-overview",
    category: "Planning",
    updated: "June 2026",
    readTime: "7 min read",
    description: "Add, organise and assign distribution units.",
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
        ],
      },
      {
        heading: "Source assignment",
        body: [
          "Only compatible sources are offered in the Source selector. The planner checks connector type, phase and rating to prevent invalid connections.",
        ],
        callout: {
          type: "tip",
          title: "Build top down",
          body: "Add main power sources first, then add primary distros, then downstream distros. This keeps the hierarchy easier to follow.",
        },
      },
    ],
  },
  {
    title: "Distro Editor",
    slug: "distro-editor",
    category: "Planning",
    updated: "June 2026",
    readTime: "12 min read",
    description: "Assign equipment, manage outputs and create downstream feeds.",
    sections: [
      {
        heading: "Equipment library",
        body: [
          "The left-hand equipment library contains company equipment and custom project equipment. Search or filter by category, then drag an item onto an output or use the output dropdown.",
        ],
      },
      {
        heading: "Output cards",
        body: [
          "Each output card shows output type, rating, assigned equipment, quantity, notes and loading. Loads are recalculated immediately when equipment is added, moved, edited or removed.",
        ],
      },
      {
        heading: "Downstream distros",
        body: [
          "Compatible downstream distros can be selected from an output. The planner creates the correct auto source and prevents circular distribution loops.",
        ],
        callout: {
          type: "warning",
          title: "Compatibility rules",
          body: "If a distro does not appear as a downstream option, check its input type and whether it is already assigned to another source.",
        },
      },
      {
        heading: "Socapex outputs",
        body: [
          "Socapex outputs are shown as grouped circuits across L1, L2 and L3. Where breaker pairs are linked, the editor shows shared breaker capacity and warning information.",
        ],
      },
    ],
  },
  {
    title: "Custom Equipment",
    slug: "custom-equipment",
    category: "Equipment & Templates",
    updated: "June 2026",
    readTime: "4 min read",
    description: "Create project-specific equipment items.",
    sections: [
      {
        heading: "When to use custom equipment",
        body: [
          "Use Custom Equipment when a project requires an item that is not present in the company equipment library.",
          "Custom equipment is stored inside the project and appears in the Distro Editor equipment library.",
        ],
      },
      {
        heading: "Creating equipment",
        body: [
          "Enter the equipment name, category and wattage, then select Add Custom Equipment. The wattage is used for load calculations throughout the planner.",
        ],
      },
    ],
  },
  {
    title: "Custom Distros",
    slug: "custom-distros",
    category: "Equipment & Templates",
    updated: "June 2026",
    readTime: "7 min read",
    description: "Create custom distro templates for a project.",
    sections: [
      {
        heading: "Custom distro templates",
        body: [
          "Custom Distros allows users to build project-specific distro definitions with an input connector and a set of outputs.",
        ],
      },
      {
        heading: "Output types",
        body: [
          "Custom distros can include single-phase outputs, three-phase outputs and Socapex outputs. Outputs can be reordered before saving the template.",
        ],
      },
      {
        heading: "Using saved custom distros",
        body: [
          "Saved custom distros appear in the Distro Overview add list with a Custom prefix.",
        ],
      },
    ],
  },
  {
    title: "Reports",
    slug: "reports",
    category: "Reports & Data",
    updated: "June 2026",
    readTime: "10 min read",
    description: "Generate branded PDF reports and individual distro reports.",
    sections: [
      {
        heading: "Report preview",
        body: [
          "The Report tab shows a live preview of the export layout. It includes project information, source summaries, distro details, outputs, equipment, notes and loading data.",
        ],
      },
      {
        heading: "Include or hide items",
        body: [
          "Use the source and distro checkboxes to control what appears in the export. This is useful when issuing partial reports to different teams or departments.",
        ],
      },
      {
        heading: "Export options",
        body: [
          "Export PDF creates the main report. Export Distro Reports creates separate distro-focused report pages for site distribution labels, technical packs or local crew information.",
        ],
        callout: {
          type: "best",
          title: "Before exporting",
          body: "Review System Overview and Power Sources for critical warnings before issuing a report.",
        },
      },
    ],
  },
  {
    title: "Import & Export",
    slug: "import-export",
    category: "Reports & Data",
    updated: "June 2026",
    readTime: "5 min read",
    description: "Back up, restore and share planner data.",
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
    ],
  },
  {
    title: "Warnings",
    slug: "warnings",
    category: "Reference",
    updated: "June 2026",
    readTime: "9 min read",
    description: "Understand active, dismissed and critical planner warnings.",
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
  },
  {
    title: "FAQ",
    slug: "faq",
    category: "Reference",
    updated: "June 2026",
    readTime: "8 min read",
    description: "Answers to common questions.",
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
    ],
  },
  {
    title: "Glossary",
    slug: "glossary",
    category: "Reference",
    updated: "June 2026",
    readTime: "6 min read",
    description: "Definitions of common terms used in LVA Power Planner.",
    sections: [
      {
        heading: "Power Source",
        body: ["A venue supply, generator or auto-created output source that can feed one or more compatible distros."],
      },
      {
        heading: "Distro",
        body: ["A distribution unit with an input connector and one or more outputs feeding equipment or downstream distribution."],
      },
      {
        heading: "Auto Source",
        body: ["A source automatically generated from an eligible distro output so another distro can be fed downstream."],
      },
      {
        heading: "Phase imbalance",
        body: ["A measure of uneven loading between L1, L2 and L3 on a three-phase supply."],
      },
    ],
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
