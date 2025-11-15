// ELO Rating System Configuration
const ELO_CONFIG = {
    K_FACTOR: 32, // Standard K-factor for ELO rating
    INITIAL_RATING: 1500
};

// Matchmaking Configuration Constants
const MATCHMAKING_CONFIG = {
    MAX_PAST_ROUNDS: 3,      // how many past rounds matter (for storing in pastRounds queue)
    SPREAD_TOL: 200.0,       // allowed rating spread inside a 4-player group before penalty (doubles)
    SIGMA_SKILL: 0.15,       // width of Gaussian around expected_score=0.5
    ALPHA_SOFTMAX: 1.0,      // higher → more deterministic, lower → more random
    W_SKILL: 1.0,            // weight for skill term
    W_PARTNER: 0.5,          // weight for partner history term (doubles)
    W_OPP: 0.2,              // weight for opponent history term
    W_SPREAD: 0.01           // weight for spread term
};

// Data Storage
let players = [];
let matches = [];
let matchHistory = [];
let eventPlayers = []; // Track players selected for the current event

// Matchmaking History Data Structures
// These track opponent and partner history for matchmaking
let opponentCount = {};      // opponentCount[p][q] = number of times p played against q
let lastOpponentRound = {};  // lastOpponentRound[p][q] = round number when p last played against q
let partnerCount = {};       // partnerCount[p][q] = number of times p played with q (doubles)
let lastPartnerRound = {};   // lastPartnerRound[p][q] = round number when p last played with q (doubles)
let currentDropdownPlayers = []; // Store current filtered players for keyboard navigation
let selectedDropdownIndex = -1; // Track currently selected item index in dropdown
let manualMatchSelections = {
    team1Player1: null,
    team1Player2: null,
    team2Player1: null,
    team2Player2: null
}; // Track selected players for manual match
let activeManualDropdown = null; // Track which manual dropdown is currently active
let activeManualDropdownPlayers = []; // Store current filtered players for active manual dropdown
let activeManualDropdownIndex = -1; // Track currently selected item index in active manual dropdown
let editingMatchId = null; // Track which match is currently being edited
let matchEditSelections = {
    matchType: 'singles',
    team1Player1: null,
    team1Player2: null,
    team2Player1: null,
    team2Player2: null
}; // Track selected players for match editing
let activeMatchEditDropdown = null; // Track which match edit dropdown is currently active
let activeMatchEditDropdownPlayers = []; // Store current filtered players for active match edit dropdown
let activeMatchEditDropdownIndex = -1; // Track currently selected item index in active match edit dropdown

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    loadData();
    initializeTabs();
    initializeEventListeners();
    renderPlayers();
    initializePlayerSearch();
    renderEventPlayers();
    renderMatches();
    renderHistory();
});

// Tab Navigation
function initializeTabs() {
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');

    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const targetTab = button.getAttribute('data-tab');
            
            // Remove active class from all tabs and buttons
            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabContents.forEach(tab => tab.classList.remove('active'));
            
            // Add active class to clicked tab and button
            button.classList.add('active');
            document.getElementById(`${targetTab}-tab`).classList.add('active');
            
            // Refresh forms when switching to certain tabs
            if (targetTab === 'event') {
                initializePlayerSearch();
                renderEventPlayers();
            }
        });
    });
}

// Event Listeners
function initializeEventListeners() {
    document.getElementById('add-player-btn').addEventListener('click', addPlayer);
    
    // Add Enter key support for player name and rating fields
    const playerNameInput = document.getElementById('player-name');
    const playerRatingInput = document.getElementById('player-rating');
    
    if (playerNameInput) {
        playerNameInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                addPlayer();
            }
        });
    }
    
    if (playerRatingInput) {
        playerRatingInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                addPlayer();
            }
        });
    }
    
    document.getElementById('generate-matches-btn').addEventListener('click', generateMatches);
    document.getElementById('generate-custom-match-btn').addEventListener('click', generateCustomMatch);
    document.getElementById('export-data-btn').addEventListener('click', exportData);
    document.getElementById('import-data-btn').addEventListener('click', () => {
        document.getElementById('import-data-file').click();
    });
    document.getElementById('import-data-file').addEventListener('change', importData);
    document.getElementById('clear-all-players-btn').addEventListener('click', clearAllEventPlayers);
    document.getElementById('delete-unplayed-matches-btn').addEventListener('click', deleteAllUnplayedMatches);
    
    // Player search input event listeners
    const searchInput = document.getElementById('player-search-input');
    
    if (searchInput) {
        searchInput.addEventListener('input', handlePlayerSearch);
        searchInput.addEventListener('focus', handlePlayerSearch);
        searchInput.addEventListener('keydown', handlePlayerSearchKeydown);
    }
    
    // Close dropdowns when clicking outside (combined handler for both event player search and manual match)
    document.addEventListener('click', (e) => {
        // Handle event player search dropdown
        const eventDropdown = document.getElementById('player-dropdown');
        const eventSearchInput = document.getElementById('player-search-input');
        if (eventDropdown && eventSearchInput) {
            // Close if click is outside both the dropdown and the search input
            if (!eventDropdown.contains(e.target) && e.target !== eventSearchInput) {
                eventDropdown.style.display = 'none';
                selectedDropdownIndex = -1;
            }
        }
        
        // Handle manual match dropdowns
        if (!e.target.classList.contains('manual-player-input') && 
            !e.target.closest('.manual-player-dropdown')) {
            const manualDropdowns = document.querySelectorAll('.manual-player-dropdown');
            if (manualDropdowns.length > 0) {
                manualDropdowns.forEach(dd => {
                    if (dd.style.display !== 'none') {
                        dd.style.display = 'none';
                    }
                });
                activeManualDropdown = null;
                activeManualDropdownIndex = -1;
                activeManualDropdownPlayers = [];
            }
        }
        
        // Handle match edit dropdowns
        if (!e.target.classList.contains('match-edit-player-input') && 
            !e.target.closest('.match-edit-player-dropdown')) {
            const matchEditDropdowns = document.querySelectorAll('.match-edit-player-dropdown');
            if (matchEditDropdowns.length > 0) {
                matchEditDropdowns.forEach(dd => {
                    if (dd.style.display !== 'none') {
                        dd.style.display = 'none';
                    }
                });
                activeMatchEditDropdown = null;
                activeMatchEditDropdownIndex = -1;
                activeMatchEditDropdownPlayers = [];
            }
        }
    });
}

// Player Management
function addPlayer() {
    const nameInput = document.getElementById('player-name');
    const ratingInput = document.getElementById('player-rating');
    
    const name = nameInput.value.trim();
    const rating = parseFloat(ratingInput.value) || ELO_CONFIG.INITIAL_RATING;
    
    if (!name) {
        alert('Please enter a player name');
        return;
    }
    
    if (players.find(p => p.name.toLowerCase() === name.toLowerCase())) {
        alert('Player already exists');
        return;
    }
    
    const player = {
        id: Date.now().toString(),
        name: name,
        rating: rating,
        matchesPlayed: 0,
        wins: 0,
        losses: 0,
        partners: [], // Track partners for doubles
        opponents: [] // Track opponents for singles
    };
    
    players.push(player);
    nameInput.value = '';
    ratingInput.value = ELO_CONFIG.INITIAL_RATING;
    
    saveData();
    renderPlayers();
    initializePlayerSearch();
    renderEventPlayers();
}

function deletePlayer(playerId) {
    if (confirm('Are you sure you want to delete this player?')) {
        players = players.filter(p => p.id !== playerId);
        matches = matches.filter(m => 
            !m.team1.includes(playerId) && !m.team2.includes(playerId)
        );
        // Remove from event players if present
        eventPlayers = eventPlayers.filter(id => id !== playerId);
        saveData();
        renderPlayers();
        initializePlayerSearch();
        renderEventPlayers();
        renderMatches();
    }
}

function renderPlayers() {
    const playersList = document.getElementById('players-list');
    
    if (players.length === 0) {
        playersList.innerHTML = '<div class="empty-state"><h3>No players yet</h3><p>Add players to get started</p></div>';
        return;
    }
    
    const sortedPlayers = players.sort((a, b) => {
        // Sort by rating (descending), then by name if rating is equal
        if (b.rating !== a.rating) {
            return b.rating - a.rating;
        }
        return a.name.localeCompare(b.name);
    });
    
    playersList.innerHTML = `
        <table class="leaderboard-table">
            <thead>
                <tr>
                    <th class="rank-col">Rank</th>
                    <th class="name-col">Player</th>
                    <th class="rating-col">Rating</th>
                    <th class="matches-col">Matches</th>
                    <th class="wins-col">Wins</th>
                    <th class="losses-col">Losses</th>
                    <th class="winrate-col">Win Rate</th>
                    <th class="actions-col">Actions</th>
                </tr>
            </thead>
            <tbody>
                ${sortedPlayers.map((player, index) => {
                    const rank = index + 1;
                    const winRate = player.matchesPlayed > 0 
                        ? Math.round((player.wins / player.matchesPlayed) * 100) 
                        : 0;
                    
                    // Determine rank class for styling (top 3 get special treatment)
                    let rankClass = '';
                    if (rank === 1) rankClass = 'rank-gold';
                    else if (rank === 2) rankClass = 'rank-silver';
                    else if (rank === 3) rankClass = 'rank-bronze';
                    
                    return `
                        <tr class="leaderboard-row ${rankClass}">
                            <td class="rank-cell">
                                <span class="rank-number">${rank}</span>
                            </td>
                            <td class="name-cell">
                                <strong>${escapeHtml(player.name)}</strong>
                            </td>
                            <td class="rating-cell">
                                <span class="rating-value">${Math.round(player.rating)}</span>
                            </td>
                            <td class="matches-cell">${player.matchesPlayed}</td>
                            <td class="wins-cell">${player.wins}</td>
                            <td class="losses-cell">${player.losses}</td>
                            <td class="winrate-cell">
                                ${player.matchesPlayed > 0 ? `${winRate}%` : '-'}
                            </td>
                            <td class="actions-cell">
                                <button class="btn btn-danger btn-sm delete-btn" onclick="deletePlayer('${player.id}')" title="Delete player">
                                    Delete
                                </button>
                            </td>
                        </tr>
                    `;
                }).join('')}
            </tbody>
        </table>
    `;
}

// Player Selection for Events
function initializePlayerSearch() {
    const searchInput = document.getElementById('player-search-input');
    if (!searchInput) return;
    
    // Clear the search input
    searchInput.value = '';
    const dropdown = document.getElementById('player-dropdown');
    if (dropdown) {
        dropdown.innerHTML = '';
        dropdown.style.display = 'none';
    }
    
    // Reset selected index
    selectedDropdownIndex = -1;
    currentDropdownPlayers = [];
}

function handlePlayerSearch(event) {
    const searchTerm = event.target.value.toLowerCase().trim();
    const dropdown = document.getElementById('player-dropdown');
    if (!dropdown) return;
    
    // Reset selected index when search changes
    selectedDropdownIndex = -1;
    
    if (searchTerm === '') {
        // Show all players not in event
        const availablePlayers = players.filter(p => !eventPlayers.includes(p.id));
        currentDropdownPlayers = availablePlayers;
        renderPlayerDropdown(availablePlayers, dropdown);
        return;
    }
    
    // Filter players that match search term and are not already in event
    const filteredPlayers = players.filter(player => {
        const nameMatch = player.name.toLowerCase().includes(searchTerm);
        const notInEvent = !eventPlayers.includes(player.id);
        return nameMatch && notInEvent;
    });
    
    currentDropdownPlayers = filteredPlayers;
    renderPlayerDropdown(filteredPlayers, dropdown);
}

function handlePlayerSearchKeydown(event) {
    const dropdown = document.getElementById('player-dropdown');
    if (!dropdown || dropdown.style.display === 'none' || currentDropdownPlayers.length === 0) {
        // If dropdown is hidden or empty, allow normal input behavior
        if (event.key === 'Enter') {
            event.preventDefault();
        }
        return;
    }
    
    const items = dropdown.querySelectorAll('.dropdown-item:not(.disabled)');
    if (items.length === 0) return;
    
    switch (event.key) {
        case 'ArrowDown':
            event.preventDefault();
            if (selectedDropdownIndex < 0) {
                selectedDropdownIndex = 0;
            } else {
                selectedDropdownIndex = (selectedDropdownIndex + 1) % items.length;
            }
            updateDropdownSelection(items);
            scrollToSelectedItem(items[selectedDropdownIndex]);
            break;
        case 'ArrowUp':
            event.preventDefault();
            if (selectedDropdownIndex <= 0) {
                selectedDropdownIndex = items.length - 1;
            } else {
                selectedDropdownIndex = selectedDropdownIndex - 1;
            }
            updateDropdownSelection(items);
            scrollToSelectedItem(items[selectedDropdownIndex]);
            break;
        case 'Enter':
            event.preventDefault();
            if (selectedDropdownIndex >= 0 && selectedDropdownIndex < items.length) {
                const playerId = items[selectedDropdownIndex].getAttribute('data-player-id');
                if (playerId && !eventPlayers.includes(playerId)) {
                    addPlayerToEvent(playerId);
                }
            } else if (items.length > 0) {
                // If no item is selected, select the first one
                const playerId = items[0].getAttribute('data-player-id');
                if (playerId && !eventPlayers.includes(playerId)) {
                    addPlayerToEvent(playerId);
                }
            }
            break;
        case 'Escape':
            event.preventDefault();
            dropdown.style.display = 'none';
            selectedDropdownIndex = -1;
            break;
    }
}

