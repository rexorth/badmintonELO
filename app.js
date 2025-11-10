// ELO Rating System Configuration
const ELO_CONFIG = {
    K_FACTOR: 32, // Standard K-factor for ELO rating
    INITIAL_RATING: 1500
};

// Data Storage
let players = [];
let matches = [];
let matchHistory = [];
let eventPlayers = []; // Track players selected for the current event
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

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    loadData();
    initializeTabs();
    initializeEventListeners();
    renderPlayers();
    initializePlayerSearch();
    renderEventPlayers();
    renderManualMatchForm();
    renderMatches();
    renderScores();
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
            if (targetTab === 'matches') {
                initializePlayerSearch();
                renderEventPlayers();
            } else if (targetTab === 'manual') {
                renderManualMatchForm();
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
    });
    document.getElementById('submit-manual-match-btn').addEventListener('click', submitManualMatch);
    document.getElementById('manual-match-type').addEventListener('change', renderManualMatchForm);
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
    renderManualMatchForm();
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
        renderManualMatchForm();
        renderMatches();
        renderScores();
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
    renderScores();
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

// Helper function to get play history by round (which players played in each round)
function getPlayHistoryByRound(selectedPlayerIds, matchType, currentRound) {
    const playHistory = {}; // round -> Set of playerIds who played
    const lastPlayRound = {}; // playerId -> last round they played
    
    // Initialize all players with round 0 (never played)
    selectedPlayerIds.forEach(playerId => {
        lastPlayRound[playerId] = 0;
    });
    
    // Check existing matches (both uncompleted and completed/history)
    const allMatches = [...matches, ...matchHistory];
    
    allMatches.forEach(match => {
        if (match.type !== matchType) return;
        if (!match.round || typeof match.round !== 'number') return;
        if (match.round >= currentRound) return; // Only look at previous rounds
        
        const round = match.round;
        if (!playHistory[round]) {
            playHistory[round] = new Set();
        }
        
        // Add all players from this match
        match.team1.forEach(playerId => {
            if (selectedPlayerIds.includes(playerId)) {
                playHistory[round].add(playerId);
                lastPlayRound[playerId] = Math.max(lastPlayRound[playerId] || 0, round);
            }
        });
        match.team2.forEach(playerId => {
            if (selectedPlayerIds.includes(playerId)) {
                playHistory[round].add(playerId);
                lastPlayRound[playerId] = Math.max(lastPlayRound[playerId] || 0, round);
            }
        });
    });
    
    return { playHistory, lastPlayRound };
}

// Helper function to calculate which players need to play based on frequency
function getPlayersWhoNeedToPlay(selectedPlayerIds, matchType, maxCourts, currentRound, lastPlayRound) {
    const playersWhoNeedToPlay = new Set();
    
    // Calculate play frequency: p / (c * players_per_court)
    // For singles: players_per_court = 2
    // For doubles: players_per_court = 4 (2 teams of 2)
    const playersPerCourt = matchType === 'singles' ? 2 : 4;
    const playFrequency = selectedPlayerIds.length / (maxCourts * playersPerCourt);
    const roundsBetweenPlays = Math.ceil(playFrequency);
    
    selectedPlayerIds.forEach(playerId => {
        const roundsSinceLastPlay = currentRound - (lastPlayRound[playerId] || 0);
        if (roundsSinceLastPlay >= roundsBetweenPlays) {
            playersWhoNeedToPlay.add(playerId);
        }
    });
    
    return playersWhoNeedToPlay;
}

function generateSinglesMatches(selectedPlayerIds, numRounds, maxCourts) {
    const newMatches = [];
    const baseTime = Date.now();
    let matchIndex = 0;
    
    // Get the maximum existing round number and start new rounds from the next round
    const startRound = getMaxRoundNumber() + 1;
    
    // Track opponents used in this generation session
    const sessionOpponents = {};
    selectedPlayerIds.forEach(id => {
        sessionOpponents[id] = new Set();
    });
    
    // Track which players played in the previous round
    let playersWhoDidNotPlay = new Set(selectedPlayerIds);
    // Track play history within this generation session (round -> Set of playerIds)
    const sessionPlayHistory = {};
    
    for (let round = startRound; round < startRound + numRounds; round++) {
        // Get play history to determine which players need to play
        // Combine existing play history with session play history
        const { lastPlayRound: existingLastPlayRound } = getPlayHistoryByRound(selectedPlayerIds, 'singles', round);
        const lastPlayRound = { ...existingLastPlayRound };
        
        // Update with session play history (rounds generated earlier in this session)
        selectedPlayerIds.forEach(playerId => {
            for (let r = startRound; r < round; r++) {
                if (sessionPlayHistory[r] && sessionPlayHistory[r].has(playerId)) {
                    lastPlayRound[playerId] = Math.max(lastPlayRound[playerId] || 0, r);
                }
            }
        });
        
        const playersWhoNeedToPlay = getPlayersWhoNeedToPlay(
            selectedPlayerIds, 
            'singles', 
            maxCourts, 
            round, 
            lastPlayRound
        );
        
        // Calculate pairings for this round, prioritizing players who didn't play in the previous round
        // Limit to maxCourts matches per round
        const roundPairings = minimizeRepeatedOpponentsMultiRound(
            selectedPlayerIds, 
            sessionOpponents,
            playersWhoDidNotPlay,
            maxCourts,
            playersWhoNeedToPlay
        );
        
        if (roundPairings.length === 0 && selectedPlayerIds.length >= 2) {
            // Fallback: if algorithm returns no pairs, create at least one match
            // This can happen in edge cases, so we ensure at least one match is created
            console.warn(`No pairings generated for round ${round}, creating fallback match`);
            roundPairings.push([selectedPlayerIds[0], selectedPlayerIds[1]]);
        }
        
        // Track which players are playing in this round
        const playersWhoPlayedThisRound = new Set();
        
        // Store play history for this round in session
        sessionPlayHistory[round] = new Set();
        
        roundPairings.forEach(([player1, player2]) => {
            // Ensure sessionOpponents Sets exist
            if (!sessionOpponents[player1]) sessionOpponents[player1] = new Set();
            if (!sessionOpponents[player2]) sessionOpponents[player2] = new Set();
            
            // Track that these players faced each other in this session
            sessionOpponents[player1].add(player2);
            sessionOpponents[player2].add(player1);
            
            // Mark players as having played this round
            playersWhoPlayedThisRound.add(player1);
            playersWhoPlayedThisRound.add(player2);
            sessionPlayHistory[round].add(player1);
            sessionPlayHistory[round].add(player2);
            
            newMatches.push({
                id: `match-${baseTime}-${matchIndex++}`,
                type: 'singles',
                team1: [player1],
                team2: [player2],
                score1: null,
                score2: null,
                completed: false,
                round: round,
                createdAt: new Date().toISOString()
            });
        });
        
        // Update which players did not play this round (for use in next round)
        playersWhoDidNotPlay = new Set(
            selectedPlayerIds.filter(id => !playersWhoPlayedThisRound.has(id))
        );
    }
    
    if (newMatches.length === 0) {
        alert('No matches could be generated. Please ensure you have selected at least 2 players.');
        return;
    }
    
    // Add new matches to existing ones (don't replace)
    matches.push(...newMatches);
}

