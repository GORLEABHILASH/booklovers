// src/services/bookService.js
import neo4jService from './neo4jService';

class BookService {
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

  async getBookById(id) {
    const query = `
      MATCH (b:BOOK {id: $id})
      OPTIONAL MATCH (b)<-[:WROTE]-(a:AUTHOR)
      OPTIONAL MATCH (b)-[:BELONGS_TO]->(g:GENRE)
      
      WITH b, a, collect(g.name) as genres
      
      OPTIONAL MATCH (u:USER)-[r:RATES]->(b)
      WITH b, a, genres, avg(r.rating) as avgRating, count(r) as ratingsCount
      
      OPTIONAL MATCH (u:USER)-[:READING]->(b)
      WITH b, a, genres, avgRating, ratingsCount, count(u) as readersCount
      
      OPTIONAL MATCH (u:USER)-[:FINISHED]->(b)
      WITH b, a, genres, avgRating, ratingsCount, readersCount, count(u) as finishedCount
      
      OPTIONAL MATCH (b)-[:ADAPTED_TO]->(m:MOVIE)
      WITH b, a, genres, avgRating, ratingsCount, readersCount, finishedCount, collect(m) as adaptations
      
      RETURN b, a, 
        genres, 
        avgRating, 
        ratingsCount, 
        readersCount, 
        finishedCount,
        adaptations
    `;
    
    const result = await neo4jService.executeQuery(query, { id });
    
    if (result.length === 0) {
      return null;
    }
    
    const record = result[0];
    const book = record.get('b').properties;
    const author = record.get('a')?.properties;
    const genres = record.get('genres');
    const avgRating = record.get('avgRating');
    const ratingsCount = this.toNumber(record.get('ratingsCount'));
    const readersCount = this.toNumber(record.get('readersCount'));
    const finishedCount = this.toNumber(record.get('finishedCount'));
    const adaptations = record.get('adaptations').map(m => m.properties);
    
    // Get friends reading this book
    const friendsQuery = `
      MATCH (u:USER {id: $userId})-[:FRIEND]->(friend:USER)-[r:READING|FINISHED|WANTS_TO_READ]->(b:BOOK {id: $bookId})
      RETURN friend, type(r) as status
      LIMIT 5
    `;
    
    const friendsResult = await neo4jService.executeQuery(friendsQuery, { 
      userId: "USER-1", // Using a default user ID
      bookId: id 
    });
    
    const friendsReading = friendsResult.map(record => {
      const friend = record.get('friend').properties;
      const status = record.get('status').toLowerCase();
      return { ...friend, status };
    });
    
    // Get similar books
    const similarBooksQuery = `
      MATCH (b:BOOK {id: $id})-[:BELONGS_TO]->(g:GENRE)<-[:BELONGS_TO]-(similar:BOOK)
      WHERE similar.id <> $id
      WITH similar, count(g) as genreOverlap
      
      OPTIONAL MATCH (similar)<-[:WROTE]-(a:AUTHOR)
      
      RETURN similar, a.name as authorName, genreOverlap
      ORDER BY genreOverlap DESC
      LIMIT 4
    `;
    
    const similarBooksResult = await neo4jService.executeQuery(similarBooksQuery, { id });
    
    const similarBooks = similarBooksResult.map(record => {
      const similar = record.get('similar').properties;
      const authorName = record.get('authorName');
      return { ...similar, author: authorName };
    });
    
    return {
      ...book,
      author: author?.name,
      authorId: author?.id,
      genres,
      averageRating: avgRating,
      ratingsCount,
      readersCount,
      finishedCount,
      adaptations,
      friendsReading,
      similarBooks
    };
  }
  
