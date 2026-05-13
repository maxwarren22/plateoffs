/**
 * THE MULTIVERSE OF FLAVOR: Hyper-Stylized Digital Composite Edition
 *
 * AESTHETIC RULES:
 * - This is NOT food photography. This is hyper-stylized digital art.
 * - Food itself emits light, glows, or acts as an energy source where noted.
 * - Scale is pushed to impossible/surreal extremes.
 * - Color is saturated past reality. Environments are fully realized worlds.
 *
 * COMPOSITION RULES:
 * - Foreground: Out-of-focus "debris" (sparks, herbs, droplets) for 3D depth.
 * - Midground: The "Hero" action/impact — the impossible moment.
 * - Background: A fully realized environment with atmosphere and world-building.
 */

const CONSTRAINTS = `
No text, no words, no letters, no logos, no watermarks.
Portrait orientation, 3:4 aspect ratio. No people.
Hyper-stylized digital composite aesthetic — NOT food photography.
CGI-enhanced surrealism: impossible scale, pushed-past-reality saturation,
dramatic practical lighting fused with neon and particle FX.
Every element should feel like it was designed, not captured.
`

/**
 * layered() fuses the core action with a fully described environment.
 */
function layered(prompt, env) {
  return `CORE ACTION: ${prompt.trim()}\n\nENVIRONMENT & ATMOSPHERE: ${env.trim()}\n\n${CONSTRAINTS.trim()}`;
}

