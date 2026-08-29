window.ambaGettingStarted = function ambaGettingStarted() {
  return `
<section class="module-overview module-section module-section--overview" data-amba-node-kind="adventure">
  <p class="kicker">Getting Started</p>
  <h1 class="module-title">Structure Follows Your Selection</h1>
  <p class="deck subtitle">AMBA HTML is not just pretty HTML. Where a block is inserted determines what contains it.</p>
  <div class="rules-note">
    <strong>The key rule:</strong> put the cursor inside the container that should own the next item, then insert it. If the cursor is outside that container, the new item is a sibling instead of a child.
  </div>
  <div class="designer-note">
    <strong>Prototype note.</strong> This editor demonstrates the intended HTML-first import model. The future importer will turn DOM nesting into AMBA container ownership. The importer itself is not implemented in this playground yet.
  </div>
</section>

<section class="module-section module-section--overview">
  <p class="kicker">1 · Begin with the module outline</p>
  <h2 class="page-title">Create the outer structure first</h2>
  <p>Start with the module outline before adding acts. Think of the outline as the outer box that owns the adventure structure below it.</p>
  <div class="gm-note">
    <strong>Before adding an Act:</strong> click somewhere <em>inside</em> the module outline. Then use <strong>AMBA Insert → Child nodes → Act</strong>.
  </div>

  <section class="module-overview module-section module-section--overview" data-amba-node-kind="adventure">
    <p class="kicker">Correct placement</p>
    <h2 class="module-title">The Ashen Bell</h2>
    <p class="body-text">This is the module outline. The Act below is physically nested inside this section.</p>

    <section class="module-section module-section--act" data-amba-node-kind="act">
      <p class="kicker">Act 1</p>
      <h2 class="act-title">A Bell in the Rain</h2>
      <p>Because this Act is inside the module outline, an importer can recognize it as a child of the module.</p>
    </section>
  </section>

  <div class="warning-note">
    <strong>Wrong selection:</strong> if you click after the closing edge of the module outline and insert the Act there, the Act is outside the module outline. It may look close on screen, but structurally it is a sibling, not a child.
  </div>

  <section class="module-overview module-section module-section--overview" data-amba-node-kind="adventure">
    <p class="kicker">Module outline ends here</p>
    <h3>Example Module</h3>
  </section>
  <section class="module-section module-section--act" data-amba-node-kind="act">
    <p class="kicker">Incorrect sibling</p>
    <h3 class="act-title">Act Outside the Module Outline</h3>
    <p>This Act is outside the module section above. A hierarchy-aware importer should not treat it as that module outline's child.</p>
  </section>
</section>

<section class="module-section module-section--overview">
  <p class="kicker">2 · Build downward one level at a time</p>
  <h2>Act → Scene → Subscene → Encounter</h2>
  <p>The same rule repeats at every level. Select inside the intended parent before inserting the next child.</p>
  <ul class="key-list">
    <li><strong>To add a Scene:</strong> click inside the Act.</li>
    <li><strong>To add a Subscene:</strong> click inside the Scene.</li>
    <li><strong>To add an Encounter directly to a Scene:</strong> click inside the Scene.</li>
    <li><strong>To add an Encounter to a Subscene:</strong> click inside the Subscene instead.</li>
  </ul>

  <section class="module-section module-section--act" data-amba-node-kind="act">
    <p class="kicker">Act 1</p>
    <h2 class="act-title">A Bell in the Rain</h2>
    <p>The Scene is nested inside this Act.</p>

    <section class="module-section module-section--scene scene-brief" data-amba-node-kind="scene">
      <p class="kicker">Scene 1</p>
      <h2 class="scene-title">The Broken Chapel</h2>
      <p class="read-aloud">Rain hisses against the broken saints carved above the chapel doors. Somewhere inside, a bell rings once.</p>
      <div class="gm-note"><strong>GM Note.</strong> The bell is not physical. Characters who investigate it can uncover what is trapped below.</div>

      <section class="module-section module-section--subscene" data-amba-node-kind="subscene">
        <p class="kicker">Subscene</p>
        <h3 class="subscene-title">The Bell Stair</h3>
        <p>The Encounter below belongs to this Subscene because it is nested inside it.</p>

        <section class="module-section module-section--encounter encounter-brief encounter-brief--combat" data-amba-node-kind="encounter" data-amba-encounter-tag="combat">
          <p class="kicker">Combat Encounter</p>
          <h3 class="encounter-title">Something Beneath the Bell</h3>
          <p>Situation, stakes, and resolution live here.</p>
        </section>
      </section>
    </section>
  </section>
</section>

<section class="module-section module-section--overview">
  <p class="kicker">3 · Selection controls ownership</p>
  <h2>Where you click matters more than what is visually nearby</h2>
  <p>TinyMCE inserts at the current selection. Two blocks can appear one after another and still have completely different structural relationships.</p>
  <div class="rules-note">
    <strong>Useful habit:</strong> before inserting a structural block, click inside some existing text in the intended parent. Do not rely on the cursor sitting between two large cards unless you intentionally want a sibling.
  </div>
  <div class="warning-note">
    <strong>Common mistake:</strong> you finish typing a Scene, press the Down arrow until the cursor leaves the Scene card, then insert an Encounter. That Encounter is now outside the Scene instead of inside it.
  </div>
</section>

<section class="module-section module-section--overview">
  <p class="kicker">4 · Artifacts follow the same ownership rule</p>
  <h2>Put the cursor inside the container that owns the artifact</h2>
  <p>Artifacts are not just visual cards. In the HTML-first model, an explicit artifact wrapper tells the importer to create an artifact, while its location tells the importer which container owns it.</p>

  <section class="module-section module-section--scene scene-brief" data-amba-node-kind="scene">
    <p class="kicker">Scene</p>
    <h3 class="scene-title">The Chapel Nave</h3>
    <p>A player handout placed here belongs to the Scene.</p>

    <section class="artifact artifact--handout player-handout" data-amba-node-kind="artifact" data-amba-artifact-type="handout">
      <p class="kicker">Player Handout</p>
      <h3 class="handout-title">Charred Hymnal Page</h3>
      <div class="handout-body"><p>The final verse is burned away except for three words: <em>below the bell</em>.</p></div>
    </section>

    <section class="module-section module-section--encounter encounter-brief encounter-brief--trap" data-amba-node-kind="encounter" data-amba-encounter-tag="trap">
      <p class="kicker">Encounter</p>
      <h3 class="encounter-title">The Bell Rope</h3>
      <p>The trap artifact below belongs to this Encounter because it is nested here.</p>

      <section class="artifact artifact--trap" data-amba-node-kind="artifact" data-amba-artifact-type="trap">
        <section class="trap-card">
          <p class="kicker">Trap</p>
          <h3>Falling Bell Weight</h3>
          <div class="stat-row"><strong>Stealth</strong><span>DC 18</span></div>
          <div class="stat-row"><strong>Disable</strong><span>Thievery DC 18</span></div>
          <p><strong>Trigger</strong> A creature pulls the rotten bell rope.</p>
          <p><strong>Effect</strong> A counterweight drops from the rafters.</p>
        </section>
      </section>
    </section>
  </section>

  <div class="designer-note">
    <strong>Semantic style is different from an artifact.</strong> A <code>gm-note</code>, <code>read-aloud</code>, or <code>warning-note</code> is presentation inside the current narrative. An <code>artifact artifact--trap</code> wrapper explicitly says “create a Trap artifact.”
  </div>
</section>

<section class="module-section module-section--overview">
  <p class="kicker">5 · Styles do not change hierarchy</p>
  <h2>Use AMBA Style freely inside the selected narrative</h2>
  <p>Read Aloud, GM Note, Sidebar, Rules Note, Warning, Danger, Map Note, Secret / GM Only, and Kicker change presentation. They do not create Acts, Scenes, Encounters, or artifacts.</p>
  <div class="read-aloud"><strong>Read Aloud.</strong> The bell rings again, but the rope does not move.</div>
  <div class="gm-note"><strong>GM Note.</strong> Characters standing beneath the gallery hear the sound from below their feet.</div>
  <div class="rules-note"><strong>Rules.</strong> A successful Perception check reveals a hidden stair beneath the altar.</div>
  <div class="warning-note"><strong>Warning.</strong> Applying a style is not the same as inserting a structural child.</div>
</section>

<section class="module-section module-section--overview">
  <p class="kicker">6 · A reliable authoring sequence</p>
  <h2>Build the skeleton before filling every detail</h2>
  <ol class="objective-list">
    <li><strong>Create the module outline.</strong></li>
    <li><strong>Click inside it and add your Acts.</strong></li>
    <li><strong>Click inside each Act and add Scenes.</strong></li>
    <li><strong>Click inside each Scene and add Subscenes or Encounters as needed.</strong></li>
    <li><strong>Click inside the owning container before inserting artifacts.</strong></li>
    <li><strong>Write narrative and apply AMBA semantic styles.</strong></li>
    <li><strong>Use the code view or Generated HTML when hierarchy looks suspicious.</strong></li>
  </ol>
  <div class="gm-note">
    <strong>Fast check:</strong> if an Act should belong to a module, its opening <code>&lt;section class="module-section--act"&gt;</code> must appear before the module outline's closing <code>&lt;/section&gt;</code>. The same nesting rule applies all the way down the tree.
  </div>
</section>

<section class="module-section module-section--overview">
  <p class="kicker">7 · The target structure</p>
  <h2>What the HTML-first importer should eventually generate</h2>
  <ul class="key-list">
    <li><strong>Module</strong>
      <ul>
        <li><strong>Act 1</strong>
          <ul>
            <li><strong>Scene: The Broken Chapel</strong>
              <ul>
                <li><strong>Handout: Charred Hymnal Page</strong></li>
                <li><strong>Subscene: The Bell Stair</strong>
                  <ul><li><strong>Encounter: Something Beneath the Bell</strong></li></ul>
                </li>
                <li><strong>Encounter: The Bell Rope</strong>
                  <ul><li><strong>Trap: Falling Bell Weight</strong></li></ul>
                </li>
              </ul>
            </li>
          </ul>
        </li>
      </ul>
    </li>
  </ul>
  <div class="rules-note">
    <strong>Mental model:</strong> AMBA HTML is a tree. Formatting describes what something looks like; semantic wrappers describe what something is; nesting describes who owns it.
  </div>
</section>
`;
};
