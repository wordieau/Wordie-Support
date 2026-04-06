const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, AlignmentType, HeadingLevel, BorderStyle, WidthType,
  ShadingType, VerticalAlign, PageNumber, PageBreak, LevelFormat,
  ExternalHyperlink, TableOfContents
} = require('docx');
const fs = require('fs');

// ─── Colour palette ───────────────────────────────────────────────────────────
const BRAND_BLUE   = "1B4FD8";  // primary
const LIGHT_BLUE   = "EFF4FF";  // table header fill
const MID_BLUE     = "DBEAFE";  // alternating row fill
const ACCENT_GREEN = "16A34A";
const ACCENT_AMBER = "D97706";
const ACCENT_RED   = "DC2626";
const DARK_GREY    = "1E293B";
const MID_GREY     = "64748B";
const LIGHT_GREY   = "F1F5F9";
const BORDER_GREY  = "CBD5E1";
const WHITE        = "FFFFFF";

// ─── Page geometry (A4, 2cm margins) ─────────────────────────────────────────
const PAGE_W     = 11906;
const PAGE_H     = 16838;
const MARGIN     = 1134;   // ~2 cm
const CONTENT_W  = PAGE_W - MARGIN * 2;  // 9638 DXA

// ─── Border helpers ───────────────────────────────────────────────────────────
const hairline = (color = BORDER_GREY) => ({ style: BorderStyle.SINGLE, size: 1, color });
const thinBorder = (color = BORDER_GREY) => ({ style: BorderStyle.SINGLE, size: 4, color });
const allBorders = (color = BORDER_GREY) => ({
  top: hairline(color), bottom: hairline(color),
  left: hairline(color), right: hairline(color),
});
const noBorder = () => ({ style: BorderStyle.NONE, size: 0, color: WHITE });
const noAllBorders = () => ({ top: noBorder(), bottom: noBorder(), left: noBorder(), right: noBorder() });

// ─── Spacing helpers ──────────────────────────────────────────────────────────
const sp  = (before, after) => ({ spacing: { before, after } });
const spLine = (before, after, line) => ({ spacing: { before, after, line } });

// ─── Text helpers ─────────────────────────────────────────────────────────────
const run  = (text, opts = {}) => new TextRun({ text, font: "Arial", ...opts });
const bold = (text, opts = {}) => run(text, { bold: true, ...opts });
const code = (text) => new TextRun({ text, font: "Courier New", size: 18, color: "0F172A" });

// ─── Paragraph helpers ────────────────────────────────────────────────────────
const h1 = (text) => new Paragraph({
  heading: HeadingLevel.HEADING_1,
  children: [new TextRun({ text, font: "Arial", bold: true })],
  ...sp(400, 160),
});
const h2 = (text) => new Paragraph({
  heading: HeadingLevel.HEADING_2,
  children: [new TextRun({ text, font: "Arial", bold: true })],
  ...sp(320, 120),
});
const h3 = (text) => new Paragraph({
  heading: HeadingLevel.HEADING_3,
  children: [new TextRun({ text, font: "Arial", bold: true })],
  ...sp(240, 80),
});
const p = (children, opts = {}) => new Paragraph({
  children: Array.isArray(children) ? children : [run(children)],
  ...spLine(0, 160, 276),
  ...opts,
});
const gap = (size = 160) => new Paragraph({ children: [run("")], spacing: { before: 0, after: size } });

// ─── Divider line ─────────────────────────────────────────────────────────────
const divider = () => new Paragraph({
  children: [run("")],
  border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: BRAND_BLUE, space: 1 } },
  spacing: { before: 0, after: 240 },
});

// ─── Bullet helper ────────────────────────────────────────────────────────────
const bullet = (children, level = 0) => new Paragraph({
  numbering: { reference: "bullets", level },
  children: Array.isArray(children) ? children : [run(children)],
  ...spLine(0, 80, 276),
});

// ─── Numbered list helper ─────────────────────────────────────────────────────
const numbered = (children, ref = "numbers") => new Paragraph({
  numbering: { reference: ref, level: 0 },
  children: Array.isArray(children) ? children : [run(children)],
  ...spLine(0, 80, 276),
});

// ─── Table cell helper ────────────────────────────────────────────────────────
const cell = (children, opts = {}) => new TableCell({
  borders: allBorders(BORDER_GREY),
  margins: { top: 100, bottom: 100, left: 160, right: 160 },
  verticalAlign: VerticalAlign.TOP,
  ...opts,
  children: Array.isArray(children) ? children : [p(Array.isArray(children) ? children : [run(children)])],
});

const headerCell = (text, w, color = LIGHT_BLUE) => new TableCell({
  borders: allBorders(BORDER_GREY),
  margins: { top: 100, bottom: 100, left: 160, right: 160 },
  shading: { fill: color, type: ShadingType.CLEAR },
  width: { size: w, type: WidthType.DXA },
  verticalAlign: VerticalAlign.CENTER,
  children: [new Paragraph({
    children: [new TextRun({ text, font: "Arial", bold: true, color: DARK_GREY, size: 18 })],
    alignment: AlignmentType.LEFT,
  })],
});

const dataCell = (text, w, shade = WHITE, textColor = DARK_GREY, bold_t = false) => new TableCell({
  borders: allBorders(BORDER_GREY),
  margins: { top: 80, bottom: 80, left: 160, right: 160 },
  shading: { fill: shade, type: ShadingType.CLEAR },
  width: { size: w, type: WidthType.DXA },
  children: [new Paragraph({
    children: [new TextRun({ text, font: "Arial", color: textColor, size: 18, bold: bold_t })],
  })],
});

const dataCodeCell = (text, w) => new TableCell({
  borders: allBorders(BORDER_GREY),
  margins: { top: 80, bottom: 80, left: 160, right: 160 },
  width: { size: w, type: WidthType.DXA },
  children: [new Paragraph({ children: [code(text)] })],
});

// ─── Section label badge ──────────────────────────────────────────────────────
const sectionBadge = (num, title) => new Paragraph({
  children: [
    new TextRun({ text: `${num}  `, font: "Arial", bold: true, color: WHITE, size: 22,
      highlight: undefined }),
    new TextRun({ text: title, font: "Arial", bold: true, color: WHITE, size: 22 }),
  ],
  shading: { fill: BRAND_BLUE, type: ShadingType.CLEAR },
  spacing: { before: 400, after: 200 },
  indent: { left: 160, right: 160 },
  border: {
    left: { style: BorderStyle.SINGLE, size: 12, color: ACCENT_GREEN, space: 4 },
  },
});

// ─── Inline highlight ─────────────────────────────────────────────────────────
const tag = (text, color = BRAND_BLUE) =>
  new TextRun({ text: ` ${text} `, font: "Arial", bold: true, color: WHITE,
    shading: { fill: color, type: ShadingType.CLEAR }, size: 17 });

