// src/services/userService.js
import neo4jService from './neo4jService';

class UserService {
  // Helper function to convert Neo4j Integer to JS number
  toNumber(value) {
    if (value && typeof value === 'object' && 'low' in value && 'high' in value) {
      return value.low;
    }
    return value;
  }

  // Get complete user profile data with proper country retrieval
  async getUserProfileById(userId) {
    try {
      const query = `
        MATCH (u:USER {id: $userId})
        OPTIONAL MATCH (u)-[:LIVES_IN]->(city:CITY)-[:PART_OF]->(state:STATE)-[:PART_OF]->(country:COUNTRY)
        RETURN u, city, state, country
      `;
      
      const result = await neo4jService.executeQuery(query, { userId });
      
      if (result.length > 0) {
        const user = result[0].get('u');
        const city = result[0].get('city');
        const state = result[0].get('state');
        const country = result[0].get('country');
        
        return {
          id: user.properties.id,
          name: user.properties.name,
          email: user.properties.email,
          joinedDate: user.properties.joinedDate,
          phoneNumber: user.properties.phoneNumber,
          country: country ? country.properties.name : null,
          bio: user.properties.bio,
          city: city ? city.properties.name : null,
          state: state ? state.properties.name : null,
          firstName: user.properties.firstName,
          lastName: user.properties.lastName,
          age: this.toNumber(user.properties.age),
          profession: user.properties.profession,
          hobbies: user.properties.hobbies,
          relationshipStatus: user.properties.relationshipStatus,
          activityLevel: user.properties.activityLevel
        };
      }
      return null;
    } catch (error) {
      console.error('Error in getUserProfileById:', error);
      throw error;
    }
  }

  // Update user profile with proper relationships
  async updateUserProfile(userId, profileData) {
    try {
      // First, update the basic profile data
      const updateBasicQuery = `
        MATCH (u:USER {id: $userId})
        SET u.name = $name,
            u.email = $email,
            u.phoneNumber = $phoneNumber,
            u.bio = $bio,
            u.firstName = $firstName,
            u.lastName = $lastName,
            u.age = $age,
            u.relationshipStatus = $relationshipStatus
        RETURN u
      `;
      
      await neo4jService.executeQuery(updateBasicQuery, {
        userId,
        name: profileData.firstName + ' ' + profileData.lastName,
        email: profileData.email,
        phoneNumber: profileData.phoneNumber,
        bio: profileData.bio,
        firstName: profileData.firstName,
        lastName: profileData.lastName,
        age: profileData.age ? parseInt(profileData.age) : null,
        relationshipStatus: profileData.relationshipStatus
      });
      
      // Handle profession update - create relationship to PROFESSION node
      if (profileData.profession) {
        const updateProfessionQuery = `
          MATCH (u:USER {id: $userId})
          OPTIONAL MATCH (u)-[r:HAS_PROFESSION]->()
          DELETE r
          WITH u
          MERGE (p:PROFESSION {name: $profession})
          MERGE (u)-[:HAS_PROFESSION]->(p)
          SET u.profession = $profession
          RETURN u
        `;
        
        await neo4jService.executeQuery(updateProfessionQuery, {
          userId,
          profession: profileData.profession
        });
      }
      
      // Handle hobbies update - create relationships to HOBBY nodes
      if (profileData.hobbies) {
        const hobbiesArray = profileData.hobbies.split(',').map(h => h.trim()).filter(h => h);
        
        const updateHobbiesQuery = `
          MATCH (u:USER {id: $userId})
          OPTIONAL MATCH (u)-[r:HAS_HOBBY]->()
          DELETE r
          WITH u
          UNWIND $hobbies as hobbyName
          MERGE (h:HOBBY {name: hobbyName})
          MERGE (u)-[:HAS_HOBBY]->(h)
          WITH u, collect(hobbyName) as hobbyList
          SET u.hobbies = $hobbiesString
          RETURN u
        `;
        
        await neo4jService.executeQuery(updateHobbiesQuery, {
          userId,
          hobbies: hobbiesArray,
          hobbiesString: profileData.hobbies
        });
      } else {
        // If no hobbies, remove all hobby relationships
        const removeHobbiesQuery = `
          MATCH (u:USER {id: $userId})
          OPTIONAL MATCH (u)-[r:HAS_HOBBY]->()
          DELETE r
          SET u.hobbies = null
          RETURN u
        `;
        
        await neo4jService.executeQuery(removeHobbiesQuery, { userId });
      }
      
      // Handle location update with proper hierarchy
      if (profileData.country && profileData.state && profileData.city) {
        const updateLocationQuery = `
          MATCH (u:USER {id: $userId})
          OPTIONAL MATCH (u)-[r:LIVES_IN]->()
          DELETE r
          WITH u
          MATCH (country:COUNTRY {name: $country})
          MATCH (state:STATE {name: $state})-[:PART_OF]->(country)
          MATCH (city:CITY {name: $city})-[:PART_OF]->(state)
          MERGE (u)-[:LIVES_IN]->(city)
          RETURN u
        `;
        
        await neo4jService.executeQuery(updateLocationQuery, {
          userId,
          country: profileData.country,
          state: profileData.state,
          city: profileData.city
        });
      }
      
      // Return the updated profile
      return this.getUserProfileById(userId);
    } catch (error) {
      console.error('Error in updateUserProfile:', error);
      throw error;
    }
  }

