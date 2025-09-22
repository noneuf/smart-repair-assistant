"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

// Country code to phone prefix mapping
const COUNTRY_PHONE_PREFIXES = {
  'US': '+1',
  'CA': '+1', 
  'GB': '+44',
  'AU': '+61',
  'DE': '+49',
  'FR': '+33',
  'IT': '+39',
  'ES': '+34',
  'BR': '+55',
  'MX': '+52',
  'IN': '+91',
  'CN': '+86',
  'JP': '+81',
  'KR': '+82',
  'RU': '+7',
  'ZA': '+27',
  'EG': '+20',
  'NG': '+234',
  'KE': '+254',
  'IL': '+972',
  // Add more as needed
};

// Popular countries for the dropdown
const POPULAR_COUNTRIES = [
  { code: 'US', name: 'United States', prefix: '+1', flag: '🇺🇸' },
  { code: 'CA', name: 'Canada', prefix: '+1', flag: '🇨🇦' },
  { code: 'GB', name: 'United Kingdom', prefix: '+44', flag: '🇬🇧' },
  { code: 'AU', name: 'Australia', prefix: '+61', flag: '🇦🇺' },
  { code: 'DE', name: 'Germany', prefix: '+49', flag: '🇩🇪' },
  { code: 'FR', name: 'France', prefix: '+33', flag: '🇫🇷' },
  { code: 'IN', name: 'India', prefix: '+91', flag: '🇮🇳' },
  { code: 'IL', name: 'Israel', prefix: '+972', flag: '🇮🇱' },
];

