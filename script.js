// --- Firebase Configuration ---
// PASTE YOUR FIREBASE CONFIG SNIPPET HERE:
// Import the functions you need from the SDKs you need

const firebaseConfig = {
  apiKey: "AIzaSyDB0jlo4Dj1NF6uv4rAU-uhzVH59ZHov4E",
  authDomain: "my-live-tictactoe.firebaseapp.com",
  projectId: "my-live-tictactoe",
  storageBucket: "my-live-tictactoe.firebasestorage.app",
  messagingSenderId: "669712171652",
  appId: "1:669712171652:web:6e3887f60e251b3f47f8d1",
  measurementId: "G-P77VK0RM07"
};
// Initialize Firebase
        //const app = initializeApp(firebaseConfig);
        //const analytics = getAnalytics(app);
// --- End Firebase Configuration ---

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const database = firebase.database();

// --- Global Variables ---
let currentUserId = null;
let currentGameId = null;
let playerSymbol = null; // 'X' or 'O'
let myTurn = false;
let gameListener = null; // To store the Firebase listener for the current game

// --- DOM Elements ---
const loginSection = document.getElementById('login-section');
const appSection = document.getElementById('app-section');
const userIdInput = document.getElementById('user-id');
const loginButton = document.getElementById('login-button');
const loginError = document.getElementById('login-error');
const currentUserSpan = document.getElementById('current-user-id');
const logoutButton = document.getElementById('logout-button');
const userListUl = document.getElementById('user-list');
const challengeStatusP = document.getElementById('challenge-status');
const incomingChallengeDiv = document.getElementById('incoming-challenge');
const challengerIdSpan = document.getElementById('challenger-id');
const acceptChallengeButton = document.getElementById('accept-challenge');
const declineChallengeButton = document.getElementById('decline-challenge');
const gamesListUl = document.getElementById('games-list');
const gameSection = document.getElementById('game-section');
const opponentIdSpan = document.getElementById('opponent-id');
const gameStatusP = document.getElementById('game-status');
const boardDiv = document.getElementById('tic-tac-toe-board');
const cells = document.querySelectorAll('.cell');
const leaveGameButton = document.getElementById('leave-game-button');

// --- Firebase Refs ---
const usersRef = database.ref('users');
const gamesRef = database.ref('games');
const challengesRef = database.ref('challenges');

// --- Functions ---

function showLogin() {
    loginSection.style.display = 'block';
    appSection.style.display = 'none';
    gameSection.style.display = 'none'; // Ensure game section is hidden on logout
    clearGameUI(); // Clear any leftover game UI
}

function showApp() {
    loginSection.style.display = 'none';
    appSection.style.display = 'block';
    currentUserSpan.textContent = currentUserId;
    listenForUsers();
    listenForMyChallenges();
    listenForMyGames();
    // Check if user was in a game and try to rejoin
    usersRef.child(currentUserId).child('currentGameId').once('value', snapshot => {
        const gameId = snapshot.val();
        if (gameId) {
            joinGame(gameId);
        } else {
             gameSection.style.display = 'none'; // Ensure game section is hidden if not rejoining
        }
    });
}

function handleLogin() {
    const userId = parseInt(userIdInput.value, 10);
    loginError.textContent = ''; // Clear previous errors

    if (isNaN(userId) || userId < 0 || userId > 9) {
        loginError.textContent = 'Please enter a number between 0 and 9.';
        return;
    }

    currentUserId = userId;

    // Set user presence (online status)
    const myUserRef = usersRef.child(currentUserId);
    // Use onDisconnect to clean up if the browser is closed abruptly
    myUserRef.onDisconnect().remove();
    // Set current status
    myUserRef.set({ online: true, id: currentUserId })
        .then(() => {
            showApp();
        })
        .catch(error => {
            console.error("Login failed:", error);
            loginError.textContent = "Login failed. Maybe try a different number?";
            currentUserId = null; // Reset user ID on failure
        });
}