  // Update user preferences (genres, authors, themes)
  async updateUserPreferences(userId, preferencesData) {
    try {
      // Update genres
      if (preferencesData.genres) {
        const updateGenresQuery = `
          MATCH (u:USER {id: $userId})
          OPTIONAL MATCH (u)-[r:PREFERS_GENRE]->()
          DELETE r
          WITH u
          UNWIND $genres as genreName
          MERGE (g:GENRE {name: genreName})
          MERGE (u)-[:PREFERS_GENRE]->(g)
          RETURN u
        `;
        
        await neo4jService.executeQuery(updateGenresQuery, {
          userId,
          genres: preferencesData.genres
        });
      } else {
        // Remove all genre preferences if none selected
        const removeGenresQuery = `
          MATCH (u:USER {id: $userId})
          OPTIONAL MATCH (u)-[r:PREFERS_GENRE]->()
          DELETE r
          RETURN u
        `;
        
        await neo4jService.executeQuery(removeGenresQuery, { userId });
      }
      
      // Update authors
      if (preferencesData.authors) {
        const updateAuthorsQuery = `
          MATCH (u:USER {id: $userId})
          OPTIONAL MATCH (u)-[r:PREFERS_AUTHOR]->()
          DELETE r
          WITH u
          UNWIND $authors as authorName
          MERGE (a:AUTHOR {name: authorName})
          MERGE (u)-[:PREFERS_AUTHOR]->(a)
          RETURN u
        `;
        
        await neo4jService.executeQuery(updateAuthorsQuery, {
          userId,
          authors: preferencesData.authors
        });
      } else {
        // Remove all author preferences if none selected
        const removeAuthorsQuery = `
          MATCH (u:USER {id: $userId})
          OPTIONAL MATCH (u)-[r:PREFERS_AUTHOR]->()
          DELETE r
          RETURN u
        `;
        
        await neo4jService.executeQuery(removeAuthorsQuery, { userId });
      }
      
      // Update themes
      if (preferencesData.themes) {
        const updateThemesQuery = `
          MATCH (u:USER {id: $userId})
          OPTIONAL MATCH (u)-[r:PREFERS_THEME]->()
          DELETE r
          WITH u
          UNWIND $themes as themeName
          MERGE (t:THEME {name: themeName})
          MERGE (u)-[:PREFERS_THEME]->(t)
          RETURN u
        `;
        
        await neo4jService.executeQuery(updateThemesQuery, {
          userId,
          themes: preferencesData.themes
        });
      } else {
        // Remove all theme preferences if none selected
        const removeThemesQuery = `
          MATCH (u:USER {id: $userId})
          OPTIONAL MATCH (u)-[r:PREFERS_THEME]->()
          DELETE r
          RETURN u
        `;
        
        await neo4jService.executeQuery(removeThemesQuery, { userId });
      }
      
      // Return updated preferences
      return this.getUserPreferences(userId);
    } catch (error) {
      console.error('Error in updateUserPreferences:', error);
      throw error;
    }
  }

