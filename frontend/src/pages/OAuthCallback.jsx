import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const OAuthCallback = () => {
  const navigate = useNavigate();
  const { setAuthToken } = useAuth();

  useEffect(() => {
   const params = new URLSearchParams(window.location.search);
   const token = params.get('token');
  const error = params.get('error');

  // Clear sensitive params from URL/history
  window.history.replaceState({}, '', window.location.pathname);

  if (error) {
    // Redirect with error state for user feedback
    navigate('/', { replace: true, state: { authError: error } });
  } else if (token) {
     setAuthToken(token);
     navigate('/', { replace: true });
   } else {
    navigate('/', { replace: true, state: { authError: 'Authentication failed' } });
   }
 }, [navigate, setAuthToken])

  return (
    <div className="min-h-screen flex items-center justify-center bg-white dark:bg-dark-bg">
      <div className="text-gray-700 dark:text-gray-300">Signing you in...</div>
    </div>
  );
};

export default OAuthCallback;