// ─── Two-column info table ────────────────────────────────────────────────────
const infoRow = (label, value, shade = WHITE) => new TableRow({
  children: [
    new TableCell({
      borders: allBorders(BORDER_GREY),
      margins: { top: 80, bottom: 80, left: 160, right: 160 },
      width: { size: 2800, type: WidthType.DXA },
      shading: { fill: LIGHT_GREY, type: ShadingType.CLEAR },
      children: [new Paragraph({ children: [bold(label, { size: 18, color: DARK_GREY })] })],
    }),
    new TableCell({
      borders: allBorders(BORDER_GREY),
      margins: { top: 80, bottom: 80, left: 160, right: 160 },
      width: { size: 6838, type: WidthType.DXA },
      shading: { fill: shade, type: ShadingType.CLEAR },
      children: [new Paragraph({ children: [run(value, { size: 18, color: DARK_GREY })] })],
    }),
  ],
});

const infoTable = (rows) => new Table({
  width: { size: CONTENT_W, type: WidthType.DXA },
  columnWidths: [2800, 6838],
  rows: rows.map(([l, v, s]) => infoRow(l, v, s)),
});

// ─── Code block (monospace table) ────────────────────────────────────────────
const codeBlock = (lines) => new Table({
  width: { size: CONTENT_W, type: WidthType.DXA },
  columnWidths: [CONTENT_W],
  rows: [new TableRow({
    children: [new TableCell({
      borders: allBorders("0F172A"),
      margins: { top: 120, bottom: 120, left: 200, right: 200 },
      shading: { fill: "0F172A", type: ShadingType.CLEAR },
      width: { size: CONTENT_W, type: WidthType.DXA },
      children: lines.map(l => new Paragraph({
        children: [new TextRun({ text: l, font: "Courier New", size: 18, color: "E2E8F0" })],
        spacing: { before: 0, after: 40 },
      })),
    })],
  })],
});

// ─── Status colour legend table ───────────────────────────────────────────────
const legendRow = (color, label, desc) => new TableRow({
  children: [
    new TableCell({
      borders: allBorders(BORDER_GREY),
      margins: { top: 80, bottom: 80, left: 160, right: 160 },
      shading: { fill: color, type: ShadingType.CLEAR },
      width: { size: 1200, type: WidthType.DXA },
      children: [new Paragraph({ children: [run("", { size: 18 })] })],
    }),
    new TableCell({
      borders: allBorders(BORDER_GREY),
      margins: { top: 80, bottom: 80, left: 160, right: 160 },
      width: { size: 2000, type: WidthType.DXA },
      children: [new Paragraph({ children: [bold(label, { size: 18 })] })],
    }),
    new TableCell({
      borders: allBorders(BORDER_GREY),
      margins: { top: 80, bottom: 80, left: 160, right: 160 },
      width: { size: 6438, type: WidthType.DXA },
      children: [new Paragraph({ children: [run(desc, { size: 18 })] })],
    }),
  ],
});

// ═══════════════════════════════════════════════════════════════════════════════
//  DOCUMENT BUILD
// ═══════════════════════════════════════════════════════════════════════════════

