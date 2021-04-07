const WebSocket = require('ws');

const wss = new WebSocket.Server({ port: 8080 });
var users = [];
// {
//     id: int,
//     name: string,
//     referee: boolean,
//     result: int,
// }

// Create function to get user data without others' rolls.
function sanitizedUserData(client, users) {
    // First, make a copy of users array.
    // By default, JS copies objects by reference, not value.
    var usersWithSelfRoll = [];
    users.forEach(user => {
        usersWithSelfRoll.push({...user});
    });

    // Remove other users' rolls.
    usersWithSelfRoll.forEach(user => {
        if (user.id !== client.id) {
            user.roll = null;
        }
    });

    return usersWithSelfRoll;
}

// Create function to broadcast messages to all users.
wss.broadcastFull = data => {
    wss.clients.forEach(client => {
        client.send(JSON.stringify(data));
    });
};

// Create function to broadcast messages to all users,
// but with other users' rolls sanitized first.
wss.broadcast = data => {
    wss.clients.forEach(client => {
        client.send(JSON.stringify({
            event: data.event,
            users: sanitizedUserData(client, data.users),
        }));
    });
};

// Connect to room.
wss.on('connection', ws => {
    // Add necessary information to each client (ws) and global users array.
    // ID is determined as follows: starting with 1, determine the lowest integer
    // not already in use as an ID.
    var id = 1;
    while (true) {
        if (users.find(user => user.id === id)) {
            id++;
        } else {
            break;
        }
    }

    // Add the ID to both the client object and the users array.
    ws.id = id;

    // If user is first in room, they run the auction. We call them referee.
    users.push({
        id: ws.id,
        name: `User ${ws.id}`,
        referee: users.length === 0,
        roll: null,
    });

    wss.broadcast({
        event: 'update',
        users: users,
    });

    ws.on('message', data => {
        data = JSON.parse(data);

        // The possible events are:
        // query users
        // changing user name
        // starting the auction (ref only)
        // revealing the values (ref only)

        if (data.event === 'queryUsers') {
            // Send user data to only the requesting client.
            ws.send(JSON.stringify({
                event: 'update',
                users: sanitizedUserData(ws, users),
                name: users.find(user => user.id === ws.id).name,
            }));
        }

        if (data.event === 'updateName') {
            // Check if name is already taken.
            var nameCollision = false;
            users.forEach(user => {
                if (user.name === data.name) {
                    nameCollision = true;
                }
            });

            // If it is taken, send an error. Otherwise proceed with updating.
            if (nameCollision) {
                ws.send(JSON.stringify({
                    event: 'error',
                    errorType: 'nameCollision',
                    message: 'That name is already taken',
                    name: users.find(user => user.id === ws.id).name,
                }));
            } else {
                users.find(user => user.id === ws.id).name = data.name;

                wss.broadcast({
                    event: 'update',
                    users: users,
                });
            }
        }

        if (data.event === 'roll' && users.find(user => user.id === ws.id).referee) {
            // Assign a value to every user.
            users.forEach(user => {
                user.roll = Math.floor(Math.random() * 6) + 1;
            });

            // Display only each user's own value.
            wss.broadcast({
                event: 'update',
                users: users,
            });
        } else if (data.event === 'roll') {
            // Only the referee can start an auction.
            ws.send(JSON.stringify({
                event: 'error',
                errorType: 'startAuctionPrivilege',
                message: 'Only the referee can start an auction',
            }));
        }

        if (data.event === 'reveal' && users.find(user => user.id === ws.id).referee) {
            // Check that all users have rolls.
            var allUsersRolled = true;
            users.forEach(user => {
                if (!user.roll) {
                    allUsersRolled = false;
                }
            });

            if (!allUsersRolled) {
                ws.send(JSON.stringify({
                    event: 'error',
                    errorType: 'revealBeforeRoll',
                    message: 'You must start the auction before revealing rolls. Did someone join after the auction started?',
                }));
            } else {
                // Display the values for all users.
                wss.broadcastFull({
                    event: 'update',
                    users: users,
                });
            }
        } else if (data.event === 'reveal') {
            // Only the referee can reveal auction rolls.
            ws.send(JSON.stringify({
                event: 'error',
                errorType: 'revealAuctionPrivilege',
                message: 'Only the referee can reveal auction rolls',
            }));
        }
    });

    ws.on('close', () => {
        // Check if user was referee. If they were, someone else needs to become referee.
        if (users.find(user => user.id === ws.id).referee) {
            // Next user in list becomes referee.
            if (users.length > 1) {
                users.filter(user => user.id !== ws.id)[0].referee = true;
            }
        }

        // Remove user from global users array.
        users = users.filter(user => user.id !== ws.id);

        wss.broadcast({
            event: 'update',
            users: users,
        });
    });
});