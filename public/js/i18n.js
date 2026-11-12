/* global window, document, localStorage, location */
/**
 * Montreal guest copy is French first. A flag control switches that park to English.
 * New Hampshire stays English and does not show the control.
 * Station stories stay in the database in English; this map overlays French at display time.
 */
const Lang = (() => {
  const KEY = 'ic.lang.mtl';
  const RESERVED = new Set(['admin', 'api', 'assets', 'vendor', 'js', 's', 'healthz', 'maps', 'recordings']);
  const SKIP = new Set([
    'id', 'slug', 'type', 'element', 'challengeType', 'url', 'imageUrl', 'audioUrl',
    'discoverAudioUrl', 'poiId', 'code', 'correct', 'correctIds', 'kind', 'color', 'hex',
    'symbol', 'number', 'path', 'marker', 'scanCode', 'fits', 'selectCount', 'length',
    'correctIndex', 'sortOrder', 'complete', 'published', 'x', 'y',
  ]);

  const FR = {
    Language: 'Langue',
    Loading: 'Chargement',
    'Back to Castle Quest start': 'Retour au début de Castle Quest',
    'View my journey': 'Voir mon parcours',
    Guardians: 'Gardiens',
    'Open map': 'Ouvrir la carte',
    'Castle Quest station': 'Station de Castle Quest',
    'Park map': 'Carte du parc',
    'Fit the whole park on screen': 'Voir tout le parc',
    'Show Guardian stops only': 'Afficher seulement les Gardiens',
    'Filter what the map shows': 'Filtrer la carte',
    'Filter map': 'Filtrer la carte',
    'Close filters': 'Fermer les filtres',
    Done: 'Terminé',
    'All categories on': 'Toutes les catégories',
    'Marker details': 'Détails du repère',
    'Collapse details': 'Réduire les détails',
    'Scan a map code': 'Scanner un code',
    'Back to Castle Quest': 'Retour à Castle Quest',
    Quest: 'Quête',
    'My Journey': 'Mon parcours',
    'Close My Journey': 'Fermer mon parcours',
    Passport: 'Passeport',
    'Close Passport': 'Fermer le passeport',
    'The five Guardians. Tap one for a castle fact.': 'Les cinq Gardiens. Touchez-en un pour un fait sur le château.',
    'Cascade, Water Guardian': 'Cascade, Gardien de l’Eau',
    'Granite, Earth Guardian': 'Granite, Gardien de la Terre',
    'Ember, Fire Guardian': 'Ember, Gardien du Feu',
    'Summit, Air Guardian': 'Summit, Gardien de l’Air',
    'Aurora, Spirit Guardian': 'Aurora, Gardienne de l’Esprit',
    Water: 'Eau',
    Earth: 'Terre',
    Fire: 'Feu',
    Air: 'Air',
    Spirit: 'Esprit',
    'Awaken the five elements': 'Éveillez les cinq éléments',
    'Your quest has begun. Five elements await.': 'Votre quête commence. Cinq éléments vous attendent.',
    'One element awakened. Four remain.': 'Un élément est éveillé. Il en reste quatre.',
    'Two elements awakened. Keep exploring.': 'Deux éléments sont éveillés. Continuez d’explorer.',
    'More than halfway. Two elements remain.': 'Plus de la moitié. Il reste deux éléments.',
    'One Guardian remains. Awaken the final element.': 'Il reste un Gardien. Éveillez le dernier élément.',
    'All five elements are awake. Visit the Winter Keeper Throne to confirm your quest is complete.': 'Les cinq éléments sont éveillés. Rendez-vous au Trône du Gardien de l’hiver pour confirmer votre quête.',
    'Find the Guardians. Complete their trials. Gather at the Winter Keeper Throne.': 'Trouvez les Gardiens. Relevez leurs épreuves. Rassemblez-vous au Trône du Gardien de l’hiver.',
    'Party size': 'Taille du groupe',
    'How many?': 'Combien?',
    'Enter your party size to continue.': 'Indiquez la taille de votre groupe pour continuer.',
    'Enter a party size from 1 to 20.': 'Indiquez un groupe de 1 à 20 personnes.',
    'Begin Quest': 'Commencer la quête',
    Map: 'Carte',
    'Enter the quest': 'Entrer dans la quête',
    'Your quest begins here.': 'Votre quête commence ici.',
    'Back to welcome': 'Retour à l’accueil',
    'Five Guardians wait among the ice. Awaken Water, Earth, Fire, Air, and Spirit in any order, then scan the Winter Keeper Throne to become a Winter Keeper.': 'Cinq Gardiens vous attendent dans la glace. Éveillez l’Eau, la Terre, le Feu, l’Air et l’Esprit dans n’importe quel ordre, puis scannez le Trône du Gardien de l’hiver pour devenir Gardien de l’hiver.',
    'The Story of Castle Quest': 'L’histoire de Castle Quest',
    'How it works': 'Comment ça marche',
    'Any order. Unlimited tries.': 'Dans n’importe quel ordre. Autant d’essais que vous voulez.',
    'Find each Guardian and complete their challenge.': 'Trouvez chaque Gardien et relevez son défi.',
    'After all five elements are awake, scan the Winter Keeper Throne.': 'Quand les cinq éléments sont éveillés, scannez le Trône du Gardien de l’hiver.',
    'Show your completion screen at the Gift Shop for your medallion.': 'Présentez votre écran de fin à la boutique pour recevoir votre médaillon.',
    Continue: 'Continuer',
    Close: 'Fermer',
    'Castle Quest is a winter adventure: discover how five elements—Water, Earth, Fire, Air, and Spirit—help bring an Ice Castle to life.': 'Castle Quest est une aventure d’hiver : découvrez comment cinq éléments — l’Eau, la Terre, le Feu, l’Air et l’Esprit — donnent vie à un château de glace.',
    'Five Guardians guide the quest. Each watches over an element and offers a challenge to awaken it.': 'Cinq Gardiens guident la quête. Chacun veille sur un élément et propose un défi pour l’éveiller.',
    'Cascade notices water’s smallest wonders': 'Cascade remarque les plus petites merveilles de l’eau',
    'Granite remembers the ground beneath the ice': 'Granite se souvient du sol sous la glace',
    'Ember finds balance in cold and light': 'Ember trouve l’équilibre entre le froid et la lumière',
    'Summit follows the wind': 'Summit suit le vent',
    'Aurora gathers the memories people carry away.': 'Aurora recueille les souvenirs que les gens emportent.',
    'Guests awaken the five elements in any order with help from their Guardians, then visit the Winter Keeper Throne to confirm the quest is complete.': 'Les visiteurs éveillent les cinq éléments dans n’importe quel ordre, avec l’aide de leurs Gardiens, puis se rendent au Trône du Gardien de l’hiver pour confirmer que la quête est terminée.',
    'Winter Keeper recognition': 'Reconnaissance du Gardien de l’hiver',
    'Scan a code': 'Scanner un code',
    'Point your camera at a code on the trail': 'Pointez la caméra vers un code sur le sentier',
    'Point your camera at a station or map code': 'Pointez la caméra vers un code de station ou de carte',
    'Or type the code printed under it': 'Ou entrez le code imprimé en dessous',
    Go: 'Aller',
    'Close scanner': 'Fermer le scanneur',
    'Element Awakened': 'Élément éveillé',
    'Keep exploring': 'Continuer l’exploration',
    'Growing the ice…': 'La glace pousse…',
    'Ice Castles — Castle Quest': 'Ice Castles — Castle Quest',
    'Explore the castle, awaken five elements, and become a Winter Keeper.': 'Explorez le château, éveillez cinq éléments et devenez Gardien de l’hiver.',
    'Can’t reach Castle Quest': 'Impossible de joindre Castle Quest',
    'Check your connection and reload.': 'Vérifiez votre connexion et rechargez.',
    'Couldn’t start just yet. Try again in a moment.': 'Impossible de commencer pour l’instant. Réessayez dans un moment.',
    'This station isn’t on tonight’s quest.': 'Cette station n’est pas à la quête de ce soir.',
    'Meet the Guardian': 'Rencontrer le Gardien',
    'Meet the First Builder': 'Rencontrer le premier bâtisseur',
    'The Winter Keeper Throne': 'Le Trône du Gardien de l’hiver',
    'Meet {name}': 'Rencontrer {name}',
    'Discover the Element': 'Découvrir l’élément',
    'How Ice Castles Grow': 'Comment grandit un château de glace',
    Discover: 'Découvrir',
    Meet: 'Rencontrer',
    Play: 'Jouer',
    'Play the challenge': 'Jouer le défi',
    'Look around this shrine. The castle keeps its own clues.': 'Regardez autour de ce sanctuaire. Le château garde ses propres indices.',
    'You finished the builder quiz. This stop is optional.': 'Vous avez terminé le quiz des bâtisseurs. Cet arrêt est facultatif.',
    'Play this story': 'Écouter ce récit',
    'Stop the recording': 'Arrêter l’enregistrement',
    Listen: 'Écouter',
    Stop: 'Arrêter',
    'Couldn’t play that recording.': 'Impossible de lire cet enregistrement.',
    'This element is awake. Find the others, then scan the Winter Keeper Throne.': 'Cet élément est éveillé. Trouvez les autres, puis scannez le Trône du Gardien de l’hiver.',
    'Loading your Spirit challenge…': 'Chargement de votre défi de l’Esprit…',
    'This station serves one party at a time.': 'Cette station accueille un groupe à la fois.',
    'Get my button sequence': 'Obtenir ma séquence de boutons',
    'Press the buttons, watch the lanterns, then enter what you saw.': 'Appuyez sur les boutons, regardez les lanternes, puis entrez ce que vous avez vu.',
    'Buttons to press': 'Boutons à presser',
    'Wait for Ready, then press these buttons in order.': 'Attendez le voyant Prêt, puis appuyez sur ces boutons dans l’ordre.',
    'Watch the lanterns.': 'Regardez les lanternes.',
    'Tap the lantern colors you saw, in order.': 'Touchez les couleurs de lanternes que vous avez vues, dans l’ordre.',
    'Entered lantern colors': 'Couleurs de lanternes entrées',
    'No colors yet': 'Aucune couleur pour l’instant',
    'Chosen lanterns': 'Lanternes choisies',
    'Tap the sequence': 'Touchez la séquence',
    WORD: 'MOT',
    '0 of {need} selected': '0 sur {need}',
    '{count} of {need} selected': '{count} sur {need}',
    'Check my three': 'Vérifier mes trois',
    'Drag a piece onto the rune, or tap to select it and tap the rune to place it. Keyboard: select a piece, then press Enter or Space on the rune.': 'Glissez une pièce sur la rune, ou touchez-la pour la choisir, puis touchez la rune pour la poser. Clavier : choisissez une pièce, puis Entrée ou Espace sur la rune.',
    'No piece selected.': 'Aucune pièce sélectionnée.',
    'Air rune drop target. Activate to place the selected piece.': 'Cible de la rune d’air. Activez pour poser la pièce choisie.',
    'Drag or tap the five pieces here': 'Glissez ou touchez les cinq pièces ici',
    'Try again': 'Réessayer',
    'Skip the quiz': 'Passer le quiz',
    'This challenge could not load. Refresh the page and try again.': 'Ce défi n’a pas pu se charger. Actualisez la page et réessayez.',
    Refresh: 'Actualiser',
    'Correct answer: {letter}. {answer}': 'Bonne réponse : {letter}. {answer}',
    'Finish quiz': 'Terminer le quiz',
    'Next question': 'Question suivante',
    'The quiz is optional. It does not change your quest.': 'Le quiz est facultatif. Il ne change pas votre quête.',
    '{piece} does not fit.': '{piece} ne va pas ici.',
    '{piece} selected. Activate the rune to place it.': '{piece} est choisie. Activez la rune pour la poser.',
    Piece: 'Pièce',
    '{placed} of {need} pieces placed.': '{placed} sur {need} pièces placées.',
    'These shapes have not found each other yet.': 'Ces formes ne se sont pas encore trouvées.',
    'Could not reach the park. Your rune is still assembled — try again when you have signal.': 'Impossible de joindre le parc. Votre rune est encore assemblée — réessayez quand vous aurez du signal.',
    'Not quite — try again.': 'Pas tout à fait — réessayez.',
    'That word isn’t right. Try again.': 'Ce n’est pas le bon mot. Réessayez.',
    'Not those three — look again at the ice.': 'Pas ces trois-là — regardez encore la glace.',
    'Not that order. Watch once more.': 'Pas cet ordre. Regardez encore une fois.',
    'Get your button sequence first, then try again.': 'Obtenez d’abord votre séquence de boutons, puis réessayez.',
    'Could not reach the park. Check your signal and try again.': 'Impossible de joindre le parc. Vérifiez votre signal et réessayez.',
    'Your Spirit challenge could not be loaded. Ask a cast member for help.': 'Votre défi de l’Esprit n’a pas pu se charger. Demandez de l’aide à un membre de l’équipe.',
    'Could not load your Spirit challenge. Try again.': 'Impossible de charger votre défi de l’Esprit. Réessayez.',
    'Already recorded.': 'Déjà enregistré.',
    'Saved.': 'Enregistré.',
    'Enter a station link or the printed code.': 'Entrez un lien de station ou le code imprimé.',
    'That code is for {venue}, not this park.': 'Ce code est pour {venue}, pas pour ce parc.',
    'That code isn’t one of ours.': 'Ce code n’est pas un des nôtres.',
    'Enter the printed code.': 'Entrez le code imprimé.',
    'Saved until you have signal.': 'Enregistré jusqu’à ce que vous ayez du signal.',
    '{name} — open the quest station if you like.': '{name} — ouvrez la station de quête si vous voulez.',
    'Saved scan synced.': 'Scan enregistré synchronisé.',
    '{count} saved scans synced.': '{count} scans enregistrés synchronisés.',
    'One saved code was not recognized.': 'Un code enregistré n’a pas été reconnu.',
    '{count} saved codes were not recognized.': '{count} codes enregistrés n’ont pas été reconnus.',
    'Still saving scans until signal returns.': 'Les scans s’enregistrent encore, en attendant le signal.',
    'Whole park in view': 'Tout le parc à l’écran',
    'Guardian stops only': 'Seulement les Gardiens',
    'Full park map': 'Carte complète du parc',
    'Open {name}': 'Ouvrir {name}',
    'Filter map ({count} hidden)': 'Filtrer la carte ({count} masquées)',
    '{count} category hidden': '{count} catégorie masquée',
    '{count} categories hidden': '{count} catégories masquées',
    Landmarks: 'Points de repère',
    Sculptures: 'Sculptures',
    Lanterns: 'Lanternes',
    'Photo spots': 'Coins photo',
    Rides: 'Activités',
    Amenities: 'Services',
    Visit: 'À visiter',
    Complete: 'Terminé',
    'Ready to scan': 'Prêt à scanner',
    'Final destination': 'Destination finale',
    'Quiz done': 'Quiz terminé',
    Visited: 'Visité',
    Optional: 'Facultatif',
    Welcome: 'Accueil',
    'Start here': 'Commencez ici',
    'Element awake': 'Élément éveillé',
    'Builder’s Monument is optional.': 'Le Monument des bâtisseurs est facultatif.',
    'Not a Winter Keeper yet': 'Pas encore Gardien de l’hiver',
    'Awaken five elements, then scan the Winter Keeper Throne. Progress lasts until 4 AM Eastern.': 'Éveillez les cinq éléments, puis scannez le Trône du Gardien de l’hiver. La progression dure jusqu’à 4 h, heure de l’Est.',
    'Your quest is complete. Show this screen at the Gift Shop for your Winter Keeper medallion.': 'Votre quête est terminée. Présentez cet écran à la boutique pour recevoir votre médaillon de Gardien de l’hiver.',
    'The Winter Keeper Throne is the final scan — not a shortcut. None of the five elements are awake yet. Return here after you awaken them to confirm your quest and earn the Winter Keeper title.': 'Le Trône du Gardien de l’hiver est le dernier scan — pas un raccourci. Aucun des cinq éléments n’est encore éveillé. Revenez ici après les avoir éveillés pour confirmer votre quête et recevoir le titre de Gardien de l’hiver.',
    'The Winter Keeper Throne is the final scan — not a shortcut. One element is still sleeping ({list}). Return here after you awaken it to confirm your quest and earn the Winter Keeper title.': 'Le Trône du Gardien de l’hiver est le dernier scan — pas un raccourci. Un élément dort encore ({list}). Revenez ici après l’avoir éveillé pour confirmer votre quête et recevoir le titre de Gardien de l’hiver.',
    'The Winter Keeper Throne is the final scan — not a shortcut. {count} elements are still sleeping ({list}). Return here after you awaken them to confirm your quest and earn the Winter Keeper title.': 'Le Trône du Gardien de l’hiver est le dernier scan — pas un raccourci. {count} éléments dorment encore ({list}). Revenez ici après les avoir éveillés pour confirmer votre quête et recevoir le titre de Gardien de l’hiver.',
    'All five elements are awake. Scan the Winter Keeper Throne now to confirm your quest is complete. You will be named Winter Keeper, Protector of Winter Magic. An optional group photo here is welcome. Then show the completion screen at the Gift Shop for your medallion.': 'Les cinq éléments sont éveillés. Scannez maintenant le Trône du Gardien de l’hiver pour confirmer que votre quête est terminée. Vous serez nommé Gardien de l’hiver, Protecteur de la magie de l’hiver. Une photo de groupe ici est la bienvenue, et elle reste facultative. Ensuite, présentez l’écran de fin à la boutique pour recevoir votre médaillon.',
    'Still needed: {list}. Finish that Guardian challenge, then return here to scan and confirm.': 'Encore à éveiller : {list}. Terminez le défi de ce Gardien, puis revenez ici pour scanner et confirmer.',
    'Still needed: {list}. Finish those Guardian challenges, then return here to scan and confirm.': 'Encore à éveiller : {list}. Terminez les défis de ces Gardiens, puis revenez ici pour scanner et confirmer.',
    'Party of {count}.': 'Groupe de {count}.',
    'How many adventurers?': 'Combien d’aventuriers?',
    'Water, Earth, Fire, Air, and Spirit are awake. You completed all five Guardian challenges, and the Throne confirms your quest is complete. You are Winter Keepers, Protectors of Winter Magic. Enter your first names for your recognition.': 'L’Eau, la Terre, le Feu, l’Air et l’Esprit sont éveillés. Vous avez relevé les cinq défis des Gardiens, et le Trône confirme que votre quête est terminée. Vous êtes Gardiens de l’hiver, Protecteurs de la magie de l’hiver. Entrez vos prénoms pour la reconnaissance.',
    'First names': 'Prénoms',
    'Ada, Sam, Juniper': 'Léa, Sam, Olivier',
    'Become Winter Keepers': 'Devenir Gardiens de l’hiver',
    'Could not finish just now. Your names are still here — try again.': 'Impossible de terminer pour l’instant. Vos prénoms sont encore là — réessayez.',
    'You appear offline. Your names are still here — reconnect and try again.': 'Vous semblez hors ligne. Vos prénoms sont encore là — reconnectez-vous et réessayez.',
    'Could not finish just now. Try again.': 'Impossible de terminer pour l’instant. Réessayez.',
    'Gift Shop': 'Boutique',
    'Winter Keeper medallion': 'Médaillon du Gardien de l’hiver',
    'This party': 'Ce groupe',
    'Winter Keepers in this party: {count}': 'Gardiens de l’hiver dans ce groupe : {count}',
    'Show this screen at the Gift Shop to receive your Winter Keeper medallion.': 'Présentez cet écran à la boutique pour recevoir votre médaillon de Gardien de l’hiver.',
    'You met the Guardians, awakened the five elements, and were named a Winter Keeper.': 'Vous avez rencontré les Gardiens, éveillé les cinq éléments et reçu le titre de Gardien de l’hiver.',
    'Winter Keeper': 'Gardien de l’hiver',
    'Protector of Winter Magic': 'Protecteur de la magie de l’hiver',
    'The five elements rush together, and the Winter Keeper medallion appears.': 'Les cinq éléments se rejoignent, et le médaillon du Gardien de l’hiver apparaît.',
    'If you like, take a group photo here at the Throne. That part is entirely optional.': 'Si vous voulez, prenez une photo de groupe ici, au Trône. Cette partie est entièrement facultative.',
    'Where to first?': 'Par où commencer?',
    'Wander the whole castle, or begin the quest and pick a Guardian challenge.': 'Parcourez tout le château, ou commencez la quête et choisissez le défi d’un Gardien.',
    'Begin the quest': 'Commencer la quête',
    'Explore the map': 'Explorer la carte',
    Guardian: 'Gardien',
    'Begin this shrine when you are ready.': 'Commencez ce sanctuaire quand vous êtes prêts.',
    'Begin {name}': 'Commencer {name}',
    'Stay on the map': 'Rester sur la carte',
    'Pick a Guardian': 'Choisissez un Gardien',
    'Tap a Guardian below, or walk to a glowing seal on the map to meet them and play their challenge.': 'Touchez un Gardien ci-dessous, ou marchez vers un sceau lumineux sur la carte pour le rencontrer et jouer son défi.',
    'Got it': 'Compris',
    'This browser can’t open the camera. Type the code printed under the sign instead.': 'Ce navigateur ne peut pas ouvrir la caméra. Entrez plutôt le code imprimé sous le panneau.',
    'Camera access is off. Turn it on in your browser settings, or type the code below.': 'L’accès à la caméra est fermé. Activez-le dans les réglages du navigateur, ou entrez le code ci-dessous.',
    'Camera isn’t available right now. Type the code printed under the sign instead.': 'La caméra n’est pas disponible pour l’instant. Entrez plutôt le code imprimé sous le panneau.',
    'That code doesn’t look right. Use a station link or the letters under the sign.': 'Ce code ne semble pas bon. Utilisez un lien de station ou les lettres sous le panneau.',
    'Montreal, Canada': 'Montréal, Canada',
    'Ice Castles Montreal': 'Ice Castles Montréal',
    'Cascade notices water’s smallest wonders.': 'Cascade remarque les plus petites merveilles de l’eau.',
    'A bubble, a ripple, a reflection. The smallest detail may hold the biggest wonder.': 'Une bulle, une ride, un reflet. Le plus petit détail peut cacher la plus grande merveille.',
    'Every Ice Castle begins and ends with water.': 'Chaque château de glace commence et finit avec l’eau.',
    'Granite remembers the ground beneath the ice.': 'Granite se souvient du sol sous la glace.',
    'The castle begins with a place to build and a plan for people to move through it.': 'Le château commence par un lieu où bâtir et un plan pour que les gens puissent y circuler.',
    'Notice what supports the magic, not only what sparkles above it.': 'Remarquez ce qui porte la magie, pas seulement ce qui brille au-dessus.',
    'Ember finds balance in cold and light.': 'Ember trouve l’équilibre entre le froid et la lumière.',
    'Light reveals color, bubbles, and texture that daylight may hide.': 'La lumière révèle les couleurs, les bulles et la texture que le jour peut cacher.',
    'Fire and ice can share a story without one conquering the other.': 'Le feu et la glace peuvent partager une histoire sans que l’un l’emporte sur l’autre.',
    'Summit follows the wind.': 'Summit suit le vent.',
    'Watch a flag flutter, snow drift, or warm breath appear in the cold.': 'Regardez un drapeau flotter, la neige glisser, ou une buée chaude apparaître dans le froid.',
    'Curiosity moves like the wind. It carries you toward something you had not noticed yet.': 'La curiosité se déplace comme le vent. Elle vous mène vers quelque chose que vous n’aviez pas encore remarqué.',
    'Aurora gathers the memories people carry away.': 'Aurora recueille les souvenirs que les gens emportent.',
    'What lasts is the fond memories people carry with them.': 'Ce qui reste, ce sont les bons souvenirs que les gens emportent.',
    'Wonder can continue as a memory, long after the ice has changed.': 'L’émerveillement peut continuer comme un souvenir, longtemps après que la glace a changé.',

    'The Threshold': 'Le Seuil',
    'Where the Winter Keeper tradition begins': 'Là où commence la tradition du Gardien de l’hiver',
    'Explore the castle. Discover the five Guardians — Water, Earth, Fire, Air, and Spirit — and complete their challenges in any order. When all five elements are awake, scan the Winter Keeper Throne to become a Winter Keeper.': 'Explorez le château. Découvrez les cinq Gardiens — l’Eau, la Terre, le Feu, l’Air et l’Esprit — et relevez leurs défis dans n’importe quel ordre. Quand les cinq éléments sont éveillés, scannez le Trône du Gardien de l’hiver pour devenir Gardien de l’hiver.',
    'You may begin at any Castle Quest station. The Threshold is a welcome, not a gate you must find first.': 'Vous pouvez commencer à n’importe quelle station de Castle Quest. Le Seuil est un accueil, pas une porte que vous devez trouver en premier.',
    'Guardian of Water · Penguin': 'Gardien de l’Eau · Pingouin',
    'Cascade is a bright-eyed penguin who sees what hurried explorers miss: a bubble caught in clear ice, a ripple held still, a reflection that shimmers like a secret window.\n\nCascade remembers the first Winter Keeper asking how a single drop could become a castle. The answer came slowly: one icicle joined to another, shaped by cold and careful hands.\n\nWith Water, pause and look into the ice. The smallest detail may hold the biggest wonder.': 'Cascade est un pingouin au regard vif qui voit ce que les explorateurs pressés manquent : une bulle prise dans la glace claire, une ride figée, un reflet qui brille comme une fenêtre secrète.\n\nCascade se souvient du premier Gardien de l’hiver demandant comment une seule goutte pouvait devenir un château. La réponse est venue lentement : un glaçon joint à un autre, façonné par le froid et des mains attentives.\n\nAvec l’Eau, arrêtez-vous et regardez dans la glace. Le plus petit détail peut cacher la plus grande merveille.',
    'Every Ice Castle begins and ends with Water. In the beginning, water changes its shape with temperature: it flows, freezes, and catches light. Ice Castles artisans grow and place icicles, fusing them into walls, arches, tunnels, and towers.\n\nLook closely and you may spot bubbles, layered textures, or blue light inside the ice. Each detail records a meeting of water, cold, time, and light. In the spring water changes its shape again, returning to the landscape around it.\n\nCascade invites you to notice how a single frozen detail belongs to a much larger, fleeting creation.': 'Chaque château de glace commence et finit avec l’Eau. Au début, l’eau change de forme avec la température : elle coule, gèle et attrape la lumière. Les artisans d’Ice Castles font pousser des glaçons et les placent, jusqu’à les fondre en murs, en arches, en tunnels et en tours.\n\nRegardez de près : vous verrez peut-être des bulles, des couches, ou une lumière bleue dans la glace. Chaque détail garde la rencontre de l’eau, du froid, du temps et de la lumière. Au printemps, l’eau change encore de forme et retourne au paysage autour d’elle.\n\nCascade vous invite à voir comment un seul détail gelé appartient à une création beaucoup plus grande, et passagère.',
    'Guardian of Earth · Moose': 'Gardien de la Terre · Orignal',
    'Granite is a big-hearted moose with the memory of an old trail and the patience of a builder. He knows the castle begins before the first icicle is placed: with a place to build, a plan for people to move through it, and close attention to the ground beneath everyone’s boots.\n\nGranite leaves clues for explorers who look steadily. With Earth, notice what supports the magic, not only what sparkles above it.': 'Granite est un orignal au grand cœur, avec la mémoire d’un vieux sentier et la patience d’un bâtisseur. Il sait que le château commence avant le premier glaçon : par un lieu où bâtir, un plan pour que les gens puissent y circuler, et une attention au sol sous les bottes de tout le monde.\n\nGranite laisse des indices à ceux qui regardent avec calme. Avec la Terre, remarquez ce qui porte la magie, pas seulement ce qui brille au-dessus.',
    'Every build begins with a site and a plan. Builders consider the ground, drainage, water and guest flow, access, safety, snow, and the way weather may change the work. Conditions keep shifting: ice can grow, surfaces can wear, and a warm spell can alter the schedule. The craft is to work with the site and the season. Granite stands for the planning and practical care that help a beautiful place welcome guests.': 'Chaque construction commence par un site et un plan. Les bâtisseurs pensent au sol, au drainage, à l’eau, au déplacement des visiteurs, à l’accès, à la sécurité, à la neige, et à la façon dont la météo peut changer le travail. Les conditions bougent sans cesse : la glace peut pousser, les surfaces s’user, et un redoux peut changer l’horaire. Le métier, c’est de travailler avec le lieu et la saison. Granite représente la planification et le soin concret qui permettent à un bel endroit d’accueillir les visiteurs.',
    'Guardian of Fire · Dragon': 'Gardien du Feu · Dragon',
    'Ember is a dragon who belongs in the snow. He loves the moment blue ice turns gold and lantern light dances across a frozen wall. Bold and a little mischievous, Ember knows fire and ice can share a story without one conquering the other.\n\nHe also honors the creative fire in the hearts of Ice Castles artisans: the imagination and purpose that help keep them warm in spirit through the coldest nights as they shape the castle. Watch closely; Ember’s clues flicker and change.': 'Ember est un dragon qui a sa place dans la neige. Il aime le moment où la glace bleue devient or et où la lumière des lanternes danse sur un mur gelé. Audacieux et un peu espiègle, Ember sait que le feu et la glace peuvent partager une histoire sans que l’un l’emporte sur l’autre.\n\nIl honore aussi le feu créatif dans le cœur des artisans d’Ice Castles : l’imagination et le but qui les gardent chauds d’esprit pendant les nuits les plus froides, pendant qu’ils façonnent le château. Regardez bien : les indices d’Ember vacillent et changent.',
    'Fire does not have to mean a flame inside the castle. Here, light changes how guests see ice: it reveals color, bubbles, shadows, and texture that daylight may hide. Ember also celebrates the creative fire artisans carry as they bring the castle to life. Their imagination and purpose keep them warm in spirit through the coldest nights.\n\nTemperature matters too; cold helps water freeze, while warmth can change or limit the build. After dark, the same passage can feel like a different place.\n\nEmber asks explorers to notice how contrast brings the frozen world to life.': 'Le feu n’a pas besoin d’être une flamme dans le château. Ici, la lumière change la façon de voir la glace : elle révèle les couleurs, les bulles, les ombres et la texture que le jour peut cacher. Ember célèbre aussi le feu créatif que les artisans portent en donnant vie au château. Leur imagination et leur but les gardent chauds d’esprit pendant les nuits les plus froides.\n\nLa température compte aussi. Le froid aide l’eau à geler, tandis que la chaleur peut changer ou limiter la construction. Après la tombée du jour, le même passage peut sembler un autre lieu.\n\nEmber demande aux explorateurs de remarquer comment le contraste donne vie au monde gelé.',
    'Guardian of Air · Yeti': 'Gardien de l’Air · Yéti',
    'Summit is a friendly Yeti who lives where the wind has room to play. He listens for flags snapping, snow skimming across open ground, and the hush that follows a gust. His clues may be overhead or around the next bend.\n\nSummit knows that curiosity moves like the wind: it carries you toward something you had not noticed yet. With Air, lift your eyes and follow what the wind sets in motion.': 'Summit est un yéti amical qui vit là où le vent a de la place pour jouer. Il écoute les drapeaux qui claquent, la neige qui file sur le sol ouvert, et le silence qui suit une rafale. Ses indices peuvent être au-dessus de vous, ou au prochain tournant.\n\nSummit sait que la curiosité se déplace comme le vent : elle vous mène vers quelque chose que vous n’aviez pas encore remarqué. Avec l’Air, levez les yeux et suivez ce que le vent met en mouvement.',
    'Air is invisible, but winter shows where it travels. Watch a flag flutter, snow drift, or warm breath appear in the cold. Cold air helps water freeze and new ice grow; wind and changing temperatures also shape when and how builders can work. When the structure is ready, artisans carve details that give the Ice Castle its final character.\n\nSummit invites you to read the signs of something you cannot see by noticing what it moves.': 'L’air est invisible, mais l’hiver montre où il passe. Regardez un drapeau flotter, la neige glisser, ou une buée chaude apparaître dans le froid. L’air froid aide l’eau à geler et la nouvelle glace à pousser. Le vent et les changements de température décident aussi quand et comment les bâtisseurs peuvent travailler. Quand la structure est prête, les artisans sculptent les détails qui donnent au château son caractère final.\n\nSummit vous invite à lire les signes de quelque chose que vous ne pouvez pas voir, en remarquant ce qu’il déplace.',
    'Guardian of Spirit · Polar Bear': 'Gardienne de l’Esprit · Ours polaire',
    'Aurora is the Guardian of Spirit, the spark of wonder that connects the elements and everyone who visits. She notices a first brave slide, a family photo that will be retold, and the quiet moment when someone stops to take in the ice.\n\nAurora knows the castle will change with the season. What lasts is the fond memories people carry with them.': 'Aurora est la Gardienne de l’Esprit, l’étincelle d’émerveillement qui relie les éléments et toutes les personnes qui visitent. Elle remarque une première glissade courageuse, une photo de famille qu’on racontera, et le moment tranquille où quelqu’un s’arrête pour regarder la glace.\n\nAurora sait que le château changera avec la saison. Ce qui reste, ce sont les bons souvenirs que les gens emportent.',
    'An Ice Castle changes with the season. Cold nights, warm days, snowfall, and the movement of guests shape it, so each season is different. Water, Earth, Fire, and Air shape the frozen structure; Spirit is the curiosity, courage, laughter, and connection people bring to the experience.\n\nAurora’s station uses colored buttons and lanterns. Your phone shows which buttons to press; the station answers with lanterns; you enter that lantern order. The phone and station share the same mapping table — they do not connect over the network.\n\nAurora reminds us that wonder can continue as a memory, shared long after the ice has changed.': 'Un château de glace change avec la saison. Les nuits froides, les jours doux, la neige et le passage des visiteurs le façonnent, alors chaque saison est différente. L’Eau, la Terre, le Feu et l’Air forment la structure gelée. L’Esprit, c’est la curiosité, le courage, le rire et le lien que les gens apportent.\n\nLa station d’Aurora utilise des boutons de couleur et des lanternes. Votre téléphone montre quels boutons presser. La station répond avec les lanternes. Vous entrez cet ordre de lanternes. Le téléphone et la station partagent le même tableau — ils ne se connectent pas par le réseau.\n\nAurora nous rappelle que l’émerveillement peut continuer comme un souvenir, partagé longtemps après que la glace a changé.',
    'Builder’s Monument': 'Monument des bâtisseurs',
    'Optional discovery': 'Découverte facultative',
    'Ice Castles began with a father trying to give his six children a winter adventure. One wintery night, a fierce storm engulfed Alpine, Utah. In the still of the morning, Brent Christensen was standing at his kitchen window when he noticed newly formed icicles covering his children’s playground, sparkling in the early morning sunlight. Inspired, Brent Christensen built an ice playground in his yard. The children called it an ‘ice castle,’ and neighborhood families soon came to explore.\n\nThat small family creation grew into a winter attraction built anew each season. Today, more than 50 Ice Castles have risen across North America and millions of guests just like you have discovered the magic of Ice Castles.\n\nThe Builder’s Monument honors the passionate winter artisans who turn a simple idea into a place guests can enter, explore, and make lasting memories. This stop is optional and does not affect becoming a Winter Keeper.': 'Ice Castles a commencé avec un père qui voulait offrir une aventure d’hiver à ses six enfants. Par une nuit d’hiver, une grosse tempête a recouvert Alpine, en Utah. Au calme du matin, Brent Christensen était à la fenêtre de sa cuisine quand il a vu de nouveaux glaçons couvrir le terrain de jeu de ses enfants, brillants dans le soleil du matin. Inspiré, il a bâti un terrain de jeu de glace dans sa cour. Les enfants l’ont appelé un « ice castle », et les familles du quartier sont bientôt venues l’explorer.\n\nCette petite création familiale est devenue une attraction d’hiver reconstruite chaque saison. Aujourd’hui, plus de 50 châteaux de glace ont été élevés en Amérique du Nord, et des millions de visiteurs comme vous ont découvert la magie d’Ice Castles.\n\nLe Monument des bâtisseurs honore les artisans de l’hiver qui transforment une idée simple en un lieu où l’on peut entrer, explorer et garder des souvenirs. Cet arrêt est facultatif et ne change rien au titre de Gardien de l’hiver.',
    'An Ice Castle is assembled through many careful steps. Teams plan around the site and the weather. Icicles are grown, harvested, and carried up and into the structure, where ice artisans place them one by one to shape walls, arches, tunnels, and towers. Water is misted over the structure to help the ice fuse and grow.\n\nThen the team keeps tending it: checking conditions, adding ice, shaping spaces, and caring for guest routes as the castle changes. The work calls for coordination, patience, physical skill, and constant attention to winter.\n\nThe finished walls may look like a single frozen wonder, but look closely and you can see the individual icicles and layers that make it.': 'Un château de glace s’assemble en beaucoup d’étapes attentives. Les équipes planifient selon le site et la météo. On fait pousser les glaçons, on les récolte, on les monte dans la structure, et les artisans de la glace les placent un par un pour former des murs, des arches, des tunnels et des tours. On vaporise de l’eau pour aider la glace à se souder et à pousser.\n\nEnsuite, l’équipe continue d’en prendre soin : vérifier les conditions, ajouter de la glace, façonner les espaces et veiller aux parcours des visiteurs pendant que le château change. Le travail demande de la coordination, de la patience, de l’habileté physique et une attention constante à l’hiver.\n\nLes murs finis peuvent sembler une seule merveille gelée, mais de près on voit les glaçons et les couches qui les composent.',
    'Winter Keeper Throne': 'Trône du Gardien de l’hiver',
    'Final scan and the medallion': 'Dernier scan et le médaillon',
    'The Winter Keeper Throne is the final scan. Awaken all five elements first, then scan here to confirm your quest and become a Winter Keeper. If an element is still sleeping, this page lists what remains. When you are ready, an optional group photo here is welcome, and the Gift Shop redeems your medallion from the completion screen.': 'Le Trône du Gardien de l’hiver est le dernier scan. Éveillez d’abord les cinq éléments, puis scannez ici pour confirmer votre quête et devenir Gardien de l’hiver. Si un élément dort encore, cette page indique ce qui reste. Quand vous êtes prêts, une photo de groupe ici est la bienvenue, et elle reste facultative. La boutique remet votre médaillon à partir de l’écran de fin.',
    'Scanning the Throne confirms the quest. Completing the last Guardian is not enough on its own.': 'Scanner le Trône confirme la quête. Terminer le dernier Gardien ne suffit pas à lui seul.',
    'Cascade spotted tiny frozen wonders nearby. Look closely at the ice, then choose the three images that match what you see.': 'Cascade a repéré de petites merveilles gelées tout près. Regardez bien la glace, puis choisissez les trois images qui correspondent à ce que vous voyez.',
    'Not quite. Take another look. Cascade knows the smallest details can hold the biggest wonder.': 'Pas tout à fait. Regardez encore. Cascade sait que les plus petits détails peuvent cacher la plus grande merveille.',
    'Water awakens. You found the wonder hidden in the ice, and Cascade’s mark joins your quest. When all five elements are awake, the Winter Keeper Throne will confirm your completion.': 'L’Eau s’éveille. Vous avez trouvé la merveille cachée dans la glace, et la marque de Cascade rejoint votre quête. Quand les cinq éléments seront éveillés, le Trône du Gardien de l’hiver confirmera votre parcours.',
    'Look for the clues on the monument around you.': 'Cherchez les indices sur le monument autour de vous.',
    'Hairline vein': 'Veine fine',
    'Lantern glow': 'Lueur de lanterne',
    'Pressed arch': 'Arche pressée',
    'Silk wing': 'Aile de soie',
    'Frozen ripple': 'Ride gelée',
    'Carved rune': 'Rune gravée',
    'Four of Granite’s moose are hiding nearby, each with a letter. Find them all and arrange the letters to reveal a shape you can find in a castle.': 'Quatre des orignaux de Granite se cachent tout près, chacun avec une lettre. Trouvez-les tous et placez les lettres pour révéler une forme que l’on trouve dans un château.',
    'Those letters are not in the right order yet. Check each moose again, then try once more.': 'Ces lettres ne sont pas encore dans le bon ordre. Vérifiez chaque orignal, puis réessayez.',
    'Earth awakens. You found the word beneath the wonder, and Granite’s mark joins your quest. When all five elements are awake, the Winter Keeper Throne will confirm your completion.': 'La Terre s’éveille. Vous avez trouvé le mot sous la merveille, et la marque de Granite rejoint votre quête. Quand les cinq éléments seront éveillés, le Trône du Gardien de l’hiver confirmera votre parcours.',
    'The word you found': 'Le mot trouvé',
    'Enter the word': 'Entrez le mot',
    'Awaken Earth': 'Éveiller la Terre',
    'Watch Ember’s four lanterns glow in sequence. Then tap their colors on your screen in the same order.': 'Regardez les quatre lanternes d’Ember s’allumer en séquence. Puis touchez leurs couleurs à l’écran dans le même ordre.',
    'The colors slipped out of order. Watch Ember’s lanterns again, then follow their glow.': 'Les couleurs se sont mélangées. Regardez encore les lanternes d’Ember, puis suivez leur lueur.',
    'Fire awakens. You followed the lantern light, and Ember’s spark joins your quest. When all five elements are awake, the Winter Keeper Throne will confirm your completion.': 'Le Feu s’éveille. Vous avez suivi la lumière des lanternes, et l’étincelle d’Ember rejoint votre quête. Quand les cinq éléments seront éveillés, le Trône du Gardien de l’hiver confirmera votre parcours.',
    'Clear sequence': 'Effacer la séquence',
    'Awaken Fire': 'Éveiller le Feu',
    Ice: 'Glace',
    Amber: 'Ambre',
    'Summit scattered an air rune into five pieces. Drag every piece onto the altar until the triple spiral is whole again.': 'Summit a dispersé une rune d’air en cinq pièces. Glissez chaque pièce sur l’autel jusqu’à ce que la triple spirale soit entière.',
    'These shapes have not found each other yet. Look for the pieces that belong together, then try once more.': 'Ces formes ne se sont pas encore trouvées. Cherchez les pièces qui vont ensemble, puis réessayez.',
    'Air awakens. You joined the shapes into the rune, and Summit’s mark joins your quest. When all five elements are awake, the Winter Keeper Throne will confirm your completion.': 'L’Air s’éveille. Vous avez réuni les formes en une rune, et la marque de Summit rejoint votre quête. Quand les cinq éléments seront éveillés, le Trône du Gardien de l’hiver confirmera votre parcours.',
    Vortex: 'Tourbillon',
    Draft: 'Courant',
    Gale: 'Rafale',
    Zephyr: 'Zéphyr',
    Squall: 'Grain',
    'At Aurora’s Spirit station, press the colored buttons in the order shown here. Then watch the lanterns and enter that sequence on your phone.': 'À la station de l’Esprit d’Aurora, appuyez sur les boutons de couleur dans l’ordre montré ici. Puis regardez les lanternes et entrez cette séquence sur votre téléphone.',
    'Wait for the station’s Ready indicator, then press these buttons in order.': 'Attendez le voyant Prêt de la station, puis appuyez sur ces boutons dans l’ordre.',
    'Watch the lanterns. Remember the colors in order.': 'Regardez les lanternes. Retenez les couleurs dans l’ordre.',
    'Tap the lantern colors you saw, in order.': 'Touchez les couleurs de lanternes que vous avez vues, dans l’ordre.',
    'This station serves one party at a time. If someone else is using it, wait for Ready.': 'Cette station accueille un groupe à la fois. Si quelqu’un d’autre l’utilise, attendez le voyant Prêt.',
    'Missed the lights? Ask the station for a replay, or show your button sequence again here and try once more.': 'Vous avez manqué les lumières? Demandez une reprise à la station, ou remontez votre séquence de boutons ici et réessayez.',
    'No phone-to-station connection is needed. Follow the buttons, then enter what the lanterns show.': 'Aucune connexion entre le téléphone et la station n’est nécessaire. Suivez les boutons, puis entrez ce que montrent les lanternes.',
    'That lantern order is not quite right. Watch again, or show your button sequence and try once more.': 'Cet ordre de lanternes n’est pas tout à fait le bon. Regardez encore, ou remontez votre séquence de boutons et réessayez.',
    'Spirit awakens. Aurora’s mark joins the others, carrying your quest toward its final meeting at the Winter Keeper Throne.': 'L’Esprit s’éveille. La marque d’Aurora rejoint les autres et mène votre quête vers sa rencontre finale au Trône du Gardien de l’hiver.',
    'Awaken Spirit': 'Éveiller l’Esprit',
    Clear: 'Effacer',
    Undo: 'Annuler',
    'I pressed the buttons': 'J’ai appuyé sur les boutons',
    'Show button sequence again': 'Revoir la séquence de boutons',
    Blue: 'Bleu',
    Green: 'Vert',
    Red: 'Rouge',
    'Icy blue': 'Bleu glacier',
    'Optional: Take five quick multiple-choice questions to discover how an Ice Castle is built and reveal a surprising fact after each answer. Skip the quiz or play for fun; answers do not affect Castle Quest progress or Winter Keeper completion.': 'Facultatif : répondez à cinq courtes questions à choix multiple pour découvrir comment on bâtit un château de glace, et un fait surprenant après chaque réponse. Passez le quiz ou jouez pour le plaisir. Les réponses ne changent ni la quête ni le titre de Gardien de l’hiver.',
    'How did Ice Castles begin?': 'Comment Ice Castles a-t-il commencé?',
    'As a mountain resort': 'Comme une station de montagne',
    'As an ice playground Brent Christensen built for his children': 'Comme un terrain de jeu de glace que Brent Christensen a bâti pour ses enfants',
    'As a town winter festival': 'Comme un festival d’hiver de la ville',
    'As a school science project': 'Comme un projet scientifique d’école',
    'Christensen’s children called the ice playground in his yard an ‘ice castle.’ Their neighborhood friends soon wanted to explore it too.': 'Les enfants de Christensen ont appelé le terrain de jeu de glace dans la cour un « ice castle ». Les amis du quartier ont vite voulu l’explorer eux aussi.',
    'About how much ice can one Ice Castle use?': 'Environ quelle quantité de glace un château d’Ice Castles peut-il utiliser?',
    '20,000 pounds': '20 000 livres',
    '200,000 pounds': '200 000 livres',
    '2 million pounds': '2 millions de livres',
    '20 million pounds': '20 millions de livres',
    'Ice Castles’ current website lists about 20 million pounds of ice per castle. That scale takes planning, teamwork, and ongoing care.': 'Le site actuel d’Ice Castles indique environ 20 millions de livres de glace par château. Cette échelle demande de la planification, du travail d’équipe et un soin continu.',
    'About how many icicles does Ice Castles report growing each day?': 'Environ combien de glaçons Ice Castles dit-il faire pousser chaque jour?',
    'The current Ice Castles website reports 5,000 icicles grown every day. Each season’s castle uses hundreds of thousands of hand-placed icicles.': 'Le site actuel d’Ice Castles indique 5 000 glaçons cultivés chaque jour. Le château de chaque saison utilise des centaines de milliers de glaçons placés à la main.',
    'How do many walls and arches take shape?': 'Comment beaucoup de murs et d’arches prennent-ils forme?',
    'Ice artists place icicles one by one and mist them with water': 'Les artistes de la glace placent les glaçons un par un et les vaporisent d’eau',
    'One giant block is carved into the whole castle': 'Un seul bloc géant est sculpté pour former tout le château',
    'Snow is packed into molds and painted': 'La neige est tassée dans des moules puis peinte',
    'Metal frames are covered with glass': 'Des cadres de métal sont couverts de verre',
    'Individual icicles are hand-placed by ice artists. Water helps join the ice, while repeated work and cold conditions let the structure grow.': 'Les glaçons sont placés à la main par les artistes de la glace. L’eau aide à souder la glace, et le travail répété avec le froid laisse la structure grandir.',
    'Why can the weather change the build schedule?': 'Pourquoi la météo peut-elle changer l’horaire de construction?',
    'Wind chooses the castle’s colors': 'Le vent choisit les couleurs du château',
    'Ice grows only during snowfall': 'La glace ne pousse que pendant les chutes de neige',
    'The team must work with changing temperatures and site conditions': 'L’équipe doit travailler avec des températures et des conditions de site qui changent',
    'Warm days make icicles grow faster': 'Les jours doux font pousser les glaçons plus vite',
    'Ice Castles is a weather-built experience. Cold supports ice growth, while warmth, rain, and changing surfaces can affect construction and operations.': 'Ice Castles est une expérience bâtie par la météo. Le froid aide la glace à pousser, tandis que la chaleur, la pluie et les surfaces qui changent peuvent toucher la construction et les opérations.',

    'The Ice Castle': 'Le château de glace',
    'Hand-placed icicles, grown all winter long.': 'Des glaçons placés à la main, cultivés tout l’hiver.',
    'Everything you see here was grown, not built. Our ice artists harvest icicles by hand each night, place them by hand, then spray them with water until they fuse. A finished castle can hold more than twenty million pounds of ice.': 'Tout ce que vous voyez ici a été cultivé, pas construit. Chaque nuit, nos artistes de la glace récoltent les glaçons à la main, les placent à la main, puis les vaporisent d’eau jusqu’à ce qu’ils se soudent. Un château fini peut contenir plus de vingt millions de livres de glace.',
    'Fairy Village': 'Village des fées',
    'Small doors, smaller residents, best photo in the park.': 'De petites portes, des habitants encore plus petits, la plus belle photo du parc.',
    'Look low. The village is built at kid height on purpose, with lit doorways tucked into the drifts. Crouch down to line up a shot through one of the arches.': 'Regardez en bas. Le village est bâti à hauteur d’enfant, avec des portes éclairées nichées dans la neige. Accroupissez-vous pour cadrer une photo à travers une des arches.',
    'Mystic Forest — Earth': 'Forêt mystique — Terre',
    'Where the Female Golem keeps watch over the roots.': 'Là où le golem féminin veille sur les racines.',
    'The Earth section holds the heaviest work in the forest: stone-shouldered figures, carved runes, and the Female Golem standing in the treeline. Look for the runes cut into the low walls.': 'La section Terre porte le travail le plus lourd de la forêt : des figures aux épaules de pierre, des runes gravées, et le golem féminin à la lisière des arbres. Cherchez les runes taillées dans les murets.',
    'Mystic Forest — Water': 'Forêt mystique — Eau',
    'Frozen mid-pour.': 'Figée en plein écoulement.',
    'Water is the trickiest element to carve, because it has to look like it is still moving. Watch the lighting cycle — the colour shift is programmed to feel like a current.': 'L’eau est l’élément le plus difficile à sculpter, parce qu’elle doit avoir l’air de bouger encore. Regardez le cycle de lumière — le changement de couleur est réglé pour évoquer un courant.',
    'Mystic Forest — Fire': 'Forêt mystique — Feu',
    'Warm light through cold silk.': 'Une lumière chaude à travers la soie froide.',
    'Amber silk lanterns and pixel-mapped LEDs give this section its flicker. Nothing here is actually burning, but stand still for a moment and it reads like heat.': 'Des lanternes de soie ambre et des lumières donnent à cette section son vacillement. Rien ne brûle vraiment ici, mais restez un moment immobile et on croirait sentir la chaleur.',
    'Mystic Forest — Air': 'Forêt mystique — Air',
    'Wind through the silk, and paths that lift your gaze.': 'Le vent dans la soie, et des sentiers qui lèvent le regard.',
    'The Air stretch of the forest is wings, flags, and open height. Summit keeps the Wind realm here.': 'Le passage de l’Air est fait d’ailes, de drapeaux et de hauteur. Summit garde ici le royaume du Vent.',
    'Mystic Forest — Spirit': 'Forêt mystique — Esprit',
    'Quiet light between the trees.': 'Une lumière tranquille entre les arbres.',
    'The Spirit stretch of the forest is where the field of light comes up out of the dark. Aurora keeps this realm.': 'Le passage de l’Esprit est l’endroit où le champ de lumière sort de l’obscurité. Aurora garde ce royaume.',
    'Bird Aviary': 'Volière',
    'A flock of illuminated silk wings overhead.': 'Une volée d’ailes de soie éclairées au-dessus de vous.',
    'Wireframe bodies wrapped in painted silk, lit from the inside and hung at different heights so the flock moves with the wind. Walk the whole loop and look up more than once.': 'Des corps en fil de fer enveloppés de soie peinte, éclairés de l’intérieur et suspendus à différentes hauteurs pour que la volée bouge avec le vent. Faites toute la boucle et levez les yeux plus d’une fois.',
    'Yeti Bend': 'Virage du yéti',
    'Something large came through here.': 'Quelque chose de grand est passé par ici.',
    'The bend is the coldest, quietest stretch of the horse path. Follow the tracks in the snow and see where they lead before you round the corner.': 'Ce virage est le passage le plus froid et le plus silencieux du sentier des chevaux. Suivez les traces dans la neige et voyez où elles mènent avant de tourner le coin.',
    'Polar Tundra': 'Toundra polaire',
    'Bears, ice floes, and very little light.': 'Des ours, des glaces flottantes, et très peu de lumière.',
    'We keep the lighting low here on purpose so your eyes adjust. Give it thirty seconds and the whole field of sculptures comes up out of the dark.': 'La lumière reste basse ici pour que vos yeux s’habituent. Donnez-vous trente secondes et tout le champ de sculptures sort de l’obscurité.',
    'Dragon Roost': 'Perchoir des dragons',
    'Three dragons, and a great many fire lizards.': 'Trois dragons, et beaucoup de lézards de feu.',
    'Three large dragon silk lanterns roost above the path, with a scatter of 3D-printed fire lizards hidden in the rocks below and paper lanterns strung through the trees. Count the lizards if you can.': 'Trois grandes lanternes-dragons de soie se perchent au-dessus du sentier, avec des lézards de feu imprimés cachés dans les roches et des lanternes de papier dans les arbres. Comptez les lézards si vous pouvez.',
    'Deer Sanctuary': 'Sanctuaire des chevreuils',
    'A still herd, glowing between the trees.': 'Un troupeau immobile, lumineux entre les arbres.',
    'Illuminated animal lanterns set back off the path so they read as a real herd at a distance. Stay on the trail and let your eyes find them.': 'Des lanternes animales éclairées, un peu à l’écart du sentier, pour ressembler à un vrai troupeau de loin. Restez sur le sentier et laissez vos yeux les trouver.',
    'Butterfly Garden': 'Jardin des papillons',
    'Hundreds of wings, all lit from within.': 'Des centaines d’ailes, toutes éclairées de l’intérieur.',
    'The garden is the brightest, warmest stop on the horse path — a canopy of silk butterflies on wireframe, colour-cycled slowly so the whole garden breathes.': 'Le jardin est l’arrêt le plus lumineux et le plus chaud du sentier des chevaux — une canopée de papillons de soie sur fil de fer, dont les couleurs changent lentement, comme si le jardin respirait.',
    'Horse Station': 'Station des chevaux',
    'Where the horse-drawn rides load.': 'Là où l’on embarque pour les promenades en calèche.',
    'Rides run on a loop through the horse path when conditions allow. Check the board at the station for tonight’s schedule and wait times.': 'Les promenades font une boucle sur le sentier des chevaux quand les conditions le permettent. Consultez le tableau de la station pour l’horaire et l’attente de ce soir.',
    'Tubing Hill': 'Glissade en chambre à air',
    'Downhill, fast, then walk back up.': 'En descente, vite, puis on remonte à pied.',
    'Grab a tube at the bottom, climb the stairs on the left, and ride the lit lanes down. Riders must be able to hold themselves upright on the tube.': 'Prenez une chambre à air en bas, montez l’escalier à gauche, et descendez les pistes éclairées. Il faut pouvoir se tenir droit sur la chambre à air.',
    'Warming Hut': 'Refuge chauffé',
    'Hot chocolate, fire pits, and the reward counter.': 'Chocolat chaud, feux et comptoir des récompenses.',
    'Warm up here. This is also where you redeem anything you unlock in the app — show your screen at the counter.': 'Réchauffez-vous ici. C’est aussi ici que l’on remet ce que vous débloquez dans l’application — présentez votre écran au comptoir.',
    'Entrance & Ticketing': 'Entrée et billets',
    'Start here. Restrooms on the right.': 'Commencez ici. Toilettes à droite.',
    'Tickets are scanned at the gate. Restrooms, stroller parking, and the lost-and-found are all in this building.': 'Les billets sont scannés à la barrière. Les toilettes, le stationnement des poussettes et les objets trouvés sont dans ce bâtiment.',
  };

  const listeners = new Set();
  let bilingual = false;
  let locale = 'en';

  function venueFromPath() {
    const first = String(location.pathname || '').replace(/^\/+|\/+$/g, '').split('/')[0]?.toLowerCase();
    if (!first || RESERVED.has(first)) return null;
    return first;
  }

  function readSaved() {
    try {
      const saved = localStorage.getItem(KEY);
      return saved === 'en' || saved === 'fr' ? saved : 'fr';
    } catch {
      return 'fr';
    }
  }

  function t(message, vars) {
    const source = message == null ? '' : String(message);
    let text = locale === 'fr' && Object.prototype.hasOwnProperty.call(FR, source) ? FR[source] : source;
    if (!vars) return text;
    return text.replace(/\{(\w+)\}/g, (match, key) => (
      vars[key] == null ? match : String(vars[key])
    ));
  }

  function translateValue(value, key) {
    if (SKIP.has(key)) return value;
    if (typeof value === 'string') {
      if (!value || value.startsWith('/') || value.startsWith('http')) return value;
      return t(value);
    }
    if (Array.isArray(value)) return value.map((item) => translateValue(item, ''));
    if (value && typeof value === 'object') {
      const out = {};
      Object.keys(value).forEach((child) => {
        out[child] = translateValue(value[child], child);
      });
      return out;
    }
    return value;
  }

  function present(station) {
    if (locale !== 'fr' || !station || typeof station !== 'object') return station;
    return translateValue(station, '');
  }

  function applyStatic(root) {
    const scope = root && root.querySelectorAll ? root : document;
    scope.querySelectorAll('[data-i18n]').forEach((node) => {
      node.textContent = t(node.getAttribute('data-i18n'));
    });
    scope.querySelectorAll('[data-i18n-aria]').forEach((node) => {
      node.setAttribute('aria-label', t(node.getAttribute('data-i18n-aria')));
    });
    scope.querySelectorAll('[data-i18n-placeholder]').forEach((node) => {
      node.setAttribute('placeholder', t(node.getAttribute('data-i18n-placeholder')));
    });
    scope.querySelectorAll('[data-i18n-content]').forEach((node) => {
      node.setAttribute('content', t(node.getAttribute('data-i18n-content')));
    });
    const title = document.querySelector('title[data-i18n]');
    if (title) title.textContent = t(title.getAttribute('data-i18n'));
    document.documentElement.lang = locale === 'fr' ? 'fr' : 'en';
  }

  function paintToggle() {
    const root = document.getElementById('langToggle');
    if (!root) return;
    root.hidden = !bilingual;
    document.documentElement.classList.toggle('lang-on', bilingual);
    root.querySelectorAll('[data-lang]').forEach((button) => {
      const on = button.getAttribute('data-lang') === locale;
      button.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  }

  function applyChrome() {
    applyStatic(document);
    paintToggle();
  }

  function emit() {
    listeners.forEach((fn) => {
      try { fn(locale); } catch { /* a listener must not block the switch */ }
    });
  }

  function setLocale(next) {
    if (!bilingual || (next !== 'fr' && next !== 'en') || next === locale) return;
    locale = next;
    try { localStorage.setItem(KEY, next); } catch { /* private mode */ }
    applyChrome();
    emit();
  }

  function useVenue(code, { notify = false } = {}) {
    const nextCode = String(code || venueFromPath() || '').toLowerCase();
    const nextBilingual = nextCode === 'mtl';
    const nextLocale = nextBilingual ? readSaved() : 'en';
    const changed = nextLocale !== locale || nextBilingual !== bilingual;
    bilingual = nextBilingual;
    locale = nextLocale;
    applyChrome();
    if (notify && changed) emit();
  }

  function onChange(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  }

  function covers(message) {
    return Object.prototype.hasOwnProperty.call(FR, message);
  }

  const root = document.getElementById('langToggle');
  root?.addEventListener('click', (event) => {
    const button = event.target.closest('[data-lang]');
    if (!button) return;
    setLocale(button.getAttribute('data-lang'));
  });

  useVenue(venueFromPath());

  return {
    t, present, applyStatic, applyChrome, setLocale, useVenue, onChange, covers,
    locale: () => locale,
    french: () => locale === 'fr',
    bilingual: () => bilingual,
  };
})();

window.Lang = Lang;