  // Get all options for dropdowns (professions, hobbies)
  async getAllOptions() {
    try {
      // Query for professions from dedicated nodes
      const professionQuery = `
        MATCH (p:PROFESSION)
        RETURN p.name as profession
        ORDER BY profession
      `;
      
      // Query for hobbies from dedicated nodes
      const hobbiesQuery = `
        MATCH (h:HOBBY)
        RETURN h.name as hobby
        ORDER BY hobby
      `;
      
      const [professionResult, hobbiesResult] = await Promise.all([
        neo4jService.executeQuery(professionQuery),
        neo4jService.executeQuery(hobbiesQuery)
      ]);
      
      // If no professions exist in nodes, create them initially
      let professions = professionResult.map(record => record.get('profession'));
      if (professions.length === 0) {
        // Default professions list
        const defaultProfessions = [
          'Software Engineer', 'Teacher', 'Doctor', 'Nurse', 'Lawyer',
          'Accountant', 'Artist', 'Writer', 'Designer', 'Manager',
          'Chef', 'Mechanic', 'Electrician', 'Architect', 'Scientist',
          'Marketing Professional', 'Sales Representative', 'Student',
          'Retired', 'Entrepreneur', 'Other'
        ];
        
        // Create profession nodes
        const createProfessionsQuery = `
          UNWIND $professions as professionName
          MERGE (p:PROFESSION {name: professionName})
          RETURN p.name as profession
        `;
        
        const createdProfessions = await neo4jService.executeQuery(createProfessionsQuery, {
          professions: defaultProfessions
        });
        
        professions = createdProfessions.map(record => record.get('profession'));
      }
      
      // If no hobbies exist in nodes, create them initially
      let hobbies = hobbiesResult.map(record => record.get('hobby'));
      if (hobbies.length === 0) {
        // Default hobbies list
        const defaultHobbies = [
          'Reading', 'Writing', 'Painting', 'Drawing', 'Photography',
          'Cooking', 'Baking', 'Gardening', 'Hiking', 'Running',
          'Swimming', 'Cycling', 'Yoga', 'Dancing', 'Music',
          'Gaming', 'Chess', 'Traveling', 'Knitting', 'Woodworking',
          'Fishing', 'Bird Watching', 'Collecting', 'DIY Projects'
        ];
        
        // Create hobby nodes
        const createHobbiesQuery = `
          UNWIND $hobbies as hobbyName
          MERGE (h:HOBBY {name: hobbyName})
          RETURN h.name as hobby
        `;
        
        const createdHobbies = await neo4jService.executeQuery(createHobbiesQuery, {
          hobbies: defaultHobbies
        });
        
        hobbies = createdHobbies.map(record => record.get('hobby'));
      }
      
      return {
        professions,
        hobbies
      };
    } catch (error) {
      console.error('Error in getAllOptions:', error);
      return { professions: [], hobbies: [] };
    }
  }

  // Get all reading options for dropdowns (genres, authors, themes)
  async getAllReadingOptions() {
    try {
      // Query for genres
      const genresQuery = `
        MATCH (g:GENRE)
        RETURN g.name as genre
        ORDER BY genre
      `;
      
      // Query for authors
      const authorsQuery = `
        MATCH (a:AUTHOR)
        RETURN a.name as author
        ORDER BY author
      `;
      
      // Query for themes
      const themesQuery = `
        MATCH (t:THEME)
        RETURN t.name as theme
        ORDER BY theme
      `;
      
      const [genresResult, authorsResult, themesResult] = await Promise.all([
        neo4jService.executeQuery(genresQuery),
        neo4jService.executeQuery(authorsQuery),
        neo4jService.executeQuery(themesQuery)
      ]);
      
      return {
        genres: genresResult.map(record => record.get('genre')),
        authors: authorsResult.map(record => record.get('author')),
        themes: themesResult.map(record => record.get('theme'))
      };
    } catch (error) {
      console.error('Error in getAllReadingOptions:', error);
      return { genres: [], authors: [], themes: [] };
    }
  }