function updateDropdownSelection(items) {
    items.forEach((item, index) => {
        if (index === selectedDropdownIndex) {
            item.classList.add('selected');
        } else {
            item.classList.remove('selected');
        }
    });
}

function scrollToSelectedItem(item) {
    if (!item) return;
    const dropdown = document.getElementById('player-dropdown');
    if (!dropdown) return;
    
    const itemTop = item.offsetTop;
    const itemBottom = itemTop + item.offsetHeight;
    const dropdownTop = dropdown.scrollTop;
    const dropdownBottom = dropdownTop + dropdown.offsetHeight;
    
    if (itemTop < dropdownTop) {
        dropdown.scrollTop = itemTop;
    } else if (itemBottom > dropdownBottom) {
        dropdown.scrollTop = itemBottom - dropdown.offsetHeight;
    }
}

function renderPlayerDropdown(playersToShow, dropdown) {
    if (playersToShow.length === 0) {
        dropdown.innerHTML = '<div class="dropdown-item disabled">No players available</div>';
        dropdown.style.display = 'block';
        selectedDropdownIndex = -1;
        return;
    }
    
    // Reset selected index when rendering new dropdown
    selectedDropdownIndex = -1;
    
    dropdown.innerHTML = playersToShow
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((player, index) => `
            <div class="dropdown-item ${index === selectedDropdownIndex ? 'selected' : ''}" data-player-id="${player.id}">
                ${escapeHtml(player.name)} (${Math.round(player.rating)})
            </div>
        `).join('');
    
    dropdown.style.display = 'block';
    
    // Add click listeners to dropdown items
    dropdown.querySelectorAll('.dropdown-item:not(.disabled)').forEach((item, index) => {
        item.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent document click from closing dropdown immediately
            selectedDropdownIndex = index;
            updateDropdownSelection(dropdown.querySelectorAll('.dropdown-item:not(.disabled)'));
            const playerId = item.getAttribute('data-player-id');
            if (playerId && !eventPlayers.includes(playerId)) {
                addPlayerToEvent(playerId);
            }
        });
        
        item.addEventListener('mouseenter', () => {
            selectedDropdownIndex = index;
            updateDropdownSelection(dropdown.querySelectorAll('.dropdown-item:not(.disabled)'));
        });
    });
}

function addPlayerToEvent(playerId) {
    if (eventPlayers.includes(playerId)) {
        return; // Player already in event
    }
    
    eventPlayers.push(playerId);
    
    // Clear search input and hide dropdown
    const searchInput = document.getElementById('player-search-input');
    if (searchInput) {
        searchInput.value = '';
    }
    const dropdown = document.getElementById('player-dropdown');
    if (dropdown) {
        dropdown.style.display = 'none';
    }
    
    // Reset selected index
    selectedDropdownIndex = -1;
    currentDropdownPlayers = [];
    
    renderEventPlayers();
    saveData();
}

function removePlayerFromEvent(playerId) {
    eventPlayers = eventPlayers.filter(id => id !== playerId);
    renderEventPlayers();
    saveData();
}

function clearAllEventPlayers() {
    if (eventPlayers.length === 0) {
        return;
    }
    
    if (confirm('Clear all players from the event?')) {
        eventPlayers = [];
        renderEventPlayers();
        saveData();
    }
}

function renderEventPlayers() {
    const eventPlayersList = document.getElementById('event-players-list');
    if (!eventPlayersList) return;
    
    if (eventPlayers.length === 0) {
        eventPlayersList.innerHTML = '<div class="empty-state"><p>No players in event. Use the search above to add players.</p></div>';
        return;
    }
    
    eventPlayersList.innerHTML = eventPlayers
        .map(playerId => {
            const player = players.find(p => p.id === playerId);
            if (!player) return '';
            
            return `
                <div class="event-player-item">
                    <span class="event-player-name">${escapeHtml(player.name)} (${Math.round(player.rating)})</span>
                    <button class="btn btn-danger btn-sm remove-player-btn" onclick="removePlayerFromEvent('${player.id}')">Remove</button>
                </div>
            `;
        })
        .filter(html => html !== '')
        .join('');
}

function getSelectedPlayers() {
    return eventPlayers;
}

// Match Generation
function generateMatches() {
    const matchType = document.getElementById('match-type').value;
    const selectedPlayerIds = getSelectedPlayers();
    const numRounds = parseInt(document.getElementById('num-rounds').value) || 1;
    const numCourts = parseInt(document.getElementById('num-courts').value) || 4;
    
    if (selectedPlayerIds.length < (matchType === 'singles' ? 2 : 4)) {
        alert(`Need at least ${matchType === 'singles' ? 2 : 4} selected players for ${matchType} matches`);
        return;
    }
    
    if (numRounds < 1 || numRounds > 10) {
        alert('Number of rounds must be between 1 and 10');
        return;
    }
    
    if (numCourts < 1 || numCourts > 20) {
        alert('Number of courts must be between 1 and 20');
        return;
    }
    
    if (matchType === 'singles') {
        generateSinglesMatches(selectedPlayerIds, numRounds, numCourts);
    } else {
        generateDoublesMatches(selectedPlayerIds, numRounds, numCourts);
    }
    
    saveData();
    renderMatches();
}

// Helper function to get the maximum round number from existing matches
function getMaxRoundNumber() {
    if (matches.length === 0) return 0;
    return matches.reduce((max, match) => {
        const round = match.round;
        if (round && typeof round === 'number') {
            return Math.max(max, round);
        }
        return max;
    }, 0);
}


function generateSinglesMatches(selectedPlayerIds, numRounds, maxCourts) {
    // Get the starting round number (next round after existing matches)
    const startRound = getMaxRoundNumber() + 1;
    
    // Initialize history data structures
    initializeHistory(selectedPlayerIds);
    
    // Initialize past rounds queue and sitting players
    const pastRounds = []; // Queue of last MAX_PAST_ROUNDS rounds, oldest at front
    let sittingPlayers = new Set();
    
    // Generate all rounds
    for (let roundNum = startRound; roundNum < startRound + numRounds; roundNum++) {
        const roundMatches = generateSinglesRound(
            selectedPlayerIds,
            roundNum,
            sittingPlayers,
            pastRounds,
            maxCourts
        );
        
        // Push round into queue of past rounds (for avoiding immediate repeats within generation session)
        pastRounds.push(roundMatches);
        if (pastRounds.length > MATCHMAKING_CONFIG.MAX_PAST_ROUNDS) {
            pastRounds.shift(); // Remove oldest round
        }
        
        // Note: History is updated when matches are completed (in submitScore/submitManualMatch),
        // not during generation, since generated matches haven't been played yet
        
        // Update sitting players for next round
        const playingThisRound = new Set();
        roundMatches.forEach(match => {
            playingThisRound.add(match.team1[0]);
            playingThisRound.add(match.team2[0]);
        });
        
        sittingPlayers = new Set();
        selectedPlayerIds.forEach(playerId => {
            if (!playingThisRound.has(playerId)) {
                sittingPlayers.add(playerId);
            }
        });
    }
}

// Initialize history data structures for all players
function initializeHistory(playerIds) {
    playerIds.forEach(p => {
        if (!opponentCount[p]) {
            opponentCount[p] = {};
        }
        if (!lastOpponentRound[p]) {
            lastOpponentRound[p] = {};
        }
        
        playerIds.forEach(q => {
            if (p !== q) {
                if (!opponentCount[p][q]) {
                    opponentCount[p][q] = 0;
                }
                if (!lastOpponentRound[p][q]) {
                    lastOpponentRound[p][q] = -Infinity;
                }
            }
        });
    });
}

