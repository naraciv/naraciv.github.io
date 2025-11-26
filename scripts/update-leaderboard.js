const fs = require('fs');
const path = require('path');
const Papa = require('papaparse');

async function main() {
    try {
        console.log('Fetching active player list...');
        // Step 1: Get list of players from the 'last' endpoint to know who to query
        const response = await fetch('https://civapi.drekamor.dev/mc-sessions/last');
        if (!response.ok) throw new Error(`Failed to fetch player list: ${response.status}`);
        
        const data = await response.json();
        const sessions = data.sessions || data;
        
        const now = Date.now();
        
        const twentyFiveHoursAgo = now - (25 * 60 * 60 * 1000);
        const oneWeekAgo = now - (7 * 24 * 60 * 60 * 1000);
        const oneMonthAgo = now - (30 * 24 * 60 * 60 * 1000);
        const oneDayMs = 24 * 60 * 60 * 1000;

        // Extract unique usernames
        const uniqueUsers = new Set();
        sessions.forEach(s => {
            const login = s.loginTs || s.login || 0;
            const logout = s.logoutTs || s.logout || now;

            // Only include players who have been active in the last 25 hours
            if (logout > twentyFiveHoursAgo) {
                if (s.mcName) uniqueUsers.add(s.mcName);
                if (s.user?.name) uniqueUsers.add(s.user.name);
            }
        });

        const usersArray = Array.from(uniqueUsers);
        console.log(`Found ${usersArray.length} unique players active in the last 25 hours. Fetching details...`);

        const stats = {};
        let processedCount = 0;

        // Worker function to process a single user
        const processUser = async (username) => {
            try {
                const historyRes = await fetch(`https://civapi.duckdns.org/mc-sessions/all?mcName=${username}&mcServer=civmc`);
                
                if (!historyRes.ok) {
                    // console.warn(`Failed to fetch history for ${username}: ${historyRes.status}`);
                    return null;
                }

                const history = await historyRes.json();
                const logins = history.loginTimestamps || [];
                const logouts = history.logoutTimestamps || [];

                let weekly = 0;
                let monthly = 0;
                let allTime = 0;

                // Iterate through sessions
                // User confirmed loginTimestamps length equals logoutTimestamps length
                for (let i = 0; i < logins.length; i++) {
                    const login = logins[i];
                    let logout = logouts[i];

                    // Handle active sessions or bad data (logout before login or missing)
                    if (!logout || logout <= login) {
                        logout = now;
                    }

                    // Sanity Check: Cap sessions at 24 hours (server restarts daily)
                    // This fixes the issue with inflated playtime numbers
                    if (logout - login > oneDayMs) {
                        logout = login + oneDayMs;
                    }


                    
                   

                    const start = login
                    // Monthly

                    if (logout > oneWeekAgo) {
                        if (logout > start) { 
                            weekly += (logout - start)
                            monthly += (logout - start)
                            allTime += (logout - start)
                        }
                    }
                    else if (logout > oneMonthAgo) {
                        if (logout > start) { 
                            monthly += (logout - start)
                            allTime += (logout - start)
                        }
                    }
                    else {
                        if (logout > start) { 
                            allTime += (logout - start)
                        }
                    }

                    // Weekly
                    
                }

                if (allTime > 0) {
                    return { username, weekly, monthly, allTime };
                }
            } catch (err) {
                console.error(`Error processing ${username}:`, err.message);
            }
            return null;
        };

        // Process in chunks to control concurrency (approx 10 threads)
        const chunkSize = 10; 
        for (let i = 0; i < usersArray.length; i += chunkSize) {
            const chunk = usersArray.slice(i, i + chunkSize);
            const promises = chunk.map(username => processUser(username));
            
            const results = await Promise.all(promises);
            
            results.forEach(result => {
                if (result) {
                    stats[result.username] = result;
                }
                processedCount++;
            });
            
            if (processedCount % 20 === 0 || processedCount === usersArray.length) {
                console.log(`[${processedCount}/${usersArray.length}] Processed`);
            }
        }

        // Generate CSV
        const csvData = Object.values(stats)
            .map(data => ({
                Username: data.username,
                Weekly: (data.weekly / (1000 * 60 * 60)).toFixed(1),
                Monthly: (data.monthly / (1000 * 60 * 60)).toFixed(1),
                AllTime: (data.allTime / (1000 * 60 * 60)).toFixed(1)
            }));

        // Sort by weekly
        csvData.sort((a, b) => parseFloat(b.Weekly) - parseFloat(a.Weekly));

        const csv = Papa.unparse(csvData);
        
        const dataDir = path.join(__dirname, '../data');
        if (!fs.existsSync(dataDir)){
            fs.mkdirSync(dataDir, { recursive: true });
        }

        fs.writeFileSync(path.join(dataDir, 'leaderboard.csv'), csv);
        console.log(`Leaderboard updated successfully with ${csvData.length} players.`);

    } catch (error) {
        console.error('Fatal error:', error.message);
        process.exit(1);
    }
}

main();