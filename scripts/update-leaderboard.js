const fs = require('fs');
const path = require('path');
const Papa = require('papaparse');

const fetchOptions = {
    headers: {
        'User-Agent': 'nara.rocks/stats leaderboard updater'
    }
};

async function main() {
    try {
        console.log('Fetching active player list...');
        // Step 1: Get list of players from the mc-accounts endpoint
        const response = await fetch('https://api.civinfo.net/mc-accounts/all?limit=100000', fetchOptions);
        if (!response.ok) throw new Error(`Failed to fetch player list: ${response.status}`);
        
        const data = await response.json();
        
        // API format: parallel arrays with account info
        const names = data.mcNames || [];

        // Save all player names + UUIDs for case-sensitivity spell checking
        const uuids = data.uuids || [];
        const seenNames = new Map(); // lowercase -> { name, uuid }
        for (let i = 0; i < names.length; i++) {
            const name = names[i];
            if (name) {
                const lower = name.toLowerCase();
                if (!seenNames.has(lower)) {
                    seenNames.set(lower, { name, uuid: uuids[i] || null });
                }
            }
        }
        // Build sorted object: { "PlayerName": "uuid", ... }
        const sortedEntries = Array.from(seenNames.values())
            .sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));
        const playerNamesObj = {};
        for (const entry of sortedEntries) {
            playerNamesObj[entry.name] = entry.uuid;
        }
        const dataDir = path.join(__dirname, '../data');

        if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
        fs.writeFileSync(path.join(dataDir, 'player_names.json'), JSON.stringify(playerNamesObj, null, 2));
        console.log(`Saved ${sortedEntries.length} unique player names + UUIDs to data/player_names.json`);
        const lastLogins = data.lastLoginTimestamps || [];
        const lastLogouts = data.lastLogoutTimestamps || [];
        
        const now = Date.now();
        const oneWeekAgo = now - (7 * 24 * 60 * 60 * 1000);
        const oneMonthAgo = now - (30 * 24 * 60 * 60 * 1000);

        // Extract unique usernames who have been active in the past week
        const uniqueUsers = new Set();
        for (let i = 0; i < names.length; i++) {
            const lastLogin = lastLogins[i] || 0;
            const lastLogout = lastLogouts[i] || now;
            const username = names[i];

            // Only include players who have been active in the past week 
            if (lastLogin > oneWeekAgo || lastLogout > oneWeekAgo) {
                if (username) uniqueUsers.add(username);
            }
        }

        // Add anyone in top 20 for monthly or all-time just in case from current csv
        const currentCsvPath = path.join(__dirname, '../data/leaderboard.csv');
        if (fs.existsSync(currentCsvPath)) {
            const currentCsv = fs.readFileSync(currentCsvPath, 'utf8');
            const parsed = Papa.parse(currentCsv, { header: true });
            const rows = parsed.data;
            // Sort by Monthly and AllTime to find top 20
            const topMonthly = rows
                .filter(r => r.Username && r.Monthly)
                .sort((a, b) => parseFloat(b.Monthly) - parseFloat(a.Monthly))
                .slice(0, 20);
            const topAllTime = rows
                .filter(r => r.Username && r.AllTime)
                .sort((a, b) => parseFloat(b.AllTime) - parseFloat(a.AllTime))
                .slice(0, 20);

            topMonthly.forEach(r => uniqueUsers.add(r.Username));
            topAllTime.forEach(r => uniqueUsers.add(r.Username));
        }

        const usersArray = Array.from(uniqueUsers);
        console.log(`Found ${usersArray.length} unique players active in the last week. Fetching details...`);

        const stats = {};
        let processedCount = 0;
        const failedUsers = [];

        // Worker function to process a single user
        // Follows the same logic as computeStats on the frontend:
        // only count completed sessions (non-null logout), no capping/merging
        const processUser = async (username) => {
            try {
                const historyRes = await fetch(`https://api.civinfo.net/mc-sessions/all?mcName=${username}`, fetchOptions);
                
                if (!historyRes.ok) {
                    return { success: false, username };
                }

                const history = await historyRes.json();
                const logins = history.loginTimestamps || [];
                const logouts = history.logoutTimestamps || [];

                let weekly = 0;
                let monthly = 0;
                let allTime = 0;

                // Aggregate completed sessions only (skip ongoing/null logout)
                const pairs = Math.min(logins.length, logouts.length);
                for (let i = 0; i < pairs; i++) {
                    const li = logins[i];
                    const lo = logouts[i];
                    if (!li || lo === null) continue; // skip ongoing sessions

                    const start = li;
                    const end = lo;
                    if (end <= start) continue;

                    const duration = end - start;
                    allTime += duration;

                    // Weekly overlap
                    const weekStart = Math.max(start, oneWeekAgo);
                    const weekEnd = Math.min(end, now);
                    if (weekEnd > weekStart) {
                        weekly += (weekEnd - weekStart);
                    }

                    // Monthly overlap
                    const monthStart = Math.max(start, oneMonthAgo);
                    const monthEnd = Math.min(end, now);
                    if (monthEnd > monthStart) {
                        monthly += (monthEnd - monthStart);
                    }
                }

                if (allTime > 0) {
                    return { success: true, username, weekly, monthly, allTime };
                }
                return { success: true, username, noData: true };
            } catch (err) {
                console.error(`Error processing ${username}:`, err.message);
                return { success: false, username };
            }
        };

        // Process in chunks to control concurrency (approx 10 threads)
        const chunkSize = 10; 
        for (let i = 0; i < usersArray.length; i += chunkSize) {
            const chunk = usersArray.slice(i, i + chunkSize);
            const promises = chunk.map(username => processUser(username));
            
            const results = await Promise.all(promises);
            
            results.forEach(result => {
                if (result.success && !result.noData) {
                    stats[result.username] = result;
                } else if (!result.success) {
                    failedUsers.push(result.username);
                }
                processedCount++;
            });
            
            if (processedCount % 20 === 0 || processedCount === usersArray.length) {
                console.log(`[${processedCount}/${usersArray.length}] Processed`);
            }
        }

        // Retry failed users
        if (failedUsers.length > 0) {
            console.log(`\nRetrying ${failedUsers.length} failed users...`);
            const maxRetries = 3;
            let retryQueue = [...failedUsers];
            
            for (let attempt = 1; attempt <= maxRetries && retryQueue.length > 0; attempt++) {
                console.log(`Retry attempt ${attempt}/${maxRetries} for ${retryQueue.length} users...`);
                const stillFailed = [];
                
                // Add a small delay before retrying
                await new Promise(resolve => setTimeout(resolve, 1000));
                
                for (let i = 0; i < retryQueue.length; i += chunkSize) {
                    const chunk = retryQueue.slice(i, i + chunkSize);
                    const promises = chunk.map(username => processUser(username));
                    
                    const results = await Promise.all(promises);
                    
                    results.forEach(result => {
                        if (result.success && !result.noData) {
                            stats[result.username] = result;
                            console.log(`  ✓ Successfully retried: ${result.username}`);
                        } else if (!result.success) {
                            stillFailed.push(result.username);
                        }
                    });
                }
                
                retryQueue = stillFailed;
            }
            
            if (retryQueue.length > 0) {
                console.log(`\n⚠ ${retryQueue.length} users still failed after ${maxRetries} retries:`);
                retryQueue.forEach(u => console.log(`  - ${u}`));
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

        fs.writeFileSync(path.join(dataDir, 'leaderboard.csv'), csv);
        console.log(`Leaderboard updated successfully with ${csvData.length} players.`);

    } catch (error) {
        console.error('Fatal error:', error.message);
        process.exit(1);
    }
}

main();
