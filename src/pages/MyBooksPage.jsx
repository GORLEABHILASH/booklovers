import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import TopNavigation from '../Components/TopNavigation';
import { 
  Book, Clock, Calendar, List, Grid, Filter, ChevronDown, Heart, Star, 
  MoreHorizontal, BookmarkPlus, BookmarkCheck, Target, PlusCircle, Edit, X, Save
} from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import userService from '../services/userService';
import bookService from '../services/bookService';
import readingGoalService from '../services/readingGoalService';
import { getConsistentColor } from '../utils/colorUtils';

const MyBooksPage = () => {
  const [activeTab, setActiveTab] = useState('reading');
  const [viewMode, setViewMode] = useState('grid');
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  
  // State for books
  const [readingBooks, setReadingBooks] = useState([]);
  const [toReadBooks, setToReadBooks] = useState([]);
  const [completedBooks, setCompletedBooks] = useState([]);
  const [favoriteBooks, setFavoriteBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // State for reading stats
  const [readingStats, setReadingStats] = useState({
    booksReading: 0,
    booksFinished: 0,
    booksWantToRead: 0,
    favoriteBooks: 0
  });
  
  // State for reading goals
  const [activeGoals, setActiveGoals] = useState([]);
  const [showGoalForm, setShowGoalForm] = useState(false);
  const [goalFormData, setGoalFormData] = useState({
    period: 'weekly',
    target: 1,
    startDate: new Date().toISOString().split('T')[0],
    endDate: ''
  });
  
  // Calculate end date based on period selection
  const calculateEndDate = (period, startDate) => {
    const start = new Date(startDate);
    let end = new Date(start);
    
    switch (period) {
      case 'weekly':
        end.setDate(start.getDate() + 7);
        break;
      case 'monthly':
        end.setMonth(start.getMonth() + 1);
        break;
      case 'quarterly':
        end.setMonth(start.getMonth() + 3);
        break;
      case 'biannual':
        end.setMonth(start.getMonth() + 6);
        break;
      case 'annual':
        end.setFullYear(start.getFullYear() + 1);
        break;
      default:
        end.setDate(start.getDate() + 7);
    }
    
    return end.toISOString().split('T')[0];
  };
  
  // Update end date when period or start date changes
  useEffect(() => {
    const endDate = calculateEndDate(goalFormData.period, goalFormData.startDate);
    setGoalFormData(prev => ({ ...prev, endDate }));
  }, [goalFormData.period, goalFormData.startDate]);
  
  // Load user's books and goals
  useEffect(() => {
    if (!currentUser) return;
    
    const loadUserData = async () => {
      setLoading(true);
      setError(null);
      
      try {
        // Fetch reading statistics
        const stats = await userService.getUserReadingStats(currentUser.id);
        
        // Fetch books and goals using the reading goal service
        const [reading, toRead, completed, goals, favorites] = await Promise.all([
          readingGoalService.getUserReadingBooks(currentUser.id),
          readingGoalService.getUserToReadBooks(currentUser.id),
          readingGoalService.getUserCompletedBooks(currentUser.id),
          readingGoalService.getUserReadingGoals(currentUser.id),
          readingGoalService.getUserFavoriteBooks(currentUser.id)
        ]);
        
        setReadingBooks(reading);
        setToReadBooks(toRead);
        setCompletedBooks(completed);
        setFavoriteBooks(favorites);
        
        // Set active goals only
        setActiveGoals(goals.filter(goal => goal.status === 'active'));
        
        // Update reading stats
        setReadingStats({
          booksReading: stats.booksReading || reading.length,
          booksFinished: stats.booksFinished || completed.length,
          booksWantToRead: stats.booksWantToRead || toRead.length,
          favoriteBooks: favorites.length
        });
      } catch (error) {
        console.error("Error loading user data:", error);
        setError("Failed to load your books. Please try again later.");
      } finally {
        setLoading(false);
      }
    };
    
    loadUserData();
  }, [currentUser]);
  
  // Format timestamp to readable format
  const formatTimestamp = (timestamp) => {
    if (!timestamp) return 'Unknown';
    
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);
    
    if (diffDay > 30) {
      return date.toLocaleDateString(undefined, { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
      });
    } else if (diffDay > 1) {
      return `${diffDay} days ago`;
    } else if (diffDay === 1) {
      return 'Yesterday';
    } else if (diffHour >= 1) {
      return `${diffHour} ${diffHour === 1 ? 'hour' : 'hours'} ago`;
    } else if (diffMin >= 1) {
      return `${diffMin} ${diffMin === 1 ? 'minute' : 'minutes'} ago`;
    } else {
      return 'Just now';
    }
  };
  
  // Handle goal form submission
  const handleGoalSubmit = async (e) => {
    e.preventDefault();
    
    try {
      const result = await readingGoalService.setReadingGoal(currentUser.id, goalFormData);
      
      if (result) {
        // Add the new goal to active goals or update existing one
        const newGoal = {
          id: result.id,
          period: result.period,
          target: result.target,
          startDate: goalFormData.startDate,
          endDate: goalFormData.endDate,
          progress: 0,
          status: 'active'
        };
        
        if (result.updated) {
          // Update existing goal
          setActiveGoals(prev => prev.map(g => 
            g.id === result.id ? { ...g, ...newGoal } : g
          ));
        } else {
          // Add new goal
          setActiveGoals(prev => [...prev, newGoal]);
        }
        
        setShowGoalForm(false);
        
        // Reset form
        setGoalFormData({
          period: 'weekly',
          target: 1,
          startDate: new Date().toISOString().split('T')[0],
          endDate: calculateEndDate('weekly', new Date().toISOString().split('T')[0])
        });
      }
    } catch (error) {
      console.error("Error creating reading goal:", error);
      setError("Failed to create reading goal. Please try again.");
    }
  };
  
  // Handle removing a book from favorites
  const handleRemoveFromFavorites = async (bookId) => {
    try {
      await bookService.removeFromFavorites(currentUser.id, bookId);
      
      // Update the UI by filtering out the removed book
      setFavoriteBooks(favorites => favorites.filter(book => book.id !== bookId));
      
      // Update favorites count in stats
      setReadingStats(prev => ({
        ...prev,
        favoriteBooks: prev.favoriteBooks - 1
      }));
    } catch (error) {
      console.error("Error removing book from favorites:", error);
      setError("Failed to remove book from favorites. Please try again.");
    }
  };
  
  // Format progress percentage for goals
  const formatProgressPercentage = (progress, target) => {
    if (!target) return '0%';
    const percentage = Math.min(100, Math.round((progress / target) * 100));
    return `${percentage}%`;
  };
  
  // Get goal period in user-friendly format
  const getGoalPeriodText = (period) => {
    switch (period) {
      case 'weekly': return 'Weekly';
      case 'monthly': return 'Monthly';
      case 'quarterly': return 'Quarterly';
      case 'biannual': return '6 Months';
      case 'annual': return 'Annual';
      default: return period;
    }
  };
  
  // Format date for display
  const formatDate = (dateString) => {
    if (!dateString) return 'Unknown';
    
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  };
  
  // Calculate color class for book cover
  const getCoverClass = (bookId) => {
    const colorName = getConsistentColor(bookId || '');
    const colorMap = {
      'red': 'bg-red-200',
      'blue': 'bg-blue-200',
      'green': 'bg-green-200',
      'yellow': 'bg-yellow-200',
      'purple': 'bg-purple-200',
      'pink': 'bg-pink-200',
      'indigo': 'bg-indigo-200',
      'orange': 'bg-orange-200',
      'teal': 'bg-teal-200',
      'gray': 'bg-gray-200',
      'default': 'bg-gray-200'
    };
    
    return colorMap[colorName] || colorMap.default;
  };
  
  // Determine which books to show based on active tab
  const getActiveBooks = () => {
    switch (activeTab) {
      case 'reading':
        return readingBooks;
      case 'toread':
        return toReadBooks;
      case 'completed':
        return completedBooks;
      case 'favorites':
        return favoriteBooks;
      default:
        return [];
    }
  };
  
  if (loading) {
    return (
      <div className="flex flex-col h-screen bg-gray-100">
        <TopNavigation title="My Books" />
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
        </div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="flex flex-col h-screen bg-gray-100">
        <TopNavigation title="My Books" />
        <div className="flex-1 flex items-center justify-center">
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded max-w-md">
            <p>{error}</p>
            <button 
              className="mt-3 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded"
              onClick={() => window.location.reload()}
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="flex flex-col h-screen bg-gray-100 pb-16 overflow-auto">
      <TopNavigation title="My Books" />
      
      {/* Content Area */}
      <div className="flex-1 overflow-auto">
        {/* Stats */}
        <div className="bg-indigo-600 text-white p-6">
          <h1 className="text-xl font-bold mb-4">Your Reading Stats</h1>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div className="bg-indigo-500 rounded-lg p-3">
              <div className="text-2xl font-bold">{readingStats.booksReading}</div>
              <div className="text-xs">Currently Reading</div>
            </div>
            <div className="bg-indigo-500 rounded-lg p-3">
              <div className="text-2xl font-bold">{readingStats.booksFinished}</div>
              <div className="text-xs">Books in 2025</div>
            </div>
            <div className="bg-indigo-500 rounded-lg p-3">
              <div className="text-2xl font-bold">{readingStats.booksWantToRead}</div>
              <div className="text-xs">Want to Read</div>
            </div>
            <div className="bg-indigo-500 rounded-lg p-3">
              <div className="text-2xl font-bold">{readingStats.favoriteBooks}</div>
              <div className="text-xs">Favorites</div>
            </div>
          </div>
          
          {/* Reading Goals */}
          <div className="mt-6">
            <div className="flex justify-between items-center mb-3">
              <h2 className="text-lg font-semibold">Reading Goals</h2>
              <button 
                className="bg-indigo-700 hover:bg-indigo-800 text-white px-3 py-1 rounded-full text-sm flex items-center"
                onClick={() => setShowGoalForm(true)}
              >
                <PlusCircle className="h-4 w-4 mr-1" />
                Add Goal
              </button>
            </div>
            
            {/* Goal form */}
            {showGoalForm && (
              <div className="bg-indigo-700 rounded-lg p-4 mb-4">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="font-medium">New Reading Goal</h3>
                  <button 
                    className="text-indigo-200 hover:text-white"
                    onClick={() => setShowGoalForm(false)}
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
                
                <form onSubmit={handleGoalSubmit}>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
                    <div>
                      <label className="block text-xs text-indigo-200 mb-1">Period</label>
                      <select 
                        className="w-full p-2 rounded text-gray-800 text-sm"
                        value={goalFormData.period}
                        onChange={(e) => setGoalFormData({...goalFormData, period: e.target.value})}
                        required
                      >
                        <option value="weekly">Weekly</option>
                        <option value="monthly">Monthly</option>
                        <option value="quarterly">Quarterly</option>
                        <option value="biannual">6 Months</option>
                        <option value="annual">Annual</option>
                      </select>
                    </div>
                    
                    <div>
                      <label className="block text-xs text-indigo-200 mb-1">Number of Books</label>
                      <input 
                        type="number"
                        min="1"
                        className="w-full p-2 rounded text-gray-800 text-sm"
                        value={goalFormData.target}
                        onChange={(e) => setGoalFormData({...goalFormData, target: parseInt(e.target.value) || 1})}
                        required
                      />
                    </div>
                    
                    <div>
                      <label className="block text-xs text-indigo-200 mb-1">Start Date</label>
                      <input 
                        type="date"
                        className="w-full p-2 rounded text-gray-800 text-sm"
                        value={goalFormData.startDate}
                        onChange={(e) => setGoalFormData({...goalFormData, startDate: e.target.value})}
                        required
                      />
                    </div>
                  </div>
                  
                  <div className="flex justify-end">
                    <button
                      type="button"
                      className="px-4 py-1 rounded text-indigo-200 hover:text-white mr-2"
                      onClick={() => setShowGoalForm(false)}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded flex items-center"
                    >
                      <Save className="h-4 w-4 mr-1" />
                      Save Goal
                    </button>
                  </div>
                </form>
              </div>
            )}
            
            {/* Active goals list */}
            {activeGoals.length > 0 ? (
              <div className="space-y-3">
                {activeGoals.map(goal => (
                  <div key={goal.id} className="bg-indigo-700 rounded-lg p-3">
                    <div className="flex justify-between mb-1">
                      <div className="text-sm font-medium">
                        {getGoalPeriodText(goal.period)}: {goal.target} {goal.target === 1 ? 'book' : 'books'}
                      </div>
                      <div className="text-xs text-indigo-200">
                        {formatDate(goal.startDate)} - {formatDate(goal.endDate)}
                      </div>
                    </div>
                    
                    <div className="h-2 bg-indigo-800 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-green-500 rounded-full"
                        style={{ width: formatProgressPercentage(goal.progress, goal.target) }}
                      ></div>
                    </div>
                    
                    <div className="flex justify-between items-center mt-1 text-xs">
                      <div>{goal.progress} of {goal.target} completed</div>
                      <div>{formatProgressPercentage(goal.progress, goal.target)}</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center bg-indigo-700 rounded-lg p-4">
                <div className="text-sm">You don't have any active reading goals.</div>
                {!showGoalForm && (
                  <button 
                    className="mt-2 px-3 py-1 bg-indigo-600 rounded-full text-xs"
                    onClick={() => setShowGoalForm(true)}
                  >
                    Create your first goal
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
        
        {/* Tabs */}
        <div className="flex bg-white shadow-sm mb-4">
          <div 
            className={`flex-1 px-4 py-3 text-center font-medium text-sm cursor-pointer ${activeTab === 'reading' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-gray-500'}`}
            onClick={() => setActiveTab('reading')}
          >
            <div className="flex items-center justify-center">
              <Book className="h-4 w-4 mr-1" />
              <span>Reading</span>
            </div>
          </div>
          <div 
            className={`flex-1 px-4 py-3 text-center font-medium text-sm cursor-pointer ${activeTab === 'toread' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-gray-500'}`}
            onClick={() => setActiveTab('toread')}
          >
            <div className="flex items-center justify-center">
              <Clock className="h-4 w-4 mr-1" />
              <span>To Read</span>
            </div>
          </div>
          <div 
            className={`flex-1 px-4 py-3 text-center font-medium text-sm cursor-pointer ${activeTab === 'completed' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-gray-500'}`}
            onClick={() => setActiveTab('completed')}
          >
            <div className="flex items-center justify-center">
              <Calendar className="h-4 w-4 mr-1" />
              <span>Completed</span>
            </div>
          </div>
          <div 
            className={`flex-1 px-4 py-3 text-center font-medium text-sm cursor-pointer ${activeTab === 'favorites' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-gray-500'}`}
            onClick={() => setActiveTab('favorites')}
          >
            <div className="flex items-center justify-center">
              <Heart className="h-4 w-4 mr-1" />
              <span>Favorites</span>
            </div>
          </div>
        </div>
        
        {/* Controls */}
        <div className="flex justify-between items-center px-4 mb-4">
          <div className="flex space-x-2">
            <button 
              className={`p-2 rounded ${viewMode === 'grid' ? 'bg-indigo-100 text-indigo-600' : 'bg-gray-100 text-gray-500'}`}
              onClick={() => setViewMode('grid')}
            >
              <Grid className="h-4 w-4" />
            </button>
            <button 
              className={`p-2 rounded ${viewMode === 'list' ? 'bg-indigo-100 text-indigo-600' : 'bg-gray-100 text-gray-500'}`}
              onClick={() => setViewMode('list')}
            >
              <List className="h-4 w-4" />
            </button>
          </div>
          <div className="flex items-center">
            <button className="flex items-center text-sm text-gray-500 bg-gray-100 px-3 py-1 rounded">
              <Filter className="h-3 w-3 mr-1" />
              <span>Filter</span>
              <ChevronDown className="h-3 w-3 ml-1" />
            </button>
          </div>
        </div>
        
        {/* Empty state if no books */}
        {getActiveBooks().length === 0 && (
          <div className="px-4 py-8">
            <div className="text-center bg-white rounded-lg shadow p-6">
              <div className="text-gray-500 mb-2">
                {activeTab === 'reading' && "You're not currently reading any books."}
                {activeTab === 'toread' && "You don't have any books in your 'To Read' list."}
                {activeTab === 'completed' && "You haven't completed any books yet."}
                {activeTab === 'favorites' && "You don't have any favorite books yet."}
              </div>
              <button 
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg"
                onClick={() => navigate('/discover')}
              >
                {activeTab === 'favorites' ? 'Browse Books to Add Favorites' : 'Browse Books'}
              </button>
            </div>
          </div>
        )}
        
        {/* Book List/Grid */}
        {viewMode === 'grid' ? (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 px-4 pb-4">
            {getActiveBooks().map(book => (
              <div 
                key={book.id} 
                className="bg-white rounded-lg shadow overflow-hidden cursor-pointer"
                onClick={() => navigate(`/book/${book.id}`)}
              >
                <div className={`${getCoverClass(book.id)} h-40 w-full relative`}>
                  {activeTab === 'reading' && (
                    <div className="absolute bottom-0 left-0 right-0 bg-indigo-700 text-white text-xs p-1 text-center">
                      {book.progress}% complete
                    </div>
                  )}
                  {activeTab === 'favorites' && (
                    <div className="absolute top-2 right-2 flex space-x-1">
                      <button 
                        className="p-1 bg-white bg-opacity-90 rounded-full text-red-500"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveFromFavorites(book.id);
                        }}
                      >
                        <X className="h-4 w-4" />
                      </button>
                      <div className="p-1">
                        <Heart className="h-4 w-4 text-red-500 fill-current" />
                      </div>
                    </div>
                  )}
                </div>
                <div className="p-3">
                  <div className="font-semibold text-sm truncate">{book.title}</div>
                  <div className="text-xs text-gray-500">{book.author}</div>
                  
                  {activeTab === 'reading' && (
                    <div className="text-xs text-gray-500 mt-1">Last read: {formatTimestamp(book.lastUpdated)}</div>
                  )}
                  
                  {activeTab === 'toread' && (
                    <div className="text-xs text-gray-500 mt-1">Added: {formatTimestamp(book.addedDate)}</div>
                  )}
                  
                  {activeTab === 'completed' && (
                    <div className="flex items-center mt-1">
                      <div className="flex">
                        {[...Array(Math.floor(book.rating))].map((_, i) => (
                          <Star key={i} className="h-3 w-3 text-yellow-500 fill-current" />
                        ))}
                        {book.rating % 1 !== 0 && (
                          <Star className="h-3 w-3 text-yellow-500 fill-current" style={{ clipPath: 'polygon(0 0, 50% 0, 50% 100%, 0 100%)' }} />
                        )}
                      </div>
                      <div className="text-xs text-gray-500 ml-1">{formatTimestamp(book.completedDate)}</div>
                    </div>
                  )}
                  
                  {activeTab === 'favorites' && (
                    <div className="text-xs text-gray-500 mt-1">Added: {formatTimestamp(book.addedDate)}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="px-4 pb-4 space-y-3">
            {getActiveBooks().map(book => (
              <div 
                key={book.id} 
                className="bg-white rounded-lg shadow p-3 flex cursor-pointer"
                onClick={() => navigate(`/book/${book.id}`)}
              >
                <div className={`${getCoverClass(book.id)} w-16 h-24 rounded flex-shrink-0 relative`}>
                  {activeTab === 'reading' && (
                    <div className="absolute bottom-0 left-0 right-0 bg-indigo-700 text-white text-xs p-0.5 text-center">
                      {book.progress}%
                    </div>
                  )}
                </div>
                <div className="ml-3 flex-1">
                  <div className="font-semibold">{book.title}</div>
                  <div className="text-sm text-gray-500">{book.author}</div>
                  
                  {activeTab === 'reading' && (
                    <div className="text-xs text-gray-500 mt-2">Last read: {formatTimestamp(book.lastUpdated)}</div>
                  )}
                  
                  {activeTab === 'toread' && (
                    <div className="text-xs text-gray-500 mt-2">Added: {formatTimestamp(book.addedDate)}</div>
                  )}
                  
                  {activeTab === 'completed' && (
                    <div className="flex items-center mt-2">
                      <div className="flex">
                        {[...Array(Math.floor(book.rating))].map((_, i) => (
                          <Star key={i} className="h-4 w-4 text-yellow-500 fill-current" />
                        ))}
                        {book.rating % 1 !== 0 && (
                          <Star className="h-4 w-4 text-yellow-500 fill-current" style={{ clipPath: 'polygon(0 0, 50% 0, 50% 100%, 0 100%)' }} />
                        )}
                      </div>
                      <div className="text-xs text-gray-500 ml-2">{formatTimestamp(book.completedDate)}</div>
                    </div>
                  )}
                  
                  {activeTab === 'favorites' && (
                    <div className="text-xs text-gray-500 mt-2">
                      <Heart className="h-4 w-4 text-red-500 fill-current inline-block mr-1" />
                      Added: {formatTimestamp(book.addedDate)}
                    </div>
                  )}
                </div>
                {activeTab === 'favorites' ? (
                  <button 
                    className="text-gray-400 hover:text-red-500"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveFromFavorites(book.id);
                    }}
                  >
                    <X className="h-5 w-5" />
                  </button>
                ) : (
                  <button 
                    className="text-gray-400"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/book/${book.id}`);
                    }}
                  >
                    <MoreHorizontal className="h-5 w-5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default MyBooksPage;