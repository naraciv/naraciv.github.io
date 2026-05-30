/**
 * Rail Pathfinder — Simple BFS graph traversal for rail route navigation.
 * 
 * Loads rail_paths.json and finds multi-leg routes between cities.
 * Used by the /homes/view detail page to show navigation directions.
 */

/**
 * Build an adjacency list graph from rail paths data.
 * Each edge is a route leg keyed by departure_city.
 */
function buildGraph(railPaths) {
    const graph = {};
    railPaths.forEach(leg => {
        const from = leg.departure_city.toLowerCase().trim();
        if (!graph[from]) graph[from] = [];
        graph[from].push(leg);
    });
    return graph;
}

/**
 * Parse a coordinate string like "x:3456, y:73, z:4822" into {x, y, z}.
 * Returns null if empty or unparseable.
 */
function parseCoordString(coordStr) {
    if (!coordStr || !coordStr.trim()) return null;
    const matches = coordStr.match(/-?\d+/g);
    if (!matches || matches.length < 2) return null;
    if (matches.length === 2) {
        return { x: parseInt(matches[0], 10), z: parseInt(matches[1], 10) };
    }
    return { x: parseInt(matches[0], 10), y: parseInt(matches[1], 10), z: parseInt(matches[2], 10) };
}

/**
 * Format coordinates for display — only x and z, in parentheses.
 * Returns empty string if no coordinates.
 */
function formatCoordsDisplay(coordStr) {
    const parsed = parseCoordString(coordStr);
    if (!parsed) return '';
    return `(${parsed.x}, ${parsed.z})`;
}

/**
 * BFS to find the shortest route (fewest legs) from originCity to destinationCity.
 * Returns an array of leg objects, or null if no route found.
 */
function findRoute(originCity, destinationCity, railPaths) {
    const graph = buildGraph(railPaths);
    const originKey = originCity.toLowerCase().trim();
    const destKey = destinationCity.toLowerCase().trim();

    // Direct match — origin IS the destination
    if (originKey === destKey) return [];

    // BFS
    const queue = [{ city: originKey, path: [] }];
    const visited = new Set([originKey]);

    while (queue.length > 0) {
        const { city, path } = queue.shift();
        const edges = graph[city] || [];

        for (const leg of edges) {
            const arrivalKey = leg.arrival_city.toLowerCase().trim();

            if (visited.has(arrivalKey)) continue;
            visited.add(arrivalKey);

            const newPath = [...path, leg];

            if (arrivalKey === destKey) {
                return newPath;
            }

            queue.push({ city: arrivalKey, path: newPath });
        }
    }

    return null; // No route found
}

/**
 * Check if a route exists from any departure city to the given destination city.
 * Returns an array of departure city names that can reach destinationCity.
 */
function getReachableDepartures(destinationCity, railPaths) {
    // Collect all unique departure cities
    const allDepartures = [...new Set(railPaths.map(leg => leg.departure_city))];
    // Also collect arrival cities that could serve as departure points
    const allCities = [...new Set([
        ...railPaths.map(leg => leg.departure_city),
        ...railPaths.map(leg => leg.arrival_city)
    ])];

    const destKey = destinationCity.toLowerCase().trim();
    const reachable = [];

    for (const city of allCities) {
        const cityKey = city.toLowerCase().trim();
        if (cityKey === destKey) continue; // Skip the destination itself

        const route = findRoute(city, destinationCity, railPaths);
        if (route !== null && route.length > 0) {
            reachable.push(city);
        }
    }

    return reachable;
}

/**
 * Generate natural language directions from an array of route legs.
 * 
 * Output examples:
 * - Single leg: "Take the Nara Line from Pavia City to Shiroyama."
 * - Multi leg: "First, take the Nara Line from Pavia City to Shiroyama. 
 *               Next, take the Nara Overland Rail (3456, 4822) to Orakuru (3826, 6984) using /dest Orakuru."
 */
function generateDirections(legs) {
    if (!legs || legs.length === 0) return '';

    const parts = [];

    legs.forEach((leg, index) => {
        const isFirst = index === 0;
        const isOnly = legs.length === 1;

        // Build line name with departure coordinates if they exist
        const depCoords = formatCoordsDisplay(leg.departure_coordinates);
        const arrCoords = formatCoordsDisplay(leg.arrival_coordinates);

        let linePart = leg.line_name;
        if (depCoords) {
            linePart += ` <strong>${depCoords}</strong>`;
        }

        let arrivalPart = leg.arrival_city;
        if (arrCoords) {
            arrivalPart += ` <strong>${arrCoords}</strong>`;
        }

        // Dest command
        let destPart = '';
        if (leg.dest_command && leg.dest_command.trim()) {
            destPart = ` using <strong>${leg.dest_command}</strong>`;
        }

        // Prefix
        let prefix = '';
        if (isOnly) {
            prefix = 'Take';
        } else if (isFirst) {
            prefix = 'First, take';
        } else {
            prefix = 'Next, take';
        }

        const sentence = `${prefix} the ${linePart} from ${leg.departure_city} to ${arrivalPart}${destPart}.`;
        parts.push(sentence);
    });

    return parts.join(' ');
}

// Export for use as a module or global
if (typeof window !== 'undefined') {
    window.RailPathfinder = {
        findRoute,
        getReachableDepartures,
        generateDirections,
        parseCoordString,
        formatCoordsDisplay
    };
}
