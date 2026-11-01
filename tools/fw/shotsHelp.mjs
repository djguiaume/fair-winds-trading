// The `npm run shots -- --help` text (decision 0153), kept apart so shots.mjs stays small.
export const HELP = `npm run shots -- [options]          screenshots of the real game, PNG in --out

Where
  --sea phase4|ring|stress|file.json   the sea (default phase4, the game's own grown sea, 0198;
                                ring = the Windward Ring alone; a file: a map editor export, or a
                                sea file merged round the ring, played as ?map=edited)
  --island a.json,b.json        island files to play instead of the shipped ones (builder exports)
  --at x,y                      boat at sea there (default: docked at the start port)
  --prologue                    a new voyage as a player who skips the tutorial meets it: alone at
                                sea, sails down, the rescue to play (0160); without it the tools
                                drop that story and start at the map's start, as before
  --heading deg                 boat heading, compass degrees (default: wind on the beam)
  --sail 0|1|2                  sails furled, half, full (default 2)
  --speed kn                    starting speed (default 5)
  --ship id                     sail this ship (sloop, schooner, fluyt, …)
  --levels s,h,u                her upgrade levels 1-3 (sails, hold, hull), e.g. 3,1,2
  --hull pct                    her hull at this condition, 0 to 100 (decision 0208: the model
                                shows scuffs below 75, patches below 50, torn sails below 25)
  --crash ms                    a crash's splash and planks at her bow this long before the shot
                                (after the wait; e.g. --crash 250 for the splash in the air)
  --hold Key:ms                 hold a key that long before the shot (e.g. ArrowUp:2500)
  --pad steps                   a fake game controller (0162): after the wait, connected, then
                                each step held in turn: button:ms or axis=value:ms
                                (e.g. "lx=0.8:1500,rb:100,y:100"); buttons a b x y lb rb lt rt view menu ls rs up down left right
  --port id                     docked at this port, port screen open
  --moor island                 moored at one of her islands' piers (owned first, decision 0159),
                                at sea with its harbour screen closed
  --offer spot-2,…              plots given on the --moor island and not built: staked, their
                                giver's card on mooring (with --cards), decision 0210
  --built spot-1=workshop,…     buildings standing on the --moor island
  --island-tab                  its harbour screen open on the Island tab; --choose spot-2: that
                                plot chosen (half screen, the camera on the plot, its ring)
  --quest id:step               a quest started at that step, earlier steps paid (as a quest test)
  --tab market|orders|quay|shipyard   the port screen's tab
  --zoom z                      camera distance, 1 = default, larger = farther (no game limit)
  --look x,y                    camera on this map point instead of the boat
  --look v1 | v1,x,y            the classic ground (?look=v1) for comparison, and the camera on that
                                point; the new look (v2, decision 0222) is the default
  --yaw deg --tilt deg          a turned camera (0223): the bearing it looks to, degrees down
  --menu                        the title menu, before Set sail (the scene options are ignored)
  --chart                       the sea chart open (--pad and --click then play on it); --chart-zoom n, --chart-pan Key:n,
                                --chart-panel journal|market|legend: that tab (default the map)
  --charted                     every wind zone sailed and every chart area handed over (all named)
  --town id:level,…             towns at these levels; an empty island to found is founded first
                                (0157), so --town palm-key:1 shows Palm Key just founded
Map editor (editor.html instead of the game)
  --editor phase4|ring          the sea editor on the game's sea (default), or the ring alone
  --select hit                  select what the chart tags so: island:sunreach, shape:coral-line-east, fleet:kits-boats,
                                area:sugar-bar, zone:the-trades, current:id, mark:3, waypoint:2, start
  --look x,y --zoom upp         centre the chart there, map units per pixel (default: the whole sea)
  --draft file.json             an editor draft to load (a map export, or a stored sea draft)
  --export                      the export dialog open (phase4: every file, changed or same)
  --builder id[:tab[:shape[:point]]]  the island builder on that island, e.g.
                                the-smoulder:lanes:river:0:2 (tab props|ground|lanes|spots)
Look
  --lang en|fr                  language (default en)
  --query padlog                more of the game's URL options, e.g. padlog (the controller log, 0201)
  --night  | --time s           night, or this game time in seconds (default 300, day)
  --weather  --storms           weather spells, moving storms (default off: steady breeze)
  --no-zones  --no-currents     wind zones, currents off (default on, like the game)
  --no-belt                     Settings › Storm belt off (0167)
  --quality level               Settings › Quality: ultralow|low|medium|high|ultra (default: the
                                game's auto guess; ultra: the desktop and Xbox look, decision 0221)
  --erupt island                this volcano erupts as the scene is set (0178); give it time to
                                build, e.g. --wait 6000. --no-eruptions: the Eruptions switch off
  --cards                       keep quest cards and dialogs open (default: closed, kept in a quest test)
  --wait ms                     settle time before the shot (default 1500)
  --click selector              click this before the shot (after the wait), e.g. a card's button,
                                then wait 800 ms; several in turn with ; (e.g. "#menu-btn;#menu-help")
                                (--pad and --click also work on --menu)
  --focus selector              this control focused as by the controller (decision 0163): the page
                                set to controller input, so the focus ring and button hints show
  --style a.css,b.css           these stylesheets added to the page before the shot (a mockup's look)
  --script a.js,b.js            these scripts run in the page, in order, after the focus is set
                                (a mockup's extra parts)
Output
  --save-link                   also print the scene as a save link on the Pages game, to play
                                from there (e.g. --script a test save's set-up, then --save-link)
  --sizes desktop,landscape,portrait,tv   (default desktop; tv = Xbox Edge at 1080p)
  --name name                   file name, written as <name>-<size>.png (default: from the scene)
  --list shots.json             a JSON list of shots; each entry takes the options above as keys
                                (at: [x, y], sizes: [...]); options on the line are the defaults
  --out dir                     (default shots/)
  --json                        print the files as JSON
`;
