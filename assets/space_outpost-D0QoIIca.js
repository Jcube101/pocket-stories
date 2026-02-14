const r=`variables:\r
  inventory:\r
    toolkit: false\r
    fuel_cell: false\r
  relationships:\r
    AI: 0\r
  flags:\r
    power_restored: false\r
\r
passages:\r
  start:\r
    text: |\r
      You wake in a silent orbital outpost. Emergency lights flicker.\r
    choices:\r
      - text: "Check engineering"\r
        target: engineering\r
      - text: "Call station AI"\r
        target: ai_room\r
\r
  engineering:\r
    text: |\r
      The reactor is offline. A maintenance toolkit hangs nearby.\r
    choices:\r
      - text: "Take toolkit"\r
        target: reactor\r
        effect: "inventory.toolkit = true"\r
      - text: "Return to hub"\r
        target: start\r
\r
  ai_room:\r
    text: |\r
      The AI avatar appears. "Restore power and I'll open the hangar."\r
    choices:\r
      - text: "Promise to help"\r
        target: reactor\r
        effect: "relationships.AI += 2"\r
      - text: "Ignore and leave"\r
        target: start\r
\r
  reactor:\r
    text: |\r
      The access panel is jammed.\r
    choices:\r
      - text: "Pry panel with toolkit"\r
        target: battery_bay\r
        condition: "inventory.toolkit == true"\r
      - text: "Keep searching"\r
        target: cargo\r
\r
  cargo:\r
    text: |\r
      You find a spare fuel cell in a crate.\r
    choices:\r
      - text: "Take fuel cell"\r
        target: battery_bay\r
        effect: "inventory.fuel_cell = true"\r
\r
  battery_bay:\r
    text: |\r
      The backup battery bay hums faintly.\r
    choices:\r
      - text: "Install fuel cell"\r
        target: restored\r
        condition: "inventory.fuel_cell == true"\r
        effect: "flags.power_restored = true"\r
      - text: "Go back"\r
        target: reactor\r
\r
  restored:\r
    text: |\r
      Power returns. The AI unlocks the hangar doors.\r
    choices:\r
      - text: "Launch the shuttle"\r
        target: good_end\r
        condition: "flags.power_restored == true"\r
\r
  good_end:\r
    text: |\r
      You escape the outpost just as debris rains from orbit. You survived.\r
    choices: []\r
`;export{r as default};
