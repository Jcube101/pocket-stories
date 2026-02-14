const e=`# story.yaml\r
variables:\r
  inventory:\r
    key: false\r
    sword: 0\r
    potion: 0\r
    dragon_scale: false\r
    map_fragment: false\r
  relationships:\r
    Alice: 0\r
    Guard: 0\r
    Dragon: 0\r
  flags:\r
    met_dragon: false\r
    opened_gate: false\r
    promised_alice: false\r
\r
passages:\r
  start:\r
    text: |\r
      You wake up in a dark forest. Moonlight filters through the trees. You feel disoriented.\r
\r
      What do you do?\r
    choices:\r
      - text: "Follow the distant light"\r
        target: clearing\r
      - text: "Search your pockets"\r
        target: pockets\r
        condition: "inventory.key == false"\r
      - text: "Check the old satchel"\r
        target: satchel\r
        condition: "inventory.map_fragment == false"\r
\r
  satchel:\r
    text: |\r
      You find a torn map fragment tucked beside a rusted coin.\r
    choices:\r
      - text: "Keep the fragment"\r
        target: clearing\r
        effect: "inventory.map_fragment = true"\r
\r
  pockets:\r
    text: |\r
      You find an old key in your pocket. It looks important.\r
    choices:\r
      - text: "Continue to the light"\r
        target: clearing\r
        effect: "inventory.key = true"\r
\r
  clearing:\r
    text: |\r
      You emerge into a sunny clearing. A kind woman named Alice is gathering herbs.\r
    choices:\r
      - text: "Greet her warmly"\r
        target: alice_friend\r
        effect: "relationships.Alice += 3"\r
      - text: "Ask for directions rudely"\r
        target: alice_neutral\r
        effect: "relationships.Alice -= 2"\r
      - text: "Promise to share treasure if you survive"\r
        target: alice_promise\r
        effect: "flags.promised_alice = true"\r
      - text: "Ignore her and look around"\r
        target: clearing_look\r
\r
  alice_promise:\r
    text: |\r
      Alice nods. "Then don't rush in blind. The dragon respects courage and gifts."\r
    choices:\r
      - text: "Thank her"\r
        target: clearing_look\r
        effect: "relationships.Alice += 1"\r
\r
  clearing_look:\r
    text: |\r
      You notice a path leading to a castle in the distance.\r
    choices:\r
      - text: "Head to the castle"\r
        target: castle_gate\r
\r
  alice_friend:\r
    text: |\r
      Alice smiles and offers you a healing potion. "You seem lost. Take this."\r
    choices:\r
      - text: "Thank her and accept"\r
        target: clearing_look\r
        effect: "inventory.potion += 1"\r
      - text: "Decline politely"\r
        target: clearing_look\r
\r
  alice_neutral:\r
    text: |\r
      Alice frowns but points to the castle path anyway.\r
    choices:\r
      - text: "Follow the path"\r
        target: castle_gate\r
\r
  castle_gate:\r
    text: |\r
      A massive gate blocks the way to the castle. A guard stands watch.\r
    choices:\r
      - text: "Talk to the guard"\r
        target: guard_talk\r
      - text: "Try to open the gate with the key"\r
        target: gate_open\r
        condition: "inventory.key == true"\r
      - text: "Show map fragment as proof of your quest"\r
        target: gate_open\r
        condition: "inventory.map_fragment == true"\r
        effect: "relationships.Guard += 1"\r
\r
  guard_talk:\r
    text: |\r
      The guard looks you over. "What business do you have?"\r
    choices:\r
      - text: "I'm here to slay the dragon"\r
        target: guard_dragon\r
      - text: "Lie and say you're expected"\r
        target: guard_lie\r
        effect: "relationships.Guard -= 2"\r
\r
  guard_dragon:\r
    text: |\r
      The guard laughs. "The dragon? Good luck. The gate is locked anyway."\r
    choices:\r
      - text: "Back"\r
        target: castle_gate\r
\r
  guard_lie:\r
    text: |\r
      The guard doesn't believe you and draws his sword.\r
    choices:\r
      - text: "Fight"\r
        target: bad_end_fight\r
      - text: "Run away"\r
        target: start\r
\r
  gate_open:\r
    text: |\r
      The gate creaks open. You enter the castle courtyard.\r
    choices:\r
      - text: "Proceed inside"\r
        target: dragon_chamber\r
        effect: "flags.opened_gate = true"\r
\r
  dragon_chamber:\r
    text: |\r
      A huge dragon sleeps in the chamber, guarding treasure.\r
    choices:\r
      - text: "Sneak past"\r
        target: good_end_treasure\r
        condition: "relationships.Alice >= 3"\r
      - text: "Offer your potion as tribute"\r
        target: dragon_bargain\r
        condition: "inventory.potion >= 1"\r
        effect: "relationships.Dragon += 2"\r
      - text: "Wake the dragon and fight"\r
        target: dragon_fight\r
        effect: "flags.met_dragon = true"\r
\r
  dragon_bargain:\r
    text: |\r
      The dragon opens one eye and accepts the potion with surprising grace.\r
    choices:\r
      - text: "Ask for safe passage"\r
        target: good_end_treasure\r
        condition: "relationships.Dragon >= 2"\r
      - text: "Demand treasure now"\r
        target: dragon_fight\r
\r
  dragon_fight:\r
    text: |\r
      You charge bravely... but the dragon breathes fire. You perish.\r
    choices: []\r
\r
  good_end_treasure:\r
    text: |\r
      Thanks to your choices and allies, you claim the treasure and escape unharmed.\r
\r
      If you promised Alice, you return with enough gold to change both your fates.\r
\r
      Congratulations! You win.\r
    choices: []\r
\r
  bad_end_fight:\r
    text: |\r
      You are no match for the trained guard. Game over.\r
    choices: []\r
`;export{e as default};