  async getUserBookStatus(userId, bookId) {
    const query = `
      MATCH (u:USER {id: $userId}), (b:BOOK {id: $bookId})
      
      OPTIONAL MATCH (u)-[reading:READING]->(b)
      OPTIONAL MATCH (u)-[finished:FINISHED]->(b)
      OPTIONAL MATCH (u)-[wantToRead:WANTS_TO_READ]->(b)
      OPTIONAL MATCH (u)-[r:RATES]->(b)
      
      RETURN 
        CASE
          WHEN reading IS NOT NULL THEN 'reading'
          WHEN finished IS NOT NULL THEN 'finished'
          WHEN wantToRead IS NOT NULL THEN 'want-to-read'
          ELSE 'none'
        END as status,
        r.rating as rating,
        reading.currentPage as currentPage,
        reading.percentComplete as percentComplete
    `;
    
    const result = await neo4jService.executeQuery(query, { userId, bookId });
    
    if (result.length === 0) {
      return { status: 'none', rating: 0 };
    }
    
    const status = result[0].get('status');
    const rating = result[0].get('rating');
    const currentPage = this.toNumber(result[0].get('currentPage'));
    const percentComplete = this.toNumber(result[0].get('percentComplete'));
    
    return { 
      status, 
      rating: rating || 0,
      currentPage: currentPage || 1,
      percentComplete: percentComplete || 0
    };
  }
  
  async updateUserBookStatus(userId, bookId, status, currentPage = null) {
    // First remove any existing status relationships
    const removeQuery = `
      MATCH (u:USER {id: $userId})-[r:READING|FINISHED|WANTS_TO_READ]->(b:BOOK {id: $bookId})
      DELETE r
    `;
    
    await neo4jService.executeQuery(removeQuery, { userId, bookId });
    
    // Then add the new status relationship
    let relationshipType;
    let additionalProperties = '';
    
    switch (status) {
      case 'reading':
        relationshipType = 'READING';
        if (currentPage) {
          additionalProperties = `, currentPage: $currentPage`;
        }
        break;
      case 'finished':
        relationshipType = 'FINISHED';
        break;
      case 'want-to-read':
        relationshipType = 'WANTS_TO_READ';
        break;
      default:
        return; // No relationship to create
    }
    
    const createQuery = `
      MATCH (u:USER {id: $userId}), (b:BOOK {id: $bookId})
      CREATE (u)-[:${relationshipType} {date: datetime()${additionalProperties}}]->(b)
    `;
    
    await neo4jService.executeQuery(createQuery, { userId, bookId, currentPage });
    
    // Add a history entry
    const historyQuery = `
      MATCH (u:USER {id: $userId}), (b:BOOK {id: $bookId})
      MERGE (u)-[:HAS_HISTORY]->(rh:READING_HISTORY {id: "RH-" + u.id + "-" + b.id})
      
      WITH u, b, rh
      
      CREATE (he:HISTORY_ENTRY {
        id: "ENTRY-" + apoc.create.uuid(),
        action: $action,
        timestamp: datetime(),
        context: "app"
        ${currentPage ? ', currentPage: $currentPage' : ''}
      })
      
      CREATE (rh)-[:CONTAINS_ENTRY]->(he)
      CREATE (he)-[:REFERENCES_BOOK]->(b)
    `;
    
    let action;
    switch (status) {
      case 'reading':
        action = 'started';
        break;
      case 'finished':
        action = 'finished';
        break;
      case 'want-to-read':
        action = 'want-to-read';
        break;
      default:
        action = 'none';
    }
    
    await neo4jService.executeQuery(historyQuery, { userId, bookId, action, currentPage });
    
    return { status };
  }
  
  async rateBook(userId, bookId, rating) {
    const query = `
      MATCH (u:USER {id: $userId}), (b:BOOK {id: $bookId})
      
      MERGE (u)-[r:RATES]->(b)
      ON CREATE SET r.rating = $rating, r.timestamp = datetime()
      ON MATCH SET r.rating = $rating, r.timestamp = datetime()
      
      RETURN r.rating as rating
    `;
    
    const result = await neo4jService.executeQuery(query, { userId, bookId, rating });
    
    return result[0].get('rating');
  }

  // New method to get a user's review for a book
  async getUserBookReview(userId, bookId) {
    const query = `
      MATCH (u:USER {id: $userId})-[r:REVIEWS]->(b:BOOK {id: $bookId})
      RETURN r.content as review
    `;
    
    const result = await neo4jService.executeQuery(query, { userId, bookId });
    
    if (result.length === 0) {
      return null;
    }
    
    return result[0].get('review');
  }
  