function createBoardHTML() {
    const container = document.getElementById('mega-board-container');
    if (!container) {
        console.error("Mega board container not found!");
        return;
    }
    container.innerHTML = ''; // Clear previous board if any

    const largeBoard = document.createElement('div');
    largeBoard.className = 'large-board';

    // Loop for Large Cells (L index 0-8)
    for (let l = 0; l < 9; l++) {
        const largeCell = document.createElement('div');
        largeCell.className = 'large-cell';
        largeCell.dataset.largeIndex = l; // Store L index

        const mediumBoard = document.createElement('div');
        mediumBoard.className = 'medium-board';
        // We'll add 'active-medium' class later based on game state

        // Loop for Medium Cells (M index 0-8)
        for (let m = 0; m < 9; m++) {
            const mediumCell = document.createElement('div');
            mediumCell.className = 'medium-cell';
            mediumCell.dataset.mediumIndex = m; // Store M index relative to L

            const smallBoard = document.createElement('div');
            smallBoard.className = 'small-board';

            // Loop for Small Cells (S index 0-8)
            for (let s = 0; s < 9; s++) {
                const smallCell = document.createElement('div');
                smallCell.className = 'small-cell'; // Clickable cell
                // Store all coordinates on the clickable cell
                smallCell.dataset.l = l;
                smallCell.dataset.m = m;
                smallCell.dataset.s = s;
                smallCell.textContent = ''; // Initially empty visually
                smallBoard.appendChild(smallCell);
            } // End small cell loop

            mediumCell.appendChild(smallBoard);
            mediumBoard.appendChild(mediumCell);
        } // End medium cell loop

        largeCell.appendChild(mediumBoard);
        largeBoard.appendChild(largeCell);
    } // End large cell loop

    container.appendChild(largeBoard);
    console.log("Mega board HTML created.");

    // Attach event listeners AFTER creating the board
    attachClickListeners(); // We'll create this function next
}

function handleLogout() {
    if (currentGameId) {
        // Optionally mark the game as paused or just leave
        gamesRef.child(currentGameId).child('status').set('paused'); // Mark as paused
        usersRef.child(currentUserId).child('currentGameId').remove(); // Remove game link from user
        detachGameListener(); // Stop listening to game updates
    }
    if (currentUserId !== null) {
        usersRef.child(currentUserId).remove() // Remove user presence
            .then(() => {
                resetLocalState();
                showLogin();
            })
            .catch(error => {
                console.error("Error during logout cleanup:", error);
                // Still proceed with UI changes even if DB cleanup fails
                 resetLocalState();
                 showLogin();
            });
    } else {
         resetLocalState();
         showLogin();
    }
}

function resetLocalState() {
     currentUserId = null;
     currentGameId = null;
     playerSymbol = null;
     myTurn = false;
     userIdInput.value = ''; // Clear input field
     userListUl.innerHTML = ''; // Clear lists
     gamesListUl.innerHTML = '';
     challengeStatusP.textContent = '';
     incomingChallengeDiv.style.display = 'none';
}


// --- User Presence and Challenges ---

function listenForUsers() {
    usersRef.on('value', snapshot => {
        userListUl.innerHTML = ''; // Clear current list
        const users = snapshot.val();
        if (!users) return;

        Object.values(users).forEach(user => {
            if (user.id === currentUserId) return; // Don't list self

            const li = document.createElement('li');
            li.textContent = `User ${user.id} (${user.currentGameId ? 'In Game' : 'Available'})`;

            // Add challenge button if the user is available
            if (!user.currentGameId) {
                const challengeButton = document.createElement('button');
                challengeButton.textContent = 'Challenge';
                challengeButton.onclick = () => sendChallenge(user.id);
                li.appendChild(challengeButton);
            }
            userListUl.appendChild(li);
        });
    });
}

function sendChallenge(opponentId) {
    if (currentUserId === null) return;
    challengeStatusP.textContent = `Challenging User ${opponentId}...`;

    // Simple challenge mechanism: write to a common 'challenges' path
    // The challenged user listens for challenges directed at them
    const challengeData = {
        challengerId: currentUserId,
        challengedId: opponentId,
        timestamp: firebase.database.ServerValue.TIMESTAMP // Optional: for cleanup later
    };
    // Use opponentId as key for easy lookup by the challenged user
    challengesRef.child(opponentId).set(challengeData)
        .then(() => {
            console.log(`Challenge sent to ${opponentId}`);
        })
        .catch(error => {
            console.error("Error sending challenge:", error);
            challengeStatusP.textContent = 'Error sending challenge.';
        });
}