  // Get all locations for dropdowns
  async getAllLocations() {
    try {
      const query = `
        MATCH (country:COUNTRY)
        OPTIONAL MATCH (state:STATE)-[:PART_OF]->(country)
        OPTIONAL MATCH (city:CITY)-[:PART_OF]->(state)
        WITH country, state, city
        ORDER BY country.name, state.name, city.name
        RETURN 
          collect(DISTINCT country.name) as countries,
          collect(DISTINCT {name: state.name, country: country.name}) as states,
          collect(DISTINCT {name: city.name, state: state.name}) as cities
      `;
      
      const result = await neo4jService.executeQuery(query);
      
      if (result.length > 0) {
        return {
          countries: result[0].get('countries'),
          states: result[0].get('states'),
          cities: result[0].get('cities')
        };
      }
      return { countries: [], states: [], cities: [] };
    } catch (error) {
      console.error('Error in getAllLocations:', error);
      return { countries: [], states: [], cities: [] };
    }
  }

  // Get user social data with fixed book club query
  async getUserSocialData(userId) {
    try {
      // First get follower/following counts
      const socialQuery = `
        MATCH (u:USER {id: $userId})
        OPTIONAL MATCH (u)<-[:FOLLOWS]-(follower:USER)
        OPTIONAL MATCH (u)-[:FOLLOWS]->(following:USER)
        OPTIONAL MATCH (u)-[:COMMENTED]->(comment:COMMENT)
        OPTIONAL MATCH (u)-[:ATTENDED]->(event:EVENT)
        RETURN 
          count(DISTINCT follower) as followersCount,
          count(DISTINCT following) as followingCount,
          count(DISTINCT comment) as commentsCount,
          count(DISTINCT event) as eventsAttended
      `;
      
      // Separate query for book clubs to properly handle the relationship properties
      const bookClubQuery = `
        MATCH (u:USER {id: $userId})-[r:MEMBER_OF]->(club:BOOK_CLUB)
        OPTIONAL MATCH (club)<-[:MEMBER_OF]-(member:USER)
        WITH club, r, count(member) as memberCount
        RETURN club.id as clubId, 
               club.name as clubName, 
               r.role as memberRole, 
               r.joinDate as joinDate,
               memberCount
      `;
      
      const [socialResult, bookClubResult] = await Promise.all([
        neo4jService.executeQuery(socialQuery, { userId }),
        neo4jService.executeQuery(bookClubQuery, { userId })
      ]);
      
      let bookClubs = [];
      if (bookClubResult.length > 0) {
        bookClubs = bookClubResult.map(record => ({
          id: record.get('clubId'),
          name: record.get('clubName'),
          memberRole: record.get('memberRole'),
          joinedDate: record.get('joinDate'),
          memberCount: this.toNumber(record.get('memberCount'))
        }));
      }
      
      if (socialResult.length > 0) {
        return {
          followersCount: this.toNumber(socialResult[0].get('followersCount')),
          followingCount: this.toNumber(socialResult[0].get('followingCount')),
          commentsCount: this.toNumber(socialResult[0].get('commentsCount')),
          eventsAttended: this.toNumber(socialResult[0].get('eventsAttended')),
          bookClubs: bookClubs
        };
      }
      
      return {
        followersCount: 0,
        followingCount: 0,
        commentsCount: 0,
        eventsAttended: 0,
        bookClubs: []
      };
    } catch (error) {
      console.error('Error in getUserSocialData:', error);
      return {
        followersCount: 0,
        followingCount: 0,
        commentsCount: 0,
        eventsAttended: 0,
        bookClubs: []
      };
    }
  }

