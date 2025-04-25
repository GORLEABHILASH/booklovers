// src/services/bookDataService.js
import neo4jService from './neo4jService';

class BookDataService {
  // Helper function to convert Neo4j Integer or BigInt to JS number
  toNumber(value) {
    if (value === null || value === undefined) {
      return 0;
    }
    
    // Convert Neo4j Integer objects
    if (typeof value === 'object' && 'low' in value && 'high' in value) {
      return value.low;
    }
    
    // Convert BigInt values
    if (typeof value === 'bigint') {
      return Number(value);
    }
    
    // Ensure string numbers are converted to actual numbers
    if (typeof value === 'string' && !isNaN(value)) {
      return Number(value);
    }
    
    return value;
  }

  // Get currently reading books for a user with accurate progress information
  async getCurrentlyReadingBooks(userId) {
    const query = `
      MATCH (u:USER {id: $userId})-[r:READING]->(b:BOOK)
      OPTIONAL MATCH (b)<-[:WROTE]-(a:AUTHOR)
      OPTIONAL MATCH (b)-[:BELONGS_TO]->(g:GENRE)
      RETURN b, a, 
        r.currentPage as currentPage, 
        r.percentComplete as percentComplete,
        r.lastUpdated as lastUpdated,
        collect(DISTINCT g.name) as genres
      ORDER BY r.lastUpdated DESC
      LIMIT 5
    `;
    
    const result = await neo4jService.executeQuery(query, { userId });
    
    return result.map(record => {
      const book = record.get('b').properties;
      const author = record.get('a') ? record.get('a').properties : null;
      const currentPage = this.toNumber(record.get('currentPage')) || 1;
      const percentComplete = this.toNumber(record.get('percentComplete')) || 0;
      const genres = record.get('genres') || [];
      const lastUpdated = record.get('lastUpdated');
      
      return {
        ...book,
        id: book.id,
        title: book.title,
        author: author ? author.name : 'Unknown Author',
        genres: genres.slice(0, 2),
        currentPage,
        progress: Math.round(percentComplete),
        lastUpdated
      };
    });
  }
  
  // Get trending books in genres the user prefers
  async getTrendingBooksInUserGenres(userId) {
    const query = `
      // Find genres the user has preference for
      MATCH (u:USER {id: $userId})-[:PREFERS_GENRE]->(g:GENRE)
      
      // Find books in those genres
      MATCH (b:BOOK)-[:BELONGS_TO]->(g)
      
      // Find users who have interacted with those books recently
      MATCH (otherUser:USER)-[r:RATES|READING]->(b)
      WHERE r.timestamp > datetime() - duration('P30D')
      OR r.lastUpdated > datetime() - duration('P30D')
      
      // Get book details
      WITH b, count(otherUser) as readerCount, g, collect(g.name) as genres
      MATCH (b)<-[:WROTE]-(a:AUTHOR)
      
      // Aggregate and return results
      RETURN b, a, collect(DISTINCT g.name) as genres, readerCount
      ORDER BY readerCount DESC
      LIMIT 4
    `;
    
    const result = await neo4jService.executeQuery(query, { userId });
    
    return result.map(record => {
      const book = record.get('b').properties;
      const author = record.get('a') ? record.get('a').properties : null;
      const genres = record.get('genres') || [];
      const readers = this.toNumber(record.get('readerCount'));
      
      return {
        ...book,
        id: book.id,
        title: book.title,
        author: author ? author.name : 'Unknown Author',
        genres: genres.slice(0, 2),
        readers
      };
    });
  }
  