function attachClickListeners() {
     const container = document.getElementById('mega-board-container');
     if (!container) return;

     // Use event delegation on the container for efficiency
     container.addEventListener('click', (event) => {
         // Check if the clicked element is a small-cell
         if (event.target && event.target.classList.contains('small-cell')) {
             const cell = event.target;
             const l = parseInt(cell.dataset.l, 10);
             const m = parseInt(cell.dataset.m, 10);
             const s = parseInt(cell.dataset.s, 10);
             console.log(`Clicked cell: L=${l}, M=${m}, S=${s}`);

             // Prevent action if game is over - check parent #game-section
             const gameSectionDiv = document.getElementById('game-section');
             if (gameSectionDiv && gameSectionDiv.classList.contains('game-over')) {
                 console.log("Game is over, clicks disabled.");
                 return;
             }

             // Call the new makeMove function (which needs to be rewritten)
             makeMove(l, m, s);
         }
     });
     console.log("Click listener attached to mega-board container.");
}


function listenForMyChallenges() {
    const myChallengeRef = challengesRef.child(currentUserId);
    myChallengeRef.on('value', snapshot => {
        const challengeData = snapshot.val();
        if (challengeData && challengeData.challengerId !== undefined) {
            // We have an incoming challenge
            challengerIdSpan.textContent = challengeData.challengerId;
            incomingChallengeDiv.style.display = 'block';
            challengeStatusP.textContent = ''; // Clear outgoing challenge status

            acceptChallengeButton.onclick = () => acceptChallenge(challengeData.challengerId);
            declineChallengeButton.onclick = () => declineChallenge(challengeData.challengerId);
        } else {
            // No challenge or challenge was removed/declined
            incomingChallengeDiv.style.display = 'none';
        }
    });

    // Cleanup challenge listener on logout needs to be handled in handleLogout or page unload
    // For simplicity here, we rely on the listener being implicitly detached when the page context is lost
    // or explicitly in handleLogout if needed. Firebase handles listener cleanup on disconnect well.
}


function declineChallenge(challengerId) {
     if (currentUserId === null) return;
    // Simply remove the challenge node
    challengesRef.child(currentUserId).remove()
        .then(() => {
             console.log(`Challenge from ${challengerId} declined.`);
             incomingChallengeDiv.style.display = 'none'; // Hide UI
        })
        .catch(error => {
            console.error("Error declining challenge:", error);
        });
}


// --- Game Logic & Persistence ---

// PASTE THIS ENTIRE FUNCTION INTO YOUR SCRIPT.JS, REPLACING THE OLD ONE

