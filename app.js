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


function generateSinglesMatches(selectedPlayerIds, numRounds, maxCourts) {
    // TODO: Implement matchmaking algorithm for singles matches
}

function generateDoublesMatches(selectedPlayerIds, numRounds, maxCourts) {
    // TODO: Implement matchmaking algorithm for doubles matches
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