  // New method to add or update a review
  async reviewBook(userId, bookId, reviewContent) {
    if (!reviewContent || reviewContent.trim() === '') {
      // If review is empty, delete any existing review
      const deleteQuery = `
        MATCH (u:USER {id: $userId})-[r:REVIEWS]->(b:BOOK {id: $bookId})
        DELETE r
      `;
      
      await neo4jService.executeQuery(deleteQuery, { userId, bookId });
      return null;
    }
    
    // Otherwise, create or update the review
    const query = `
      MATCH (u:USER {id: $userId}), (b:BOOK {id: $bookId})
      
      MERGE (u)-[r:REVIEWS]->(b)
      ON CREATE SET 
        r.content = $content, 
        r.createdAt = datetime(), 
        r.updatedAt = datetime()
      ON MATCH SET 
        r.content = $content, 
        r.updatedAt = datetime()
      
      RETURN r.content as review
    `;
    
    const result = await neo4jService.executeQuery(query, { 
      userId, 
      bookId, 
      content: reviewContent 
    });
    
    // Also create a history entry for the review
    const historyQuery = `
      MATCH (u:USER {id: $userId}), (b:BOOK {id: $bookId})
      MERGE (u)-[:HAS_HISTORY]->(rh:READING_HISTORY {id: "RH-" + u.id + "-" + b.id})
      
      WITH u, b, rh
      
      CREATE (he:HISTORY_ENTRY {
        id: "ENTRY-" + apoc.create.uuid(),
        action: "reviewed",
        timestamp: datetime(),
        context: "app",
        content: $content
      })
      
      CREATE (rh)-[:CONTAINS_ENTRY]->(he)
      CREATE (he)-[:REFERENCES_BOOK]->(b)
    `;
    
    await neo4jService.executeQuery(historyQuery, { 
      userId, 
      bookId, 
      content: reviewContent.substring(0, 100) + (reviewContent.length > 100 ? "..." : "") 
    });
    
    return result[0].get('review');
  }

  // Start a reading session
  async startReadingSession(userId, bookId, startPage) {
    try {
      const query = `
        MATCH (u:USER {id: $userId}), (b:BOOK {id: $bookId})
        CREATE (rs:READING_SESSION {
          id: "RS-" + apoc.create.uuid(),
          startPage: $startPage,
          startTime: datetime(),
          active: true
        })
        CREATE (u)-[:HAS_SESSION]->(rs)
        CREATE (rs)-[:FOR_BOOK]->(b)
        
        // Also ensure the book is marked as "reading" for the user
        MERGE (u)-[r:READING]->(b)
        ON CREATE SET r.startDate = datetime(), r.currentPage = $startPage
        ON MATCH SET r.currentPage = $startPage, r.lastUpdated = datetime()
        
        RETURN rs.id as sessionId
      `;
      
      const result = await neo4jService.executeQuery(query, { 
        userId, 
        bookId,
        startPage
      });
      
      return result.length > 0 ? result[0].get('sessionId') : null;
    } catch (error) {
      console.error('Error starting reading session:', error);
      throw error;
    }
  }