function acceptChallenge(challengerId) {
    if (currentUserId === null) {
        console.error("[acceptChallenge] Cannot accept challenge, currentUserId is null.");
        return;
    }
    if (currentGameId) {
        console.warn("[acceptChallenge] Already in a game (" + currentGameId + "), cannot accept another challenge.");
        // Optionally decline the incoming challenge automatically
        // declineChallenge(challengerId);
        return;
    }

    const opponentId = challengerId;
    // Create a unique game ID (e.g., user1_user2) - ensure consistent order
    const userIds = [currentUserId, opponentId].sort((a, b) => a - b);
    const newGameId = `game_${userIds[0]}_${userIds[1]}`;

    // Prepare the initial state of the game
  const initialSmallCells = {};
    for (let l = 0; l < 9; l++) {
        for (let m = 0; m < 9; m++) {
            for (let s = 0; s < 9; s++) {
                initialSmallCells[`${l}_${m}_${s}`] = null; // Use null for empty
            }
        }
    }

    const initialMediumCells = {};
     for (let l = 0; l < 9; l++) {
         initialMediumCells[l] = {};
         for (let m = 0; m < 9; m++) {
            initialMediumCells[l][m] = null; // Null means unresolved/empty medium cell
         }
     }

     const initialLargeCells = {};
     for (let l = 0; l < 9; l++) {
        initialLargeCells[l] = null; // Null means unresolved/empty large cell
     }


    const initialGameState = {
        playerX: userIds[0], // Lower ID starts as X
        playerO: userIds[1],
        turn: userIds[0],          // Player X starts
        status: 'active',        // Game is active
        winner: null,            // Overall game winner (null, X, O, D)

        small_cells: initialSmallCells,         // State of 81 small cells (null, X, O)
        medium_board_cells: initialMediumCells, // State of 9x9 medium cells (null, X, O, D)
        large_board_cells: initialLargeCells,   // State of 9 large cells (null, X, O, D)

        // Which Medium board (L index) and Small board (M index) the current player MUST target
        next_target_L: null, // null for the very first move (any L is valid)
        next_target_M: null, // null for the very first move (any M is valid)

        lastActivity: firebase.database.ServerValue.TIMESTAMP // Record activity time
    };

    // Log what we are about to send (for debugging)
    console.log(`[acceptChallenge] Preparing to create game ${newGameId} with initial state:`, JSON.stringify(initialGameState));

    // Pre-check: Make absolutely sure the board exists locally before sending
   
    // ADD THIS LOG:
    console.log("[acceptChallenge] VERIFY state before set:",
                initialGameState.hasOwnProperty('small_cells'),
                initialGameState.hasOwnProperty('medium_board_cells'),
                initialGameState.hasOwnProperty('large_board_cells'),
                initialGameState.hasOwnProperty('next_target_L')
               );

    // Attempt to create the game node in Firebase Database
    gamesRef.child(newGameId).set(initialGameState)
        .then(() => {
            // --- This code runs ONLY IF the .set() operation was successful ---

            console.log(`[acceptChallenge] Firebase .set() for ${newGameId} SUCCEEDED.`);

            // 1. Log confirmation
            console.log(`[acceptChallenge] Game ${newGameId} created and data set confirmed in Firebase.`);

            // 2. Update both players' status to link them to this new game
            const userUpdates = {};
            userUpdates[`/users/${currentUserId}/currentGameId`] = newGameId;
            userUpdates[`/users/${opponentId}/currentGameId`] = newGameId;
            database.ref().update(userUpdates)
                .then(() => {
                     console.log(`[acceptChallenge] Updated user status for ${currentUserId} and ${opponentId}.`);
                 })
                .catch(err => {
                    console.error(`[acceptChallenge] FAILED to update user status:`, err);
                });

            // 3. Remove the challenge notification from Firebase
            challengesRef.child(currentUserId).remove()
               .then(() => {
                    console.log("[acceptChallenge] Removed accepted challenge node from Firebase.");
                })
               .catch(err => {
                    console.error("[acceptChallenge] Error removing challenge node:", err);
                });

            // 4. Hide the incoming challenge UI immediately
            incomingChallengeDiv.style.display = 'none';

            // --- *** ADDED DELAY *** ---
            // Wait a fraction of a second before joining to allow data propagation
            console.log("[acceptChallenge] Waiting briefly (250ms) before calling joinGame...");
            setTimeout(() => {
                console.log("[acceptChallenge] Timeout finished. Calling joinGame() now.");
                // 4b. Automatically join the game view AFTER the delay
                joinGame(newGameId);
            }, 250); // Wait 250 milliseconds (can adjust if needed)
            // --- *** END ADDED DELAY *** ---

        }) // End of the .then() block
        .catch(error => {
            // --- This code runs ONLY IF the .set() operation FAILED ---

            console.error(`[acceptChallenge] Firebase .set() for ${newGameId} FAILED:`, error);
            console.error("[acceptChallenge] Error starting game:", error);
            // Inform the user
            alert(`Failed to create the game: ${error.message}. Please try again.`);
            // Optionally try to clean up if needed, though the set failed so maybe not much to clean.
            // Reset UI state if necessary
             incomingChallengeDiv.style.display = 'none'; // Hide challenge anyway
        });

    // --- IMPORTANT: There should be NO code here anymore that relies on the game existing ---
} // <-- Make SURE this final closing brace is included!

function listenForMyGames() {
    // Listen for all games, then filter client-side
    gamesRef.orderByChild('lastActivity').on('value', snapshot => {
        gamesListUl.innerHTML = ''; // Clear list
        const allGames = snapshot.val();
        if (!allGames) return;

        Object.entries(allGames).forEach(([gameId, gameData]) => {
            if ((gameData.playerX === currentUserId || gameData.playerO === currentUserId) && gameData.status !== 'finished') {
                // This game involves the current user and isn't finished
                 if (gameId === currentGameId && gameSection.style.display !== 'none') {
                    // Don't list the game we are currently actively playing
                    return;
                }

                const li = document.createElement('li');
                const opponent = gameData.playerX === currentUserId ? gameData.playerO : gameData.playerX;
                li.textContent = `Game vs ${opponent} (${gameData.status})`;

                if (gameData.status === 'paused' || gameData.status === 'active') {
                    const rejoinButton = document.createElement('button');
                    rejoinButton.textContent = 'Rejoin / View';
                    rejoinButton.onclick = () => joinGame(gameId);
                    li.appendChild(rejoinButton);
                }
                // Could add a 'Delete Finished Game' button here too
                 gamesListUl.appendChild(li);
            }
        });
    });
}

// REPLACE your existing joinGame function with THIS ENTIRE BLOCK