function generateSinglesRound(allPlayers, roundIndex, sittingPlayersPrev, pastRounds, numCourts) {
    const availablePlayers = [...allPlayers]; // Copy to avoid mutation
    const roundMatches = [];
    let courtsUsed = 0;
    
    // Ensure we treat previous sitting players preferentially as seeds
    // But we still must intersect with currently available players
    const prioritizedSeeds = allPlayers.filter(p => sittingPlayersPrev.has(p) && availablePlayers.includes(p));
    
    while (courtsUsed < numCourts && availablePlayers.length >= 2) {
        // --- 1. Choose seed player ---
        let seed;
        if (prioritizedSeeds.length > 0) {
            const randomIndex = Math.floor(Math.random() * prioritizedSeeds.length);
            seed = prioritizedSeeds[randomIndex];
            prioritizedSeeds.splice(randomIndex, 1);
        } else {
            const randomIndex = Math.floor(Math.random() * availablePlayers.length);
            seed = availablePlayers[randomIndex];
        }
        
        // Remove seed from available players
        const seedIndex = availablePlayers.indexOf(seed);
        if (seedIndex === -1) break;
        availablePlayers.splice(seedIndex, 1);
        
        // --- 2. Probabilistically select opponent ---
        const candidatePool = availablePlayers.filter(p => p !== seed);
        
        if (candidatePool.length === 0) {
            break; // Can't form a match
        }
        
        const chosen = chooseNextPlayerProbabilistic(
            seed,
            [seed], // groupSoFar (just the seed for singles)
            candidatePool,
            roundIndex,
            pastRounds
        );
        
        if (chosen === null) {
            // No viable candidates; put seed back and try next seed
            availablePlayers.push(seed);
            continue;
        }
        
        // Optional: enforce hard group spread limit
        const seedPlayer = players.find(p => p.id === seed);
        const chosenPlayer = players.find(p => p.id === chosen);
        if (!seedPlayer || !chosenPlayer) {
            availablePlayers.push(seed);
            continue;
        }
        
        const spread = Math.abs(seedPlayer.rating - chosenPlayer.rating);
        const hardSpreadLimit = MATCHMAKING_CONFIG.SPREAD_TOL * 2; // Allow some flexibility
        if (spread > hardSpreadLimit) {
            // Try again with next seed
            availablePlayers.push(seed);
            continue;
        }
        
        // --- 3. Create match (for singles, no team split needed) ---
        const match = {
            id: `singles-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            type: 'singles',
            team1: [seed],
            team2: [chosen],
            round: roundIndex,
            completed: false
        };
        
        roundMatches.push(match);
        matches.push(match);
        
        // Remove chosen player from available pool
        const chosenIndex = availablePlayers.indexOf(chosen);
        if (chosenIndex !== -1) {
            availablePlayers.splice(chosenIndex, 1);
        }
        
        // Remove from prioritizedSeeds if present
        const seedIndexInPrioritized = prioritizedSeeds.indexOf(seed);
        if (seedIndexInPrioritized !== -1) {
            prioritizedSeeds.splice(seedIndexInPrioritized, 1);
        }
        const chosenIndexInPrioritized = prioritizedSeeds.indexOf(chosen);
        if (chosenIndexInPrioritized !== -1) {
            prioritizedSeeds.splice(chosenIndexInPrioritized, 1);
        }
        
        courtsUsed += 1;
    }
    
    // Remaining players (if any) sit out this round
    const newSittingPlayers = new Set(availablePlayers);
    
    return roundMatches;
}

// Probabilistic candidate selection with scoring function
function chooseNextPlayerProbabilistic(seed, groupSoFar, candidatePool, roundIndex, pastRounds) {
    const scores = {};  // candidate -> score
    const weights = {};
    
    for (const candidate of candidatePool) {
        const s = scoreCandidate(
            seed,
            candidate,
            groupSoFar,
            roundIndex,
            pastRounds
        );
        
        // If the candidate is "forbidden" (e.g. last round opponent), skip
        if (s === Infinity) {
            continue;
        }
        
        scores[candidate] = s;
    }
    
    if (Object.keys(scores).length === 0) {
        return null; // No viable candidates
    }
    
    // Softmax over -score: lower score → higher weight
    let totalWeight = 0.0;
    for (const candidate in scores) {
        const w = Math.exp(-MATCHMAKING_CONFIG.ALPHA_SOFTMAX * scores[candidate]);
        weights[candidate] = w;
        totalWeight += w;
    }
    
    if (totalWeight === 0) {
        return null; // Degenerate case; could fall back to uniform random
    }
    
    // Randomly sample one candidate according to weights
    const r = Math.random() * totalWeight;
    let cumulative = 0.0;
    for (const candidate in weights) {
        cumulative += weights[candidate];
        if (r <= cumulative) {
            return candidate;
        }
    }
    
    // Fallback, due to floating-point issues
    return Object.keys(weights)[0];
}

// Scoring function: combine skill, opponent history, spread
function scoreCandidate(seed, candidate, groupSoFar, roundIndex, pastRounds) {
    const seedPlayer = players.find(p => p.id === seed);
    const candidatePlayer = players.find(p => p.id === candidate);
    
    if (!seedPlayer || !candidatePlayer) {
        return Infinity; // Invalid players
    }
    
    // --- A. Hard rule: no immediate repeat opponent with seed ---
    // Check pastRounds first (for immediate repeats within generation session)
    if (pastRounds && pastRounds.length > 0) {
        // Check the most recent round
        const mostRecentRound = pastRounds[pastRounds.length - 1];
        for (const match of mostRecentRound) {
            if (match.type === 'singles') {
                const p1 = match.team1[0];
                const p2 = match.team2[0];
                if ((p1 === seed && p2 === candidate) || (p1 === candidate && p2 === seed)) {
                    return Infinity; // Forbid immediate repeat
                }
            }
        }
    }
    
    // Also check completed match history
    const lastSeedOpponentRound = lastOpponentRound[seed] && lastOpponentRound[seed][candidate] !== undefined
        ? lastOpponentRound[seed][candidate]
        : -Infinity;
    
    if (lastSeedOpponentRound === roundIndex - 1) {
        return Infinity; // Forbid this candidate
    }
    
    // --- B. Skill term: want expected_score close to 0.5 ---
    const es = expectedScore(seed, candidate);
    const skill_term = Math.pow(es - 0.5, 2) / (2 * Math.pow(MATCHMAKING_CONFIG.SIGMA_SKILL, 2));
    
    // --- C. Opponent history term: penalize recent frequent opponents ---
    let opp_term = 0.0;
    
    // Check history with seed
    const c = opponentCount[candidate] && opponentCount[candidate][seed] !== undefined
        ? opponentCount[candidate][seed]
        : 0;
    
    if (c > 0) {
        const lastRound = lastOpponentRound[candidate] && lastOpponentRound[candidate][seed] !== undefined
            ? lastOpponentRound[candidate][seed]
            : -Infinity;
        const roundsAgo = roundIndex - lastRound;
        
        if (roundsAgo > 0) {
            const decay = 1.0 / Math.pow(2, roundsAgo); // More recent → higher penalty
            opp_term += c * decay;
        }
    }
    
    // Also check with seed's perspective
    const c2 = opponentCount[seed] && opponentCount[seed][candidate] !== undefined
        ? opponentCount[seed][candidate]
        : 0;
    
    if (c2 > 0) {
        const lastRound = lastOpponentRound[seed] && lastOpponentRound[seed][candidate] !== undefined
            ? lastOpponentRound[seed][candidate]
            : -Infinity;
        const roundsAgo = roundIndex - lastRound;
        
        if (roundsAgo > 0) {
            const decay = 1.0 / Math.pow(2, roundsAgo);
            opp_term += c2 * decay;
        }
    }
    
    // --- D. Spread term: avoid huge rating range in this 2-player match ---
    const groupRatings = groupSoFar.map(p => {
        const player = players.find(pl => pl.id === p);
        return player ? player.rating : 0;
    });
    groupRatings.push(candidatePlayer.rating);
    
    const spread = Math.max(...groupRatings) - Math.min(...groupRatings);
    
    let spread_term = 0.0;
    if (spread <= MATCHMAKING_CONFIG.SPREAD_TOL) {
        spread_term = 0.0;
    } else {
        spread_term = spread - MATCHMAKING_CONFIG.SPREAD_TOL; // Penalty only for extra spread
    }
    
    // --- E. Combine ---
    const score = MATCHMAKING_CONFIG.W_SKILL * skill_term +
                  MATCHMAKING_CONFIG.W_OPP * opp_term +
                  MATCHMAKING_CONFIG.W_SPREAD * spread_term;
    
    return score;
}

// Expected score (Elo-style)
function expectedScore(i, j) {
    const playerI = players.find(p => p.id === i);
    const playerJ = players.find(p => p.id === j);
    
    if (!playerI || !playerJ) {
        return 0.5; // Default to even if players not found
    }
    
    const R_i = playerI.rating;
    const R_j = playerJ.rating;
    
    // Elo expected score: probability i defeats j
    return 1.0 / (1.0 + Math.pow(10, (R_j - R_i) / 400.0));
}

// Updating history from the round
function updateHistoryFromRound(roundMatches, roundIndex) {
    for (const match of roundMatches) {
        const teamA = match.team1; // [p1] for singles
        const teamB = match.team2; // [p2] for singles
        
        // For singles, update opponent history
        const p1 = teamA[0];
        const p2 = teamB[0];
        
        // Initialize if needed
        if (!opponentCount[p1]) {
            opponentCount[p1] = {};
        }
        if (!opponentCount[p2]) {
            opponentCount[p2] = {};
        }
        if (!lastOpponentRound[p1]) {
            lastOpponentRound[p1] = {};
        }
        if (!lastOpponentRound[p2]) {
            lastOpponentRound[p2] = {};
        }
        
        // Update opponent history
        opponentCount[p1][p2] = (opponentCount[p1][p2] || 0) + 1;
        opponentCount[p2][p1] = (opponentCount[p2][p1] || 0) + 1;
        lastOpponentRound[p1][p2] = roundIndex;
        lastOpponentRound[p2][p1] = roundIndex;
    }
}

function generateDoublesMatches(selectedPlayerIds, numRounds, maxCourts) {
    // Get the starting round number (next round after existing matches)
    const startRound = getMaxRoundNumber() + 1;
    
    // Initialize history data structures
    initializeDoublesHistory(selectedPlayerIds);
    
    // Initialize past rounds queue and sitting players
    const pastRounds = []; // Queue of last MAX_PAST_ROUNDS rounds, oldest at front
    let sittingPlayers = new Set();
    
    // Generate all rounds
    for (let roundNum = startRound; roundNum < startRound + numRounds; roundNum++) {
        const roundMatches = generateDoublesRound(
            selectedPlayerIds,
            roundNum,
            sittingPlayers,
            pastRounds,
            maxCourts
        );
        
        // Push round into queue of past rounds (for avoiding immediate repeats within generation session)
        pastRounds.push(roundMatches);
        if (pastRounds.length > MATCHMAKING_CONFIG.MAX_PAST_ROUNDS) {
            pastRounds.shift(); // Remove oldest round
        }
        
        // Note: History is updated when matches are completed (in submitScore/submitManualMatch),
        // not during generation, since generated matches haven't been played yet
        
        // Update sitting players for next round
        const playingThisRound = new Set();
        roundMatches.forEach(match => {
            match.team1.forEach(playerId => playingThisRound.add(playerId));
            match.team2.forEach(playerId => playingThisRound.add(playerId));
        });
        
        sittingPlayers = new Set();
        selectedPlayerIds.forEach(playerId => {
            if (!playingThisRound.has(playerId)) {
                sittingPlayers.add(playerId);
            }
        });
    }
}

// Initialize doubles history data structures for all players
function initializeDoublesHistory(playerIds) {
    playerIds.forEach(p => {
        if (!partnerCount[p]) {
            partnerCount[p] = {};
        }
        if (!lastPartnerRound[p]) {
            lastPartnerRound[p] = {};
        }
        if (!opponentCount[p]) {
            opponentCount[p] = {};
        }
        if (!lastOpponentRound[p]) {
            lastOpponentRound[p] = {};
        }
        
        playerIds.forEach(q => {
            if (p !== q) {
                if (!partnerCount[p][q]) {
                    partnerCount[p][q] = 0;
                }
                if (!lastPartnerRound[p][q]) {
                    lastPartnerRound[p][q] = -Infinity;
                }
                if (!opponentCount[p][q]) {
                    opponentCount[p][q] = 0;
                }
                if (!lastOpponentRound[p][q]) {
                    lastOpponentRound[p][q] = -Infinity;
                }
            }
        });
    });
}

function generateDoublesRound(allPlayers, roundIndex, sittingPlayersPrev, pastRounds, numCourts) {
    const availablePlayers = [...allPlayers]; // Copy to avoid mutation
    const roundMatches = [];
    let courtsUsed = 0;
    
    // Ensure we treat previous sitting players preferentially as seeds
    // But we still must intersect with currently available players
    const prioritizedSeeds = allPlayers.filter(p => sittingPlayersPrev.has(p) && availablePlayers.includes(p));
    
    while (courtsUsed < numCourts && availablePlayers.length >= 4) {
        // --- 1. Choose seed player ---
        let seed;
        if (prioritizedSeeds.length > 0) {
            const randomIndex = Math.floor(Math.random() * prioritizedSeeds.length);
            seed = prioritizedSeeds[randomIndex];
            prioritizedSeeds.splice(randomIndex, 1);
        } else {
            const randomIndex = Math.floor(Math.random() * availablePlayers.length);
            seed = availablePlayers[randomIndex];
        }
        
        // Remove seed from available players
        const seedIndex = availablePlayers.indexOf(seed);
        if (seedIndex === -1) break;
        availablePlayers.splice(seedIndex, 1);
        
        const group = [seed];
        
        // --- 2. Probabilistically select 3 more players around the seed ---
        for (let k = 1; k <= 3; k++) {
            const candidatePool = availablePlayers.filter(p => p !== seed && !group.includes(p));
            
            if (candidatePool.length === 0) {
                break; // Can't fill group; will exit loop below
            }
            
            const chosen = chooseNextPlayerProbabilisticDoubles(
                seed,
                group,
                candidatePool,
                roundIndex,
                pastRounds
            );
            
            if (chosen === null) {
                break; // No viable candidates (all zero weights); exit
            }
            
            group.push(chosen);
            
            // Remove chosen from available players
            const chosenIndex = availablePlayers.indexOf(chosen);
            if (chosenIndex !== -1) {
                availablePlayers.splice(chosenIndex, 1);
            }
        }
        
        // If we didn't get 4 players, stop forming matches
        if (group.length < 4) {
            // Put seed back and try next seed
            availablePlayers.push(seed);
            continue;
        }
        
        // Optional: enforce hard group spread limit
        const groupRatings = group.map(p => {
            const player = players.find(pl => pl.id === p);
            return player ? player.rating : 0;
        });
        const spread = Math.max(...groupRatings) - Math.min(...groupRatings);
        const hardSpreadLimit = MATCHMAKING_CONFIG.SPREAD_TOL * 2; // Allow some flexibility
        if (spread > hardSpreadLimit) {
            // Try again with next seed
            availablePlayers.push(seed);
            // Put back the other players
            group.slice(1).forEach(p => availablePlayers.push(p));
            continue;
        }
        
        // --- 3. Decide team split to balance Elo ---
        const [teamA, teamB] = chooseBestTeamSplit(group);
        
        // --- 4. Save match, remove players from available pool ---
        const match = {
            id: `doubles-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            type: 'doubles',
            team1: teamA,
            team2: teamB,
            round: roundIndex,
            completed: false
        };
        
        roundMatches.push(match);
        matches.push(match);
        
        // Remove from prioritizedSeeds if present
        group.forEach(p => {
            const indexInPrioritized = prioritizedSeeds.indexOf(p);
            if (indexInPrioritized !== -1) {
                prioritizedSeeds.splice(indexInPrioritized, 1);
            }
        });
        
        courtsUsed += 1;
    }
    
    // Remaining players (if any) sit out this round
    const newSittingPlayers = new Set(availablePlayers);
    
    return roundMatches;
}

// Probabilistic candidate selection for doubles
function chooseNextPlayerProbabilisticDoubles(seed, groupSoFar, candidatePool, roundIndex, pastRounds) {
    const scores = {};  // candidate -> score
    const weights = {};
    
    for (const candidate of candidatePool) {
        const s = scoreCandidateDoubles(
            seed,
            candidate,
            groupSoFar,
            roundIndex,
            pastRounds
        );
        
        // If the candidate is "forbidden" (e.g. last round partner), skip
        if (s === Infinity) {
            continue;
        }
        
        scores[candidate] = s;
    }
    
    if (Object.keys(scores).length === 0) {
        return null; // No viable candidates
    }
    
    // Softmax over -score: lower score → higher weight
    let totalWeight = 0.0;
    for (const candidate in scores) {
        const w = Math.exp(-MATCHMAKING_CONFIG.ALPHA_SOFTMAX * scores[candidate]);
        weights[candidate] = w;
        totalWeight += w;
    }
    
    if (totalWeight === 0) {
        return null; // Degenerate case; could fall back to uniform random
    }
    
    // Randomly sample one candidate according to weights
    const r = Math.random() * totalWeight;
    let cumulative = 0.0;
    for (const candidate in weights) {
        cumulative += weights[candidate];
        if (r <= cumulative) {
            return candidate;
        }
    }
    
    // Fallback, due to floating-point issues
    return Object.keys(weights)[0];
}