  // End an active reading session
  async endReadingSession(sessionId, endPage, notes = null) {
    try {
      const query = `
        MATCH (rs:READING_SESSION {id: $sessionId})
        WHERE rs.active = true
        SET rs.endPage = $endPage,
            rs.endTime = datetime(),
            rs.duration = duration.between(rs.startTime, datetime()).minutes,
            rs.pagesRead = $endPage - rs.startPage,
            rs.notes = $notes,
            rs.active = false
        
        WITH rs
        MATCH (rs)-[:FOR_BOOK]->(b:BOOK)
        MATCH (u:USER)-[:HAS_SESSION]->(rs)
        
        // Update the overall READING relationship with current progress
        MATCH (u)-[r:READING]->(b)
        SET r.currentPage = $endPage,
            r.lastUpdated = datetime(),
            r.percentComplete = CASE 
              WHEN b.pageCount > 0 THEN (100.0 * $endPage / b.pageCount) 
              ELSE 0 
            END
        
        // Create a progress history entry
        WITH u, b, rs, r
        MERGE (u)-[:HAS_HISTORY]->(rh:READING_HISTORY)
        CREATE (he:HISTORY_ENTRY {
          id: "ENTRY-" + apoc.create.uuid(),
          action: "progress-update",
          timestamp: datetime(),
          fromPage: rs.startPage,
          toPage: $endPage,
          duration: rs.duration,
          notes: $notes
        })
        CREATE (rh)-[:CONTAINS_ENTRY]->(he)
        CREATE (he)-[:REFERENCES_BOOK]->(b)
        
        RETURN rs.id as sessionId,
               rs.startPage as startPage,
               rs.endPage as endPage,
               rs.duration as duration,
               r.percentComplete as percentComplete
      `;
      
      const result = await neo4jService.executeQuery(query, { 
        sessionId, 
        endPage,
        notes
      });
      
      if (result.length === 0) {
        throw new Error('Failed to end reading session');
      }
      
      return {
        sessionId: result[0].get('sessionId'),
        startPage: this.toNumber(result[0].get('startPage')),
        endPage: this.toNumber(result[0].get('endPage')),
        duration: result[0].get('duration').minutes || 0,
        percentComplete: this.toNumber(result[0].get('percentComplete'))
      };
    } catch (error) {
      console.error('Error ending reading session:', error);
      throw error;
    }
  }

  // Get user's active reading session if any
  async getActiveReadingSession(userId, bookId = null) {
    try {
      let query;
      let params;
      
      if (bookId) {
        // Get active session for specific book
        query = `
          MATCH (u:USER {id: $userId})-[:HAS_SESSION]->(rs:READING_SESSION {active: true})-[:FOR_BOOK]->(b:BOOK {id: $bookId})
          RETURN rs.id as sessionId,
                rs.startPage as startPage,
                rs.startTime as startTime,
                b.id as bookId,
                b.title as bookTitle,
                b.author as bookAuthor,
                b.coverImage as bookCover,
                duration.between(rs.startTime, datetime()).minutes as currentDuration
        `;
        params = { userId, bookId };
      } else {
        // Get any active session
        query = `
          MATCH (u:USER {id: $userId})-[:HAS_SESSION]->(rs:READING_SESSION {active: true})-[:FOR_BOOK]->(b:BOOK)
          RETURN rs.id as sessionId,
                rs.startPage as startPage,
                rs.startTime as startTime,
                b.id as bookId,
                b.title as bookTitle,
                b.author as bookAuthor,
                b.coverImage as bookCover,
                duration.between(rs.startTime, datetime()).minutes as currentDuration
        `;
        params = { userId };
      }
      
      const result = await neo4jService.executeQuery(query, params);
      
      if (result.length === 0) {
        return null;
      }
      
      return {
        sessionId: result[0].get('sessionId'),
        startPage: this.toNumber(result[0].get('startPage')),
        startTime: result[0].get('startTime'),
        currentDuration: this.toNumber(result[0].get('currentDuration')),
        book: {
          id: result[0].get('bookId'),
          title: result[0].get('bookTitle'),
          author: result[0].get('bookAuthor'),
          coverImage: result[0].get('bookCover')
        }
      };
    } catch (error) {
      console.error('Error getting active reading session:', error);
      return null;
    }
  }