function joinGame(gameId) {
    // If already listening to a game, detach the old listener first
    detachGameListener(); // Use the existing detach function

    currentGameId = gameId;
    console.log(`[joinGame] Attempting to join game: ${currentGameId}`);
    gameSection.style.display = 'block';
    leaveGameButton.style.display = 'inline-block'; // Show leave button

    createBoardHTML();
  
    // Update user's current game in Firebase
    if (currentUserId) {
        usersRef.child(currentUserId).update({ currentGameId: gameId })
            .catch(err => console.error("[joinGame] Error updating user's currentGameId:", err));
    }

    // --- MODIFICATION: Use .get() for initial read ---
    console.log(`[joinGame] Performing initial .get() for game state: ${currentGameId}`);
    gamesRef.child(currentGameId).get()
        .then((snapshot) => {
            if (snapshot.exists()) {
                const gameState = snapshot.val();
                console.log("[joinGame] Data received from .get():", JSON.stringify(gameState));

                // --- CRITICAL CHECK: Does this first fetch have the board? ---
                if (gameState.board && Array.isArray(gameState.board)) {
                    console.log("[joinGame] SUCCESS: Board found in .get() snapshot!");
                    // Update the UI with this initially fetched state
                    updateGameUI(gameState);

                    // --- NOW attach the persistent listener for FUTURE updates ---
                    console.log("[joinGame] Attaching persistent .on('value') listener for subsequent updates...");
                    attachPersistentGameListener(currentGameId); // Call helper function

                } else {
                    console.error("[joinGame] FATAL FAILURE: Board is MISSING or invalid even in .get() snapshot!", gameState);
                    gameStatusP.textContent = "Error: Failed to load complete game data. Board missing on fetch.";
                    // Don't attach persistent listener if initial load failed badly
                    // Consider leaving the game or showing a persistent error
                }
            } else {
                console.error(`[joinGame] Game node ${currentGameId} does not exist according to .get().`);
                gameStatusP.textContent = "Error: Game not found.";
                leaveGame(); // Exit if game doesn't exist
            }
        })
        .catch((error) => {
            console.error("[joinGame] Error getting game data with .get():", error);
            gameStatusP.textContent = "Error loading game.";
            leaveGame(); // Exit on error
        });

    // Note: The .on() listener is now attached *inside* the .then() block of the .get(),
    // but only if the initial .get() was successful and contained the board.
}

// ADD THIS NEW FUNCTION TO YOUR SCRIPT.JS

function attachPersistentGameListener(gameId) {
    // Make sure we don't attach multiple listeners for the same game
    if (gameListener && currentGameId === gameId) {
         console.log("[attachPersistentGameListener] Listener already active for game:", gameId);
         return;
    }
    // Detach any previous listener just in case
    detachGameListener();

    console.log("[attachPersistentGameListener] Attaching listener for game:", gameId);
    currentGameId = gameId; // Ensure currentGameId is set

    // Attach the actual listener that calls updateGameUI on changes
    gameListener = gamesRef.child(gameId).on('value', snapshot => {
        console.log("[Listener Callback] Received update for game:", gameId);
        const gameState = snapshot.val();
        if (!gameState) {
            console.warn(`[Listener Callback] Game ${gameId} data is null/deleted.`);
            // Handle game deletion - maybe call leaveGame() or show message
            if (currentGameId === gameId) { // Only leave if it's the game we think we're in
                leaveGame();
            }
            return;
        }
        // Update UI with the received game state (which might be an update or the initial state again)
        updateGameUI(gameState); // This should now receive subsequent updates fine

    }, error => {
        console.error("[Listener Callback] Error listening to game:", gameId, error);
        // Handle error, maybe leave the game UI
        if (currentGameId === gameId) {
             leaveGame();
        }
    });
     console.log("[attachPersistentGameListener] Listener attached successfully for game:", gameId);
}

// === ADD THIS FUNCTION TO SCRIPT.JS ===
function clearGameUI() {
    // Clear the dynamic board container
    const container = document.getElementById('mega-board-container');
    if (container) {
        container.innerHTML = '';
    }
    // Clear status texts
    gameStatusP.textContent = '';
    opponentIdSpan.textContent = '';
     const gameSectionDiv = document.getElementById('game-section');
     gameSectionDiv?.classList.remove('game-over'); // Use optional chaining
}

