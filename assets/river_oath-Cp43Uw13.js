const r=`variables:\r
  inventory:\r
    silver_ring: false\r
    lantern: false\r
    ferry_token: false\r
  relationships:\r
    Mira: 0\r
    Ferryman: 0\r
  flags:\r
    crossed_river: false\r
\r
passages:\r
  start:\r
    text: |\r
      At dusk you reach the Blackwater ferry. Across the river waits the Archive of Oaths.\r
    choices:\r
      - text: "Greet Mira, the apprentice scribe"\r
        target: mira\r
      - text: "Speak to the ferryman"\r
        target: ferryman\r
      - text: "Search the dock crates"\r
        target: crates\r
\r
  crates:\r
    text: |\r
      You find an old lantern and a rusted token stamped with a river crest.\r
    choices:\r
      - text: "Take both"\r
        target: ferryman\r
        effect: "inventory.lantern = true"\r
      - text: "Take only token"\r
        target: ferryman\r
        effect: "inventory.ferry_token = true"\r
\r
  mira:\r
    text: |\r
      Mira whispers, "The ferryman trusts people who keep promises."\r
    choices:\r
      - text: "Promise you'll return her lost ring"\r
        target: ferryman\r
        effect: "relationships.Mira += 2"\r
      - text: "Ignore her warning"\r
        target: ferryman\r
        effect: "relationships.Mira -= 1"\r
\r
  ferryman:\r
    text: |\r
      The ferryman narrows his eyes. "Crossing costs one token, or one true favor."\r
    choices:\r
      - text: "Pay with token"\r
        target: crossing\r
        condition: "inventory.ferry_token == true"\r
        effect: "relationships.Ferryman += 1"\r
      - text: "Offer to recover Mira's ring from the reeds"\r
        target: reeds\r
      - text: "Threaten him"\r
        target: bad_end\r
        effect: "relationships.Ferryman -= 2"\r
\r
  reeds:\r
    text: |\r
      In the cold reeds you spot a silver ring glinting in mud.\r
    choices:\r
      - text: "Take ring and return"\r
        target: crossing\r
        effect: "inventory.silver_ring = true"\r
      - text: "Leave it and return empty-handed"\r
        target: ferryman\r
\r
  crossing:\r
    text: |\r
      Mid-river, fog swallows the boat. A shadow asks for proof of your intent.\r
    choices:\r
      - text: "Show Mira's ring"\r
        target: good_end\r
        condition: "inventory.silver_ring == true"\r
      - text: "Raise lantern and speak honestly"\r
        target: good_end\r
        condition: "inventory.lantern == true && relationships.Ferryman >= 1"\r
      - text: "Stay silent"\r
        target: neutral_end\r
\r
  good_end:\r
    text: |\r
      The fog parts. You reach the Archive, and your name is etched among oathkeepers.\r
    choices: []\r
\r
  neutral_end:\r
    text: |\r
      You cross, but the Archive doors remain closed to you. Some truths were left unsaid.\r
    choices: []\r
\r
  bad_end:\r
    text: |\r
      The ferryman refuses you forever. The river keeps its secrets.\r
    choices: []\r
`;export{r as default};
