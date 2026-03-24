import { prisma } from "@/lib/db";
import { normalizeToken, slugify } from "@/lib/utils";

const KAITO_PROJECT_SOURCE = "kaito-selected";
const CANONICAL_NAME_OVERRIDES = new Map<string, string>([
  ["billions network", "Billions"],
  ["thrive protocol", "Thrive"],
  ["verse 8", "VerseEight"]
]);
const EXTRA_SEED_PROJECTS = [
  {
    name: "3look",
    aliases: ["3look", "3look_io", "3look.io"],
    source: KAITO_PROJECT_SOURCE
  },
  {
    name: "Dgrid",
    aliases: ["dgrid", "dgrid_ai", "dgrid.ai"],
    source: KAITO_PROJECT_SOURCE
  },
  {
    name: "Elsa AI",
    aliases: ["Elsa AI", "HeyElsaAI", "Elsa"],
    source: KAITO_PROJECT_SOURCE
  },
  {
    name: "Fluxa",
    aliases: ["Fluxa", "FluxaPay", "fluxapay"],
    source: KAITO_PROJECT_SOURCE
  },
  {
    name: "ForU AI",
    aliases: ["ForU AI", "foruai"],
    source: KAITO_PROJECT_SOURCE
  },
  {
    name: "idOS",
    aliases: ["idOS", "idOS_network"],
    source: KAITO_PROJECT_SOURCE
  },
  {
    name: "Nasun",
    aliases: ["Nasun", "Nasun_io"],
    source: KAITO_PROJECT_SOURCE
  },
  {
    name: "Perle Labs",
    aliases: ["Perle Labs", "PerleLabs", "PerleAI", "Perle AI"],
    source: KAITO_PROJECT_SOURCE
  },
  {
    name: "Rayls Labs",
    aliases: ["Rayls Labs", "RaylsLabs", "Rayls"],
    source: KAITO_PROJECT_SOURCE
  },
  {
    name: "XOOB",
    aliases: ["XOOB", "XOOBNetwork"],
    source: KAITO_PROJECT_SOURCE
  }
] satisfies KaitoSeedProject[];

