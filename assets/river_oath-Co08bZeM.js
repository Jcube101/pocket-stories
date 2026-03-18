const e=`variables:
  inventory:
    silver_ring: false
    lantern: false
    ferry_token: false
  relationships:
    Mira: 0
    Ferryman: 0
  flags: {}

passages:
  start:
    text: |
      At dusk you reach the Blackwater ferry. Across the river waits the Archive of Oaths.
    choices:
      - text: "Greet Mira, the apprentice scribe"
        target: mira
      - text: "Speak to the ferryman"
        target: ferryman
      - text: "Search the dock crates"
        target: crates

  crates:
    text: |
      You find an old lantern and a rusted token stamped with a river crest.
    choices:
      - text: "Take both"
        target: ferryman
        effect: "inventory.lantern = true"
      - text: "Take only token"
        target: ferryman
        effect: "inventory.ferry_token = true"

  mira:
    text: |
      Mira whispers, "The ferryman trusts people who keep promises."
    choices:
      - text: "Promise you'll return her lost ring"
        target: ferryman
        effect: "relationships.Mira += 2"
      - text: "Ignore her warning"
        target: ferryman
        effect: "relationships.Mira -= 1"

  ferryman:
    text: |
      The ferryman narrows his eyes. "Crossing costs one token, or one true favor."
    choices:
      - text: "Pay with token"
        target: crossing
        condition: "inventory.ferry_token == true"
        effect: "relationships.Ferryman += 1"
      - text: "Offer to recover Mira's ring from the reeds"
        target: reeds
      - text: "Threaten him"
        target: bad_end
        effect: "relationships.Ferryman -= 2"

  reeds:
    text: |
      In the cold reeds you spot a silver ring glinting in mud.
    choices:
      - text: "Take ring and return"
        target: crossing
        effect: "inventory.silver_ring = true"
      - text: "Leave it and return empty-handed"
        target: ferryman

  crossing:
    text: |
      Mid-river, fog swallows the boat. A shadow asks for proof of your intent.
    choices:
      - text: "Show Mira's ring"
        target: good_end
        condition: "inventory.silver_ring == true"
      - text: "Raise lantern and speak honestly"
        target: good_end
        condition: "inventory.lantern == true && relationships.Ferryman >= 1"
      - text: "Stay silent"
        target: neutral_end

  good_end:
    text: |
      The fog parts. You reach the Archive, and your name is etched among oathkeepers.
    choices: []

  neutral_end:
    text: |
      You cross, but the Archive doors remain closed to you. Some truths were left unsaid.
    choices: []

  bad_end:
    text: |
      The ferryman refuses you forever. The river keeps its secrets.
    choices: []
`;export{e as default};
