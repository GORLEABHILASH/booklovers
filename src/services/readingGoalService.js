// src/services/readingGoalService.js
import neo4jService from './neo4jService';

class ReadingGoalService {
  // Helper function to convert Neo4j Integer to JS number
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

  // Get a user's reading goals
  async getUserReadingGoals(userId) {
    try {
      const query = `
        MATCH (u:USER {id: $userId})-[:HAS_GOAL]->(g:READING_GOAL)
        RETURN g.id as id,
               g.period as period,
               g.target as target,
               g.startDate as startDate,
               g.endDate as endDate,
               g.createdAt as createdAt,
               g.progress as progress,
               g.status as status
        ORDER BY g.startDate DESC
      `;
      
      const result = await neo4jService.executeQuery(query, { userId });
      
      return result.map(record => ({
        id: record.get('id'),
        period: record.get('period'),
        target: this.toNumber(record.get('target')),
        startDate: record.get('startDate'),
        endDate: record.get('endDate'),
        createdAt: record.get('createdAt'),
        progress: this.toNumber(record.get('progress')),
        status: record.get('status')
      }));
    } catch (error) {
      console.error('Error in getUserReadingGoals:', error);
      return [];
    }
  }

  // Create or update a reading goal
  async setReadingGoal(userId, goalData) {
    try {
      // First, check if the user already has a goal for this period
      const checkQuery = `
        MATCH (u:USER {id: $userId})-[:HAS_GOAL]->(g:READING_GOAL)
        WHERE g.period = $period AND g.status = 'active'
        RETURN g.id as id
      `;
      
      const checkResult = await neo4jService.executeQuery(checkQuery, { 
        userId, 
        period: goalData.period 
      });
      
      // If goal exists, update it
      if (checkResult.length > 0) {
        const goalId = checkResult[0].get('id');
        
        const updateQuery = `
          MATCH (u:USER {id: $userId})-[:HAS_GOAL]->(g:READING_GOAL {id: $goalId})
          SET g.target = $target,
              g.startDate = $startDate,
              g.endDate = $endDate,
              g.updatedAt = datetime()
          RETURN g.id as id, g.period as period, g.target as target
        `;
        
        const result = await neo4jService.executeQuery(updateQuery, {
          userId,
          goalId,
          target: goalData.target,
          startDate: goalData.startDate,
          endDate: goalData.endDate
        });
        
        if (result.length > 0) {
          return {
            id: result[0].get('id'),
            period: result[0].get('period'),
            target: this.toNumber(result[0].get('target')),
            updated: true
          };
        }
      } else {
        // Create a new goal
        const createQuery = `
          MATCH (u:USER {id: $userId})
          CREATE (g:READING_GOAL {
            id: "GOAL-" + apoc.create.uuid(),
            period: $period,
            target: $target,
            startDate: $startDate,
            endDate: $endDate,
            createdAt: datetime(),
            progress: 0,
            status: 'active'
          })
          CREATE (u)-[:HAS_GOAL]->(g)
          RETURN g.id as id, g.period as period, g.target as target
        `;
        
        const result = await neo4jService.executeQuery(createQuery, {
          userId,
          period: goalData.period,
          target: goalData.target,
          startDate: goalData.startDate,
          endDate: goalData.endDate
        });
        
        if (result.length > 0) {
          return {
            id: result[0].get('id'),
            period: result[0].get('period'),
            target: this.toNumber(result[0].get('target')),
            updated: false
          };
        }
      }
      
      return null;
    } catch (error) {
      console.error('Error in setReadingGoal:', error);
      throw error;
    }
  }