  // Modified getSocialMediaTrending method with less restrictive timestamp filter
// Fixed getSocialMediaTrending method - resolving the Neo4j query error
async getSocialMediaTrending() {
  const query = `
    // Find books that have been mentioned in posts
    MATCH (p:POST)-[:ABOUT]->(b:BOOK)
    
    // Count comments on these posts
    OPTIONAL MATCH (p)<-[:ON]-(c:COMMENT)
    
    // Group by book and count interactions
    WITH b, count(DISTINCT p) as postCount, 
         count(DISTINCT c) as commentCount, 
         sum(coalesce(p.likes, 0)) as likeCount
    
    // Calculate a social score 
    WITH b, postCount, commentCount, likeCount,
         postCount + commentCount + likeCount as socialScore
    
    // Get book details
    MATCH (b)<-[:WROTE]-(a:AUTHOR)
    OPTIONAL MATCH (b)-[:BELONGS_TO]->(g:GENRE)
    
    // Count current readers
    OPTIONAL MATCH (u:USER)-[:READING]->(b)
    
    // Return with all metrics
    RETURN b, a, collect(DISTINCT g.name) as genres, 
           count(u) as readers,
           postCount, commentCount, likeCount, socialScore
    ORDER BY socialScore DESC
    LIMIT 4
  `;
  
  const result = await neo4jService.executeQuery(query);
  
  return result.map(record => {
    const book = record.get('b').properties;
    const author = record.get('a') ? record.get('a').properties : null;
    const genres = record.get('genres') || [];
    const readers = this.toNumber(record.get('readers'));
    const postCount = this.toNumber(record.get('postCount'));
    const commentCount = this.toNumber(record.get('commentCount'));
    const likeCount = this.toNumber(record.get('likeCount'));
    
    return {
      ...book,
      id: book.id,
      title: book.title,
      author: author ? author.name : 'Unknown Author',
      genres: genres.slice(0, 2),
      readers,
      socialStats: {
        posts: postCount,
        comments: commentCount,
        likes: likeCount
      }
    };
  });
}

// Fixed getBookClubTrending method - ensuring correct query structure
async getBookClubTrending() {
  const query = `
    // Find books featured in book clubs
    MATCH (bc:BOOK_CLUB)-[f:FEATURED]->(b:BOOK)
    
    // Group by book and count featuring book clubs
    WITH b, count(DISTINCT bc) as clubCount, 
         avg(coalesce(f.rating, 4.0)) as avgRating
    
    // Get book details
    MATCH (b)<-[:WROTE]-(a:AUTHOR)
    OPTIONAL MATCH (b)-[:BELONGS_TO]->(g:GENRE)
    
    // Count current readers
    OPTIONAL MATCH (u:USER)-[:READING]->(b)
    
    // Return with all metrics
    RETURN b, a, collect(DISTINCT g.name) as genres, 
           count(u) as readers,
           clubCount, avgRating
    ORDER BY clubCount DESC
    LIMIT 4
  `;
  
  const result = await neo4jService.executeQuery(query);
  
  return result.map(record => {
    const book = record.get('b').properties;
    const author = record.get('a') ? record.get('a').properties : null;
    const genres = record.get('genres') || [];
    const readers = this.toNumber(record.get('readers'));
    const clubCount = this.toNumber(record.get('clubCount'));
    const avgRating = this.toNumber(record.get('avgRating'));
    
    return {
      ...book,
      id: book.id,
      title: book.title,
      author: author ? author.name : 'Unknown Author',
      genres: genres.slice(0, 2),
      readers,
      clubStats: {
        clubCount,
        avgRating: Math.round(avgRating * 10) / 10
      }
    };
  });
}
  
  // Get trending books in the user's location
  async getLocalTrending(userId) {
    const query = `
      // Find the user's location
      MATCH (u:USER {id: $userId})-[:LIVES_IN]->(userCity:CITY)-[:PART_OF]->(userState:STATE)
      
      // Find other users in the same state
      MATCH (otherUser:USER)-[:LIVES_IN]->(otherCity:CITY)-[:PART_OF]->(userState)
      
      // Find books these users are reading
      MATCH (otherUser)-[r:RATES|READING]->(b:BOOK)
      WHERE r.timestamp > datetime() - duration('P30D')
      OR r.lastUpdated > datetime() - duration('P30D')
      
      // Group by book and count local readers
      WITH b, userCity.name as cityName, userState.name as stateName,
           count(DISTINCT otherUser) as localReaderCount
      
      // Get book details
      MATCH (b)<-[:WROTE]-(a:AUTHOR)
      OPTIONAL MATCH (b)-[:BELONGS_TO]->(g:GENRE)
      
      // Return with all metrics
      RETURN b, a, collect(DISTINCT g.name) as genres, 
             localReaderCount as readers,
             cityName, stateName
      ORDER BY localReaderCount DESC
      LIMIT 4
    `;
    
    const result = await neo4jService.executeQuery(query, { userId });
    
    return result.map(record => {
      const book = record.get('b').properties;
      const author = record.get('a') ? record.get('a').properties : null;
      const genres = record.get('genres') || [];
      const readers = this.toNumber(record.get('readers'));
      const cityName = record.get('cityName');
      const stateName = record.get('stateName');
      
      return {
        ...book,
        id: book.id,
        title: book.title,
        author: author ? author.name : 'Unknown Author',
        genres: genres.slice(0, 2),
        readers,
        locationStats: {
          location: cityName,
          state: stateName
        }
      };
    });
  }
  