function leaveGame() {
     if (!currentGameId) return;

     // Detach listener FIRST
     detachGameListener();

    // Update user status (remove currentGameId link)
    if (currentUserId) {
         usersRef.child(currentUserId).child('currentGameId').remove();
    }

     // Optionally update game status (e.g., to 'paused') if needed
     // gamesRef.child(currentGameId).child('status').set('paused');

    // Reset local game state
    currentGameId = null;
    playerSymbol = null;
    myTurn = false;

    // Update UI
    gameSection.style.display = 'none';
    leaveGameButton.style.display = 'none';
    clearGameUI();
    listenForMyGames(); // Refresh the list of joinable games
}


function detachGameListener() {
    if (gameListener && currentGameId) {
        console.log(`[detachGameListener] Detaching listener for game ${currentGameId}`);
        gamesRef.child(currentGameId).off('value', gameListener);
        gameListener = null;
        // We don't reset currentGameId here, leaveGame() handles that when user exits.
    } else {
        // console.log("[detachGameListener] No active listener to detach or no currentGameId.");
    }
}

//update game ui

//make move


function calculateBoardOutcome(cells) {
    // cells is expected to be an array or object of 9 cells (indices 0-8)
    // Values can be null, "", "X", "O", "D"
    const lines = [
        [0, 1, 2], [3, 4, 5], [6, 7, 8], // Rows
        [0, 3, 6], [1, 4, 7], [2, 5, 8], // Columns
        [0, 4, 8], [2, 4, 6]             // Diagonals
    ];

    // Check for Win
    for (const line of lines) {
        const [a, b, c] = line;
        // Check if first cell is X or O (truthy and not 'D') and all match
        if (cells[a] && cells[a] !== 'D' && cells[a] === cells[b] && cells[a] === cells[c]) {
            return cells[a]; // Return 'X' or 'O'
        }
    }

    // Check for Draw (all cells filled, no winner)
    // Filled means not null or empty string
     let allFilled = true;
     for (let i = 0; i < 9; i++) {
         if (cells[i] === null || cells[i] === "") {
             allFilled = false;
             break;
         }
     }
     if (allFilled) {
         return 'D'; // Return 'D' for Draw
     }


    // If no win and not all filled, return null (unresolved)
    return null;
}

function checkWinner(board) {
    // Define all winning combinations (rows, columns, diagonals)
    const lines = [
        [0, 1, 2], [3, 4, 5], [6, 7, 8], // Rows
        [0, 3, 6], [1, 4, 7], [2, 5, 8], // Columns
        [0, 4, 8], [2, 4, 6]             // Diagonals
    ];

    // 1. Check for a Win (X or O)
    for (let i = 0; i < lines.length; i++) {
        const [a, b, c] = lines[i];
        // Check if the first cell in the line is filled (truthy: 'X' or 'O')
        // AND if all three cells in the line have the same value.
        if (board[a] && board[a] === board[b] && board[a] === board[c]) {
            console.log(`[checkWinner] Win detected on line ${a},${b},${c} for player: ${board[a]}`);
            return { winner: board[a] }; // Return the winner ('X' or 'O')
        }
    }

    // 2. If no winner, check for a Draw
    // A draw occurs if all cells are filled (truthy: 'X' or 'O') and no one has won.
    // board.every(cell => cell) checks if every cell has a truthy value.
    if (board.every(cell => cell)) {
        console.log("[checkWinner] No win detected, and all cells are filled. Declaring Draw.");
        return { winner: 'Draw' }; // Return 'Draw'
    }

    // 3. If no win and not all cells are filled, the game continues
    // console.log("[checkWinner] No win or draw detected yet."); // Optional: Log for debugging active game state
    return { winner: null }; // Return null indicating no winner yet
}


// --- Event Listeners ---
loginButton.addEventListener('click', handleLogin);
userIdInput.addEventListener('keypress', (event) => {
    if (event.key === 'Enter') {
        handleLogin();
    }
});
logoutButton.addEventListener('click', handleLogout);
leaveGameButton.addEventListener('click', leaveGame);

cells.forEach(cell => {
    cell.addEventListener('click', () => {
        if (!boardDiv.classList.contains('game-over')) { // Only allow clicks if game not over
             makeMove(parseInt(cell.dataset.index, 10));
        }
    });
});


// --- Initial State ---
showLogin(); // Start with the login screen visible

// Optional: Handle page unload gracefully (though onDisconnect is often sufficient)
// window.addEventListener('beforeunload', handleLogout); // This can be annoying for users