// Scoring function for doubles: combine skill, partner history, opponents, spread
function scoreCandidateDoubles(seed, candidate, groupSoFar, roundIndex, pastRounds) {
    const seedPlayer = players.find(p => p.id === seed);
    const candidatePlayer = players.find(p => p.id === candidate);
    
    if (!seedPlayer || !candidatePlayer) {
        return Infinity; // Invalid players
    }
    
    // --- A. Hard rule: no immediate repeat partner with seed ---
    // Check pastRounds first (for immediate repeats within generation session)
    if (pastRounds && pastRounds.length > 0) {
        const mostRecentRound = pastRounds[pastRounds.length - 1];
        for (const match of mostRecentRound) {
            if (match.type === 'doubles') {
                const team1 = match.team1;
                const team2 = match.team2;
                // Check if seed and candidate were partners in the most recent round
                if ((team1.includes(seed) && team1.includes(candidate)) ||
                    (team2.includes(seed) && team2.includes(candidate))) {
                    return Infinity; // Forbid immediate repeat
                }
            }
        }
    }
    
    // Also check completed match history
    const lastSeedPartnerRound = lastPartnerRound[seed] && lastPartnerRound[seed][candidate] !== undefined
        ? lastPartnerRound[seed][candidate]
        : -Infinity;
    
    if (lastSeedPartnerRound === roundIndex - 1) {
        return Infinity; // Forbid this candidate
    }
    
    // --- B. Skill term: want expected_score close to 0.5 ---
    const es = expectedScore(seed, candidate);
    const skill_term = Math.pow(es - 0.5, 2) / (2 * Math.pow(MATCHMAKING_CONFIG.SIGMA_SKILL, 2));
    
    // --- C. Partner history term: penalize recent frequent partners with groupSoFar ---
    let partner_term = 0.0;
    for (const q of groupSoFar) {
        if (q === candidate) continue;
        
        const c = partnerCount[candidate] && partnerCount[candidate][q] !== undefined
            ? partnerCount[candidate][q]
            : 0;
        
        if (c > 0) {
            const lastRound = lastPartnerRound[candidate] && lastPartnerRound[candidate][q] !== undefined
                ? lastPartnerRound[candidate][q]
                : -Infinity;
            const roundsAgo = roundIndex - lastRound;
            
            // If negative (never), skip
            if (roundsAgo > 0) {
                const decay = 1.0 / Math.pow(2, roundsAgo); // More recent → higher penalty
                partner_term += c * decay;
            }
        }
    }
    
    // --- D. Opponent history term ---
    let opp_term = 0.0;
    for (const q of groupSoFar) {
        if (q === candidate) continue;
        
        const c = opponentCount[candidate] && opponentCount[candidate][q] !== undefined
            ? opponentCount[candidate][q]
            : 0;
        
        if (c > 0) {
            const lastRound = lastOpponentRound[candidate] && lastOpponentRound[candidate][q] !== undefined
                ? lastOpponentRound[candidate][q]
                : -Infinity;
            const roundsAgo = roundIndex - lastRound;
            
            if (roundsAgo > 0) {
                const decay = 1.0 / Math.pow(2, roundsAgo);
                opp_term += c * decay;
            }
        }
    }
    
    // --- E. Spread term: avoid huge rating range in this 4-player group ---
    const groupRatings = groupSoFar.map(p => {
        const player = players.find(pl => pl.id === p);
        return player ? player.rating : 0;
    });
    groupRatings.push(candidatePlayer.rating);
    
    const spread = Math.max(...groupRatings) - Math.min(...groupRatings);
    
    let spread_term = 0.0;
    if (spread <= MATCHMAKING_CONFIG.SPREAD_TOL) {
        spread_term = 0.0;
    } else {
        spread_term = spread - MATCHMAKING_CONFIG.SPREAD_TOL; // Penalty only for extra spread
    }
    
    // --- F. Combine ---
    const score = MATCHMAKING_CONFIG.W_SKILL * skill_term +
                  MATCHMAKING_CONFIG.W_PARTNER * partner_term +
                  MATCHMAKING_CONFIG.W_OPP * opp_term +
                  MATCHMAKING_CONFIG.W_SPREAD * spread_term;
    
    return score;
}

// Team composite rating for doubles
function teamCompositeRating(p1, p2) {
    const player1 = players.find(p => p.id === p1);
    const player2 = players.find(p => p.id === p2);
    
    if (!player1 || !player2) {
        return 0;
    }
    
    const hi = Math.max(player1.rating, player2.rating);
    const lo = Math.min(player1.rating, player2.rating);
    return (2.0 / 3.0) * hi + (1.0 / 3.0) * lo;
}

// Choose best team split for a 4-player group
function chooseBestTeamSplit(groupOf4) {
    // groupOf4 = [a, b, c, d] in any order
    const [a, b, c, d] = groupOf4;
    
    const splits = [
        [[a, b], [c, d]],
        [[a, c], [b, d]],
        [[a, d], [b, c]]
    ];
    
    let bestSplit = null;
    let bestDiff = Infinity;
    
    for (const [teamA, teamB] of splits) {
        const tA = teamCompositeRating(teamA[0], teamA[1]);
        const tB = teamCompositeRating(teamB[0], teamB[1]);
        
        const diff = Math.abs(tA - tB);
        if (diff < bestDiff) {
            bestDiff = diff;
            bestSplit = [teamA, teamB];
        }
    }
    
    return bestSplit;
}

// Updating history from doubles round
function updateDoublesHistoryFromRound(roundMatches, roundIndex) {
    for (const match of roundMatches) {
        if (match.type !== 'doubles') continue;
        
        const teamA = match.team1; // [p1, p2]
        const teamB = match.team2; // [p3, p4]
        
        // Update partner history
        const p1 = teamA[0];
        const p2 = teamA[1];
        const p3 = teamB[0];
        const p4 = teamB[1];
        
        // Initialize if needed
        [p1, p2, p3, p4].forEach(p => {
            if (!partnerCount[p]) {
                partnerCount[p] = {};
            }
            if (!opponentCount[p]) {
                opponentCount[p] = {};
            }
            if (!lastPartnerRound[p]) {
                lastPartnerRound[p] = {};
            }
            if (!lastOpponentRound[p]) {
                lastOpponentRound[p] = {};
            }
        });
        
        // Update partner history for teamA
        partnerCount[p1][p2] = (partnerCount[p1][p2] || 0) + 1;
        partnerCount[p2][p1] = (partnerCount[p2][p1] || 0) + 1;
        lastPartnerRound[p1][p2] = roundIndex;
        lastPartnerRound[p2][p1] = roundIndex;
        
        // Update partner history for teamB
        partnerCount[p3][p4] = (partnerCount[p3][p4] || 0) + 1;
        partnerCount[p4][p3] = (partnerCount[p4][p3] || 0) + 1;
        lastPartnerRound[p3][p4] = roundIndex;
        lastPartnerRound[p4][p3] = roundIndex;
        
        // Update opponent history
        for (const a of teamA) {
            for (const b of teamB) {
                opponentCount[a][b] = (opponentCount[a][b] || 0) + 1;
                opponentCount[b][a] = (opponentCount[b][a] || 0) + 1;
                lastOpponentRound[a][b] = roundIndex;
                lastOpponentRound[b][a] = roundIndex;
            }
        }
    }
}

function clearMatches() {
    if (confirm('Are you sure you want to clear all generated matches?')) {
        matches = [];
        saveData();
        renderMatches();
        renderScores();
    }
}

function deleteMatch(matchId) {
    if (confirm('Are you sure you want to delete this match?')) {
        // Only delete if match exists and is not completed
        const match = matches.find(m => m.id === matchId);
        if (!match) {
            alert('Match not found');
            return;
        }
        if (match.completed) {
            alert('Cannot delete a completed match. Completed matches are in history.');
            return;
        }
        matches = matches.filter(m => m.id !== matchId);
        saveData();
        renderMatches();
        renderScores();
    }
}

function deleteAllUnplayedMatches() {
    // Since completed matches are removed from matches array, all matches here are unplayed
    const unplayedCount = matches.length;
    if (unplayedCount === 0) {
        alert('No unplayed matches to delete');
        return;
    }
    
    if (confirm(`Are you sure you want to delete all ${unplayedCount} unplayed matches?`)) {
        matches = [];
        saveData();
        renderMatches();
        renderScores();
    }
}

function renderMatches() {
    const matchesList = document.getElementById('matches-list');
    
    // Only show uncompleted matches in the Generate Matches section
    const uncompletedMatches = matches.filter(m => !m.completed);
    
    // Preserve existing score input values before re-rendering
    const preservedScores = {};
    uncompletedMatches.forEach(match => {
        const score1Input = document.getElementById(`score1-${match.id}`);
        const score2Input = document.getElementById(`score2-${match.id}`);
        if (score1Input && score1Input.value !== '') {
            preservedScores[`score1-${match.id}`] = score1Input.value;
        }
        if (score2Input && score2Input.value !== '') {
            preservedScores[`score2-${match.id}`] = score2Input.value;
        }
    });
    
    if (uncompletedMatches.length === 0) {
        matchesList.innerHTML = '<div class="empty-state"><h3>No matches generated</h3><p>Generate matches to see them here</p></div>';
        return;
    }
    
    // Group matches by round if they have round numbers
    const matchesByRound = {};
    uncompletedMatches.forEach(match => {
        const round = match.round || 'Unspecified';
        if (!matchesByRound[round]) {
            matchesByRound[round] = [];
        }
        matchesByRound[round].push(match);
    });
    
    const rounds = Object.keys(matchesByRound).sort((a, b) => {
        if (a === 'Unspecified') return 1;
        if (b === 'Unspecified') return -1;
        return parseInt(a) - parseInt(b);
    });
    
    // Calculate sitting out players for each round
    const getSittingOutPlayers = (roundMatches) => {
        // Get all players playing in this round
        const playingPlayers = new Set();
        roundMatches.forEach(match => {
            match.team1.forEach(playerId => playingPlayers.add(playerId));
            match.team2.forEach(playerId => playingPlayers.add(playerId));
        });
        
        // Get all event players
        const eventPlayerSet = new Set(eventPlayers);
        
        // Find players who are in the event but not playing
        const sittingOut = eventPlayers.filter(playerId => !playingPlayers.has(playerId));
        
        return sittingOut.map(playerId => {
            return getPlayerNameWithRating(playerId);
        }).filter(name => name !== 'Unknown');
    };
    
    matchesList.innerHTML = rounds.map((round, roundIndex) => {
        const roundMatches = matchesByRound[round];
        const sittingOutPlayers = getSittingOutPlayers(roundMatches);
        
        const roundHeader = round !== 'Unspecified' ? `<h3 style="margin-top: 20px; margin-bottom: 10px; color: #667eea;">Round ${round}</h3>` : '';
        
        const matchesHtml = roundMatches.map((match, matchIndex) => {
            const isEditing = editingMatchId === match.id;
            const isLastMatch = matchIndex === roundMatches.length - 1;
            
            // Restore preserved score values if they exist
            const score1Value = preservedScores[`score1-${match.id}`] || '';
            const score2Value = preservedScores[`score2-${match.id}`] || '';
            
            if (isEditing) {
                // Edit mode - show dropdowns with match type selector
                const currentMatchType = matchEditSelections.matchType || match.type || 'singles';
                
                if (currentMatchType === 'singles') {
                    return `
                        <div class="match-card ${currentMatchType}">
                            <div class="match-id">
                                Match ID: ${match.id}
                            </div>
                            <div style="margin-bottom: 10px;">
                                <label for="match-edit-${match.id}-type">Match Type: </label>
                                <select id="match-edit-${match.id}-type" onchange="updateMatchEditType('${match.id}')" style="margin-left: 5px;">
                                    <option value="singles" ${currentMatchType === 'singles' ? 'selected' : ''}>Singles</option>
                                    <option value="doubles" ${currentMatchType === 'doubles' ? 'selected' : ''}>Doubles</option>
                                </select>
                            </div>
                            <div class="teams">
                                <div class="team">
                                    <div class="manual-dropdown-wrapper">
                                        <input type="text" 
                                               id="match-edit-${match.id}-team1-player1-input" 
                                               class="match-edit-player-input" 
                                               placeholder="Search and select player..." 
                                               autocomplete="off"
                                               data-match-id="${match.id}"
                                               data-field="team1Player1"
                                               value="${matchEditSelections.team1Player1 ? getPlayerName(matchEditSelections.team1Player1) : ''}" />
                                        <div id="match-edit-${match.id}-team1-player1-dropdown" class="match-edit-player-dropdown"></div>
                                    </div>
                                </div>
                                <div class="vs">VS</div>
                                <div class="team">
                                    <div class="manual-dropdown-wrapper">
                                        <input type="text" 
                                               id="match-edit-${match.id}-team2-player1-input" 
                                               class="match-edit-player-input" 
                                               placeholder="Search and select player..." 
                                               autocomplete="off"
                                               data-match-id="${match.id}"
                                               data-field="team2Player1"
                                               value="${matchEditSelections.team2Player1 ? getPlayerName(matchEditSelections.team2Player1) : ''}" />
                                        <div id="match-edit-${match.id}-team2-player1-dropdown" class="match-edit-player-dropdown"></div>
                                    </div>
                                </div>
                            </div>
                            <div style="margin-top: 10px; display: flex; justify-content: space-between; align-items: center;">
                                <button class="btn btn-danger delete-match-btn" onclick="deleteMatch('${match.id}')">
                                    Delete Match
                                </button>
                                <div>
                                    <button class="btn btn-success" onclick="saveMatchEdit('${match.id}')" style="margin-right: 10px;">
                                        Save Changes
                                    </button>
                                    <button class="btn btn-secondary" onclick="cancelMatchEdit('${match.id}')">
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        </div>
                    `;
                } else {
                    return `
                        <div class="match-card ${currentMatchType}">
                            <div class="match-id">
                                Match ID: ${match.id}
                            </div>
                            <div style="margin-bottom: 10px;">
                                <label for="match-edit-${match.id}-type">Match Type: </label>
                                <select id="match-edit-${match.id}-type" onchange="updateMatchEditType('${match.id}')" style="margin-left: 5px;">
                                    <option value="singles" ${currentMatchType === 'singles' ? 'selected' : ''}>Singles</option>
                                    <option value="doubles" ${currentMatchType === 'doubles' ? 'selected' : ''}>Doubles</option>
                                </select>
                            </div>
                            <div class="teams">
                                <div class="team">
                                    <div class="manual-dropdown-wrapper">
                                        <input type="text" 
                                               id="match-edit-${match.id}-team1-player1-input" 
                                               class="match-edit-player-input" 
                                               placeholder="Search and select player 1..." 
                                               autocomplete="off"
                                               data-match-id="${match.id}"
                                               data-field="team1Player1"
                                               value="${matchEditSelections.team1Player1 ? getPlayerName(matchEditSelections.team1Player1) : ''}" />
                                        <div id="match-edit-${match.id}-team1-player1-dropdown" class="match-edit-player-dropdown"></div>
                                    </div>
                                    <div class="manual-dropdown-wrapper" style="margin-top: 5px;">
                                        <input type="text" 
                                               id="match-edit-${match.id}-team1-player2-input" 
                                               class="match-edit-player-input" 
                                               placeholder="Search and select player 2..." 
                                               autocomplete="off"
                                               data-match-id="${match.id}"
                                               data-field="team1Player2"
                                               value="${matchEditSelections.team1Player2 ? getPlayerName(matchEditSelections.team1Player2) : ''}" />
                                        <div id="match-edit-${match.id}-team1-player2-dropdown" class="match-edit-player-dropdown"></div>
                                    </div>
                                </div>
                                <div class="vs">VS</div>
                                <div class="team">
                                    <div class="manual-dropdown-wrapper">
                                        <input type="text" 
                                               id="match-edit-${match.id}-team2-player1-input" 
                                               class="match-edit-player-input" 
                                               placeholder="Search and select player 1..." 
                                               autocomplete="off"
                                               data-match-id="${match.id}"
                                               data-field="team2Player1"
                                               value="${matchEditSelections.team2Player1 ? getPlayerName(matchEditSelections.team2Player1) : ''}" />
                                        <div id="match-edit-${match.id}-team2-player1-dropdown" class="match-edit-player-dropdown"></div>
                                    </div>
                                    <div class="manual-dropdown-wrapper" style="margin-top: 5px;">
                                        <input type="text" 
                                               id="match-edit-${match.id}-team2-player2-input" 
                                               class="match-edit-player-input" 
                                               placeholder="Search and select player 2..." 
                                               autocomplete="off"
                                               data-match-id="${match.id}"
                                               data-field="team2Player2"
                                               value="${matchEditSelections.team2Player2 ? getPlayerName(matchEditSelections.team2Player2) : ''}" />
                                        <div id="match-edit-${match.id}-team2-player2-dropdown" class="match-edit-player-dropdown"></div>
                                    </div>
                                </div>
                            </div>
                            <div style="margin-top: 10px; display: flex; justify-content: space-between; align-items: center;">
                                <button class="btn btn-danger delete-match-btn" onclick="deleteMatch('${match.id}')">
                                    Delete Match
                                </button>
                                <div>
                                    <button class="btn btn-success" onclick="saveMatchEdit('${match.id}')" style="margin-right: 10px;">
                                        Save Changes
                                    </button>
                                    <button class="btn btn-secondary" onclick="cancelMatchEdit('${match.id}')">
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        </div>
                    `;
                }
            } else {
                // Normal view - show players with inline score inputs
                if (match.type === 'doubles') {
                    // For doubles, stack player names vertically with score to the side
                    const team1PlayerNames = match.team1.map(id => getPlayerNameWithRating(id));
                    const team2PlayerNames = match.team2.map(id => getPlayerNameWithRating(id));
                    
                    return `
                        <div class="match-card ${match.type}">
                            <div class="match-id">
                                Match ID: ${match.id} | Type: ${match.type}
                            </div>
                            <div class="teams">
                                <div class="team">
                                    <div class="team-with-score">
                                        <div class="team-names-stacked">
                                            ${team1PlayerNames.map(name => `<div class="player-name">${escapeHtml(name)}</div>`).join('')}
                                        </div>
                                        <input type="number" min="0" max="30" id="score1-${match.id}" value="${score1Value}" placeholder="Score" />
                                    </div>
                                </div>
                                <div class="vs">VS</div>
                                <div class="team">
                                    <div class="team-with-score">
                                        <input type="number" min="0" max="30" id="score2-${match.id}" value="${score2Value}" placeholder="Score" />
                                        <div class="team-names-stacked">
                                            ${team2PlayerNames.map(name => `<div class="player-name">${escapeHtml(name)}</div>`).join('')}
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div style="margin-top: 10px; display: flex; justify-content: space-between; align-items: center;">
                                <button class="btn btn-danger delete-match-btn" onclick="deleteMatch('${match.id}')">
                                    Delete Match
                                </button>
                                <div>
                                    <button class="btn btn-primary" onclick="startMatchEdit('${match.id}')" style="margin-right: 10px;">
                                        Edit Match
                                    </button>
                                    <button class="btn btn-success" onclick="submitScoreInline('${match.id}')">
                                        Submit Score
                                    </button>
                                </div>
                            </div>
                        </div>
                        ${isLastMatch ? `<div style="margin-top: 10px; margin-bottom: 15px;"><button class="btn btn-secondary" onclick="addNewMatch(${round === 'Unspecified' ? 'null' : round})">Add Match</button></div>` : ''}
                    `;
                } else {
                    // For singles, keep the horizontal layout
                    const team1Players = match.team1.map(id => getPlayerNameWithRating(id)).join(' & ');
                    const team2Players = match.team2.map(id => getPlayerNameWithRating(id)).join(' & ');
                    
                    return `
                        <div class="match-card ${match.type}">
                            <div class="match-id">
                                Match ID: ${match.id} | Type: ${match.type}
                            </div>
                            <div class="teams">
                                <div class="team">
                                    <div class="team-name" style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap; justify-content: center;">
                                        <div>${escapeHtml(team1Players)}</div>
                                        <input type="number" min="0" max="30" id="score1-${match.id}" value="${score1Value}" placeholder="Score" />
                                    </div>
                                </div>
                                <div class="vs">VS</div>
                                <div class="team">
                                    <div class="team-name" style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap; justify-content: center;">
                                        <input type="number" min="0" max="30" id="score2-${match.id}" value="${score2Value}" placeholder="Score" />
                                        <div>${escapeHtml(team2Players)}</div>
                                    </div>
                                </div>
                            </div>
                            <div style="margin-top: 10px; display: flex; justify-content: space-between; align-items: center;">
                                <button class="btn btn-danger delete-match-btn" onclick="deleteMatch('${match.id}')">
                                    Delete Match
                                </button>
                                <div>
                                    <button class="btn btn-primary" onclick="startMatchEdit('${match.id}')" style="margin-right: 10px;">
                                        Edit Match
                                    </button>
                                    <button class="btn btn-success" onclick="submitScoreInline('${match.id}')">
                                        Submit Score
                                    </button>
                                </div>
                            </div>
                        </div>
                        ${isLastMatch ? `<div style="margin-top: 10px; margin-bottom: 15px;"><button class="btn btn-secondary" onclick="addNewMatch(${round === 'Unspecified' ? 'null' : round})">Add Match</button></div>` : ''}
                    `;
                }
            }
        }).join('');
        
        // Create sitting out players list HTML
        const sittingOutHtml = sittingOutPlayers.length > 0 
            ? `<div class="sitting-out-container">
                <h4 style="margin: 0 0 10px 0; color: #666; font-size: 0.95em; font-weight: 600;">Sitting Out:</h4>
                <ul class="sitting-out-list">
                    ${sittingOutPlayers.map(playerName => `<li>${escapeHtml(playerName)}</li>`).join('')}
                </ul>
               </div>`
            : '<div class="sitting-out-container"><p style="margin: 0; color: #28a745; font-size: 0.9em; font-weight: 500;">✓ All players are playing</p></div>';
        
        return `<div class="round-container">${roundHeader}<div class="round-content"><div class="matches-container">${matchesHtml}</div>${sittingOutHtml}</div></div>`;
    }).join('');
    
    // Initialize match edit dropdowns if a match is being edited
    if (editingMatchId) {
        initializeMatchEditDropdowns();
    }
}

