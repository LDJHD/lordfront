const files = [
  'Adekunle Gold, Zinoleesky - Party No Dey Stop (Official Music Video) [VnXq06m9P4g].mp3',
  'Akounan 4 [515GHbr6Qqg].mp3',
  'Azul [_qzHPrcZQrA].mp3',
  'Burna - Daddiest Mix [AcbBf-7tSn0].mp3',
  'Dance KOMPA [W3IJ61hoNQw].mp3',
  'EsDeeKid & Rico Ace - Phantom [hmdzniMJOZs].mp3',
  'Joeboy - Baby (Official Video) [pp6xej5xWfs].mp3',
  'Kabza De Small, Chronical Deep & Dj Maphorisa - Yiyo (Official Audio) feat. Mashudu, Leandra.Vert [n2bwtXLOq1M].mp3',
  'Kodes Feat. Himra - WAWA (CLIP OFFICIEL) [RHqSzSYAcDQ].mp3',
  'Mr Eazi - Patek (feat. DJ Tárico & Joey B) [Official Music Video] [oNXfHRNHllc].mp3',
  'Poco Lee & Seyi Vibez - OPERA MINI (Official Audio) [GkXoVyBWn1o].mp3',
  'Ren - What You Want (Official Music Video) [jrjp4Du0rEc].mp3',
  'Seyi Different Pattern [7lW3CgvqvQU].mp3',
  'T-Wayne - Nasty Freestyle (Official Music Video) [hGKK8eGQQEk].mp3',
  'Trim - Coconut Water (Official Music Video) [s5VG3K05pn8].mp3',
  'TRK-NUMERO-UNO-EXCLU.mp3',
  'TxC, Davido, Shoday & Scotts Maphuma - Nakupenda (Official Music Video) feat. Zlatan & Al Xapo [8JZZvo-gJaU].mp3',
  'Young Jonn - Xtra Cool (Official Music Video) [LWWCj-EbevI].mp3',
]

export type PlaylistTrack = {
  id: string
  title: string
  src: string
}

function trackTitle(filename: string) {
  return filename.replace(/\.mp3$/i, '').replace(/\s*\[[^\]]+\]\s*$/, '').trim()
}

export const GAME_PLAYLIST: PlaylistTrack[] = files.map((file, index) => ({
  id: `track-${index}`,
  title: trackTitle(file),
  src: `/son/${encodeURIComponent(file)}`,
}))
