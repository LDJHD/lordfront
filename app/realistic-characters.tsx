'use client'

// ─── Realistic Human Character SVG System ───────────────────────────
// Characters modeled after Z Route Redemption style: realistic survivors
// with military gear, proper human proportions, and detailed features.

export type CharacterRole = 'tank' | 'dps' | 'support' | 'crowd_control' | 'zombie_basic' | 'zombie_runner' | 'zombie_brute' | 'zombie_boss'

export const CHARACTER_CONFIGS: Record<CharacterRole, {
  skinColor: string
  skinShadow: string
  hairColor: string
  outfitColor: string
  outfitDark: string
  vestColor: string
  pantsColor: string
  bootColor: string
  weaponType: 'rifle' | 'shotgun' | 'pistol' | 'knife' | 'staff' | 'claws'
  eyeColor: string
  isZombie: boolean
}> = {
  tank: {
    skinColor: '#d4a574',
    skinShadow: '#b8895c',
    hairColor: '#2a1a0a',
    outfitColor: '#3a5a3a',
    outfitDark: '#2a4a2a',
    vestColor: '#4a6a4a',
    pantsColor: '#3a4a3a',
    bootColor: '#2a2a2a',
    weaponType: 'shotgun',
    eyeColor: '#4a3520',
    isZombie: false,
  },
  dps: {
    skinColor: '#c89868',
    skinShadow: '#a87848',
    hairColor: '#1a0a00',
    outfitColor: '#4a3a2a',
    outfitDark: '#3a2a1a',
    vestColor: '#5a4a3a',
    pantsColor: '#3a3a3a',
    bootColor: '#1a1a1a',
    weaponType: 'rifle',
    eyeColor: '#3a2510',
    isZombie: false,
  },
  support: {
    skinColor: '#deb887',
    skinShadow: '#c49a6c',
    hairColor: '#4a3020',
    outfitColor: '#2a5a4a',
    outfitDark: '#1a4a3a',
    vestColor: '#3a6a5a',
    pantsColor: '#2a4a3a',
    bootColor: '#2a2a2a',
    weaponType: 'pistol',
    eyeColor: '#5a4030',
    isZombie: false,
  },
  crowd_control: {
    skinColor: '#c8a882',
    skinShadow: '#a88862',
    hairColor: '#3a2a1a',
    outfitColor: '#4a3a5a',
    outfitDark: '#3a2a4a',
    vestColor: '#5a4a6a',
    pantsColor: '#3a3a4a',
    bootColor: '#2a2a2a',
    weaponType: 'staff',
    eyeColor: '#4a3525',
    isZombie: false,
  },
  zombie_basic: {
    skinColor: '#7a9a5a',
    skinShadow: '#5a7a3a',
    hairColor: '#3a4a2a',
    outfitColor: '#4a5a3a',
    outfitDark: '#3a4a2a',
    vestColor: '#5a6a4a',
    pantsColor: '#3a4a3a',
    bootColor: '#2a3a2a',
    weaponType: 'claws',
    eyeColor: '#ffff00',
    isZombie: true,
  },
  zombie_runner: {
    skinColor: '#8a7a4a',
    skinShadow: '#6a5a2a',
    hairColor: '#2a1a0a',
    outfitColor: '#5a4a2a',
    outfitDark: '#4a3a1a',
    vestColor: '#6a5a3a',
    pantsColor: '#4a3a2a',
    bootColor: '#2a2a1a',
    weaponType: 'claws',
    eyeColor: '#ff8800',
    isZombie: true,
  },
  zombie_brute: {
    skinColor: '#6a4a3a',
    skinShadow: '#4a2a1a',
    hairColor: '#1a0a00',
    outfitColor: '#4a3a2a',
    outfitDark: '#3a2a1a',
    vestColor: '#5a4a3a',
    pantsColor: '#3a2a1a',
    bootColor: '#1a1a1a',
    weaponType: 'claws',
    eyeColor: '#ff0000',
    isZombie: true,
  },
  zombie_boss: {
    skinColor: '#5a3a2a',
    skinShadow: '#3a1a0a',
    hairColor: '#0a0000',
    outfitColor: '#3a2a1a',
    outfitDark: '#2a1a0a',
    vestColor: '#4a3a2a',
    pantsColor: '#2a1a0a',
    bootColor: '#0a0a0a',
    weaponType: 'claws',
    eyeColor: '#ffff00',
    isZombie: true,
  },
}

