// src/pages/BookDetailPage.jsx
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Star, Users, Clock, BookOpen, Heart, Calendar, 
  FileText, Check, Award, Languages, Film, Tag, Edit, Save, X,
  Play, Pause, Timer, ChevronDown, ChevronUp, BarChart2
} from 'lucide-react';
import TopNavigation from '../Components/TopNavigation';
import { useAuth } from '../auth/AuthContext';
import bookService from '../services/bookService';
import { getConsistentColor } from '../utils/colorUtils';

// Keep all utility functions unchanged
const getColorClass = (colorName) => {
  const colorMap = {
    'red': 'bg-red-200',
    'blue': 'bg-blue-200',
    'green': 'bg-green-200',
    'yellow': 'bg-yellow-200',
    'purple': 'bg-purple-200',
    'pink': 'bg-pink-200',
    'indigo': 'bg-indigo-200',
    'gray': 'bg-gray-200',
    'default': 'bg-gray-200'
  };
  
  return colorMap[colorName] || colorMap.default;
};

const getTextColorClass = (colorName) => {
  const colorMap = {
    'red': 'text-red-700',
    'blue': 'text-blue-700',
    'green': 'text-green-700',
    'yellow': 'text-yellow-700',
    'purple': 'text-purple-700',
    'pink': 'text-pink-700',
    'indigo': 'text-indigo-700',
    'gray': 'text-gray-700',
    'default': 'text-gray-700'
  };
  
  return colorMap[colorName] || colorMap.default;
};

const getHoverBgClass = (colorName) => {
  const colorMap = {
    'red': 'hover:bg-red-200',
    'blue': 'hover:bg-blue-200',
    'green': 'hover:bg-green-200',
    'yellow': 'hover:bg-yellow-200',
    'purple': 'hover:bg-purple-200',
    'pink': 'hover:bg-pink-200',
    'indigo': 'hover:bg-indigo-200',
    'gray': 'hover:bg-gray-200',
    'default': 'hover:bg-gray-200'
  };
  
  return colorMap[colorName] || colorMap.default;
};

const getLightBgClass = (colorName) => {
  const colorMap = {
    'red': 'bg-red-100',
    'blue': 'bg-blue-100',
    'green': 'bg-green-100',
    'yellow': 'bg-yellow-100',
    'purple': 'bg-purple-100',
    'pink': 'bg-pink-100',
    'indigo': 'bg-indigo-100',
    'gray': 'bg-gray-100',
    'default': 'bg-gray-100'
  };
  
  return colorMap[colorName] || colorMap.default;
};

const safeToString = (value) => {
  if (value === null || value === undefined) {
    return '';
  }
  
  if (typeof value === 'object') {
    if (value.toString !== Object.prototype.toString) {
      return value.toString();
    }
    
    if (value.hasOwnProperty('low') && value.hasOwnProperty('high')) {
      return `${value.low}`;
    }
    
    try {
      return JSON.stringify(value);
    } catch (e) {
      return '[Object]';
    }
  }
  
  return String(value);
};

const formatDecimal = (value) => {
  if (value === null || value === undefined) {
    return '0.0';
  }
  
  let numValue = value;
  if (typeof value !== 'number') {
    numValue = parseFloat(value);
  }
  
  if (isNaN(numValue)) {
    return '0.0';
  }
  
  return numValue.toFixed(1);
};

// Format time (minutes) to hours and minutes
const formatTime = (minutes) => {
  if (!minutes) return "0h 0m";
  
  // Ensure minutes is a Number, not BigInt
  const mins = typeof minutes === 'bigint' ? Number(minutes) : Number(minutes || 0);
  const hours = Math.floor(mins / 60);
  const remainingMins = Math.floor(mins % 60);
  return `${hours}h ${remainingMins}m`;
};