function generateDoublesMatches(selectedPlayerIds, numRounds, maxCourts) {
    const newMatches = [];
    const baseTime = Date.now();
    let matchIndex = 0;
    
    // Get the maximum existing round number and start new rounds from the next round
    const startRound = getMaxRoundNumber() + 1;
    
    // Track partners used in this generation session
    const sessionPartners = {};
    selectedPlayerIds.forEach(id => {
        sessionPartners[id] = new Set();
    });
    
    // Track which players played in the previous round
    let playersWhoDidNotPlay = new Set(selectedPlayerIds);
    // Track play history within this generation session (round -> Set of playerIds)
    const sessionPlayHistory = {};
    
    for (let round = startRound; round < startRound + numRounds; round++) {
        // Get play history to determine which players need to play
        // Combine existing play history with session play history
        const { lastPlayRound: existingLastPlayRound } = getPlayHistoryByRound(selectedPlayerIds, 'doubles', round);
        const lastPlayRound = { ...existingLastPlayRound };
        
        // Update with session play history (rounds generated earlier in this session)
        selectedPlayerIds.forEach(playerId => {
            for (let r = startRound; r < round; r++) {
                if (sessionPlayHistory[r] && sessionPlayHistory[r].has(playerId)) {
                    lastPlayRound[playerId] = Math.max(lastPlayRound[playerId] || 0, r);
                }
            }
        });
        
        const playersWhoNeedToPlay = getPlayersWhoNeedToPlay(
            selectedPlayerIds, 
            'doubles', 
            maxCourts, 
            round, 
            lastPlayRound
        );
        
        // Calculate pairings for this round, prioritizing players who didn't play in the previous round
        // Limit to maxCourts matches per round
        const roundPairings = minimizeRepeatedPartnersMultiRound(
            selectedPlayerIds, 
            sessionPartners,
            playersWhoDidNotPlay,
            maxCourts,
            playersWhoNeedToPlay
        );
        
        if (roundPairings.length === 0 && selectedPlayerIds.length >= 4) {
            // Fallback: if algorithm returns no pairs, create at least one match
            // This can happen in edge cases, so we ensure at least one match is created
            console.warn(`No pairings generated for round ${round}, creating fallback match`);
            if (selectedPlayerIds.length >= 4) {
                roundPairings.push([
                    [selectedPlayerIds[0], selectedPlayerIds[1]],
                    [selectedPlayerIds[2], selectedPlayerIds[3]]
                ]);
            }
        }
        
        // Track which players are playing in this round
        const playersWhoPlayedThisRound = new Set();
        
        // Store play history for this round in session
        sessionPlayHistory[round] = new Set();
        
        roundPairings.forEach(([team1, team2]) => {
            // Ensure sessionPartners Sets exist
            team1.forEach(playerId => {
                if (!sessionPartners[playerId]) sessionPartners[playerId] = new Set();
            });
            team2.forEach(playerId => {
                if (!sessionPartners[playerId]) sessionPartners[playerId] = new Set();
            });
            
            // Track partners within teams
            sessionPartners[team1[0]].add(team1[1]);
            sessionPartners[team1[1]].add(team1[0]);
            sessionPartners[team2[0]].add(team2[1]);
            sessionPartners[team2[1]].add(team2[0]);
            
            // Mark players as having played this round
            team1.forEach(playerId => {
                playersWhoPlayedThisRound.add(playerId);
                sessionPlayHistory[round].add(playerId);
            });
            team2.forEach(playerId => {
                playersWhoPlayedThisRound.add(playerId);
                sessionPlayHistory[round].add(playerId);
            });
            
            newMatches.push({
                id: `match-${baseTime}-${matchIndex++}`,
                type: 'doubles',
                team1: team1,
                team2: team2,
                score1: null,
                score2: null,
                completed: false,
                round: round,
                createdAt: new Date().toISOString()
            });
        });
        
        // Update which players did not play this round (for use in next round)
        playersWhoDidNotPlay = new Set(
            selectedPlayerIds.filter(id => !playersWhoPlayedThisRound.has(id))
        );
    }
    
    if (newMatches.length === 0) {
        alert('No matches could be generated. Please ensure you have selected at least 4 players.');
        return;
    }
    
    // Add new matches to existing ones (don't replace)
    matches.push(...newMatches);
}

// Helper function to get the last N opponents from match history for a player
function getRecentOpponents(playerId, matchType, count = 2) {
    const recentOpponents = [];
    
    // Get all matches involving this player, sorted by completion date (most recent first)
    const playerMatches = matchHistory
        .filter(match => {
            if (match.type !== matchType) return false;
            // Check if player is in team1 or team2
            const inTeam1 = match.team1.includes(playerId);
            const inTeam2 = match.team2.includes(playerId);
            return inTeam1 || inTeam2;
        })
        .sort((a, b) => {
            // Sort by completedAt timestamp, most recent first
            const dateA = new Date(a.completedAt || 0);
            const dateB = new Date(b.completedAt || 0);
            return dateB - dateA;
        });
    
    // Extract opponents from the most recent matches
    for (const match of playerMatches) {
        if (recentOpponents.length >= count) break;
        
        if (matchType === 'singles') {
            // For singles, the opponent is the other player
            const opponent = match.team1[0] === playerId ? match.team2[0] : match.team1[0];
            if (opponent && !recentOpponents.includes(opponent)) {
                recentOpponents.push(opponent);
            }
        } else {
            // For doubles, opponents are the players in the other team
            const isInTeam1 = match.team1.includes(playerId);
            const opponents = isInTeam1 ? match.team2 : match.team1;
            for (const opponentId of opponents) {
                if (recentOpponents.length >= count) break;
                if (!recentOpponents.includes(opponentId)) {
                    recentOpponents.push(opponentId);
                }
            }
        }
    }
    
    return recentOpponents;
}