export const DIVISION_PROMPTS = {

  // ── Anchors: THE VOID (Extreme Depth & Particle FX) ──────────────────────

  'protein-throne': layered(`
    A thick tomahawk steak slams into a cast-iron skillet with volcanic force.
    FOREGROUND: Glowing orange sparks and salt crystals the size of diamonds fly toward the lens, soft and massive.
    MIDGROUND: The steak erupts in a 360-degree shockwave of white flame and molten render-fat — the scale is impossible, filling the frame.
    The fire behaves like liquid. The steak surface glows like cooling lava.
  `, `
    Dark void industrial kitchen. A single cold-blue rim light cuts the smoke.
    The smoke itself has volume and weight — thick, rolling, cinematic.
    Background pools into pure black, making every spark read like a star.
  `),

  'plant-power': layered(`
    A split avocado levitates at the center, a pulsing emerald neon energy core glowing between the halves.
    The avocado itself emits green bioluminescent light — it is a power source, not a fruit.
    FOREGROUND: Microgreen leaves and lime juice droplets drift in zero gravity, each one catching neon light.
    MIDGROUND: Chickpeas and radish slices orbit the avocado like glowing planets, trailing light streaks.
    Every ingredient has a soft neon aura — purple, cyan, green.
  `, `
    A cyberpunk night market alleyway. Neon signs in cyan and magenta bleed into the scene.
    The ground glows with reflected neon puddles. Deep purple cosmic atmosphere bleeds in from above.
    Bioluminescent moss on wet stone walls. Floating particle dust catches the light like glitter in slow motion.
  `),

  '30-minute-wars': layered(`
    A carbon-steel wok caught in a violent high-velocity flip — the whole frame is kinetic chaos.
    FOREGROUND: Chili flakes and smoke streaks blur into abstract neon-orange trails.
    MIDGROUND: Noodles and snap peas are caught inside a tornado of blue gas fire — the flame is surreally vivid, electric blue at the core bleeding to deep orange at the edges.
    The fire scale is impossible. It dwarfs the wok.
  `, `
    A gritty, dark commercial kitchen pushed to its extreme: walls slick with steam, rows of copper pans in glowing bokeh.
    The gas burners beneath burn with an otherworldly blue-white intensity.
    Smoke fills the upper half of the frame like storm clouds.
  `),

  'comfort-classics': layered(`
    A heavy iron pot lid blasted upward by a massive pressurized geyser of golden steam.
    FOREGROUND: Rich brown sauce droplets the size of marbles hurtle toward the camera lens — blurred, enormous.
    MIDGROUND: Chunks of beef and whole carrots hang suspended in the superheated vapor as if time has stopped.
    The steam glows from within — warm amber light radiating through it like a nuclear sunrise.
  `, `
    A stone hearth fireplace that dominates the background — embers glow orange-white at an impossible intensity.
    Warm amber light floods the scene from below. Deep shadow frames the top.
    The atmosphere is part pressure-cooker disaster, part cozy apocalypse.
  `),

  // ── Cuisine Pool: THE STREETS (Urban Grit & Layered Bokeh) ────────────────

  'italian-masters': layered(`
    A silver fork pulls a massive impossible tangle of spaghetti alle vongole straight upward — the pasta strand stretches six feet tall.
    FOREGROUND: Parsley leaves and steam swirls drift in slow motion, enormous and out of focus.
    MIDGROUND: Glistening pasta strands glow with olive oil catching the lamplight — each strand is a thread of gold.
    A single clam shell hangs mid-air, dramatically lit from below.
  `, `
    A midnight cobblestone Roman street. Warm yellow restaurant lanterns create deep bokeh halos the size of full moons.
    The cobblestones are wet and slick, reflecting orange light. The atmosphere is cinema noir — deep contrast, velvet shadows.
    Rain begins to fall in the distance.
  `),

  'japanese-showdown': layered(`
    A sushi knife slices through a salmon roll at an impossible speed — the blade leaves a light trail.
    FOREGROUND: Rice grains and droplets of soy sauce scatter like slow-motion shrapnel, huge and soft.
    MIDGROUND: The roll splits perfectly, revealing an electric-pink ginger interior that glows like a neon sign.
    The soy droplets refract cyan and magenta neon from the environment.
  `, `
    A rainy Tokyo street at night. Massive blurry neon signs in cyan, magenta, and acid yellow bleed across the wet ground.
    Reflections of the knife and food appear in the slick pavement below.
    The rain falls in long streaks of light. This is cyberpunk precision.
  `),

  'mexican-street-fight': layered(`
    A carne asada taco detonates mid-air — a full radial explosion with the taco as the epicenter.
    FOREGROUND: Shards of crispy tortilla chips and lime wedges the size of boulders fly toward the lens in soft focus.
    MIDGROUND: Charred meat and vivid salsa blast outward in a 360-degree radial shockwave — the colors are impossible: deep crimson, neon orange, lime green.
    The explosion scale is absurd. Salsa moves like lava.
  `, `
    A bustling street market at night. Neon pink and teal food stalls glow behind the chaos.
    String lights create a ceiling of warm bokeh halos overhead.
    The ground reflects the explosion light in a wet, chaotic mirror.
  `),

  'thai-throwdown': layered(`
    Pad Thai launches from a flaming wok in a massive upward arc — the food becomes a comet.
    FOREGROUND: Crushed peanuts and bean sprouts streak across the frame like meteor trails.
    MIDGROUND: A wall of electric blue and orange fire engulfs the noodles at the apex — shrimp crest the top like a wave.
    The fire is surreal — the color of lightning, the scale of a bonfire.
  `, `
    A smoky Bangkok alleyway, low-lit with warm incandescent bulbs that create amber pools on wet stone.
    Distant neon signs bleed orange and red into the atmosphere.
    Thick tropical smoke fills the upper frame. The heat is visible — air shimmering, walls damp with steam.
  `),

  'indian-spice-wars': layered(`
    A clay bowl at the epicenter of a massive, impossible spice-powder detonation.
    FOREGROUND: Thick clouds of turmeric (neon yellow) and chili (deep crimson) powder billow toward the camera — they glow from within.
    MIDGROUND: Whole star anise and cinnamon sticks fly radially from the bowl like shrapnel, trailing color dust.
    The spice clouds are the scale of thunderheads. The bowl is the eye of the storm.
  `, `
    A deep violet night sky. An ancient stone archway frames the explosion from behind.
    The spice dust catches ambient starlight, glowing as if radioactive.
    The ground is dark volcanic stone — every color of the explosion bounces back from it.
  `),

  'mediterranean-clash': layered(`
    A pomegranate is smashed against rough white stone with brutal force — a full detonation of crimson.
    FOREGROUND: Crimson juice droplets bloom toward the lens like slow-motion rubies, massive and blurred.
    MIDGROUND: Thousands of arils scatter like shattered stained glass — each one catches the harsh Mediterranean sun and glints.
    The juice moves like liquid fire across the white stone surface.
  `, `
    A sun-drenched coastal terrace in harsh midday light. The turquoise sea is deeply saturated in the blurred background.
    White stone walls reflect the sun at full intensity — the highlights blow out intentionally.
    The contrast between the saturated crimson and the blazing white is the point.
  `),

  'french-bistro-battle': layered(`
    A heavy stream of Burgundy wine hits a crystal glass at high velocity — the impact creates a crown splash that fills the frame.
    FOREGROUND: Wine droplets the size of grapes catch candlelight and refract it — each one is a prism.
    MIDGROUND: The liquid crown forms a perfect arch, glowing deep ruby-red and amber at the edges where light passes through.
    The glass itself glows from within.
  `, `
    A dark mahogany bar. Rows of out-of-focus wine bottles create a cathedral of glass bokeh behind the splash.
    Gold candlelight from dozens of unseen candles paints the smoke-filled air.
    The atmosphere is decadent and close — velvet darkness, warm gold, deep red.
  `),

  'korean-fire': layered(`
    Marinated galbi hits a charcoal grill and detonates — a white-hot column of flame shoots straight up.
    FOREGROUND: Glowing charcoal embers and metal tong fragments blur at the lens edge like shrapnel.
    MIDGROUND: The flame tower silhouettes the meat perfectly — the grill grates glow orange-red beneath.
    The fire is the hero. The meat is an excuse for the fire.
  `, `
    A crowded Seoul BBQ alley. Red and blue neon signs paint the smoke-filled air in competing colors.
    The neon reflects off the grill surface, the meat, and the rising smoke column.
    The background is dense urban texture — buildings close, lights competing, everything gritty and alive.
  `),

  'chinese-takeout-wars': layered(`
    A tower of red takeout boxes crashes from height and bursts open in a perfect multi-level detonation.
    FOREGROUND: Lo mein noodles and broccoli florets hang in mid-air like confetti, enormous and soft.
    MIDGROUND: The central box ruptures from within — orange chicken and steam eject in a radial blast.
    Every box explodes at a slightly different moment, creating a cascade of chaos from top to bottom.
  `, `
    A vivid red studio wall — saturated past reality, practically glowing.
    Hard-edged graphic shadows from a single overhead spotlight create deep geometry.
    The aesthetic is pop-art destruction: bold colors, flat background, maximum contrast.
  `),

  'vietnamese-bowl-off': layered(`
    Dark pho broth poured from an impossible height into a deep ceramic bowl — the impact is volcanic.
    FOREGROUND: Back-lit steam clouds billow toward the lens — thick, golden, almost solid.
    MIDGROUND: The broth impact creates a massive wave that climbs the bowl walls and breaks outward.
    Basil leaves and star anise float in the suspended mist like objects in orbit.
  `, `
    A dark, moody interior: textured bamboo walls absorb the light. A single warm amber lamp creates a spotlight effect.
    Steam fills the upper third of the frame in layered, translucent curtains.
    The bowl sits in near-darkness — only the broth and steam catch the light.
  `),

  'greek-taverna-fight': layered(`
    A whole fish slammed onto a blazing outdoor grill — flames leap up and engulf it entirely.
    FOREGROUND: Rosemary sprigs and sea salt crystals tossed through the air catch the firelight like sparks.
    MIDGROUND: The fish disappears momentarily inside a column of intense white-orange flame — the grill grates glow.
    The flame is the scale of a campfire, not a grill.
  `, `
    A saturated Aegean coastal sunset: deep cerulean sea, a blurred white-domed church in extreme bokeh.
    The fire-orange of the grill fights the cool blue of the sea — the color tension is the composition.
    Salt air and smoke blend. The sky is bleeding orange into violet at the horizon.
  `),

  'spanish-tapas-brawl': layered(`
    A razor-thin ribbon of Ibérico ham peels away from the leg in slow motion — it curls and floats.
    FOREGROUND: Bread crumbs and olive oil droplets drift in the foreground air, catching warm torchlight.
    MIDGROUND: The glistening ham ribbon stretches and curls midair — it glows with a deep ruby-amber translucency when backlit.
    The marbling of the fat is visible and luminous.
  `, `
    A dark, dusty bodega. Textured oak barrels stack floor to ceiling in soft focus.
    Orange torchlight flickers and creates dancing shadows on rough stone walls.
    The atmosphere is ancient, warm, and close — shadows everywhere, light only where it matters.
  `),

  'middle-east-mashup': layered(`
    A massive vertical shawarma spit rotates with an internal fire-glow — the meat itself is a lantern.
    FOREGROUND: Pita bread fragments and jets of tahini spray blur in the foreground, enormous.
    MIDGROUND: Ribbons of charred meat fly off the spit as it spins — each ribbon trails steam and fat droplets.
    The spit is the center of a heat vortex. Everything orbits it.
  `, `
    A dark smoky market stall. Hammered copper plates on the walls reflect the fire's glow in fractured patterns.
    Hanging brass lamps create warm pools of amber light that fight the deep shadow.
    The atmosphere is ancient and molten — fire, metal, smoke, and stone.
  `),

  'peruvian-showdown': layered(`
    Acidic tiger milk slams over raw white fish in a high-velocity chemical reaction.
    FOREGROUND: Cilantro leaves and red onion rings drift in a citrus mist, enormous and blurred.
    MIDGROUND: The frothy white liquid impacts the fish and explodes upward — the splash catches the cold industrial light and refracts it.
    The liquid behaves like a chemical reaction: frothy, aggressive, fast.
  `, `
    A cold, hyper-modern kitchen: stainless steel surfaces reflect the scene in cool blue-grey.
    Industrial blue overhead lighting creates sharp, clinical contrast.
    The aesthetic is laboratory-clean — the splash is the only chaos in an otherwise sterile world.
  `),

  'ethiopian-feast': layered(`
    Hands tear a massive piece of spongy injera bread — the tear is the moment.
    FOREGROUND: Flatbread bits and spice droplets hang in the warm air, glowing with ambient light.
    MIDGROUND: The tear opens slowly — the porous, textured interior is revealed, dark red stew clinging to the edges like lava.
    The textures are everything: the foam of the bread, the viscous stew, the rough hands.
  `, `
    A sun-drenched mud-brick wall radiates warm terracotta light behind the scene.
    Woven baskets in deep earth tones create texture in the soft-focus background.
    Everything is tactile — every surface has weight and grain. The light is the color of dried clay.
  `),

  'american-bbq-bracket': layered(`
    A beef brisket shredded by two metal forks — the meat tears in slow motion, revealing everything.
    FOREGROUND: Thick wood smoke billows toward the lens, backlit and volumetric — it glows amber from within.
    MIDGROUND: The meat grain pulls apart in long ropes; fat glistens white; the smoke ring is a vivid deep pink, almost neon.
    The smoke is a character. It fills the frame.
  `, `
    A dark, soot-stained smokehouse. Textured wooden siding absorbs the light and returns only shadow.
    A single shaft of amber light cuts through a gap in the wall, catching the smoke column directly.
    The atmosphere is dense, low, oppressive — the kind of dark that smells like hickory.
  `),

  'dim-sum-derby': layered(`
    A bamboo steamer basket opens — a wall of white vapor detonates upward and outward.
    FOREGROUND: The steamer lid edge blurs in the extreme foreground; wisps of steam curl toward the lens.
    MIDGROUND: Har gow dumplings emerge through the fog — their translucent skins glow with a warm yellow light from below.
    The dumplings are lit from within. The steam is a soft white universe around them.
  `, `
    A warm Chinese restaurant interior: red lanterns in the background create dozens of glowing bokeh orbs.
    The steam completely obscures the background — the lanterns become abstract red halos in white fog.
    The atmosphere is soft, warm, dense — like being inside a cloud of delicious heat.
  `),

  'caribbean-clash': layered(`
    A heavy cleaver descends mid-impact through charred jerk chicken — the impact is the explosion.
    FOREGROUND: Herb fragments and droplets of dark marinade fly toward the lens in chaotic soft-focus.
    MIDGROUND: The blade splits the meat; a geyser of steam erupts from the hot interior — it catches the purple-orange sky light.
    The violence of the cut is cinematic, slow-motion, inevitable.
  `, `
    A vivid tropical sunset sky: deep purple bleeding into burnt orange at the horizon.
    Blurred palm fronds frame the top of the shot in silhouette.
    The color palette is lush and saturated — everything is pushed toward the surreal tropics.
  `),

  // ── Seasonal Pool: THE ELEMENTS (Layered Environments) ────────────────────

  'summer-grill-masters': layered(`
    A burger patty slams onto a screaming-hot grill — the impact creates a burst of yellow-white flame that fills the frame.
    FOREGROUND: Sesame seeds and droplets of melting cheddar float toward the lens, catching the harsh summer sun.
    MIDGROUND: The flame engulfs the patty entirely — the beef barely visible inside the fire, just its silhouette.
    The grill grates glow orange-red from residual heat.
  `, `
    A blindingly saturated blue summer sky overhead — so blue it's almost unreal.
    A backyard fence in extreme soft focus, drenched in warm afternoon light.
    The sun hits the foreground grease and seeds directly, creating lens flare and haze.
  `),

  'summer-salad-slam': layered(`
    A watermelon dropped from above strikes a white surface and detonates — a full radial explosion of pink and red.
    FOREGROUND: Black seeds and a mist of red juice spray outward in every direction, enormous in the foreground.
    MIDGROUND: Large melon chunks fly in a perfect radial arc — the pattern is graphic, almost mathematical.
    The juice moves like paint. The seeds move like buckshot.
  `, `
    A brilliant white studio — so white it bleeds into overexposure at the edges.
    A single hard overhead spotlight creates a perfect circle of shadow around the impact zone.
    The aesthetic is graphic and clean: the watermelon's crimson against white is the entire palette.
  `),

  'fall-harvest-bowl': layered(`
    Roasted butternut squash sits at the center, thick maple glaze dripping down the sides like slow lava.
    FOREGROUND: Cinnamon sticks and dried orange leaves drift in the cool air, edges catching a warm amber glow.
    MIDGROUND: The squash glows with amber internal light — the glaze surface is mirror-slick, reflecting the candle below.
    Steam rises in a tall column and disperses against the cold window.
  `, `
    A dark rainy window dominates the background — cold blue-grey light from outside fights the warm interior amber.
    Orange and crimson leaf bokeh floats in the mid-background, enormous and soft.
    The textured wooden surface beneath the squash is dark and wet with steam condensation.
    The color palette is moody: deep shadow, amber light, cold blue periphery.
  `),

  'fall-soup-wars': layered(`
    Pumpkin soup at a violent rolling boil in a massive copper pot — the boil is aggressive, apocalyptic.
    FOREGROUND: Orange soup droplets splash upward toward the lens — enormous, amber-lit, soft.
    MIDGROUND: A massive bubble pops at the surface; a wooden spoon is mid-churn, coated in vivid orange.
    The pot surface gleams like hammered gold. The soup is the color of a sunset.
  `, `
    A rustic kitchen with exposed brick walls that glow amber in the firelight.
    Copper pans hanging in the background create a wall of warm reflective bokeh.
    The atmosphere is heavy with steam — the upper frame disappears into warm white haze.
  `),

  'winter-warmers': layered(`
    A bowl of beef stew sits on a frost-covered stone windowsill — fire meets ice.
    FOREGROUND: Frost crystals and rising steam exist simultaneously in the foreground, one cold and sharp, one hot and soft.
    MIDGROUND: The dark stew glows with an intense internal orange warmth — it is a furnace contained in ceramic.
    The surface of the stew ripples as if breathing.
  `, `
    A cold blue-white blizzard rages outside the window — snowflakes streak horizontally in the extreme background.
    The window glass itself frosts at the edges.
    The contrast is the entire image: the burning amber bowl against the white-blue cold. Fire and ice.
  `),

  'holiday-feast-bracket': layered(`
    A roasted turkey is carved by a silver knife — a single perfect slice peels away in slow motion.
    FOREGROUND: Rosemary sprigs and droplets of golden jus float in the candlelit air, enormous and glowing.
    MIDGROUND: The slice separates — the meat is impossibly juicy and textured, steaming and glistening under the candle's light.
    The jus pools on the dark slate surface below in a perfect mirror.
  `, `
    A mahogany dining table set with hundreds of flickering candles — the background is a sea of warm amber bokeh orbs.
    The candlelight is the only light source: it comes from below and sides, not above.
    The atmosphere is opulent and warm — deep wood, gold light, velvet shadow.
  `),

  'spring-garden-fresh': layered(`
    Vibrant radishes are yanked from wet, dark soil — the pull is a burst of earth and color.
    FOREGROUND: Mud particles and water droplets explode from the soil in a cloud, backlit by spring sunlight.
    MIDGROUND: The bright pink radishes arc through the air, contrasting violently against the dark wet earth below.
    Roots and soil trail behind each radish like comet tails.
  `, `
    A lush spring garden in soft, overexposed morning light — everything slightly too bright and too green.
    Large textured leaves fill the background in deep focus-blur, their greens saturated to near-abstraction.
    The soil in the foreground is dark and rich — the contrast with the radishes and bright sky is extreme.
  `),

  'spring-brunch-battle': layered(`
    Thick, golden Hollandaise sauce poured from above lands on a poached egg — a viscous, slow-motion impact.
    FOREGROUND: Chive fragments and wisps of steam curl toward the lens, catching the bright morning window light.
    MIDGROUND: The yellow sauce hits the egg and spreads in slow motion — its surface shimmers like liquid gold.
    The egg beneath glows softly, the yolk a deep amber visible through the white.
  `, `
    A bright, over-exposed breakfast nook — morning sun streams through white curtains and blows the highlights.
    The entire background is high-key white with soft, diffused spring light.
    The only color is the saturated yellow of the sauce and the warm pink of the egg against pure white.
  `),

  'game-day-grub': layered(`
    A sauced chicken wing plunges into a bowl of ranch dressing — the impact creates a massive white crown splash.
    FOREGROUND: Celery sticks and orange hot sauce droplets fly outward in the extreme foreground, enormous.
    MIDGROUND: The splash crown is perfect, enormous, and symmetrical — it catches the stadium floodlights overhead.
    Ranch dressing moves like a wave. The sauce trails behind the wing like a comet.
  `, `
    Stadium energy in the background: blurred green turf and blazing white floodlights create a sports-arena bokeh.
    The crowd is an abstract blur of color — red, orange, team colors — behind the action.
    The lighting is harsh and directional from above, like being under stadium floods.
  `),

  'valentines-dinner': layered(`
    A chocolate lava cake is sliced open — the molten center erupts in a slow, inevitable flow.
    FOREGROUND: Whole red raspberries and a cloud of cocoa powder bloom toward the lens, enormous and soft.
    MIDGROUND: The dark chocolate flows from the cut in a thick, glistening stream — it catches the candlelight and glows deep amber-brown.
    The flow moves like hot magma. The cake crumb is dramatic and textured.
  `, `
    Deep crimson velvet curtains fill the background — saturated, plush, consuming the light.
    Candlelight from dozens of unseen candles creates a warm amber glow that catches the chocolate's sheen.
    The atmosphere is intimate and overheated — dark red, warm gold, the kind of dark that is deliberate.
  `),

  'thanksgiving-sides': layered(`
    Thick, glossy gravy pours like a mudslide over a mountain of mashed potatoes — an avalanche of brown over white.
    FOREGROUND: Sage leaves and wisps of steam drift in the foreground air, amber-lit.
    MIDGROUND: The gravy cascades in sheets down the textured potato surface — the surface deforms under the weight of the pour.
    The gravy is mirror-slick at the top and textured where it runs.
  `, `
    A warm wooden harvest table: dried corn husks and heirloom pumpkins in soft focus behind the hero.
    Candlelight from below creates a warm amber glow on the steam and gravy sheen.
    The atmosphere is autumnal and dense — the light is the color of fallen leaves.
  `),

  'summer-dessert-duel': layered(`
    Gelato scoops melt dramatically on a sun-baked stone ledge — the drips are the action.
    FOREGROUND: Waffle cone shards and fresh mint leaves catch direct sunlight, glinting and golden.
    MIDGROUND: Vivid drips of pink strawberry and green pistachio gelato run down the white-hot stone in competing streams.
    The colors bleed into each other where they meet — a slow-motion collision.
  `, `
    A bleached Italian piazza: white stone architecture dissolves into overexposure at the edges.
    The sun hits at a direct, near-vertical angle — shadows are short and deep.
    The gelato's pastel pinks and greens punch against the sun-bleached stone with maximum contrast.
    The background shimmers with heat distortion.
  `),

  'cold-weather-stews': layered(`
    A dark iron Dutch oven dominates the frame — a piece of crusty bread dunked in the stew creates a dark ripple.
    FOREGROUND: Peppercorns and steam wisps blur at the lens, enormous.
    MIDGROUND: The dark stew moves in slow motion — the bread sinks in and the surface reforms around it.
    The stew surface catches the single cabin light and glows deep amber-brown.
  `, `
    A dark wood cabin interior: rough-hewn timber walls absorb all light.
    A blizzard rages outside the single small window — blue-white cold light cuts in from the side.
    The fire's glow from off-frame warms the near side of the pot. Blue cold, amber warmth — the contrast is the composition.
  `),

  'spring-detox-bracket': layered(`
    A high-speed blender lid blows off under pressure — a column of green smoothie erupts straight up.
    FOREGROUND: Spinning spinach leaves and ice shards fly toward the lens, green and silver.
    MIDGROUND: The vertical smoothie column is massive — it extends past the top of the frame, impossibly tall.
    The ice shards catch the studio's hard white light and scatter it like a chandelier.
  `, `
    A hyper-modern white marble kitchen: clean lines, sharp edges, everything clinical and spotless.
    The single overhead light is hard and directional — it makes the green smoothie column glow like neon.
    The green against white marble is electric. The mess is the only imperfection in an otherwise sterile world.
  `),

  'tailgate-titans': layered(`
    A bratwurst splits open on a screaming-hot grill — the casing cracks and the interior erupts.
    FOREGROUND: Beer foam and mustard splatters the foreground with warm gold, enormous and blurred.
    MIDGROUND: Grease sparks and steam blast from the crack simultaneously — the spark burst is the scale of fireworks.
    The grill grates glow orange-red. The brat skin is charred black and split wide.
  `, `
    A tailgate parking lot at golden hour: the setting sun directly behind the scene creates a silhouette haze.
    Car headlights in the deep background bloom into enormous gold bokeh circles.
    Smoke from other grills fills the upper frame. The light is honey-gold and cinematic.
  `),

  'new-year-fresh-start': layered(`
    A lemon squeezed directly over a textured grain bowl — the juice catches a sharp white key light mid-fall.
    FOREGROUND: Lemon zest curls and bright juice droplets drift in the sparkle-filled air, catching light.
    MIDGROUND: The juice column falls in a perfect arc, refracting the studio light into a miniature rainbow.
    The grain bowl beneath shimmers with green herbs and colorful toppings.
  `, `
    A bright silver-and-white studio: every surface reflects the key light back.
    Confetti and glitter in the background bokeh creates a field of multicolored sparkle.
    The atmosphere is crisp, fresh, and celebratory — clean white shot through with silver and gold light.
  `),

  // ── Wild Card Pool: THE ARENA (Graphic Depth) ─────────────────────────────

  'breakfast-all-day': layered(`
    Maple syrup pours from an impossible height onto a skyscraper-stack of pancakes — it hits and explodes.
    FOREGROUND: Butter pats and steam drift in the foreground, enormous, backlit by the diner's warm yellow glow.
    MIDGROUND: The syrup impact creates a wide amber crown splash on the top pancake — the pancake stack tilts slightly under the force.
    The syrup itself glows — warm amber, translucent, catching the hard overhead light.
  `, `
    A flat, hyper-saturated diner yellow wall: so yellow it's almost neon, like a graphic design element.
    A single hard overhead spotlight creates a perfect circle of shadow around the stack.
    The shadows are sharp, deep, and graphic — this is pop-art breakfast. Flat background, maximum contrast.
  `),

  'sandwich-supremacy': layered(`
    A massive club sandwich is pulled apart in slow motion — the layers stretch and separate simultaneously.
    FOREGROUND: Toothpicks and lettuce fragments drift in the extreme foreground, blurred and enormous.
    MIDGROUND: Layers of turkey, bacon, and melted cheese stretch and pull — each layer tears at a different speed.
    Bread crumbs and seed fragments scatter like a slow-motion demolition.
  `, `
    A deep hunter-green studio wall — saturated and matte, like a jewel tone.
    A single hard spotlight hits the sandwich from above at a sharp angle.
    The shadows are long and dramatic across the dark green surface. The aesthetic is bold and editorial.
  `),

  'pasta-wars': layered(`
    Spaghetti boils over a stainless steel pot in a violent, unstoppable surge.
    FOREGROUND: Pasta strands and starchy water droplets the size of marbles fly toward the lens.
    MIDGROUND: White starchy foam surges violently over the rim in a waterfall — the pot is losing the battle.
    The pasta inside the foam glows with the residual heat — steam blurs the top third of the frame.
  `, `
    A high-contrast black and white checkered floor in the background — the graphic geometry of the pattern bleeds into bokeh.
    Overhead fluorescent kitchen light is harsh and unforgiving. The stainless steel surfaces reflect everything in cold silver.
    The aesthetic is restaurant-kitchen realism pushed to extremes: the mundane made cinematic.
  `),

  'soup-showdown': layered(`
    Four ladles of different colored soup collide mid-air at a single point — a fluid supernova.
    FOREGROUND: Out-of-focus fluid droplets of orange, green, red, and cream float in every direction.
    MIDGROUND: The four streams meet at the center in a swirling collision — the colors bleed into each other at the point of impact.
    The collision creates a splash that is half abstract painting, half food disaster.
  `, `
    A neutral slate-grey studio wall — professional and clean, designed to disappear behind the color of the soup.
    The light is a soft, diffused studio key — it lets the soup's colors be the only palette.
    The grey surface beneath reflects the four colors back up into the scene.
  `),

  'pizza-bracket': layered(`
    A pizza slice pull reveals an impossibly long cheese stretch — the mozzarella is a glowing gold cable.
    FOREGROUND: Pepperoni slices and flour dust float in the foreground, catching the oven's orange glow.
    MIDGROUND: The cheese is taut and perfect — it catches the backlighting from the stone oven and glows gold.
    The stretch extends so far it begins to leave the frame at the top.
  `, `
    A blazing stone oven interior fills the background — the fire inside is the primary light source.
    Deep orange-red heat radiates from the oven opening, lighting the scene from the back and below.
    The foreground is in near-shadow; the cheese catch-light is the only highlight. Monochromatic orange depth.
  `),

  'taco-tuesday-forever': layered(`
    Three tacos stand in silhouette against a massive, violent desert sun — they are monuments.
    FOREGROUND: Blurred cactus needles and wind-driven sand dust streak across the extreme foreground.
    MIDGROUND: The taco edges glow with a rim-light halo from the sun behind them — steam rises in rays like solar flares.
    The tacos are backlit to pure black silhouette. Only the light around them is visible.
  `, `
    A sky that bleeds from deep burnt orange at the horizon to dark violet at the top — no middle ground.
    The desert floor is dark silhouette. The sun is enormous and directly centered.
    The scale is epic: the tacos look like standing stones against a Martian sunset.
  `),

  'noodle-bowl-bracket': layered(`
    A dark steel blade slices through a soft-boiled ramen egg at perfect speed — the cut is surgical.
    FOREGROUND: Green onion rings and nori fragments drift in the foreground, enormous, caught in the steam.
    MIDGROUND: The egg opens — golden yolk flows slowly from the perfect cut into the dark broth below.
    The yolk is luminous: warm amber, catching the single overhead light, moving like lava.
  `, `
    A dark, minimalist Japanese interior: horizontal wood-panel walls create precise geometric lines.
    A single narrow band of warm light comes from directly above — everything else is shadow.
    The broth beneath is so dark it is almost black. The golden yolk is the only warm element. Zen noir.
  `),

  'seafood-smackdown': layered(`
    A lobster claw is struck by a heavy iron hammer — the shell shatters on impact.
    FOREGROUND: Shell fragments and ice shards fly toward the lens in slow motion, enormous and translucent.
    MIDGROUND: Brine droplets fly from the impact like shattered liquid crystal — the white meat inside the claw is revealed mid-destruction.
    The hammer is still moving. The destruction is captured at peak chaos.
  `, `
    A cold, saturated ocean-teal studio wall — the color of deep seawater.
    The light is cool and directional, coming from a low side angle like light through water.
    Ice and shell fragments on the surface catch the teal ambient light and glow blue-white.
  `),

  'salad-that-slaps': layered(`
    A kale salad takes a direct hit from a high-pressure dressing blast — the leaves become a green explosion.
    FOREGROUND: Parmesan flakes and dressing droplets the size of marbles spray toward the lens, neon-bright.
    MIDGROUND: The green leaves are launched violently in every direction — mid-air, they catch the neon spotlight and glow.
    The dressing blast is so forceful it flattens the salad at the center. This is a food crime.
  `, `
    A neon-lime-green wall — so saturated it's almost radioactive, glowing from within.
    A single hard spotlight hits the salad from directly above, creating a bright center and sharp drop shadow.
    The ambient green from the wall tints everything slightly: the dressing glows green-white, the parmesan glows lime.
  `),

  'bowl-food-bracket': layered(`
    A poke bowl shot from directly above — the composition is a perfect top-down spiral.
    FOREGROUND: Sesame seeds and droplets of spicy mayo drift above the bowl in the micro-foreground, catching overhead light.
    MIDGROUND: A spiral of sauce is applied in real-time — the bright orange mayo traces a perfect arc over vivid fish, mango, and edamame.
    The bowl is a clock face: every ingredient has its sector, every color is deliberate.
  `, `
    A clean bamboo mat with deeply textured wood grain — the surface pattern is visible and beautiful.
    The light is a pure top-down studio softbox — no shadows at the edges, maximum color saturation.
    The color palette of the bowl is the entire composition. The background is negative space.
  `),

  'street-food-world-tour': layered(`
    Multiple food items — samosas, skewers, bao — levitate in a neon haze simultaneously.
    FOREGROUND: Steam swirls and out-of-focus street lights blur into abstract neon streaks.
    MIDGROUND: Each food item floats at a different height, surrounded by its own aura of steam and light.
    The foods glow from within — each one is lit like a lantern.
  `, `
    A night market kaleidoscope in deep background blur: every stall a smear of warm orange, teal neon, and red lantern.
    The ground is wet and reflective — every light source doubles in the puddles below.
    The atmosphere is dream-state: the market is real but the food floats free from gravity. Dreamy neon surrealism.
  `),

  'one-pan-wonder': layered(`
    A Spanish tortilla launches mid-flip above a cast-iron pan — it is a golden flying disc.
    FOREGROUND: Thin potato chip shards and oil droplets spin off the tortilla edge into the foreground blur.
    MIDGROUND: The golden tortilla arcs through the air in perfect rotation — its surface catches the kitchen light evenly, glowing amber.
    The pan below is still rocking from the force of the flip.
  `, `
    A dark charcoal-grey plaster wall: rough, textured, absorbing all ambient light.
    A single overhead pendant lamp creates a tight spotlight — everything outside its circle is dark.
    The tortilla is the only warm element in a cool, minimal world. Minimalist action.
  `),

  'date-night-bracket': layered(`
    A thick steak sliced open to reveal a perfect medium-rare interior — the cut is the reveal.
    FOREGROUND: The rim of a wine glass blurs at the foreground edge; sea salt crystals drift in the amber light.
    MIDGROUND: Deep red juices pool dramatically on a dark, textured slate plate — the surface of the meat is still sizzling.
    The pink-red of the meat against the dark slate is luminous.
  `, `
    A dark mahogany bar with warm amber candlelight creating perfect bokeh orbs in the background.
    The light comes from low candles — it hits the meat and juices from the side, creating dramatic shadow and sheen.
    The atmosphere is intimate and cinematic: two-person dark, expensive, intentional.
  `),

  // ── Dessert Pool: THE FINISHERS (Layered Sweetness) ───────────────────────

  'dessert-knockout': layered(`
    A pink layer cake is struck by an invisible kinetic shockwave — it detonates outward in all directions.
    FOREGROUND: Sprinkles and frosting crumbs the size of golf balls fly toward the lens — a candy blizzard.
    MIDGROUND: The cake layers erupt outward simultaneously — each layer a different color, the frosting between them trailing in sheets.
    The destruction is beautiful and maximalist. The cake is gone. Only the explosion remains.
  `, `
    A hot-pink-to-deep-purple gradient wall — neon pink at the bottom, violet at the top, no hard line between them.
    The wall itself seems to glow. Hard studio lights from two sides create competing pink shadows.
    Sprinkles on the floor beneath the explosion catch the neon light and glitter.
    This is candy-colored chaos. Maximalist, garish, deliberately over the top.
  `),

  'chocolate-championship': layered(`
    A tsunami of molten dark chocolate crashes over a field of truffles — the wave is enormous.
    FOREGROUND: Cocoa powder and chocolate shavings blow toward the lens in a dark cloud, backlit by the silver rim light.
    MIDGROUND: The glossy chocolate wave crests and crashes — its surface is mirror-perfect, reflecting the silver rim light.
    The wave scale is impossible. It is a chocolate ocean.
  `, `
    A matte black wall — the darkest possible surface, swallowing all ambient light.
    A single cold silver rim light from behind cuts the chocolate wave into a crescent of brilliance.
    The palette is binary: matte black and glossy dark chocolate, with a single silver slash of light.
    Dark matte elegance pushed to surreal scale.
  `),

  'cake-bake-off': layered(`
    A palette knife drags through thick frosting — the strokes are architectural, building ridges and valleys.
    FOREGROUND: Flour dust and sugar crystals drift in the soft mint-green light, delicate and glinting.
    MIDGROUND: The knife creates deep, dramatic ridges — the frosting texture is extreme and beautiful, almost sculptural.
    The frosting colors swirl at the knife's edge: vanilla cream bleeding into blush pink.
  `, `
    A soft, dreamy mint-green studio wall — the color of a vintage patisserie, hazy and romantic.
    The light is a wide, diffused softbox from above-right: zero harsh shadows, all texture and softness.
    Pastel pink and cream frosting against mint green — the palette is gentle and deliberate.
    This is soft-serve aesthetics: airy, delicate, and tactile.
  `),

  'ice-cream-invitational': layered(`
    A melting gelato scoop collapses in real-time on sun-drenched pink marble — entropy is the subject.
    FOREGROUND: Waffle cone shards and sugar granules catch direct sun and glint like glass chips.
    MIDGROUND: Vivid gelato drips run in competing streams — strawberry pink, pistachio green — down the warm marble surface.
    The gelato is at peak melt: the scoop still holds its shape at top but dissolves at the base.
  `, `
    A hazy, overexposed beach atmosphere: the background is a white-gold sun flare that obliterates detail.
    A blurred beach umbrella in deep background creates a single circle of color in the haze.
    The pink marble catches direct sun and glows warm rose.
    Everything is over-lit and beautiful — the aesthetic of a very expensive summer afternoon.
  `),

  'cookie-clash': layered(`
    A thick chocolate chip cookie is snapped in half with sudden force — the break is the moment.
    FOREGROUND: Cookie crumbs and flaky salt fragments explode toward the lens, enormous and golden-lit.
    MIDGROUND: Between the two halves, a thick bridge of molten chocolate stretches — it glows warm amber from within.
    The chocolate bridge is the hero: luminous, viscous, impossibly long.
  `, `
    A dark wooden kitchen with deep shadows in every corner.
    The only light source is a warm amber oven glow from off-frame left — it lights the cookie and chocolate from one side.
    The chocolate catch-light is the brightest spot in the image. Everything else is warm dark shadow.
    Toasty, intimate, and textured — the kind of dark that feels like 10pm on a rainy night.
  `),

  'pie-playoffs': layered(`
    A slice of cherry pie lifts from the dish — thick ruby filling flows from the cut in sheets.
    FOREGROUND: Flaky crust shards and pie crumbs drift in the warm sunlit air of the foreground.
    MIDGROUND: The filling flows from the cut edge in a thick, glossy cascade — it is almost liquid, deep ruby-red.
    The lattice crust above catches the afternoon sun and glows golden.
  `, `
    A rustic sun-lit wooden porch on a summer afternoon.
    Dappled green leaf bokeh in the background creates organic, overlapping circles of light.
    The warm afternoon sun hits directly — golden hour light on flaky crust and glistening filling.
    The aesthetic is Americana warmth: warm, nostalgic, saturated, and honest.
  `),

  'pastry-smackdown': layered(`
    A warm croissant is torn apart by hand — the laminated layers stretch and separate simultaneously.
    FOREGROUND: Golden flaky shards and wisps of steam drift toward the lens in the soft bakery light.
    MIDGROUND: The interior layers reveal themselves: dozens of translucent, butter-soaked sheets stretching and tearing.
    Steam pours from the interior — the croissant is still oven-hot. The butter is still liquid inside.
  `, `
    A bright, airy white-tile bakery interior: white subway tile walls and soft diffused morning light.
    The light is a wide east-facing window: cool and white, flooding the scene without shadows.
    The croissant's golden exterior against the pure white bakery environment is the color story.
    Everything is clean, fresh, and high-key — the aesthetic of 7am, the first croissant of the day.
  `),
}
