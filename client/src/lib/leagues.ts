// Rapha Guru — League definitions (isolated to prevent cross-chunk TDZ)
// Pure data file: zero imports, zero side effects.
// Rollup treats files with no imports as side-effect-free and always initializes
// them before files that depend on them.

export const FEATURED_LEAGUES = [
  // Top 5 Europa
  { id: '3918', name: 'Premier League',       country: 'Inglaterra',    flag: '🏴',  code: 'PL'  },
  { id: '740',  name: 'La Liga',              country: 'Espanha',       flag: '🇪🇸', code: 'LL'  },
  { id: '720',  name: 'Bundesliga',           country: 'Alemanha',      flag: '🇩🇪', code: 'BL'  },
  { id: '730',  name: 'Serie A',              country: 'Itália',        flag: '🇮🇹', code: 'SA'  },
  { id: '710',  name: 'Ligue 1',             country: 'França',        flag: '🇫🇷', code: 'L1'  },
  // 2ªs divisões europeias
  { id: '3919', name: 'Championship',         country: 'Inglaterra',    flag: '🏴',  code: 'CH'  },
  { id: '3927', name: '2. Bundesliga',        country: 'Alemanha',      flag: '🇩🇪', code: 'BL2' },
  { id: '3921', name: 'Segunda División',     country: 'Espanha',       flag: '🇪🇸', code: 'SD'  },
  { id: '3931', name: 'Ligue 2',             country: 'França',        flag: '🇫🇷', code: 'L2'  },
  { id: '3930', name: 'Serie B',             country: 'Itália',        flag: '🇮🇹', code: 'SB'  },
  // Outras europeias relevantes
  { id: '725',  name: 'Eredivisie',           country: 'Holanda',       flag: '🇳🇱', code: 'ERE' },
  { id: '715',  name: 'Primeira Liga',        country: 'Portugal',      flag: '🇵🇹', code: 'PPL' },
  { id: '750',  name: 'Süper Lig',           country: 'Turquia',       flag: '🇹🇷', code: 'SL'  },
  { id: '755',  name: 'Pro League',           country: 'Bélgica',       flag: '🇧🇪', code: 'BPL' },
  { id: '735',  name: 'Scottish Premiership', country: 'Escócia',       flag: '🏴󠁧󠁢󠁳󠁣󠁴󠁿', code: 'SPL' },
  { id: '3924', name: 'Bundesliga',           country: 'Áustria',       flag: '🇦🇹', code: 'ABL' },
  { id: '3922', name: 'Super League',         country: 'Grécia',        flag: '🇬🇷', code: 'GSL' },
  { id: '3926', name: 'Superligaen',          country: 'Dinamarca',     flag: '🇩🇰', code: 'DSL' },
  { id: '3933', name: 'Ekstraklasa',          country: 'Polônia',       flag: '🇵🇱', code: 'EKS' },
  { id: '3938', name: 'Allsvenskan',          country: 'Suécia',        flag: '🇸🇪', code: 'ALL' },
  { id: '3939', name: 'Super League',         country: 'Suíça',         flag: '🇨🇭', code: 'SSL' },
  { id: '4326', name: 'Eliteserien',          country: 'Noruega',       flag: '🇳🇴', code: 'ELS' },
  // Competições europeias
  { id: '23',   name: 'Champions League',     country: 'Europa',        flag: '🏆',  code: 'UCL' },
  { id: '2',    name: 'Europa League',        country: 'Europa',        flag: '🏆',  code: 'UEL' },
  { id: '40',   name: 'Conference League',    country: 'Europa',        flag: '🏆',  code: 'UECL'},
  // Américas
  { id: '4351', name: 'Brasileirão Série A',  country: 'Brasil',        flag: '🇧🇷', code: 'BRA' },
  { id: '4352', name: 'Brasileirão Série B',  country: 'Brasil',        flag: '🇧🇷', code: 'BR2' },
  { id: '630',  name: 'Copa do Brasil',       country: 'Brasil',        flag: '🇧🇷', code: 'CDB' },
  { id: '21',   name: 'Libertadores',         country: 'América do Sul',flag: '🌎',  code: 'LIB' },
  { id: '22',   name: 'Sudamericana',         country: 'América do Sul',flag: '🌎',  code: 'SUD' },
  { id: '4356', name: 'Primera División',     country: 'Argentina',     flag: '🇦🇷', code: 'ARG' },
  { id: '4358', name: 'Primera División',     country: 'Chile',         flag: '🇨🇱', code: 'CHI' },
  { id: '4357', name: 'Liga BetPlay',         country: 'Colômbia',      flag: '🇨🇴', code: 'COL' },
  { id: '4355', name: 'Primera División',     country: 'Uruguai',       flag: '🇺🇾', code: 'URU' },
  { id: '770',  name: 'MLS',                  country: 'Estados Unidos', flag: '🇺🇸', code: 'MLS' },
  { id: '760',  name: 'Liga MX',             country: 'México',        flag: '🇲🇽', code: 'LMX' },
  // Ásia e Oriente Médio
  { id: '21231',name: 'Saudi Pro League',     country: 'Arábia Saudita',flag: '🇸🇦', code: 'SPL' },
  { id: '4803', name: 'J1 League',            country: 'Japão',         flag: '🇯🇵', code: 'J1'  },
  { id: '4804', name: 'K League 1',           country: 'Coreia do Sul', flag: '🇰🇷', code: 'KL1' },
  { id: '4820', name: 'Qatar Stars League',   country: 'Catar',         flag: '🇶🇦', code: 'QSL' },
  { id: '4821', name: 'UAE Pro League',       country: 'Emirados',      flag: '🇦🇪', code: 'UAE' },
  { id: '8316', name: 'Indian Super League',  country: 'Índia',         flag: '🇮🇳', code: 'ISL' },
  // Oceania
  { id: '3906', name: 'A-League',             country: 'Austrália',     flag: '🇦🇺', code: 'ALM' },
  { id: '18992',name: 'A-League Women',       country: 'Austrália',     flag: '🇦🇺', code: 'ALW' },
  // Seleções
  { id: '15',   name: 'AFC Asian Cup',        country: 'Ásia',          flag: '🌏',  code: 'AAC' },
  { id: '30',   name: 'AFC Eliminatórias',    country: 'Ásia',          flag: '🌏',  code: 'AFQ' },
  { id: '31',   name: 'OFC Eliminatórias',    country: 'Oceania',       flag: '🌊',  code: 'OFQ' },
  { id: '23537',name: 'AFC Championship',     country: 'Ásia',          flag: '🌏',  code: 'AFC' },
] as const;
