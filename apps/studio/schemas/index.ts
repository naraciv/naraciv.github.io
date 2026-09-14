import {housingListing} from './housingListing'
import {shopEntry} from './shopEntry'
import {governmentRole} from './governmentRole'
import {organization} from './organization'
import {city} from './city'

/**
 * Editable-by-a-human content only. Shop rows, head-shop rows, the leaderboard
 * and player stats stay out — they come from CSV snapshots and generated data,
 * not from anyone typing into the Studio.
 */
export const schemaTypes = [housingListing, shopEntry, city, governmentRole, organization]
