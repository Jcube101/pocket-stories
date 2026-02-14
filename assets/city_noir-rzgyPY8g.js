const e=`variables:\r
  inventory:\r
    badge: false\r
    evidence: false\r
  relationships:\r
    Informant: 0\r
  flags:\r
    bribed_guard: false\r
\r
passages:\r
  start:\r
    text: |\r
      Rain hammers the neon streets. You stand outside the Velvet Club.\r
    choices:\r
      - text: "Flash your badge"\r
        target: bouncer\r
        effect: "inventory.badge = true"\r
      - text: "Take alley shortcut"\r
        target: alley\r
\r
  bouncer:\r
    text: |\r
      The bouncer squints at you.\r
    choices:\r
      - text: "Demand entry"\r
        target: club_floor\r
        condition: "inventory.badge == true"\r
      - text: "Slip him cash"\r
        target: club_floor\r
        effect: "flags.bribed_guard = true"\r
\r
  alley:\r
    text: |\r
      Your informant waits in the shadows with a sealed envelope.\r
    choices:\r
      - text: "Take envelope"\r
        target: club_floor\r
        effect: "inventory.evidence = true"\r
      - text: "Ask for details"\r
        target: alley_talk\r
        effect: "relationships.Informant += 2"\r
\r
  alley_talk:\r
    text: |\r
      "Top floor office," the informant whispers. "Don't trust the bartender."\r
    choices:\r
      - text: "Enter through back door"\r
        target: club_floor\r
\r
  club_floor:\r
    text: |\r
      Music pounds. Your suspect vanishes upstairs.\r
    choices:\r
      - text: "Confront suspect now"\r
        target: bad_end\r
      - text: "Search office first"\r
        target: office\r
\r
  office:\r
    text: |\r
      You find ledgers tied to the city council.\r
    choices:\r
      - text: "Expose the conspiracy"\r
        target: good_end\r
        condition: "inventory.evidence == true"\r
      - text: "Walk away"\r
        target: neutral_end\r
\r
  good_end:\r
    text: |\r
      Your report breaks the case open. The city finally listens.\r
    choices: []\r
\r
  neutral_end:\r
    text: |\r
      You keep your job, but the truth stays buried.\r
    choices: []\r
\r
  bad_end:\r
    text: |\r
      The suspect was ready. You never make it out of the club.\r
    choices: []\r
`;export{e as default};
