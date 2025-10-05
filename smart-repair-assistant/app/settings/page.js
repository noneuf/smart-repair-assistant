"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import Navigation from "@/app/components/Navigation";

export default function SettingsPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const [showDataDeleteConfirmation, setShowDataDeleteConfirmation] = useState(false);
  const [deleteConfirmationText, setDeleteConfirmationText] = useState('');
  const [dataDeleteConfirmationText, setDataDeleteConfirmationText] = useState('');
  
  // Profile editing states
  const [profileName, setProfileName] = useState('');
  const [profileEmail, setProfileEmail] = useState('');
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  
  // Statistics
  const [userStats, setUserStats] = useState({
    totalProblems: 0,
    fixedProblems: 0,
    inProgressProblems: 0,
    storageUsed: '0 MB',
    joinDate: null
  });

  // Preferences
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [dataRetentionDays, setDataRetentionDays] = useState(365);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      setUser(session?.user ?? null);
      setLoading(false);
      
      if (!session?.user) {
        router.push('/auth');
      } else {
        initializeUserData(session.user);
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
      
      if (!session?.user && event === 'SIGNED_OUT') {
        router.push('/auth');
      }
    });

    return () => subscription.unsubscribe();
  }, [router]);

  const initializeUserData = async (user) => {
    setProfileName(user.user_metadata?.full_name || '');
    setProfileEmail(user.email || '');
    
    await fetchUserStats(user.id);
  };

  const fetchUserStats = async (userId) => {
    try {
      // Get problem statistics
      const { data: problems, error: problemsError } = await supabase
        .from('problems')
        .select('status, created_at, image_url, video_url, audio_url')
        .eq('user_id', userId);

      if (problemsError) throw problemsError;

      const totalProblems = problems?.length || 0;
      const fixedProblems = problems?.filter(p => p.status === 'fixed').length || 0;
      const inProgressProblems = problems?.filter(p => p.status === 'in_progress').length || 0;

      // Calculate approximate storage usage
      const mediaFiles = problems?.filter(p => p.image_url || p.video_url || p.audio_url).length || 0;
      const estimatedStorageMB = mediaFiles * 2; // Rough estimate: 2MB per media file

      setUserStats({
        totalProblems,
        fixedProblems,
        inProgressProblems,
        storageUsed: `${estimatedStorageMB} MB`,
        joinDate: user?.created_at ? new Date(user.created_at).toLocaleDateString() : 'Unknown'
      });
    } catch (error) {
      console.error('Error fetching user stats:', error);
    }
  };

  const updateProfile = async () => {
    try {
      setIsUpdating(true);
      
      const { error } = await supabase.auth.updateUser({
        data: { full_name: profileName }
      });

      if (error) throw error;
      
      alert('Profile updated successfully!');
      setIsEditingProfile(false);
    } catch (error) {
      console.error('Error updating profile:', error);
      alert('Error updating profile: ' + error.message);
    } finally {
      setIsUpdating(false);
    }
  };

  const changePassword = async () => {
    try {
      setIsUpdating(true);
      
      const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
        redirectTo: `${window.location.origin}/auth?reset=true`
      });

      if (error) throw error;
      
      alert('Password reset email sent! Check your inbox.');
    } catch (error) {
      console.error('Error sending password reset:', error);
      alert('Error sending password reset: ' + error.message);
    } finally {
      setIsUpdating(false);
    }
  };

  const deleteAllUserData = async () => {
    if (dataDeleteConfirmationText !== 'DELETE MY DATA') {
      alert('Please type "DELETE MY DATA" to confirm');
      return;
    }

    try {
      setIsUpdating(true);
      
      console.log('Starting data deletion for user:', user.id);
      
      // First, let's see what data exists
      const { data: existingProblems, error: fetchError } = await supabase
        .from('problems')
        .select('id, image_url, video_url, audio_url')
        .eq('user_id', user.id);
      
      if (fetchError) {
        console.error('Error fetching problems:', fetchError);
        alert('Error fetching your data: ' + fetchError.message);
        return;
      }
      
      console.log('Found problems to delete:', existingProblems?.length || 0);
      
      if (existingProblems && existingProblems.length > 0) {
        // Delete files from storage first (if any)
        for (const problem of existingProblems) {
          if (problem.image_url) {
            try {
              const imagePath = problem.image_url.split('/').pop();
              await supabase.storage.from('problem-images').remove([imagePath]);
              console.log('Deleted image:', imagePath);
            } catch (e) {
              console.warn('Could not delete image:', e);
            }
          }
          
          if (problem.video_url) {
            try {
              const videoPath = problem.video_url.split('/').pop();
              await supabase.storage.from('problem-videos').remove([videoPath]);
              console.log('Deleted video:', videoPath);
            } catch (e) {
              console.warn('Could not delete video:', e);
            }
          }
          
          if (problem.audio_url) {
            try {
              const audioPath = problem.audio_url.split('/').pop();
              await supabase.storage.from('problem-audio').remove([audioPath]);
              console.log('Deleted audio:', audioPath);
            } catch (e) {
              console.warn('Could not delete audio:', e);
            }
          }
        }
        
        // Now delete the database records
        const { error: deleteError } = await supabase
          .from('problems')
          .delete()
          .eq('user_id', user.id);

        if (deleteError) {
          console.error('Database deletion error:', deleteError);
          alert('Error deleting data from database: ' + deleteError.message + '\nPlease check console for details.');
          return;
        }
        
        console.log('Successfully deleted all problems from database');
      }

      // Clear user metadata
      const { error: updateError } = await supabase.auth.updateUser({
        data: { full_name: '', preferences: null }
      });
      
      if (updateError) {
        console.warn('Could not clear user metadata:', updateError);
      }

      // Send admin notification for data deletion
      try {
        console.log('Sending admin notification for data deletion');
        const notificationResponse = await fetch('/api/admin/account-deletion', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            userId: user.id,
            userEmail: user.email,
            userName: user.user_metadata?.full_name,
            deletionType: 'data'
          }),
        });

        if (notificationResponse.ok) {
          console.log('Admin notification sent successfully');
        } else {
          console.warn('Failed to send admin notification');
        }
      } catch (notificationError) {
        console.error('Error sending admin notification:', notificationError);
      }

      alert('All your data has been deleted successfully!');
      setShowDataDeleteConfirmation(false);
      setDataDeleteConfirmationText('');
      
      // Refresh stats
      await fetchUserStats(user.id);
      
    } catch (error) {
      console.error('Error deleting user data:', error);
      alert('Error deleting data: ' + error.message + '\nCheck browser console for more details.');
    } finally {
      setIsUpdating(false);
    }
  };

  const deleteAccount = async () => {
    if (deleteConfirmationText !== 'DELETE MY ACCOUNT') {
      alert('Please type "DELETE MY ACCOUNT" to confirm');
      return;
    }

    try {
      setIsUpdating(true);
      
      console.log('Starting account deletion process for user:', user.id);
      
      // First delete all user data (reuse the data deletion logic)
      const { data: existingProblems, error: fetchError } = await supabase
        .from('problems')
        .select('id, image_url, video_url, audio_url')
        .eq('user_id', user.id);
      
      if (fetchError) {
        console.error('Error fetching problems for account deletion:', fetchError);
      }
      
      if (existingProblems && existingProblems.length > 0) {
        // Delete files from storage
        for (const problem of existingProblems) {
          if (problem.image_url) {
            try {
              const imagePath = problem.image_url.split('/').pop();
              await supabase.storage.from('problem-images').remove([imagePath]);
            } catch (e) { console.warn('Could not delete image:', e); }
          }
          if (problem.video_url) {
            try {
              const videoPath = problem.video_url.split('/').pop();
              await supabase.storage.from('problem-videos').remove([videoPath]);
            } catch (e) { console.warn('Could not delete video:', e); }
          }
          if (problem.audio_url) {
            try {
              const audioPath = problem.audio_url.split('/').pop();
              await supabase.storage.from('problem-audio').remove([audioPath]);
            } catch (e) { console.warn('Could not delete audio:', e); }
          }
        }
        
        // Delete database records
        const { error: deleteError } = await supabase
          .from('problems')
          .delete()
          .eq('user_id', user.id);

        if (deleteError) {
          console.error('Error deleting problems during account deletion:', deleteError);
        } else {
          console.log('Successfully deleted all user data during account deletion');
        }
      }

      // Mark user for deletion by clearing all metadata and setting a deletion flag
      const { error: updateError } = await supabase.auth.updateUser({
        data: { 
          full_name: '[DELETED USER]',
          preferences: null,
          account_deletion_requested: new Date().toISOString(),
          deletion_reason: 'User requested account deletion'
        }
      });
      
      if (updateError) {
        console.warn('Could not mark user for deletion:', updateError);
      }

      // Send admin notification
      try {
        console.log('Sending admin notification for account deletion');
        const notificationResponse = await fetch('/api/admin/account-deletion', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            userId: user.id,
            userEmail: user.email,
            userName: user.user_metadata?.full_name,
            deletionType: 'account'
          }),
        });

        if (notificationResponse.ok) {
          console.log('Admin notification sent successfully');
        } else {
          console.warn('Failed to send admin notification');
        }
      } catch (notificationError) {
        console.error('Error sending admin notification:', notificationError);
      }

      // Create a more informative message
      const message = `Account deletion initiated successfully!

What happened:
✅ All your problems and data have been deleted
✅ Your account has been marked for deletion
✅ You will be signed out automatically

Note: Complete account removal from our authentication system will be processed within 24-48 hours. Your email address will be freed up for reuse after that time.

If you change your mind, you can create a new account with the same email address after the deletion is complete.`;

      alert(message);
      
      // Sign out the user
      console.log('Signing out user after account deletion request');
      await supabase.auth.signOut();
      
    } catch (error) {
      console.error('Error during account deletion:', error);
      alert('Error during account deletion: ' + error.message + '\nYour data has been removed but account deletion may need manual processing. Contact support if needed.');
    } finally {
      setIsUpdating(false);
    }
  };

  const exportUserData = async () => {
    try {
      setIsUpdating(true);
      
      // Get all user data
      const { data: problems, error } = await supabase
        .from('problems')
        .select('*')
        .eq('user_id', user.id);

      if (error) throw error;

      // Create export data
      const exportData = {
        user_profile: {
          id: user.id,
          email: user.email,
          name: user.user_metadata?.full_name,
          created_at: user.created_at
        },
        problems: problems,
        exported_at: new Date().toISOString(),
        total_problems: problems?.length || 0
      };

      // Download as JSON
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `repair-assistant-data-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      alert('Data exported successfully!');
      
    } catch (error) {
      console.error('Error exporting data:', error);
      alert('Error exporting data: ' + error.message);
    } finally {
      setIsUpdating(false);
    }
  };

  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900 mx-auto mb-4"></div>
          <p className="text-gray-500">Loading settings...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 mb-4">Please sign in to access settings</p>
          <button
            onClick={() => router.push('/auth')}
            className="bg-slate-900 text-white px-6 py-2 rounded-xl"
          >
            Sign In
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-white border-b border-gray-100 shadow-sm">
        <div className="px-6 py-6">
          <Navigation 
            user={user} 
            onSignOut={signOut} 
            title="Account Settings"
            subtitle="Manage your profile and preferences"
          />
        </div>
      </div>

      <div className="px-6 py-6 space-y-6">
        
        {/* Account Overview */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Account Overview</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-blue-50 rounded-xl p-4">
              <div className="text-2xl font-bold text-blue-600">{userStats.totalProblems}</div>
              <div className="text-sm text-blue-800">Total Problems</div>
            </div>
            
            <div className="bg-green-50 rounded-xl p-4">
              <div className="text-2xl font-bold text-green-600">{userStats.fixedProblems}</div>
              <div className="text-sm text-green-800">Fixed Problems</div>
            </div>
            
            <div className="bg-yellow-50 rounded-xl p-4">
              <div className="text-2xl font-bold text-yellow-600">{userStats.inProgressProblems}</div>
              <div className="text-sm text-yellow-800">In Progress</div>
            </div>
            
            <div className="bg-purple-50 rounded-xl p-4">
              <div className="text-2xl font-bold text-purple-600">{userStats.storageUsed}</div>
              <div className="text-sm text-purple-800">Storage Used</div>
            </div>
          </div>
          
          <div className="mt-4 pt-4 border-t border-gray-100">
            <p className="text-sm text-gray-600">
              Member since: <span className="font-medium">{userStats.joinDate}</span>
            </p>
          </div>
        </div>

        {/* Profile Settings */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Profile Information</h2>
            <button
              onClick={() => setIsEditingProfile(!isEditingProfile)}
              className="text-blue-600 hover:text-blue-700 text-sm font-medium"
            >
              {isEditingProfile ? 'Cancel' : 'Edit'}
            </button>
          </div>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
              {isEditingProfile ? (
                <input
                  type="text"
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              ) : (
                <div className="py-2 text-gray-900">{profileName || 'Not set'}</div>
              )}
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <div className="py-2 text-gray-600">{profileEmail}</div>
              <p className="text-xs text-gray-500">Email cannot be changed directly</p>
            </div>
            
            {isEditingProfile && (
              <button
                onClick={updateProfile}
                disabled={isUpdating}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl disabled:opacity-50"
              >
                {isUpdating ? 'Updating...' : 'Save Changes'}
              </button>
            )}
          </div>
        </div>

        {/* Security Settings */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Security</h2>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
              <div>
                <h3 className="font-medium text-gray-900">Password</h3>
                <p className="text-sm text-gray-600">Change your account password</p>
              </div>
              <button
                onClick={changePassword}
                disabled={isUpdating}
                className="bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-xl disabled:opacity-50"
              >
                {isUpdating ? 'Sending...' : 'Reset Password'}
              </button>
            </div>
          </div>
        </div>

        {/* Data Management */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Data Management</h2>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-blue-50 rounded-xl">
              <div>
                <h3 className="font-medium text-gray-900">Export Your Data</h3>
                <p className="text-sm text-gray-600">Download all your problems and data</p>
              </div>
              <button
                onClick={exportUserData}
                disabled={isUpdating}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl disabled:opacity-50"
              >
                {isUpdating ? 'Exporting...' : 'Download Data'}
              </button>
            </div>
            
            <div className="flex items-center justify-between p-4 bg-orange-50 rounded-xl">
              <div>
                <h3 className="font-medium text-gray-900">Delete All Data</h3>
                <p className="text-sm text-gray-600">Remove all your problems and content (keeps account)</p>
              </div>
              <button
                onClick={() => setShowDataDeleteConfirmation(true)}
                className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-xl"
              >
                Delete Data
              </button>
            </div>
          </div>
        </div>

        {/* Danger Zone */}
        <div className="bg-white rounded-2xl shadow-sm border border-red-200 p-6">
          <h2 className="text-lg font-semibold text-red-600 mb-4">Danger Zone</h2>
          
          <div className="p-4 bg-red-50 rounded-xl">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium text-red-900">Delete Account</h3>
                <p className="text-sm text-red-600">Permanently delete your account and all data</p>
              </div>
              <button
                onClick={() => setShowDeleteConfirmation(true)}
                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-xl"
              >
                Delete Account
              </button>
            </div>
          </div>
        </div>

      </div>

      {/* Delete Data Confirmation Modal */}
      {showDataDeleteConfirmation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full">
            <h3 className="text-lg font-bold text-gray-900 mb-2">Delete All Your Data</h3>
            <p className="text-gray-600 mb-4">
              This will permanently delete all your problems, images, videos, and diagnoses. Your account will remain active but empty.
            </p>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Type "DELETE MY DATA" to confirm:
              </label>
              <input
                type="text"
                value={dataDeleteConfirmationText}
                onChange={(e) => setDataDeleteConfirmationText(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent"
              />
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowDataDeleteConfirmation(false);
                  setDataDeleteConfirmationText('');
                }}
                className="flex-1 bg-gray-200 text-gray-800 py-2 px-4 rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={deleteAllUserData}
                disabled={isUpdating || dataDeleteConfirmationText !== 'DELETE MY DATA'}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2 px-4 rounded-xl disabled:opacity-50"
              >
                {isUpdating ? 'Deleting...' : 'Delete Data'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Account Confirmation Modal */}
      {showDeleteConfirmation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full">
            <h3 className="text-lg font-bold text-red-600 mb-2">Delete Account</h3>
            <p className="text-gray-600 mb-4">
              This action cannot be undone. This will permanently delete your account and all associated data.
            </p>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Type "DELETE MY ACCOUNT" to confirm:
              </label>
              <input
                type="text"
                value={deleteConfirmationText}
                onChange={(e) => setDeleteConfirmationText(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent"
              />
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowDeleteConfirmation(false);
                  setDeleteConfirmationText('');
                }}
                className="flex-1 bg-gray-200 text-gray-800 py-2 px-4 rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={deleteAccount}
                disabled={isUpdating || deleteConfirmationText !== 'DELETE MY ACCOUNT'}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2 px-4 rounded-xl disabled:opacity-50"
              >
                {isUpdating ? 'Deleting...' : 'Delete Account'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}