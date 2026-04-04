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

  dragon_chamber:
    text: |
      A huge dragon sleeps in the chamber, guarding treasure.
    choices:
      - text: "Sneak past"
        target: treasure_room
        condition: "relationships.Alice >= 3 || flags.promised_alice == true"
      - text: "Offer your potion as tribute"
        target: dragon_tribute
        condition: "inventory.potion >= 1"
        effect: "inventory.potion = 0"
      - text: "Wake the dragon and fight"
        target: dragon_fight

  dragon_tribute:
    text: |
      You hold the potion out. The dragon's eye opens, regarding you carefully.
    choices:
      - text: "Present it with quiet respect"
        target: dragon_bargain
        effect: "relationships.Dragon += 2"
      - text: "Thrust it forward impatiently"
        target: dragon_fight

  dragon_bargain:
    text: |
      The dragon accepts the offering with surprising grace, then settles back.
      It watches you, waiting.
    choices:
      - text: "Ask for safe passage"
        target: treasure_room
        condition: "relationships.Dragon >= 2"
      - text: "Demand treasure now"
        target: dragon_fight

  dragon_fight:
    text: |
      You charge bravely — but the dragon breathes fire. The heat is overwhelming.
    choices:
      - text: "Use the healing potion to fight through the flames"
        target: dragon_survived
        condition: "inventory.potion >= 1"
        effect: "inventory.potion = 0"
      - text: "Flee — your life is worth more than treasure"
        target: neutral_end_fled

  dragon_survived:
    text: |
      Burned and exhausted, you land a lucky strike. The dragon retreats into the shadows.
      The treasure room is yours — but you paid a heavy price.
    choices:
      - text: "Take what you can carry and go"
        target: treasure_room

  treasure_room:
    text: |
      You reach the treasure, claim it, and escape the castle unharmed.
    choices:
      - text: "Return to Alice with a share of the gold"
        target: good_end_promise
        condition: "flags.promised_alice == true"
      - text: "Keep the treasure and leave the forest"
        target: good_end_alone

  good_end_promise:
    text: |
      Alice is exactly where you left her. You made a promise, and you kept it.
      Between you, the gold changes both your fates.

      Congratulations — you win, and so does she.
    choices: []

  good_end_alone:
    text: |
      You carry the treasure out of the forest alone. A fine haul, and you're alive.

      Congratulations! You win.
    choices: []

  neutral_end_fled:
    text: |
      You escape the dragon's fire — but with nothing to show for it.
      The forest swallows you whole. At least you survived.
    choices: []

  bad_end_fight:
    text: |
      You are no match for the trained guard. Game over.
    choices: []
`;export{e as default};