// ─── Weapon SVG Parts ───────────────────────────────────────────────

function RifleWeapon({ color = '#4a4a4a' }: { color?: string }) {
  return (
    <g transform="translate(38, 28) rotate(-15)">
      {/* Barrel */}
      <rect x="0" y="2" width="18" height="3" rx="1" fill={color} />
      <rect x="16" y="1" width="4" height="5" rx="1" fill="#333" />
      {/* Body */}
      <rect x="-2" y="4" width="12" height="6" rx="2" fill="#555" />
      {/* Stock */}
      <rect x="-8" y="5" width="8" height="4" rx="2" fill="#3a2a1a" />
      {/* Grip */}
      <rect x="2" y="9" width="3" height="6" rx="1" fill="#2a2a2a" transform="rotate(10, 3, 9)" />
      {/* Magazine */}
      <rect x="4" y="10" width="3" height="5" rx="1" fill="#333" />
      {/* Scope */}
      <rect x="6" y="0" width="6" height="2" rx="1" fill="#222" />
      <circle cx="12" cy="1" r="1.5" fill="#4488ff" opacity="0.6" />
    </g>
  )
}

function ShotgunWeapon() {
  return (
    <g transform="translate(36, 26) rotate(-10)">
      {/* Double barrel */}
      <rect x="0" y="2" width="22" height="2.5" rx="1" fill="#4a4a4a" />
      <rect x="0" y="5" width="22" height="2.5" rx="1" fill="#555" />
      {/* Body */}
      <rect x="-2" y="6" width="10" height="7" rx="2" fill="#5a4a3a" />
      {/* Stock */}
      <rect x="-10" y="7" width="10" height="5" rx="2" fill="#3a2a1a" />
      {/* Grip */}
      <rect x="2" y="12" width="3" height="7" rx="1" fill="#2a2a2a" transform="rotate(15, 3, 12)" />
      {/* Pump */}
      <rect x="10" y="4" width="8" height="3" rx="1" fill="#444" />
    </g>
  )
}

function PistolWeapon() {
  return (
    <g transform="translate(40, 32) rotate(-5)">
      {/* Barrel */}
      <rect x="0" y="0" width="10" height="3" rx="1" fill="#4a4a4a" />
      {/* Body */}
      <rect x="-1" y="3" width="8" height="5" rx="1" fill="#555" />
      {/* Grip */}
      <rect x="1" y="8" width="4" height="6" rx="1" fill="#2a2a2a" transform="rotate(20, 3, 8)" />
      {/* Trigger */}
      <rect x="3" y="6" width="1" height="2" rx="0.5" fill="#333" />
    </g>
  )
}

function KnifeWeapon() {
  return (
    <g transform="translate(42, 30) rotate(-20)">
      {/* Blade */}
      <polygon points="0,0 12,-2 14,0 12,2 0,3" fill="#c0c0c0" />
      <polygon points="0,0 12,-2 14,0" fill="#e0e0e0" />
      {/* Guard */}
      <rect x="-2" y="-1" width="3" height="5" rx="1" fill="#8a6a3a" />
      {/* Handle */}
      <rect x="-6" y="0" width="5" height="3" rx="1" fill="#3a2a1a" />
    </g>
  )
}

function StaffWeapon() {
  return (
    <g transform="translate(42, 20) rotate(-5)">
      {/* Staff */}
      <rect x="0" y="0" width="2.5" height="30" rx="1" fill="#6a5a4a" />
      {/* Energy tip */}
      <circle cx="1.25" cy="-2" r="4" fill="#9b59b6" opacity="0.7" />
      <circle cx="1.25" cy="-2" r="2" fill="#c39bd3" />
      {/* Wrappings */}
      <rect x="-1" y="8" width="4.5" height="1.5" rx="0.5" fill="#4a3a2a" />
      <rect x="-1" y="14" width="4.5" height="1.5" rx="0.5" fill="#4a3a2a" />
    </g>
  )
}

function ClawsWeapon() {
  return (
    <g transform="translate(42, 30) rotate(-10)">
      {/* Claw fingers */}
      <path d="M0,0 L8,-3 L10,-1 L8,1 L0,2Z" fill="#8a7a5a" />
      <path d="M0,3 L9,1 L11,3 L9,5 L0,6Z" fill="#7a6a4a" />
      <path d="M0,6 L8,5 L10,7 L8,9 L0,10Z" fill="#6a5a3a" />
      {/* Hand base */}
      <ellipse cx="-2" cy="5" rx="5" ry="6" fill="#8a7a5a" />
    </g>
  )
}