// Format date to readable format
const formatDate = (dateString) => {
  if (!dateString) return "";
  
  const date = new Date(dateString);
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

// Helper to safely convert any value to a number
const safeNumber = (value) => {
  if (value === null || value === undefined) {
    return 0;
  }
  
  if (typeof value === 'bigint') {
    return Number(value);
  }
  
  if (typeof value === 'object' && 'low' in value && 'high' in value) {
    return Number(value.low);
  }
  
  if (typeof value === 'string' && !isNaN(value)) {
    return Number(value);
  }
  
  return Number(value || 0);
};

const BookDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [book, setBook] = useState(null);
  const [loading, setLoading] = useState(true);
  const [readingStatus, setReadingStatus] = useState('none'); // none, want-to-read, reading, finished
  const [userRating, setUserRating] = useState(0);
  const [error, setError] = useState(null);
  
  // Confirmation dialog state
  const [showFinishedConfirm, setShowFinishedConfirm] = useState(false);
  
  // Review state management
  const [userReview, setUserReview] = useState('');
  const [isEditingReview, setIsEditingReview] = useState(false);
  const [reviewDraft, setReviewDraft] = useState('');
  
  // Reading Session states
  const [activeSession, setActiveSession] = useState(null);
  const [isReading, setIsReading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [timerInterval, setTimerInterval] = useState(null);
  const [sessionNotes, setSessionNotes] = useState('');
  const [showSessionForm, setShowSessionForm] = useState(false);
  const [readingSessions, setReadingSessions] = useState([]);
  const [showSessionHistory, setShowSessionHistory] = useState(false);
  
  useEffect(() => {
    if (!currentUser) {
      navigate('/signin');
      return;
    }
    
    const loadBookDetails = async () => {
      try {
        setLoading(true);
        const bookData = await bookService.getBookById(id);
        
        if (!bookData) {
          navigate('/not-found');
          return;
        }
        
        setBook(bookData);
        
        // Get user's reading status for this book
        const status = await bookService.getUserBookStatus(currentUser.id, id);
        setReadingStatus(status?.status || 'none');
        setUserRating(status?.rating || 0);
        
        // If user is reading, set current page
        if (status?.status === 'reading' && status?.currentPage) {
          setCurrentPage(status.currentPage);
        }
        
        // Get user's review for this book
        const review = await bookService.getUserBookReview(currentUser.id, id);
        setUserReview(review || '');
        setReviewDraft(review || '');
        
        // Check for active reading session
        const activeSessionData = await bookService.getActiveReadingSession(currentUser.id, id);
        if (activeSessionData) {
          setActiveSession(activeSessionData);
          setIsReading(true);
          setCurrentPage(activeSessionData.startPage);
          setElapsedTime(activeSessionData.currentDuration);
          
          // Start timer from current duration
          const interval = setInterval(() => {
            setElapsedTime(prev => prev + 1);
          }, 60000); // Update every minute
          setTimerInterval(interval);
        }
        
        // Get reading sessions history
        const sessions = await bookService.getBookReadingSessions(currentUser.id, id);
        setReadingSessions(sessions);
        
      } catch (error) {
        console.error("Error loading book details:", error);
        setError(error.message || "Failed to load book details");
      } finally {
        setLoading(false);
      }
    };
    
    loadBookDetails();
    
    // Clean up timer on unmount
    return () => {
      if (timerInterval) {
        clearInterval(timerInterval);
      }
    };
  }, [id, currentUser, navigate]);
  
  const handleStatusChange = async (newStatus) => {
    try {
      // Special handling for "Read Again" scenario
      if (readingStatus === 'finished' && newStatus === 'reading') {
        // Reset reading progress
        await bookService.updateUserBookStatus(currentUser.id, id, newStatus, 1);
        setReadingStatus(newStatus);
        setCurrentPage(1); // Reset to page 1
        setShowSessionForm(true);
        return;
      }
      
      // Special handling for marking as finished
      if (newStatus === 'finished') {
        // If there's an active session, show confirmation dialog
        if (isReading && activeSession) {
          setShowFinishedConfirm(true);
          return;
        }
        
        // Otherwise just mark as finished
        await bookService.updateUserBookStatus(currentUser.id, id, newStatus);
        setReadingStatus(newStatus);
        return;
      }
      
      // Normal status change
      await bookService.updateUserBookStatus(currentUser.id, id, newStatus, 
        newStatus === 'reading' ? currentPage : null);
      setReadingStatus(newStatus);
      
      if (newStatus === 'reading' && !isReading) {
        setShowSessionForm(true);
      }
    } catch (error) {
      console.error("Error updating reading status:", error);
    }
  };
  
  // Handle finishing book with active session
  const handleFinishWithSession = async () => {
    try {
      // End the active session first
      await handleStopReading();
      
      // Then mark as finished
      await bookService.updateUserBookStatus(currentUser.id, id, 'finished');
      setReadingStatus('finished');
      
      // Close the dialog
      setShowFinishedConfirm(false);
    } catch (error) {
      console.error("Error finishing book:", error);
    }
  };
  
  const handleRatingChange = async (rating) => {
    try {
      await bookService.rateBook(currentUser.id, id, rating);
      setUserRating(rating);
    } catch (error) {
      console.error("Error setting rating:", error);
    }
  };
  
  const handleReviewEdit = () => {
    setIsEditingReview(true);
    setReviewDraft(userReview);
  };
  
  const handleReviewCancel = () => {
    setIsEditingReview(false);
    setReviewDraft(userReview);
  };
  
  const handleReviewSave = async () => {
    try {
      await bookService.reviewBook(currentUser.id, id, reviewDraft);
      setUserReview(reviewDraft);
      setIsEditingReview(false);
    } catch (error) {
      console.error("Error saving review:", error);
    }
  };
  
  // Reading Session handlers
  const handleStartReading = async () => {
    try {
      const sessionId = await bookService.startReadingSession(
        currentUser.id, 
        id,
        currentPage
      );
      
      if (sessionId) {
        setActiveSession({ sessionId, startPage: currentPage });
        setIsReading(true);
        setElapsedTime(0);
        setShowSessionForm(false);
        
        if (readingStatus !== 'reading') {
          await bookService.updateUserBookStatus(currentUser.id, id, 'reading', currentPage);
          setReadingStatus('reading');
        }
        
        // Start timer
        const interval = setInterval(() => {
          setElapsedTime(prev => prev + 1);
        }, 60000); // Update every minute
        setTimerInterval(interval);
      }
    } catch (error) {
      console.error("Error starting reading session:", error);
    }
  };
  
  const handleStopReading = async () => {
    try {
      if (timerInterval) {
        clearInterval(timerInterval);
        setTimerInterval(null);
      }
      
      if (activeSession) {
        const result = await bookService.endReadingSession(
          activeSession.sessionId,
          currentPage,
          sessionNotes
        );
        
        if (result) {
          // Refresh reading sessions list
          const sessions = await bookService.getBookReadingSessions(currentUser.id, id);
          setReadingSessions(sessions);
          
          setActiveSession(null);
          setIsReading(false);
          setElapsedTime(0);
          setSessionNotes('');
        }
      }
    } catch (error) {
      console.error("Error stopping reading session:", error);
    }
  };
  
  const handleUpdatePage = async () => {
    try {
      await bookService.updateCurrentPage(currentUser.id, id, currentPage);
    } catch (error) {
      console.error("Error updating page:", error);
    }
  };
  
  if (loading) {
    return (
      <div className="flex flex-col h-screen bg-gray-100">
        <TopNavigation />
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
        </div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="flex flex-col h-screen bg-gray-100">
        <TopNavigation />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-red-600">{error}</div>
        </div>
      </div>
    );
  }
  
  if (!book) {
    return (
      <div className="flex flex-col h-screen bg-gray-100">
        <TopNavigation />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-gray-600">Book details not available.</div>
        </div>
      </div>
    );
  }
  
  const bookColorName = getConsistentColor(book?.id || '');
  const bookColorClass = getColorClass(bookColorName);
  
  return (
    <div className="flex flex-col min-h-screen bg-gray-100">
      <TopNavigation />
      
      <div className="flex-1">
        <div className="max-w-4xl mx-auto p-4">
          {/* Navigation */}
          <div className="mb-6">
            <button 
              onClick={() => navigate(-1)}
              className="flex items-center text-indigo-600 hover:text-indigo-800"
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              <span>Back</span>
            </button>
          </div>
          
          {/* Book Header - Keep existing code */}
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <div className="flex flex-col md:flex-row">
              <div className={`${bookColorClass} w-32 h-48 rounded shadow-md flex-shrink-0 mb-4 md:mb-0`}></div>
              
              <div className="md:ml-6 flex-1">
                <h1 className="text-2xl font-bold text-gray-800">{safeToString(book?.title) || 'Untitled'}</h1>
                <p className="text-lg text-indigo-600 mb-2">
                  by <span 
                    className="cursor-pointer hover:underline" 
                    onClick={() => navigate(`/author/${safeToString(book?.authorId || '')}`)}
                  >
                    {safeToString(book?.author) || 'Unknown Author'}
                  </span>
                </p>
                
                {/* Book meta information */}
                <div className="grid grid-cols-2 gap-2 mb-4">
                  {book?.publishedYear && (
                    <div className="flex items-center text-sm text-gray-600">
                      <Calendar className="h-4 w-4 mr-1" />
                      <span>Published: {safeToString(book.publishedYear)}</span>
                    </div>
                  )}
                  
                  {book?.pageCount && (
                    <div className="flex items-center text-sm text-gray-600">
                      <FileText className="h-4 w-4 mr-1" />
                      <span>{safeToString(book.pageCount)} pages</span>
                    </div>
                  )}
                  
                  {book?.language && (
                    <div className="flex items-center text-sm text-gray-600">
                      <Languages className="h-4 w-4 mr-1" />
                      <span>Language: {safeToString(book.language)}</span>
                    </div>
                  )}
                  
                  {book?.averageRating && (
                    <div className="flex items-center text-sm text-gray-600">
                      <Star className="h-4 w-4 mr-1 text-yellow-500 fill-current" />
                      <span>{formatDecimal(book.averageRating)} ({safeToString(book?.ratingsCount || 0)} ratings)</span>
                    </div>
                  )}
                </div>
                
                {/* Book tags/genres */}
                {book?.genres && book.genres.length > 0 && (
                  <div className="flex flex-wrap mb-4">
                    {book.genres.map((genre, index) => {
                      const genreId = typeof genre === 'object' ? genre?.id : genre;
                      const genreName = typeof genre === 'object' ? genre?.name : genre;
                      
                      if (!genreName) return null;
                      
                      const genreColor = getConsistentColor(safeToString(genreName));
                      const genreBgClass = getLightBgClass(genreColor);
                      const genreTextClass = getTextColorClass(genreColor);
                      const genreHoverClass = getHoverBgClass(genreColor);
                      
                      return (
                        <div 
                          key={index}
                          className={`${genreBgClass} ${genreTextClass} px-2 py-1 rounded-full text-xs mr-2 mb-2 cursor-pointer ${genreHoverClass}`}
                          onClick={() => navigate(`/genre/${safeToString(genreId || genreName)}`)}
                        >
                          {safeToString(genreName)}
                        </div>
                      );
                    })}
                  </div>
                )}
                
                {/* User actions */}
                <div className="flex space-x-2">
                  {/* Show "Want to Read" only if not currently reading or finished */}
                  {readingStatus !== 'reading' && readingStatus !== 'finished' && (
                    <button
                      className={`px-3 py-1 rounded-full text-sm font-medium flex items-center ${
                        readingStatus === 'want-to-read' 
                          ? 'bg-indigo-600 text-white' 
                          : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                      }`}
                      onClick={() => handleStatusChange('want-to-read')}
                    >
                      <Heart className="h-4 w-4 mr-1" />
                      Want to Read
                    </button>
                  )}
                  
                  {/* Show "Reading" for all states (can always start or resume reading) */}
                  <button
                    className={`px-3 py-1 rounded-full text-sm font-medium flex items-center ${
                      readingStatus === 'reading' 
                        ? 'bg-indigo-600 text-white' 
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                    onClick={() => handleStatusChange('reading')}
                  >
                    <BookOpen className="h-4 w-4 mr-1" />
                    {readingStatus === 'finished' ? 'Read Again' : 'Reading'}
                  </button>
                  
                  {/* Show "Finished" button */}
                  <button
                    className={`px-3 py-1 rounded-full text-sm font-medium flex items-center ${
                      readingStatus === 'finished' 
                        ? 'bg-indigo-600 text-white' 
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                    onClick={() => handleStatusChange('finished')}
                  >
                    <Check className="h-4 w-4 mr-1" />
                    Finished
                  </button>
                </div>
                
                {/* Rating */}
                <div className="mt-4">
                  <div className="text-sm text-gray-600 mb-1">Your Rating:</div>
                  <div className="flex space-x-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star 
                        key={star}
                        className={`h-5 w-5 cursor-pointer ${
                          star <= userRating ? 'text-yellow-500 fill-current' : 'text-gray-300'
                        }`}
                        onClick={() => handleRatingChange(star)}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          {/* Reading Session Tracker - NEW COMPONENT */}
          {readingStatus === 'reading' && (
            <div className="bg-white rounded-lg shadow p-6 mb-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-gray-800">Reading Tracker</h2>
                {!isReading && !showSessionForm && (
                  <button
                    onClick={() => setShowSessionForm(true)}
                    className="bg-indigo-600 text-white px-3 py-1 rounded-md flex items-center"
                  >
                    <Play className="h-4 w-4 mr-1" /> Start Session
                  </button>
                )}
              </div>
              
              {isReading ? (
                <div className="space-y-4">
                  {/* Active reading session */}
                  <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                    <div className="flex justify-between items-center mb-2">
                      <h3 className="font-medium text-green-800">Reading in progress</h3>
                      <div className="text-xl font-bold text-green-700">{formatTime(elapsedTime)}</div>
                    </div>
                    <p className="text-sm text-green-600 mb-4">
                      Started on page {activeSession?.startPage}
                    </p>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Current Page
                        </label>
                        <div className="flex">
                          <input
                            type="number"
                            min={activeSession?.startPage || 1}
                            max={book?.pageCount || 9999}
                            value={currentPage}
                            onChange={(e) => setCurrentPage(parseInt(e.target.value, 10) || activeSession?.startPage || 1)}
                            className="w-full p-2 border border-gray-300 rounded-l-md"
                          />
                          <button
                            onClick={handleUpdatePage}
                            className="bg-gray-200 hover:bg-gray-300 px-3 py-2 rounded-r-md text-gray-700"
                          >
                            Update
                          </button>
                        </div>
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Session Notes
                        </label>
                        <textarea
                          value={sessionNotes}
                          onChange={(e) => setSessionNotes(e.target.value)}
                          className="w-full p-2 border border-gray-300 rounded-md h-20"
                          placeholder="Add notes about this reading session..."
                        />
                      </div>
                    </div>
                    
                    <button
                      onClick={handleStopReading}
                      className="w-full md:w-auto px-4 py-2 bg-red-600 text-white rounded-lg flex items-center justify-center"
                    >
                      <Pause className="h-4 w-4 mr-2" /> End Reading Session
                    </button>
                  </div>
                </div>
              ) : showSessionForm ? (
                <div className="p-4 border border-gray-200 rounded-lg">
                  <h3 className="font-medium text-gray-800 mb-3">Start a new reading session</h3>
                  <div className="mb-3">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Starting Page
                    </label>
                    <input
                      type="number"
                      min="1"
                      max={book?.pageCount || 9999}
                      value={currentPage}
                      onChange={(e) => setCurrentPage(parseInt(e.target.value, 10) || 1)}
                      className="w-full p-2 border border-gray-300 rounded-md"
                    />
                  </div>
                  
                  <div className="flex space-x-2">
                    <button
                      onClick={handleStartReading}
                      className="px-4 py-2 bg-indigo-600 text-white rounded-md flex items-center"
                    >
                      <Play className="h-4 w-4 mr-1" /> Start Reading
                    </button>
                    
                    <button
                      onClick={() => setShowSessionForm(false)}
                      className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md flex items-center"
                    >
                      <X className="h-4 w-4 mr-1" /> Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-gray-700">
                      You're currently on page <span className="font-bold">{currentPage}</span> of <span className="font-bold">{safeNumber(book?.pageCount) || 'unknown'}</span> pages
                      {book?.pageCount > 0 && ` (${Math.round((currentPage / safeNumber(book.pageCount)) * 100)}% complete)`}.
                    </p>
                  </div>
                  
                  {book?.pageCount && (
                    <div className="h-2 bg-gray-200 rounded-full mb-4">
                      <div 
                        className="h-2 bg-indigo-600 rounded-full" 
                        style={{ width: `${Math.min(100, Math.round((currentPage / safeNumber(book.pageCount)) * 100))}%` }}
                      ></div>
                    </div>
                  )}
                </div>
              )}
              
              {/* Reading history */}
              {readingSessions.length > 0 && (
                <div className="mt-6">
                  <div 
                    className="flex items-center justify-between cursor-pointer"
                    onClick={() => setShowSessionHistory(!showSessionHistory)}
                  >
                    <h3 className="font-medium text-gray-800">Reading History ({readingSessions.length})</h3>
                    {showSessionHistory ? 
                      <ChevronUp className="h-5 w-5 text-gray-500" /> : 
                      <ChevronDown className="h-5 w-5 text-gray-500" />
                    }
                  </div>
                  
                  {showSessionHistory && (
                    <div className="mt-2 overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Pages</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Duration</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Notes</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {readingSessions.map((session, index) => (
                            <tr key={session.sessionId || index}>
                              <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-700">
                                {formatDate(session.endTime)}
                              </td>
                              <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-700">
                                {session.startPage} - {session.endPage} 
                                <span className="text-gray-500 text-xs ml-1">
                                  ({session.pagesRead} pages)
                                </span>
                              </td>
                              <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-700">
                                {formatTime(session.duration)}
                              </td>
                              <td className="px-4 py-2 text-sm text-gray-700 max-w-xs truncate">
                                {session.notes || '-'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
          
          {/* Book Description - Unchanged */}
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4">Description</h2>
            <div className="text-gray-700">
              {book?.description ? (
                <p>{safeToString(book.description)}</p>
              ) : (
                <p className="text-gray-500 italic">No description available</p>
              )}
            </div>
          </div>
          
          {/* User Review - Unchanged */}
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-800">Your Review</h2>
              
              {!isEditingReview && (
                <button 
                  onClick={handleReviewEdit}
                  className="flex items-center text-indigo-600 hover:text-indigo-800"
                >
                  <Edit className="h-4 w-4 mr-1" />
                  <span>{userReview ? 'Edit Review' : 'Add Review'}</span>
                </button>
              )}
            </div>
            
            {isEditingReview ? (
              <div>
                <textarea 
                  value={reviewDraft}
                  onChange={(e) => setReviewDraft(e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent min-h-32"
                  placeholder="Write your review here..."
                />
                
                <div className="flex justify-end mt-3 space-x-2">
                  <button 
                    onClick={handleReviewCancel}
                    className="px-3 py-1 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-100 flex items-center"
                  >
                    <X className="h-4 w-4 mr-1" />
                    Cancel
                  </button>
                  
                  <button 
                    onClick={handleReviewSave}
                    className="px-3 py-1 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 flex items-center"
                  >
                    <Save className="h-4 w-4 mr-1" />
                    Save
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-gray-700 min-h-16">
                {userReview ? (
                  <p>{userReview}</p>
                ) : (
                  <p className="text-gray-500 italic">You haven't reviewed this book yet</p>
                )}
              </div>
            )}
          </div>
          
          {/* Reading statistics - Enhanced with session data */}
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4">Reading Stats</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-indigo-50 p-4 rounded-lg text-center">
                <Users className="h-6 w-6 text-indigo-600 mx-auto mb-2" />
                <div className="text-2xl font-bold text-indigo-700">{safeToString(book?.readersCount || 0)}</div>
                <div className="text-xs text-gray-600">Currently Reading</div>
              </div>
              
              <div className="bg-green-50 p-4 rounded-lg text-center">
                <Check className="h-6 w-6 text-green-600 mx-auto mb-2" />
                <div className="text-2xl font-bold text-green-700">{safeToString(book?.finishedCount || 0)}</div>
                <div className="text-xs text-gray-600">Completed</div>
              </div>
              
              <div className="bg-yellow-50 p-4 rounded-lg text-center">
                <Star className="h-6 w-6 text-yellow-600 mx-auto mb-2" />
                <div className="text-2xl font-bold text-yellow-700">{formatDecimal(book?.averageRating)}</div>
                <div className="text-xs text-gray-600">Average Rating</div>
              </div>
              
              <div className="bg-purple-50 p-4 rounded-lg text-center">
                <Clock className="h-6 w-6 text-purple-600 mx-auto mb-2" />
                <div className="text-2xl font-bold text-purple-700">
                  {readingSessions.length > 0 
                    ? formatTime(readingSessions.reduce((sum, session) => {
                        return sum + safeNumber(session.duration);
                      }, 0) / readingSessions.length)
                    : 'N/A'}
                </div>
                <div className="text-xs text-gray-600">Avg Session Time</div>
              </div>
            </div>
            
            {readingSessions.length > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-200">
                <h3 className="font-medium text-gray-800 mb-2">Your Reading Insights</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-blue-50 rounded-lg p-3 flex items-center">
                    <div className="p-2 rounded-full bg-blue-100 mr-3">
                      <Timer className="h-5 w-5 text-blue-700" />
                    </div>
                    <div>
                      <div className="text-sm font-medium">Total Reading Time</div>
                      <div className="text-lg font-bold text-blue-700">
                        {formatTime(readingSessions.reduce((sum, session) => {
                          return sum + safeNumber(session.duration);
                        }, 0))}
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-green-50 rounded-lg p-3 flex items-center">
                    <div className="p-2 rounded-full bg-green-100 mr-3">
                      <FileText className="h-5 w-5 text-green-700" />
                    </div>
                    <div>
                      <div className="text-sm font-medium">Pages Read</div>
                      <div className="text-lg font-bold text-green-700">
                        {readingSessions.reduce((sum, session) => {
                          return sum + safeNumber(session.pagesRead);
                        }, 0)}
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-purple-50 rounded-lg p-3 flex items-center">
                    <div className="p-2 rounded-full bg-purple-100 mr-3">
                      <BarChart2 className="h-5 w-5 text-purple-700" />
                    </div>
                    <div>
                      <div className="text-sm font-medium">Reading Speed</div>
                      <div className="text-lg font-bold text-purple-700">
                        {(() => {
                          // Safe calculation of reading speed
                          const totalPages = readingSessions.reduce((sum, session) => {
                            return sum + safeNumber(session.pagesRead);
                          }, 0);
                          
                          const totalDuration = readingSessions.reduce((sum, session) => {
                            return sum + safeNumber(session.duration);
                          }, 0);
                          
                          return totalDuration > 0 
                            ? Math.round((totalPages * 60) / totalDuration) 
                            : 0;
                        })()} pages/hr
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
          
          {/* Keep other sections unchanged */}
          {/* Friends reading this book */}
          {book?.friendsReading && book.friendsReading.length > 0 && (
            <div className="bg-white rounded-lg shadow p-6 mb-6">
              <h2 className="text-xl font-bold text-gray-800 mb-4">Friends Reading This Book</h2>
              <div className="space-y-4">
                {book.friendsReading.map((friend) => (
                  <div key={friend?.id || Math.random()} className="flex items-center">
                    <div className="w-10 h-10 rounded-full bg-gray-300 flex items-center justify-center">
                      <div className="text-gray-600">{
                        friend?.name ? safeToString(friend.name.charAt(0)) : '?'
                      }</div>
                    </div>
                    <div className="ml-3">
                      <div className="font-medium text-gray-800">{safeToString(friend?.name || 'Unknown')}</div>
                      <div className="text-xs text-gray-500">
                        {friend?.status === 'reading' ? 'Currently reading' : 
                         friend?.status === 'finished' ? 'Has finished reading' : 
                         'Wants to read'}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* Similar books */}
          {book?.similarBooks && book.similarBooks.length > 0 && (
            <div className="bg-white rounded-lg shadow p-6 mb-6">
              <h2 className="text-xl font-bold text-gray-800 mb-4">Similar Books</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {book.similarBooks.map((similarBook) => {
                  const similarBookColor = getConsistentColor(safeToString(similarBook?.id || ''));
                  const similarBookColorClass = getColorClass(similarBookColor);
                  
                  return (
                    <div 
                      key={similarBook?.id || Math.random()}
                      className="cursor-pointer"
                      onClick={() => navigate(`/book/${safeToString(similarBook?.id || '')}`)}
                    >
                      <div className={`${similarBookColorClass} h-32 rounded-lg shadow mb-2`}></div>
                      <div className="text-sm font-medium text-gray-800 truncate">{safeToString(similarBook?.title || 'Untitled')}</div>
                      <div className="text-xs text-gray-500">{safeToString(similarBook?.author || 'Unknown Author')}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          
          {/* Book adaptations */}
          {book?.adaptations && book.adaptations.length > 0 && (
            <div className="bg-white rounded-lg shadow p-6 mb-6">
              <h2 className="text-xl font-bold text-gray-800 mb-4">Adaptations</h2>
              <div className="space-y-4">
                {book.adaptations.map((adaptation) => (
                  <div key={adaptation?.id || Math.random()} className="flex items-start">
                    <div className="bg-red-100 w-16 h-24 rounded flex-shrink-0"></div>
                    <div className="ml-4">
                      <div className="font-medium text-gray-800">{safeToString(adaptation?.title || 'Untitled')}</div>
                      <div className="text-sm text-gray-600">{safeToString(adaptation?.releaseYear || '')}</div>
                      <div className="text-xs text-gray-500 mt-1">Director: {safeToString(adaptation?.director || 'Unknown')}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {/* Finished Confirmation Modal */}
          {showFinishedConfirm && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg shadow-lg p-6 max-w-md mx-4">
                <h3 className="text-lg font-bold text-gray-800 mb-3">Finish Reading?</h3>
                <p className="text-gray-600 mb-4">
                  You have an active reading session. Would you like to end your current session and mark this book as finished?
                </p>
                <div className="flex justify-end space-x-3">
                  <button
                    onClick={() => setShowFinishedConfirm(false)}
                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleFinishWithSession}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
                  >
                    End Session & Finish
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Create an Error Boundary component
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error("Error caught by boundary:", error, errorInfo);
    this.setState({ error, errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-4 text-center">
          <h2 className="text-xl font-bold text-red-600 mb-2">Something went wrong</h2>
          <p className="text-gray-700 mb-4">The application encountered an error.</p>
          <button 
            onClick={() => window.location.reload()} 
            className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
          >
            Reload Page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

// Export the component with the Error Boundary
export default function BookDetailPageWithErrorBoundary() {
  return (
    <ErrorBoundary>
      <BookDetailPage />
    </ErrorBoundary>
  );
};