 // Updated BookDataService with filtered recommendation methods

// Get book recommendations based on filter type
async getBookRecommendations(userId, filterType = 'similar') {
  // Select the appropriate query based on filter type
  switch(filterType) {
    case 'similar':
      return this.getSimilarUserRecommendations(userId);
    case 'friends': 
      return this.getFriendsActivityRecommendations(userId);
    case 'profession':
      return this.getProfessionBasedRecommendations(userId);
    default:
      return this.getSimilarUserRecommendations(userId);
  }
}

// Get recommendations based on similar users' preferences
// Get recommendations based on similar users with relaxed criteria
async getSimilarUserRecommendations(userId) {
  const query = `
    // Find all users except the current user
    MATCH (u:USER {id: $userId})
    MATCH (similarUser:USER)
    WHERE u <> similarUser
    
    // Look for any genre overlap
    OPTIONAL MATCH (u)-[:PREFERS_GENRE]->(g:GENRE)<-[:PREFERS_GENRE]-(similarUser)
    WITH similarUser, count(g) as genreOverlap, u
    
    // Find books rated by these users
    MATCH (similarUser)-[r:RATES]->(b:BOOK)
    
    // Make sure user hasn't already rated the book (keep this restriction)
    WHERE NOT EXISTS {
      MATCH (u)-[:RATES|READING]->(b)
    }
    
    // Get book details
    WITH b, max(genreOverlap) as maxSimilarity, avg(r.rating) as avgRating
    MATCH (b)<-[:WROTE]-(a:AUTHOR)
    OPTIONAL MATCH (b)-[:BELONGS_TO]->(g:GENRE)
    
    // Return results
    RETURN b, a, collect(DISTINCT g.name) as genres,
           CASE 
             WHEN maxSimilarity > 0 THEN maxSimilarity * 10 + avgRating * 5
             ELSE avgRating * 10
           END as matchScore
    ORDER BY matchScore DESC
    LIMIT 10
  `;
  
  const result = await neo4jService.executeQuery(query, { userId });
  
  return result.map(record => {
    const book = record.get('b').properties;
    const author = record.get('a') ? record.get('a').properties : null;
    const genres = record.get('genres') || [];
    const matchScore = this.toNumber(record.get('matchScore'));
    
    return {
      ...book,
      id: book.id,
      title: book.title,
      author: author ? author.name : 'Unknown Author',
      genres: genres.slice(0, 2),
      matchPercent: Math.min(Math.round(matchScore), 99),
      similarityReason: true
    };
  });
}

// Get recommendations based on profession with relaxed criteria

// Get recommendations based on friends' reading activity
async getFriendsActivityRecommendations(userId) {
  const query = `
    // Find direct friends
    MATCH (u:USER {id: $userId})-[:FRIEND]->(friend:USER)
    
    // Find books friends are reading or have rated highly
    MATCH (friend)-[r:RATES|READING]->(b:BOOK)
    WHERE (r:RATES AND r.rating >= 4) OR r:READING
    
    // Make sure user hasn't already rated the book
    AND NOT EXISTS {
      MATCH (u)-[:RATES|READING]->(b)
    }
    
    // Count how many friends are reading each book
    WITH b, count(friend) as friendCount, collect(friend.name) as friendNames
    
    // Get book details
    MATCH (b)<-[:WROTE]-(a:AUTHOR)
    OPTIONAL MATCH (b)-[:BELONGS_TO]->(g:GENRE)
    
    // Calculate match score based on friend count
    RETURN b, a, collect(DISTINCT g.name) as genres,
           friendCount, 
           friendNames[0] as topFriendName,
           CASE
             WHEN friendCount > 3 THEN friendCount * 25
             ELSE friendCount * 20
           END as matchScore
    ORDER BY matchScore DESC
    LIMIT 10
  `;
  
  const result = await neo4jService.executeQuery(query, { userId });
  
  return result.map(record => {
    const book = record.get('b').properties;
    const author = record.get('a') ? record.get('a').properties : null;
    const genres = record.get('genres') || [];
    const matchScore = this.toNumber(record.get('matchScore'));
    const friendCount = this.toNumber(record.get('friendCount'));
    const topFriendName = record.get('topFriendName');
    
    const friendName = topFriendName ? topFriendName.split(' ')[0] : null;
    const friendReason = friendCount > 1 
      ? `${friendName} and ${friendCount-1} others are reading`
      : friendName 
        ? `${friendName} is reading` 
        : 'Friend recommendation';
    
    return {
      ...book,
      id: book.id,
      title: book.title,
      author: author ? author.name : 'Unknown Author',
      genres: genres.slice(0, 2),
      matchPercent: Math.min(Math.round(matchScore), 99),
      friendReason
    };
  });
}

// Get recommendations based on profession
async getProfessionBasedRecommendations(userId) {
  const query = `
    // Get all books rated by any user
    MATCH (u:USER {id: $userId})
    MATCH (otherUser:USER)-[r:RATES]->(b:BOOK)
    WHERE u <> otherUser
    
    // Add a check for profession similarity if it exists
    WITH u, otherUser, b, r,
         CASE WHEN u.profession IS NOT NULL AND u.profession = otherUser.profession 
              THEN 3 ELSE 1 END as professionBoost
    
    // Make sure user hasn't already rated the book
    WHERE NOT EXISTS {
      MATCH (u)-[:RATES|READING]->(b)
    }
    
    // Group by book and calculate score
    WITH b, count(otherUser) as readerCount, avg(r.rating) as avgRating, max(professionBoost) as maxBoost
    
    // Get book details
    MATCH (b)<-[:WROTE]-(a:AUTHOR)
    OPTIONAL MATCH (b)-[:BELONGS_TO]->(g:GENRE)
    
    // Calculate match score with profession boost
    RETURN b, a, collect(DISTINCT g.name) as genres,
           readerCount * avgRating * maxBoost as matchScore
    ORDER BY matchScore DESC
    LIMIT 10
  `;
  
  const result = await neo4jService.executeQuery(query, { userId });
  
  return result.map(record => {
    const book = record.get('b').properties;
    const author = record.get('a') ? record.get('a').properties : null;
    const genres = record.get('genres') || [];
    const matchScore = this.toNumber(record.get('matchScore'));
    
    return {
      ...book,
      id: book.id,
      title: book.title,
      author: author ? author.name : 'Unknown Author',
      genres: genres.slice(0, 2),
      matchPercent: Math.min(Math.round(matchScore), 99),
      professionReason: true
    };
  });
}
  // Get upcoming events
  async getUpcomingEvents(userId) {
    const query = `
      MATCH (u:USER {id: $userId})-[:LIVES_IN]->(:CITY)-[:PART_OF]->(s:STATE)
      MATCH (e:EVENT)-[:LOCATED_IN]->(:CITY)-[:PART_OF]->(s)
      WHERE e.date > datetime()
      
      OPTIONAL MATCH (e)-[:FEATURES]->(b:BOOK)<-[:RATES]-(u)
      WITH u, e, count(b) as readRelevantBooks
      
      OPTIONAL MATCH (u)-[:FRIEND]->(f:USER)-[:ATTENDED]->(e)
      OPTIONAL MATCH (e)-[:LOCATED_IN]->(c:CITY)
      
      RETURN e, count(f) as friendsAttending, c.name as cityName
      ORDER BY e.date ASC
      LIMIT 1
    `;
    
    const result = await neo4jService.executeQuery(query, { userId });
    
    return result.map(record => {
      const event = record.get('e').properties;
      const friendsAttending = this.toNumber(record.get('friendsAttending'));
      const cityName = record.get('cityName');
      
      return {
        ...event,
        friendsAttending,
        location: cityName
      };
    });
  }
  
