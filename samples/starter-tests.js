// Starter-block test compositions (editor-only, no new CSS).
// Each combines existing AMBA classes; wrapped in data-amba-starter for audit/idempotency tests.
// Sources: Spear Launcher https://2e.aonprd.com/Hazards.aspx?ID=483
//          Goblin Warrior https://2e.aonprd.com/Monsters.aspx?ID=232 (legacy Bestiary text)
//          Minor healing potion https://2e.aonprd.com/Equipment.aspx?ID=186
window.ambaStarterTests = [
  {
    key: 'trap',
    label: 'Trap: Spear Launcher',
    html: `
<section class="encounter-brief encounter-brief--trap" data-amba-starter="trap" data-amba-starter-v="1" data-amba-system="pf2e">
  <h3 class="encounter-title">Trap: The Spear Hall</h3>
  <div class="trap-card">
    <h4 class="trap-title">Spear Launcher <span>Hazard 2</span></h4>
    <p class="tag-row"><span class="tag">Mechanical</span> <span class="tag">Trap</span></p>
    <p><strong>Stealth</strong> DC 20 (trained)</p>
    <p><strong>Description</strong> A wall socket loaded with a spear connects to a floor tile in one 5-foot square.</p>
    <p><strong>Disable</strong> DC 18 Thievery (trained) on the floor tile or wall socket</p>
    <p><strong>AC</strong> 18; <strong>Fort</strong> +11, <strong>Ref</strong> +3; <strong>Hardness</strong> 8, <strong>HP</strong> 32 (BT 16); <strong>Immunities</strong> critical hits, object immunities, precision damage</p>
    <p><strong>Spear</strong> [reaction] <strong>Trigger</strong> Pressure is applied to the floor tile; <strong>Effect</strong> The trap shoots a spear, making a Strike against the creature or object on the floor tile.</p>
    <p><strong>Ranged</strong> spear +14, <strong>Damage</strong> 2d6+6 piercing</p>
  </div>
  <div class="gm-note"><p>Placeholder: the trap reloads from a hopper behind the wall (number of spears not verified). A PC searching the corridor notices the loose tile on a success.</p></div>
</section>`
  },
  {
    key: 'combat',
    label: 'Combat: Goblin Warriors',
    html: `
<section class="encounter-brief encounter-brief--combat" data-amba-starter="combat" data-amba-starter-v="1" data-amba-system="pf2e">
  <h3 class="encounter-title">Combat: Goblin Ambush (3 goblin warriors)</h3>
  <div class="read-aloud"><p>Three small figures leap from behind the barrels, curved blades flashing and voices shrieking a tuneless war song.</p></div>
  <div class="npc-card aon-stat-block" data-aon-url="https://2e.aonprd.com/Monsters.aspx?ID=232">
    <h4>Goblin Warrior <span>Creature -1</span></h4>
    <p class="tag-row"><span class="tag">Small</span> <span class="tag">Goblin</span> <span class="tag">Humanoid</span></p>
    <p class="stat-line"><strong>Perception</strong> +2; darkvision · <strong>Languages</strong> Goblin</p>
    <p class="stat-line"><strong>Skills</strong> Acrobatics +5, Athletics +2, Nature +1, Stealth +5</p>
    <p class="stat-line"><strong>Str</strong> +0, <strong>Dex</strong> +3, <strong>Con</strong> +1, <strong>Int</strong> +0, <strong>Wis</strong> -1, <strong>Cha</strong> +1</p>
    <p class="stat-line"><strong>Items</strong> dogslicer, leather armor, shortbow (10 arrows)</p>
    <p class="stat-line"><strong>AC</strong> 16; <strong>Fort</strong> +5, <strong>Ref</strong> +7, <strong>Will</strong> +3 · <strong>HP</strong> 6</p>
    <p><strong>Goblin Scuttle</strong> [reaction] <strong>Trigger</strong> A goblin ally ends a move action adjacent to the warrior. <strong>Effect</strong> The goblin warrior Steps.</p>
    <p class="stat-line"><strong>Speed</strong> 25 feet</p>
    <p><strong>Melee</strong> [one-action] dogslicer +8 (agile, backstabber, finesse), <strong>Damage</strong> 1d6 slashing</p>
    <p><strong>Ranged</strong> [one-action] shortbow +8 (deadly 1d10, range increment 60 feet, reload 0), <strong>Damage</strong> 1d6 piercing</p>
  </div>
</section>`
  },
  {
    key: 'social',
    label: 'Social: Influence the Innkeeper',
    html: `
<section class="encounter-brief encounter-brief--social" data-amba-starter="social" data-amba-starter-v="1" data-amba-system="pf2e">
  <h3 class="encounter-title">Social: Winning Over Marta (placeholder NPC)</h3>
  <div class="npc-card">
    <h4>Marta Vell <span>Innkeeper · Level 1 (placeholder)</span></h4>
    <p><strong>Attitude</strong> indifferent · <strong>Wants</strong> the goblin raids on her cellar stopped · <strong>Secret</strong> she sold the goblins her spoiled ale</p>
  </div>
  <div class="skill-challenge skill-challenge--pf2e">
    <h4>Influence: Marta Vell</h4>
    <p><strong>Discovery</strong> DC 15 Perception, DC 13 Society (placeholder DCs)</p>
    <p><strong>Influence Skills</strong> DC 15 Diplomacy, DC 17 Deception, DC 13 Intimidation (she is weak to threats)</p>
    <p><strong>Thresholds</strong> 2: she shares rumors · 4: free room and board · 6: she confesses the ale sale</p>
    <div class="check-result check-result--critical-success"><strong>Critical Success</strong> Gain 2 Influence Points.</div>
    <div class="check-result check-result--success"><strong>Success</strong> Gain 1 Influence Point.</div>
    <div class="check-result check-result--failure"><strong>Failure</strong> Gain no Influence Points.</div>
    <div class="check-result check-result--critical-failure"><strong>Critical Failure</strong> Lose 1 Influence Point.</div>
  </div>
</section>`
  },
  {
    key: 'treasure',
    label: 'Treasure: Centipede Nest Cache',
    html: `
<section class="encounter-brief encounter-brief--treasure" data-amba-starter="treasure" data-amba-starter-v="1" data-amba-system="pf2e">
  <h3 class="encounter-title">Treasure: Centipede Nest Cache</h3>
  <div class="treasure-card">
    <h4 class="treasure-title">Cache under the nest <span>Party level 1 · Moderate (budget 18 gp)</span></h4>
    <p><strong>Found</strong> wrapped in oilcloth beneath the nest (placeholder: DC 15 Perception)</p>
    <table>
      <thead><tr><th>Item</th><th>Lvl</th><th>Qty</th><th>Price</th><th>Bulk</th></tr></thead>
      <tbody>
        <tr><td><a href="#wg" data-wg-type="item" data-wg-id="0">Minor healing potion</a></td><td>1</td><td>2</td><td>4 gp</td><td>L</td></tr>
        <tr><td><a href="#wg" data-wg-type="item" data-wg-id="0">Giant centipede venom</a></td><td>1</td><td>1</td><td>4 gp</td><td>L</td></tr>
      </tbody>
    </table>
    <p><strong>Coins</strong> 5 gp, 5 sp · <strong>Valuables</strong> silver ring (1 gp, placeholder)</p>
    <p><strong>Total</strong> 18.5 gp of 18 gp budget</p>
  </div>
</section>`
  },
  {
    key: 'scene',
    label: 'Scene: Flooded Cellar',
    html: `
<section class="module-section module-section--scene" data-amba-starter="scene" data-amba-starter-v="1">
  <h2 class="scene-title">Scene: The Flooded Cellar</h2>
  <div class="read-aloud"><p>Brackish water laps at the bottom step. Somewhere in the dark, barrels knock together with a hollow, uneven rhythm.</p></div>
  <div class="map-note"><p>Placeholder: Area A3 connects to the sewer at B1 through a flooded crawlway (DC 15 Athletics to swim through).</p></div>
  <div class="warning-note"><p>Placeholder: this scene leads straight into a moderate encounter for level 1 PCs; let the party rest first if they are hurt.</p></div>
</section>`
  }
];
window.ambaStarterTestsAll = function () {
  return window.ambaStarterTests.map(function (t) { return t.html; }).join('\n');
};