  // Get all book clubs (for admin or discovery)
  async getAllBookClubs() {
    try {
      const query = `
        MATCH (bc:BOOK_CLUB)
        OPTIONAL MATCH (bc)<-[:MEMBER_OF]-(member:USER)
        WITH bc, count(member) as memberCount
        OPTIONAL MATCH (bc)-[:FOCUSES_ON]->(g:GENRE)
        RETURN bc.id as id,
               bc.name as name,
               bc.description as description,
               bc.createdDate as createdDate,
               bc.meetingFrequency as meetingFrequency,
               collect(DISTINCT g.name) as genres,
               memberCount
        ORDER BY bc.name
      `;
      
      const result = await neo4jService.executeQuery(query);
      
      return result.map(record => ({
        id: record.get('id'),
        name: record.get('name'),
        description: record.get('description'),
        createdDate: record.get('createdDate'),
        meetingFrequency: record.get('meetingFrequency'),
        genres: record.get('genres'),
        memberCount: this.toNumber(record.get('memberCount'))
      }));
    } catch (error) {
      console.error('Error in getAllBookClubs:', error);
      return [];
    }
  }
  
  // Get available book clubs (that user hasn't joined)
  async getAvailableBookClubs(userId) {
    try {
      const query = `
        MATCH (bc:BOOK_CLUB)
        WHERE NOT EXISTS {
          MATCH (u:USER {id: $userId})-[:MEMBER_OF]->(bc)
        }
        WITH bc
        OPTIONAL MATCH (bc)<-[:MEMBER_OF]-(member:USER)
        WITH bc, count(member) as memberCount
        RETURN bc.id as id, 
               bc.name as name, 
               bc.description as description,
               memberCount
        ORDER BY bc.name
      `;
      
      const result = await neo4jService.executeQuery(query, { userId });
      
      return result.map(record => ({
        id: record.get('id'),
        name: record.get('name'),
        description: record.get('description'),
        memberCount: this.toNumber(record.get('memberCount'))
      }));
    } catch (error) {
      console.error('Error in getAvailableBookClubs:', error);
      return [];
    }
  }
  
  // Join a book club
  async joinBookClub(userId, clubId) {
    try {
      const query = `
        MATCH (u:USER {id: $userId})
        MATCH (bc:BOOK_CLUB {id: $clubId})
        MERGE (u)-[r:MEMBER_OF]->(bc)
        SET r.role = 'Member',
            r.joinDate = datetime()
        RETURN r
      `;
      
      const result = await neo4jService.executeQuery(query, { userId, clubId });
      return result.length > 0;
    } catch (error) {
      console.error('Error in joinBookClub:', error);
      throw error;
    }
  }
  
  // Leave a book club
  async leaveBookClub(userId, clubId) {
    try {
      const query = `
        MATCH (u:USER {id: $userId})-[r:MEMBER_OF]->(bc:BOOK_CLUB {id: $clubId})
        DELETE r
        RETURN true as success
      `;
      
      const result = await neo4jService.executeQuery(query, { userId, clubId });
      return result.length > 0;
    } catch (error) {
      console.error('Error in leaveBookClub:', error);
      throw error;
    }
  }
  
  // Update book club role
  async updateBookClubRole(userId, clubId, newRole) {
    try {
      const query = `
        MATCH (u:USER {id: $userId})-[r:MEMBER_OF]->(bc:BOOK_CLUB {id: $clubId})
        SET r.role = $newRole
        RETURN r
      `;
      
      const result = await neo4jService.executeQuery(query, { userId, clubId, newRole });
      return result.length > 0;
    } catch (error) {
      console.error('Error in updateBookClubRole:', error);
      throw error;
    }
  }
  