const KAITO_PROJECT_TEXT = `
L0/L1
24
menu_logo
Aptos
menu_logo
Beldex
menu_logo
Berachain
menu_logo
Camp Network
menu_logo
Ethereum
menu_logo
Fogo
menu_logo
Injective
menu_logo
Integra
menu_logo
Irys
menu_logo
Kaia
menu_logo
MANTRA
menu_logo
Mavryk
menu_logo
Mitosis
menu_logo
Monad
menu_logo
Movement
menu_logo
Near
menu_logo
Nesa
menu_logo
PEAQ
menu_logo
Polkadot
menu_logo
Sei
menu_logo
Somnia
menu_logo
Sonic
menu_logo
Story
menu_logo
XION
AI Agents
9
menu_logo
CreatorBid
menu_logo
INFINIT
menu_logo
Surf
menu_logo
Symphony
menu_logo
Talus
menu_logo
Theoriq
menu_logo
Virtuals Protocol
menu_logo
Warden Protocol
menu_logo
Wayfinder
Culture
7
menu_logo
ANIME
menu_logo
Boop
menu_logo
Doodles
menu_logo
Loaded Lions
menu_logo
MemeX
menu_logo
Moonbirds
menu_logo
PENGU
BTCFi
5
menu_logo
Corn
menu_logo
GOAT Network
menu_logo
Lombard
menu_logo
Portal to BTC
menu_logo
SatLayer
Robotics
1
menu_logo
Fabric
L2
6
menu_logo
Arbitrum
menu_logo
Katana
menu_logo
Mantle
menu_logo
MegaETH
menu_logo
Polygon
menu_logo
SOON
DeFi
11
menu_logo
Falcon Finance
menu_logo
Frax
menu_logo
Huma
menu_logo
Multipli
menu_logo
Noble
menu_logo
Orderly
menu_logo
Pyth
menu_logo
Soul Protocol
menu_logo
STBL
menu_logo
Turtle Club
menu_logo
Walrus
ZK
8
menu_logo
Boundless
menu_logo
Brevis
menu_logo
Cysic
menu_logo
Miden
menu_logo
Starknet
menu_logo
Succinct
menu_logo
Zcash
menu_logo
zkPass
Others
8
menu_logo
Anoma
menu_logo
Bless
menu_logo
Bybit TradFi
menu_logo
Humanity Protocol
menu_logo
Multibank
menu_logo
Newton
menu_logo
Pudgy Party
menu_logo
Thrive Protocol
Exchange
9
menu_logo
ApeX
menu_logo
Bluefin
menu_logo
dYdX
menu_logo
Ferra
menu_logo
Flipster
menu_logo
MemeMax
menu_logo
Momentum
menu_logo
PARADEX
menu_logo
StandX
AI
20
menu_logo
Kaito
menu_logo
0G
menu_logo
Allora
menu_logo
Billions Network
menu_logo
Edgen
menu_logo
EverlynAI
menu_logo
Inference Labs
menu_logo
IQ
menu_logo
Kindred
menu_logo
Mira Network
menu_logo
Novastro
menu_logo
Noya.ai
menu_logo
OpenGradient
menu_logo
OpenLedger
menu_logo
PiP World
menu_logo
PlayAI
menu_logo
Sapien
menu_logo
Sentient
menu_logo
UXLINK
menu_logo
Verse 8
Consumer
17
menu_logo
Tria
menu_logo
Anichess
menu_logo
Bitdealer
menu_logo
Defi App
menu_logo
Hana
menu_logo
Infinex
menu_logo
Lumiterra
menu_logo
MapleStory Universe
menu_logo
Metawin
menu_logo
Parti
menu_logo
Puffpaw
menu_logo
Rainbow
menu_logo
Sidekick
menu_logo
SIXR Cricket
menu_logo
Sophon
menu_logo
Vultisig
menu_logo
YEET
Interop
4
menu_logo
Caldera
menu_logo
Initia
menu_logo
Skate
menu_logo
Union
RWA
2
menu_logo
KAIO
menu_logo
Theo
Historical Data
24H
WTD
MTD
QTD
YTD
Selected Project
logo
Polymarket
POLYMARKET
logo
BASE
BASE
logo
MetaMask
MASK
logo
OpenSea
OPENSEA
logo
MegaETH
MEGAETH
logo
Farcaster
FARCASTER
logo
Abstract
ABSTRACT
logo
Katana
KATANA
logo
Backpack
BACKPACK
logo
Ostium Labs
OSTIUMLABS
logo
Rabby Wallet
RABBY
logo
Miden
MIDEN
logo
Billions
BILLIONS
logo
Wallchain
WALLCHAIN
logo
MYRIAD
MYR
logo
MemeMax
MEMEMAX
logo
Morph
MORPH
logo
Ethos Network
ETHOSNETWORK
logo
StandX
STANDX
logo
gigaverse
GIGAVERSE
logo
YEET
YEET
logo
Symbiotic
SYMBIOTIC
logo
objkt
OBJKT
logo
Theo
THEO
logo
Surf
SURF
logo
CAP
CAP
logo
Nous Research
NOUS
logo
Photon
PHOTON
logo
GTE
GTE
logo
Reya Labs
REYA
logo
edgeX
EDGEX
logo
Bungee
BUNGEE
logo
Noble
NOBLE
logo
LumiTerra
LUMITERRA
logo
Chaos
CHAOS
logo
METAWIN
METAWIN
logo
gensyn
GENSYN
logo
MemeX
MEMEX
logo
Flipster
FLIPSTER
logo
Multipli
MULTIPLI
logo
Fhenix
FHENIX
logo
Polynomial
POLYNOMIAL
logo
BasedApp
BASEDAPP
logo
Noise
NOISE
logo
Puffpaw
PUFFPAW
logo
Solstice
SOLSTICE
logo
Bantr
BANTR
logo
Variational
VARIATIONAL
logo
Hyperbolic
HYPERBOLIC
logo
Project X
PROJECTX
logo
OpenGradient
OPENGRADIENT
logo
Inference Labs
INFERENCELABS
logo
Spaace
SPAACE
logo
Arc
ARC
logo
Mellow Protocol
MELLOWPROTOCOL
logo
commonware
COMMONWARE
logo
timefun
TIMEFUN
logo
Fluent
FLUENT
logo
Polymer Labs
POLYMER
logo
Fableborne
FABLEBORNE
logo
MoreMarkets
MOREMARKETS
logo
Socket Protocol
SOCKET
logo
Huddle01
HUDDLE01
logo
Symphony
SYMPHONY
logo
Multiplier
MULTIPLIER
logo
Thrive
THRIVE
logo
Glider
GLIDER
logo
KAIO
KAIO
logo
Botanix Labs
BOTANIXLABS
logo
Swarm
SWARM
logo
Kuru
KURU
logo
NOYA.ai
NOYA
logo
Aligned Layer
ALIGNEDLAYER
logo
Upshift
UPSHIFT
logo
fxhash
FXHASH
logo
Soul Labs
SOUL
logo
Space
SPACE
logo
BitRobot
BITROBOT
logo
Fairblock
FAIRBLOCK
logo
Wasabi
WASABI
logo
Inco
INCO
logo
Magpie Protocol
MAGPIEPROTOCOL
logo
Linera
LINERA
logo
SIXR Cricket
SIXR
logo
Questflow
QUESTFLOW
logo
ECOx
ECOX
logo
Mezo
MEZO
logo
RISE
RISE
logo
XO Market
XOMARKET
logo
Ferra
FERRA
logo
Tabi
TABI
logo
Tari
TARI
logo
Rialo
RIALO
logo
Layer N
LAYERN
logo
Genome
GENOME
logo
DogeOS
DOGEOS
logo
Level
LEVEL
logo
Holonym
HOLONYM
logo
Nexus Laboratories
NEXUSLABORATORIES
logo
Blackbird
BLACKBIRD
logo
integra
INTEGRA
logo
PIN AI
PINAI
logo
Beyond
BEYOND
logo
VerseEight
VERSEEIGHT
logo
Seismic
SEISMIC
logo
Hinkal
HINKAL
logo
PiP World
PIPWORLD
logo
Yupp
YUPP
logo
Gopher
GOPHER
logo
Nesa
NESA
logo
WILDCARD
WILDCARD
logo
ambient
AMBIENT
logo
Superposition
SPO
logo
Edgen
EDGEN
logo
wingbits
WINGBITS
logo
eOracle
EORACLE
logo
Narra
NARRA
logo
Nubit
NUBIT
logo
ManifestNetwork
MANIFESTNETWORK
logo
Trojan on Solana
TROJAN
logo
SOMO
SOMO
logo
PARTY ICONS
PARTYICONS
logo
MetaLend
METALEND
logo
GoldenGoose
GOLDENGOOSE
logo
BetHog
BETHOG
logo
auradotmoney
AURADOTMONEY
logo
TREX
TREX
logo
Mawari
MAWARI
logo
Quranium
QURANIUM
logo
Aegis
AEGIS
logo
ProjectZero
PROJECTZERO
logo
Cashmere Labs
CASHMERE
logo
PARTI
PARTI
logo
Lowlife Forms
SPICE
logo
Loky Agent Infra
LOKY
logo
GOAT Gaming
GOAT
logo
GVNR
GVNR
logo
bythen
BYTHEN
logo
MOONBERG
MOONBERG
logo
Inception
INCEPTION
logo
Shogun
SHOGUN
logo
Ping
PING
logo
Loop
LOOP
logo
YOAKE
YOAKE
logo
vVv
VVV
logo
WeBera Finance
WEBERA
logo
CYCLENETWORK
CYCLENETWORK
logo
Incentiv
INC
logo
Bluff
BLUFF
logo
Belief Market
BELIEFMARKET
logo
Shatterpoint
SHATTERPOINT
logo
Atlantis
ATLANTIS
logo
Me3Labs
ME3LABS
logo
Minterest
MINTY
logo
Palio
PALIO
logo
ChronosWorlds
CHRONOSWORLDS
logo
Kiva Ai
KIVAAI
logo
Imua
IMUA
logo
GamerBoom
GAMERBOOM
logo
EveOnline
EVEONLINE
logo
ImmortalRising2
IMMORTALRISING2
logo
Record
RECORD
logo
Luffa
LUFFA
logo
XForge
XFORGE
logo
Favrr
FAVRR
logo
Zoop
ZOOP
logo
AssetLink
ASET
logo
Endless
ENDLESS
logo
JunkyBets
JUNKYBETS
logo
HubsAI
HUBSAI
logo
Bion
BION
logo
Yolo.ex
YOLOEX
logo
Parity
PARITY
logo
CHIPS
CHIPS
logo
Airdrop Acres
AIRDROPACRES
logo
MAXBID
MAXBID
logo
Kibble
KIBBLE
logo
10Planet
10PLANET
logo
Hyperfluid
HYPERFLUID
logo
Endemic
ENDEMIC
`;