function WeaponRenderer({ type }: { type: string }) {
  switch (type) {
    case 'rifle': return <RifleWeapon />
    case 'shotgun': return <ShotgunWeapon />
    case 'pistol': return <PistolWeapon />
    case 'knife': return <KnifeWeapon />
    case 'staff': return <StaffWeapon />
    case 'claws': return <ClawsWeapon />
    default: return <RifleWeapon />
  }
}

// ─── Main Realistic Human Character SVG ─────────────────────────────

export function RealisticCharacter({
  role,
  size = 1,
  flip = false,
  animType = 'idle',
  shooting = false,
  damage = false,
  healing = false,
  defending = false,
  dead = false,
}: {
  role: CharacterRole
  size?: number
  flip?: boolean
  animType?: 'idle' | 'walk' | 'run' | 'attack' | 'hurt' | 'death'
  shooting?: boolean
  damage?: boolean
  healing?: boolean
  defending?: boolean
  dead?: boolean
}) {
  const config = CHARACTER_CONFIGS[role]
  const animClass = dead ? 'dead' : damage ? 'hurt' : healing ? 'heal' : shooting ? 'shooting' : animType

  return (
    <div
      className={`realistic-char ${animClass}`}
      style={{
        width: 60 * size,
        height: 90 * size,
        transform: `scale(1) ${flip ? 'scaleX(-1)' : ''}`,
        position: 'relative',
      }}
    >
      <svg
        viewBox="0 0 60 90"
        width={60 * size}
        height={90 * size}
        style={{ overflow: 'visible' }}
      >
        <defs>
          {/* Shadow gradient */}
          <radialGradient id={`shadow-${role}`} cx="50%" cy="50%">
            <stop offset="0%" stopColor="#000" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#000" stopOpacity="0" />
          </radialGradient>
          {/* Skin gradient */}
          <linearGradient id={`skin-${role}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={config.skinColor} />
            <stop offset="100%" stopColor={config.skinShadow} />
          </linearGradient>
          {/* Outfit gradient */}
          <linearGradient id={`outfit-${role}`} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={config.outfitColor} />
            <stop offset="100%" stopColor={config.outfitDark} />
          </linearGradient>
          {/* Heal glow */}
          {healing && (
            <filter id={`glow-${role}`}>
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          )}
        </defs>

        {/* Ground shadow */}
        <ellipse cx="30" cy="87" rx="14" ry="4" fill={`url(#shadow-${role})`} />

        {/* ── LEGS ── */}
        <g className="char-legs">
          {/* Left leg */}
          <rect x="22" y="58" width="8" height="22" rx="3" fill={config.pantsColor} />
          {/* Left boot */}
          <rect x="20" y="76" width="11" height="8" rx="3" fill={config.bootColor} />
          <rect x="20" y="76" width="11" height="3" rx="2" fill="#3a3a3a" />

          {/* Right leg */}
          <rect x="30" y="58" width="8" height="22" rx="3" fill={config.pantsColor} />
          {/* Right boot */}
          <rect x="29" y="76" width="11" height="8" rx="3" fill={config.bootColor} />
          <rect x="29" y="76" width="11" height="3" rx="2" fill="#3a3a3a" />

          {/* Knee pads */}
          <ellipse cx="26" cy="66" rx="4" ry="3" fill={config.pantsColor} opacity="0.8" />
          <ellipse cx="34" cy="66" rx="4" ry="3" fill={config.pantsColor} opacity="0.8" />
        </g>

        {/* ── TORSO ── */}
        <g className="char-torso">
          {/* Main body */}
          <rect x="18" y="32" width="24" height="28" rx="4" fill={`url(#outfit-${role})`} />

          {/* Tactical vest */}
          <rect x="19" y="33" width="22" height="14" rx="3" fill={config.vestColor} />
          {/* Vest straps */}
          <line x1="22" y1="33" x2="22" y2="47" stroke="#333" strokeWidth="1" />
          <line x1="38" y1="33" x2="38" y2="47" stroke="#333" strokeWidth="1" />
          {/* Vest buckle */}
          <rect x="27" y="38" width="6" height="4" rx="1" fill="#888" />

          {/* Belt */}
          <rect x="18" y="56" width="24" height="4" rx="1" fill="#3a2a1a" />
          <circle cx="30" cy="58" r="2" fill="#8a7a5a" />

          {/* Pouches on vest */}
          <rect x="20" y="42" width="5" height="4" rx="1" fill={config.outfitDark} />
          <rect x="35" y="42" width="5" height="4" rx="1" fill={config.outfitDark} />

          {/* Shield effect when defending */}
          {defending && (
            <ellipse cx="30" cy="45" rx="20" ry="25" fill="none" stroke="#4a90d9" strokeWidth="2" opacity="0.6">
              <animate attributeName="opacity" values="0.3;0.7;0.3" dur="0.8s" repeatCount="indefinite" />
            </ellipse>
          )}
        </g>

        {/* ── ARMS ── */}
        <g className="char-arms">
          {/* Left arm */}
          <rect x="10" y="34" width="9" height="20" rx="4" fill={config.outfitColor} />
          {/* Left hand */}
          <ellipse cx="14" cy="54" rx="4" ry="4" fill={`url(#skin-${role})`} />

          {/* Right arm (holding weapon) */}
          <rect x="41" y="34" width="9" height="20" rx="4" fill={config.outfitColor} />
          {/* Right hand */}
          <ellipse cx="46" cy="54" rx="4" ry="4" fill={`url(#skin-${role})`} />

          {/* Weapon */}
          <WeaponRenderer type={config.weaponType} />
        </g>

        {/* ── HEAD ── */}
        <g className="char-head">
          {/* Neck */}
          <rect x="26" y="28" width="8" height="6" rx="2" fill={`url(#skin-${role})`} />

          {/* Head shape */}
          <ellipse cx="30" cy="20" rx="11" ry="12" fill={`url(#skin-${role})`} />

          {/* Hair */}
          <ellipse cx="30" cy="14" rx="11" ry="7" fill={config.hairColor} />
          <rect x="19" y="14" width="22" height="4" rx="2" fill={config.hairColor} />

          {/* Ears */}
          <ellipse cx="19" cy="20" rx="2" ry="3" fill={config.skinColor} />
          <ellipse cx="41" cy="20" rx="2" ry="3" fill={config.skinColor} />

          {/* Face details */}
          {/* Eyes */}
          <ellipse cx="25" cy="19" rx="3" ry="2.5" fill="#fff" />
          <ellipse cx="35" cy="19" rx="3" ry="2.5" fill="#fff" />
          <circle cx="25" cy="19" r="1.8" fill={config.eyeColor} />
          <circle cx="35" cy="19" r="1.8" fill={config.eyeColor} />
          <circle cx="25.5" cy="18.5" r="0.8" fill="#000" />
          <circle cx="35.5" cy="18.5" r="0.8" fill="#000" />
          {/* Eye highlights */}
          <circle cx="26" cy="18" r="0.5" fill="#fff" />
          <circle cx="36" cy="18" r="0.5" fill="#fff" />

          {/* Eyebrows */}
          <path d="M22,15 Q25,13 28,15" stroke={config.hairColor} strokeWidth="1.5" fill="none" />
          <path d="M32,15 Q35,13 38,15" stroke={config.hairColor} strokeWidth="1.5" fill="none" />

          {/* Nose */}
          <path d="M29,21 Q30,24 31,21" stroke={config.skinShadow} strokeWidth="1" fill="none" />

          {/* Mouth */}
          <path d="M26,25 Q30,27 34,25" stroke="#a0705a" strokeWidth="1.2" fill="none" />

          {/* Zombie features */}
          {config.isZombie && (
            <>
              {/* Zombie eyes (glowing) */}
              <circle cx="25" cy="19" r="2.5" fill={config.eyeColor} opacity="0.8">
                <animate attributeName="opacity" values="0.5;1;0.5" dur="1.5s" repeatCount="indefinite" />
              </circle>
              <circle cx="35" cy="19" r="2.5" fill={config.eyeColor} opacity="0.8">
                <animate attributeName="opacity" values="0.5;1;0.5" dur="1.5s" repeatCount="indefinite" />
              </circle>
              {/* Zombie mouth (open, showing teeth) */}
              <path d="M24,24 Q30,30 36,24" stroke="#3a1a0a" strokeWidth="1.5" fill="#2a0a0a" />
              {/* Zombie wounds */}
              <path d="M20,35 L22,38 L19,40" stroke="#4a2a1a" strokeWidth="1" fill="none" />
              <circle cx="38" cy="40" r="2" fill="#4a2a1a" opacity="0.6" />
            </>
          )}

          {/* Death state */}
          {dead && (
            <g>
              <line x1="22" y1="17" x2="28" y2="21" stroke="#000" strokeWidth="1.5" />
              <line x1="28" y1="17" x2="22" y2="21" stroke="#000" strokeWidth="1.5" />
              <line x1="32" y1="17" x2="38" y2="21" stroke="#000" strokeWidth="1.5" />
              <line x1="38" y1="17" x2="32" y2="21" stroke="#000" strokeWidth="1.5" />
            </g>
          )}
        </g>

        {/* ── MUZZLE FLASH ── */}
        {shooting && (
          <g className="muzzle-flash-anim">
            <circle cx="52" cy="30" r="6" fill="#ffdd00" opacity="0.9">
              <animate attributeName="r" values="4;8;4" dur="0.1s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="1;0.5;1" dur="0.1s" repeatCount="indefinite" />
            </circle>
            <circle cx="52" cy="30" r="3" fill="#fff" opacity="0.8">
              <animate attributeName="r" values="2;5;2" dur="0.1s" repeatCount="indefinite" />
            </circle>
          </g>
        )}

        {/* ── HEAL EFFECT ── */}
        {healing && (
          <g>
            <circle cx="30" cy="30" r="15" fill="#2ecc71" opacity="0.2">
              <animate attributeName="r" values="10;20;10" dur="1s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="0.3;0.1;0.3" dur="1s" repeatCount="indefinite" />
            </circle>
            <text x="30" y="35" textAnchor="middle" fontSize="14" fill="#2ecc71">+</text>
          </g>
        )}
      </svg>
    </div>
  )
}

// ─── Animated Scene Characters ──────────────────────────────────────

export function SurvivorTeam({
  survivors,
  isShooting,
  isSprinting,
}: {
  survivors: { role: CharacterRole; hp: number; maxHp: number; name: string; alive: boolean; defending: boolean }[]
  isShooting: boolean
  isSprinting: boolean
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center' }}>
      {survivors.map((s, i) => (
        <div key={i} style={{ textAlign: 'center' }}>
          <RealisticCharacter
            role={s.role}
            size={0.9}
            animType={isSprinting ? 'run' : isShooting ? 'idle' : 'idle'}
            shooting={isShooting && s.alive}
            defending={s.defending}
            dead={!s.alive}
          />
          <div style={{ marginTop: 4, fontSize: 10, color: '#d2c8db', fontFamily: 'DM Mono' }}>
            {s.name}
          </div>
          <div style={{ width: 50, height: 4, background: '#ffffff18', borderRadius: 2, margin: '2px auto', overflow: 'hidden' }}>
            <div style={{ width: `${(s.hp / s.maxHp) * 100}%`, height: '100%', background: s.hp > s.maxHp * 0.3 ? '#2ecc71' : '#e74c3c', borderRadius: 2, transition: 'width 0.3s' }} />
          </div>
          <div style={{ fontSize: 9, color: '#8a7a92', fontFamily: 'DM Mono' }}>{s.hp}/{s.maxHp}</div>
        </div>
      ))}
    </div>
  )
}

export function ZombieHorde({
  zombies,
  isAttacking,
}: {
  zombies: { type: CharacterRole; hp: number; maxHp: number; alive: boolean }[]
  isAttacking: boolean
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center' }}>
      {zombies.filter(z => z.alive).map((z, i) => (
        <div key={i} style={{ textAlign: 'center' }}>
          <RealisticCharacter
            role={z.type}
            size={z.type === 'zombie_boss' ? 1.1 : z.type === 'zombie_brute' ? 1.0 : 0.85}
            flip
            animType={isAttacking ? 'attack' : 'walk'}
            damage={isAttacking}
          />
          <div style={{ width: 50, height: 4, background: '#ffffff18', borderRadius: 2, margin: '2px auto', overflow: 'hidden' }}>
            <div style={{ width: `${(z.hp / z.maxHp) * 100}%`, height: '100%', background: '#e74c3c', borderRadius: 2, transition: 'width 0.3s' }} />
          </div>
          <div style={{ fontSize: 9, color: '#8a7a92', fontFamily: 'DM Mono' }}>{z.hp}/{z.maxHp}</div>
        </div>
      ))}
    </div>
  )
}