// Match Editing Functions
function startMatchEdit(matchId) {
    const match = matches.find(m => m.id === matchId);
    if (!match) return;
    
    // Initialize edit selections with current match players
    editingMatchId = matchId;
    matchEditSelections = {
        matchType: match.type || 'singles',
        team1Player1: match.team1[0] || null,
        team1Player2: match.team1[1] || null,
        team2Player1: match.team2[0] || null,
        team2Player2: match.team2[1] || null
    };
    
    renderMatches();
}

function generateCustomMatch() {
    // Get the current round number (next round after existing matches, or 1 if no matches)
    const currentRound = getMaxRoundNumber() + 1;
    // Get the selected match type from the dropdown
    const matchTypeSelect = document.getElementById('match-type');
    const matchType = matchTypeSelect ? matchTypeSelect.value : 'singles';
    addNewMatch(currentRound, matchType);
}

function addNewMatch(round, matchType = 'singles') {
    // Create a new match
    const newMatch = {
        id: Date.now().toString(),
        type: matchType,
        team1: [],
        team2: [],
        completed: false,
        round: round || undefined
    };
    
    matches.push(newMatch);
    saveData();
    
    // Open it for editing
    editingMatchId = newMatch.id;
    matchEditSelections = {
        matchType: matchType,
        team1Player1: null,
        team1Player2: null,
        team2Player1: null,
        team2Player2: null
    };
    
    renderMatches();
}

function updateMatchEditType(matchId) {
    const selectElement = document.getElementById(`match-edit-${matchId}-type`);
    if (!selectElement) return;
    
    const newType = selectElement.value;
    matchEditSelections.matchType = newType;
    
    // When switching from doubles to singles, keep first player on each team
    // When switching from singles to doubles, add null for second player
    if (newType === 'singles') {
        // Keep first player, clear second
        matchEditSelections.team1Player2 = null;
        matchEditSelections.team2Player2 = null;
    }
    // If switching to doubles, second players remain null (user needs to fill them)
    
    renderMatches();
}

function cancelMatchEdit(matchId) {
    // If this is a new match with no players, delete it
    const match = matches.find(m => m.id === matchId);
    if (match && match.team1.length === 0 && match.team2.length === 0) {
        matches = matches.filter(m => m.id !== matchId);
        saveData();
    }
    
    editingMatchId = null;
    matchEditSelections = {
        matchType: 'singles',
        team1Player1: null,
        team1Player2: null,
        team2Player1: null,
        team2Player2: null
    };
    activeMatchEditDropdown = null;
    activeMatchEditDropdownIndex = -1;
    activeMatchEditDropdownPlayers = [];
    renderMatches();
}

function saveMatchEdit(matchId) {
    const match = matches.find(m => m.id === matchId);
    if (!match) return;
    
    // Get the match type from selections (may have been changed)
    const matchType = matchEditSelections.matchType || match.type || 'singles';
    
    // Validate selections based on match type
    if (matchType === 'singles') {
        if (!matchEditSelections.team1Player1 || !matchEditSelections.team2Player1) {
            alert('Please select all players');
            return;
        }
        if (matchEditSelections.team1Player1 === matchEditSelections.team2Player1) {
            alert('Players cannot play against themselves');
            return;
        }
    } else {
        if (!matchEditSelections.team1Player1 || !matchEditSelections.team1Player2 || 
            !matchEditSelections.team2Player1 || !matchEditSelections.team2Player2) {
            alert('Please select all players');
            return;
        }
        // Check for duplicate players
        const allPlayers = [
            matchEditSelections.team1Player1, 
            matchEditSelections.team1Player2, 
            matchEditSelections.team2Player1, 
            matchEditSelections.team2Player2
        ];
        if (new Set(allPlayers).size !== 4) {
            alert('Each player can only appear once in a match');
            return;
        }
    }
    
    // Get all players that are being changed
    const oldTeam1 = match.team1;
    const oldTeam2 = match.team2;
    const newTeam1 = matchType === 'singles' 
        ? [matchEditSelections.team1Player1]
        : [matchEditSelections.team1Player1, matchEditSelections.team1Player2];
    const newTeam2 = matchType === 'singles'
        ? [matchEditSelections.team2Player1]
        : [matchEditSelections.team2Player1, matchEditSelections.team2Player2];
    
    // Find players that are being moved to this match from other matches
    const playersToSwap = [];
    newTeam1.forEach(newPlayerId => {
        if (!oldTeam1.includes(newPlayerId) && !oldTeam2.includes(newPlayerId)) {
            // This player is new to this match - check if they're in another match
            const otherMatch = matches.find(m => 
                m.id !== matchId && 
                !m.completed && 
                (m.team1.includes(newPlayerId) || m.team2.includes(newPlayerId))
            );
            if (otherMatch) {
                playersToSwap.push({
                    playerId: newPlayerId,
                    fromMatch: otherMatch,
                    toMatch: match,
                    toTeam: 'team1',
                    toPosition: newTeam1.indexOf(newPlayerId)
                });
            }
        }
    });
    
    newTeam2.forEach(newPlayerId => {
        if (!oldTeam1.includes(newPlayerId) && !oldTeam2.includes(newPlayerId)) {
            // This player is new to this match - check if they're in another match
            const otherMatch = matches.find(m => 
                m.id !== matchId && 
                !m.completed && 
                (m.team1.includes(newPlayerId) || m.team2.includes(newPlayerId))
            );
            if (otherMatch) {
                playersToSwap.push({
                    playerId: newPlayerId,
                    fromMatch: otherMatch,
                    toMatch: match,
                    toTeam: 'team2',
                    toPosition: newTeam2.indexOf(newPlayerId)
                });
            }
        }
    });
    
    // Perform swaps: for each player being moved to this match, swap them with the player they're replacing
    playersToSwap.forEach(swap => {
        const fromMatch = swap.fromMatch;
        const fromTeam = fromMatch.team1.includes(swap.playerId) ? 'team1' : 'team2';
        const fromPosition = fromMatch[fromTeam].indexOf(swap.playerId);
        
        // Find the player being replaced in the target match (use old teams since we haven't updated yet)
        const replacedPlayerId = swap.toTeam === 'team1' 
            ? oldTeam1[swap.toPosition]
            : oldTeam2[swap.toPosition];
        
        // Swap: move new player will go to target match (handled below), move replaced player to source match
        fromMatch[fromTeam][fromPosition] = replacedPlayerId;
    });
    
    // Update the match with new teams and type
    match.team1 = newTeam1;
    match.team2 = newTeam2;
    match.type = matchType;
    
    // Clear edit state
    editingMatchId = null;
    matchEditSelections = {
        matchType: 'singles',
        team1Player1: null,
        team1Player2: null,
        team2Player1: null,
        team2Player2: null
    };
    activeMatchEditDropdown = null;
    activeMatchEditDropdownIndex = -1;
    activeMatchEditDropdownPlayers = [];
    
    saveData();
    renderMatches();
}

