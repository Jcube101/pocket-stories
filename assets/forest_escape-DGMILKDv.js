const e=`# story.yaml\r
variables:\r
  inventory:\r
    key: false\r
    sword: 0\r
    potion: 0\r
  relationships:\r
    Alice: 0\r
    Guard: 0\r
  flags:\r
    met_dragon: false\r
    opened_gate: false\r
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
      - text: "Ignore her and look around"\r
        target: clearing_look\r
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
      The key fits! The gate creaks open. You enter the castle courtyard.\r
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
      - text: "Wake the dragon and fight"\r
        target: dragon_fight\r
\r
  dragon_fight:\r
    text: |\r
      You charge bravely... but the dragon breathes fire. You perish.\r
    choices: []\r
\r
  good_end_treasure:\r
    text: |\r
      Thanks to Alice's friendship, you feel lucky. You grab the treasure and escape unharmed.\r
\r
      Congratulations! You win.\r
    choices: []\r
\r
  bad_end_fight:\r
    text: |\r
      You are no match for the trained guard. Game over.\r
    choices: []`;export{e as default};