function titleCaseWords(input: string) {
  if (!input) {
    return input;
  }

  if (/[A-Z].*[a-z]|[a-z].*[A-Z]/.test(input) || /[0-9]/.test(input) || input.includes(".")) {
    return input;
  }

  if (input === input.toUpperCase()) {
    return input;
  }

  return input
    .split(/\s+/)
    .map((part) => (part ? `${part[0]!.toUpperCase()}${part.slice(1).toLowerCase()}` : part))
    .join(" ");
}

function preferName(existing: string, incoming: string) {
  const existingLooksRaw = existing === existing.toLowerCase() || existing === existing.toUpperCase();
  const incomingLooksBetter = incoming !== incoming.toLowerCase() && incoming !== incoming.toUpperCase();

  if (existingLooksRaw && incomingLooksBetter) {
    return incoming;
  }

  if (incoming.length > existing.length && normalizeToken(incoming) === normalizeToken(existing)) {
    return incoming;
  }

  return existing;
}

function isTickerCandidate(value: string) {
  const compact = value.replace(/\s+/g, "");
  return compact.length >= 2 && compact.length <= 18 && compact === compact.toUpperCase();
}

export interface KaitoSeedProject {
  name: string;
  aliases: string[];
  source: string;
}

export function parseKaitoProjectSeed(text = KAITO_PROJECT_TEXT): KaitoSeedProject[] {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const seeds = new Map<string, { name: string; aliases: Set<string> }>();

  const upsertSeed = (name: string, extraAliases: string[] = []) => {
    const overrideName = CANONICAL_NAME_OVERRIDES.get(normalizeToken(name)) ?? name;
    const normalizedName = normalizeToken(overrideName);
    if (!normalizedName) {
      return;
    }

    const preferredName = titleCaseWords(overrideName);
    const record = seeds.get(normalizedName) ?? { name: preferredName, aliases: new Set<string>() };
    record.name = preferName(record.name, preferredName);
    record.aliases.add(record.name);
    record.aliases.add(name);

    for (const alias of extraAliases.map((entry) => entry.trim()).filter(Boolean)) {
      record.aliases.add(alias);
    }

    seeds.set(normalizedName, record);
  };

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];

    if (line === "menu_logo") {
      const projectName = lines[index + 1];
      if (projectName) {
        upsertSeed(projectName);
        index += 1;
      }
      continue;
    }

    if (line === "logo") {
      const projectName = lines[index + 1];
      const ticker = lines[index + 2];
      if (projectName) {
        const aliases = [];
        if (ticker && isTickerCandidate(ticker)) {
          aliases.push(ticker);
        }
        upsertSeed(projectName, aliases);
        index += ticker ? 2 : 1;
      }
    }
  }

  for (const project of EXTRA_SEED_PROJECTS) {
    upsertSeed(project.name, project.aliases);
  }

  return [...seeds.values()]
    .map((entry) => ({
      name: entry.name,
      aliases: [...entry.aliases].sort((left, right) => left.localeCompare(right)),
      source: KAITO_PROJECT_SOURCE
    }))
    .sort((left, right) => left.name.localeCompare(right.name));
}

