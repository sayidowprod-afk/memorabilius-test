export type Sport = 'nba' | 'nfl' | 'mlb' | 'nhl' | 'football'
export type FootballLeague = 'premier-league' | 'bundesliga' | 'serie-a' | 'laliga' | 'ligue-1'

export interface SportsTeam {
  id: string        // format "nba:LAL" or "football:ARS"
  sport: Sport
  abbr: string
  name: string
  color: string
  league?: FootballLeague
  logoUrl?: string  // override ESPN CDN (used for football)
}

// ESPN CDN logo URL — accepts a team object or (sport, abbr)
export function teamLogoUrl(teamOrSport: SportsTeam | Sport, abbr?: string): string {
  if (typeof teamOrSport === 'object') {
    return teamOrSport.logoUrl
      || `https://a.espncdn.com/i/teamlogos/${teamOrSport.sport}/500/${teamOrSport.abbr.toLowerCase()}.png`
  }
  return `https://a.espncdn.com/i/teamlogos/${teamOrSport}/500/${abbr!.toLowerCase()}.png`
}

const espnSoccer = (id: number) => `https://a.espncdn.com/i/teamlogos/soccer/500/${id}.png`

export const SPORTS_TEAMS: SportsTeam[] = [
  // NBA
  { id: 'nba:ATL', sport: 'nba', abbr: 'ATL', name: 'Atlanta Hawks',           color: '#E03A3E' },
  { id: 'nba:BOS', sport: 'nba', abbr: 'BOS', name: 'Boston Celtics',           color: '#007A33' },
  { id: 'nba:BKN', sport: 'nba', abbr: 'BKN', name: 'Brooklyn Nets',            color: '#000000' },
  { id: 'nba:CHA', sport: 'nba', abbr: 'CHA', name: 'Charlotte Hornets',        color: '#00788C' },
  { id: 'nba:CHI', sport: 'nba', abbr: 'CHI', name: 'Chicago Bulls',            color: '#CE1141' },
  { id: 'nba:CLE', sport: 'nba', abbr: 'CLE', name: 'Cleveland Cavaliers',      color: '#860038' },
  { id: 'nba:DAL', sport: 'nba', abbr: 'DAL', name: 'Dallas Mavericks',         color: '#00538C' },
  { id: 'nba:DEN', sport: 'nba', abbr: 'DEN', name: 'Denver Nuggets',           color: '#0E2240' },
  { id: 'nba:DET', sport: 'nba', abbr: 'DET', name: 'Detroit Pistons',          color: '#C8102E' },
  { id: 'nba:GSW', sport: 'nba', abbr: 'GSW', name: 'Golden State Warriors',    color: '#1D428A' },
  { id: 'nba:HOU', sport: 'nba', abbr: 'HOU', name: 'Houston Rockets',          color: '#CE1141' },
  { id: 'nba:IND', sport: 'nba', abbr: 'IND', name: 'Indiana Pacers',           color: '#002D62' },
  { id: 'nba:LAC', sport: 'nba', abbr: 'LAC', name: 'LA Clippers',              color: '#C8102E' },
  { id: 'nba:LAL', sport: 'nba', abbr: 'LAL', name: 'Los Angeles Lakers',       color: '#552583' },
  { id: 'nba:MEM', sport: 'nba', abbr: 'MEM', name: 'Memphis Grizzlies',        color: '#5D76A9' },
  { id: 'nba:MIA', sport: 'nba', abbr: 'MIA', name: 'Miami Heat',               color: '#98002E' },
  { id: 'nba:MIL', sport: 'nba', abbr: 'MIL', name: 'Milwaukee Bucks',          color: '#00471B' },
  { id: 'nba:MIN', sport: 'nba', abbr: 'MIN', name: 'Minnesota Timberwolves',   color: '#0C2340' },
  { id: 'nba:NOP', sport: 'nba', abbr: 'NOP', name: 'New Orleans Pelicans',     color: '#0C2340' },
  { id: 'nba:NYK', sport: 'nba', abbr: 'NYK', name: 'New York Knicks',          color: '#006BB6' },
  { id: 'nba:OKC', sport: 'nba', abbr: 'OKC', name: 'Oklahoma City Thunder',    color: '#007AC1' },
  { id: 'nba:ORL', sport: 'nba', abbr: 'ORL', name: 'Orlando Magic',            color: '#0077C0' },
  { id: 'nba:PHI', sport: 'nba', abbr: 'PHI', name: 'Philadelphia 76ers',       color: '#006BB6' },
  { id: 'nba:PHX', sport: 'nba', abbr: 'PHX', name: 'Phoenix Suns',             color: '#1D1160' },
  { id: 'nba:POR', sport: 'nba', abbr: 'POR', name: 'Portland Trail Blazers',   color: '#E03A3E' },
  { id: 'nba:SAC', sport: 'nba', abbr: 'SAC', name: 'Sacramento Kings',         color: '#5A2D81' },
  { id: 'nba:SAS', sport: 'nba', abbr: 'SAS', name: 'San Antonio Spurs',        color: '#8A8D8F' },
  { id: 'nba:TOR', sport: 'nba', abbr: 'TOR', name: 'Toronto Raptors',          color: '#CE1141' },
  { id: 'nba:UTA', sport: 'nba', abbr: 'UTA', name: 'Utah Jazz',                color: '#002B5C' },
  { id: 'nba:WAS', sport: 'nba', abbr: 'WAS', name: 'Washington Wizards',       color: '#E31837' },

  // NFL
  { id: 'nfl:ARI', sport: 'nfl', abbr: 'ARI', name: 'Arizona Cardinals',        color: '#97233F' },
  { id: 'nfl:ATL', sport: 'nfl', abbr: 'ATL', name: 'Atlanta Falcons',          color: '#A71930' },
  { id: 'nfl:BAL', sport: 'nfl', abbr: 'BAL', name: 'Baltimore Ravens',         color: '#241773' },
  { id: 'nfl:BUF', sport: 'nfl', abbr: 'BUF', name: 'Buffalo Bills',            color: '#00338D' },
  { id: 'nfl:CAR', sport: 'nfl', abbr: 'CAR', name: 'Carolina Panthers',        color: '#0085CA' },
  { id: 'nfl:CHI', sport: 'nfl', abbr: 'CHI', name: 'Chicago Bears',            color: '#0B162A' },
  { id: 'nfl:CIN', sport: 'nfl', abbr: 'CIN', name: 'Cincinnati Bengals',       color: '#FB4F14' },
  { id: 'nfl:CLE', sport: 'nfl', abbr: 'CLE', name: 'Cleveland Browns',         color: '#311D00' },
  { id: 'nfl:DAL', sport: 'nfl', abbr: 'DAL', name: 'Dallas Cowboys',           color: '#003594' },
  { id: 'nfl:DEN', sport: 'nfl', abbr: 'DEN', name: 'Denver Broncos',           color: '#FB4F14' },
  { id: 'nfl:DET', sport: 'nfl', abbr: 'DET', name: 'Detroit Lions',            color: '#0076B6' },
  { id: 'nfl:GB',  sport: 'nfl', abbr: 'GB',  name: 'Green Bay Packers',        color: '#203731' },
  { id: 'nfl:HOU', sport: 'nfl', abbr: 'HOU', name: 'Houston Texans',           color: '#03202F' },
  { id: 'nfl:IND', sport: 'nfl', abbr: 'IND', name: 'Indianapolis Colts',       color: '#002C5F' },
  { id: 'nfl:JAX', sport: 'nfl', abbr: 'JAX', name: 'Jacksonville Jaguars',     color: '#006778' },
  { id: 'nfl:KC',  sport: 'nfl', abbr: 'KC',  name: 'Kansas City Chiefs',       color: '#E31837' },
  { id: 'nfl:LAC', sport: 'nfl', abbr: 'LAC', name: 'Los Angeles Chargers',     color: '#0080C6' },
  { id: 'nfl:LAR', sport: 'nfl', abbr: 'LAR', name: 'Los Angeles Rams',         color: '#003594' },
  { id: 'nfl:LV',  sport: 'nfl', abbr: 'LV',  name: 'Las Vegas Raiders',        color: '#000000' },
  { id: 'nfl:MIA', sport: 'nfl', abbr: 'MIA', name: 'Miami Dolphins',           color: '#008E97' },
  { id: 'nfl:MIN', sport: 'nfl', abbr: 'MIN', name: 'Minnesota Vikings',        color: '#4F2683' },
  { id: 'nfl:NE',  sport: 'nfl', abbr: 'NE',  name: 'New England Patriots',     color: '#002244' },
  { id: 'nfl:NO',  sport: 'nfl', abbr: 'NO',  name: 'New Orleans Saints',       color: '#D3BC8D' },
  { id: 'nfl:NYG', sport: 'nfl', abbr: 'NYG', name: 'New York Giants',          color: '#0B2265' },
  { id: 'nfl:NYJ', sport: 'nfl', abbr: 'NYJ', name: 'New York Jets',            color: '#125740' },
  { id: 'nfl:PHI', sport: 'nfl', abbr: 'PHI', name: 'Philadelphia Eagles',      color: '#004C54' },
  { id: 'nfl:PIT', sport: 'nfl', abbr: 'PIT', name: 'Pittsburgh Steelers',      color: '#FFB612' },
  { id: 'nfl:SEA', sport: 'nfl', abbr: 'SEA', name: 'Seattle Seahawks',         color: '#002244' },
  { id: 'nfl:SF',  sport: 'nfl', abbr: 'SF',  name: 'San Francisco 49ers',      color: '#AA0000' },
  { id: 'nfl:TB',  sport: 'nfl', abbr: 'TB',  name: 'Tampa Bay Buccaneers',     color: '#D50A0A' },
  { id: 'nfl:TEN', sport: 'nfl', abbr: 'TEN', name: 'Tennessee Titans',         color: '#0C2340' },
  { id: 'nfl:WSH', sport: 'nfl', abbr: 'WSH', name: 'Washington Commanders',    color: '#5A1414' },

  // MLB
  { id: 'mlb:ARI', sport: 'mlb', abbr: 'ARI', name: 'Arizona Diamondbacks',     color: '#A71930' },
  { id: 'mlb:ATL', sport: 'mlb', abbr: 'ATL', name: 'Atlanta Braves',           color: '#CE1141' },
  { id: 'mlb:BAL', sport: 'mlb', abbr: 'BAL', name: 'Baltimore Orioles',        color: '#DF4601' },
  { id: 'mlb:BOS', sport: 'mlb', abbr: 'BOS', name: 'Boston Red Sox',           color: '#BD3039' },
  { id: 'mlb:CHC', sport: 'mlb', abbr: 'CHC', name: 'Chicago Cubs',             color: '#0E3386' },
  { id: 'mlb:CWS', sport: 'mlb', abbr: 'CWS', name: 'Chicago White Sox',        color: '#27251F' },
  { id: 'mlb:CIN', sport: 'mlb', abbr: 'CIN', name: 'Cincinnati Reds',          color: '#C6011F' },
  { id: 'mlb:CLE', sport: 'mlb', abbr: 'CLE', name: 'Cleveland Guardians',      color: '#00385D' },
  { id: 'mlb:COL', sport: 'mlb', abbr: 'COL', name: 'Colorado Rockies',         color: '#333366' },
  { id: 'mlb:DET', sport: 'mlb', abbr: 'DET', name: 'Detroit Tigers',           color: '#0C2340' },
  { id: 'mlb:HOU', sport: 'mlb', abbr: 'HOU', name: 'Houston Astros',           color: '#002D62' },
  { id: 'mlb:KC',  sport: 'mlb', abbr: 'KC',  name: 'Kansas City Royals',       color: '#004687' },
  { id: 'mlb:LAA', sport: 'mlb', abbr: 'LAA', name: 'Los Angeles Angels',       color: '#BA0021' },
  { id: 'mlb:LAD', sport: 'mlb', abbr: 'LAD', name: 'Los Angeles Dodgers',      color: '#005A9C' },
  { id: 'mlb:MIA', sport: 'mlb', abbr: 'MIA', name: 'Miami Marlins',            color: '#00A3E0' },
  { id: 'mlb:MIL', sport: 'mlb', abbr: 'MIL', name: 'Milwaukee Brewers',        color: '#12284B' },
  { id: 'mlb:MIN', sport: 'mlb', abbr: 'MIN', name: 'Minnesota Twins',          color: '#002B5C' },
  { id: 'mlb:NYM', sport: 'mlb', abbr: 'NYM', name: 'New York Mets',            color: '#002D72' },
  { id: 'mlb:NYY', sport: 'mlb', abbr: 'NYY', name: 'New York Yankees',         color: '#003087' },
  { id: 'mlb:OAK', sport: 'mlb', abbr: 'OAK', name: 'Athletics',               color: '#003831' },
  { id: 'mlb:PHI', sport: 'mlb', abbr: 'PHI', name: 'Philadelphia Phillies',    color: '#E81828' },
  { id: 'mlb:PIT', sport: 'mlb', abbr: 'PIT', name: 'Pittsburgh Pirates',       color: '#27251F' },
  { id: 'mlb:SD',  sport: 'mlb', abbr: 'SD',  name: 'San Diego Padres',         color: '#2F241D' },
  { id: 'mlb:SEA', sport: 'mlb', abbr: 'SEA', name: 'Seattle Mariners',         color: '#0C2C56' },
  { id: 'mlb:SF',  sport: 'mlb', abbr: 'SF',  name: 'San Francisco Giants',     color: '#FD5A1E' },
  { id: 'mlb:STL', sport: 'mlb', abbr: 'STL', name: 'St. Louis Cardinals',      color: '#C41E3A' },
  { id: 'mlb:TB',  sport: 'mlb', abbr: 'TB',  name: 'Tampa Bay Rays',           color: '#092C5C' },
  { id: 'mlb:TEX', sport: 'mlb', abbr: 'TEX', name: 'Texas Rangers',            color: '#003278' },
  { id: 'mlb:TOR', sport: 'mlb', abbr: 'TOR', name: 'Toronto Blue Jays',        color: '#134A8E' },
  { id: 'mlb:WSH', sport: 'mlb', abbr: 'WSH', name: 'Washington Nationals',     color: '#AB0003' },

  // NHL
  { id: 'nhl:ANA', sport: 'nhl', abbr: 'ANA', name: 'Anaheim Ducks',            color: '#F47A38' },
  { id: 'nhl:BOS', sport: 'nhl', abbr: 'BOS', name: 'Boston Bruins',            color: '#FCB514' },
  { id: 'nhl:BUF', sport: 'nhl', abbr: 'BUF', name: 'Buffalo Sabres',           color: '#003087' },
  { id: 'nhl:CGY', sport: 'nhl', abbr: 'CGY', name: 'Calgary Flames',           color: '#C8102E' },
  { id: 'nhl:CAR', sport: 'nhl', abbr: 'CAR', name: 'Carolina Hurricanes',      color: '#CC0000' },
  { id: 'nhl:CHI', sport: 'nhl', abbr: 'CHI', name: 'Chicago Blackhawks',       color: '#CF0A2C' },
  { id: 'nhl:COL', sport: 'nhl', abbr: 'COL', name: 'Colorado Avalanche',       color: '#6F263D' },
  { id: 'nhl:CBJ', sport: 'nhl', abbr: 'CBJ', name: 'Columbus Blue Jackets',    color: '#002654' },
  { id: 'nhl:DAL', sport: 'nhl', abbr: 'DAL', name: 'Dallas Stars',             color: '#006847' },
  { id: 'nhl:DET', sport: 'nhl', abbr: 'DET', name: 'Detroit Red Wings',        color: '#CE1126' },
  { id: 'nhl:EDM', sport: 'nhl', abbr: 'EDM', name: 'Edmonton Oilers',          color: '#FF4C00' },
  { id: 'nhl:FLA', sport: 'nhl', abbr: 'FLA', name: 'Florida Panthers',         color: '#C8102E' },
  { id: 'nhl:LA',  sport: 'nhl', abbr: 'LA',  name: 'Los Angeles Kings',        color: '#111111' },
  { id: 'nhl:MIN', sport: 'nhl', abbr: 'MIN', name: 'Minnesota Wild',           color: '#154734' },
  { id: 'nhl:MTL', sport: 'nhl', abbr: 'MTL', name: 'Montréal Canadiens',       color: '#AF1E2D' },
  { id: 'nhl:NSH', sport: 'nhl', abbr: 'NSH', name: 'Nashville Predators',      color: '#FFB81C' },
  { id: 'nhl:NJ',  sport: 'nhl', abbr: 'NJ',  name: 'New Jersey Devils',        color: '#CE1126' },
  { id: 'nhl:NYI', sport: 'nhl', abbr: 'NYI', name: 'New York Islanders',       color: '#00539B' },
  { id: 'nhl:NYR', sport: 'nhl', abbr: 'NYR', name: 'New York Rangers',         color: '#0038A8' },
  { id: 'nhl:OTT', sport: 'nhl', abbr: 'OTT', name: 'Ottawa Senators',          color: '#C52032' },
  { id: 'nhl:PHI', sport: 'nhl', abbr: 'PHI', name: 'Philadelphia Flyers',      color: '#F74902' },
  { id: 'nhl:PIT', sport: 'nhl', abbr: 'PIT', name: 'Pittsburgh Penguins',      color: '#FCB514' },
  { id: 'nhl:SJS', sport: 'nhl', abbr: 'SJS', name: 'San Jose Sharks',          color: '#006D75' },
  { id: 'nhl:SEA', sport: 'nhl', abbr: 'SEA', name: 'Seattle Kraken',           color: '#001628' },
  { id: 'nhl:STL', sport: 'nhl', abbr: 'STL', name: 'St. Louis Blues',          color: '#002F87' },
  { id: 'nhl:TB',  sport: 'nhl', abbr: 'TB',  name: 'Tampa Bay Lightning',      color: '#002868' },
  { id: 'nhl:TOR', sport: 'nhl', abbr: 'TOR', name: 'Toronto Maple Leafs',      color: '#00205B' },
  { id: 'nhl:UTA', sport: 'nhl', abbr: 'UTA', name: 'Utah Hockey Club',         color: '#6CACE4' },
  { id: 'nhl:VAN', sport: 'nhl', abbr: 'VAN', name: 'Vancouver Canucks',        color: '#00843D' },
  { id: 'nhl:VGK', sport: 'nhl', abbr: 'VGK', name: 'Vegas Golden Knights',     color: '#B4975A' },
  { id: 'nhl:WSH', sport: 'nhl', abbr: 'WSH', name: 'Washington Capitals',      color: '#CF0A2C' },
  { id: 'nhl:WPG', sport: 'nhl', abbr: 'WPG', name: 'Winnipeg Jets',            color: '#041E42' },

  // PREMIER LEAGUE
  { id: 'football:ARS', sport: 'football', abbr: 'ARS', name: 'Arsenal',              color: '#EF0107', league: 'premier-league', logoUrl: espnSoccer(359) },
  { id: 'football:CHE', sport: 'football', abbr: 'CHE', name: 'Chelsea',              color: '#034694', league: 'premier-league', logoUrl: espnSoccer(363) },
  { id: 'football:LIV', sport: 'football', abbr: 'LIV', name: 'Liverpool',            color: '#C8102E', league: 'premier-league', logoUrl: espnSoccer(364) },
  { id: 'football:MCI', sport: 'football', abbr: 'MCI', name: 'Manchester City',      color: '#6CABDD', league: 'premier-league', logoUrl: espnSoccer(382) },
  { id: 'football:MUN', sport: 'football', abbr: 'MUN', name: 'Manchester United',    color: '#DA291C', league: 'premier-league', logoUrl: espnSoccer(360) },
  { id: 'football:TOT', sport: 'football', abbr: 'TOT', name: 'Tottenham Hotspur',    color: '#132257', league: 'premier-league', logoUrl: espnSoccer(367) },
  { id: 'football:NEW', sport: 'football', abbr: 'NEW', name: 'Newcastle United',     color: '#241F20', league: 'premier-league', logoUrl: espnSoccer(361) },
  { id: 'football:AVL', sport: 'football', abbr: 'AVL', name: 'Aston Villa',          color: '#95BFE5', league: 'premier-league', logoUrl: espnSoccer(362) },
  { id: 'football:WHU', sport: 'football', abbr: 'WHU', name: 'West Ham United',      color: '#7A263A', league: 'premier-league', logoUrl: espnSoccer(371) },
  { id: 'football:BHA', sport: 'football', abbr: 'BHA', name: 'Brighton',             color: '#0057B8', league: 'premier-league', logoUrl: espnSoccer(331) },
  { id: 'football:BRE', sport: 'football', abbr: 'BRE', name: 'Brentford',            color: '#E30613', league: 'premier-league', logoUrl: espnSoccer(337) },
  { id: 'football:FUL', sport: 'football', abbr: 'FUL', name: 'Fulham',              color: '#000000', league: 'premier-league', logoUrl: espnSoccer(370) },
  { id: 'football:CRY', sport: 'football', abbr: 'CRY', name: 'Crystal Palace',       color: '#1B458F', league: 'premier-league', logoUrl: espnSoccer(384) },
  { id: 'football:WOL', sport: 'football', abbr: 'WOL', name: 'Wolverhampton',        color: '#FDB913', league: 'premier-league', logoUrl: espnSoccer(380) },
  { id: 'football:EVE', sport: 'football', abbr: 'EVE', name: 'Everton',              color: '#003399', league: 'premier-league', logoUrl: espnSoccer(368) },
  { id: 'football:LEI', sport: 'football', abbr: 'LEI', name: 'Leicester City',       color: '#003090', league: 'premier-league', logoUrl: espnSoccer(375) },
  { id: 'football:IPS', sport: 'football', abbr: 'IPS', name: 'Ipswich Town',         color: '#0044A9', league: 'premier-league', logoUrl: espnSoccer(373) },
  { id: 'football:SOU', sport: 'football', abbr: 'SOU', name: 'Southampton',          color: '#D71920', league: 'premier-league', logoUrl: espnSoccer(376) },
  { id: 'football:BOU', sport: 'football', abbr: 'BOU', name: 'Bournemouth',          color: '#DA291C', league: 'premier-league', logoUrl: espnSoccer(349) },
  { id: 'football:NFO', sport: 'football', abbr: 'NFO', name: 'Nottingham Forest',    color: '#DD0000', league: 'premier-league', logoUrl: espnSoccer(393) },

  // BUNDESLIGA
  { id: 'football:FCB', sport: 'football', abbr: 'FCB', name: 'Bayern Munich',        color: '#DC052D', league: 'bundesliga', logoUrl: espnSoccer(132) },
  { id: 'football:BVB', sport: 'football', abbr: 'BVB', name: 'Borussia Dortmund',   color: '#FDE100', league: 'bundesliga', logoUrl: espnSoccer(124) },
  { id: 'football:B04', sport: 'football', abbr: 'B04', name: 'Bayer Leverkusen',     color: '#E32221', league: 'bundesliga', logoUrl: espnSoccer(131) },
  { id: 'football:RBL', sport: 'football', abbr: 'RBL', name: 'RB Leipzig',           color: '#DD0741', league: 'bundesliga', logoUrl: espnSoccer(23826) },
  { id: 'football:SGE', sport: 'football', abbr: 'SGE', name: 'Eintracht Frankfurt',  color: '#E1000F', league: 'bundesliga', logoUrl: espnSoccer(9823) },
  { id: 'football:VFB', sport: 'football', abbr: 'VFB', name: 'VfB Stuttgart',        color: '#E32219', league: 'bundesliga', logoUrl: espnSoccer(133) },
  { id: 'football:WOB', sport: 'football', abbr: 'WOB', name: 'Wolfsburg',            color: '#65B32E', league: 'bundesliga', logoUrl: espnSoccer(11) },
  { id: 'football:HOF', sport: 'football', abbr: 'HOF', name: 'Hoffenheim',           color: '#1C63B7', league: 'bundesliga', logoUrl: espnSoccer(10189) },
  { id: 'football:BMG', sport: 'football', abbr: 'BMG', name: 'Borussia M\'gladbach', color: '#000000', league: 'bundesliga', logoUrl: espnSoccer(126) },
  { id: 'football:AUG', sport: 'football', abbr: 'AUG', name: 'Augsburg',             color: '#BA3733', league: 'bundesliga', logoUrl: espnSoccer(24051) },
  { id: 'football:SVW', sport: 'football', abbr: 'SVW', name: 'Werder Bremen',        color: '#1D9053', league: 'bundesliga', logoUrl: espnSoccer(134) },
  { id: 'football:SCF', sport: 'football', abbr: 'SCF', name: 'SC Freiburg',          color: '#E31E24', league: 'bundesliga', logoUrl: espnSoccer(7893) },
  { id: 'football:FCU', sport: 'football', abbr: 'FCU', name: 'Union Berlin',         color: '#EB1923', league: 'bundesliga', logoUrl: espnSoccer(10214) },
  { id: 'football:M05', sport: 'football', abbr: 'M05', name: 'Mainz 05',             color: '#C3161C', league: 'bundesliga', logoUrl: espnSoccer(11521) },
  { id: 'football:FCH', sport: 'football', abbr: 'FCH', name: 'Heidenheim',           color: '#E63A23', league: 'bundesliga', logoUrl: espnSoccer(19548) },
  { id: 'football:BOC', sport: 'football', abbr: 'BOC', name: 'VfL Bochum',           color: '#005CA9', league: 'bundesliga', logoUrl: espnSoccer(122) },
  { id: 'football:STP', sport: 'football', abbr: 'STP', name: 'St. Pauli',            color: '#4B3226', league: 'bundesliga', logoUrl: espnSoccer(130) },
  { id: 'football:KSV', sport: 'football', abbr: 'KSV', name: 'Holstein Kiel',        color: '#0057A8', league: 'bundesliga', logoUrl: espnSoccer(136) },

  // SERIE A
  { id: 'football:INT', sport: 'football', abbr: 'INT', name: 'Inter Milan',          color: '#010E80', league: 'serie-a', logoUrl: espnSoccer(110) },
  { id: 'football:ACM', sport: 'football', abbr: 'ACM', name: 'AC Milan',             color: '#FB090B', league: 'serie-a', logoUrl: espnSoccer(103) },
  { id: 'football:JUV', sport: 'football', abbr: 'JUV', name: 'Juventus',             color: '#000000', league: 'serie-a', logoUrl: espnSoccer(111) },
  { id: 'football:NAP', sport: 'football', abbr: 'NAP', name: 'Napoli',               color: '#12A0C3', league: 'serie-a', logoUrl: espnSoccer(113) },
  { id: 'football:ROM', sport: 'football', abbr: 'ROM', name: 'AS Roma',              color: '#8E1F2F', league: 'serie-a', logoUrl: espnSoccer(104) },
  { id: 'football:LAZ', sport: 'football', abbr: 'LAZ', name: 'Lazio',               color: '#87D8F7', league: 'serie-a', logoUrl: espnSoccer(112) },
  { id: 'football:ATA', sport: 'football', abbr: 'ATA', name: 'Atalanta',             color: '#1E3870', league: 'serie-a', logoUrl: espnSoccer(106) },
  { id: 'football:FIO', sport: 'football', abbr: 'FIO', name: 'Fiorentina',           color: '#4E297B', league: 'serie-a', logoUrl: espnSoccer(109) },
  { id: 'football:BOL', sport: 'football', abbr: 'BOL', name: 'Bologna',              color: '#D8172A', league: 'serie-a', logoUrl: espnSoccer(107) },
  { id: 'football:TOR', sport: 'football', abbr: 'TOR', name: 'Torino',              color: '#8B1A2C', league: 'serie-a', logoUrl: espnSoccer(116) },
  { id: 'football:UDI', sport: 'football', abbr: 'UDI', name: 'Udinese',             color: '#000000', league: 'serie-a', logoUrl: espnSoccer(115) },
  { id: 'football:GEN', sport: 'football', abbr: 'GEN', name: 'Genoa',               color: '#C8102E', league: 'serie-a', logoUrl: espnSoccer(2725) },
  { id: 'football:MON', sport: 'football', abbr: 'MON', name: 'Monza',               color: '#EB1923', league: 'serie-a', logoUrl: espnSoccer(10199) },
  { id: 'football:LEC', sport: 'football', abbr: 'LEC', name: 'Lecce',               color: '#F0A500', league: 'serie-a', logoUrl: espnSoccer(2726) },
  { id: 'football:CAG', sport: 'football', abbr: 'CAG', name: 'Cagliari',            color: '#004B9E', league: 'serie-a', logoUrl: espnSoccer(2729) },
  { id: 'football:EMP', sport: 'football', abbr: 'EMP', name: 'Empoli',              color: '#0066B3', league: 'serie-a', logoUrl: espnSoccer(2724) },
  { id: 'football:VER', sport: 'football', abbr: 'VER', name: 'Hellas Verona',        color: '#003DA6', league: 'serie-a', logoUrl: espnSoccer(118) },
  { id: 'football:COM', sport: 'football', abbr: 'COM', name: 'Como',                color: '#004B9E', league: 'serie-a', logoUrl: espnSoccer(2728) },
  { id: 'football:VEN', sport: 'football', abbr: 'VEN', name: 'Venezia',             color: '#000000', league: 'serie-a', logoUrl: espnSoccer(5900) },
  { id: 'football:PAR', sport: 'football', abbr: 'PAR', name: 'Parma',               color: '#F5EB00', league: 'serie-a', logoUrl: espnSoccer(2730) },

  // LA LIGA
  { id: 'football:RMA', sport: 'football', abbr: 'RMA', name: 'Real Madrid',          color: '#FEBE10', league: 'laliga', logoUrl: espnSoccer(86) },
  { id: 'football:BAR', sport: 'football', abbr: 'BAR', name: 'FC Barcelona',         color: '#A50044', league: 'laliga', logoUrl: espnSoccer(83) },
  { id: 'football:ATM', sport: 'football', abbr: 'ATM', name: 'Atlético Madrid',      color: '#CB3524', league: 'laliga', logoUrl: espnSoccer(1068) },
  { id: 'football:ATH', sport: 'football', abbr: 'ATH', name: 'Athletic Bilbao',      color: '#EE2523', league: 'laliga', logoUrl: espnSoccer(93) },
  { id: 'football:RSO', sport: 'football', abbr: 'RSO', name: 'Real Sociedad',        color: '#0467AF', league: 'laliga', logoUrl: espnSoccer(89) },
  { id: 'football:BET', sport: 'football', abbr: 'BET', name: 'Real Betis',           color: '#00A650', league: 'laliga', logoUrl: espnSoccer(85) },
  { id: 'football:VIL', sport: 'football', abbr: 'VIL', name: 'Villarreal',           color: '#009EDE', league: 'laliga', logoUrl: espnSoccer(102) },
  { id: 'football:VAL', sport: 'football', abbr: 'VAL', name: 'Valencia',             color: '#FF7900', league: 'laliga', logoUrl: espnSoccer(95) },
  { id: 'football:SEV', sport: 'football', abbr: 'SEV', name: 'Sevilla',              color: '#CF0C2E', league: 'laliga', logoUrl: espnSoccer(88) },
  { id: 'football:CEL', sport: 'football', abbr: 'CEL', name: 'Celta Vigo',           color: '#73C4E2', league: 'laliga', logoUrl: espnSoccer(3842) },
  { id: 'football:GET', sport: 'football', abbr: 'GET', name: 'Getafe',               color: '#005EA8', league: 'laliga', logoUrl: espnSoccer(3839) },
  { id: 'football:OSA', sport: 'football', abbr: 'OSA', name: 'Osasuna',              color: '#C41426', league: 'laliga', logoUrl: espnSoccer(3843) },
  { id: 'football:RAY', sport: 'football', abbr: 'RAY', name: 'Rayo Vallecano',       color: '#CF0013', league: 'laliga', logoUrl: espnSoccer(3847) },
  { id: 'football:ESP', sport: 'football', abbr: 'ESP', name: 'Espanyol',             color: '#0055A0', league: 'laliga', logoUrl: espnSoccer(3838) },
  { id: 'football:MAL', sport: 'football', abbr: 'MAL', name: 'Mallorca',             color: '#CF0017', league: 'laliga', logoUrl: espnSoccer(3841) },
  { id: 'football:LPA', sport: 'football', abbr: 'LPA', name: 'Las Palmas',           color: '#F5C400', league: 'laliga', logoUrl: espnSoccer(1930) },
  { id: 'football:ALA', sport: 'football', abbr: 'ALA', name: 'Alavés',              color: '#1A59A3', league: 'laliga', logoUrl: espnSoccer(3844) },
  { id: 'football:GIR', sport: 'football', abbr: 'GIR', name: 'Girona',              color: '#CD1315', league: 'laliga', logoUrl: espnSoccer(9812) },
  { id: 'football:LEG', sport: 'football', abbr: 'LEG', name: 'Leganés',             color: '#003DA6', league: 'laliga', logoUrl: espnSoccer(2941) },
  { id: 'football:VLL', sport: 'football', abbr: 'VLL', name: 'Real Valladolid',      color: '#6B2382', league: 'laliga', logoUrl: espnSoccer(3846) },

  // LIGUE 1
  { id: 'football:PSG', sport: 'football', abbr: 'PSG', name: 'Paris Saint-Germain', color: '#004170', league: 'ligue-1', logoUrl: espnSoccer(160) },
  { id: 'football:ASM', sport: 'football', abbr: 'ASM', name: 'Monaco',              color: '#E3172D', league: 'ligue-1', logoUrl: espnSoccer(162) },
  { id: 'football:OLY', sport: 'football', abbr: 'OLY', name: 'Olympique Lyon',      color: '#002B6E', league: 'ligue-1', logoUrl: espnSoccer(172) },
  { id: 'football:OM',  sport: 'football', abbr: 'OM',  name: 'Olympique Marseille', color: '#2FAEE0', league: 'ligue-1', logoUrl: espnSoccer(161) },
  { id: 'football:RCL', sport: 'football', abbr: 'RCL', name: 'RC Lens',             color: '#E4B118', league: 'ligue-1', logoUrl: espnSoccer(169) },
  { id: 'football:LOS', sport: 'football', abbr: 'LOS', name: 'Lille',               color: '#CB1117', league: 'ligue-1', logoUrl: espnSoccer(170) },
  { id: 'football:OGC', sport: 'football', abbr: 'OGC', name: 'Nice',                color: '#000000', league: 'ligue-1', logoUrl: espnSoccer(163) },
  { id: 'football:SRF', sport: 'football', abbr: 'SRF', name: 'Rennes',              color: '#000000', league: 'ligue-1', logoUrl: espnSoccer(167) },
  { id: 'football:RCS', sport: 'football', abbr: 'RCS', name: 'Strasbourg',          color: '#0055A5', league: 'ligue-1', logoUrl: espnSoccer(165) },
  { id: 'football:MPH', sport: 'football', abbr: 'MPH', name: 'Montpellier',         color: '#003DA6', league: 'ligue-1', logoUrl: espnSoccer(171) },
  { id: 'football:SDR', sport: 'football', abbr: 'SDR', name: 'Reims',               color: '#E21E26', league: 'ligue-1', logoUrl: espnSoccer(168) },
  { id: 'football:TFC', sport: 'football', abbr: 'TFC', name: 'Toulouse',            color: '#6B2382', league: 'ligue-1', logoUrl: espnSoccer(174) },
  { id: 'football:SB29',sport: 'football', abbr: 'BRE', name: 'Stade Brest',         color: '#E4171C', league: 'ligue-1', logoUrl: espnSoccer(3026) },
  { id: 'football:HAC', sport: 'football', abbr: 'HAC', name: 'Le Havre',            color: '#009FE3', league: 'ligue-1', logoUrl: espnSoccer(3025) },
  { id: 'football:ASE', sport: 'football', abbr: 'ASE', name: 'Saint-Étienne',       color: '#007F3D', league: 'ligue-1', logoUrl: espnSoccer(166) },
  { id: 'football:FCN', sport: 'football', abbr: 'FCN', name: 'Nantes',              color: '#F5CE3E', league: 'ligue-1', logoUrl: espnSoccer(164) },
  { id: 'football:ANG', sport: 'football', abbr: 'ANG', name: 'Angers',              color: '#000000', league: 'ligue-1', logoUrl: espnSoccer(3027) },
  { id: 'football:AJA', sport: 'football', abbr: 'AJA', name: 'Auxerre',             color: '#002F6C', league: 'ligue-1', logoUrl: espnSoccer(3022) },
]