  // Create a new book club
  async createBookClub(clubData) {
    try {
      // Create the book club and set creator as admin member
      const createClubQuery = `
        CREATE (bc:BOOK_CLUB {
          id: randomUUID(),
          name: $name,
          description: $description,
          createdDate: datetime(),
          meetingFrequency: $meetingFrequency
        })
        WITH bc
        MATCH (u:USER {id: $creatorId})
        MERGE (u)-[r:MEMBER_OF]->(bc)
        SET r.role = 'Admin',
            r.joinDate = datetime()
        RETURN bc.id as id, bc.name as name
      `;
      
      const result = await neo4jService.executeQuery(createClubQuery, {
        name: clubData.name,
        description: clubData.description,
        meetingFrequency: clubData.meetingFrequency,
        creatorId: clubData.creatorId
      });
      
      if (result.length === 0) {
        throw new Error('Failed to create book club');
      }
      
      const clubId = result[0].get('id');
      
      // Add genres if provided
      if (clubData.genres && clubData.genres.length > 0) {
        const addGenresQuery = `
          MATCH (bc:BOOK_CLUB {id: $clubId})
          UNWIND $genres as genreName
          MERGE (g:GENRE {name: genreName})
          MERGE (bc)-[:FOCUSES_ON]->(g)
          RETURN bc
        `;
        
        await neo4jService.executeQuery(addGenresQuery, {
          clubId,
          genres: clubData.genres
        });
      }
      
      return {
        id: clubId,
        name: result[0].get('name')
      };
    } catch (error) {
      console.error('Error in createBookClub:', error);
      throw error;
    }
  }
  
  // Get book club details
  async getBookClubDetails(clubId) {
    try {
      const query = `
        MATCH (bc:BOOK_CLUB {id: $clubId})
        OPTIONAL MATCH (bc)<-[membership:MEMBER_OF]-(member:USER)
        WITH bc, collect({
          id: member.id,
          name: member.name,
          firstName: member.firstName,
          lastName: member.lastName,
          role: membership.role,
          joinDate: membership.joinDate
        }) as members
        OPTIONAL MATCH (bc)-[:FOCUSES_ON]->(g:GENRE)
        OPTIONAL MATCH (bc)-[:CURRENTLY_READING]->(currentBook:BOOK)
        OPTIONAL MATCH (bc)-[:HAS_READ]->(pastBook:BOOK)
        RETURN bc.id as id,
               bc.name as name,
               bc.description as description,
               bc.createdDate as createdDate,
               bc.meetingFrequency as meetingFrequency,
               collect(DISTINCT g.name) as genres,
               collect(DISTINCT {
                 id: currentBook.id,
                 title: currentBook.title,
                 author: currentBook.author
               }) as currentlyReading,
               collect(DISTINCT {
                 id: pastBook.id,
                 title: pastBook.title,
                 author: pastBook.author
               }) as booksRead,
               members
      `;
      
      const result = await neo4jService.executeQuery(query, { clubId });
      
      if (result.length === 0) {
        return null;
      }
      
      return {
        id: result[0].get('id'),
        name: result[0].get('name'),
        description: result[0].get('description'),
        createdDate: result[0].get('createdDate'),
        meetingFrequency: result[0].get('meetingFrequency'),
        genres: result[0].get('genres'),
        currentlyReading: result[0].get('currentlyReading').filter(book => book.id),
        booksRead: result[0].get('booksRead').filter(book => book.id),
        members: result[0].get('members')
      };
    } catch (error) {
      console.error('Error in getBookClubDetails:', error);
      return null;
    }
  }
  