  // Get user's reading sessions for a specific book
  async getBookReadingSessions(userId, bookId) {
    try {
      const query = `
        MATCH (u:USER {id: $userId})-[:HAS_SESSION]->(rs:READING_SESSION)-[:FOR_BOOK]->(b:BOOK {id: $bookId})
        WHERE rs.active = false
        RETURN rs.id as sessionId,
              rs.startPage as startPage,
              rs.endPage as endPage,
              rs.startTime as startTime,
              rs.endTime as endTime,
              rs.duration as duration,
              rs.pagesRead as pagesRead,
              rs.notes as notes
        ORDER BY rs.endTime DESC
      `;
      
      const result = await neo4jService.executeQuery(query, { userId, bookId });
      
      return result.map(record => ({
        sessionId: record.get('sessionId'),
        startPage: this.toNumber(record.get('startPage')),
        endPage: this.toNumber(record.get('endPage')),
        startTime: record.get('startTime'),
        endTime: record.get('endTime'),
        duration: this.toNumber(record.get('duration')),
        pagesRead: this.toNumber(record.get('pagesRead')),
        notes: record.get('notes')
      }));
    } catch (error) {
      console.error('Error getting book reading sessions:', error);
      return [];
    }
  }

  // Update current page for a book (without ending session)
  async updateCurrentPage(userId, bookId, currentPage) {
    try {
      const query = `
        MATCH (u:USER {id: $userId})-[r:READING]->(b:BOOK {id: $bookId})
        SET r.currentPage = $currentPage,
            r.lastUpdated = datetime(),
            r.percentComplete = CASE 
              WHEN b.pageCount > 0 THEN (100.0 * $currentPage / b.pageCount) 
              ELSE 0 
            END
        RETURN r.currentPage as currentPage, r.percentComplete as percentComplete
      `;
      
      const result = await neo4jService.executeQuery(query, { userId, bookId, currentPage });
      
      if (result.length === 0) {
        throw new Error('Book not found or user is not reading it');
      }
      
      return {
        currentPage: this.toNumber(result[0].get('currentPage')),
        percentComplete: this.toNumber(result[0].get('percentComplete'))
      };
    } catch (error) {
      console.error('Error updating current page:', error);
      throw error;
    }
  }

  // Get reading statistics for a book
  async getBookReadingStats(bookId) {
    try {
      const query = `
        MATCH (b:BOOK {id: $bookId})
        
        // Reading sessions stats
        OPTIONAL MATCH (b)<-[:FOR_BOOK]-(rs:READING_SESSION)
        WHERE rs.active = false
        
        WITH b, count(rs) as sessionCount,
          avg(rs.duration) as avgSessionDuration,
          avg(rs.pagesRead) as avgPagesPerSession
        
        // Avg time to finish
        OPTIONAL MATCH (u:USER)-[:HAS_SESSION]->(rs1:READING_SESSION)-[:FOR_BOOK]->(b)
        WHERE rs1.active = false
        WITH u, b, sessionCount, avgSessionDuration, avgPagesPerSession, min(rs1.startTime) as firstSessionTime
        
        OPTIONAL MATCH (u)-[:HAS_SESSION]->(rs2:READING_SESSION)-[:FOR_BOOK]->(b)
        WHERE rs2.active = false
        WITH u, b, sessionCount, avgSessionDuration, avgPagesPerSession, firstSessionTime, max(rs2.endTime) as lastSessionTime
        
        WITH b, sessionCount, avgSessionDuration, avgPagesPerSession,
          avg(duration.between(firstSessionTime, lastSessionTime).days) as avgDaysToFinish
        
        RETURN 
          sessionCount,
          avgSessionDuration,
          avgPagesPerSession,
          avgDaysToFinish
      `;
      
      const result = await neo4jService.executeQuery(query, { bookId });
      
      if (result.length === 0) {
        return {
          sessionCount: 0,
          avgSessionDuration: 0,
          avgPagesPerSession: 0,
          avgDaysToFinish: 0
        };
      }
      
      return {
        sessionCount: this.toNumber(result[0].get('sessionCount')),
        avgSessionDuration: this.toNumber(result[0].get('avgSessionDuration')),
        avgPagesPerSession: this.toNumber(result[0].get('avgPagesPerSession')),
        avgDaysToFinish: this.toNumber(result[0].get('avgDaysToFinish'))
      };
    } catch (error) {
      console.error('Error getting book reading stats:', error);
      return {
        sessionCount: 0,
        avgSessionDuration: 0,
        avgPagesPerSession: 0,
        avgDaysToFinish: 0
      };
    }
  }
}

export default new BookService();