export const SPORT_LABELS: Record<Sport, string> = { nba: '🏀 NBA', nfl: '🏈 NFL', mlb: '⚾ MLB', nhl: '🏒 NHL', football: '⚽ Foot' }

export const FOOTBALL_LEAGUE_LABELS: Record<FootballLeague, string> = {
  'premier-league': '🏴󠁧󠁢󠁥󠁮󠁧󠁿 Premier League',
  'bundesliga':     '🇩🇪 Bundesliga',
  'serie-a':        '🇮🇹 Serie A',
  'laliga':         '🇪🇸 La Liga',
  'ligue-1':        '🇫🇷 Ligue 1',
}

export function getTeamById(id: string): SportsTeam | null {
  return SPORTS_TEAMS.find(t => t.id === id) || null
}

// Backward compat: find NBA team by abbr only
export function getTeam(abbr: string): SportsTeam | null {
  return SPORTS_TEAMS.find(t => t.sport === 'nba' && t.abbr === abbr) || null
}

export function getSpeciality(
  stats: { total: number; rc: number; auto: number; patch: number; num: number } | undefined,
  favoriteTeams?: string[] | null
): { label: string; color: string }[] {
  if (!stats || stats.total === 0) return []
  const { total, rc, auto, patch, num } = stats
  const result: { label: string; color: string }[] = []

  // Tier total (exclusifs entre eux — on garde le plus haut)
  if (total >= 1000)      result.push({ label: '🏆 Légende',             color: '#f39c12' })
  else if (total >= 300)  result.push({ label: '🎖️ Grand Collectionneur', color: '#e67e22' })
  else if (total >= 100)  result.push({ label: '📦 Collectionneur',       color: '#003DA6' })

  // Badges ratio (cumulables)
  if (rc / total > 0.35)    result.push({ label: '🌟 RC Hunter',      color: '#e67e22' })
  if (auto / total > 0.25)  result.push({ label: '✍️ Auto Collector',  color: '#2e7d32' })
  if (patch / total > 0.12) result.push({ label: '🧩 Patch Master',    color: '#1976d2' })
  if (num / total > 0.55)   result.push({ label: '🔢 Serial #',        color: '#7b1fa2' })

  return result
}
