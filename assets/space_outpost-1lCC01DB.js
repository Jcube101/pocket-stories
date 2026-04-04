const e=`title: "Wreck of the Akaida"
variables:
  inventory:
    oxygen_kit: false
    medkit: false
    data_chip: false
  relationships:
    Mira: 0
  flags:
    breach_sealed: false
    beacon_sent: false
    mira_rescued: false

passages:
  start:
    text: |
      Your salvage vessel docks with the Akaida — a colony transport that went silent
      six hours ago. Emergency lighting casts the docking corridor red. The air smells
      stale and metallic.

      No movement. No voices. Just the low groan of a stressed hull.
    choices:
      - text: "Check the cargo hold before going deeper"
        target: cargo_hold
      - text: "Go straight to the bridge corridor"
        target: bridge_corridor

  cargo_hold:
    text: |
      Crates of colony supplies are overturned and scattered. Someone left in a hurry.

      Near the airlock override panel you find an emergency oxygen kit, still sealed
      in its case. It could be useful if the hull situation is as bad as the alarm suggests.
    choices:
      - text: "Take the oxygen kit and move on"
        target: bridge_corridor
        effect: "inventory.oxygen_kit = true"
      - text: "Leave it — head to the bridge corridor"
        target: bridge_corridor

  bridge_corridor:
    text: |
      The main corridor runs the length of the ship. Warning lights flash at the far
      end — a hull breach alarm. A door to your left is marked MEDICAL. Further ahead
      is crew quarters, and beyond that, the data core.
    choices:
      - text: "Investigate the hull breach"
        target: breach_section
      - text: "Check the medical bay"
        target: medical_bay
      - text: "Head to crew quarters"
        target: crew_quarters
      - text: "Go straight to the data core"
        target: data_core

  breach_section:
    text: |
      A section of hull has buckled. Cold vacuum presses against a failing emergency
      patch. Without intervention, the ship will vent atmosphere within the hour.

      The alarm is deafening up close.
    choices:
      - text: "Reinforce the seal with the oxygen kit"
        target: breach_sealed
        condition: "inventory.oxygen_kit == true"
        effect: "flags.breach_sealed = true"
      - text: "Too dangerous — pull back to the corridor"
        target: bridge_corridor

  breach_sealed:
    text: |
      You work fast, pressing the emergency seal into place. The alarm cuts out.
      The hull stabilises. Whoever is still alive aboard just bought more time.
    choices:
      - text: "Check on the sound from crew quarters"
        target: crew_quarters
      - text: "Head to the data core"
        target: data_core

  medical_bay:
    text: |
      The medical bay is small but intact — the raiders didn't bother with it.
      A colony medkit sits on the counter, fully stocked.
    choices:
      - text: "Take the medkit"
        target: bridge_corridor
        effect: "inventory.medkit = true"
      - text: "Leave it — keep moving"
        target: bridge_corridor

  crew_quarters:
    text: |
      A woman sits slumped against the wall — conscious, but pale. Her name tag
      reads: Mira, Chief Engineer.

      She looks up at you with careful, measuring eyes.
      "You're not one of them," she says.
    choices:
      - text: "Treat her wounds first"
        target: mira_healed
        condition: "inventory.medkit == true"
        effect: "relationships.Mira += 3"
      - text: "Ask what happened here"
        target: mira_story
        effect: "relationships.Mira += 1"
      - text: "Stay quiet and listen"
        target: mira_story

  mira_healed:
    text: |
      You use the medkit to stabilise her injuries. Colour returns to her face.

      "Thank you," she says. There's something solid in her voice now.
      "I wasn't sure anyone was coming."
    choices:
      - text: "Ask what happened"
        target: mira_story

  mira_story:
    text: |
      Mira explains: raiders boarded six hours ago and forced the crew into escape
      pods — all except her. She hid in the crawlways. She knows their vessel's
      ident beacon. Evidence enough to bring them to justice if combined with the
      ship's attack log.

      "The data core has everything," she says. "Get me out of here and I'll testify."
    choices:
      - text: "Promise to come back for her"
        target: data_core
        effect: "relationships.Mira += 2"
      - text: "Head to the data core without committing"
        target: data_core

  data_core:
    text: |
      The data core room is untouched — the raiders didn't know what they were
      looking at. A six-hour log of the attack sits intact, including the raider
      vessel's ident beacon signature.

      A distress beacon console blinks on the wall. Unused.
    choices:
      - text: "Extract the attack log to a data chip"
        target: data_chip_taken
        effect: "inventory.data_chip = true"
      - text: "Activate the distress beacon before anything else"
        target: beacon_first
        effect: "flags.beacon_sent = true"

  beacon_first:
    text: |
      The beacon pulses to life. An acknowledgment returns within minutes:
      a patrol vessel is six hours out. Help is coming.

      The raiders may be monitoring the frequency. You don't have much time.
      The data chip slot is still empty.
    choices:
      - text: "Extract the data chip — take the evidence too"
        target: rescue_choice
        effect: "inventory.data_chip = true"
      - text: "The beacon is enough — get out now"
        target: rescue_choice

  data_chip_taken:
    text: |
      Data chip secured. The distress beacon console still blinks — unused.
      You have the evidence. Now it's a question of what else you're willing to do.
    choices:
      - text: "Send the distress beacon too"
        target: rescue_choice
        effect: "flags.beacon_sent = true"
      - text: "Don't risk broadcasting — move out"
        target: rescue_choice

  rescue_choice:
    text: |
      You stand at the docking airlock. The Akaida groans around you.
      Mira is still in the crew quarters.
    choices:
      - text: "Go back for her — you're not leaving her behind"
        target: rescue_mira
      - text: "Reach her on the ship's intercom — she can meet you"
        target: rescue_comm
        condition: "relationships.Mira >= 3"
      - text: "Get to your ship — there's no time"
        target: depart

  rescue_mira:
    text: |
      You find Mira where you left her. She can walk — barely.

      "You came back," she says. It's not quite surprise.
    choices:
      - text: "Help her to your ship"
        target: depart
        effect: "flags.mira_rescued = true"

  rescue_comm:
    text: |
      "Airlock in two minutes," you say over the intercom.

      Mira's voice comes back steady: "I'll be there."

      She is. She moves faster than you expected for someone in her condition.
      The two of you disengage and pull clear.
    choices:
      - text: "Jump to safe distance"
        target: depart
        effect: "flags.mira_rescued = true"

  depart:
    text: |
      Your ship clears the docking clamps. The Akaida drifts behind you,
      red lights still blinking in the dark. You open a channel to the
      nearest relay station and consider your next move.
    choices:
      - text: "Transmit the data log and Mira's testimony — put the raiders away"
        target: end_justice
        condition: "inventory.data_chip == true && flags.mira_rescued == true"
      - text: "File an anonymous data tip — let the patrol handle it"
        target: end_data
        condition: "inventory.data_chip == true"
      - text: "Keep a low profile — pretend you were never here"
        target: end_survived

  end_justice:
    text: |
      Mira's testimony, combined with the Akaida's attack log, gives the patrol
      everything they need. The raiders are intercepted three days later at a fuel
      depot in the outer belt.

      You don't make the news. That's fine by you.
      The colony families eventually get their answers. That's enough.
    choices: []

  end_data:
    text: |
      An anonymous data package reaches the patrol authority twelve hours later.
      You don't know if it'll hold up without a witness. You don't wait to find out.

      Somewhere in the black, the Akaida continues to drift.
      You try not to think about Mira.
    choices: []

  end_survived:
    text: |
      You jump to a quiet sector and lay low. No record of your visit to the Akaida.
      No record of anything.

      Three weeks later you see a salvage notice for an unregistered colony transport —
      found drifting, one survivor aboard.

      The notice doesn't say if she made it.
    choices: []
`;export{e as default};