function initializeMatchEditDropdowns() {
    const inputs = document.querySelectorAll('.match-edit-player-input');
    
    inputs.forEach(input => {
        const field = input.getAttribute('data-field');
        const matchId = input.getAttribute('data-match-id');
        const dropdownId = input.id.replace('-input', '-dropdown');
        const dropdown = document.getElementById(dropdownId);
        
        if (!dropdown) return;
        
        // Input event - search and filter
        input.addEventListener('input', (e) => {
            const selectedPlayerId = matchEditSelections[field];
            if (selectedPlayerId) {
                const selectedPlayer = players.find(p => p.id === selectedPlayerId);
                if (selectedPlayer && input.value !== selectedPlayer.name) {
                    matchEditSelections[field] = null;
                }
            }
            handleMatchEditSearch(e, field, dropdown, matchId);
        });
        
        // Focus event - show dropdown
        input.addEventListener('focus', (e) => {
            activeMatchEditDropdown = field;
            handleMatchEditSearch(e, field, dropdown, matchId);
        });
        
        // Blur event - close dropdown when focus is lost
        input.addEventListener('blur', (e) => {
            setTimeout(() => {
                if (activeMatchEditDropdown === field) {
                    dropdown.style.display = 'none';
                    activeMatchEditDropdown = null;
                    activeMatchEditDropdownIndex = -1;
                    activeMatchEditDropdownPlayers = [];
                }
            }, 200);
        });
        
        // Keydown event - keyboard navigation
        input.addEventListener('keydown', (e) => {
            handleMatchEditKeydown(e, field, dropdown, matchId);
        });
        
        // Click event - show dropdown
        input.addEventListener('click', (e) => {
            activeMatchEditDropdown = field;
            handleMatchEditSearch(e, field, dropdown, matchId);
        });
    });
}

function handleMatchEditSearch(event, field, dropdown, matchId) {
    const input = event.target;
    const searchTerm = input.value.toLowerCase().trim();
    
    // Reset selected index when search changes
    if (activeMatchEditDropdown === field) {
        activeMatchEditDropdownIndex = -1;
    }
    
    // Get all players in the event, sorted alphabetically
    const sortedPlayers = eventPlayers
        .map(id => players.find(p => p.id === id))
        .filter(p => p !== undefined)
        .sort((a, b) => a.name.localeCompare(b.name));
    
    // Get currently selected players in other fields of this match to exclude them
    const otherSelectedPlayers = Object.values(matchEditSelections).filter(id => id && id !== matchEditSelections[field]);
    
    // Get current match to exclude players already in it (unless they're being edited)
    const currentMatch = matches.find(m => m.id === matchId);
    const currentMatchPlayers = currentMatch ? [...currentMatch.team1, ...currentMatch.team2] : [];
    
    let filteredPlayers;
    if (searchTerm === '') {
        // Show all event players not selected in other fields
        filteredPlayers = sortedPlayers.filter(p => 
            !otherSelectedPlayers.includes(p.id) && 
            // Allow current match players to be shown (they can stay the same)
            (currentMatchPlayers.includes(p.id) || !currentMatchPlayers.includes(p.id))
        );
    } else {
        // Filter by search term
        filteredPlayers = sortedPlayers.filter(player => {
            const nameMatch = player.name.toLowerCase().includes(searchTerm);
            const notSelectedElsewhere = !otherSelectedPlayers.includes(player.id);
            return nameMatch && notSelectedElsewhere;
        });
    }
    
    if (activeMatchEditDropdown === field) {
        activeMatchEditDropdownPlayers = filteredPlayers;
    }
    
    renderMatchEditDropdown(filteredPlayers, dropdown, field);
}

function handleMatchEditKeydown(event, field, dropdown, matchId) {
    if (activeMatchEditDropdown !== field) return;
    
    // Handle Tab key - close dropdown immediately when tabbing away
    if (event.key === 'Tab') {
        dropdown.style.display = 'none';
        activeMatchEditDropdown = null;
        activeMatchEditDropdownIndex = -1;
        activeMatchEditDropdownPlayers = [];
        return;
    }
    
    const items = dropdown.querySelectorAll('.match-edit-dropdown-item:not(.disabled)');
    if (items.length === 0) {
        if (event.key === 'Enter') {
            event.preventDefault();
        }
        return;
    }
    
    switch (event.key) {
        case 'ArrowDown':
            event.preventDefault();
            if (activeMatchEditDropdownIndex < 0) {
                activeMatchEditDropdownIndex = 0;
            } else {
                activeMatchEditDropdownIndex = (activeMatchEditDropdownIndex + 1) % items.length;
            }
            updateMatchEditDropdownSelection(items);
            scrollToMatchEditSelectedItem(items[activeMatchEditDropdownIndex], dropdown);
            break;
        case 'ArrowUp':
            event.preventDefault();
            if (activeMatchEditDropdownIndex <= 0) {
                activeMatchEditDropdownIndex = items.length - 1;
            } else {
                activeMatchEditDropdownIndex = activeMatchEditDropdownIndex - 1;
            }
            updateMatchEditDropdownSelection(items);
            scrollToMatchEditSelectedItem(items[activeMatchEditDropdownIndex], dropdown);
            break;
        case 'Enter':
            event.preventDefault();
            if (activeMatchEditDropdownIndex >= 0 && activeMatchEditDropdownIndex < items.length) {
                const playerId = items[activeMatchEditDropdownIndex].getAttribute('data-player-id');
                if (playerId) {
                    selectMatchEditPlayer(field, playerId);
                }
            } else if (items.length > 0) {
                const playerId = items[0].getAttribute('data-player-id');
                if (playerId) {
                    selectMatchEditPlayer(field, playerId);
                }
            }
            break;
        case 'Escape':
            event.preventDefault();
            dropdown.style.display = 'none';
            activeMatchEditDropdown = null;
            activeMatchEditDropdownIndex = -1;
            activeMatchEditDropdownPlayers = [];
            break;
    }
}

function renderMatchEditDropdown(playersToShow, dropdown, field) {
    if (playersToShow.length === 0) {
        dropdown.innerHTML = '<div class="match-edit-dropdown-item disabled">No players available</div>';
        dropdown.style.display = 'block';
        return;
    }
    
    // Reset selected index when rendering new dropdown
    if (activeMatchEditDropdown === field) {
        activeMatchEditDropdownIndex = -1;
    }
    
    dropdown.innerHTML = playersToShow
        .map((player, index) => `
            <div class="match-edit-dropdown-item ${index === activeMatchEditDropdownIndex && activeMatchEditDropdown === field ? 'selected' : ''}" 
                 data-player-id="${player.id}">
                ${escapeHtml(player.name)} (${Math.round(player.rating)})
            </div>
        `).join('');
    
    dropdown.style.display = 'block';
    
    // Add click listeners to dropdown items
    dropdown.querySelectorAll('.match-edit-dropdown-item:not(.disabled)').forEach((item, index) => {
        item.addEventListener('click', (e) => {
            e.stopPropagation();
            if (activeMatchEditDropdown === field) {
                activeMatchEditDropdownIndex = index;
            }
            const playerId = item.getAttribute('data-player-id');
            if (playerId) {
                selectMatchEditPlayer(field, playerId);
            }
        });
        
        item.addEventListener('mouseenter', () => {
            if (activeMatchEditDropdown === field) {
                activeMatchEditDropdownIndex = index;
                updateMatchEditDropdownSelection(dropdown.querySelectorAll('.match-edit-dropdown-item:not(.disabled)'));
            }
        });
    });
}

function updateMatchEditDropdownSelection(items) {
    items.forEach((item, index) => {
        if (index === activeMatchEditDropdownIndex && activeMatchEditDropdown) {
            item.classList.add('selected');
        } else {
            item.classList.remove('selected');
        }
    });
}

function scrollToMatchEditSelectedItem(item, dropdown) {
    if (!item) return;
    
    const itemTop = item.offsetTop;
    const itemBottom = itemTop + item.offsetHeight;
    const dropdownTop = dropdown.scrollTop;
    const dropdownBottom = dropdownTop + dropdown.offsetHeight;
    
    if (itemTop < dropdownTop) {
        dropdown.scrollTop = itemTop;
    } else if (itemBottom > dropdownBottom) {
        dropdown.scrollTop = itemBottom - dropdown.offsetHeight;
    }
}

function selectMatchEditPlayer(field, playerId) {
    matchEditSelections[field] = playerId;
    
    // Find the input by field and match ID (only one match can be edited at a time)
    const inputs = document.querySelectorAll('.match-edit-player-input');
    inputs.forEach(input => {
        if (input.getAttribute('data-field') === field && 
            input.getAttribute('data-match-id') === editingMatchId) {
            const player = players.find(p => p.id === playerId);
            if (player) {
                input.value = player.name;
            }
        }
    });
    
    // Hide dropdown immediately
    const dropdowns = document.querySelectorAll('.match-edit-player-dropdown');
    dropdowns.forEach(dd => {
        if (dd.style.display !== 'none') {
            dd.style.display = 'none';
        }
    });
    
    // Reset active dropdown state
    activeMatchEditDropdown = null;
    activeMatchEditDropdownIndex = -1;
    activeMatchEditDropdownPlayers = [];
}

function submitScoreInline(matchId) {
    const match = matches.find(m => m.id === matchId);
    if (!match) return;
    
    const score1Input = document.getElementById(`score1-${matchId}`);
    const score2Input = document.getElementById(`score2-${matchId}`);
    
    if (!score1Input || !score2Input) {
        alert('Score inputs not found');
        return;
    }
    
    const score1 = parseInt(score1Input.value);
    const score2 = parseInt(score2Input.value);
    
    if (isNaN(score1) || isNaN(score2)) {
        alert('Please enter valid scores');
        return;
    }
    
    if (score1 < 0 || score2 < 0) {
        alert('Scores cannot be negative');
        return;
    }
    
    if (score1 === score2) {
        alert('Scores cannot be equal (badminton requires a winner)');
        return;
    }
    
    // Update match
    match.score1 = score1;
    match.score2 = score2;
    match.completed = true;
    
    // Calculate ELO updates
    updateELORatings(match);
    
    // Add to history
    matchHistory.push({
        ...match,
        completedAt: new Date().toISOString()
    });
    
    // Update matchmaking history for completed matches
    if (match.round !== undefined) {
        if (match.type === 'singles') {
            updateHistoryFromRound([match], match.round);
        } else if (match.type === 'doubles') {
            updateDoublesHistoryFromRound([match], match.round);
        }
    }
    
    // Remove completed match from matches array (it's now only in history)
    matches = matches.filter(m => m.id !== matchId);
    
    saveData();
    renderMatches();
    renderPlayers();
    renderHistory();
}

function submitScore(event, matchId) {
    event.preventDefault();
    submitScoreInline(matchId);
}

// ELO Rating Calculation
function updateELORatings(match) {
    const team1Players = match.team1.map(id => players.find(p => p.id === id));
    const team2Players = match.team2.map(id => players.find(p => p.id === id));
    
    // Calculate average ratings for teams
    const team1Rating = team1Players.reduce((sum, p) => sum + p.rating, 0) / team1Players.length;
    const team2Rating = team2Players.reduce((sum, p) => sum + p.rating, 0) / team2Players.length;
    
    // Determine winner (team with higher score)
    const team1Won = match.score1 > match.score2;
    const actualScore1 = team1Won ? 1 : 0;
    const actualScore2 = team1Won ? 0 : 1;
    
    // Calculate expected scores
    const expectedScore1 = 1 / (1 + Math.pow(10, (team2Rating - team1Rating) / 400));
    const expectedScore2 = 1 / (1 + Math.pow(10, (team1Rating - team2Rating) / 400));
    
    // Calculate rating changes
    const ratingChange1 = ELO_CONFIG.K_FACTOR * (actualScore1 - expectedScore1);
    const ratingChange2 = ELO_CONFIG.K_FACTOR * (actualScore2 - expectedScore2);
    
    // Update team 1 players
    team1Players.forEach(player => {
        const oldRating = player.rating;
        player.rating = Math.round(player.rating + ratingChange1);
        player.matchesPlayed++;
        if (team1Won) {
            player.wins++;
        } else {
            player.losses++;
        }
        
        // Track partners/opponents
        if (match.type === 'doubles') {
            team1Players.forEach(partner => {
                if (partner.id !== player.id && !player.partners.includes(partner.id)) {
                    player.partners.push(partner.id);
                }
            });
            team2Players.forEach(opponent => {
                if (!player.opponents.includes(opponent.id)) {
                    player.opponents.push(opponent.id);
                }
            });
        } else {
            team2Players.forEach(opponent => {
                if (!player.opponents.includes(opponent.id)) {
                    player.opponents.push(opponent.id);
                }
            });
        }
        
        // Store rating change for history
        match.ratingChanges = match.ratingChanges || {};
        match.ratingChanges[player.id] = {
            old: oldRating,
            new: player.rating,
            change: Math.round(ratingChange1)
        };
    });
    
    // Update team 2 players
    team2Players.forEach(player => {
        const oldRating = player.rating;
        player.rating = Math.round(player.rating + ratingChange2);
        player.matchesPlayed++;
        if (!team1Won) {
            player.wins++;
        } else {
            player.losses++;
        }
        
        // Track partners/opponents
        if (match.type === 'doubles') {
            team2Players.forEach(partner => {
                if (partner.id !== player.id && !player.partners.includes(partner.id)) {
                    player.partners.push(partner.id);
                }
            });
            team1Players.forEach(opponent => {
                if (!player.opponents.includes(opponent.id)) {
                    player.opponents.push(opponent.id);
                }
            });
        } else {
            team1Players.forEach(opponent => {
                if (!player.opponents.includes(opponent.id)) {
                    player.opponents.push(opponent.id);
                }
            });
        }
        
        // Store rating change for history
        match.ratingChanges = match.ratingChanges || {};
        match.ratingChanges[player.id] = {
            old: oldRating,
            new: player.rating,
            change: Math.round(ratingChange2)
        };
    });
}