function getSyntheticProjectId(name: string) {
  const normalized = normalizeToken(name);
  let hash = 17;
  for (let index = 0; index < normalized.length; index += 1) {
    hash = (hash * 31 + normalized.charCodeAt(index)) >>> 0;
  }
  return -1 * (100000 + (hash % 900000000));
}

export async function syncKaitoProjectSeed() {
  const seedProjects = parseKaitoProjectSeed();
  const existingProjects = await prisma.project.findMany({
    include: { aliases: true }
  });

  const projectByAlias = new Map<string, { id: string; aliases: Set<string> }>();
  for (const project of existingProjects) {
    const aliases = new Set<string>([
      project.name,
      ...(project.username ? [project.username] : []),
      ...project.aliases.map((alias) => alias.alias)
    ]);

    for (const alias of aliases) {
      const normalizedAlias = normalizeToken(alias);
      if (!normalizedAlias) {
        continue;
      }
      projectByAlias.set(normalizedAlias, {
        id: project.id,
        aliases
      });
    }
  }

  let created = 0;
  let updated = 0;

  for (const seed of seedProjects) {
    const matchedProject =
      projectByAlias.get(normalizeToken(seed.name)) ??
      seed.aliases.map((alias) => projectByAlias.get(normalizeToken(alias))).find(Boolean);

    if (matchedProject) {
      const missingAliases = seed.aliases.filter((alias) => !matchedProject.aliases.has(alias));
      if (missingAliases.length > 0) {
        await prisma.projectAlias.createMany({
          data: missingAliases.map((alias) => ({
            projectId: matchedProject.id,
            alias,
            normalizedAlias: normalizeToken(alias)
          })),
          skipDuplicates: true
        });
        updated += 1;
      }
      continue;
    }

    const project = await prisma.project.upsert({
      where: { projectId: getSyntheticProjectId(seed.name) },
      update: {
        name: seed.name,
        userkey: `external:kaito:selected:${slugify(seed.name)}`,
        description: "Imported from Kaito project leaderboards seed.",
        raw: {
          source: seed.source,
          aliases: seed.aliases
        } as any
      },
      create: {
        projectId: getSyntheticProjectId(seed.name),
        userkey: `external:kaito:selected:${slugify(seed.name)}`,
        name: seed.name,
        username: null,
        description: "Imported from Kaito project leaderboards seed.",
        totalVotes: 0,
        uniqueVoters: 0,
        bullishVotes: 0,
        bearishVotes: 0,
        commentCount: 0,
        categories: [],
        chains: [],
        raw: {
          source: seed.source,
          aliases: seed.aliases
        } as any
      }
    });

    await prisma.projectAlias.createMany({
      data: seed.aliases.map((alias) => ({
        projectId: project.id,
        alias,
        normalizedAlias: normalizeToken(alias)
      })),
      skipDuplicates: true
    });

    created += 1;
  }

  return {
    total: seedProjects.length,
    created,
    updated
  };
}

export async function ensureKaitoProjectSeed() {
  const existing = await prisma.project.findFirst({
    where: {
      userkey: {
        startsWith: "external:kaito:selected:"
      }
    },
    select: {
      id: true
    }
  });

  if (existing) {
    return {
      total: parseKaitoProjectSeed().length,
      created: 0,
      updated: 0
    };
  }

  return syncKaitoProjectSeed();
}
