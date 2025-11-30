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
        const oneWeekAgo = now - (7 * 24 * 60 * 60 * 1000);
        const oneMonthAgo = now - (30 * 24 * 60 * 60 * 1000);
        const oneYearAgo = now - (365 * 24 * 60 * 60 * 1000);
        const oneDayMs = 24 * 60 * 60 * 1000;

        // Extract unique usernames
        const uniqueUsers = new Set();
        sessions.forEach(s => {
            const login = s.loginTs || s.login || 0;
            const logout = s.logoutTs || s.logout || now;

            // Only include players who have been active in the past week
            if (logout > oneWeekAgo) {
                if (s.mcName) uniqueUsers.add(s.mcName);
                if (s.user?.name) uniqueUsers.add(s.user.name);
            }
        });

        const usersArray = Array.from(uniqueUsers);
        console.log(`Found ${usersArray.length} unique players active in the last week. Fetching details...`);

        const stats = {};
        let processedCount = 0;
        const failedUsers = [];

        // Worker function to process a single user
        const processUser = async (username) => {
            try {
                const historyRes = await fetch(`https://civapi.duckdns.org/mc-sessions/all?mcName=${username}&mcServer=civmc`);
                
                if (!historyRes.ok) {
                    return { success: false, username };
                }

                const history = await historyRes.json();
                const logins = history.loginTimestamps || [];
                const logouts = history.logoutTimestamps || [];

                // Pair logins with their corresponding logout and sort by login time
                const sessionsArr = logins.map((login, i) => ({ login, logout: logouts[i] || null }));
                sessionsArr.sort((a, b) => (a.login || 0) - (b.login || 0));
                
                // Normalize sessions (cap per-day), filter invalid and merge overlaps so we don't double-count
                const normalized = [];
                for (const s of sessionsArr) {
                    let login = s.login;
                    let logout = s.logout;
                    if (!login) continue;
                    if (!logout || logout <= login) logout = now;
                    if (logout - login > oneDayMs) logout = login + oneDayMs;
                    if (logout <= login) continue;
                    normalized.push({ start: login, end: logout });
                }
                
                const merged = [];
                for (const s of normalized) {
                    if (merged.length === 0) {
                        merged.push({ ...s });
                        continue;
                    }
                    const last = merged[merged.length - 1];
                    if (s.start <= last.end) {
                        // overlapping or adjacent -> extend the last segment
                        last.end = Math.max(last.end, s.end);
                    } else {
                        merged.push({ ...s });
                    }
                }
                
                // Cap merged sessions to 23.8 hours max each
                const maxSessionMs = 23.8 * 3600 * 1000;
                for (const s of merged) {
                    if (s.end - s.start > maxSessionMs) {
                        s.end = s.start + maxSessionMs;
                    }
                }
                
                let weekly = 0;
                let monthly = 0;
                let allTime = 0;
                
                // Accumulate durations from merged sessions (use overlaps with week/month windows)
                for (const s of merged) {
                    const start = s.start;
                    const end = s.end;
                    const duration = end - start;
                    allTime += duration;
                    
                    const weekStart = Math.max(start, oneWeekAgo);
                    const weekEnd = Math.min(end, now);
                    if (weekEnd > weekStart) {
                        weekly += (weekEnd - weekStart);
                    }
                    
                    const monthStart = Math.max(start, oneMonthAgo);
                    const monthEnd = Math.min(end, now);
                    if (monthEnd > monthStart) {
                        monthly += (monthEnd - monthStart);
                    }
                }

                // Clamp weekly to max 23.8 hours/day * 7 days to avoid impossible weekly totals
                const WEEKLY_MAX_MS = 23.8 * 7 * 3600 * 1000;
                weekly = Math.min(weekly, WEEKLY_MAX_MS);

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