// Match History
function renderHistory() {
    const historyList = document.getElementById('match-history');
    
    if (matchHistory.length === 0) {
        historyList.innerHTML = '<div class="empty-state"><h3>No match history</h3><p>Complete matches to see them here</p></div>';
        return;
    }
    
    historyList.innerHTML = matchHistory
        .slice()
        .reverse()
        .map(match => {
            const team1Players = match.team1.map(id => getPlayerName(id)).join(' & ');
            const team2Players = match.team2.map(id => getPlayerName(id)).join(' & ');
            const winner = match.score1 > match.score2 ? team1Players : team2Players;
            
            const ratingChanges = match.ratingChanges || {};
            const ratingChangesHtml = Object.keys(ratingChanges).map(playerId => {
                const change = ratingChanges[playerId];
                const playerName = getPlayerName(playerId);
                const sign = change.change >= 0 ? '+' : '';
                return `${playerName}: ${change.old} → ${change.new} (${sign}${change.change})`;
            }).join('<br>');
            
            return `
                <div class="match-history-item">
                    <div><strong>${escapeHtml(team1Players)}</strong> ${match.score1} - ${match.score2} <strong>${escapeHtml(team2Players)}</strong></div>
                    <div class="result">Winner: ${escapeHtml(winner)}</div>
                    <div class="rating-change">Rating Changes:<br>${ratingChangesHtml}</div>
                    <div style="font-size: 0.8em; color: #999; margin-top: 5px;">${new Date(match.completedAt).toLocaleString()}</div>
                </div>
            `;
        }).join('');
}

// Utility Functions
function getPlayerName(playerId) {
    const player = players.find(p => p.id === playerId);
    return player ? player.name : 'Unknown';
}