  // Update book club details
  async updateBookClub(clubId, clubData) {
    try {
      // Update basic book club properties
      const updateClubQuery = `
        MATCH (bc:BOOK_CLUB {id: $clubId})
        SET bc.name = $name,
            bc.description = $description,
            bc.meetingFrequency = $meetingFrequency
        RETURN bc
      `;
      
      await neo4jService.executeQuery(updateClubQuery, {
        clubId,
        name: clubData.name,
        description: clubData.description,
        meetingFrequency: clubData.meetingFrequency
      });
      
      // Update club genres if provided
      if (clubData.genres) {
        // First, remove existing genre relationships
        const removeGenresQuery = `
          MATCH (bc:BOOK_CLUB {id: $clubId})-[r:FOCUSES_ON]->()
          DELETE r
          RETURN bc
        `;
        
        await neo4jService.executeQuery(removeGenresQuery, { clubId });
        
        // Then add new genres
        if (clubData.genres.length > 0) {
          const addGenresQuery = `
            MATCH (bc:BOOK_CLUB {id: $clubId})
            UNWIND $genres as genreName
            MERGE (g:GENRE {name: genreName})
            MERGE (bc)-[:FOCUSES_ON]->(g)
            RETURN bc
          `;
          
          await neo4jService.executeQuery(addGenresQuery, {
            clubId,
            genres: clubData.genres
          });
        }
      }
      
      return this.getBookClubDetails(clubId);
    } catch (error) {
      console.error('Error in updateBookClub:', error);
      throw error;
    }
  }
  
  // Set book club current reading
  async setBookClubCurrentReading(clubId, bookId) {
    try {
      const query = `
        MATCH (bc:BOOK_CLUB {id: $clubId})
        OPTIONAL MATCH (bc)-[r:CURRENTLY_READING]->()
        DELETE r
        WITH bc
        MATCH (book:BOOK {id: $bookId})
        MERGE (bc)-[:CURRENTLY_READING]->(book)
        RETURN book.title as title
      `;
      
      const result = await neo4jService.executeQuery(query, { clubId, bookId });
      return result.length > 0 ? result[0].get('title') : null;
    } catch (error) {
      console.error('Error in setBookClubCurrentReading:', error);
      throw error;
    }
  }
  
  // Add book to club's read history
  async addBookToClubHistory(clubId, bookId) {
    try {
      const query = `
        MATCH (bc:BOOK_CLUB {id: $clubId})
        MATCH (book:BOOK {id: $bookId})
        MERGE (bc)-[r:HAS_READ]->(book)
        SET r.completedDate = datetime()
        RETURN book.title as title
      `;
      
      const result = await neo4jService.executeQuery(query, { clubId, bookId });
      return result.length > 0 ? result[0].get('title') : null;
    } catch (error) {
      console.error('Error in addBookToClubHistory:', error);
      throw error;
    }
  }
  
  // Get book club discussion posts
  async getBookClubDiscussions(clubId) {
    try {
      const query = `
        MATCH (bc:BOOK_CLUB {id: $clubId})<-[:POSTED_IN]-(post:POST)<-[:AUTHORED]-(author:USER)
        OPTIONAL MATCH (post)<-[:REPLY_TO]-(comment:COMMENT)<-[:AUTHORED]-(commenter:USER)
        WITH post, author, 
             collect({
               id: comment.id,
               content: comment.content,
               createdAt: comment.createdAt,
               authorId: commenter.id,
               authorName: commenter.name
             }) as comments
        RETURN post.id as id,
               post.title as title,
               post.content as content,
               post.createdAt as createdAt,
               author.id as authorId,
               author.name as authorName,
               comments
        ORDER BY post.createdAt DESC
      `;
      
      const result = await neo4jService.executeQuery(query, { clubId });
      
      return result.map(record => ({
        id: record.get('id'),
        title: record.get('title'),
        content: record.get('content'),
        createdAt: record.get('createdAt'),
        author: {
          id: record.get('authorId'),
          name: record.get('authorName')
        },
        comments: record.get('comments')
      }));
    } catch (error) {
      console.error('Error in getBookClubDiscussions:', error);
      return [];
    }
  }
  