export default function AuthPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authMethod, setAuthMethod] = useState('social');
  const [authMode, setAuthMode] = useState('signin');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [showVerification, setShowVerification] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  // New states for phone prefix functionality
  const [countryCode, setCountryCode] = useState('US');
  const [phonePrefix, setPhonePrefix] = useState('+1');
  const [detectedCountry, setDetectedCountry] = useState(null);
  const [showCountrySelector, setShowCountrySelector] = useState(false);

  // Function to detect user's country via IP geolocation
  const detectUserCountry = async () => {
    try {
      // Using a different free geolocation service that allows CORS
      const response = await fetch('https://api.country.is/');
      const data = await response.json();
      
      if (data.country && COUNTRY_PHONE_PREFIXES[data.country]) {
        const detectedCode = data.country;
        const detectedPrefix = COUNTRY_PHONE_PREFIXES[detectedCode];
        
        // Find country name from our list
        const countryInfo = POPULAR_COUNTRIES.find(c => c.code === detectedCode);
        
        setDetectedCountry({
          code: detectedCode,
          name: countryInfo?.name || detectedCode,
          prefix: detectedPrefix
        });
        
        setCountryCode(detectedCode);
        setPhonePrefix(detectedPrefix);
        
        console.log('Detected country:', detectedCode, 'with prefix:', detectedPrefix);
      } else {
        // Fallback: try to detect based on browser language
        const browserLang = navigator.language || navigator.userLanguage;
        const langCountry = browserLang.includes('-') ? browserLang.split('-')[1] : null;
        
        if (langCountry && COUNTRY_PHONE_PREFIXES[langCountry.toUpperCase()]) {
          const detectedCode = langCountry.toUpperCase();
          const detectedPrefix = COUNTRY_PHONE_PREFIXES[detectedCode];
          
          setCountryCode(detectedCode);
          setPhonePrefix(detectedPrefix);
          console.log('Detected country from browser language:', detectedCode);
        }
      }
    } catch (error) {
      console.log('Could not detect country:', error);
      // Final fallback based on browser language
      try {
        const browserLang = navigator.language || navigator.userLanguage;
        const langCountry = browserLang.includes('-') ? browserLang.split('-')[1] : null;
        
        if (langCountry && COUNTRY_PHONE_PREFIXES[langCountry.toUpperCase()]) {
          const detectedCode = langCountry.toUpperCase();
          const detectedPrefix = COUNTRY_PHONE_PREFIXES[detectedCode];
          
          setCountryCode(detectedCode);
          setPhonePrefix(detectedPrefix);
          console.log('Using browser language fallback:', detectedCode);
        } else {
          // Ultimate fallback to US
          setCountryCode('US');
          setPhonePrefix('+1');
        }
      } catch (e) {
        // Ultimate fallback to US
        setCountryCode('US');
        setPhonePrefix('+1');
      }
    }
  };

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      console.log('Session check:', { session, error });
      setUser(session?.user ?? null);
      setLoading(false);
      
      if (session?.user) {
        router.push('/');
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('Auth state change:', event, session);
      setUser(session?.user ?? null);
      setLoading(false);
      
      if (session?.user) {
        router.push('/');
      }
    });

    // Detect user's country when component mounts
    detectUserCountry();

    return () => subscription.unsubscribe();
  }, [router]);

  const signInWithGoogle = async () => {
    try {
      setIsLoading(true);
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google'
      });
      if (error) throw error;
    } catch (error) {
      console.error('Error logging in:', error.message);
      alert('Error logging in: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    } catch (error) {
      console.error('Error logging out:', error.message);
    }
  };

  const signInWithPhone = async () => {
    try {
      setIsLoading(true);
      // Combine prefix with phone number - ensuring we don't double-add prefix
      const cleanPhoneNumber = phoneNumber.replace(/^[\s\-\(\)]+/, '').replace(/[^\d]/g, '');
      const fullPhoneNumber = phonePrefix + cleanPhoneNumber;
      
      console.log('Sending SMS to:', fullPhoneNumber);
      
      const { error } = await supabase.auth.signInWithOtp({
        phone: fullPhoneNumber
      });
      if (error) throw error;
      setShowVerification(true);
      alert('Verification code sent to your phone!');
    } catch (error) {
      console.error('Error sending SMS:', error.message);
      alert('Error sending SMS: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const verifyPhone = async () => {
    try {
      setIsLoading(true);
      const cleanPhoneNumber = phoneNumber.replace(/^[\s\-\(\)]+/, '').replace(/[^\d]/g, '');
      const fullPhoneNumber = phonePrefix + cleanPhoneNumber;
        
      const { error } = await supabase.auth.verifyOtp({
        phone: fullPhoneNumber,
        token: verificationCode,
        type: 'sms'
      });
      if (error) throw error;
    } catch (error) {
      console.error('Error verifying code:', error.message);
      alert('Error verifying code: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const signInWithEmail = async () => {
    try {
      setIsLoading(true);
      if (authMode === 'signup') {
        const { error } = await supabase.auth.signUp({
          email,
          password
        });
        if (error) throw error;
        alert('Check your email for the confirmation link!');
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password
        });
        if (error) throw error;
      }
    } catch (error) {
      console.error('Error with email auth:', error.message);
      alert('Error: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle country selection
  const selectCountry = (country) => {
    setCountryCode(country.code);
    setPhonePrefix(country.prefix);
    setShowCountrySelector(false);
  };

  // Format phone number as user types
  const handlePhoneNumberChange = (e) => {
    let value = e.target.value;
    
    // Remove the prefix if user types it
    if (value.startsWith(phonePrefix)) {
      value = value.substring(phonePrefix.length);
    }
    
    // Remove any non-digit characters except spaces and dashes
    value = value.replace(/[^\d\s\-\(\)]/g, '');
    
    setPhoneNumber(value);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900 mx-auto mb-4"></div>
          <p className="text-gray-500">Loading...</p>
        </div>
      </div>
    );
  }

  if (user) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-md mx-auto">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h1 className="text-xl font-bold text-gray-900 mb-4">✅ Login Success!</h1>
            
            <div className="space-y-3">
              <div>
                <strong>Name:</strong> {user.user_metadata?.full_name || 'No name'}
              </div>
              <div>
                <strong>Email:</strong> {user.email}
              </div>
              <div>
                <strong>ID:</strong> {user.id.slice(0, 12)}...
              </div>
              {user.user_metadata?.avatar_url && (
                <div>
                  <strong>Avatar:</strong>
                  <img 
                    src={user.user_metadata.avatar_url} 
                    alt="Avatar" 
                    className="w-12 h-12 rounded-full mt-2"
                  />
                </div>
              )}
            </div>

            <button
              onClick={signOut}
              className="w-full mt-6 bg-red-600 hover:bg-red-700 text-white rounded-xl py-3 font-medium transition-colors"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-slate-100 flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-slate-900 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Welcome to Smart Repair Assistant</h1>
          <p className="text-gray-600">Sign in to save your repair history and get personalized AI recommendations</p>
        </div>

        {/* Main Auth Card */}
        <div className="bg-white rounded-3xl shadow-xl border border-gray-100 p-8">
          
          {/* Auth Method Tabs */}
          <div className="flex bg-gray-100 rounded-2xl p-1 mb-6">
            <button
              onClick={() => setAuthMethod('social')}
              className={`flex-1 py-2 px-4 rounded-xl text-sm font-medium transition-colors ${
                authMethod === 'social' 
                  ? 'bg-white text-gray-900 shadow-sm' 
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Quick Sign In
            </button>
            <button
              onClick={() => setAuthMethod('phone')}
              className={`flex-1 py-2 px-4 rounded-xl text-sm font-medium transition-colors ${
                authMethod === 'phone' 
                  ? 'bg-white text-gray-900 shadow-sm' 
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Phone
            </button>
            <button
              onClick={() => setAuthMethod('email')}
              className={`flex-1 py-2 px-4 rounded-xl text-sm font-medium transition-colors ${
                authMethod === 'email' 
                  ? 'bg-white text-gray-900 shadow-sm' 
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Email
            </button>
          </div>

          {/* Social Auth */}
          {authMethod === 'social' && (
            <div className="space-y-4">
              <button
                onClick={signInWithGoogle}
                disabled={isLoading}
                className="w-full flex items-center justify-center gap-3 bg-white hover:bg-gray-50 border-2 border-gray-200 hover:border-gray-300 rounded-2xl py-4 px-6 font-medium text-gray-700 transition-all duration-200 disabled:opacity-50"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                {isLoading ? 'Signing in...' : 'Continue with Google'}
              </button>
              
              <div className="text-center">
                <p className="text-xs text-gray-500">Most popular • Secure • One-click access</p>
              </div>
            </div>
          )}

          {/* Enhanced Phone Auth with Auto-Prefix */}
          {authMethod === 'phone' && (
            <div className="space-y-4">
              {!showVerification ? (
                <>
                  {/* Country/Prefix Selector */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Country</label>
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setShowCountrySelector(!showCountrySelector)}
                        className="w-full flex items-center justify-between px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-lg">
                            {POPULAR_COUNTRIES.find(c => c.code === countryCode)?.flag || '🌍'}
                          </span>
                          <span className="font-medium">{phonePrefix}</span>
                          <span className="text-gray-600">
                            {POPULAR_COUNTRIES.find(c => c.code === countryCode)?.name || 'Country'}
                          </span>
                          {detectedCountry && countryCode === detectedCountry.code && (
                            <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">
                              Auto-detected
                            </span>
                          )}
                        </div>
                        <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
                        </svg>
                      </button>

                      {/* Country Dropdown */}
                      {showCountrySelector && (
                        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-10 max-h-60 overflow-y-auto">
                          {POPULAR_COUNTRIES.map((country) => (
                            <button
                              key={country.code}
                              type="button"
                              onClick={() => selectCountry(country)}
                              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 text-left"
                            >
                              <span className="text-lg">{country.flag}</span>
                              <span className="font-medium text-gray-900">{country.prefix}</span>
                              <span className="text-gray-600">{country.name}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Phone Number Input */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Phone Number</label>
                    <div className="flex">
                      <div className="flex items-center px-4 py-3 border border-r-0 border-gray-300 rounded-l-xl bg-gray-50">
                        <span className="font-medium text-gray-700">{phonePrefix}</span>
                      </div>
                      <input
                        type="tel"
                        value={phoneNumber}
                        onChange={handlePhoneNumberChange}
                        placeholder="555 123 4567"
                        className="flex-1 px-4 py-3 border border-gray-300 rounded-r-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      {detectedCountry && countryCode === detectedCountry.code 
                        ? `Detected your location: ${detectedCountry.name}`
                        : 'Note: Phone authentication requires Supabase configuration'
                      }
                    </p>
                  </div>
                  
                  <button
                    onClick={signInWithPhone}
                    disabled={isLoading || !phoneNumber}
                    className="w-full bg-slate-900 hover:bg-slate-800 text-white rounded-2xl py-4 font-medium transition-colors disabled:opacity-50"
                  >
                    {isLoading ? 'Sending code...' : `Send code to ${phonePrefix} ${phoneNumber}`}
                  </button>
                </>
              ) : (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Verification Code</label>
                    <input
                      type="text"
                      value={verificationCode}
                      onChange={(e) => setVerificationCode(e.target.value)}
                      placeholder="Enter 6-digit code"
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-center text-lg tracking-widest"
                      maxLength="6"
                    />
                    <p className="text-xs text-gray-500 mt-1 text-center">
                      Code sent to {phonePrefix} {phoneNumber}
                    </p>
                  </div>
                  <button
                    onClick={verifyPhone}
                    disabled={isLoading || verificationCode.length !== 6}
                    className="w-full bg-slate-900 hover:bg-slate-800 text-white rounded-2xl py-4 font-medium transition-colors disabled:opacity-50"
                  >
                    {isLoading ? 'Verifying...' : 'Verify & Sign In'}
                  </button>
                  <button
                    onClick={() => setShowVerification(false)}
                    className="w-full text-gray-600 hover:text-gray-900 py-2 text-sm"
                  >
                    Use a different number
                  </button>
                </>
              )}
            </div>
          )}

          {/* Email Auth */}
          {authMethod === 'email' && (
            <div className="space-y-4">
              <div className="flex bg-gray-100 rounded-xl p-1 mb-4">
                <button
                  onClick={() => setAuthMode('signin')}
                  className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
                    authMode === 'signin' 
                      ? 'bg-white text-gray-900 shadow-sm' 
                      : 'text-gray-600'
                  }`}
                >
                  Sign In
                </button>
                <button
                  onClick={() => setAuthMode('signup')}
                  className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
                    authMode === 'signup' 
                      ? 'bg-white text-gray-900 shadow-sm' 
                      : 'text-gray-600'
                  }`}
                >
                  Sign Up
                </button>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              
              <button
                onClick={signInWithEmail}
                disabled={isLoading || !email || !password}
                className="w-full bg-slate-900 hover:bg-slate-800 text-white rounded-2xl py-4 font-medium transition-colors disabled:opacity-50"
              >
                {isLoading ? 'Processing...' : authMode === 'signup' ? 'Create Account' : 'Sign In'}
              </button>
            </div>
          )}
        </div>

        {/* Benefits Section */}
        <div className="mt-8 text-center">
          <p className="text-sm text-gray-600 mb-4">Why create an account?</p>
          <div className="grid grid-cols-1 gap-3">
            <div className="flex items-center justify-center gap-2 text-sm text-gray-600">
              <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
              </svg>
              Save your repair history
            </div>
            <div className="flex items-center justify-center gap-2 text-sm text-gray-600">
              <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
              </svg>
              Get personalized AI recommendations
            </div>
            <div className="flex items-center justify-center gap-2 text-sm text-gray-600">
              <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
              </svg>
              Track problem status updates
            </div>
          </div>
        </div>

        {/* Security Note */}
        <div className="mt-6 text-center">
          <p className="text-xs text-gray-500">
            🔒 Your data is secure and private. We never share your information.
          </p>
        </div>
      </div>
    </div>
  );
}