  // Update reading goal progress
  async updateGoalProgress(userId, goalId, progress) {
    try {
      const query = `
        MATCH (u:USER {id: $userId})-[:HAS_GOAL]->(g:READING_GOAL {id: $goalId})
        SET g.progress = $progress,
            g.updatedAt = datetime(),
            g.status = CASE 
              WHEN $progress >= g.target THEN 'completed'
              ELSE g.status
            END
        RETURN g.id as id, g.progress as progress, g.target as target, g.status as status
      `;
      
      const result = await neo4jService.executeQuery(query, {
        userId,
        goalId,
        progress
      });
      
      if (result.length > 0) {
        return {
          id: result[0].get('id'),
          progress: this.toNumber(result[0].get('progress')),
          target: this.toNumber(result[0].get('target')),
          status: result[0].get('status')
        };
      }
      
      return null;
    } catch (error) {
      console.error('Error in updateGoalProgress:', error);
      throw error;
    }
  }

  // Get current active reading goal
  async getActiveReadingGoal(userId, period) {
    try {
      const query = `
        MATCH (u:USER {id: $userId})-[:HAS_GOAL]->(g:READING_GOAL)
        WHERE g.period = $period AND g.status = 'active'
        RETURN g.id as id,
               g.period as period,
               g.target as target,
               g.startDate as startDate,
               g.endDate as endDate,
               g.progress as progress
      `;
      
      const result = await neo4jService.executeQuery(query, { userId, period });
      
      if (result.length > 0) {
        return {
          id: result[0].get('id'),
          period: result[0].get('period'),
          target: this.toNumber(result[0].get('target')),
          startDate: result[0].get('startDate'),
          endDate: result[0].get('endDate'),
          progress: this.toNumber(result[0].get('progress'))
        };
      }
      
      return null;
    } catch (error) {
      console.error('Error in getActiveReadingGoal:', error);
      return null;
    }
  }

  // Calculate books read in a time period (for automatic goal tracking)
  async getBooksReadInPeriod(userId, startDate, endDate) {
    try {
      const query = `
        MATCH (u:USER {id: $userId})-[:HAS_HISTORY]->(rh:READING_HISTORY)-[:CONTAINS_ENTRY]->(he:HISTORY_ENTRY)
        WHERE he.action = 'finished' AND he.timestamp >= datetime($startDate) AND he.timestamp <= datetime($endDate)
        WITH he, rh
        MATCH (he)-[:REFERENCES_BOOK]->(b:BOOK)
        RETURN count(DISTINCT b) as booksRead
      `;
      
      const result = await neo4jService.executeQuery(query, { 
        userId, 
        startDate, 
        endDate 
      });
      
      return result.length > 0 ? this.toNumber(result[0].get('booksRead')) : 0;
    } catch (error) {
      console.error('Error in getBooksReadInPeriod:', error);
      return 0;
    }
  }

  // Mark a goal as abandoned or deleted
  async cancelReadingGoal(userId, goalId) {
    try {
      const query = `
        MATCH (u:USER {id: $userId})-[:HAS_GOAL]->(g:READING_GOAL {id: $goalId})
        SET g.status = 'cancelled',
            g.updatedAt = datetime()
        RETURN g.id as id
      `;
      
      const result = await neo4jService.executeQuery(query, { userId, goalId });
      return result.length > 0;
    } catch (error) {
      console.error('Error in cancelReadingGoal:', error);
      throw error;
    }
  }

  // Get all completed goals for a user
  async getCompletedGoals(userId) {
    try {
      const query = `
        MATCH (u:USER {id: $userId})-[:HAS_GOAL]->(g:READING_GOAL)
        WHERE g.status = 'completed'
        RETURN g.id as id,
               g.period as period,
               g.target as target,
               g.startDate as startDate,
               g.endDate as endDate,
               g.progress as progress,
               g.createdAt as createdAt
        ORDER BY g.endDate DESC
      `;
      
      const result = await neo4jService.executeQuery(query, { userId });
      
      return result.map(record => ({
        id: record.get('id'),
        period: record.get('period'),
        target: this.toNumber(record.get('target')),
        startDate: record.get('startDate'),
        endDate: record.get('endDate'),
        progress: this.toNumber(record.get('progress')),
        createdAt: record.get('createdAt')
      }));
    } catch (error) {
      console.error('Error in getCompletedGoals:', error);
      return [];
    }
  }
  