function getPlayerNameWithRating(playerId) {
    const player = players.find(p => p.id === playerId);
    if (!player) return 'Unknown';
    return `${player.name} (${Math.round(player.rating)})`;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Manual Match Entry
function renderManualMatchForm() {
    const manualPlayerSelection = document.getElementById('manual-player-selection');
    const matchType = document.getElementById('manual-match-type').value;
    
    if (players.length === 0) {
        manualPlayerSelection.innerHTML = '<p>No players available. Add players first.</p>';
        return;
    }
    
    // Sort players alphabetically
    const sortedPlayers = [...players].sort((a, b) => a.name.localeCompare(b.name));
    
    if (matchType === 'singles') {
        manualPlayerSelection.innerHTML = `
            <div class="manual-team-selection">
                <h4>Team 1 (Player 1)</h4>
                <div class="manual-dropdown-wrapper">
                    <input type="text" 
                           id="manual-team1-player1-input" 
                           class="manual-player-input" 
                           placeholder="Search and select player..." 
                           autocomplete="off"
                           data-field="team1Player1"
                           value="${manualMatchSelections.team1Player1 ? getPlayerName(manualMatchSelections.team1Player1) : ''}" />
                    <div id="manual-team1-player1-dropdown" class="manual-player-dropdown"></div>
                </div>
            </div>
            <div class="manual-team-selection">
                <h4>Team 2 (Player 2)</h4>
                <div class="manual-dropdown-wrapper">
                    <input type="text" 
                           id="manual-team2-player1-input" 
                           class="manual-player-input" 
                           placeholder="Search and select player..." 
                           autocomplete="off"
                           data-field="team2Player1"
                           value="${manualMatchSelections.team2Player1 ? getPlayerName(manualMatchSelections.team2Player1) : ''}" />
                    <div id="manual-team2-player1-dropdown" class="manual-player-dropdown"></div>
                </div>
            </div>
        `;
    } else {
        manualPlayerSelection.innerHTML = `
            <div class="manual-team-selection">
                <h4>Team 1</h4>
                <div class="manual-dropdown-wrapper">
                    <input type="text" 
                           id="manual-team1-player1-input" 
                           class="manual-player-input" 
                           placeholder="Search and select player 1..." 
                           autocomplete="off"
                           data-field="team1Player1"
                           value="${manualMatchSelections.team1Player1 ? getPlayerName(manualMatchSelections.team1Player1) : ''}" />
                    <div id="manual-team1-player1-dropdown" class="manual-player-dropdown"></div>
                </div>
                <div class="manual-dropdown-wrapper">
                    <input type="text" 
                           id="manual-team1-player2-input" 
                           class="manual-player-input" 
                           placeholder="Search and select player 2..." 
                           autocomplete="off"
                           data-field="team1Player2"
                           value="${manualMatchSelections.team1Player2 ? getPlayerName(manualMatchSelections.team1Player2) : ''}" />
                    <div id="manual-team1-player2-dropdown" class="manual-player-dropdown"></div>
                </div>
            </div>
            <div class="manual-team-selection">
                <h4>Team 2</h4>
                <div class="manual-dropdown-wrapper">
                    <input type="text" 
                           id="manual-team2-player1-input" 
                           class="manual-player-input" 
                           placeholder="Search and select player 1..." 
                           autocomplete="off"
                           data-field="team2Player1"
                           value="${manualMatchSelections.team2Player1 ? getPlayerName(manualMatchSelections.team2Player1) : ''}" />
                    <div id="manual-team2-player1-dropdown" class="manual-player-dropdown"></div>
                </div>
                <div class="manual-dropdown-wrapper">
                    <input type="text" 
                           id="manual-team2-player2-input" 
                           class="manual-player-input" 
                           placeholder="Search and select player 2..." 
                           autocomplete="off"
                           data-field="team2Player2"
                           value="${manualMatchSelections.team2Player2 ? getPlayerName(manualMatchSelections.team2Player2) : ''}" />
                    <div id="manual-team2-player2-dropdown" class="manual-player-dropdown"></div>
                </div>
            </div>
        `;
    }
    
    // Initialize event listeners for manual match dropdowns
    initializeManualMatchDropdowns();
}

function initializeManualMatchDropdowns() {
    const inputs = document.querySelectorAll('.manual-player-input');
    
    inputs.forEach(input => {
        const field = input.getAttribute('data-field');
        const dropdownId = input.id.replace('-input', '-dropdown');
        const dropdown = document.getElementById(dropdownId);
        
        if (!dropdown) return;
        
        // Input event - search and filter
        input.addEventListener('input', (e) => {
            // If the input value doesn't match the selected player, clear the selection
            const selectedPlayerId = manualMatchSelections[field];
            if (selectedPlayerId) {
                const selectedPlayer = players.find(p => p.id === selectedPlayerId);
                if (selectedPlayer && input.value !== selectedPlayer.name) {
                    // User is typing something different, clear the selection
                    manualMatchSelections[field] = null;
                }
            }
            handleManualMatchSearch(e, field, dropdown);
        });
        
        // Focus event - show dropdown
        input.addEventListener('focus', (e) => {
            activeManualDropdown = field;
            handleManualMatchSearch(e, field, dropdown);
        });
        
        // Blur event - close dropdown when focus is lost (with delay to allow click events)
        input.addEventListener('blur', (e) => {
            // Use setTimeout to allow click events on dropdown items to fire first
            // Also allows Enter key selection to complete before closing
            setTimeout(() => {
                // Only close if this field is still the active dropdown
                // This prevents closing if user clicked on dropdown item or selected via Enter
                if (activeManualDropdown === field) {
                    dropdown.style.display = 'none';
                    activeManualDropdown = null;
                    activeManualDropdownIndex = -1;
                    activeManualDropdownPlayers = [];
                }
            }, 200);
        });
        
        // Keydown event - keyboard navigation
        input.addEventListener('keydown', (e) => {
            handleManualMatchKeydown(e, field, dropdown);
        });
        
        // Click event - show dropdown
        input.addEventListener('click', (e) => {
            activeManualDropdown = field;
            handleManualMatchSearch(e, field, dropdown);
        });
    });
    
}

function handleManualMatchSearch(event, field, dropdown) {
    const input = event.target;
    const searchTerm = input.value.toLowerCase().trim();
    
    // Reset selected index when search changes
    if (activeManualDropdown === field) {
        activeManualDropdownIndex = -1;
    }
    
    // Get all players, sorted alphabetically
    const sortedPlayers = [...players].sort((a, b) => a.name.localeCompare(b.name));
    
    // Get currently selected players in other fields to exclude them
    const otherSelectedPlayers = Object.values(manualMatchSelections).filter(id => id && id !== manualMatchSelections[field]);
    
    let filteredPlayers;
    if (searchTerm === '') {
        // Show all players not selected in other fields
        filteredPlayers = sortedPlayers.filter(p => !otherSelectedPlayers.includes(p.id));
    } else {
        // Filter by search term and exclude players selected in other fields
        filteredPlayers = sortedPlayers.filter(player => {
            const nameMatch = player.name.toLowerCase().includes(searchTerm);
            const notSelectedElsewhere = !otherSelectedPlayers.includes(player.id);
            return nameMatch && notSelectedElsewhere;
        });
    }
    
    if (activeManualDropdown === field) {
        activeManualDropdownPlayers = filteredPlayers;
    }
    
    renderManualMatchDropdown(filteredPlayers, dropdown, field);
}

function handleManualMatchKeydown(event, field, dropdown) {
    if (activeManualDropdown !== field) return;
    
    // Handle Tab key - close dropdown immediately when tabbing away
    if (event.key === 'Tab') {
        dropdown.style.display = 'none';
        activeManualDropdown = null;
        activeManualDropdownIndex = -1;
        activeManualDropdownPlayers = [];
        // Don't prevent default - allow normal tab behavior
        return;
    }
    
    const items = dropdown.querySelectorAll('.manual-dropdown-item:not(.disabled)');
    if (items.length === 0) {
        if (event.key === 'Enter') {
            event.preventDefault();
        }
        return;
    }
    
    switch (event.key) {
        case 'ArrowDown':
            event.preventDefault();
            if (activeManualDropdownIndex < 0) {
                activeManualDropdownIndex = 0;
            } else {
                activeManualDropdownIndex = (activeManualDropdownIndex + 1) % items.length;
            }
            updateManualDropdownSelection(items);
            scrollToManualSelectedItem(items[activeManualDropdownIndex], dropdown);
            break;
        case 'ArrowUp':
            event.preventDefault();
            if (activeManualDropdownIndex <= 0) {
                activeManualDropdownIndex = items.length - 1;
            } else {
                activeManualDropdownIndex = activeManualDropdownIndex - 1;
            }
            updateManualDropdownSelection(items);
            scrollToManualSelectedItem(items[activeManualDropdownIndex], dropdown);
            break;
        case 'Enter':
            event.preventDefault();
            if (activeManualDropdownIndex >= 0 && activeManualDropdownIndex < items.length) {
                const playerId = items[activeManualDropdownIndex].getAttribute('data-player-id');
                if (playerId) {
                    selectManualMatchPlayer(field, playerId);
                }
            } else if (items.length > 0) {
                // If no item is selected, select the first one
                const playerId = items[0].getAttribute('data-player-id');
                if (playerId) {
                    selectManualMatchPlayer(field, playerId);
                }
            }
            break;
        case 'Escape':
            event.preventDefault();
            dropdown.style.display = 'none';
            activeManualDropdown = null;
            activeManualDropdownIndex = -1;
            activeManualDropdownPlayers = [];
            break;
    }
}

function renderManualMatchDropdown(playersToShow, dropdown, field) {
    if (playersToShow.length === 0) {
        dropdown.innerHTML = '<div class="manual-dropdown-item disabled">No players available</div>';
        dropdown.style.display = 'block';
        return;
    }
    
    // Reset selected index when rendering new dropdown
    if (activeManualDropdown === field) {
        activeManualDropdownIndex = -1;
    }
    
    dropdown.innerHTML = playersToShow
        .map((player, index) => `
            <div class="manual-dropdown-item ${index === activeManualDropdownIndex && activeManualDropdown === field ? 'selected' : ''}" 
                 data-player-id="${player.id}">
                ${escapeHtml(player.name)} (${Math.round(player.rating)})
            </div>
        `).join('');
    
    dropdown.style.display = 'block';
    
    // Add click listeners to dropdown items
    dropdown.querySelectorAll('.manual-dropdown-item:not(.disabled)').forEach((item, index) => {
        item.addEventListener('click', (e) => {
            e.stopPropagation();
            if (activeManualDropdown === field) {
                activeManualDropdownIndex = index;
            }
            const playerId = item.getAttribute('data-player-id');
            if (playerId) {
                selectManualMatchPlayer(field, playerId);
            }
        });
        
        item.addEventListener('mouseenter', () => {
            if (activeManualDropdown === field) {
                activeManualDropdownIndex = index;
                updateManualDropdownSelection(dropdown.querySelectorAll('.manual-dropdown-item:not(.disabled)'));
            }
        });
    });
}

function updateManualDropdownSelection(items) {
    items.forEach((item, index) => {
        if (index === activeManualDropdownIndex && activeManualDropdown) {
            item.classList.add('selected');
        } else {
            item.classList.remove('selected');
        }
    });
}

function scrollToManualSelectedItem(item, dropdown) {
    if (!item) return;
    
    const itemTop = item.offsetTop;
    const itemBottom = itemTop + item.offsetHeight;
    const dropdownTop = dropdown.scrollTop;
    const dropdownBottom = dropdownTop + dropdown.offsetHeight;
    
    if (itemTop < dropdownTop) {
        dropdown.scrollTop = itemTop;
    } else if (itemBottom > dropdownBottom) {
        dropdown.scrollTop = itemBottom - dropdown.offsetHeight;
    }
}

function selectManualMatchPlayer(field, playerId) {
    manualMatchSelections[field] = playerId;
    
    // Update the input value - convert field name to input ID
    // team1Player1 -> manual-team1-player1-input
    const fieldToIdMap = {
        'team1Player1': 'manual-team1-player1-input',
        'team1Player2': 'manual-team1-player2-input',
        'team2Player1': 'manual-team2-player1-input',
        'team2Player2': 'manual-team2-player2-input'
    };
    const inputId = fieldToIdMap[field];
    const input = document.getElementById(inputId);
    if (input) {
        const player = players.find(p => p.id === playerId);
        if (player) {
            // Set value without triggering input event to avoid reopening dropdown
            input.value = player.name;
        }
    }
    
    // Hide dropdown immediately
    const dropdownId = inputId.replace('-input', '-dropdown');
    const dropdown = document.getElementById(dropdownId);
    if (dropdown) {
        dropdown.style.display = 'none';
    }
    
    // Reset active dropdown state immediately
    // This prevents blur handler from trying to close it again
    const wasActiveField = activeManualDropdown === field;
    activeManualDropdown = null;
    activeManualDropdownIndex = -1;
    activeManualDropdownPlayers = [];
    
    // Don't refresh other dropdowns - they will update when focused
    // This prevents other dropdowns from opening unexpectedly
}

function refreshManualMatchDropdowns() {
    // Refresh only the currently active dropdown to update excluded players
    // Don't refresh other dropdowns as this would cause them to open unexpectedly
    if (activeManualDropdown) {
        const fieldToIdMap = {
            'team1Player1': 'manual-team1-player1-input',
            'team1Player2': 'manual-team1-player2-input',
            'team2Player1': 'manual-team2-player1-input',
            'team2Player2': 'manual-team2-player2-input'
        };
        const inputId = fieldToIdMap[activeManualDropdown];
        const input = document.getElementById(inputId);
        if (input) {
            const dropdownId = inputId.replace('-input', '-dropdown');
            const dropdown = document.getElementById(dropdownId);
            if (dropdown && dropdown.style.display !== 'none') {
                // Only refresh if the dropdown is currently visible
                handleManualMatchSearch({ target: input }, activeManualDropdown, dropdown);
            }
        }
    }
}

function submitManualMatch() {
    const matchType = document.getElementById('manual-match-type').value;
    const score1 = parseInt(document.getElementById('manual-score1').value);
    const score2 = parseInt(document.getElementById('manual-score2').value);
    
    // Validate scores
    if (isNaN(score1) || isNaN(score2) || score1 < 0 || score2 < 0) {
        alert('Please enter valid scores (non-negative numbers)');
        return;
    }
    
    if (score1 === score2) {
        alert('Scores cannot be equal (badminton requires a winner)');
        return;
    }
    
    // Get team players from manualMatchSelections
    let team1 = [];
    let team2 = [];
    
    if (matchType === 'singles') {
        const team1Player1 = manualMatchSelections.team1Player1;
        const team2Player1 = manualMatchSelections.team2Player1;
        
        if (!team1Player1 || !team2Player1) {
            alert('Please select all players');
            return;
        }
        
        if (team1Player1 === team2Player1) {
            alert('Players cannot play against themselves');
            return;
        }
        
        team1 = [team1Player1];
        team2 = [team2Player1];
    } else {
        const team1Player1 = manualMatchSelections.team1Player1;
        const team1Player2 = manualMatchSelections.team1Player2;
        const team2Player1 = manualMatchSelections.team2Player1;
        const team2Player2 = manualMatchSelections.team2Player2;
        
        if (!team1Player1 || !team1Player2 || !team2Player1 || !team2Player2) {
            alert('Please select all players');
            return;
        }
        
        // Check for duplicate players
        const allPlayers = [team1Player1, team1Player2, team2Player1, team2Player2];
        if (new Set(allPlayers).size !== 4) {
            alert('Each player can only appear once in a match');
            return;
        }
        
        team1 = [team1Player1, team1Player2];
        team2 = [team2Player1, team2Player2];
    }
    
    // Create match object
    const match = {
        id: `manual-${Date.now()}`,
        type: matchType,
        team1: team1,
        team2: team2,
        score1: score1,
        score2: score2,
        completed: true,
        createdAt: new Date().toISOString(),
        isManual: true
    };
    
    // Calculate ELO updates
    updateELORatings(match);
    
    // Add to history
    matchHistory.push({
        ...match,
        completedAt: new Date().toISOString()
    });
    
    // Update matchmaking history for completed matches (if they have a round number)
    if (match.round !== undefined) {
        if (match.type === 'singles') {
            updateHistoryFromRound([match], match.round);
        } else if (match.type === 'doubles') {
            updateDoublesHistoryFromRound([match], match.round);
        }
    }
    
    // Clear form
    document.getElementById('manual-score1').value = '';
    document.getElementById('manual-score2').value = '';
    manualMatchSelections = {
        team1Player1: null,
        team1Player2: null,
        team2Player1: null,
        team2Player2: null
    };
    renderManualMatchForm();
    
    saveData();
    renderPlayers();
    initializePlayerSearch();
    renderEventPlayers();
    renderHistory();
    alert('Match submitted successfully!');
}

// Data Export/Import
function exportData() {
    const data = {
        players: players,
        matchHistory: matchHistory,
        exportDate: new Date().toISOString(),
        version: '1.0'
    };
    
    const dataStr = JSON.stringify(data, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `badminton-elo-data-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

function importData(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = JSON.parse(e.target.result);
            
            if (!data.players || !Array.isArray(data.players)) {
                alert('Invalid data format: missing players array');
                return;
            }
            
            if (!data.matchHistory || !Array.isArray(data.matchHistory)) {
                alert('Invalid data format: missing matchHistory array');
                return;
            }
            
            if (confirm('This will replace all current player data and match history. Continue?')) {
                players = data.players;
                matchHistory = data.matchHistory;
                
                // Reset file input
                event.target.value = '';
                
                saveData();
                renderPlayers();
                initializePlayerSearch();
                renderEventPlayers();
                renderManualMatchForm();
                renderHistory();
                alert('Data imported successfully!');
            }
        } catch (error) {
            alert('Error importing data: ' + error.message);
            console.error(error);
        }
    };
    reader.readAsText(file);
}

// Data Persistence
function saveData() {
    localStorage.setItem('badmintonELO_players', JSON.stringify(players));
    localStorage.setItem('badmintonELO_matches', JSON.stringify(matches));
    localStorage.setItem('badmintonELO_history', JSON.stringify(matchHistory));
    localStorage.setItem('badmintonELO_eventPlayers', JSON.stringify(eventPlayers));
    localStorage.setItem('badmintonELO_opponentCount', JSON.stringify(opponentCount));
    localStorage.setItem('badmintonELO_lastOpponentRound', JSON.stringify(lastOpponentRound));
    localStorage.setItem('badmintonELO_partnerCount', JSON.stringify(partnerCount));
    localStorage.setItem('badmintonELO_lastPartnerRound', JSON.stringify(lastPartnerRound));
}

function loadData() {
    const savedPlayers = localStorage.getItem('badmintonELO_players');
    const savedMatches = localStorage.getItem('badmintonELO_matches');
    const savedHistory = localStorage.getItem('badmintonELO_history');
    const savedEventPlayers = localStorage.getItem('badmintonELO_eventPlayers');
    const savedOpponentCount = localStorage.getItem('badmintonELO_opponentCount');
    const savedLastOpponentRound = localStorage.getItem('badmintonELO_lastOpponentRound');
    const savedPartnerCount = localStorage.getItem('badmintonELO_partnerCount');
    const savedLastPartnerRound = localStorage.getItem('badmintonELO_lastPartnerRound');
    
    if (savedPlayers) {
        players = JSON.parse(savedPlayers);
    }
    
    if (savedMatches) {
        matches = JSON.parse(savedMatches);
    }
    
    if (savedHistory) {
        matchHistory = JSON.parse(savedHistory);
    }
    
    if (savedEventPlayers) {
        eventPlayers = JSON.parse(savedEventPlayers);
    }
    
    // Load history data structures (backward compatible with old save files)
    // If all history exists, load it. Otherwise, rebuild from matchHistory (source of truth)
    if (savedOpponentCount && savedLastOpponentRound && 
        savedPartnerCount && savedLastPartnerRound) {
        // All history exists - load it directly
        opponentCount = JSON.parse(savedOpponentCount);
        lastOpponentRound = JSON.parse(savedLastOpponentRound);
        partnerCount = JSON.parse(savedPartnerCount);
        lastPartnerRound = JSON.parse(savedLastPartnerRound);
    } else {
        // Some history is missing (e.g., old save files without partner history)
        // Rebuild everything from matchHistory to ensure correctness
        rebuildHistoryFromMatchHistory();
    }
}

// Rebuild history data structures from matchHistory
// This function rebuilds all history from matchHistory (the source of truth)
// Used for backward compatibility with old save files that don't have all history fields
function rebuildHistoryFromMatchHistory() {
    // Clear and rebuild from matchHistory to ensure correctness
    opponentCount = {};
    lastOpponentRound = {};
    partnerCount = {};
    lastPartnerRound = {};
    
    // Process all matches in history
    matchHistory.forEach(match => {
        if (match.round === undefined) return;
        
        if (match.type === 'singles') {
            const teamA = match.team1;
            const teamB = match.team2;
            const p1 = teamA[0];
            const p2 = teamB[0];
            
            // Initialize if needed
            if (!opponentCount[p1]) {
                opponentCount[p1] = {};
            }
            if (!opponentCount[p2]) {
                opponentCount[p2] = {};
            }
            if (!lastOpponentRound[p1]) {
                lastOpponentRound[p1] = {};
            }
            if (!lastOpponentRound[p2]) {
                lastOpponentRound[p2] = {};
            }
            
            // Update counts and last round
            opponentCount[p1][p2] = (opponentCount[p1][p2] || 0) + 1;
            opponentCount[p2][p1] = (opponentCount[p2][p1] || 0) + 1;
            
            // Update last round (keep the most recent)
            const currentLastRound = lastOpponentRound[p1][p2];
            if (currentLastRound === undefined || match.round > currentLastRound) {
                lastOpponentRound[p1][p2] = match.round;
                lastOpponentRound[p2][p1] = match.round;
            }
        } else if (match.type === 'doubles') {
            const teamA = match.team1; // [p1, p2]
            const teamB = match.team2; // [p3, p4]
            const p1 = teamA[0];
            const p2 = teamA[1];
            const p3 = teamB[0];
            const p4 = teamB[1];
            
            // Initialize if needed
            [p1, p2, p3, p4].forEach(p => {
                if (!partnerCount[p]) {
                    partnerCount[p] = {};
                }
                if (!opponentCount[p]) {
                    opponentCount[p] = {};
                }
                if (!lastPartnerRound[p]) {
                    lastPartnerRound[p] = {};
                }
                if (!lastOpponentRound[p]) {
                    lastOpponentRound[p] = {};
                }
            });
            
            // Update partner history for teamA
            partnerCount[p1][p2] = (partnerCount[p1][p2] || 0) + 1;
            partnerCount[p2][p1] = (partnerCount[p2][p1] || 0) + 1;
            const currentLastPartnerRoundA = lastPartnerRound[p1][p2];
            if (currentLastPartnerRoundA === undefined || match.round > currentLastPartnerRoundA) {
                lastPartnerRound[p1][p2] = match.round;
                lastPartnerRound[p2][p1] = match.round;
            }
            
            // Update partner history for teamB
            partnerCount[p3][p4] = (partnerCount[p3][p4] || 0) + 1;
            partnerCount[p4][p3] = (partnerCount[p4][p3] || 0) + 1;
            const currentLastPartnerRoundB = lastPartnerRound[p3][p4];
            if (currentLastPartnerRoundB === undefined || match.round > currentLastPartnerRoundB) {
                lastPartnerRound[p3][p4] = match.round;
                lastPartnerRound[p4][p3] = match.round;
            }
            
            // Update opponent history
            for (const a of teamA) {
                for (const b of teamB) {
                    opponentCount[a][b] = (opponentCount[a][b] || 0) + 1;
                    opponentCount[b][a] = (opponentCount[b][a] || 0) + 1;
                    const currentLastOpponentRound = lastOpponentRound[a][b];
                    if (currentLastOpponentRound === undefined || match.round > currentLastOpponentRound) {
                        lastOpponentRound[a][b] = match.round;
                        lastOpponentRound[b][a] = match.round;
                    }
                }
            }
        }
    });
}

// Make functions available globally for onclick handlers
window.deletePlayer = deletePlayer;
window.submitScore = submitScore;
window.deleteMatch = deleteMatch;
window.removePlayerFromEvent = removePlayerFromEvent;
window.startMatchEdit = startMatchEdit;
window.cancelMatchEdit = cancelMatchEdit;
window.saveMatchEdit = saveMatchEdit;

