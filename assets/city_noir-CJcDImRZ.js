const e=`title: "City Noir"
variables:
  inventory:
    badge: false
    evidence: false
  relationships:
    Informant: 0
  flags: {}

passages:
  start:
    text: |
      Rain hammers the neon streets. You stand outside the Velvet Club.
      Your informant left a message: come alone, come careful.
    choices:
      - text: "Flash your badge at the door"
        target: bouncer
        effect: "inventory.badge = true"
      - text: "Take the alley shortcut"
        target: alley

  bouncer:
    text: |
      The bouncer squints at you. He won't let just anyone through.
    choices:
      - text: "Demand entry"
        target: club_floor
        condition: "inventory.badge == true"
      - text: "Slip him cash"
        target: club_floor

  alley:
    text: |
      Your informant waits in the shadows with a sealed envelope.
    choices:
      - text: "Take the envelope"
        target: alley_trust
        effect: "inventory.evidence = true"
      - text: "Ask for details first"
        target: alley_talk
        effect: "relationships.Informant += 2"
      - text: "Ignore them — enter through the back door"
        target: club_floor

  alley_trust:
    text: |
      Envelope in hand. They've stuck their neck out to get you this far.
    choices:
      - text: "Acknowledge the risk they're taking"
        target: club_floor
        effect: "relationships.Informant += 2"
      - text: "Head straight in"
        target: club_floor

  alley_talk:
    text: |
      "Top floor office," they whisper. "Ledger in the second drawer.
      Don't trust the bartender — he's on the payroll."
      They press the envelope into your hands before slipping away.
    choices:
      - text: "Take the evidence and go in"
        target: club_floor
        effect: "inventory.evidence = true"

  club_floor:
    text: |
      Music pounds. Your suspect vanishes upstairs.
    choices:
      - text: "Confront the suspect now"
        target: confronted
      - text: "Search the office first"
        target: office

  confronted:
    text: |
      You force your way upstairs. The suspect stares you down, unblinking.
      Without hard evidence, all you have is instinct.
    choices:
      - text: "Make the arrest — you have nothing to lose"
        target: bad_end
        condition: "!inventory.evidence"
      - text: "Present the evidence"
        target: good_end
        condition: "inventory.evidence == true"

  office:
    text: |
      You find ledgers in the top floor office — names, payments, dates
      going back three years and linking the suspect to half the city council.
    choices:
      - text: "Bring the full case to the press — burn it all down"
        target: best_end
        condition: "inventory.evidence == true && relationships.Informant >= 2"
      - text: "File a formal report through proper channels"
        target: good_end
        condition: "inventory.evidence == true"
      - text: "Walk away — it's too dangerous"
        target: neutral_end

  best_end:
    text: |
      Your informant's gamble pays off. The story runs on every front page.
      The suspect doesn't just lose their freedom — the entire network collapses.

      Your informant gets a new name and a train ticket out of the city.
      You never see them again. That was the deal.
    choices: []

  good_end:
    text: |
      Your report breaks the case open. The city finally listens.
    choices: []

  neutral_end:
    text: |
      You keep your job, but the truth stays buried.
    choices: []

  bad_end:
    text: |
      The suspect had a lawyer on the phone before you finished the sentence.
      No evidence, no case. You walk out empty-handed.
    choices: []
`;export{e as default};
