/* Yay Medical English — every interface text (American English). The card question side stays in Arabic. */
(function (root) {
  "use strict";

  const STRINGS = {
    appName: "Yay Medical English",
    tagline: "Medical and everyday American English, B2–C1",

    domains: { medicine: "Medicine", general: "Everyday English" },

    themes: {
      anatomy: { name: "Anatomy and physiology", skill: "Follow an anatomy lecture" },
      symptoms: { name: "Symptoms and clinical signs", skill: "Describe symptoms precisely" },
      history: { name: "Patient history taking", skill: "Take a patient history" },
      exam: { name: "Physical examination", skill: "Report a physical exam" },
      diseases: { name: "Diseases and pathologies", skill: "Present a case on rounds" },
      pharmacology: { name: "Pharmacology and prescriptions", skill: "Write and explain a prescription" },
      tests: { name: "Tests and imaging", skill: "Order and interpret tests" },
      emergency: { name: "Emergency and intensive care", skill: "Work a shift in the ER" },
      surgery: { name: "Surgery and operating room", skill: "Scrub in for an operation" },
      communication: { name: "Communication, ethics and medical records", skill: "Explain a diagnosis to a patient" },
      work: { name: "Work and colleagues", skill: "Apply for residency and work with your team" },
      housing: { name: "Housing and paperwork", skill: "Rent an apartment and handle paperwork" },
      daily: { name: "Daily life", skill: "Handle daily life in the US" },
      transport: { name: "Transportation", skill: "Get around town and travel" },
      feelings: { name: "Feelings and opinions", skill: "Share feelings and opinions" },
      time: { name: "Time and quantities", skill: "Talk about time, numbers and units" },
      connectors: { name: "Connectors and expressions", skill: "Structure what you say and write" }
    },

    natures: { noun: "noun", verb: "verb", adjective: "adjective", adverb: "adverb", expression: "expression" },

    ranks: ["Medical student", "Clerk", "Intern", "Resident", "Fellow", "Attending physician", "Department chair"],

    grades: ["Again", "Hard", "Good", "Easy"],

    home: {
      start: "Start session",
      continue: "Keep going",
      allDone: "All caught up for today",
      allDoneSub: "Come back tomorrow for your reviews, or learn a few extra words.",
      extra: "Learn 10 extra words",
      sprint: "Sprint",
      sprintSub: "60 seconds, multiple choice",
      collection: "Collection",
      settings: "Settings",
      due: n => `${n} to review`,
      fresh: n => `${n} new`,
      learning: n => `${n} in progress`,
      goal: "Today's goal",
      goalOf: (a, b) => `${a} / ${b} cards`,
      goalDone: "Goal reached",
      streak: n => (n === 1 ? "1-day streak" : `${n}-day streak`),
      streakZero: "Start a streak today",
      streakNote: "One missed day per week is forgiven.",
      anchored: "Anchored words",
      anchoredHelp: "A word is anchored when its review interval reaches 21 days.",
      nextRank: (n, r) => `${n} more anchored ${n === 1 ? "word" : "words"} to become ${r}`,
      topRank: "You have reached the highest rank.",
      situations: "Work situations",
      ready: "Ready",
      calendar: "Last 30 days"
    },

    card: {
      tapToFlip: "Tap to flip",
      tapToFlipKey: "Tap or press Space",
      plural: "plural:",
      examples: "Examples",
      typeHere: "Type the English word",
      check: "Check",
      dontKnow: "I don't know",
      continue: "Continue",
      correct: "Correct",
      almost: "Almost — one letter off",
      wrong: "Not quite",
      articleNeeded: "Include the article (a / an).",
      exactForm: "Exact form:",
      yourAnswer: "Your answer:",
      hint: "Hint:",
      chooseAnswer: "Choose the English word",
      leech: "Problem card",
      new: "New word"
    },

    session: {
      quit: "End session",
      left: n => `${n} left`,
      combo: "combo",
      empty: "Nothing to study with the current settings.",
      emptySub: "Check active themes and levels in Settings.",
      back: "Back"
    },

    summary: {
      title: "Session complete",
      seen: "Cards studied",
      success: "Success rate",
      anchored: "Anchored words",
      anchoredGained: n => (n > 0 ? `+${n} this session` : "keep reviewing to anchor more"),
      combo: "Longest combo",
      newWords: "New words learned",
      situations: "Work situations",
      toNext: (n, r) => `${n} anchored ${n === 1 ? "word" : "words"} to ${r}`,
      top: "Top rank reached",
      home: "Home",
      again: "Another session"
    },

    promotion: { title: "Promotion", sub: r => `You are now ${r}` },

    sprint: {
      title: "Sprint",
      intro: "Answer as many as you can in 60 seconds. Sprint never changes your review schedule or your rank.",
      start: "Start",
      time: "Time",
      score: "Correct",
      accuracy: "Accuracy",
      record: "Record",
      newRecord: "New record",
      done: "Time's up",
      again: "Play again",
      home: "Home",
      notEnough: "Study a few words first to unlock Sprint."
    },

    collection: {
      title: "Collection",
      words: n => `${n} words`,
      anchoredPct: p => `${p}% anchored`,
      legend: ["New", "Learning", "Young", "Maturing", "Anchored"],
      show: "Show words",
      hide: "Hide words",
      ready: "Ready",
      tapTile: "Tap a tile to see the word."
    },

    settings: {
      title: "Settings",
      appearance: "Appearance",
      appearanceOptions: { system: "System", dark: "Dark", light: "Light" },
      mode: "Answer mode",
      modeOptions: { flip: "Flip card", quiz: "Multiple choice and typing" },
      shuffle: "Shuffle new cards",
      shuffleHelp: "Off: themes alternate in packs of 5, easiest level first.",
      themes: "Active themes",
      levels: "Active levels",
      dailyGoal: "Daily goal (cards)",
      sessionLength: "Session length (cards)",
      newPerDay: "New cards per day",
      reviewsPerDay: "Reviews per day",
      requireArticle: "Require a / an when typing",
      sound: "Sound",
      reduceMotion: "Reduce motion",
      reduceOptions: { system: "System", on: "On", off: "Off" },
      problems: "Problem cards",
      problemsHelp: "Cards failed 8 times or more. Reset one to learn it again from scratch, or suspend it.",
      noProblems: "No problem cards. Nice work.",
      resetCard: "Reset",
      suspend: "Suspend",
      unsuspend: "Unsuspend",
      data: "Your progress",
      exportBtn: "Export progress (JSON)",
      importBtn: "Import progress",
      imported: "Progress imported.",
      importError: "This file could not be read.",
      reset: "Reset all progress",
      resetConfirm: "Tap again to erase everything",
      resetDone: "Progress erased.",
      about: "About",
      aboutText: n => `${n} words and expressions · works offline · progress stays on this device.`,
      selectAll: "All",
      selectNone: "None",
      done: "Done"
    },

    update: { available: "A new version is available.", reload: "Update" },
    offline: "Ready to work offline"
  };

  root.STRINGS = STRINGS;
})(typeof self !== "undefined" ? self : this);
