// Add this to your userService.js to debug the reading statistics issue
import neo4jService from './neo4jService';

class DebugUserService {
  // Debug function to check what's in the database
  async debugUserReadingHistory(userId) {
    const query = `
      MATCH (u:USER {id: $userId})-[:HAS_HISTORY]->(rh:READING_HISTORY)-[:CONTAINS_ENTRY]->(he:HISTORY_ENTRY)-[:REFERENCES_BOOK]->(b:BOOK)
      RETURN b.title as title, he.action as action, he.timestamp as timestamp
      ORDER BY he.timestamp DESC
    `;
    
    const result = await neo4jService.executeQuery(query, { userId });
    
    return result.map(record => ({
      title: record.get('title'),
      action: record.get('action'),
      timestamp: record.get('timestamp')
    }));
  }
  
  // Check WANTS_TO_READ relationships directly
  async debugWantsToRead(userId) {
    const query = `
      MATCH (u:USER {id: $userId})-[:WANTS_TO_READ]->(b:BOOK)
      RETURN b.title as title
    `;
    
    const result = await neo4jService.executeQuery(query, { userId });
    
    return result.map(record => ({
      title: record.get('title')
    }));
  }
  
  // Check finished books directly
  async debugFinishedBooks(userId) {
    const query = `
      MATCH (u:USER {id: $userId})-[:HAS_HISTORY]->(rh:READING_HISTORY)-[:CONTAINS_ENTRY]->(he:HISTORY_ENTRY)-[:REFERENCES_BOOK]->(b:BOOK)
      WHERE he.action = 'finished'
      RETURN DISTINCT b.title as title, he.timestamp as timestamp
    `;
    
    const result = await neo4jService.executeQuery(query, { userId });
    
    return result.map(record => ({
      title: record.get('title'),
      timestamp: record.get('timestamp')
    }));
  }
}

export default new DebugUserService();