// Helper function to get the last N partners from match history for a player (doubles)
function getRecentPartners(playerId, count = 2) {
    const recentPartners = [];
    
    // Get all doubles matches involving this player, sorted by completion date (most recent first)
    const playerMatches = matchHistory
        .filter(match => {
            if (match.type !== 'doubles') return false;
            // Check if player is in team1 or team2
            const inTeam1 = match.team1.includes(playerId);
            const inTeam2 = match.team2.includes(playerId);
            return inTeam1 || inTeam2;
        })
        .sort((a, b) => {
            // Sort by completedAt timestamp, most recent first
            const dateA = new Date(a.completedAt || 0);
            const dateB = new Date(b.completedAt || 0);
            return dateB - dateA;
        });
    
    // Extract partners from the most recent matches
    for (const match of playerMatches) {
        if (recentPartners.length >= count) break;
        
        // For doubles, partners are on the same team
        const isInTeam1 = match.team1.includes(playerId);
        const partners = isInTeam1 ? match.team1 : match.team2;
        for (const partnerId of partners) {
            if (partnerId !== playerId && !recentPartners.includes(partnerId)) {
                recentPartners.push(partnerId);
                if (recentPartners.length >= count) break;
            }
        }
    }
    
    return recentPartners;
}

// Helper function to shuffle array (Fisher-Yates algorithm)
function shuffleArray(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

// Algorithm to minimize repeated opponents (singles) - multi-round version
function minimizeRepeatedOpponentsMultiRound(playerIds, sessionOpponents, playersWhoDidNotPlay = new Set(), maxCourts = Infinity, playersWhoNeedToPlay = new Set()) {
    if (playerIds.length < 2) return [];
    
    // Add randomness: shuffle player list before processing to break deterministic ordering
    const shuffledPlayerIds = shuffleArray(playerIds);
    
    const pairings = [];
    const opponentCounts = {}; // Track how many times each player has faced each opponent (from history)
    const sessionCounts = {}; // Track opponents in this session
    const recentOpponents = {}; // Track last 2 opponents from match history
    
    // Initialize opponent counts from history and get recent opponents
    shuffledPlayerIds.forEach(playerId => {
        const player = players.find(p => p.id === playerId);
        
        // Get last 2 opponents from match history
        recentOpponents[playerId] = getRecentOpponents(playerId, 'singles', 2);
        
        if (!player) {
            // Player not found - initialize empty counts
            opponentCounts[playerId] = {};
            sessionCounts[playerId] = {};
            shuffledPlayerIds.forEach(opponentId => {
                if (opponentId !== playerId) {
                    opponentCounts[playerId][opponentId] = 0;
                    sessionCounts[playerId][opponentId] = 0;
                }
            });
            return;
        }
        
        opponentCounts[playerId] = {};
        sessionCounts[playerId] = {};
        
        // Check history against all selected players
        shuffledPlayerIds.forEach(opponentId => {
            if (opponentId !== playerId) {
                // Count from history (opponents array contains IDs of opponents faced)
                opponentCounts[playerId][opponentId] = 
                    (player.opponents || []).filter(id => id === opponentId).length;
                // Count from current session (check if they've faced in this generation session)
                const hasFacedInSession = sessionOpponents[playerId] && 
                                         sessionOpponents[playerId] instanceof Set && 
                                         sessionOpponents[playerId].has(opponentId);
                sessionCounts[playerId][opponentId] = hasFacedInSession ? 1 : 0;
            }
        });
    });
    
    // Get player ratings for skill-based matching
    const playerRatings = {};
    shuffledPlayerIds.forEach(playerId => {
        const player = players.find(p => p.id === playerId);
        playerRatings[playerId] = player ? player.rating : ELO_CONFIG.INITIAL_RATING;
    });
    
    // Create all possible pairs from selected players only (use shuffled list for randomness)
    const possiblePairs = [];
    for (let i = 0; i < shuffledPlayerIds.length; i++) {
        for (let j = i + 1; j < shuffledPlayerIds.length; j++) {
            const player1 = shuffledPlayerIds[i];
            const player2 = shuffledPlayerIds[j];
            
            // Skill-based filtering: Prefer pairs with rating gap <= 250
            // But allow larger gaps if either player needs to play (to guarantee play frequency)
            const rating1 = playerRatings[player1];
            const rating2 = playerRatings[player2];
            const ratingGap = Math.abs(rating1 - rating2);
            const player1NeedsToPlay = playersWhoNeedToPlay.has(player1);
            const player2NeedsToPlay = playersWhoNeedToPlay.has(player2);
            const eitherNeedsToPlay = player1NeedsToPlay || player2NeedsToPlay;
            
            // Skip pairs with rating gap > 250 only if neither player needs to play
            // If a player needs to play, allow any rating gap (but still prefer smaller gaps via priority score)
            if (ratingGap > 250 && !eitherNeedsToPlay) {
                continue; // Skip this pair - skill gap too large and no player needs to play
            }
            
            // Prioritize pairs that haven't been matched in this session
            const sessionRepeat = (sessionCounts[player1] && sessionCounts[player1][player2]) || 0;
            const historyRepeat = (opponentCounts[player1] && opponentCounts[player1][player2]) || 0;
            
            // Check if this opponent is in the last 2 recent opponents
            const player1RecentOpponents = recentOpponents[player1] || [];
            const player2RecentOpponents = recentOpponents[player2] || [];
            const isRecentOpponent1 = player1RecentOpponents.includes(player2);
            const isRecentOpponent2 = player2RecentOpponents.includes(player1);
            const isRecentRepeat = isRecentOpponent1 || isRecentOpponent2;
            
            // Check if either player didn't play in the previous round
            const player1DidNotPlay = playersWhoDidNotPlay.has(player1);
            const player2DidNotPlay = playersWhoDidNotPlay.has(player2);
            const includesPlayerWhoDidNotPlay = player1DidNotPlay || player2DidNotPlay;
            
            // Calculate priority score:
            // - Lower is better
            // - Session repeats are heavily penalized (multiply by 100000)
            // - Recent opponents (last 2) are heavily penalized (multiply by 50000)
            // - Rating difference adds penalty (multiply by 1, so smaller gap = better)
            //   But if rating gap > 250, add extra penalty (multiply by 10) to strongly prefer smaller gaps
            // - Players who need to play get high priority boost (subtract 5000) to ensure they play
            // - Players who didn't play get priority boost (subtract 1000)
            // - History repeats add small penalty
            // - Add small random component (0-100) to break ties and add randomness
            const randomFactor = Math.random() * 100;
            let ratingPenalty = ratingGap;
            if (ratingGap > 250) {
                ratingPenalty = 250 + (ratingGap - 250) * 10; // Heavily penalize gaps > 250, but still allow them
            }
            let priorityScore = sessionRepeat * 100000 + (isRecentRepeat ? 50000 : 0) + historyRepeat * 10 + ratingPenalty + randomFactor;
            
            // Boost priority for players who need to play (very high priority)
            if (eitherNeedsToPlay) {
                priorityScore -= 5000; // High priority boost to ensure players who need to play get matches
                // If both need to play, give even higher priority
                if (player1NeedsToPlay && player2NeedsToPlay) {
                    priorityScore -= 2500;
                }
            }
            
            if (includesPlayerWhoDidNotPlay) {
                priorityScore -= 1000; // Boost priority for players who didn't play
                // If both didn't play, give even higher priority
                if (player1DidNotPlay && player2DidNotPlay) {
                    priorityScore -= 500;
                }
            }
            
            possiblePairs.push({
                pair: [player1, player2],
                repeatScore: sessionRepeat * 1000 + historyRepeat,
                sessionRepeat: sessionRepeat,
                isRecentRepeat: isRecentRepeat,
                ratingGap: ratingGap,
                eitherNeedsToPlay: eitherNeedsToPlay,
                priorityScore: priorityScore,
                includesPlayerWhoDidNotPlay: includesPlayerWhoDidNotPlay,
                player1DidNotPlay: player1DidNotPlay,
                player2DidNotPlay: player2DidNotPlay
            });
        }
    }
    
    // If no possible pairs, return empty (shouldn't happen with 2+ players)
    if (possiblePairs.length === 0) {
        return [];
    }
    
    // Sort by priority score (lower is better) - this prioritizes players who didn't play and similar ratings
    // The randomFactor in priorityScore ensures we get different results each time
    possiblePairs.sort((a, b) => {
        if (a.priorityScore !== b.priorityScore) {
            return a.priorityScore - b.priorityScore;
        }
        // If same priority (unlikely due to randomFactor), prefer pairs with smaller rating gap
        if (a.ratingGap !== b.ratingGap) {
            return a.ratingGap - b.ratingGap;
        }
        // If same rating gap, prefer pairs without session repeats
        if (a.sessionRepeat !== b.sessionRepeat) {
            return a.sessionRepeat - b.sessionRepeat;
        }
        // If still same, prefer pairs without recent repeats
        if (a.isRecentRepeat !== b.isRecentRepeat) {
            return a.isRecentRepeat ? 1 : -1;
        }
        // If everything is the same, maintain stable order (randomFactor should prevent this)
        return 0;
    });
    
    // First, ensure all players who didn't play get a match (if possible)
    const usedPlayers = new Set();
    const playersWhoDidNotPlayArray = Array.from(playersWhoDidNotPlay);
    
    // Prioritize matches for players who didn't play in previous round
    if (playersWhoDidNotPlayArray.length > 0) {
        // Try to pair players who need to play or didn't play with each other first
        // Avoid session repeats and recent repeats when possible
        // But prioritize players who need to play even if it means session/recent repeats
        const priorityPairs = possiblePairs.filter(p => 
            (p.eitherNeedsToPlay || p.includesPlayerWhoDidNotPlay) &&
            !usedPlayers.has(p.pair[0]) && 
            !usedPlayers.has(p.pair[1]) &&
            (p.eitherNeedsToPlay || (p.sessionRepeat === 0 && !p.isRecentRepeat)) // For players who need to play, allow repeats if necessary
        );
        
        for (const { pair } of priorityPairs) {
            if (!usedPlayers.has(pair[0]) && !usedPlayers.has(pair[1])) {
                pairings.push(pair);
                usedPlayers.add(pair[0]);
                usedPlayers.add(pair[1]);
                // Stop if we've reached the court limit
                if (pairings.length >= maxCourts) break;
            }
        }
        
        // If some players who didn't play still aren't matched, pair them with others
        // Only if we haven't reached the court limit
        if (pairings.length < maxCourts) {
            const stillUnmatched = playersWhoDidNotPlayArray.filter(id => !usedPlayers.has(id));
            if (stillUnmatched.length > 0) {
                for (const unmatchedPlayerId of stillUnmatched) {
                    // Stop if we've reached the court limit
                    if (pairings.length >= maxCourts) break;
                    
                    // Find the best available partner for this player
                    const availablePairs = possiblePairs.filter(p => 
                        (p.pair[0] === unmatchedPlayerId || p.pair[1] === unmatchedPlayerId) &&
                        !usedPlayers.has(p.pair[0]) && 
                        !usedPlayers.has(p.pair[1])
                    );
                    
                    if (availablePairs.length > 0) {
                        // Sort by priority and take the best one
                        availablePairs.sort((a, b) => a.priorityScore - b.priorityScore);
                        const bestPair = availablePairs[0].pair;
                        pairings.push(bestPair);
                        usedPlayers.add(bestPair[0]);
                        usedPlayers.add(bestPair[1]);
                    }
                }
            }
        }
    }
    
    // Now fill in remaining players, avoiding session repeats and recent repeats when possible
    // Only if we haven't reached the court limit
    if (pairings.length < maxCourts) {
        for (const { pair, sessionRepeat, isRecentRepeat } of possiblePairs) {
            // Stop if we've reached the court limit
            if (pairings.length >= maxCourts) break;
            
            // Skip if already used, if it's a session repeat, or if it's a recent repeat (when we can avoid it)
            if (sessionRepeat > 0) continue;
            if (isRecentRepeat) continue; // Avoid recent repeats when possible
            if (usedPlayers.has(pair[0]) || usedPlayers.has(pair[1])) continue;
            
            pairings.push(pair);
            usedPlayers.add(pair[0]);
            usedPlayers.add(pair[1]);
        }
    }
    
    // If we have remaining players, allow some session repeats but minimize them
    // Only if we haven't reached the court limit
    if (pairings.length < maxCourts) {
        const remainingPlayers = shuffledPlayerIds.filter(id => !usedPlayers.has(id));
        if (remainingPlayers.length >= 2) {
            // Get all possible pairs for remaining players, including those with session repeats
            // Allow larger rating gaps if players need to play
            const remainingPairs = [];
            for (let i = 0; i < remainingPlayers.length; i++) {
                for (let j = i + 1; j < remainingPlayers.length; j++) {
                    const p1 = remainingPlayers[i];
                    const p2 = remainingPlayers[j];
                    
                    const rating1 = playerRatings[p1];
                    const rating2 = playerRatings[p2];
                    const ratingGap = Math.abs(rating1 - rating2);
                    const p1NeedsToPlay = playersWhoNeedToPlay.has(p1);
                    const p2NeedsToPlay = playersWhoNeedToPlay.has(p2);
                    const eitherNeedsToPlay = p1NeedsToPlay || p2NeedsToPlay;
                    
                    // Skip pairs with rating gap > 250 only if neither player needs to play
                    if (ratingGap > 250 && !eitherNeedsToPlay) {
                        continue; // Skip this pair - skill gap too large and no player needs to play
                    }
                    
                    const sessionRepeat = (sessionCounts[p1] && sessionCounts[p1][p2]) || 0;
                    const historyRepeat = (opponentCounts[p1] && opponentCounts[p1][p2]) || 0;
                    let ratingPenalty = ratingGap;
                    if (ratingGap > 250) {
                        ratingPenalty = 250 + (ratingGap - 250) * 10; // Heavily penalize gaps > 250
                    }
                    let repeatScore = sessionRepeat * 1000 + historyRepeat + ratingPenalty;
                    if (eitherNeedsToPlay) {
                        repeatScore -= 5000; // High priority for players who need to play
                    }
                    remainingPairs.push({
                        pair: [p1, p2],
                        sessionRepeat: sessionRepeat,
                        ratingGap: ratingGap,
                        eitherNeedsToPlay: eitherNeedsToPlay,
                        repeatScore: repeatScore
                    });
                }
            }
            
            if (remainingPairs.length > 0) {
                // Sort by repeat score (which now includes rating gap) and rating gap
                remainingPairs.sort((a, b) => {
                    if (a.repeatScore !== b.repeatScore) {
                        return a.repeatScore - b.repeatScore;
                    }
                    return a.ratingGap - b.ratingGap;
                });
                
                const usedRemaining = new Set();
                for (const { pair } of remainingPairs) {
                    // Stop if we've reached the court limit
                    if (pairings.length >= maxCourts) break;
                    
                    if (!usedRemaining.has(pair[0]) && !usedRemaining.has(pair[1])) {
                        pairings.push(pair);
                        usedRemaining.add(pair[0]);
                        usedRemaining.add(pair[1]);
                        if (usedRemaining.size === remainingPlayers.length) break;
                    }
                }
            }
        }
    }
    
    // If we still have no pairings and we have players, it means something went wrong
    // Fall back to creating at least one pair from the best available option
    if (pairings.length === 0 && possiblePairs.length > 0) {
        // Just take the first (best) pair to ensure we generate at least one match
        pairings.push(possiblePairs[0].pair);
    }
    
    // Limit to maxCourts matches (since each pairing is one match)
    // The pairings are already in priority order, so we just take the first maxCourts
    return pairings.slice(0, maxCourts);
}

// Legacy function for backward compatibility
function minimizeRepeatedOpponents(playerIds) {
    const emptySessionOpponents = {};
    playerIds.forEach(id => {
        emptySessionOpponents[id] = new Set();
    });
    return minimizeRepeatedOpponentsMultiRound(playerIds, emptySessionOpponents, new Set(), Infinity, new Set());
}

// Algorithm to minimize repeated partners (doubles) - multi-round version
function minimizeRepeatedPartnersMultiRound(playerIds, sessionPartners, playersWhoDidNotPlay = new Set(), maxCourts = Infinity, playersWhoNeedToPlay = new Set()) {
    if (playerIds.length < 4) return [];
    
    // Add randomness: shuffle player list before processing to break deterministic ordering
    const shuffledPlayerIds = shuffleArray(playerIds);
    
    const partnerCounts = {}; // Track how many times each player has partnered with each other player (from history)
    const sessionCounts = {}; // Track partners in this session
    const recentPartners = {}; // Track last 2 partners from match history
    
    // Initialize partner counts from history and get recent partners
    shuffledPlayerIds.forEach(playerId => {
        const player = players.find(p => p.id === playerId);
        
        // Get last 2 partners from match history
        recentPartners[playerId] = getRecentPartners(playerId, 2);
        
        if (!player) {
            // Player not found - initialize empty counts
            partnerCounts[playerId] = {};
            sessionCounts[playerId] = {};
            shuffledPlayerIds.forEach(partnerId => {
                if (partnerId !== playerId) {
                    partnerCounts[playerId][partnerId] = 0;
                    sessionCounts[playerId][partnerId] = 0;
                }
            });
            return;
        }
        
        partnerCounts[playerId] = {};
        sessionCounts[playerId] = {};
        
        // Check history against all selected players
        shuffledPlayerIds.forEach(partnerId => {
            if (partnerId !== playerId) {
                // Count from history (partners array contains IDs of partners)
                partnerCounts[playerId][partnerId] = 
                    (player.partners || []).filter(id => id === partnerId).length;
                // Count from current session (check if they've partnered in this generation session)
                const hasPartneredInSession = sessionPartners[playerId] && 
                                             sessionPartners[playerId] instanceof Set && 
                                             sessionPartners[playerId].has(partnerId);
                sessionCounts[playerId][partnerId] = hasPartneredInSession ? 1 : 0;
            }
        });
    });
    
    // Get player ratings for skill-based matching
    const playerRatings = {};
    shuffledPlayerIds.forEach(playerId => {
        const player = players.find(p => p.id === playerId);
        playerRatings[playerId] = player ? player.rating : ELO_CONFIG.INITIAL_RATING;
    });
    
    // Create all possible teams of 2 from selected players only (use shuffled list for randomness)
    const possibleTeams = [];
    for (let i = 0; i < shuffledPlayerIds.length; i++) {
        for (let j = i + 1; j < shuffledPlayerIds.length; j++) {
            const team = [shuffledPlayerIds[i], shuffledPlayerIds[j]].sort();
            const p1 = team[0];
            const p2 = team[1];
            
            // Calculate team rating statistics
            const rating1 = playerRatings[p1];
            const rating2 = playerRatings[p2];
            const partnerRatingGap = Math.abs(rating1 - rating2); // Prefer smaller gap between partners
            const teamAverageRating = (rating1 + rating2) / 2; // Used for balancing matches
            
            const sessionRepeat = (sessionCounts[p1] && sessionCounts[p1][p2]) || 0;
            const historyRepeat = (partnerCounts[p1] && partnerCounts[p1][p2]) || 0;
            
            // Check if this partner is in the last 2 recent partners
            const p1RecentPartners = recentPartners[p1] || [];
            const p2RecentPartners = recentPartners[p2] || [];
            const isRecentPartner1 = p1RecentPartners.includes(p2);
            const isRecentPartner2 = p2RecentPartners.includes(p1);
            const isRecentRepeat = isRecentPartner1 || isRecentPartner2;
            
            // Check if either player didn't play in the previous round
            const player1DidNotPlay = playersWhoDidNotPlay.has(p1);
            const player2DidNotPlay = playersWhoDidNotPlay.has(p2);
            const includesPlayerWhoDidNotPlay = player1DidNotPlay || player2DidNotPlay;
            
            // Check if either player needs to play (based on play frequency)
            const player1NeedsToPlay = playersWhoNeedToPlay.has(p1);
            const player2NeedsToPlay = playersWhoNeedToPlay.has(p2);
            const eitherNeedsToPlay = player1NeedsToPlay || player2NeedsToPlay;
            
            // Calculate priority score:
            // - Lower is better
            // - Session repeats are heavily penalized (multiply by 100000)
            // - Recent partners (last 2) are heavily penalized (multiply by 50000)
            // - Partner rating gap adds small penalty (multiply by 0.5, so similar partners preferred but not required)
            // - Players who need to play get high priority boost (subtract 5000) to ensure they play
            // - Players who didn't play get priority boost (subtract 1000)
            // - History repeats add small penalty
            // - Add small random component (0-100) to break ties and add randomness
            const randomFactor = Math.random() * 100;
            let priorityScore = sessionRepeat * 100000 + (isRecentRepeat ? 50000 : 0) + historyRepeat * 10 + partnerRatingGap * 0.5 + randomFactor;
            
            // Boost priority for players who need to play (very high priority)
            if (eitherNeedsToPlay) {
                priorityScore -= 5000; // High priority boost to ensure players who need to play get matches
                // If both need to play, give even higher priority
                if (player1NeedsToPlay && player2NeedsToPlay) {
                    priorityScore -= 2500;
                }
            }
            
            if (includesPlayerWhoDidNotPlay) {
                priorityScore -= 1000; // Boost priority for players who didn't play
                // If both didn't play, give even higher priority
                if (player1DidNotPlay && player2DidNotPlay) {
                    priorityScore -= 500;
                }
            }
            
            possibleTeams.push({
                team: team,
                repeatScore: sessionRepeat * 1000 + historyRepeat,
                sessionRepeat: sessionRepeat,
                isRecentRepeat: isRecentRepeat,
                partnerRatingGap: partnerRatingGap,
                teamAverageRating: teamAverageRating,
                eitherNeedsToPlay: eitherNeedsToPlay,
                priorityScore: priorityScore,
                includesPlayerWhoDidNotPlay: includesPlayerWhoDidNotPlay,
                player1DidNotPlay: player1DidNotPlay,
                player2DidNotPlay: player2DidNotPlay
            });
        }
    }
    
    // If no possible teams, return empty (shouldn't happen with 4+ players)
    if (possibleTeams.length === 0) {
        return [];
    }
    
    // Sort by priority score (lower is better) - this prioritizes teams with players who didn't play and similar partner ratings
    // The randomFactor in priorityScore ensures we get different results each time
    possibleTeams.sort((a, b) => {
        if (a.priorityScore !== b.priorityScore) {
            return a.priorityScore - b.priorityScore;
        }
        // If same priority (unlikely due to randomFactor), prefer teams with smaller partner rating gap
        if (a.partnerRatingGap !== b.partnerRatingGap) {
            return a.partnerRatingGap - b.partnerRatingGap;
        }
        // If same rating gap, prefer teams without session repeats
        if (a.sessionRepeat !== b.sessionRepeat) {
            return a.sessionRepeat - b.sessionRepeat;
        }
        // If still same, prefer teams without recent repeats
        if (a.isRecentRepeat !== b.isRecentRepeat) {
            return a.isRecentRepeat ? 1 : -1;
        }
        // If everything is the same, maintain stable order (randomFactor should prevent this)
        return 0;
    });
    
    // Greedily select teams to maximize matches while minimizing partner repeats
    // First, prioritize teams that include players who didn't play in the previous round
    // We need maxCourts * 2 teams (2 teams per match)
    const maxTeamsNeeded = maxCourts * 2;
    const usedPlayers = new Set();
    const selectedTeams = [];
    const playersWhoDidNotPlayArray = Array.from(playersWhoDidNotPlay);
    
    // First pass: prioritize teams with players who need to play or didn't play, avoiding session repeats and recent repeats when possible
    const playersWhoNeedToPlayArray = Array.from(playersWhoNeedToPlay);
    if ((playersWhoNeedToPlayArray.length > 0 || playersWhoDidNotPlayArray.length > 0) && selectedTeams.length < maxTeamsNeeded) {
        // Try to create teams that include players who need to play or didn't play
        // For players who need to play, allow repeats if necessary to ensure they play
        const priorityTeams = possibleTeams.filter(t => 
            (t.eitherNeedsToPlay || t.includesPlayerWhoDidNotPlay) &&
            !usedPlayers.has(t.team[0]) && 
            !usedPlayers.has(t.team[1]) &&
            (t.eitherNeedsToPlay || (t.sessionRepeat === 0 && !t.isRecentRepeat)) // For players who need to play, allow repeats if necessary
        );
        
        for (const teamData of priorityTeams) {
            if (selectedTeams.length >= maxTeamsNeeded) break;
            if (!usedPlayers.has(teamData.team[0]) && !usedPlayers.has(teamData.team[1])) {
                selectedTeams.push(teamData.team);
                usedPlayers.add(teamData.team[0]);
                usedPlayers.add(teamData.team[1]);
            }
        }
        
        // If some players who need to play or didn't play still aren't in a team, create teams for them
        if (selectedTeams.length < maxTeamsNeeded) {
            // Prioritize players who need to play first
            const stillUnmatchedNeedingToPlay = playersWhoNeedToPlayArray.filter(id => !usedPlayers.has(id));
            const stillUnmatched = playersWhoDidNotPlayArray.filter(id => !usedPlayers.has(id) && !stillUnmatchedNeedingToPlay.includes(id));
            const allStillUnmatched = [...stillUnmatchedNeedingToPlay, ...stillUnmatched];
            
            if (allStillUnmatched.length > 0) {
                for (const unmatchedPlayerId of allStillUnmatched) {
                    if (selectedTeams.length >= maxTeamsNeeded) break;
                    
                    // Find the best available partner for this player
                    const availableTeams = possibleTeams.filter(t => 
                        (t.team[0] === unmatchedPlayerId || t.team[1] === unmatchedPlayerId) &&
                        !usedPlayers.has(t.team[0]) && 
                        !usedPlayers.has(t.team[1])
                    );
                    
                    if (availableTeams.length > 0) {
                        // Sort by priority and take the best one
                        availableTeams.sort((a, b) => a.priorityScore - b.priorityScore);
                        const bestTeam = availableTeams[0].team;
                        selectedTeams.push(bestTeam);
                        usedPlayers.add(bestTeam[0]);
                        usedPlayers.add(bestTeam[1]);
                    }
                }
            }
        }
    }
    
    // Second pass: fill in remaining teams with no session repeats and no recent repeats
    // But allow teams with players who need to play even if they have repeats
    if (selectedTeams.length < maxTeamsNeeded) {
        for (const teamData of possibleTeams) {
            if (selectedTeams.length >= maxTeamsNeeded) break;
            if (usedPlayers.has(teamData.team[0]) || usedPlayers.has(teamData.team[1])) continue;
            
            // Skip teams with session/recent repeats UNLESS they have players who need to play
            if (!teamData.eitherNeedsToPlay) {
                if (teamData.sessionRepeat > 0) continue; // Skip teams that already partnered in this session
                if (teamData.isRecentRepeat) continue; // Skip recent repeats when possible
            }
            
            selectedTeams.push(teamData.team);
            usedPlayers.add(teamData.team[0]);
            usedPlayers.add(teamData.team[1]);
        }
    }
    
    // If we need more teams, allow some session repeats but minimize them
    if (selectedTeams.length < maxTeamsNeeded) {
        const remainingPlayers = shuffledPlayerIds.filter(id => !usedPlayers.has(id));
        if (remainingPlayers.length >= 2) {
            const remainingTeams = [];
            for (let i = 0; i < remainingPlayers.length; i++) {
                for (let j = i + 1; j < remainingPlayers.length; j++) {
                    const team = [remainingPlayers[i], remainingPlayers[j]].sort();
                    const p1 = team[0];
                    const p2 = team[1];
                    const rating1 = playerRatings[p1];
                    const rating2 = playerRatings[p2];
                    const partnerRatingGap = Math.abs(rating1 - rating2);
                    const p1NeedsToPlay = playersWhoNeedToPlay.has(p1);
                    const p2NeedsToPlay = playersWhoNeedToPlay.has(p2);
                    const eitherNeedsToPlay = p1NeedsToPlay || p2NeedsToPlay;
                    const sessionRepeat = (sessionCounts[p1] && sessionCounts[p1][p2]) || 0;
                    const historyRepeat = (partnerCounts[p1] && partnerCounts[p1][p2]) || 0;
                    let repeatScore = sessionRepeat * 1000 + historyRepeat + partnerRatingGap * 0.5;
                    if (eitherNeedsToPlay) {
                        repeatScore -= 5000; // High priority for players who need to play
                    }
                    remainingTeams.push({
                        team: team,
                        sessionRepeat: sessionRepeat,
                        partnerRatingGap: partnerRatingGap,
                        eitherNeedsToPlay: eitherNeedsToPlay,
                        repeatScore: repeatScore
                    });
                }
            }
            
            if (remainingTeams.length > 0) {
                // Sort by repeat score (which includes partner rating gap) and partner rating gap
                remainingTeams.sort((a, b) => {
                    if (a.repeatScore !== b.repeatScore) {
                        return a.repeatScore - b.repeatScore;
                    }
                    return a.partnerRatingGap - b.partnerRatingGap;
                });
                
                const usedRemaining = new Set();
                for (const teamData of remainingTeams) {
                    if (selectedTeams.length >= maxTeamsNeeded) break;
                    if (!usedRemaining.has(teamData.team[0]) && !usedRemaining.has(teamData.team[1])) {
                        selectedTeams.push(teamData.team);
                        usedRemaining.add(teamData.team[0]);
                        usedRemaining.add(teamData.team[1]);
                        if (usedRemaining.size === remainingPlayers.length) break;
                    }
                }
            }
        }
    }
    
    // Create matches from selected teams (pair teams into matches)
    // Balance teams by average rating to create fair matches
    // Convert selectedTeams to team data objects with rating information
    const selectedTeamData = selectedTeams.map(team => {
        const teamObj = possibleTeams.find(t => 
            t.team[0] === team[0] && t.team[1] === team[1]
        );
        if (teamObj) {
            return teamObj;
        }
        // Fallback if team not found in possibleTeams (shouldn't happen)
        const rating1 = playerRatings[team[0]];
        const rating2 = playerRatings[team[1]];
        return {
            team: team,
            teamAverageRating: (rating1 + rating2) / 2,
            eitherNeedsToPlay: playersWhoNeedToPlay.has(team[0]) || playersWhoNeedToPlay.has(team[1])
        };
    });
    
    // Sort teams: first by whether they have players who need to play, then by average rating
    selectedTeamData.sort((a, b) => {
        // Teams with players who need to play come first
        if (a.eitherNeedsToPlay !== b.eitherNeedsToPlay) {
            return a.eitherNeedsToPlay ? -1 : 1;
        }
        // Then sort by average rating
        return a.teamAverageRating - b.teamAverageRating;
    });
    
    // Greedily pair teams with similar average ratings, prioritizing teams with players who need to play
    const usedTeamIndices = new Set();
    const finalMatches = [];
    
    for (let i = 0; i < selectedTeamData.length && finalMatches.length < maxCourts; i++) {
        if (usedTeamIndices.has(i)) continue;
        
        let bestMatchIndex = -1;
        let bestScore = Infinity;
        
        // Find the best matching team
        for (let j = i + 1; j < selectedTeamData.length; j++) {
            if (usedTeamIndices.has(j)) continue;
            
            const ratingDiff = Math.abs(selectedTeamData[i].teamAverageRating - selectedTeamData[j].teamAverageRating);
            
            // Calculate match score: lower is better
            // Prefer matches with similar ratings, but prioritize matching teams with players who need to play
            let matchScore = ratingDiff;
            
            // If either team has players who need to play, boost priority
            if (selectedTeamData[i].eitherNeedsToPlay || selectedTeamData[j].eitherNeedsToPlay) {
                matchScore -= 1000; // Boost priority for teams with players who need to play
            }
            
            if (matchScore < bestScore) {
                bestScore = matchScore;
                bestMatchIndex = j;
            }
        }
        
        if (bestMatchIndex !== -1) {
            finalMatches.push([selectedTeamData[i].team, selectedTeamData[bestMatchIndex].team]);
            usedTeamIndices.add(i);
            usedTeamIndices.add(bestMatchIndex);
        } else {
            // If no match found, try to pair with any available team
            for (let j = i + 1; j < selectedTeamData.length; j++) {
                if (!usedTeamIndices.has(j)) {
                    finalMatches.push([selectedTeamData[i].team, selectedTeamData[j].team]);
                    usedTeamIndices.add(i);
                    usedTeamIndices.add(j);
                    break;
                }
            }
        }
    }
    
    // Use finalMatches as the result
    let resultMatches = finalMatches;
    
    // If we still have no matches and we have enough players, create at least one match
    // This can happen if we have an odd number of teams or other edge cases
    if (resultMatches.length === 0 && selectedTeamData.length >= 2) {
        // Create matches from available teams, even if odd number
        resultMatches.push([selectedTeamData[0].team, selectedTeamData[1].team]);
    } else if (resultMatches.length === 0 && possibleTeams.length >= 2) {
        // Fallback: create at least one match from the best available teams
        const bestTeams = possibleTeams.slice(0, 2);
        resultMatches.push([bestTeams[0].team, bestTeams[1].team]);
    }
    
    // Ensure we don't exceed maxCourts (shouldn't happen, but safety check)
    return resultMatches.slice(0, maxCourts);
}

// Legacy function for backward compatibility
function minimizeRepeatedPartners(playerIds) {
    const emptySessionPartners = {};
    playerIds.forEach(id => {
        emptySessionPartners[id] = new Set();
    });
    return minimizeRepeatedPartnersMultiRound(playerIds, emptySessionPartners, new Set(), Infinity, new Set());
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
    
    matchesList.innerHTML = rounds.map(round => {
        const roundMatches = matchesByRound[round];
        const sittingOutPlayers = getSittingOutPlayers(roundMatches);
        
        const roundHeader = round !== 'Unspecified' ? `<h3 style="margin-top: 20px; margin-bottom: 10px; color: #667eea;">Round ${round}</h3>` : '';
        
        const matchesHtml = roundMatches.map(match => {
            const team1Players = match.team1.map(id => getPlayerNameWithRating(id)).join(' & ');
            const team2Players = match.team2.map(id => getPlayerNameWithRating(id)).join(' & ');
            
            return `
                <div class="match-card ${match.type}">
                    <div class="match-id">
                        Match ID: ${match.id} | Type: ${match.type}
                    </div>
                    <div class="teams">
                        <div class="team">
                            <div class="team-name">${escapeHtml(team1Players)}</div>
                        </div>
                        <div class="vs">VS</div>
                        <div class="team">
                            <div class="team-name">${escapeHtml(team2Players)}</div>
                        </div>
                    </div>
                    <button class="btn btn-danger delete-match-btn" onclick="deleteMatch('${match.id}')">
                        Delete Match
                    </button>
                </div>
            `;
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
}

// Score Entry
function renderScores() {
    const scoresList = document.getElementById('matches-to-score');
    const pendingMatches = matches.filter(m => !m.completed);
    
    // Preserve existing input values before re-rendering
    const preservedScores = {};
    pendingMatches.forEach(match => {
        const score1Input = document.getElementById(`score1-${match.id}`);
        const score2Input = document.getElementById(`score2-${match.id}`);
        if (score1Input && score1Input.value !== '') {
            preservedScores[`score1-${match.id}`] = score1Input.value;
        }
        if (score2Input && score2Input.value !== '') {
            preservedScores[`score2-${match.id}`] = score2Input.value;
        }
    });
    
    if (pendingMatches.length === 0) {
        scoresList.innerHTML = '<div class="empty-state"><h3>No matches to score</h3><p>Generate matches and they will appear here</p></div>';
        return;
    }
    
    // Group matches by round if they have round numbers
    const matchesByRound = {};
    pendingMatches.forEach(match => {
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
    
    scoresList.innerHTML = rounds.map(round => {
        const roundMatches = matchesByRound[round];
        const roundHeader = round !== 'Unspecified' ? `<h3 style="margin-top: 20px; margin-bottom: 10px; color: #667eea;">Round ${round}</h3>` : '';
        
        const matchesHtml = roundMatches.map(match => {
            const team1Players = match.team1.map(id => getPlayerName(id)).join(' & ');
            const team2Players = match.team2.map(id => getPlayerName(id)).join(' & ');
            
            // Restore preserved values if they exist
            const score1Value = preservedScores[`score1-${match.id}`] || '';
            const score2Value = preservedScores[`score2-${match.id}`] || '';
            
            return `
                <div class="match-card ${match.type}">
                    <div class="match-id">Match ID: ${match.id}</div>
                    <div class="teams">
                        <div class="team">
                            <div class="team-name">${escapeHtml(team1Players)}</div>
                        </div>
                        <div class="vs">VS</div>
                        <div class="team">
                            <div class="team-name">${escapeHtml(team2Players)}</div>
                        </div>
                    </div>
                    <form class="score-input-form" onsubmit="submitScore(event, '${match.id}')">
                        <label>${escapeHtml(team1Players)}:</label>
                        <input type="number" min="0" max="30" id="score1-${match.id}" value="${score1Value}" required />
                        <label>${escapeHtml(team2Players)}:</label>
                        <input type="number" min="0" max="30" id="score2-${match.id}" value="${score2Value}" required />
                        <button type="submit" class="btn btn-success">Submit Score</button>
                    </form>
                </div>
            `;
        }).join('');
        
        return roundHeader + matchesHtml;
    }).join('');
}

function submitScore(event, matchId) {
    event.preventDefault();
    
    const match = matches.find(m => m.id === matchId);
    if (!match) return;
    
    const score1 = parseInt(document.getElementById(`score1-${matchId}`).value);
    const score2 = parseInt(document.getElementById(`score2-${matchId}`).value);
    
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
    
    // Remove completed match from matches array (it's now only in history)
    matches = matches.filter(m => m.id !== matchId);
    
    saveData();
    renderMatches();
    renderScores();
    renderPlayers();
    renderHistory();
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
}

function loadData() {
    const savedPlayers = localStorage.getItem('badmintonELO_players');
    const savedMatches = localStorage.getItem('badmintonELO_matches');
    const savedHistory = localStorage.getItem('badmintonELO_history');
    const savedEventPlayers = localStorage.getItem('badmintonELO_eventPlayers');
    
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
}

// Make functions available globally for onclick handlers
window.deletePlayer = deletePlayer;
window.submitScore = submitScore;
window.deleteMatch = deleteMatch;
window.removePlayerFromEvent = removePlayerFromEvent;