  // Get recently added books
  async getRecentlyAddedBooks() {
    const query = `
      MATCH (b:BOOK)
      WHERE b.publishedYear IS NOT NULL AND b.publishedYear >= 2023
      RETURN b
      ORDER BY b.publishedYear DESC
      LIMIT 2
    `;
    
    const result = await neo4jService.executeQuery(query);
    
    return result.map(record => {
      const book = record.get('b').properties;
      return {
        ...book,
        daysAgo: 2 // In a real app, this would be calculated from creation date
      };
    });
  }
  
  // Get book adaptations
  async getBookAdaptations(userId) {
    const query = `
      MATCH (m:MOVIE)-[:ADAPTED_FROM]->(b:BOOK)
      OPTIONAL MATCH (u:USER {id: $userId})-[:RATES]->(b)
      RETURN m, b, exists((u)-[:RATES]->(b)) as hasRead
      ORDER BY m.releaseYear DESC
      LIMIT 1
    `;
    
    const result = await neo4jService.executeQuery(query, { userId });
    
    return result.map(record => {
      const movie = record.get('m').properties;
      const book = record.get('b').properties;
      const hasRead = record.get('hasRead');
      
      return {
        ...movie,
        bookTitle: book.title,
        hasRead
      };
    });
  }

  // Get user's reading session stats per book
  async getBookReadingSessionStats(userId, bookId) {
    const query = `
      MATCH (u:USER {id: $userId})-[:HAS_SESSION]->(rs:READING_SESSION)-[:FOR_BOOK]->(b:BOOK {id: $bookId})
      WHERE rs.active = false
      RETURN count(rs) as sessionCount,
             sum(rs.duration) as totalReadingMinutes,
             sum(rs.pagesRead) as totalPagesRead,
             avg(rs.duration) as avgSessionDuration
    `;
    
    const result = await neo4jService.executeQuery(query, { userId, bookId });
    
    if (result.length === 0) {
      return {
        sessionCount: 0,
        totalReadingMinutes: 0,
        totalPagesRead: 0,
        avgSessionDuration: 0
      };
    }
    
    return {
      sessionCount: this.toNumber(result[0].get('sessionCount')),
      totalReadingMinutes: this.toNumber(result[0].get('totalReadingMinutes')),
      totalPagesRead: this.toNumber(result[0].get('totalPagesRead')),
      avgSessionDuration: this.toNumber(result[0].get('avgSessionDuration'))
    };
  }
}

export default new BookDataService();