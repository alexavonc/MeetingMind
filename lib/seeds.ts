import type { Meeting } from "@/types";

export const SEED_MEETINGS: Meeting[] = [
  {
    id: "seed-001",
    title: "GovTech Digital Identity Kickoff",
    folder: "govtech",
    date: "20 Mar 2026",
    duration: "47 min",
    languages: ["en", "zh"],
    speakers: { A: "Priya Nair", B: "Marcus Tan", C: "Wei Ling" },
    transcript: [
      {
        s: "A",
        t: "0:00",
        text: "Good morning everyone, let's get started. Today we're kicking off the Digital Identity project.",
      },
      {
        s: "B",
        t: "0:42",
        text: "Thanks Priya. I've reviewed the brief — the main concern is [zh|the timeline is too tight|时间太紧了][/zh] for the authentication layer.",
      },
      {
        s: "C",
        t: "1:15",
        text: "我同意. The Singpass integration alone will take at least three sprints.",
      },
      {
        s: "A",
        t: "1:38",
        text: "Okay, let's [zh|break it down step by step|一步一步来][/zh] and map dependencies first.",
      },
      {
        s: "B",
        t: "2:10",
        text: "We should also loop in the security team early. Last time [zh|we suffered because of that|我们因为这个吃了苦头][/zh].",
      },
      {
        s: "C",
        t: "2:44",
        text: "Agreed. I'll set up a workshop with them next week.",
      },
      {
        s: "A",
        t: "3:01",
        text: "Perfect. Marcus, can you own the technical architecture document by Friday?",
      },
      {
        s: "B",
        t: "3:12",
        text: "Yes, I'll have a draft ready by Thursday so we have buffer.",
      },
    ],
    summary:
      "Kickoff meeting for the GovTech Digital Identity project. Team aligned on key concerns: the authentication layer timeline is tight, and Singpass integration will require at least three sprints. Security team needs to be involved early to avoid issues from previous projects.",
    actions: [
      { text: "Draft technical architecture document", owner: "Marcus Tan", done: false },
      { text: "Schedule security team workshop", owner: "Wei Ling", done: false },
      { text: "Map sprint dependencies for Singpass integration", owner: "Priya Nair", done: false },
    ],
    flow: `flowchart TD
  A[🚀 Project Kickoff] --> B[📋 Review Brief]
  B --> C{Timeline feasible?}
  C -->|Too tight| D[🔐 Auth Layer Concern]
  C -->|Manageable| E[✅ Proceed]
  D --> F[🔗 Singpass Integration\n3+ sprints]
  F --> G[🛡️ Loop in Security Team]
  G --> H[📅 Workshop Next Week]
  E --> I[📝 Tech Architecture Doc\nby Thursday]
  H --> I
  I --> J[🏁 Next Steps]`,
  },
  {
    id: "seed-002",
    title: "flow-three Q2 Brand Strategy",
    folder: "flow-three",
    date: "18 Mar 2026",
    duration: "32 min",
    languages: ["en", "sg"],
    speakers: { A: "Alexa", B: "Jordan Lee" },
    transcript: [
      {
        s: "A",
        t: "0:00",
        text: "Okay Jordan, [sg]confirm[/sg] we're aligned on the Q2 direction before I present to the client.",
      },
      {
        s: "B",
        t: "0:18",
        text: "The moodboard [sg]shiok[/sg] already, just the typography system needs one more pass.",
      },
      {
        s: "A",
        t: "0:35",
        text: "I was thinking Bricolage Grotesque for headings, keep it editorial. [sg]Can or not?[/sg]",
      },
      {
        s: "B",
        t: "0:52",
        text: "[sg]Can lah[/sg]. But we need to check licensing for the client's use case — they might print.",
      },
      {
        s: "A",
        t: "1:10",
        text: "Good catch. I'll sort that out. What about the colour palette — [sg]still the same one or[/sg] we're changing?",
      },
      {
        s: "B",
        t: "1:28",
        text: "Let's go with the revised one. The warm neutrals tested better with their audience.",
      },
      {
        s: "A",
        t: "1:45",
        text: "Alright, I'll update the brand guidelines doc and send for review by Wednesday.",
      },
    ],
    summary:
      "Quick alignment call for flow-three's Q2 brand strategy deliverable. Moodboard is strong; typography system needs one final pass. Font licensing needs to be verified for print use. Colour palette revised to warm neutrals based on audience testing.",
    actions: [
      { text: "Check Bricolage Grotesque licensing for print", owner: "Alexa", done: false },
      { text: "Final pass on typography system", owner: "Jordan Lee", done: false },
      { text: "Update brand guidelines doc and send for review", owner: "Alexa", done: false },
    ],
    flow: `flowchart TD
  A[🎨 Q2 Brand Strategy Review] --> B{Moodboard ready?}
  B -->|Yes ✅| C[📝 Typography System]
  C --> D{Font choice?}
  D --> E[Bricolage Grotesque\nfor headings]
  E --> F[⚠️ Check Print Licensing]
  F --> G[🎨 Colour Palette]
  G --> H[Warm Neutrals\nbetter audience testing]
  H --> I[📄 Update Brand Guidelines]
  I --> J[📤 Send for Review\nby Wednesday]`,
  },
  {
    id: "seed-003",
    title: "Weekly Personal Review",
    folder: "personal",
    date: "15 Mar 2026",
    duration: "18 min",
    languages: ["en", "sg"],
    speakers: { A: "Alexa" },
    transcript: [
      {
        s: "A",
        t: "0:00",
        text: "Okay, weekly review voice note. This week was [sg]quite hectic lah[/sg].",
      },
      {
        s: "A",
        t: "0:15",
        text: "GovTech deliverables are on track. flow-three client presentation pushed to next Friday.",
      },
      {
        s: "A",
        t: "0:38",
        text: "Need to sort out the Railway deployment for MeetingMind — [sg]been pushing it off too long already[/sg].",
      },
      {
        s: "A",
        t: "1:02",
        text: "Also need to email the accountant about Q1 invoices. [sg]Cannot forget one[/sg].",
      },
      {
        s: "A",
        t: "1:22",
        text: "Next week priorities: one, deploy MeetingMind. Two, prep the brand presentation. Three, sort finances.",
      },
    ],
    summary:
      "Personal weekly review. GovTech on track, flow-three client presentation deferred by one week. Key outstanding items: MeetingMind Railway deployment, Q1 invoice follow-up with accountant. Three clear priorities set for next week.",
    actions: [
      { text: "Deploy MeetingMind to Railway", owner: "Alexa", done: false },
      { text: "Prep brand presentation for flow-three client", owner: "Alexa", done: false },
      { text: "Email accountant re Q1 invoices", owner: "Alexa", done: false },
    ],
    flow: `flowchart TD
  A[📋 Weekly Review] --> B[✅ GovTech on track]
  A --> C[📅 flow-three presentation\npushed 1 week]
  A --> D{Outstanding items}
  D --> E[🚀 Deploy MeetingMind\nto Railway]
  D --> F[💰 Q1 Invoices\nemail accountant]
  A --> G[Next Week Priorities]
  G --> G1[1️⃣ Deploy MeetingMind]
  G --> G2[2️⃣ Brand Presentation]
  G --> G3[3️⃣ Sort Finances]`,
  },
];
