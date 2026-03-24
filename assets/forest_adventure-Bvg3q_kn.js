const e=`title: "Forest Adventure"
variables:
  inventory:
    key: false
    potion: 0
    map_fragment: false
  relationships:
    Alice: 0
    Guard: 0
    Dragon: 0
  flags:
    met_dragon: false
    opened_gate: false
    promised_alice: false

passages:
  start:
    text: |
      You wake up in a dark forest. Moonlight filters through the trees. You feel disoriented.

      What do you do?
    choices:
      - text: "Follow the distant light"
        target: clearing
      - text: "Search your pockets"
        target: pockets
        condition: "inventory.key == false"
      - text: "Check the old satchel"
        target: satchel
        condition: "inventory.map_fragment == false"

  satchel:
    text: |
      You find a torn map fragment tucked beside a rusted coin.
    choices:
      - text: "Keep the fragment"
        target: clearing
        effect: "inventory.map_fragment = true"

  pockets:
    text: |
      You find an old key in your pocket. It looks important.
    choices:
      - text: "Continue to the light"
        target: clearing
        effect: "inventory.key = true"

  clearing:
    text: |
      You emerge into a sunny clearing. A kind woman named Alice is gathering herbs.
    choices:
      - text: "Greet her warmly"
        target: alice_friend
        effect: "relationships.Alice += 3"
      - text: "Ask for directions rudely"
        target: alice_neutral
        effect: "relationships.Alice -= 2"
      - text: "Promise to share treasure if you survive"
        target: alice_promise
        effect: "flags.promised_alice = true"
      - text: "Ignore her and look around"
        target: clearing_look

  alice_promise:
    text: |
      Alice nods. "Then don't rush in blind. The dragon respects courage and gifts."
    choices:
      - text: "Thank her"
        target: clearing_look
        effect: "relationships.Alice += 1"

  clearing_look:
    text: |
      You notice a path leading to a castle in the distance.
    choices:
      - text: "Head to the castle"
        target: castle_gate

  alice_friend:
    text: |
      Alice smiles and offers you a healing potion. "You seem lost. Take this."
    choices:
      - text: "Thank her and accept"
        target: clearing_look
        effect: "inventory.potion = 1"
      - text: "Decline politely"
        target: clearing_look

  alice_neutral:
    text: |
      Alice frowns but points to the castle path anyway.
    choices:
      - text: "Follow the path"
        target: castle_gate

  castle_gate:
    text: |
      A massive gate blocks the way to the castle. A guard stands watch.
    choices:
      - text: "Talk to the guard"
        target: guard_talk
      - text: "Try to open the gate with the key"
        target: gate_open
        condition: "inventory.key == true"
      - text: "Show map fragment as proof of your quest"
        target: gate_open
        condition: "inventory.map_fragment == true"
        effect: "relationships.Guard += 1"

  guard_talk:
    text: |
      The guard looks you over. "What business do you have?"
    choices:
      - text: "I'm here to slay the dragon"
        target: guard_dragon
      - text: "Lie and say you're expected"
        target: guard_lie
        effect: "relationships.Guard -= 2"

  guard_dragon:
    text: |
      The guard laughs. "The dragon? Good luck. The gate is locked anyway."
    choices:
      - text: "Back"
        target: castle_gate

  guard_lie:
    text: |
      The guard doesn't believe you and draws his sword.
    choices:
      - text: "Fight"
        target: bad_end_fight
      - text: "Run away"
        target: start

  gate_open:
    text: |
      The gate creaks open. You enter the castle courtyard.
    choices:
      - text: "Proceed inside"
        target: dragon_chamber
        effect: "flags.opened_gate = true"

  dragon_chamber:
    text: |
      A huge dragon sleeps in the chamber, guarding treasure.
    choices:
      - text: "Sneak past"
        target: good_end_treasure
        condition: "relationships.Alice >= 3"
      - text: "Offer your potion as tribute"
        target: dragon_bargain
        condition: "inventory.potion >= 1"
        effect: "relationships.Dragon += 2"
      - text: "Wake the dragon and fight"
        target: dragon_fight
        effect: "flags.met_dragon = true"

  dragon_bargain:
    text: |
      The dragon opens one eye and accepts the potion with surprising grace.
    choices:
      - text: "Ask for safe passage"
        target: good_end_treasure
        condition: "relationships.Dragon >= 2"
      - text: "Demand treasure now"
        target: dragon_fight

  dragon_fight:
    text: |
      You charge bravely... but the dragon breathes fire. You perish.
    choices: []

  good_end_treasure:
    text: |
      Thanks to your choices and allies, you claim the treasure and escape unharmed.

      If you promised Alice, you return with enough gold to change both your fates.

      Congratulations! You win.
    choices: []

  bad_end_fight:
    text: |
      You are no match for the trained guard. Game over.
    choices: []
`;export{e as default};