  // Create book club discussion post
  async createBookClubPost(clubId, userId, postData) {
    try {
      const query = `
        MATCH (bc:BOOK_CLUB {id: $clubId})
        MATCH (u:USER {id: $userId})
        CREATE (p:POST {
          id: randomUUID(),
          title: $title,
          content: $content,
          createdAt: datetime()
        })
        CREATE (u)-[:AUTHORED]->(p)
        CREATE (p)-[:POSTED_IN]->(bc)
        RETURN p.id as id, p.title as title
      `;
      
      const result = await neo4jService.executeQuery(query, {
        clubId,
        userId,
        title: postData.title,
        content: postData.content
      });
      
      return result.length > 0 ? {
        id: result[0].get('id'),
        title: result[0].get('title')
      } : null;
    } catch (error) {
      console.error('Error in createBookClubPost:', error);
      throw error;
    }
  }

  // Get user's reading statistics
  async getUserReadingStats(userId) {
    try {
      // Currently reading books
      const currentlyReadingQuery = `
        MATCH (u:USER {id: $userId})-[:HAS_HISTORY]->(rh:READING_HISTORY)-[:CONTAINS_ENTRY]->(he:HISTORY_ENTRY)-[:REFERENCES_BOOK]->(b:BOOK)
        WHERE he.action = 'started'
        WITH u, b, he.timestamp as startTime
        OPTIONAL MATCH (u)-[:HAS_HISTORY]->(:READING_HISTORY)-[:CONTAINS_ENTRY]->(finishEntry:HISTORY_ENTRY)-[:REFERENCES_BOOK]->(b)
        WHERE finishEntry.action = 'finished' AND finishEntry.timestamp > startTime
        WITH b, startTime, finishEntry
        WHERE finishEntry IS NULL
        RETURN count(DISTINCT b) as booksReading
      `;
      
      // Finished books
      const finishedBooksQuery = `
        MATCH (u:USER {id: $userId})-[:HAS_HISTORY]->(rh:READING_HISTORY)-[:CONTAINS_ENTRY]->(he:HISTORY_ENTRY)-[:REFERENCES_BOOK]->(b:BOOK)
        WHERE he.action = 'finished'
        RETURN count(DISTINCT b) as booksFinished
      `;
      
      // Books want to read
      const wantToReadQuery = `
        MATCH (u:USER {id: $userId})-[:WANTS_TO_READ]->(b:BOOK)
        RETURN count(b) as booksWantToRead
      `;
      
      const [currentlyReading, finished, wantToRead] = await Promise.all([
        neo4jService.executeQuery(currentlyReadingQuery, { userId }),
        neo4jService.executeQuery(finishedBooksQuery, { userId }),
        neo4jService.executeQuery(wantToReadQuery, { userId })
      ]);
      
      return {
        booksReading: currentlyReading.length > 0 ? this.toNumber(currentlyReading[0].get('booksReading')) : 0,
        booksFinished: finished.length > 0 ? this.toNumber(finished[0].get('booksFinished')) : 0,
        booksWantToRead: wantToRead.length > 0 ? this.toNumber(wantToRead[0].get('booksWantToRead')) : 0
      };
    } catch (error) {
      console.error('Error in getUserReadingStats:', error);
      return { booksReading: 0, booksFinished: 0, booksWantToRead: 0 };
    }
  }

  // Get user preferences
  async getUserPreferences(userId) {
    try {
      const query = `
        MATCH (u:USER {id: $userId})
        OPTIONAL MATCH (u)-[:PREFERS_GENRE]->(g:GENRE)
        OPTIONAL MATCH (u)-[:PREFERS_AUTHOR]->(a:AUTHOR)
        OPTIONAL MATCH (u)-[:PREFERS_THEME]->(t:THEME)
        RETURN 
          collect(DISTINCT g.name) as genres,
          collect(DISTINCT a.name) as authors,
          collect(DISTINCT t.name) as themes
      `;
      
      const result = await neo4jService.executeQuery(query, { userId });
      
      if (result.length > 0) {
        return {
          genres: result[0].get('genres'),
          authors: result[0].get('authors'),
          themes: result[0].get('themes')
        };
      }
      return { genres: [], authors: [], themes: [] };
    } catch (error) {
      console.error('Error in getUserPreferences:', error);
      return { genres: [], authors: [], themes: [] };
    }
  }
}

export default new UserService();