const doc = new Document({
  numbering: {
    config: [
      {
        reference: "bullets",
        levels: [
          { level: 0, format: LevelFormat.BULLET, text: "\u2022",
            alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 560, hanging: 280 } } } },
          { level: 1, format: LevelFormat.BULLET, text: "\u25E6",
            alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 1120, hanging: 280 } } } },
        ],
      },
      {
        reference: "numbers",
        levels: [
          { level: 0, format: LevelFormat.DECIMAL, text: "%1.",
            alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 560, hanging: 280 } } } },
        ],
      },
    ],
  },
  styles: {
    default: {
      document: { run: { font: "Arial", size: 20, color: DARK_GREY } },
    },
    paragraphStyles: [
      { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 36, bold: true, font: "Arial", color: DARK_GREY },
        paragraph: { spacing: { before: 400, after: 160 }, outlineLevel: 0 } },
      { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 28, bold: true, font: "Arial", color: BRAND_BLUE },
        paragraph: { spacing: { before: 320, after: 120 }, outlineLevel: 1 } },
      { id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 22, bold: true, font: "Arial", color: DARK_GREY },
        paragraph: { spacing: { before: 200, after: 80 }, outlineLevel: 2 } },
    ],
  },
  sections: [{
    properties: {
      page: {
        size: { width: PAGE_W, height: PAGE_H },
        margin: { top: MARGIN, right: MARGIN, bottom: MARGIN, left: MARGIN },
      },
    },
    headers: {
      default: new Header({
        children: [
          new Paragraph({
            children: [
              bold("Wordie Resource Planner", { size: 18, color: MID_GREY }),
              run("   |   Product Design & Architecture", { size: 18, color: MID_GREY }),
              new TextRun({ children: ["\t", PageNumber.CURRENT], font: "Arial", size: 18, color: MID_GREY }),
            ],
            tabStops: [{ type: "right", position: 9638 }],
            border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: BORDER_GREY, space: 1 } },
          }),
        ],
      }),
    },
    footers: {
      default: new Footer({
        children: [
          new Paragraph({
            children: [run("Confidential \u2014 Wordie Internal", { size: 16, color: MID_GREY })],
            border: { top: { style: BorderStyle.SINGLE, size: 4, color: BORDER_GREY, space: 1 } },
          }),
        ],
      }),
    },

    // ──────────────────────────────────────────────────────────────────────────
    children: [

      // ══════ COVER ══════════════════════════════════════════════════════════
      new Paragraph({
        children: [run("")],
        spacing: { before: 0, after: 800 },
      }),
      new Paragraph({
        children: [new TextRun({
          text: "WORDIE RESOURCE PLANNER",
          font: "Arial", bold: true, size: 52, color: BRAND_BLUE,
        })],
        alignment: AlignmentType.LEFT,
        spacing: { before: 0, after: 120 },
      }),
      new Paragraph({
        children: [new TextRun({
          text: "Product Design & Architecture",
          font: "Arial", size: 30, color: MID_GREY,
        })],
        spacing: { before: 0, after: 80 },
      }),
      new Paragraph({
        children: [run("")],
        border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: BRAND_BLUE, space: 1 } },
        spacing: { before: 0, after: 240 },
      }),
      gap(120),
      infoTable([
        ["System", "HubSpot (source of truth) + Everhour (time tracking)"],
        ["Goal", "Resource planning, scheduling, and capacity forecasting"],
        ["Reference Product", "Resource Guru"],
        ["Author", "Stewart Lemalu"],
        ["Date", "April 2026"],
        ["Version", "1.0 — Initial Design Document"],
      ]),
      gap(400),

      // Executive Summary
      h2("Executive Summary"),
      p([
        run("This document defines the product design, data architecture, UI/UX approach, AI capabilities, and MVP roadmap for the "),
        bold("Wordie Resource Planner"),
        run(" \u2014 a bespoke resource scheduling system built on top of HubSpot Tickets and Everhour time tracking. The goal is to replicate the core planning experience of Resource Guru without a third-party tool, giving Wordie a single source of truth for capacity, delivery, and forecasting."),
      ]),
      gap(200),

      // TOC
      new TableOfContents("Table of Contents", {
        hyperlink: true,
        headingStyleRange: "1-3",
      }),
      new Paragraph({ children: [new PageBreak()] }),

      // ══════ SECTION 1 ══════════════════════════════════════════════════════
      sectionBadge("01", "Resource Planning Layer"),
      h1("1. Resource Planning Layer"),
      p("The foundation of the planner converts HubSpot Tickets into visual, calendar-based work blocks. Each ticket carries the metadata required to become a scheduled allocation: an estimate, an owner, and a date range."),
      gap(120),

      h2("1.1 Ticket-to-Allocation Mapping"),
      p("Every HubSpot Ticket with a time estimate, start date, due date, and owner is eligible for scheduling. The system reads these fields via the HubSpot API and creates an internal Allocation record."),
      gap(80),

      // Data model table
      new Table({
        width: { size: CONTENT_W, type: WidthType.DXA },
        columnWidths: [2200, 1800, 2000, 3638],
        rows: [
          new TableRow({
            tableHeader: true,
            children: [
              headerCell("Field", 2200),
              headerCell("HubSpot Property", 1800),
              headerCell("Type", 2000),
              headerCell("Notes", 3638),
            ],
          }),
          new TableRow({ children: [
            dataCell("ticket_id", 2200, LIGHT_GREY), dataCodeCell("hs_object_id", 1800),
            dataCell("string", 2000), dataCell("Primary key from HubSpot", 3638),
          ]}),
          new TableRow({ children: [
            dataCell("title", 2200), dataCodeCell("subject", 1800),
            dataCell("string", 2000), dataCell("Ticket name displayed on calendar block", 3638),
          ]}),
          new TableRow({ children: [
            dataCell("owner_id", 2200, LIGHT_GREY), dataCodeCell("hubspot_owner_id", 1800),
            dataCell("string", 2000, LIGHT_GREY), dataCell("Maps to team member in planner", 3638, LIGHT_GREY),
          ]}),
          new TableRow({ children: [
            dataCell("estimate_hours", 2200), dataCodeCell("time_estimate", 1800),
            dataCell("float", 2000), dataCell("Total planned hours for the ticket", 3638),
          ]}),
          new TableRow({ children: [
            dataCell("start_date", 2200, LIGHT_GREY), dataCodeCell("start_date", 1800),
            dataCell("date", 2000, LIGHT_GREY), dataCell("Scheduling window start", 3638, LIGHT_GREY),
          ]}),
          new TableRow({ children: [
            dataCell("due_date", 2200), dataCodeCell("due_date", 1800),
            dataCell("date", 2000), dataCell("Scheduling window end", 3638),
          ]}),
          new TableRow({ children: [
            dataCell("pipeline_stage", 2200, LIGHT_GREY), dataCodeCell("hs_pipeline_stage", 1800),
            dataCell("string", 2000, LIGHT_GREY), dataCell("Drives soft vs hard allocation logic", 3638, LIGHT_GREY),
          ]}),
          new TableRow({ children: [
            dataCell("allocation_type", 2200), dataCodeCell("(derived)", 1800),
            dataCell("enum", 2000), dataCell("SOFT or HARD \u2014 set by pipeline stage mapping config", 3638),
          ]}),
        ],
      }),
      gap(200),

      h2("1.2 Daily Hour Distribution Algorithm"),
      p("When a ticket is imported, the system distributes its estimated hours evenly across working days within the date range. Weekends and public holidays (configurable per team) are excluded."),
      gap(80),
      codeBlock([
        "function distributeHours(estimateHours, startDate, dueDate, workingDays) {",
        "  const days = getWorkingDaysBetween(startDate, dueDate, workingDays);",
        "  const hoursPerDay = estimateHours / days.length;",
        "  return days.map(date => ({",
        "    date,",
        "    allocatedHours: roundTo2dp(hoursPerDay),",
        "  }));",
        "}",
        "",
        "// Example: 10h ticket, Mon 7 Apr \u2192 Fri 11 Apr (5 working days)",
        "// Result: 2h/day across 5 days",
      ]),
      gap(160),
      p("Manual overrides are supported: a planner can drag a block to resize it (changing per-day hours) or move it to a different date range. Overrides are stored locally and are not written back to HubSpot automatically, keeping HubSpot clean while allowing planning flexibility."),
      gap(120),

      h2("1.3 Soft vs Hard Allocations"),
      p("Allocations are classified based on the ticket\u2019s HubSpot pipeline stage. This allows planners to visualise both committed and anticipated workload side by side."),
      gap(80),
      new Table({
        width: { size: CONTENT_W, type: WidthType.DXA },
        columnWidths: [2000, 2000, 2819, 2819],
        rows: [
          new TableRow({ tableHeader: true, children: [
            headerCell("Type", 2000), headerCell("Pipeline Stages", 2000),
            headerCell("Visual Style", 2819), headerCell("Included in Capacity?", 2819),
          ]}),
          new TableRow({ children: [
            dataCell("SOFT", 2000, "FEF9C3", "92400E", true),
            dataCell("Prospect, Proposal Sent", 2000),
            dataCell("Dashed border, 50% opacity fill", 2819),
            dataCell("Optional (toggle in UI)", 2819),
          ]}),
          new TableRow({ children: [
            dataCell("HARD", 2000, "DCFCE7", "166534", true),
            dataCell("Active, In Review, On Hold", 2000, LIGHT_GREY),
            dataCell("Solid fill, full opacity", 2819, LIGHT_GREY),
            dataCell("Always yes", 2819, LIGHT_GREY),
          ]}),
        ],
      }),
      gap(200),

      h2("1.4 Drag-and-Drop Scheduling"),
      p("The planner UI supports three drag-and-drop interactions:"),
      gap(80),
      bullet([bold("Move: "), run("drag a block horizontally to shift dates, or vertically to reassign to another team member. The system recalculates daily hours and checks for capacity conflicts.")]),
      bullet([bold("Resize: "), run("drag the right edge of a block to extend or compress the date range. Daily hours adjust proportionally.")]),
      bullet([bold("Create: "), run("drag from empty space to create a manual allocation not linked to a HubSpot Ticket (useful for meetings, admin, leave).")]),
      gap(160),
      p("All interactions trigger a real-time capacity recalculation for affected users and days. Conflicts surface immediately as visual warnings without blocking the action."),
      new Paragraph({ children: [new PageBreak()] }),

      // ══════ SECTION 2 ══════════════════════════════════════════════════════
      sectionBadge("02", "Capacity & Utilisation"),
      h1("2. Capacity & Utilisation"),

      h2("2.1 User Capacity Model"),
      p("Each team member has a configurable weekly capacity (default 40h). The system also supports part-time configurations and leave periods."),
      gap(80),
      codeBlock([
        "// User capacity record",
        "{",
        "  user_id: 'hs_owner_123',",
        "  name: 'Alex Chen',",
        "  weekly_capacity_hours: 40,",
        "  daily_capacity_hours: 8,          // derived: weekly / 5",
        "  leave_periods: [",
        "    { from: '2026-04-14', to: '2026-04-17', reason: 'Annual Leave' },",
        "  ],",
        "  working_days: ['Mon','Tue','Wed','Thu','Fri'],",
        "}",
      ]),
      gap(200),

      h2("2.2 Utilisation Calculation"),
      p("For any given day or week, utilisation is calculated as:"),
      gap(80),
      codeBlock([
        "utilisationPct = (totalAllocatedHours / availableCapacityHours) * 100",
        "",
        "// Example: Alex has 8h capacity on Wednesday.",
        "// Tickets allocated: Ticket A (3h) + Ticket B (2.5h) + Ticket C (1h) = 6.5h",
        "// Utilisation: (6.5 / 8) * 100 = 81.25%  \u2192 Green (healthy)",
      ]),
      gap(160),

      h2("2.3 Utilisation Banding & Visual Indicators"),
      gap(80),
      new Table({
        width: { size: CONTENT_W, type: WidthType.DXA },
        columnWidths: [1200, 2000, 6438],
        rows: [
          new TableRow({ tableHeader: true, children: [
            headerCell("Colour", 1200), headerCell("Range", 2000), headerCell("Meaning", 6438),
          ]}),
          legendRow("DCFCE7", "0 \u2013 79%", "Healthy \u2014 capacity available, no action needed"),
          legendRow("FEF9C3", "80 \u2013 99%", "Near capacity \u2014 monitor, avoid adding more without review"),
          legendRow("FEE2E2", "100%", "Fully allocated \u2014 no remaining capacity this period"),
          legendRow("7F1D1D", "101%+", "Overbooked \u2014 immediate attention required, AI suggestions triggered"),
        ],
      }),
      gap(200),

      h2("2.4 Overbooking Detection"),
      p("The system flags overbooking at the day level. When a person\u2019s allocated hours for a day exceed their daily capacity, every block contributing to the overbook is highlighted with a red indicator. A summary banner appears at the top of their row showing the overage amount (e.g. \u201c+2.5h over capacity on Thu 10 Apr\u201d)."),
      gap(120),
      p("Planners can resolve overbooking by:"),
      bullet("Moving a ticket to a different date range"),
      bullet("Reassigning a ticket to another team member"),
      bullet("Reducing the time estimate on a ticket (syncs back to HubSpot)"),
      bullet("Using the AI Reallocation Suggest feature (see Section 5)"),
      new Paragraph({ children: [new PageBreak()] }),

      // ══════ SECTION 3 ══════════════════════════════════════════════════════
      sectionBadge("03", "Everhour Integration"),
      h1("3. Everhour Integration"),

      h2("3.1 Data Sync Strategy"),
      p("Everhour stores actual time entries against tasks (which are linked to HubSpot Tickets via a custom integration or task name matching). The planner polls Everhour\u2019s REST API every 15 minutes and on-demand via a manual refresh button."),
      gap(80),
      codeBlock([
        "GET https://api.everhour.com/team/time?limit=200",
        "  &from=2026-04-01&to=2026-04-30",
        "Headers: X-Invision-Api-Token: {EVERHOUR_API_KEY}",
        "",
        "// Response item mapped to:",
        "{",
        "  ticket_id:     matched via task.name or custom attribute,",
        "  user_id:       mapped via Everhour user \u2192 HubSpot owner lookup,",
        "  date:          entry date,",
        "  actual_hours:  entry.time / 3600,",
        "}",
      ]),
      gap(160),

      h2("3.2 Planned vs Actual Comparison"),
      p("For each ticket, the planner accumulates actual hours from Everhour and surfaces a variance:"),
      gap(80),
      new Table({
        width: { size: CONTENT_W, type: WidthType.DXA },
        columnWidths: [3000, 2200, 2200, 2238],
        rows: [
          new TableRow({ tableHeader: true, children: [
            headerCell("Metric", 3000), headerCell("Source", 2200),
            headerCell("Example", 2200), headerCell("Status", 2238),
          ]}),
          new TableRow({ children: [
            dataCell("Planned Hours", 3000), dataCell("HubSpot time_estimate", 2200),
            dataCell("12h", 2200), dataCell("\u2014", 2238),
          ]}),
          new TableRow({ children: [
            dataCell("Actual Hours (to date)", 3000, LIGHT_GREY), dataCell("Everhour", 2200, LIGHT_GREY),
            dataCell("9.5h", 2200, LIGHT_GREY), dataCell("\u2014", 2238, LIGHT_GREY),
          ]}),
          new TableRow({ children: [
            dataCell("Remaining Estimate", 3000), dataCell("Planner (user-adjusted)", 2200),
            dataCell("4h", 2200), dataCell("\u2014", 2238),
          ]}),
          new TableRow({ children: [
            dataCell("Forecast Total", 3000, LIGHT_GREY), dataCell("Actual + Remaining", 2200, LIGHT_GREY),
            dataCell("13.5h", 2200, LIGHT_GREY), dataCell("+1.5h over estimate", 2238, "FEE2E2", ACCENT_RED, true),
          ]}),
          new TableRow({ children: [
            dataCell("Variance", 3000), dataCell("Forecast \u2212 Planned", 2200),
            dataCell("+1.5h", 2200), dataCell("At risk", 2238, "FEF9C3", ACCENT_AMBER, true),
          ]}),
        ],
      }),
      gap(200),

      h2("3.3 Ticket Detail Panel \u2014 Actuals View"),
      p("Clicking any calendar block opens a slide-over panel showing:"),
      bullet([bold("Header: "), run("Ticket name, HubSpot pipeline stage badge, owner avatar")]),
      bullet([bold("Hours summary: "), run("Planned / Actual / Remaining / Forecast in a 4-cell stat grid")]),
      bullet([bold("Day-by-day breakdown: "), run("A mini table of planned hours per day vs actual hours logged")]),
      bullet([bold("Variance bar: "), run("A horizontal progress bar comparing planned to forecast total, colour-coded by risk")]),
      bullet([bold("Everhour link: "), run("Deep link to the Everhour task for quick time entry")]),
      bullet([bold("HubSpot link: "), run("Deep link to the ticket in HubSpot for edits")]),
      new Paragraph({ children: [new PageBreak()] }),

      // ══════ SECTION 4 ══════════════════════════════════════════════════════
      sectionBadge("04", "UI / UX Design"),
      h1("4. UI / UX Design"),

      h2("4.1 Layout Structure"),
      p("The application uses a three-panel layout inspired by Resource Guru: a left sidebar for navigation and filters, a top date/person header, and the main scheduling canvas."),
      gap(80),
      codeBlock([
        "\u250c\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u252c\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510",
        "\u2502  Sidebar   \u2502           Top Nav + Date Range Picker              \u2502",
        "\u2502  Nav       \u251c\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2502",
        "\u2502  Filters   \u2502  Person row 1  [ Block ][ Block ]          [ + ]   \u2502",
        "\u2502            \u2502  Person row 2  [ Block ][     Long block   ]       \u2502",
        "\u2502  AI Tray   \u2502  Person row 3  (empty \u2014 available)                  \u2502",
        "\u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2534\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518",
      ]),
      gap(160),

      h2("4.2 Views"),
      gap(80),
      h3("People View (Primary)"),
      p("Rows represent team members. Columns represent days. Each block is a ticket allocation showing: ticket name (truncated), hours allocated that day, and a colour indicating utilisation. Scroll horizontally to navigate weeks. A sticky utilisation percentage appears at the right edge of each row."),
      gap(80),
      h3("Project / Timeline View"),
      p("Rows represent tickets/projects. Columns represent days. Useful for reviewing a single project\u2019s schedule across multiple assignees. Bars span the full date range of the ticket with sub-blocks per person shown stacked within the row."),
      gap(80),
      h3("Week View"),
      p("A dense grid showing Mon\u2013Fri for the selected week. Each cell shows the person\u2019s available hours, allocated hours, and utilisation bar. Designed for weekly stand-up and sprint planning contexts."),
      gap(200),

      h2("4.3 Calendar Block Design"),
      p("Each block on the calendar conveys at a glance:"),
      bullet([bold("Left colour strip: "), run("mapped to the project or client for quick scanning (consistent colour per project)")]),
      bullet([bold("Block body: "), run("ticket name, hours allocated today, owner initials if in project view")]),
      bullet([bold("Top-right badge: "), run("SOFT or HARD allocation type")]),
      bullet([bold("Background fill: "), run("utilisation colour band (green / amber / red)")]),
      bullet([bold("Bottom progress bar: "), run("actual vs planned hours consumed (from Everhour)")]),
      gap(160),

      h2("4.4 Utilisation Bar (Per Person Row)"),
      p("To the right of each person\u2019s name in the sidebar, a compact weekly utilisation bar displays:"),
      bullet("A horizontal bar fill from 0\u2013100% (clipped and highlighted red if over 100%)"),
      bullet("The numeric percentage next to the bar"),
      bullet("A small chevron icon if AI suggestions are available for that person"),
      gap(200),

      h2("4.5 Ticket Detail Panel (Slide-over)"),
      p("Clicking any block opens a right-side panel (360px wide, full height) without leaving the calendar view. It contains:"),
      bullet("4-stat header: Estimated / Logged / Remaining / Forecast"),
      bullet("Variance indicator with risk badge"),
      bullet("Scheduled days table (planned vs actual per day)"),
      bullet("AI insight card (if relevant predictions exist)"),
      bullet("Action buttons: Edit in HubSpot, Log Time in Everhour, Reassign, Delete allocation"),
      gap(200),

      h2("4.6 Unscheduled Ticket Queue"),
      p("A collapsible drawer at the bottom of the screen lists all HubSpot Tickets that have an estimate and date range but have not yet been manually reviewed. Planners can drag from this queue directly onto the calendar to confirm the auto-allocation, or right-click to assign to a different person."),
      new Paragraph({ children: [new PageBreak()] }),

      // ══════ SECTION 5 ══════════════════════════════════════════════════════
      sectionBadge("05", "AI Capabilities"),
      h1("5. AI Capabilities"),
      p("Each AI feature is grounded in real data from HubSpot and Everhour. Features are surfaced contextually \u2014 they appear when relevant, not as a separate \u201cAI\u201d screen."),
      gap(120),

      h2("5.1 Overcapacity Detection & Reallocation Suggestions"),
      gap(80),
      new Table({
        width: { size: CONTENT_W, type: WidthType.DXA },
        columnWidths: [2200, 7438],
        rows: [
          new TableRow({ children: [
            headerCell("Attribute", 2200), headerCell("Detail", 7438),
          ]}),
          new TableRow({ children: [
            dataCell("Trigger", 2200, LIGHT_GREY), dataCell("Any team member exceeds 100% utilisation on 2+ consecutive days", 7438, LIGHT_GREY),
          ]}),
          new TableRow({ children: [
            dataCell("Data Used", 2200), dataCell("Allocated hours per day, user capacity, ticket priority, ticket due dates, Everhour historical throughput per user", 7438),
          ]}),
          new TableRow({ children: [
            dataCell("Example Input", 2200, LIGHT_GREY),
            dataCell("Alex is 130% booked Mon\u2013Wed. Three tickets overlap: Ticket A (4h/d, due Fri), Ticket B (2h/d, due next Mon), Ticket C (2h/d, due Wed).", 7438, LIGHT_GREY),
          ]}),
          new TableRow({ children: [
            dataCell("Example Output", 2200),
            dataCell("\"Alex is overbooked by 6h across Mon\u2013Wed. Ticket B has the latest due date \u2014 consider moving it to Jordan (22h available this week) or shifting it to start Thursday. Estimated resolution: Alex at 100%, Jordan at 78%.\"", 7438),
          ]}),
          new TableRow({ children: [
            dataCell("UI Placement", 2200, LIGHT_GREY),
            dataCell("AI suggestion card appears in the person row header and in the detail panel of the overbooked ticket. One-click accept applies the suggestion.", 7438, LIGHT_GREY),
          ]}),
        ],
      }),
      gap(200),

      h2("5.2 Delivery Delay Prediction"),
      gap(80),
      new Table({
        width: { size: CONTENT_W, type: WidthType.DXA },
        columnWidths: [2200, 7438],
        rows: [
          new TableRow({ children: [
            headerCell("Attribute", 2200), headerCell("Detail", 7438),
          ]}),
          new TableRow({ children: [
            dataCell("Trigger", 2200, LIGHT_GREY), dataCell("Ticket is 50%+ through its date range but actual hours are below 40% of estimate", 7438, LIGHT_GREY),
          ]}),
          new TableRow({ children: [
            dataCell("Data Used", 2200), dataCell("Ticket start/due date, estimate, Everhour actuals to date, remaining capacity for the owner before the due date", 7438),
          ]}),
          new TableRow({ children: [
            dataCell("Example Input", 2200, LIGHT_GREY),
            dataCell("Ticket: \u201cClient Portal Redesign\u201d. Estimate: 20h. Due: 11 Apr. Today: 7 Apr (73% through range). Logged: 6h (30% of estimate). Alex has 4h remaining capacity before due date.", 7438, LIGHT_GREY),
          ]}),
          new TableRow({ children: [
            dataCell("Example Output", 2200),
            dataCell("\"At current pace, this ticket will finish 6h short of completion by the due date. With 4h of capacity remaining, forecast completion is 10h (50% of estimate). Consider extending the due date to 16 Apr, reducing scope, or adding a second resource.\"", 7438),
          ]}),
          new TableRow({ children: [
            dataCell("UI Placement", 2200, LIGHT_GREY),
            dataCell("Risk badge on the calendar block (\u26a0 At Risk). Expanded detail in the ticket detail panel with a forecast completion date.", 7438, LIGHT_GREY),
          ]}),
        ],
      }),
      gap(200),

      h2("5.3 Optimal Scheduling Recommendation"),
      gap(80),
      new Table({
        width: { size: CONTENT_W, type: WidthType.DXA },
        columnWidths: [2200, 7438],
        rows: [
          new TableRow({ children: [
            headerCell("Attribute", 2200), headerCell("Detail", 7438),
          ]}),
          new TableRow({ children: [
            dataCell("Trigger", 2200, LIGHT_GREY), dataCell("New ticket pulled from Unscheduled Queue or newly created in HubSpot", 7438, LIGHT_GREY),
          ]}),
          new TableRow({ children: [
            dataCell("Data Used", 2200), dataCell("All team members\u2019 capacity windows, existing allocations, ticket skill tags (if configured), historical accuracy per owner for similar ticket types", 7438),
          ]}),
          new TableRow({ children: [
            dataCell("Example Input", 2200, LIGHT_GREY),
            dataCell("New ticket: \u201cWooCommerce Integration\u201d. Estimate: 8h. Due: 18 Apr. Unassigned.", 7438, LIGHT_GREY),
          ]}),
          new TableRow({ children: [
            dataCell("Example Output", 2200),
            dataCell("\"Best fit: Jordan (available 14\u201316 Apr, 65% utilisation). Second option: Sam (available from 15 Apr, 80% utilisation). Jordan has completed 3 similar WooCommerce tickets with an average 0.9x time accuracy ratio.\"", 7438),
          ]}),
          new TableRow({ children: [
            dataCell("UI Placement", 2200, LIGHT_GREY),
            dataCell("Appears in the Unscheduled Ticket drawer as an \u201cAI Suggest\u201d button. Clicking it auto-places the block and highlights it for confirmation.", 7438, LIGHT_GREY),
          ]}),
        ],
      }),
      gap(200),

      h2("5.4 Team Member Recommendation"),
      gap(80),
      new Table({
        width: { size: CONTENT_W, type: WidthType.DXA },
        columnWidths: [2200, 7438],
        rows: [
          new TableRow({ children: [
            headerCell("Attribute", 2200), headerCell("Detail", 7438),
          ]}),
          new TableRow({ children: [
            dataCell("Trigger", 2200, LIGHT_GREY), dataCell("Planner opens reassign dropdown for a ticket", 7438, LIGHT_GREY),
          ]}),
          new TableRow({ children: [
            dataCell("Data Used", 2200), dataCell("Each member\u2019s available hours in the ticket\u2019s date range, their time accuracy ratio from Everhour (actual/planned), and current utilisation level", 7438),
          ]}),
          new TableRow({ children: [
            dataCell("Scoring Formula", 2200, LIGHT_GREY),
            dataCell("score = (available_capacity_ratio * 0.5) + (accuracy_ratio * 0.3) + (utilisation_headroom * 0.2)", 7438, LIGHT_GREY),
          ]}),
          new TableRow({ children: [
            dataCell("UI Placement", 2200),
            dataCell("Reassign dropdown sorts team members by score, showing capacity and accuracy next to each name. No separate AI panel required.", 7438),
          ]}),
        ],
      }),
      new Paragraph({ children: [new PageBreak()] }),

      // ══════ SECTION 6 ══════════════════════════════════════════════════════
      sectionBadge("06", "Technical Architecture"),
      h1("6. Technical Architecture"),

      h2("6.1 System Overview"),
      gap(80),
      codeBlock([
        "  \u250c\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510    Webhooks + REST     \u250c\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510",
        "  \u2502  HubSpot   \u2502 \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u25ba \u2502  Planner API  \u2502",
        "  \u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518                  \u2502  (Node.js /   \u2502",
        "                                   \u2502  Express)     \u2502",
        "  \u250c\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510    REST (polling)   \u2502              \u2502",
        "  \u2502 Everhour  \u2502 \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u25ba \u2502              \u2502",
        "  \u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518                  \u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u252c\u2500\u2500\u2500\u2500\u2500\u2500\u2518",
        "                                            \u2502",
        "                              \u250c\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2534\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510",
        "                              \u2502  PostgreSQL DB  \u2502",
        "                              \u2502  (allocations, \u2502",
        "                              \u2502  actuals,       \u2502",
        "                              \u2502  overrides)     \u2502",
        "                              \u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u252c\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518",
        "                                            \u2502",
        "                              \u250c\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2534\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510",
        "                              \u2502  React Frontend \u2502",
        "                              \u2502  (Vite + TanStack\u2502",
        "                              \u2502  Query + Zustand)\u2502",
        "                              \u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518",
      ]),
      gap(200),

      h2("6.2 HubSpot Integration"),
      h3("Initial Sync"),
      p("On first setup, a full sync pulls all Tickets from HubSpot using the Tickets API with property filters for the required fields. Pagination handles large volumes (1000 tickets per page)."),
      gap(80),
      codeBlock([
        "POST https://api.hubapi.com/crm/v3/objects/tickets/search",
        "{",
        "  \"filterGroups\": [{\"filters\": [{",
        "    \"propertyName\": \"time_estimate\",",
        "    \"operator\": \"HAS_PROPERTY\"",
        "  }]}],",
        "  \"properties\": [\"subject\",\"hubspot_owner_id\",\"time_estimate\",",
        "                  \"start_date\",\"due_date\",\"hs_pipeline_stage\"],",
        "  \"limit\": 100,",
        "  \"after\": \"{{cursor}}\"",
        "}",
      ]),
      gap(120),
      h3("Ongoing Sync via Webhooks"),
      p("HubSpot webhooks fire on ticket create, update, and delete events. The backend processes these in a queue (Redis-backed) to avoid race conditions. Webhook events for ticket property changes trigger a re-sync of that ticket\u2019s allocation."),
      gap(200),

      h2("6.3 Everhour Integration"),
      p("The planner syncs Everhour time entries on a 15-minute polling schedule using a background job. Entries are matched to HubSpot Tickets by task external ID (set when the task is created in Everhour via the API) or by name matching as a fallback."),
      gap(80),
      codeBlock([
        "// Task creation in Everhour (called when HubSpot ticket is first synced)",
        "POST https://api.everhour.com/projects/{project_id}/tasks",
        "{",
        "  \"name\": \"[HS-{ticket_id}] {ticket_subject}\",",
        "  \"attributes\": {",
        "    \"estimate\": {ticket_estimate_seconds}",
        "  }",
        "}",
        "",
        "// Time entry retrieval",
        "GET https://api.everhour.com/team/time?limit=200&from={from}&to={to}",
      ]),
      gap(200),

      h2("6.4 Backend Services"),
      gap(80),
      new Table({
        width: { size: CONTENT_W, type: WidthType.DXA },
        columnWidths: [2600, 7038],
        rows: [
          new TableRow({ tableHeader: true, children: [
            headerCell("Service", 2600), headerCell("Responsibility", 7038),
          ]}),
          new TableRow({ children: [
            dataCell("ticket-sync", 2600, LIGHT_GREY), dataCell("Polls HubSpot, processes webhooks, writes to tickets table", 7038, LIGHT_GREY),
          ]}),
          new TableRow({ children: [
            dataCell("allocation-engine", 2600), dataCell("Distributes estimate hours across working days, stores daily_allocations", 7038),
          ]}),
          new TableRow({ children: [
            dataCell("everhour-sync", 2600, LIGHT_GREY), dataCell("Polls Everhour every 15 min, writes to time_entries table", 7038, LIGHT_GREY),
          ]}),
          new TableRow({ children: [
            dataCell("capacity-calculator", 2600), dataCell("Runs utilisation calculations per user per day on demand and on data change", 7038),
          ]}),
          new TableRow({ children: [
            dataCell("ai-engine", 2600, LIGHT_GREY), dataCell("Runs scoring and heuristics for suggestions; calls Claude API for natural language outputs", 7038, LIGHT_GREY),
          ]}),
          new TableRow({ children: [
            dataCell("api-gateway", 2600), dataCell("Express REST API consumed by the React frontend. JWT auth via HubSpot OAuth.", 7038),
          ]}),
        ],
      }),
      gap(200),

      h2("6.5 Database Schema (Core Tables)"),
      gap(80),
      codeBlock([
        "-- tickets: mirrors HubSpot ticket data",
        "CREATE TABLE tickets (",
        "  id              TEXT PRIMARY KEY,   -- HubSpot ticket ID",
        "  title           TEXT NOT NULL,",
        "  owner_id        TEXT NOT NULL,",
        "  estimate_hours  FLOAT,",
        "  start_date      DATE,",
        "  due_date        DATE,",
        "  pipeline_stage  TEXT,",
        "  allocation_type TEXT CHECK (allocation_type IN ('SOFT','HARD')),",
        "  synced_at       TIMESTAMPTZ,",
        "  updated_at      TIMESTAMPTZ",
        ");",
        "",
        "-- daily_allocations: distributed hours per ticket per day",
        "CREATE TABLE daily_allocations (",
        "  id              SERIAL PRIMARY KEY,",
        "  ticket_id       TEXT REFERENCES tickets(id),",
        "  user_id         TEXT NOT NULL,",
        "  date            DATE NOT NULL,",
        "  planned_hours   FLOAT NOT NULL,",
        "  is_override     BOOLEAN DEFAULT FALSE,",
        "  UNIQUE(ticket_id, user_id, date)",
        ");",
        "",
        "-- time_entries: Everhour actuals",
        "CREATE TABLE time_entries (",
        "  id              TEXT PRIMARY KEY,   -- Everhour entry ID",
        "  ticket_id       TEXT REFERENCES tickets(id),",
        "  user_id         TEXT NOT NULL,",
        "  date            DATE NOT NULL,",
        "  actual_hours    FLOAT NOT NULL",
        ");",
        "",
        "-- user_capacity: team member settings",
        "CREATE TABLE user_capacity (",
        "  user_id         TEXT PRIMARY KEY,",
        "  name            TEXT,",
        "  weekly_hours    FLOAT DEFAULT 40,",
        "  working_days    TEXT[] DEFAULT ARRAY['Mon','Tue','Wed','Thu','Fri']",
        ");",
      ]),
      gap(200),

      h2("6.6 Frontend Stack"),
      gap(80),
      new Table({
        width: { size: CONTENT_W, type: WidthType.DXA },
        columnWidths: [2800, 3200, 3638],
        rows: [
          new TableRow({ tableHeader: true, children: [
            headerCell("Layer", 2800), headerCell("Technology", 3200), headerCell("Rationale", 3638),
          ]}),
          new TableRow({ children: [
            dataCell("Framework", 2800, LIGHT_GREY), dataCell("React + Vite", 3200, LIGHT_GREY), dataCell("Fast dev, excellent ecosystem", 3638, LIGHT_GREY),
          ]}),
          new TableRow({ children: [
            dataCell("State Management", 2800), dataCell("Zustand", 3200), dataCell("Lightweight, no boilerplate", 3638),
          ]}),
          new TableRow({ children: [
            dataCell("Server State", 2800, LIGHT_GREY), dataCell("TanStack Query", 3200, LIGHT_GREY), dataCell("Caching, polling, optimistic updates", 3638, LIGHT_GREY),
          ]}),
          new TableRow({ children: [
            dataCell("Calendar / DnD", 2800), dataCell("dnd-kit + custom canvas", 3200), dataCell("Flexible, accessible drag-and-drop", 3638),
          ]}),
          new TableRow({ children: [
            dataCell("Styling", 2800, LIGHT_GREY), dataCell("Tailwind CSS", 3200, LIGHT_GREY), dataCell("Utility-first, consistent design", 3638, LIGHT_GREY),
          ]}),
          new TableRow({ children: [
            dataCell("Charts", 2800), dataCell("Recharts", 3200), dataCell("Utilisation charts and variance bars", 3638),
          ]}),
          new TableRow({ children: [
            dataCell("Auth", 2800, LIGHT_GREY), dataCell("HubSpot OAuth 2.0", 3200, LIGHT_GREY), dataCell("Single sign-on for HubSpot users", 3638, LIGHT_GREY),
          ]}),
        ],
      }),
      new Paragraph({ children: [new PageBreak()] }),

      // ══════ SECTION 7 ══════════════════════════════════════════════════════
      sectionBadge("07", "MVP Plan — 2 to 4 Weeks"),
      h1("7. MVP Plan (2\u20134 Weeks)"),

      h2("7.1 MVP Scope Decision Matrix"),
      gap(80),
      new Table({
        width: { size: CONTENT_W, type: WidthType.DXA },
        columnWidths: [4000, 1619, 1619, 2400],
        rows: [
          new TableRow({ tableHeader: true, children: [
            headerCell("Feature", 4000), headerCell("MVP?", 1619),
            headerCell("Phase 2?", 1619), headerCell("Notes", 2400),
          ]}),
          new TableRow({ children: [
            dataCell("HubSpot ticket sync (read)", 4000),
            dataCell("\u2705 Yes", 1619, "DCFCE7", ACCENT_GREEN, true),
            dataCell("\u2014", 1619), dataCell("Core dependency", 2400),
          ]}),
          new TableRow({ children: [
            dataCell("Auto hour distribution", 4000, LIGHT_GREY),
            dataCell("\u2705 Yes", 1619, "DCFCE7", ACCENT_GREEN, true),
            dataCell("\u2014", 1619, LIGHT_GREY), dataCell("Core planning logic", 2400, LIGHT_GREY),
          ]}),
          new TableRow({ children: [
            dataCell("People view calendar", 4000),
            dataCell("\u2705 Yes", 1619, "DCFCE7", ACCENT_GREEN, true),
            dataCell("\u2014", 1619), dataCell("Primary UI", 2400),
          ]}),
          new TableRow({ children: [
            dataCell("Utilisation calculation + colour coding", 4000, LIGHT_GREY),
            dataCell("\u2705 Yes", 1619, "DCFCE7", ACCENT_GREEN, true),
            dataCell("\u2014", 1619, LIGHT_GREY), dataCell("Core value prop", 2400, LIGHT_GREY),
          ]}),
          new TableRow({ children: [
            dataCell("Ticket detail panel (planned hours only)", 4000),
            dataCell("\u2705 Yes", 1619, "DCFCE7", ACCENT_GREEN, true),
            dataCell("\u2014", 1619), dataCell("Simplified, no actuals in MVP", 2400),
          ]}),
          new TableRow({ children: [
            dataCell("Everhour actual hours sync", 4000, LIGHT_GREY),
            dataCell("\u26a0\ufe0f Partial", 1619, "FEF9C3", ACCENT_AMBER, true),
            dataCell("Full in P2", 1619, LIGHT_GREY), dataCell("Display actuals only, no forecasting", 2400, LIGHT_GREY),
          ]}),
          new TableRow({ children: [
            dataCell("Drag-and-drop move & resize", 4000),
            dataCell("\u26a0\ufe0f Partial", 1619, "FEF9C3", ACCENT_AMBER, true),
            dataCell("Resize in P2", 1619), dataCell("Move only in MVP", 2400),
          ]}),
          new TableRow({ children: [
            dataCell("Soft vs hard allocations", 4000, LIGHT_GREY),
            dataCell("\u26a0\ufe0f Partial", 1619, "FEF9C3", ACCENT_AMBER, true),
            dataCell("Full config in P2", 1619, LIGHT_GREY), dataCell("Hard-code stage mapping initially", 2400, LIGHT_GREY),
          ]}),
          new TableRow({ children: [
            dataCell("Timeline / project view", 4000),
            dataCell("\u274c No", 1619, "FEE2E2", ACCENT_RED, true),
            dataCell("\u2705 Phase 2", 1619), dataCell("Deprioritised", 2400),
          ]}),
          new TableRow({ children: [
            dataCell("AI reallocation suggestions", 4000, LIGHT_GREY),
            dataCell("\u274c No", 1619, "FEE2E2", ACCENT_RED, true),
            dataCell("\u2705 Phase 2", 1619, LIGHT_GREY), dataCell("Needs accuracy data first", 2400, LIGHT_GREY),
          ]}),
          new TableRow({ children: [
            dataCell("Delivery delay prediction", 4000),
            dataCell("\u274c No", 1619, "FEE2E2", ACCENT_RED, true),
            dataCell("\u2705 Phase 2", 1619), dataCell("Requires Everhour history", 2400),
          ]}),
          new TableRow({ children: [
            dataCell("Leave management", 4000, LIGHT_GREY),
            dataCell("\u274c No", 1619, "FEE2E2", ACCENT_RED, true),
            dataCell("\u2705 Phase 2", 1619, LIGHT_GREY), dataCell("Manual for now", 2400, LIGHT_GREY),
          ]}),
        ],
      }),
      gap(200),

      h2("7.2 Week-by-Week Build Plan"),
      gap(80),

      h3("Week 1 \u2014 Foundation & Data Layer"),
      bullet([bold("Day 1\u20132: "), run("Set up Node.js + Express API, PostgreSQL schema, Redis queue")]),
      bullet([bold("Day 3: "), run("HubSpot OAuth flow + initial ticket sync (batch pull, store in DB)")]),
      bullet([bold("Day 4: "), run("Allocation engine: distribute hours, store daily_allocations")]),
      bullet([bold("Day 5: "), run("User capacity table + utilisation calculator service")]),
      gap(120),

      h3("Week 2 \u2014 React Frontend Core"),
      bullet([bold("Day 1\u20132: "), run("Scaffold React app, Tailwind, TanStack Query. Build sidebar + date header + empty calendar grid")]),
      bullet([bold("Day 3: "), run("Render allocation blocks on grid. Colour coding by utilisation band")]),
      bullet([bold("Day 4: "), run("Person-row utilisation bar. Overbooking highlight")]),
      bullet([bold("Day 5: "), run("Ticket detail panel (planned hours, HubSpot link, basic info)")]),
      gap(120),

      h3("Week 3 \u2014 Interactions & Everhour"),
      bullet([bold("Day 1\u20132: "), run("Drag-and-drop move (dnd-kit). Optimistic update + server persist")]),
      bullet([bold("Day 3: "), run("Everhour polling job. Map entries to tickets. Store time_entries")]),
      bullet([bold("Day 4: "), run("Add actual hours to ticket detail panel. Basic planned vs actual display")]),
      bullet([bold("Day 5: "), run("HubSpot webhooks for live ticket updates. Unscheduled queue drawer")]),
      gap(120),

      h3("Week 4 \u2014 Polish, Testing & Handover"),
      bullet([bold("Day 1: "), run("Week view. Manual allocation creation (non-HubSpot blocks)")]),
      bullet([bold("Day 2: "), run("Soft vs hard allocation visual differentiation. Pipeline stage config")]),
      bullet([bold("Day 3: "), run("End-to-end testing across happy paths. Bug fixes")]),
      bullet([bold("Day 4: "), run("Deploy to staging (Vercel frontend + Railway backend). Internal QA session")]),
      bullet([bold("Day 5: "), run("Documentation, user onboarding guide, handover to Wordie team")]),
      gap(200),

      h2("7.3 Phase 2 Priorities (Post-MVP)"),
      numbered("Timeline / project view"),
      numbered("Drag-to-resize blocks with proportional hour recalculation"),
      numbered("AI overcapacity detection and reallocation suggestions"),
      numbered("Delivery delay prediction with risk badges"),
      numbered("Leave and public holiday management"),
      numbered("Forecast variance charting (weekly/monthly rollup)"),
      numbered("Reporting: export utilisation CSV, PDF capacity report"),
      numbered("Multi-pipeline / multi-team support"),
      gap(200),

      h2("7.4 Technology Hosting Recommendations"),
      gap(80),
      new Table({
        width: { size: CONTENT_W, type: WidthType.DXA },
        columnWidths: [2800, 3000, 3838],
        rows: [
          new TableRow({ tableHeader: true, children: [
            headerCell("Component", 2800), headerCell("Recommended Host", 3000), headerCell("Cost Estimate", 3838),
          ]}),
          new TableRow({ children: [
            dataCell("React Frontend", 2800, LIGHT_GREY), dataCell("Vercel", 3000, LIGHT_GREY), dataCell("Free tier sufficient for MVP", 3838, LIGHT_GREY),
          ]}),
          new TableRow({ children: [
            dataCell("Node.js API", 2800), dataCell("Railway.app", 3000), dataCell("~$5\u2013$20/mo", 3838),
          ]}),
          new TableRow({ children: [
            dataCell("PostgreSQL", 2800, LIGHT_GREY), dataCell("Railway (managed)", 3000, LIGHT_GREY), dataCell("Included in Railway plan", 3838, LIGHT_GREY),
          ]}),
          new TableRow({ children: [
            dataCell("Redis (queue)", 2800), dataCell("Upstash (serverless)", 3000), dataCell("Free tier for MVP", 3838),
          ]}),
          new TableRow({ children: [
            dataCell("AI features (Phase 2)", 2800, LIGHT_GREY), dataCell("Claude API (Anthropic)", 3000, LIGHT_GREY), dataCell("Pay-per-use, ~$10\u201350/mo", 3838, LIGHT_GREY),
          ]}),
        ],
      }),
      gap(200),

      divider(),
      new Paragraph({
        children: [
          bold("Document Version: ", { size: 18, color: MID_GREY }),
          run("1.0", { size: 18, color: MID_GREY }),
          run("   |   ", { size: 18, color: MID_GREY }),
          bold("Prepared by: ", { size: 18, color: MID_GREY }),
          run("Stewart Lemalu, Wordie", { size: 18, color: MID_GREY }),
          run("   |   ", { size: 18, color: MID_GREY }),
          bold("Date: ", { size: 18, color: MID_GREY }),
          run("April 2026", { size: 18, color: MID_GREY }),
        ],
        spacing: { before: 120, after: 80 },
      }),
    ],
  }],
});

// ─── Output ───────────────────────────────────────────────────────────────────
Packer.toBuffer(doc).then(buffer => {
  fs.writeFileSync('/Users/stewartlemalu/Documents/GitHub/.claude/worktrees/agitated-bohr/Wordie-Resource-Planner-PRD.docx', buffer);
  console.log('Document written successfully.');
}).catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