  // Get reading books for user
  async getUserReadingBooks(userId) {
    try {
      const query = `
        MATCH (u:USER {id: $userId})-[:READING]->(b:BOOK)
        OPTIONAL MATCH (u)-[r:READING]->(b)
        OPTIONAL MATCH (b)<-[:WROTE]-(a:AUTHOR)
        RETURN b.id as id, 
              b.title as title, 
              a.name as author, 
              r.currentPage as currentPage,
              b.pageCount as pageCount,
              r.percentComplete as percentComplete,
              r.lastUpdated as lastUpdated
        ORDER BY r.lastUpdated DESC
      `;
      
      const result = await neo4jService.executeQuery(query, { userId });
      
      return result.map(record => ({
        id: record.get('id'),
        title: record.get('title'),
        author: record.get('author'),
        currentPage: this.toNumber(record.get('currentPage')) || 0,
        pageCount: this.toNumber(record.get('pageCount')) || 0,
        progress: Math.round(this.toNumber(record.get('percentComplete')) || 0),
        lastUpdated: record.get('lastUpdated')
      }));
    } catch (error) {
      console.error('Error in getUserReadingBooks:', error);
      return [];
    }
  }
  
  // Get to-read books for user
  async getUserToReadBooks(userId) {
    try {
      const query = `
        MATCH (u:USER {id: $userId})-[r:WANTS_TO_READ]->(b:BOOK)
        OPTIONAL MATCH (b)<-[:WROTE]-(a:AUTHOR)
        RETURN b.id as id, 
              b.title as title, 
              a.name as author, 
              r.date as addedDate
        ORDER BY r.date DESC
      `;
      
      const result = await neo4jService.executeQuery(query, { userId });
      
      return result.map(record => ({
        id: record.get('id'),
        title: record.get('title'),
        author: record.get('author'),
        addedDate: record.get('addedDate')
      }));
    } catch (error) {
      console.error('Error in getUserToReadBooks:', error);
      return [];
    }
  }
  
  // Get completed books for user
  async getUserCompletedBooks(userId) {
    try {
      const query = `
        MATCH (u:USER {id: $userId})-[f:FINISHED]->(b:BOOK)
        OPTIONAL MATCH (b)<-[:WROTE]-(a:AUTHOR)
        OPTIONAL MATCH (u)-[r:RATES]->(b)
        RETURN b.id as id, 
              b.title as title, 
              a.name as author, 
              f.date as completedDate,
              r.rating as rating
        ORDER BY f.date DESC
      `;
      
      const result = await neo4jService.executeQuery(query, { userId });
      
      return result.map(record => ({
        id: record.get('id'),
        title: record.get('title'),
        author: record.get('author'),
        completedDate: record.get('completedDate'),
        rating: this.toNumber(record.get('rating')) || 0
      }));
    } catch (error) {
      console.error('Error in getUserCompletedBooks:', error);
      return [];
    }
  }
  
  // Get favorite books for user
  async getUserFavoriteBooks(userId) {
    try {
      const query = `
        MATCH (u:USER {id: $userId})-[f:FAVORITES]->(b:BOOK)
        OPTIONAL MATCH (b)<-[:WROTE]-(a:AUTHOR)
        RETURN b.id as id, 
              b.title as title, 
              a.name as author, 
              f.addedOn as addedDate
        ORDER BY f.addedOn DESC
      `;
      
      const result = await neo4jService.executeQuery(query, { userId });
      
      return result.map(record => ({
        id: record.get('id'),
        title: record.get('title'),
        author: record.get('author'),
        addedDate: record.get('addedDate')
      }));
    } catch (error) {
      console.error('Error in getUserFavoriteBooks:', error);
      return [];
    }
  }
}

export default new ReadingGoalService();