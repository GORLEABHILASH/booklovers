import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  User, LogOut, BookOpen, BookMarked, BookCheck,
  Star, UserPlus, Users, MessageCircle, Calendar,
  Book, Heart, Settings, Edit, Save, X, Globe,
  Briefcase, Gamepad2, HeartHandshake, Plus
} from 'lucide-react';
import TopNavigation from '../Components/TopNavigation';
import { useAuth } from '../auth/AuthContext';
import userService from '../services/userService';

const ProfilePage = () => {
  const { currentUser, signOut } = useAuth();
  const navigate = useNavigate();

  const [userProfile, setUserProfile] = useState(null);
  const [readingStats, setReadingStats] = useState(null);
  const [preferences, setPreferences] = useState(null);
  const [socialData, setSocialData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Separate editing states for different sections
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [isEditingPreferences, setIsEditingPreferences] = useState(false);
  const [isEditingBookClubs, setIsEditingBookClubs] = useState(false);

  const [editedProfile, setEditedProfile] = useState({});
  const [editedPreferences, setEditedPreferences] = useState({});

  // Book club related states
  const [availableBookClubs, setAvailableBookClubs] = useState([]);
  const [showJoinClubModal, setShowJoinClubModal] = useState(false);
  const [selectedClubToJoin, setSelectedClubToJoin] = useState(null);

  // Dropdown options
  const [countries, setCountries] = useState([]);
  const [states, setStates] = useState([]);
  const [cities, setCities] = useState([]);
  const [allStates, setAllStates] = useState([]);
  const [allCities, setAllCities] = useState([]);
  const [professions, setProfessions] = useState([]);
  const [hobbiesOptions, setHobbiesOptions] = useState([]);
  const [genreOptions, setGenreOptions] = useState([]);
  const [authorOptions, setAuthorOptions] = useState([]);
  const [themeOptions, setThemeOptions] = useState([]);

  useEffect(() => {
    if (!currentUser) {
      navigate('/signin');
      return;
    }

    const fetchAllUserData = async () => {
      try {
        setLoading(true);

        const [profile, stats, prefs, social, locationsData, optionsData, readingOptionsData, clubs] = await Promise.all([
          userService.getUserProfileById(currentUser.id),
          userService.getUserReadingStats(currentUser.id),
          userService.getUserPreferences(currentUser.id),
          userService.getUserSocialData(currentUser.id),
          userService.getAllLocations(),
          userService.getAllOptions(),
          userService.getAllReadingOptions(),
          userService.getAvailableBookClubs(currentUser.id)
        ]);

        setUserProfile(profile);
        setReadingStats(stats);
        setPreferences(prefs);
        setSocialData(social);
        setEditedProfile(profile);
        setEditedPreferences(prefs);
        setAvailableBookClubs(clubs);

        // Set location data
        setCountries(locationsData.countries);
        setAllStates(locationsData.states);
        setAllCities(locationsData.cities);

        // Set options data
        setProfessions(optionsData.professions);
        setHobbiesOptions(optionsData.hobbies);

        // Set reading options data
        setGenreOptions(readingOptionsData.genres);
        setAuthorOptions(readingOptionsData.authors);
        setThemeOptions(readingOptionsData.themes);

        // Set initial states and cities based on user's current country
        if (profile?.country) {
          const filteredStates = locationsData.states.filter(state => state.country === profile.country);
          setStates(filteredStates);

          if (profile?.state) {
            const filteredCities = locationsData.cities.filter(city => city.state === profile.state);
            setCities(filteredCities);
          }
        }

        setError(null);
      } catch (err) {
        setError('Failed to fetch user data');
        console.error('Error fetching user data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchAllUserData();
  }, [currentUser?.id, navigate]);

  // Profile editing handlers
  const handleEditProfile = () => {
    setEditedProfile({
      ...userProfile,
      selectedHobbies: userProfile.hobbies ? userProfile.hobbies.split(',').map(h => h.trim()) : []
    });
    setIsEditingProfile(true);
  };

  const handleCancelProfile = () => {
    setEditedProfile(userProfile);
    setIsEditingProfile(false);
  };

  const handleSaveProfile = async () => {
    try {
      const profileToSave = {
        ...editedProfile,
        hobbies: editedProfile.selectedHobbies ? editedProfile.selectedHobbies.join(', ') : ''
      };
      const updatedProfile = await userService.updateUserProfile(currentUser.id, profileToSave);
      setUserProfile(updatedProfile);
      setIsEditingProfile(false);
    } catch (err) {
      setError('Failed to update profile');
      console.error('Error updating profile:', err);
    }
  };

  // Preferences editing handlers
  const handleEditPreferences = () => {
    setEditedPreferences({ ...preferences });
    setIsEditingPreferences(true);
  };

  const handleCancelPreferences = () => {
    setEditedPreferences(preferences);
    setIsEditingPreferences(false);
  };

  const handleSavePreferences = async () => {
    try {
      const updatedPreferences = await userService.updateUserPreferences(currentUser.id, editedPreferences);
      setPreferences(updatedPreferences);
      setIsEditingPreferences(false);
    } catch (err) {
      setError('Failed to update preferences');
      console.error('Error updating preferences:', err);
    }
  };

  // Book club handlers
  const handleEditBookClubs = () => {
    setIsEditingBookClubs(true);
  };

  const handleCancelBookClubs = () => {
    setIsEditingBookClubs(false);
  };

  const handleJoinClub = async (clubId) => {
    try {
      await userService.joinBookClub(currentUser.id, clubId);
      const updatedSocialData = await userService.getUserSocialData(currentUser.id);
      const updatedAvailableClubs = await userService.getAvailableBookClubs(currentUser.id);
      setSocialData(updatedSocialData);
      setAvailableBookClubs(updatedAvailableClubs);
      setShowJoinClubModal(false);
    } catch (err) {
      setError('Failed to join book club');
      console.error('Error joining book club:', err);
    }
  };

  const handleLeaveClub = async (clubId) => {
    try {
      await userService.leaveBookClub(currentUser.id, clubId);
      const updatedSocialData = await userService.getUserSocialData(currentUser.id);
      const updatedAvailableClubs = await userService.getAvailableBookClubs(currentUser.id);
      setSocialData(updatedSocialData);
      setAvailableBookClubs(updatedAvailableClubs);
    } catch (err) {
      setError('Failed to leave book club');
      console.error('Error leaving book club:', err);
    }
  };

  // Input handlers
  const handleInputChange = (field, value) => {
    setEditedProfile(prev => ({ ...prev, [field]: value }));

    // Handle location cascading
    if (field === 'country') {
      const filteredStates = allStates.filter(state => state.country === value);
      setStates(filteredStates);
      setCities([]);
      setEditedProfile(prev => ({ ...prev, state: '', city: '' }));
    } else if (field === 'state') {
      const filteredCities = allCities.filter(city => city.state === value);
      setCities(filteredCities);
      setEditedProfile(prev => ({ ...prev, city: '' }));
    }
  };

  const handleHobbyToggle = (hobby) => {
    const currentHobbies = editedProfile.selectedHobbies || [];
    if (currentHobbies.includes(hobby)) {
      setEditedProfile(prev => ({
        ...prev,
        selectedHobbies: currentHobbies.filter(h => h !== hobby)
      }));
    } else {
      setEditedProfile(prev => ({
        ...prev,
        selectedHobbies: [...currentHobbies, hobby]
      }));
    }
  };

  const handlePreferenceToggle = (category, item) => {
    const currentItems = editedPreferences[category] || [];
    if (currentItems.includes(item)) {
      setEditedPreferences(prev => ({
        ...prev,
        [category]: currentItems.filter(i => i !== item)
      }));
    } else {
      setEditedPreferences(prev => ({
        ...prev,
        [category]: [...currentItems, item]
      }));
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col h-screen bg-gray-100 pb-16">
        <TopNavigation title="User Profile" />
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-gray-100 pb-16 overflow-auto">
      <TopNavigation title="User Profile" />

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Profile Header */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center">
                <div className="w-20 h-20 bg-indigo-500 rounded-full flex items-center justify-center">
                  <span className="text-2xl font-bold text-white">
                    {userProfile?.firstName ? userProfile.firstName.charAt(0) : <User className="h-8 w-8 text-white" />}
                  </span>
                </div>
                <div className="ml-4">
                  {isEditingProfile ? (
                    <div className="flex space-x-2">
                      <input
                        type="text"
                        value={editedProfile.firstName || ''}
                        onChange={(e) => handleInputChange('firstName', e.target.value)}
                        className="text-xl font-bold border rounded px-2 py-1"
                        placeholder="First Name"
                      />
                      <input
                        type="text"
                        value={editedProfile.lastName || ''}
                        onChange={(e) => handleInputChange('lastName', e.target.value)}
                        className="text-xl font-bold border rounded px-2 py-1"
                        placeholder="Last Name"
                      />
                    </div>
                  ) : (
                    <h1 className="text-2xl font-bold">{userProfile?.firstName} {userProfile?.lastName}</h1>
                  )}
                  <p className="text-gray-500">User ID: {currentUser.id}</p>
                  <p className="text-gray-500">Activity Level: {userProfile?.activityLevel}</p>
                </div>
              </div>
              <div>
                {isEditingProfile ? (
                  <div className="space-x-2">
                    <button onClick={handleSaveProfile} className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600">
                      <Save className="h-4 w-4 inline mr-1" /> Save
                    </button>
                    <button onClick={handleCancelProfile} className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600">
                      <X className="h-4 w-4 inline mr-1" /> Cancel
                    </button>
                  </div>
                ) : (
                  <button onClick={handleEditProfile} className="bg-indigo-500 text-white px-4 py-2 rounded hover:bg-indigo-600">
                    <Edit className="h-4 w-4 inline mr-1" /> Edit Profile
                  </button>
                )}
              </div>
            </div>

            {/* Basic Information */}
            {(isEditingProfile || !isEditingPreferences && !isEditingBookClubs) && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Email</label>
                  {isEditingProfile ? (

                    <input
                      type="email"
                      value={editedProfile.email || ''}
                      onChange={(e) => handleInputChange('email', e.target.value)}
                      className="mt-1 block w-full border rounded-md shadow-sm px-3 py-2"
                    />
                  ) : (
                    <p className="mt-1 text-gray-900">{userProfile?.email || 'N/A'}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Phone</label>
                  {isEditingProfile ? (
                    <input
                      type="tel"
                      value={editedProfile.phoneNumber || ''}
                      onChange={(e) => handleInputChange('phoneNumber', e.target.value)}
                      className="mt-1 block w-full border rounded-md shadow-sm px-3 py-2"
                    />
                  ) : (
                    <p className="mt-1 text-gray-900">{userProfile?.phoneNumber || 'N/A'}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Age</label>
                  {isEditingProfile ? (
                    <input
                      type="number"
                      value={editedProfile.age || ''}
                      onChange={(e) => handleInputChange('age', e.target.value)}
                      className="mt-1 block w-full border rounded-md shadow-sm px-3 py-2"
                    />
                  ) : (
                    <p className="mt-1 text-gray-900">
                      {userProfile?.age ?
                        (typeof userProfile.age === 'object' ? userProfile.age.low : userProfile.age) :
                        'N/A'}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Profession</label>
                  {isEditingProfile ? (
                    <select
                      value={editedProfile.profession || ''}
                      onChange={(e) => handleInputChange('profession', e.target.value)}
                      className="mt-1 block w-full border rounded-md shadow-sm px-3 py-2"
                    >
                      <option value="">Select profession</option>
                      {professions.map((profession) => (
                        <option key={profession} value={profession}>
                          {profession}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <p className="mt-1 text-gray-900">{userProfile?.profession || 'N/A'}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Relationship Status</label>
                  {isEditingProfile ? (
                    <select
                      value={editedProfile.relationshipStatus || ''}
                      onChange={(e) => handleInputChange('relationshipStatus', e.target.value)}
                      className="mt-1 block w-full border rounded-md shadow-sm px-3 py-2"
                    >
                      <option value="">Select status</option>
                      <option value="Single">Single</option>
                      <option value="In a relationship">In a relationship</option>
                      <option value="Married">Married</option>
                      <option value="Divorced">Divorced</option>
                    </select>
                  ) : (
                    <p className="mt-1 text-gray-900">{userProfile?.relationshipStatus || 'N/A'}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Hobbies</label>
                  {isEditingProfile ? (
                    <div className="mt-1 relative">
                      <div className="border rounded-md p-2 min-h-[40px] bg-white">
                        <div className="flex flex-wrap gap-2">
                          {editedProfile.selectedHobbies?.map((hobby) => (
                            <span
                              key={hobby}
                              className="bg-indigo-100 text-indigo-800 text-sm px-2 py-1 rounded flex items-center"
                            >
                              {hobby}
                              <button
                                onClick={() => handleHobbyToggle(hobby)}
                                className="ml-1 text-indigo-500 hover:text-indigo-700"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </span>
                          ))}
                        </div>
                      </div>
                      <select
                        onChange={(e) => {
                          if (e.target.value) {
                            handleHobbyToggle(e.target.value);
                            e.target.value = '';
                          }
                        }}
                        className="mt-2 block w-full border rounded-md shadow-sm px-3 py-2"
                      >
                        <option value="">Add a hobby</option>
                        {hobbiesOptions
                          .filter(hobby => !editedProfile.selectedHobbies?.includes(hobby))
                          .map((hobby) => (
                            <option key={hobby} value={hobby}>
                              {hobby}
                            </option>
                          ))}
                      </select>
                    </div>
                  ) : (
                    <p className="mt-1 text-gray-900">{userProfile?.hobbies || 'N/A'}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Country</label>
                  {isEditingProfile ? (
                    <select
                      value={editedProfile.country || ''}
                      onChange={(e) => handleInputChange('country', e.target.value)}
                      className="mt-1 block w-full border rounded-md shadow-sm px-3 py-2"
                    >
                      <option value="">Select country</option>
                      {countries.map((country) => (
                        <option key={country} value={country}>
                          {country}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <p className="mt-1 text-gray-900">{userProfile?.country || 'N/A'}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">State</label>
                  {isEditingProfile ? (
                    <select
                      value={editedProfile.state || ''}
                      onChange={(e) => handleInputChange('state', e.target.value)}
                      className="mt-1 block w-full border rounded-md shadow-sm px-3 py-2"
                      disabled={!editedProfile.country}
                    >
                      <option value="">Select state</option>
                      {states.map((state) => (
                        <option key={state.name} value={state.name}>
                          {state.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <p className="mt-1 text-gray-900">{userProfile?.state || 'N/A'}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">City</label>
                  {isEditingProfile ? (
                    <select
                      value={editedProfile.city || ''}
                      onChange={(e) => handleInputChange('city', e.target.value)}
                      className="mt-1 block w-full border rounded-md shadow-sm px-3 py-2"
                      disabled={!editedProfile.state}
                    >
                      <option value="">Select city</option>
                      {cities.map((city) => (
                        <option key={city.name} value={city.name}>
                          {city.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <p className="mt-1 text-gray-900">{userProfile?.city || 'N/A'}</p>
                  )}
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700">Bio</label>
                  {isEditingProfile ? (
                    <textarea
                      value={editedProfile.bio || ''}
                      onChange={(e) => handleInputChange('bio', e.target.value)}
                      rows={3}
                      className="mt-1 block w-full border rounded-md shadow-sm px-3 py-2"
                    />
                  ) : (
                    <p className="mt-1 text-gray-900">{userProfile?.bio || 'N/A'}</p>
                  )}
                </div>
              </div>

            )}
          </div>

          {/* Reading Stats */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">Reading Statistics</h2>
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-blue-50 p-4 rounded-lg text-center">
                <BookOpen className="h-6 w-6 text-blue-500 mx-auto mb-2" />
                <div className="text-2xl font-bold text-blue-600">{readingStats?.booksReading || 0}</div>
                <div className="text-sm text-gray-600">Currently Reading</div>
              </div>
              <div className="bg-green-50 p-4 rounded-lg text-center">
                <BookCheck className="h-6 w-6 text-green-500 mx-auto mb-2" />
                <div className="text-2xl font-bold text-green-600">{readingStats?.booksFinished || 0}</div>
                <div className="text-sm text-gray-600">Books Read</div>
              </div>
              <div className="bg-purple-50 p-4 rounded-lg text-center">
                <BookMarked className="h-6 w-6 text-purple-500 mx-auto mb-2" />
                <div className="text-2xl font-bold text-purple-600">{readingStats?.booksWantToRead || 0}</div>
                <div className="text-sm text-gray-600">Want to Read</div>
              </div>
            </div>
          </div>

          {/* Social Stats */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">Social Statistics</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-orange-50 p-4 rounded-lg text-center">
                <Users className="h-6 w-6 text-orange-500 mx-auto mb-2" />
                <div className="text-2xl font-bold text-orange-600">{socialData?.followersCount || 0}</div>
                <div className="text-sm text-gray-600">Followers</div>
              </div>
              <div className="bg-pink-50 p-4 rounded-lg text-center">
                <UserPlus className="h-6 w-6 text-pink-500 mx-auto mb-2" />
                <div className="text-2xl font-bold text-pink-600">{socialData?.followingCount || 0}</div>
                <div className="text-sm text-gray-600">Following</div>
              </div>
              <div className="bg-yellow-50 p-4 rounded-lg text-center">
                <MessageCircle className="h-6 w-6 text-yellow-500 mx-auto mb-2" />
                <div className="text-2xl font-bold text-yellow-600">{socialData?.commentsCount || 0}</div>
                <div className="text-sm text-gray-600">Comments</div>
              </div>
              <div className="bg-indigo-50 p-4 rounded-lg text-center">
                <Calendar className="h-6 w-6 text-indigo-500 mx-auto mb-2" />
                <div className="text-2xl font-bold text-indigo-600">{socialData?.eventsAttended || 0}</div>
                <div className="text-sm text-gray-600">Events Attended</div>
              </div>
            </div>
          </div>

          {/* Preferences */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Reading Preferences</h2>
              {!isEditingPreferences ? (
                <button
                  onClick={handleEditPreferences}
                  className="bg-indigo-500 text-white px-3 py-1 rounded hover:bg-indigo-600 text-sm"
                >
                  <Edit className="h-4 w-4 inline mr-1" /> Edit
                </button>
              ) : (
                <div className="space-x-2">
                  <button onClick={handleSavePreferences} className="bg-green-500 text-white px-3 py-1 rounded hover:bg-green-600 text-sm">
                    <Save className="h-4 w-4 inline mr-1" /> Save
                  </button>
                  <button onClick={handleCancelPreferences} className="bg-gray-500 text-white px-3 py-1 rounded hover:bg-gray-600 text-sm">
                    <X className="h-4 w-4 inline mr-1" /> Cancel
                  </button>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <h3 className="font-medium mb-2 flex items-center">
                  <Book className="h-4 w-4 mr-2" /> Favorite Genres
                </h3>
                {isEditingPreferences ? (
                  <div>
                    <div className="border rounded-md p-2 min-h-[40px] bg-white mb-2">
                      <div className="flex flex-wrap gap-2">
                        {editedPreferences.genres?.map((genre) => (
                          <span
                            key={genre}
                            className="bg-indigo-100 text-indigo-800 text-sm px-2 py-1 rounded flex items-center"
                          >
                            {genre}
                            <button
                              onClick={() => handlePreferenceToggle('genres', genre)}
                              className="ml-1 text-indigo-500 hover:text-indigo-700"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                    </div>
                    <select
                      onChange={(e) => {
                        if (e.target.value) {
                          handlePreferenceToggle('genres', e.target.value);
                          e.target.value = '';
                        }
                      }}
                      className="block w-full border rounded-md shadow-sm px-3 py-2"
                    >
                      <option value="">Add a genre</option>
                      {genreOptions
                        .filter(genre => !editedPreferences.genres?.includes(genre))
                        .map((genre) => (
                          <option key={genre} value={genre}>
                            {genre}
                          </option>
                        ))}
                    </select>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {preferences?.genres?.map((genre, index) => (
                      <span key={index} className="bg-indigo-100 text-indigo-800 text-sm px-3 py-1 rounded-full">
                        {genre}
                      </span>
                    )) || <p className="text-gray-500">No genres selected</p>}
                  </div>
                )}
              </div>
              <div>
                <h3 className="font-medium mb-2 flex items-center">
                  <Heart className="h-4 w-4 mr-2" /> Favorite Authors
                </h3>
                {isEditingPreferences ? (
                  <div>
                    <div className="border rounded-md p-2 min-h-[40px] bg-white mb-2">
                      <div className="flex flex-wrap gap-2">
                        {editedPreferences.authors?.map((author) => (
                          <span
                            key={author}
                            className="bg-red-100 text-red-800 text-sm px-2 py-1 rounded flex items-center"
                          >
                            {author}
                            <button
                              onClick={() => handlePreferenceToggle('authors', author)}
                              className="ml-1 text-red-500 hover:text-red-700"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                    </div>
                    <select
                      onChange={(e) => {
                        if (e.target.value) {
                          handlePreferenceToggle('authors', e.target.value);
                          e.target.value = '';
                        }
                      }}
                      className="block w-full border rounded-md shadow-sm px-3 py-2"
                    >
                      <option value="">Add an author</option>
                      {authorOptions
                        .filter(author => !editedPreferences.authors?.includes(author))
                        .map((author) => (
                          <option key={author} value={author}>
                            {author}
                          </option>
                        ))}
                    </select>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {preferences?.authors?.map((author, index) => (
                      <span key={index} className="bg-red-100 text-red-800 text-sm px-3 py-1 rounded-full">
                        {author}
                      </span>
                    )) || <p className="text-gray-500">No authors selected</p>}
                  </div>
                )}
              </div>

              <div>
                <h3 className="font-medium mb-2 flex items-center">
                  <Star className="h-4 w-4 mr-2" /> Preferred Themes
                </h3>
                {isEditingPreferences ? (
                  <div>
                    <div className="border rounded-md p-2 min-h-[40px] bg-white mb-2">
                      <div className="flex flex-wrap gap-2">
                        {editedPreferences.themes?.map((theme) => (
                          <span
                            key={theme}
                            className="bg-green-100 text-green-800 text-sm px-2 py-1 rounded flex items-center"
                          >
                            {theme}
                            <button
                              onClick={() => handlePreferenceToggle('themes', theme)}
                              className="ml-1 text-green-500 hover:text-green-700"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                    </div>
                    <select
                      onChange={(e) => {
                        if (e.target.value) {
                          handlePreferenceToggle('themes', e.target.value);
                          e.target.value = '';
                        }
                      }}
                      className="block w-full border rounded-md shadow-sm px-3 py-2"
                    >
                      <option value="">Add a theme</option>
                      {themeOptions
                        .filter(theme => !editedPreferences.themes?.includes(theme))
                        .map((theme) => (
                          <option key={theme} value={theme}>
                            {theme}
                          </option>
                        ))}
                    </select>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {preferences?.themes?.map((theme, index) => (
                      <span key={index} className="bg-green-100 text-green-800 text-sm px-3 py-1 rounded-full">
                        {theme}
                      </span>
                    )) || <p className="text-gray-500">No themes selected</p>}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Book Clubs */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Book Clubs</h2>
              {!isEditingBookClubs ? (
                <div className="space-x-2">
                  <button
                    onClick={() => setShowJoinClubModal(true)}
                    className="bg-green-500 text-white px-3 py-1 rounded hover:bg-green-600 text-sm"
                  >
                    <Plus className="h-4 w-4 inline mr-1" /> Join Club
                  </button>
                  <button
                    onClick={handleEditBookClubs}
                    className="bg-indigo-500 text-white px-3 py-1 rounded hover:bg-indigo-600 text-sm"
                  >
                    <Edit className="h-4 w-4 inline mr-1" /> Edit
                  </button>
                </div>
              ) : (
                <button onClick={handleCancelBookClubs} className="bg-gray-500 text-white px-3 py-1 rounded hover:bg-gray-600 text-sm">
                  <X className="h-4 w-4 inline mr-1" /> Done
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {socialData?.bookClubs && socialData.bookClubs.length > 0 ? (
                socialData.bookClubs.map((club, index) => (
                  <div key={index} className="border rounded-lg p-4 relative">
                    <h3 className="font-medium">{club.name}</h3>
                    <p className="text-sm text-gray-600">Role: {club.memberRole || 'Member'}</p>
                    <p className="text-sm text-gray-600">
                      Members: {club.memberCount ?
                        (typeof club.memberCount === 'object' ? club.memberCount.low : club.memberCount) :
                        0}
                    </p>
                    <p className="text-sm text-gray-600">Joined: {club.joinedDate}</p>
                    {isEditingBookClubs && (
                      <button
                        onClick={() => handleLeaveClub(club.id)}
                        className="absolute top-2 right-2 text-red-500 hover:text-red-700"
                      >
                        <X className="h-5 w-5" />
                      </button>
                    )}
                  </div>
                ))
              ) : (
                <p className="text-gray-500">Not a member of any book clubs</p>
              )}
            </div>
          </div>

          {/* Join Book Club Modal */}
          {showJoinClubModal && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg p-6 max-w-md w-full">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-semibold">Join a Book Club</h2>
                  <button
                    onClick={() => setShowJoinClubModal(false)}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    <X className="h-6 w-6" />
                  </button>
                </div>

                <div className="space-y-4">
                  {availableBookClubs.map((club) => (
                    <div key={club.id} className="border rounded-lg p-4 flex justify-between items-center">
                      <div>
                        <h3 className="font-medium">{club.name}</h3>
                        <p className="text-sm text-gray-600">Members: {club.memberCount}</p>
                        <p className="text-sm text-gray-600">{club.description}</p>
                      </div>
                      <button
                        onClick={() => handleJoinClub(club.id)}
                        className="bg-indigo-500 text-white px-3 py-1 rounded hover:bg-indigo-600 text-sm"
                      >
                        Join
                      </button>
                    </div>
                  ))}
                  {availableBookClubs.length === 0 && (
                    <p className="text-gray-500 text-center">No available book clubs to join</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Account Actions */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-xl font-semibold">Account Actions</h2>
                <p className="text-sm text-gray-600">Member since: {userProfile?.joinedDate || 'N/A'}</p>
              </div>
              <button
                onClick={() => {
                  signOut();
                  navigate('/signin');
                }}
                className="flex items-center bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600 transition-colors"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;